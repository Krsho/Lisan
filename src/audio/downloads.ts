/**
 * Bookkeeping for user-requested offline audio. The file system is the record: a reciter's
 * directory holds one `SSSAAA.mp3` per downloaded ayah, and a file is only moved there once it
 * has downloaded completely. These functions work on the directory's file names.
 */
import { ayahFileStem, type AyahRef } from './source';

const FILE_NAME = /^(\d{3})(\d{3})\.mp3$/;

export const ayahFileName = (ref: AyahRef) => `${ayahFileStem(ref)}.mp3`;

export function parseAyahFileName(name: string): AyahRef | null {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  return surah >= 1 && surah <= 114 && ayah >= 1 ? { surah, ayah } : null;
}

export type SurahDownloadState = { downloaded: number; total: number; complete: boolean };

function downloadedAyahs(surah: number, ayahCount: number, fileNames: string[]): Set<number> {
  const ayahs = new Set<number>();
  for (const name of fileNames) {
    const ref = parseAyahFileName(name);
    if (ref && ref.surah === surah && ref.ayah <= ayahCount) ayahs.add(ref.ayah);
  }
  return ayahs;
}

export function surahDownloadState(
  surah: number,
  ayahCount: number,
  fileNames: string[],
): SurahDownloadState {
  const downloaded = downloadedAyahs(surah, ayahCount, fileNames).size;
  return { downloaded, total: ayahCount, complete: downloaded === ayahCount };
}

/** The surah's ayahs that have no file yet, in order. */
export function ayahsToDownload(surah: number, ayahCount: number, fileNames: string[]): number[] {
  const have = downloadedAyahs(surah, ayahCount, fileNames);
  const missing: number[] = [];
  for (let ayah = 1; ayah <= ayahCount; ayah++) if (!have.has(ayah)) missing.push(ayah);
  return missing;
}

/** Every ayah file of the surah, to delete when the user removes its download. */
export const filesOfSurah = (surah: number, fileNames: string[]) =>
  fileNames.filter((name) => parseAyahFileName(name)?.surah === surah);

/**
 * Runs `work` over `items` with at most `limit` running at once. After the first failure no new
 * work starts, and the returned promise rejects with that failure once running work settles.
 */
export async function runWithLimit<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | null = null;
  const lane = async () => {
    while (!failure && next < items.length) {
      const item = items[next++];
      try {
        await work(item);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  if (failure) throw (failure as { error: unknown }).error;
}
