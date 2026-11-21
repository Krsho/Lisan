import type { Place } from '../user/store';

export type { Place };

/**
 * Where a study screen is in its surah, for the header: "Al-Baqarah · 5 / 286 · part 2 of 5";
 * without the ayah count when it isn't known.
 */
export function describePosition(
  surahName: string,
  ayah: number,
  ayahCount: number | undefined,
  part?: { number: number; count: number },
): string {
  const position = `${surahName} · ${ayah}${ayahCount === undefined ? '' : ` / ${ayahCount}`}`;
  return part ? `${position} · part ${part.number} of ${part.count}` : position;
}

/**
 * The page showing a place: that part of the ayah; the ayah's first page if it is no longer in
 * that part (its parts changed, or it is now shown whole); the first page if the ayah is gone.
 */
export function pageIndexOf(pages: readonly Place[], place: Place): number {
  const exact = pages.findIndex(
    (p) => p.ayah === place.ayah && (p.part ?? 1) === (place.part ?? 1),
  );
  if (exact >= 0) return exact;
  return Math.max(
    0,
    pages.findIndex((p) => p.ayah === place.ayah),
  );
}
