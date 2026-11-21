/**
 * Where recitation audio comes from. This is the only module that knows the audio URLs, so the
 * source can be switched (for example to the Quran Foundation Content API behind a small
 * backend) without touching playback or downloads.
 */

export type AyahRef = { surah: number; ayah: number };

export type Reciter = {
  /** Stable id, also the name of the reciter's download directory. */
  id: string;
  name: string;
  style: string;
};

export type AudioProvider = { name: string; url: string };

export type AudioSource = {
  reciter: Reciter;
  /** Who serves the audio, credited near the player and on the attribution screen. */
  provider: AudioProvider;
  /** A streamable URL of one ayah's recitation. */
  ayahUrl(ref: AyahRef): string;
};

export const QURAN_FOUNDATION: AudioProvider = {
  name: 'Quran Foundation',
  url: 'https://quran.foundation',
};

const pad3 = (n: number) => String(n).padStart(3, '0');

/** `001001` for 1:1. Both the CDN and the download directory name ayah files this way. */
export function ayahFileStem({ surah, ayah }: AyahRef): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114)
    throw new RangeError(`No such surah: ${surah}`);
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286)
    throw new RangeError(`No such ayah: ${surah}:${ayah}`);
  return `${pad3(surah)}${pad3(ayah)}`;
}

/**
 * Quran Foundation's public per-ayah audio files, e.g.
 * `https://verses.quran.foundation/Alafasy/mp3/001001.mp3`. No credentials are needed. The layout
 * is the one the Content API returns (`audio_files[].url`), but it is not a documented contract.
 */
export function quranFoundationCdn(reciter: Reciter, cdnPath: string): AudioSource {
  return {
    reciter,
    provider: QURAN_FOUNDATION,
    ayahUrl: (ref) => `https://verses.quran.foundation/${cdnPath}/mp3/${ayahFileStem(ref)}.mp3`,
  };
}

/** Quran Foundation recitation 7. */
export const ALAFASY: Reciter = {
  id: 'alafasy',
  name: 'Mishary Rashid Alafasy',
  style: 'Murattal',
};

/** The app's audio source. */
export const audioSource: AudioSource = quranFoundationCdn(ALAFASY, 'Alafasy');
