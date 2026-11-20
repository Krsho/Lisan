import { existsSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

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
    text TEXT NOT NULL, pos TEXT NOT NULL, tags TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, position)
  ) WITHOUT ROWID;
  CREATE TABLE glosses (
    surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL, language TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (surah, ayah, word, language)
  ) WITHOUT ROWID;
`;

/** Builds the bundled content database for the given surahs. Throws if the sources disagree. */
export function buildContentDatabase(options: BuildOptions): void {
  const { surahs, contentVersion, outFile, glosses } = options;
  const wanted = new Set(surahs);
  const tanzil = parseTanzil(options.tanzilText);
  const segments = parseMorphology(options.morphologyText).filter((s) => wanted.has(s.surah));
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
    const insertGloss = db.prepare('INSERT INTO glosses VALUES (?, ?, ?, ?, ?)');

    const wordCounts = new Map<string, number>();
    for (const { surah, ayah, text } of tanzil.ayahs.filter((a) => wanted.has(a.surah))) {
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
        insertSegment.run(s.surah, s.ayah, s.word, s.position, s.text, s.pos, s.tags.join('|'));
      }
    }

    for (const [language, byWord] of Object.entries(glosses)) {
      for (const [key, gloss] of Object.entries(byWord)) {
        const [surah, ayah, word] = key.split(':').map(Number);
        if (!wanted.has(surah)) continue;
        if (word > (wordCounts.get(`${surah}:${ayah}`) ?? 0)) {
          throw new Error(`${language} gloss ${key} has no matching word`);
        }
        insertGloss.run(surah, ayah, word, language, gloss);
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
