import { useEffect } from 'react';

import { useSettings } from '../settings/SettingsContext';
import { applyReminder, configureReminderDisplay } from './notifications';
import { reminderAction } from './reminder';

/**
 * Keeps the phone's scheduled reminder in step with the settings: schedules it when it is turned
 * on, reschedules when the time changes, cancels it when it is turned off. It also runs at app
 * start, which restores the reminder if the phone lost it (a reinstall, a restored backup).
 */
export function ReminderScheduler() {
  const settings = useSettings();
  const action = reminderAction(settings);
  const hour = action.kind === 'daily' ? action.hour : null;
  const minute = action.kind === 'daily' ? action.minute : null;

  useEffect(() => {
    configureReminderDisplay();
  }, []);

  useEffect(() => {
    applyReminder(
      hour === null || minute === null ? { kind: 'cancel' } : { kind: 'daily', hour, minute },
    ).catch((error: unknown) => console.error('Failed to schedule the daily reminder', error));
  }, [hour, minute]);

  return null;
}
