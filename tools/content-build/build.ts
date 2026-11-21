import { existsSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { alignAyah, WORD_ALIGNMENT, type WordAlignment } from './alignment.ts';
import { describeSegment } from './features.ts';
import { translationsOf, type Glossary } from './glossary.ts';
import { bareWord, parseKfgqpc, splitWords } from './kfgqpc.ts';
import { parseMorphology, type Segment } from './morphology.ts';
import { pathOrder } from './path.ts';
import type { QuranEncEdition } from './quranenc.ts';

/** Word glosses per language code, each keyed by `surah:ayah:word` in QUL's word numbering. */
export type GlossesByLanguage = Record<string, Record<string, string>>;

export type BuildOptions = {
  /** KFGQPC UthmanicHafs data (hafsData_v2-0.json). Every ayah in it is built. */
  quranText: string;
  /** Quranic Arabic Corpus morphology (mustafa0x/quran-morphology format) for the same ayahs. */
  morphologyText: string;
  glosses: GlossesByLanguage;
  /** Grammatical terms (content/glossary.json) explaining every morphology tag. */
  glossary: Glossary;
  /** Where the text's word boundaries differ from the morphology's. Defaults to WORD_ALIGNMENT. */
  alignment?: WordAlignment;
  /** Full ayah translations per language code (QuranEnc). */
  translations: Record<string, QuranEncEdition>;
  /** Short tafsir per language code (QuranEnc). */
  tafsirs: Record<string, QuranEncEdition>;
  contentVersion: number;
  outFile: string;
};

const SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE surahs (
    surah INTEGER PRIMARY KEY, name_english TEXT NOT NULL, name_arabic TEXT NOT NULL,
    ayah_count INTEGER NOT NULL, has_basmala INTEGER NOT NULL
  );
  -- An ayah's text is its words joined by spaces.
  CREATE TABLE ayahs (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL,
    juz INTEGER NOT NULL, page INTEGER NOT NULL, hizb_quarter INTEGER NOT NULL,
    PRIMARY KEY (surah, ayah)
  ) WITHOUT ROWID;
  CREATE TABLE words (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, position INTEGER NOT NULL,
    text TEXT NOT NULL,
    -- The word without pause marks; NULL where that is the text itself.
    bare TEXT,
    PRIMARY KEY (surah, ayah, position)
  ) WITHOUT ROWID;
  CREATE TABLE segments (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, position INTEGER NOT NULL,
    corpus_word INTEGER NOT NULL, text TEXT NOT NULL, lemma TEXT, root TEXT,
    -- Ids of the segment's glossary terms in display order, separated by spaces.
    terms TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, position)
  ) WITHOUT ROWID;
  CREATE TABLE lemmas (lemma TEXT PRIMARY KEY, frequency INTEGER NOT NULL) WITHOUT ROWID;
  CREATE TABLE glosses (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, language TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, language)
  ) WITHOUT ROWID;
  CREATE TABLE terms (id INTEGER PRIMARY KEY, term TEXT NOT NULL UNIQUE, arabic TEXT NOT NULL);
  CREATE TABLE term_translations (
    term TEXT NOT NULL, language TEXT NOT NULL, name TEXT NOT NULL, definition TEXT NOT NULL,
    PRIMARY KEY (term, language)
  ) WITHOUT ROWID;
  CREATE TABLE editions (
    kind TEXT NOT NULL, language TEXT NOT NULL, key TEXT NOT NULL, title TEXT NOT NULL,
    url TEXT NOT NULL, version TEXT, fetched_at TEXT NOT NULL, sha256 TEXT NOT NULL,
    PRIMARY KEY (kind, language)
  ) WITHOUT ROWID;
  CREATE TABLE ayah_texts (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, kind TEXT NOT NULL, language TEXT NOT NULL,
    text TEXT NOT NULL, footnotes TEXT,
    PRIMARY KEY (surah, ayah, kind, language)
  ) WITHOUT ROWID;
  -- The curated path: ayahs in study order, from position 1.
  CREATE TABLE path (
    position INTEGER PRIMARY KEY, surah INTEGER NOT NULL, ayah INTEGER NOT NULL,
    UNIQUE (surah, ayah)
  );
