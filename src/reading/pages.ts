import type { Ayah, AyahPart, SurahSummary } from '../content/repository';
import type { Passage } from '../engine';
import { describePosition, type Place } from './position';
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
 * When an ayah's part 1 isn't studied today, its translation and tafsir move to the first part
 * that is.
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
    const pages = studyPages([whole], ayahParts).flatMap((page) => {
      const words = page.words.filter((w) => w.position >= fromWord && w.position <= toWord);
      return words.length > 0 ? [{ ...page, key: `${surah}:${page.key}`, words }] : [];
    });
    const firstShown = pages[0]?.part?.number ?? 1;
    return firstShown === 1
      ? pages
      : pages.map((page) => ({ ...page, translationPart: firstShown }));
  });
}

/**
 * The index of the page holding the translation and tafsir of page `index`'s ayah, if that is
 * another page: a later part links back to it.
 */
export function translationPageOf(pages: readonly StudyPage[], index: number): number | undefined {
  const { surah, ayah, part, translationPart = 1 } = pages[index];
  if (!part || part.number === translationPart) return undefined;
  const found = pages.findIndex(
    (p) => p.surah === surah && p.ayah === ayah && p.part?.number === translationPart,
  );
  return found >= 0 ? found : undefined;
}

/**
 * What heads a session screen: how far through the session's screens it is ("New today · 2 of 3",
 * counting each part of a long ayah), and where it is in its surah. `surahs` are null until the
 * surah names load.
 */
export function sessionHeading(
  label: string,
  pages: readonly StudyPage[],
  index: number,
  surahs: readonly SurahSummary[] | null,
): { progress: string; reference: string } {
  const { surah, ayah, part } = pages[index];
  const summary = surahs?.find((s) => s.surah === surah);
  return {
    progress: `${label} · ${index + 1} of ${pages.length}`,
    reference: describePosition(
      summary?.nameEnglish ?? `Surah ${surah}`,
      ayah,
      summary?.ayahCount,
      part,
    ),
  };
}

/** The place a page shows, as remembered between visits: its ayah and, for a long ayah, its part. */
export const placeOf = (page: StudyPage): Place =>
  page.part ? { ayah: page.ayah, part: page.part.number } : { ayah: page.ayah };
