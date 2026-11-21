import { existsSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { describeSegment } from './features.ts';
import { translationsOf, type Glossary } from './glossary.ts';
import { parseMorphology, type Segment } from './morphology.ts';
import { parseTanzil, splitWords } from './tanzil.ts';

/** Word glosses per language code, each keyed by `surah:ayah:word`. */
export type GlossesByLanguage = Record<string, Record<string, string>>;

export type BuildOptions = {
  /** Tanzil Uthmani text in `surah|ayah|text` format, including its copyright block. */
  tanzilText: string;
  /** Quranic Arabic Corpus morphology (mustafa0x/quran-morphology format). */
  morphologyText: string;
  glosses: GlossesByLanguage;
  /** Grammatical terms (content/glossary.json) explaining every morphology tag. */
  glossary: Glossary;
  surahs: number[];
  contentVersion: number;
  outFile: string;
};

const SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE ayahs (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (surah, ayah)
  ) WITHOUT ROWID;
  CREATE TABLE words (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, position INTEGER NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, position)
  ) WITHOUT ROWID;
  CREATE TABLE segments (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, position INTEGER NOT NULL,
    text TEXT NOT NULL, lemma TEXT, root TEXT,
    PRIMARY KEY (surah, ayah, word, position)
  ) WITHOUT ROWID;
  CREATE TABLE segment_terms (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, segment INTEGER NOT NULL,
    ordinal INTEGER NOT NULL, term TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, segment, ordinal)
  ) WITHOUT ROWID;
  CREATE TABLE glosses (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, language TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, language)
  ) WITHOUT ROWID;
  CREATE TABLE terms (term TEXT PRIMARY KEY, arabic TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE term_translations (
    term TEXT NOT NULL, language TEXT NOT NULL, name TEXT NOT NULL, definition TEXT NOT NULL,
    PRIMARY KEY (term, language)
  ) WITHOUT ROWID;
`;

/** Builds the bundled content database for the given surahs. Throws if the sources disagree. */
export function buildContentDatabase(options: BuildOptions): void {
  const { surahs, contentVersion, outFile, glosses, glossary } = options;
  const includedSurahs = new Set(surahs);
  const tanzil = parseTanzil(options.tanzilText);
  const segments = parseMorphology(options.morphologyText).filter((s) =>
    includedSurahs.has(s.surah),
  );
  const segmentsByAyah = groupByAyah(segments);

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
    insertMeta.run('tanzil_copyright', tanzil.copyright);

    const insertAyah = db.prepare('INSERT INTO ayahs VALUES (?, ?, ?)');
    const insertWord = db.prepare('INSERT INTO words VALUES (?, ?, ?, ?)');
    const insertSegment = db.prepare('INSERT INTO segments VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertSegmentTerm = db.prepare('INSERT INTO segment_terms VALUES (?, ?, ?, ?, ?, ?)');
    const insertGloss = db.prepare('INSERT INTO glosses VALUES (?, ?, ?, ?, ?)');
    const insertTerm = db.prepare('INSERT INTO terms VALUES (?, ?)');
    const insertTermTranslation = db.prepare('INSERT INTO term_translations VALUES (?, ?, ?, ?)');

    const wordCounts = new Map<string, number>();
    const usedTerms = new Set<string>();
    for (const { surah, ayah, text } of tanzil.ayahs.filter((a) => includedSurahs.has(a.surah))) {
      const words = splitWords(text);
      const ayahSegments = segmentsByAyah.get(`${surah}:${ayah}`) ?? [];
      const morphologyWordCount = Math.max(0, ...ayahSegments.map((s) => s.word));
      if (words.length !== morphologyWordCount) {
        throw new Error(
          `Word count mismatch in ${surah}:${ayah}: Tanzil has ${words.length}, morphology has ${morphologyWordCount}`,
        );
      }
      wordCounts.set(`${surah}:${ayah}`, words.length);
      insertAyah.run(surah, ayah, text);
      words.forEach((word, i) => insertWord.run(surah, ayah, i + 1, word));
      for (const s of ayahSegments) {
        const inMultiSegmentWord = ayahSegments.some((o) => o.word === s.word && o !== s);
        const { lemma, root, terms } = describeSegment(s, inMultiSegmentWord);
        insertSegment.run(s.surah, s.ayah, s.word, s.position, s.text, lemma, root);
        terms.forEach((term, i) => {
          usedTerms.add(term);
          insertSegmentTerm.run(s.surah, s.ayah, s.word, s.position, i + 1, term);
        });
      }
    }

    for (const [language, byWord] of Object.entries(glosses)) {
      for (const [key, gloss] of Object.entries(byWord)) {
        const [surah, ayah, word] = key.split(':').map(Number);
        if (!includedSurahs.has(surah)) continue;
        if (word > (wordCounts.get(`${surah}:${ayah}`) ?? 0)) {
          throw new Error(`${language} gloss ${key} has no matching word`);
        }
        insertGloss.run(surah, ayah, word, language, gloss);
      }
    }

    for (const term of usedTerms) {
      if (!glossary[term]) throw new Error(`Glossary has no entry for term ${term}`);
    }
    for (const [term, entry] of Object.entries(glossary)) {
      insertTerm.run(term, entry.ar);
      for (const [language, { name, definition }] of translationsOf(glossary, term)) {
        insertTermTranslation.run(term, language, name, definition);
      }
    }

    db.exec('COMMIT');
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
