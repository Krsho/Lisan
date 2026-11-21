import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsProvider } from './SettingsContext';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_READING_SETTINGS } from './settings';

// The Quran font is kept out of git (see src/theme/quranFont.ts), so CI has no file to load.
jest.mock('../../assets/fonts/UthmanicHafs-v9.otf', () => 1, { virtual: true });

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
