import { render, waitFor } from '@testing-library/react-native';

import { SettingsProvider } from '../settings/SettingsContext';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../settings/settings';
import { ReminderScheduler } from './ReminderScheduler';

jest.mock('expo-notifications', () => jest.requireActual('../testing/expoNotificationsMock'));

const notifications =
  jest.requireMock<typeof import('../testing/expoNotificationsMock')>('expo-notifications');

beforeEach(() => jest.clearAllMocks());

const app = (settings: AppSettings) => (
  <SettingsProvider value={{ settings, update: jest.fn() }}>
    <ReminderScheduler />
  </SettingsProvider>
);

const on = { ...DEFAULT_APP_SETTINGS, reminderEnabled: true, reminderTime: 7 * 60 + 30 };

it('schedules nothing while the reminder is off', async () => {
  await render(app(DEFAULT_APP_SETTINGS));

  await waitFor(() =>
    expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled(),
  );
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('schedules a daily reminder at the chosen time, then reschedules and cancels it', async () => {
  const view = await render(app(on));
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
  expect(notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({
      trigger: expect.objectContaining({ type: 'daily', hour: 7, minute: 30 }),
    }),
  );

  await view.rerender(app({ ...on, reminderTime: 21 * 60 }));
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2));
  expect(notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({
      trigger: expect.objectContaining({ type: 'daily', hour: 21, minute: 0 }),
    }),
  );

  await view.rerender(app({ ...on, reminderEnabled: false }));
  await waitFor(() =>
    expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(3),
  );
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

it('does not reschedule when an unrelated setting changes', async () => {
  const view = await render(app(on));
  await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));

  await view.rerender(app({ ...on, theme: 'dark' }));

  expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
});
