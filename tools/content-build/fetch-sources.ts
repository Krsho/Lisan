// Downloads the publicly available content sources into content/sources/.
// The QUL English word-by-word file needs a QUL account; see content/README.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES_DIR = join(import.meta.dirname, '..', '..', 'content', 'sources');

const SOURCES = [
  {
    file: 'quran-uthmani.txt',
    url: 'https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&alif=true&quranType=uthmani&outType=txt-2&agree=true',
  },
  {
    file: 'quran-morphology.txt',
    // Pinned commit of mustafa0x/quran-morphology (corrected Quranic Arabic Corpus v0.4).
    url: 'https://raw.githubusercontent.com/mustafa0x/quran-morphology/8f38b39016824284f9ed16ae15069ff9102c4acf/quran-morphology.txt',
  },
];

mkdirSync(SOURCES_DIR, { recursive: true });
for (const { file, url } of SOURCES) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${file}: HTTP ${response.status}`);
  writeFileSync(join(SOURCES_DIR, file), await response.text());
  console.log(`Downloaded ${file}`);
}
