import { DEFAULT_READING_SETTINGS } from '../settings/settings';
import {
  formatReminderTime,
  reminderAction,
  shouldOfferReminder,
  stepReminderTime,
} from './reminder';

const settings = DEFAULT_READING_SETTINGS;

describe('offering the reminder', () => {
  it('is offered when a session is completed and it has not been offered before', () => {
    expect(shouldOfferReminder(settings)).toBe(true);
  });

  it('is offered only once, whatever the answer was', () => {
    expect(shouldOfferReminder({ ...settings, reminderOffered: true })).toBe(false);
  });

  it('is not offered to a learner who already turned it on in settings', () => {
    expect(shouldOfferReminder({ ...settings, reminderEnabled: true })).toBe(false);
  });
});

describe('what to schedule', () => {
  it('schedules nothing by default', () => {
    expect(reminderAction(settings)).toEqual({ kind: 'cancel' });
  });

  it('schedules a daily reminder at the chosen time when it is on', () => {
    expect(
      reminderAction({ ...settings, reminderEnabled: true, reminderTime: 7 * 60 + 30 }),
    ).toEqual({ kind: 'daily', hour: 7, minute: 30 });
  });

  it('cancels the reminder when it is turned off, keeping the chosen time', () => {
    expect(reminderAction({ ...settings, reminderEnabled: false, reminderTime: 6 * 60 })).toEqual({
      kind: 'cancel',
    });
  });
});

describe('reminder time', () => {
  it('moves in quarter hours', () => {
    expect(stepReminderTime(20 * 60, 1)).toBe(20 * 60 + 15);
    expect(stepReminderTime(20 * 60, -1)).toBe(19 * 60 + 45);
  });

  it('wraps around midnight', () => {
    expect(stepReminderTime(23 * 60 + 45, 1)).toBe(0);
    expect(stepReminderTime(0, -1)).toBe(23 * 60 + 45);
  });

  it('moves a time between quarter hours to the neighbouring quarter hour', () => {
    expect(stepReminderTime(20 * 60 + 7, 1)).toBe(20 * 60 + 15);
    expect(stepReminderTime(20 * 60 + 7, -1)).toBe(20 * 60);
  });

  it('is shown on a 24-hour clock', () => {
    expect(formatReminderTime(20 * 60)).toBe('20:00');
    expect(formatReminderTime(7 * 60 + 5)).toBe('07:05');
  });
});
