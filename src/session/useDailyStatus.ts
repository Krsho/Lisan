import { useMemo } from 'react';

import { useNow } from '../clock/clock';
import { planSession, progress, streak, type Content } from '../engine';
import { useSettings } from '../settings/SettingsContext';
import { useEventLog } from '../user/UserStoreProvider';

/**
 * Where the learner stands today: the session planned for now, how many words they have learned
 * in all, and their streak. Recomputed as the log changes and when the day does.
 */
export function useDailyStatus(content: Content) {
  const { events } = useEventLog();
  const { pace } = useSettings();
  const now = useNow();
  const plan = useMemo(
    () => planSession(content, events, { pace }, now),
    [content, events, pace, now],
  );
  const wordsLearned = useMemo(() => progress(content, events).wordsLearned, [content, events]);
  const days = useMemo(() => streak(events, now), [events, now]);
  return { plan, wordsLearned, streak: days };
}
