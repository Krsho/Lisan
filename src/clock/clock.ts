import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Now } from '../engine';

/** The current moment on the device's clock and in its time zone, for the engine. */
export function currentNow(): Now {
  const date = new Date();
  return { time: date.getTime(), utcOffsetMinutes: -date.getTimezoneOffset() };
}

/**
 * The current moment, taken again at local midnight and whenever the app comes back to the
 * foreground (perhaps on another day, or in another time zone). What is derived from it, such as
 * today's plan and the streak, recomputes then, so a screen left open overnight is not a day
 * behind.
 */
export function useNow(): Now {
  const [now, setNow] = useState(currentNow);

  useEffect(() => {
    const refresh = () => setNow(currentNow());
    let timer: ReturnType<typeof setTimeout>;
    // Just after the next local midnight, then again for the day after.
    const schedule = () => {
      const date = new Date();
      const midnight = new Date(date);
      midnight.setHours(24, 0, 1, 0);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, midnight.getTime() - date.getTime());
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
}
