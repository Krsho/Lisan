// Builds the bundled content database (assets/content/content.db) from content/sources/.
// Run `npm run content:fetch` first; see content/README.md for the sources and their licenses.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CONTENT_VERSION } from '../../src/content/version.ts';
import { buildContentDatabase } from './build.ts';
import { parseGlossary } from './glossary.ts';
import { readNotesDirectory } from './notes.ts';
import { parseQulWordByWord } from './qul.ts';
import {
  parseQuranEncResult,
  readQuranEncSqlite,
  type QuranEncEdition,
  type QuranEncMeta,
} from './quranenc.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SOURCES_DIR = join(ROOT, 'content', 'sources');
const QURANENC_DIR = join(SOURCES_DIR, 'quranenc');
const OUT_DIR = join(ROOT, 'assets', 'content');
const NOTES_DIR = join(ROOT, 'content', 'notes');
const QUL_ENGLISH_WORD_BY_WORD = join(SOURCES_DIR, 'qul-english-word-by-word.json');

const read = (file: string) => readFileSync(join(SOURCES_DIR, file), 'utf8');

/** Loads a QuranEnc source downloaded by content:fetch, with its version metadata. */
function quranEnc(key: string, format: 'sqlite' | 'json'): QuranEncEdition {
  const metaFile = join(QURANENC_DIR, `${key}.meta.json`);
  if (!existsSync(metaFile)) throw new Error(`Missing ${metaFile}. Run npm run content:fetch.`);
  const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as QuranEncMeta;
  const data = join(QURANENC_DIR, `${key}.${format}`);
  const ayahs =
    format === 'sqlite'
      ? readQuranEncSqlite(data)
      : parseQuranEncResult(readFileSync(data, 'utf8'));
  return { ...meta, ayahs };
}

if (!existsSync(QUL_ENGLISH_WORD_BY_WORD)) {
  throw new Error(
    `Missing ${QUL_ENGLISH_WORD_BY_WORD}. Download QUL's "English Word by Word Translation" (JSON); see content/README.md.`,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, 'content.db');
buildContentDatabase({
  quranText: read('hafsData_v2-0.json'),
  morphologyText: read('quran-morphology.txt'),
  glosses: { en: parseQulWordByWord(readFileSync(QUL_ENGLISH_WORD_BY_WORD, 'utf8')) },
  glossary: parseGlossary(readFileSync(join(ROOT, 'content', 'glossary.json'), 'utf8')),
  translations: { en: quranEnc('english_rwwad', 'sqlite') },
  tafsirs: { en: quranEnc('english_mokhtasar', 'json') },
  notes: readNotesDirectory(NOTES_DIR),
  contentVersion: CONTENT_VERSION,
  outFile,
});
const megabytes = (statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`Built ${outFile} (content version ${CONTENT_VERSION}, ${megabytes} MB)`);
