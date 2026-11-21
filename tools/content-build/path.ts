/**
 * The curated path's surahs in study order: Al-Fatiha, then Juz' 'Amma (An-Naba' to An-Nas) in
 * reverse mushaf order, starting at An-Nas, so learners first understand what they pray.
 */
export const PATH_SURAHS: readonly number[] = [
  1,
  ...Array.from({ length: 114 - 78 + 1 }, (_, i) => 114 - i),
];

/** Orders the given ayahs along the path; ayahs of surahs off the path are left out. */
export function pathOrder<A extends { surah: number; ayah: number }>(ayahs: A[]): A[] {
  const rank = new Map(PATH_SURAHS.map((surah, i) => [surah, i]));
  return ayahs
    .filter((a) => rank.has(a.surah))
    .sort((a, b) => rank.get(a.surah)! - rank.get(b.surah)! || a.ayah - b.ayah);
}
