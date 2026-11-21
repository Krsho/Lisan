import type { Ayah, AyahPart } from '../content/repository';
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
