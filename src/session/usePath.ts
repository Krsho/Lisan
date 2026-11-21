import { useAsync, type AsyncState } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import { ayahKey, partsByAyah } from '../content/parts';
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
      const byAyah = partsByAyah(parts);
      return {
        path: path.map((a) => {
          const ayahParts = byAyah.get(ayahKey(a.surah, a.ayah));
          return ayahParts
            ? {
                ...a,
                parts: ayahParts.map((p) => ({ fromWord: p.first.word, toWord: p.last.word })),
              }
            : a;
        }),
      };
    },
    [repository],
    'the curated path',
  );
}
