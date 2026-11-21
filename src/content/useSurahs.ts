import { useAsync, type AsyncState } from '../async/useAsync';
import { useContent } from './ContentProvider';
import type { SurahSummary } from './repository';

/** The list of all surahs from the content database. */
export function useSurahs(): AsyncState<SurahSummary[]> {
  const content = useContent();
  return useAsync(() => content.listSurahs(), [content], 'the surah list');
}
