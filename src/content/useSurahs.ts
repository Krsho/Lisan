import { useEffect, useState } from 'react';

import { useContent } from './ContentProvider';
import type { SurahSummary } from './repository';

export type SurahsState =
  { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; surahs: SurahSummary[] };

/** The list of all surahs from the content database. */
export function useSurahs(): SurahsState {
  const content = useContent();
  const [state, setState] = useState<SurahsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    content.listSurahs().then(
      (surahs) => {
        if (!cancelled) setState({ status: 'loaded', surahs });
      },
      (error: unknown) => {
        console.error('Failed to load the surah list', error);
        if (!cancelled) setState({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content]);

  return state;
}
