import type { LogEvent } from './events';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The moment to plan for, with the learner's UTC offset there, which sets where a day begins. */
export type Now = { time: number; utcOffsetMinutes: number };

/** When an event decided at `now` happened, as the event records it. */
export const stamp = (now: Now) => ({
  timestamp: now.time,
  utcOffsetMinutes: now.utcOffsetMinutes,
});

/** The local day number, counted from the epoch, of a moment at the given UTC offset. */
export const localDay = (time: number, utcOffsetMinutes: number) =>
  Math.floor((time + utcOffsetMinutes * 60_000) / DAY_MS);

/**
 * The local day an event happened on, where it happened: by the UTC offset it was recorded with,
 * so days stay right after travelling. Events recorded before offsets were stored fall back to
 * `fallbackOffset` (the learner's current one).
 */
export const eventDay = (event: LogEvent, fallbackOffset: number) =>
  localDay(event.timestamp, event.utcOffsetMinutes ?? fallbackOffset);
