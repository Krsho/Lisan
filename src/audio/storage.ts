/**
 * Offline recitation audio on the file system. Files are downloaded only when the user asks,
 * into the app's private document directory (`Paths.document/audio/<reciter>/`), and deleted
 * when the user removes them. Each file is downloaded to the cache first and moved into place
 * only once complete, so the directory never holds a partial file.
 */
import { Directory, File, Paths } from 'expo-file-system';

import {
  ayahFileName,
  ayahsToDownload,
  filesOfSurah,
  runWithLimit,
  surahDownloadState,
  type SurahDownloadState,
} from './downloads';
import type { AudioSource, AyahRef, Reciter } from './source';

const PARALLEL_DOWNLOADS = 4;

const reciterDirectory = (reciter: Reciter) => new Directory(Paths.document, 'audio', reciter.id);

function downloadedFileNames(reciter: Reciter): string[] {
  const dir = reciterDirectory(reciter);
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry) => entry instanceof File)
    .map((file) => file.name);
}

/** A playable `file://` URI if the ayah has been downloaded. */
export function localAyahUri(reciter: Reciter, ref: AyahRef): string | null {
  const file = new File(reciterDirectory(reciter), ayahFileName(ref));
  return file.exists ? file.uri : null;
}

/** The downloaded file if there is one, otherwise the stream URL. */
export const ayahAudioUri = (source: AudioSource, ref: AyahRef) =>
  localAyahUri(source.reciter, ref) ?? source.ayahUrl(ref);

export const getSurahDownloadState = (
  reciter: Reciter,
  surah: number,
  ayahCount: number,
): SurahDownloadState => surahDownloadState(surah, ayahCount, downloadedFileNames(reciter));

/**
 * Downloads the surah's missing ayahs (resuming an earlier, interrupted download). Rejects on
 * the first failure or when `signal` aborts; the ayahs finished by then stay downloaded.
 */
export async function downloadSurah(
  source: AudioSource,
  surah: number,
  ayahCount: number,
  {
    onProgress,
    signal,
  }: { onProgress?: (state: SurahDownloadState) => void; signal?: AbortSignal },
): Promise<void> {
  const dir = reciterDirectory(source.reciter);
  dir.create({ intermediates: true, idempotent: true });
  const missing = ayahsToDownload(surah, ayahCount, downloadedFileNames(source.reciter));
  let downloaded = ayahCount - missing.length;

  await runWithLimit(missing, PARALLEL_DOWNLOADS, async (ayah) => {
    if (signal?.aborted) throw new Error('Download cancelled');
    const ref = { surah, ayah };
    const name = ayahFileName(ref);
    const partial = new File(Paths.cache, `audio-${source.reciter.id}-${name}`);
    try {
      await File.downloadFileAsync(source.ayahUrl(ref), partial, { idempotent: true, signal });
      // The user may have removed the download meanwhile: don't put the file back.
      if (signal?.aborted) throw new Error('Download cancelled');
      await partial.move(new File(dir, name), { overwrite: true });
    } catch (error) {
      if (partial.exists) partial.delete();
      throw error;
    }
    downloaded++;
    onProgress?.({ downloaded, total: ayahCount, complete: downloaded === ayahCount });
  });
}

/** Deletes the surah's downloaded audio. */
export function removeSurahDownload(reciter: Reciter, surah: number): void {
  const dir = reciterDirectory(reciter);
  for (const name of filesOfSurah(surah, downloadedFileNames(reciter))) {
    new File(dir, name).delete();
  }
}
