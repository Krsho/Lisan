import { useEffect, useState } from 'react';

import { useContent } from '../content/ContentProvider';
import type { Content, Now } from '../engine';

/** The current moment on the device's clock and in its time zone, for the engine. */
export function currentNow(): Now {
  const date = new Date();
  return { time: date.getTime(), utcOffsetMinutes: -date.getTimezoneOffset() };
}

export type PathState =
  { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; content: Content };

/** The curated path with the lemmas of its words, as the engine plans with it. */
export function usePath(): PathState {
  const repository = useContent();
  const [state, setState] = useState<PathState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.getPath().then(
      (path) => {
        if (!cancelled) setState({ status: 'loaded', content: { path } });
      },
      (error: unknown) => {
        console.error('Failed to load the curated path', error);
        if (!cancelled) setState({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  return state;
}
