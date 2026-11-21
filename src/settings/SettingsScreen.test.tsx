import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsProvider } from './SettingsContext';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_READING_SETTINGS } from './settings';

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