`;

/** Surahs that open without a Basmala header: in Al-Fatiha it is ayah 1, At-Tawbah has none. */
const NO_BASMALA_HEADER = new Set([1, 9]);

type EditionKind = 'translation' | 'tafsir';

/** Builds the bundled content database. Throws if the sources disagree. */
export function buildContentDatabase(options: BuildOptions): void {
  const { contentVersion, outFile, glosses, glossary, alignment = WORD_ALIGNMENT } = options;
  const ayahs = parseKfgqpc(options.quranText);
  const segmentsByAyah = groupByAyah(parseMorphology(options.morphologyText));
  const textAyahs = new Set(ayahs.map((a) => `${a.surah}:${a.ayah}`));
  for (const location of segmentsByAyah.keys()) {
    if (!textAyahs.has(location))
      throw new Error(`Morphology has words for ${location}, which the text lacks`);
  }

  // Build into a temporary file and only replace outFile once the build succeeds,
  // so a failed build never clobbers the previous (committed) database.
  const tempFile = `${outFile}.building`;
  if (existsSync(tempFile)) rmSync(tempFile);
  const db = new DatabaseSync(tempFile);
  let succeeded = false;
  try {
    db.exec(SCHEMA);
    db.exec('BEGIN');
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    insertMeta.run('content_version', String(contentVersion));
    insertMeta.run('quran_text', 'KFGQPC Uthmanic Hafs data v2.0 (hafsData_v2-0.json)');

    const insertSurah = db.prepare('INSERT INTO surahs VALUES (?, ?, ?, ?, ?)');
    const insertAyah = db.prepare('INSERT INTO ayahs VALUES (?, ?, ?, ?, ?)');
    const insertWord = db.prepare('INSERT INTO words VALUES (?, ?, ?, ?, ?)');
    const insertSegment = db.prepare('INSERT INTO segments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertLemma = db.prepare('INSERT INTO lemmas VALUES (?, ?)');
    const insertGloss = db.prepare('INSERT INTO glosses VALUES (?, ?, ?, ?, ?)');
    const insertTerm = db.prepare('INSERT INTO terms VALUES (?, ?, ?)');
    const insertTermTranslation = db.prepare('INSERT INTO term_translations VALUES (?, ?, ?, ?)');

    /** Per ayah: gloss position → displayed word position. */
    const glossTargets = new Map<string, Map<number, number>>();
    const lemmaFrequency = new Map<string, number>();
    // Segments refer to terms by a small id, which keeps the database compact.
    const termIds = new Map(Object.keys(glossary).map((term, i) => [term, i + 1]));
    for (const quranAyah of ayahs) {
      const { surah, ayah, text } = quranAyah;
      const location = `${surah}:${ayah}`;
      const ayahSegments = segmentsByAyah.get(location) ?? [];
      const corpusWordCount = Math.max(0, ...ayahSegments.map((s) => s.word));
      const display = alignAyah(location, splitWords(text), corpusWordCount, alignment[location]);
      insertAyah.run(surah, ayah, quranAyah.juz, quranAyah.page, quranAyah.hizbQuarter ? 1 : 0);

      const targets = new Map<number, number>();
      glossTargets.set(location, targets);
      display.forEach((word, i) => {
        const position = i + 1;
        const bare = bareWord(word.text);
        insertWord.run(surah, ayah, position, word.text, bare === word.text ? null : bare);
        for (let g = word.glosses[0]; g <= word.glosses[1]; g++) targets.set(g, position);

        const wordSegments = ayahSegments.filter(
          (s) => s.word >= word.words[0] && s.word <= word.words[1],
        );
        wordSegments.forEach((s, j) => {
          const segment = j + 1;
          const inMultiSegmentWord = ayahSegments.some((o) => o.word === s.word && o !== s);
          const { lemma, root, terms } = describeSegment(s, inMultiSegmentWord);
          const ids = terms.map((term) => {
            const id = termIds.get(term);
            if (id === undefined) throw new Error(`Glossary has no entry for term ${term}`);
            return id;
          });
          insertSegment.run(
            surah,
            ayah,
            position,
            segment,
            s.word,
            s.text,
            lemma,
            root,
            ids.join(' '),
          );
          if (lemma) lemmaFrequency.set(lemma, (lemmaFrequency.get(lemma) ?? 0) + 1);
        });
      });
    }

    for (const [lemma, frequency] of lemmaFrequency) insertLemma.run(lemma, frequency);

    const insertPath = db.prepare('INSERT INTO path VALUES (?, ?, ?)');
    pathOrder(ayahs).forEach(({ surah, ayah }, i) => insertPath.run(i + 1, surah, ayah));

    const surahRows = new Map<number, { english: string; arabic: string; ayahCount: number }>();
    for (const a of ayahs) {
      const row = surahRows.get(a.surah);
      if (row) row.ayahCount++;
      else
        surahRows.set(a.surah, {
          english: a.surahNameEnglish,
          arabic: a.surahNameArabic,
          ayahCount: 1,
        });
    }
    for (const [surah, { english, arabic, ayahCount }] of surahRows) {
      insertSurah.run(surah, english, arabic, ayahCount, NO_BASMALA_HEADER.has(surah) ? 0 : 1);
    }

    for (const [language, byWord] of Object.entries(glosses)) {
      // Glosses joined per displayed word, in gloss order. Words covering several gloss positions
      // (e.g. لَّوۡمَا "Why" + "not") get them joined, without repeating an identical gloss.
      const joined = new Map<string, string[]>();
      for (const [key, gloss] of Object.entries(byWord)) {
        const [surah, ayah, glossPosition] = key.split(':').map(Number);
        const location = `${surah}:${ayah}`;
        const targets = glossTargets.get(location);
        if (!targets) continue; // An ayah outside the built text.
        const word = targets.get(glossPosition);
        if (word === undefined) throw new Error(`${language} gloss ${key} has no matching word`);
        const parts = joined.get(`${location}:${word}`);
        if (!parts) joined.set(`${location}:${word}`, [gloss]);
        else if (parts[parts.length - 1] !== gloss) parts.push(gloss);
      }
      for (const [key, parts] of joined) {
        const [surah, ayah, word] = key.split(':').map(Number);
        insertGloss.run(surah, ayah, word, language, parts.join(' '));
      }
    }

    for (const [term, entry] of Object.entries(glossary)) {
      insertTerm.run(termIds.get(term)!, term, entry.ar);
      for (const [language, { name, definition }] of translationsOf(glossary, term)) {
        insertTermTranslation.run(term, language, name, definition);
      }
    }

    // Translations and tafsir are stored verbatim: QuranEnc's terms forbid any modification.
    const insertEdition = db.prepare('INSERT INTO editions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertAyahText = db.prepare('INSERT INTO ayah_texts VALUES (?, ?, ?, ?, ?, ?)');
    const editions: [EditionKind, Record<string, QuranEncEdition>][] = [
      ['translation', options.translations],
      ['tafsir', options.tafsirs],
    ];
    for (const [kind, byLanguage] of editions) {
      for (const [language, edition] of Object.entries(byLanguage)) {
        const { key, title, url, version, fetchedAt, sha256 } = edition;
        insertEdition.run(kind, language, key, title, url, version, fetchedAt, sha256);
        const covered = new Set<string>();
        for (const { surah, ayah, text, footnotes } of edition.ayahs) {
          const ayahKey = `${surah}:${ayah}`;
          if (!textAyahs.has(ayahKey)) {
            throw new Error(`${language} ${kind} ${key} has ${ayahKey}, which is not in the text`);
          }
          covered.add(ayahKey);
          insertAyahText.run(surah, ayah, kind, language, text, footnotes);
        }
        for (const ayahKey of textAyahs) {
          if (!covered.has(ayahKey))
            throw new Error(`${language} ${kind} ${key} is missing ${ayahKey}`);
        }
      }
    }

    db.exec('COMMIT');
    db.exec('VACUUM');
    succeeded = true;
  } finally {
    db.close();
    if (!succeeded) rmSync(tempFile, { force: true });
  }
  renameSync(tempFile, outFile);
}

function groupByAyah(segments: Segment[]): Map<string, Segment[]> {
  const map = new Map<string, Segment[]>();
  for (const segment of segments) {
    const key = `${segment.surah}:${segment.ayah}`;
    const list = map.get(key);
    if (list) list.push(segment);
    else map.set(key, [segment]);
  }
  return map;
}
