// Builds the bundled content database (assets/content/content.db) from content/sources/.
// Run `npm run content:fetch` first; see content/README.md for the sources and their licenses.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTENT_VERSION } from '../../src/content/version.ts';
import { buildContentDatabase } from './build.ts';
import { parseGlossary } from './glossary.ts';
import { parseQulWordByWord } from './qul.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SOURCES_DIR = join(ROOT, 'content', 'sources');
const OUT_DIR = join(ROOT, 'assets', 'content');
const QUL_ENGLISH_WORD_BY_WORD = join(SOURCES_DIR, 'qul-english-word-by-word.json');

/** Surahs included in the bundled database. Grows with the curriculum. */
const SURAHS = [1];

const read = (file: string) => readFileSync(join(SOURCES_DIR, file), 'utf8');

if (!existsSync(QUL_ENGLISH_WORD_BY_WORD)) {
  throw new Error(
    `Missing ${QUL_ENGLISH_WORD_BY_WORD}. Download QUL's "English Word by Word Translation" (JSON); see content/README.md.`,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, 'content.db');
buildContentDatabase({
  tanzilText: read('quran-uthmani.txt'),
  morphologyText: read('quran-morphology.txt'),
  glosses: { en: parseQulWordByWord(readFileSync(QUL_ENGLISH_WORD_BY_WORD, 'utf8')) },
  glossary: parseGlossary(readFileSync(join(ROOT, 'content', 'glossary.json'), 'utf8')),
  surahs: SURAHS,
  contentVersion: CONTENT_VERSION,
  outFile,
});
console.log(`Built ${outFile} (content version ${CONTENT_VERSION}, surahs ${SURAHS.join(', ')})`);
