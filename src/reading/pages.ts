import type { Ayah, AyahPart } from '../content/repository';
import type { Passage } from '../engine';
import type { Place } from './position';
import type { StudyPassage } from './StudyView';

/** One study screen: a whole ayah, or one part of a long one. */
export type StudyPage = StudyPassage & { key: string };

/**
 * A surah's ayahs as study screens, one per ayah or, for a long ayah, one per part, in reading
 * order. `parts` are the surah's ayah parts (getSurahParts); ayahs without any are shown whole.
 */
export function studyPages(ayahs: Ayah[], parts: AyahPart[]): StudyPage[] {
  const partsByAyah = new Map<number, AyahPart[]>();
  for (const part of parts) {
    const list = partsByAyah.get(part.ayah);
    if (list) list.push(part);
    else partsByAyah.set(part.ayah, [part]);
  }
  return ayahs.flatMap(({ surah, ayah, words }): StudyPage[] => {
    const ayahParts = partsByAyah.get(ayah);
    if (!ayahParts) return [{ key: String(ayah), surah, ayah, words }];
    return ayahParts.map(({ part, count, first, last }) => ({
      key: `${ayah}.${part}`,
      surah,
      ayah,
      words: words.filter((w) => w.position >= first.word && w.position <= last.word),
      part: { number: part, count },
    }));
  });
}

/**
 * A session's passages as study screens, as Browse shows them: one per ayah or part, keeping only
 * the words studied today. `ayahs` are by "surah:ayah"; `parts` are the path's (getPathParts).
 */
export function sessionPages(
  passages: Passage[],
  ayahs: Map<string, Ayah>,
  parts: AyahPart[],
): StudyPage[] {
  return passages.flatMap(({ surah, ayah, fromWord, toWord }) => {
    const whole = ayahs.get(`${surah}:${ayah}`);
    if (!whole) return [];
    const ayahParts = parts.filter((p) => p.surah === surah && p.ayah === ayah);
    return studyPages([whole], ayahParts).flatMap((page) => {
      const words = page.words.filter((w) => w.position >= fromWord && w.position <= toWord);
      return words.length > 0 ? [{ ...page, key: `${surah}:${page.key}`, words }] : [];
    });
  });
}

/** The place a page shows, as remembered between visits: its ayah and, for a long ayah, its part. */
export const placeOf = (page: StudyPage): Place =>
  page.part ? { ayah: page.ayah, part: page.part.number } : { ayah: page.ayah };
