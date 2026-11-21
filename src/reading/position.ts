/** Where a study screen is in its surah, for the header: "Al-Baqarah · 5 / 286 · part 2 of 5". */
export function describePosition(
  surahName: string,
  ayah: number,
  ayahCount: number,
  part?: { number: number; count: number },
): string {
  const position = `${surahName} · ${ayah} / ${ayahCount}`;
  return part ? `${position} · part ${part.number} of ${part.count}` : position;
}

/** A place in a surah's pages: an ayah, or one part (1-based) of a long ayah. */
export type Place = { ayah: number; part?: number };

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
