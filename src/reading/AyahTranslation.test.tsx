import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SettingsProvider } from '../settings/SettingsContext';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../settings/settings';
import { AyahTranslation } from './AyahTranslation';

const ayah = {
  ayah: 4,
  translation: 'Master[5] of the Day of Judgment.',
  footnotes: '[5] Other meanings for "Mālik": Sovereign, Owner, etc.',
  tafsir: '4. He is the Master of the day of Judgement.',
};

const withSettings = (patch: Partial<AppSettings>) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SettingsProvider value={{ settings: { ...DEFAULT_APP_SETTINGS, ...patch }, update() {} }}>
        {children}
      </SettingsProvider>
    );
  };

it('shows the translation and its footnotes, with the tafsir collapsed until opened', async () => {
  await render(<AyahTranslation data={ayah} />);

  expect(screen.getByText('Master[5] of the Day of Judgment.')).toBeTruthy();
  expect(screen.getByText('[5] Other meanings for "Mālik": Sovereign, Owner, etc.')).toBeTruthy();
  expect(screen.queryByText(ayah.tafsir)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Show tafsir' }));

  expect(screen.getByText('4. He is the Master of the day of Judgement.')).toBeTruthy();
});

it('hides the translation and shows the tafsir when the settings say so', async () => {
  await render(<AyahTranslation data={ayah} />, {
    wrapper: withSettings({ showTranslation: false, showTafsir: true }),
  });

  expect(screen.queryByText(ayah.translation)).toBeNull();
  expect(screen.queryByText(ayah.footnotes)).toBeNull();
  expect(screen.getByText(ayah.tafsir)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Show translation' }));

  expect(screen.getByText(ayah.translation)).toBeTruthy();
  expect(screen.getByText(ayah.footnotes)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Hide translation' }));

  expect(screen.queryByText(ayah.translation)).toBeNull();
});
