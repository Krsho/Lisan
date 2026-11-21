import { useEffect, useState, type DependencyList } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; data: T };

/**
 * Runs `load` when `deps` change and tracks its result: loading (until the first result), failed
 * (logged with `description`) or loaded. A result that arrives after the deps changed or the
 * component unmounted is dropped.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  description: string,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setState({ status: 'loaded', data });
      },
      (error: unknown) => {
        console.error(`Failed to load ${description}`, error);
        if (current) setState({ status: 'failed' });
      },
    );
    return () => {
      current = false;
    };
    // The caller's deps say when to load again, as for useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
