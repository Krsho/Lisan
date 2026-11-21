import { useAsync, type AsyncState } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import type { Content } from '../engine';

/**
 * The curated path with the lemmas of its words and the parts of its long ayahs, as the engine
 * plans with it.
 */
export function usePath(): AsyncState<Content> {
  const repository = useContent();
  return useAsync(
    async () => {
      const [path, parts] = await Promise.all([repository.getPath(), repository.getPathParts()]);
      const partsByAyah = new Map<string, { fromWord: number; toWord: number }[]>();
      for (const { surah, ayah, first, last } of parts) {
        const key = `${surah}:${ayah}`;
        const part = { fromWord: first.word, toWord: last.word };
        const list = partsByAyah.get(key);
        if (list) list.push(part);
        else partsByAyah.set(key, [part]);
      }
      return {
        path: path.map((a) => {
          const ayahParts = partsByAyah.get(`${a.surah}:${a.ayah}`);
          return ayahParts ? { ...a, parts: ayahParts } : a;
        }),
      };
    },
    [repository],
    'the curated path',
  );
}
