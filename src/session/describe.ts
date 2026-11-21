import type { SurahSummary } from '../content/repository';
import type { Passage } from '../engine';

/**
 * Names the new material for people, e.g. "Al-Fātiḥah 1–4" or "Al-Baqarah 282 (words 16–30)",
 * joining consecutive whole ayahs of one surah into a range.
 */
export function describePassages(passages: Passage[], surahs: SurahSummary[]): string {
  const names = new Map(surahs.map((s) => [s.surah, s.nameEnglish]));
  const groups: { surah: number; first: Passage; last: Passage }[] = [];
  for (const p of passages) {
    const group = groups[groups.length - 1];
    const joins =
      group &&
      group.surah === p.surah &&
      group.last.ayah === p.ayah - 1 &&
      !partOfAyah(group.last) &&
      !partOfAyah(p);
    if (joins) group.last = p;
    else groups.push({ surah: p.surah, first: p, last: p });
  }
  return groups
    .map(({ surah, first, last }) => {
      const name = names.get(surah) ?? `Surah ${surah}`;
      if (first === last) return `${name} ${first.ayah}${partOfAyah(first)}`;
      return `${name} ${first.ayah}–${last.ayah}`;
    })
    .join(', ');
}

/** A streak said quietly, in days: "3 days". */
export function describeStreak(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** " (words 16–30)" when the passage is only part of its ayah. */
function partOfAyah(p: Passage): string {
  if (p.fromWord === 1 && p.toWord === p.ayahWords) return '';
  return p.fromWord === p.toWord ? ` (word ${p.fromWord})` : ` (words ${p.fromWord}–${p.toWord})`;
}
