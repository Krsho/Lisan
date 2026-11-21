/**
 * The daily reminder's rules: when it is offered, what should be scheduled for the settings, and
 * how its time is chosen. Pure, so they are tested without the notifications library; the thin
 * adapter in ./notifications.ts carries out what these decide.
 */

import { MINUTES_PER_DAY, type ReadingSettings } from '../settings/settings';

type ReminderSettings = Pick<
  ReadingSettings,
  'reminderEnabled' | 'reminderTime' | 'reminderOffered'
>;

/** What the phone should have scheduled: one daily reminder at a local time, or none. */
export type ReminderAction = { kind: 'daily'; hour: number; minute: number } | { kind: 'cancel' };

/** Whether to offer the reminder on a completed session's summary: once, and not if it is on. */
export function shouldOfferReminder(settings: ReminderSettings): boolean {
  return !settings.reminderOffered && !settings.reminderEnabled;
}

/** The notification to schedule (or cancel) for the settings. */
export function reminderAction(settings: ReminderSettings): ReminderAction {
  if (!settings.reminderEnabled) return { kind: 'cancel' };
  return {
    kind: 'daily',
    hour: Math.floor(settings.reminderTime / 60),
    minute: settings.reminderTime % 60,
  };
}

/** The step the time picker moves by, in minutes. */
export const REMINDER_TIME_STEP = 15;

/** The next quarter hour later (+1) or earlier (-1), wrapping around midnight. */
export function stepReminderTime(time: number, direction: 1 | -1): number {
  const step = REMINDER_TIME_STEP;
  const next =
    direction > 0 ? Math.floor(time / step) * step + step : Math.ceil(time / step) * step - step;
  return (next + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** The time as the learner sees it, e.g. "07:30". */
export function formatReminderTime(time: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(time / 60))}:${pad(time % 60)}`;
}
