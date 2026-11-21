// Downloads the third-party sources that are kept out of git: the content sources into
// content/sources/ and the KFGQPC Quran font into assets/fonts/.
// The QUL English word-by-word file needs a QUL account; see content/README.md.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

for (const { path, url, sha256, extract } of SOURCES) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${path}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (sha256) {
    const actual = createHash('sha256').update(body).digest('hex');
    if (actual !== sha256) throw new Error(`Checksum mismatch for ${path}: got ${actual}`);
  }
  const file = join(ROOT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, extract ? extractFromZip(body, extract) : body);
  console.log(`Downloaded ${path}`);
}
