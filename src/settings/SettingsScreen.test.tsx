import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsProvider } from './SettingsContext';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_READING_SETTINGS } from './settings';

// The Quran font is kept out of git (see src/theme/quranFont.ts), so CI has no file to load.
jest.mock('../../assets/fonts/UthmanicHafs-v9.otf', () => 1, { virtual: true });
jest.mock('expo-notifications', () => jest.requireActual('../testing/expoNotificationsMock'));

const notifications =
  jest.requireMock<typeof import('../testing/expoNotificationsMock')>('expo-notifications');

beforeEach(() => jest.clearAllMocks());

describe('daily reminder', () => {
  const renderSettings = async (settings = DEFAULT_READING_SETTINGS) => {
    const update = jest.fn();
    await render(
      <SettingsProvider value={{ settings, update }}>
        <SettingsScreen />
      </SettingsProvider>,
    );
    return update;
  };

  it('is off by default, at 20:00', async () => {
    await renderSettings();

    expect(screen.getByLabelText('Daily reminder').props.value).toBe(false);
    expect(screen.getByLabelText('Reminder time 20:00')).toBeTruthy();
  });

  it('turns on once notifications are allowed', async () => {
    const update = await renderSettings();

    await fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true);

    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      reminderEnabled: true,
      reminderTime: 20 * 60,
      reminderOffered: true,
    });
  });

  it('stays off and says why when notifications are not allowed', async () => {
    notifications.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    const update = await renderSettings();

    await fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true);

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(/Notifications are off for Lisan/)).toBeTruthy();
  });

  it('changes the time and turns off', async () => {
    const update = await renderSettings({
      ...DEFAULT_READING_SETTINGS,
      reminderEnabled: true,
      reminderTime: 7 * 60,
    });

    expect(screen.getByText('A notification every day at 07:00.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Later reminder' }));
    await fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', false);

    expect(update.mock.calls).toEqual([
      [{ reminderTime: 7 * 60 + 15 }],
      [{ reminderEnabled: false }],
    ]);
  });
});

it('changes the theme, font size and default visibility', async () => {
  const update = jest.fn();
  await render(
    <SettingsProvider value={{ settings: DEFAULT_READING_SETTINGS, update }}>
      <SettingsScreen />
    </SettingsProvider>,
  );

  expect(screen.getByRole('radio', { name: 'System' }).props.accessibilityState).toMatchObject({
    selected: true,
  });

  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Larger Arabic text' }));
  await fireEvent(screen.getByLabelText('Tafsir'), 'valueChange', true);

  expect(update.mock.calls).toEqual([
    [{ theme: 'dark' }],
    [{ arabicFontScale: 1.15 }],
    [{ showTafsir: true }],
  ]);
});

it('changes the daily pace', async () => {
  const update = jest.fn();
  await render(
    <SettingsProvider value={{ settings: DEFAULT_READING_SETTINGS, update }}>
      <SettingsScreen />
    </SettingsProvider>,
  );

  expect(screen.getByRole('radio', { name: 'Normal pace' }).props.accessibilityState).toMatchObject(
    { selected: true },
  );
  expect(screen.getByText('15 new words a session, from the next one.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'Intense pace' }));

  expect(update).toHaveBeenCalledWith({ pace: 'intense' });
});
