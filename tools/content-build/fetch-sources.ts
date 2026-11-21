// Downloads the third-party sources that are kept out of git: the content sources into
// content/sources/ and the KFGQPC Quran font into assets/fonts/.
// The QUL English word-by-word file needs a QUL account; see content/README.md.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { QuranEncMeta } from './quranenc.ts';
import { extractFromZip } from './zip.ts';

const ROOT = join(import.meta.dirname, '..', '..');

type Source = {
  path: string;
  url: string;
  sha256?: string;
  /** Save only this file from the downloaded zip archive. */
  extract?: string;
};

const SOURCES: Source[] = [
  {
    path: 'content/sources/hafsData_v2-0.json',
    // KFGQPC UthmanicHafs v2.0 (data v2.0, 2022-09-07). The official download
    // (download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip) is no longer available;
    // this is the byte-identical quran-ws mirror (KFGQPC-published SHA-1
    // 36ea5ab0d7ea1702f17ff43f9b50924cccd77ebf). All rights reserved by KFGQPC; see content/README.md.
    url: 'https://cdn.quran.ws/KFGQPC/resources/quran-dev/uthmanic-hafs/UthmanicHafs_v2-0.zip',
    sha256: 'a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c',
    extract: 'hafsData_v2-0.json',
  },
  {
    path: 'content/sources/quran-morphology.txt',
    // Pinned commit of mustafa0x/quran-morphology (corrected Quranic Arabic Corpus v0.4).
    url: 'https://raw.githubusercontent.com/mustafa0x/quran-morphology/8f38b39016824284f9ed16ae15069ff9102c4acf/quran-morphology.txt',
  },
  {
    path: 'assets/fonts/UthmanicHafs-v9.otf',
    // KFGQPC Uthmanic Script Hafs v9. The official download is no longer available, so this is a
    // pinned copy from the quranwbw/qpc-fonts mirror, verified by checksum. Not committed: the
    // font's license forbids reproduction without KFGQPC's written approval.
    url: 'https://raw.githubusercontent.com/quranwbw/qpc-fonts/76caf007eb341c43ceda23ad0ee61efaa6e4f080/various/UthmanicHafs1%20Ver09.otf',
    sha256: '59e20b2403687a67854fd199861abed3528068c035d2689898465d5faf39bb31',
  },
];

const sha256Of = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

function write(path: string, data: Buffer | string) {
  const file = join(ROOT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`Downloaded ${path}`);
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

for (const { path, url, sha256, extract } of SOURCES) {
  const body = await download(url);
  if (sha256) {
    const actual = sha256Of(body);
    if (actual !== sha256) throw new Error(`Checksum mismatch for ${path}: got ${actual}`);
  }
  write(path, extract ? extractFromZip(body, extract) : body);
}

// QuranEnc translation and tafsir, stored unmodified with a `<key>.meta.json` recording the
// version (QuranEnc's terms require showing it). See content/README.md.
const QURANENC_API = 'https://quranenc.com/api/v1';
const QURANENC_DIR = 'content/sources/quranenc';
const today = new Date().toISOString().slice(0, 10);
const writeMeta = (meta: QuranEncMeta) =>
  write(`${QURANENC_DIR}/${meta.key}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`);

// Rowwad English translation: one SQLite file for the whole Quran, versioned.
{
  const key = 'english_rwwad';
  const list = JSON.parse((await download(`${QURANENC_API}/translations/list`)).toString()) as {
    translations: {
      key: string;
      title: string;
      version: string;
      database_uncompressed_url: string;
    }[];
  };
  const listing = list.translations.find((t) => t.key === key);
  if (!listing) throw new Error(`QuranEnc no longer lists ${key}`);
  const sqlite = await download(listing.database_uncompressed_url);
  write(`${QURANENC_DIR}/${key}.sqlite`, sqlite);
  writeMeta({
    key,
    title: listing.title,
    url: `https://quranenc.com/en/browse/${key}`,
    version: listing.version,
    fetchedAt: today,
    sha256: sha256Of(sqlite),
  });
}

// Al-Mukhtasar English tafsir: not listed by QuranEnc, no bulk file and no version, so it is
// fetched surah by surah and identified by fetch date and checksum. Rows are kept exactly as the
// API returns them, concatenated into one `{"result": [...]}` document.
{
  const key = 'english_mokhtasar';
  const rows: unknown[] = [];
  for (let surah = 1; surah <= 114; surah++) {
    const url = `${QURANENC_API}/translation/sura/${key}/${surah}`;
    const { result } = JSON.parse((await download(url)).toString()) as { result: unknown[] };
    rows.push(...result);
  }
  if (rows.length !== 6236) throw new Error(`${key}: expected 6236 ayahs, got ${rows.length}`);
  const json = `${JSON.stringify({ result: rows })}\n`;
  write(`${QURANENC_DIR}/${key}.json`, json);
  writeMeta({
    key,
    title:
      'Al-Mukhtasar in Interpreting the Noble Quran - English (Tafsir Center for Quranic Studies)',
    url: 'https://quranenc.com',
    version: null,
    fetchedAt: today,
    sha256: sha256Of(json),
  });
}
