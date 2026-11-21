import { useAsync, type AsyncState } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import type { Content } from '../engine';

/** The curated path with the lemmas of its words, as the engine plans with it. */
export function usePath(): AsyncState<Content> {
  const repository = useContent();
  return useAsync(
    async () => ({ path: await repository.getPath() }),
    [repository],
    'the curated path',
  );
}
