import type { AyahPart } from './repository';

/** The key of an ayah in maps across surahs: "2:255". */
export const ayahKey = (surah: number, ayah: number): string => `${surah}:${ayah}`;

/** Ayah parts grouped by their ayah ("surah:ayah", see ayahKey), each ayah's in the order given. */
export function partsByAyah(parts: readonly AyahPart[]): Map<string, AyahPart[]> {
  const byAyah = new Map<string, AyahPart[]>();
  for (const part of parts) {
    const key = ayahKey(part.surah, part.ayah);
    const list = byAyah.get(key);
    if (list) list.push(part);
    else byAyah.set(key, [part]);
  }
  return byAyah;
}
