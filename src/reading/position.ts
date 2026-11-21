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
