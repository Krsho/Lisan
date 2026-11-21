import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsProvider } from '../settings/SettingsContext';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../settings/settings';
import { ReminderOffer } from './ReminderOffer';

jest.mock('expo-notifications', () => jest.requireActual('../testing/expoNotificationsMock'));

const notifications =
  jest.requireMock<typeof import('../testing/expoNotificationsMock')>('expo-notifications');

beforeEach(() => jest.clearAllMocks());

async function renderOffer(settings: AppSettings = DEFAULT_APP_SETTINGS) {
  const update = jest.fn();
  await render(
    <SettingsProvider value={{ settings, update }}>
      <ReminderOffer />
    </SettingsProvider>,
  );
  return update;
}

it('is offered after the first completed session, and counts as offered once shown', async () => {
  const update = await renderOffer();

  expect(screen.getByText('A daily reminder?')).toBeTruthy();
  expect(update).toHaveBeenCalledWith({ reminderOffered: true });
});

it('turns the reminder on at the chosen time', async () => {
  const update = await renderOffer();

  await fireEvent.press(screen.getByRole('button', { name: 'Earlier reminder' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remind me at 19:45' }));

  expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
  expect(update).toHaveBeenLastCalledWith({
    reminderEnabled: true,
    reminderTime: 19 * 60 + 45,
    reminderOffered: true,
  });
  expect(screen.getByText(/reminded every day at 19:45/)).toBeTruthy();
});

it('leaves the reminder off when declined', async () => {
  const update = await renderOffer();

  await fireEvent.press(screen.getByRole('button', { name: 'No thanks' }));

  expect(update.mock.calls).toEqual([[{ reminderOffered: true }]]);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(screen.getByText(/You can turn it on in Settings/)).toBeTruthy();
});

it('is not offered again', async () => {
  const update = await renderOffer({ ...DEFAULT_APP_SETTINGS, reminderOffered: true });

  expect(screen.queryByText('A daily reminder?')).toBeNull();
  expect(update).not.toHaveBeenCalled();
});
