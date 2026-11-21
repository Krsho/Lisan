import { render, screen } from '@testing-library/react-native';

import type { Edition } from '../content/repository';
import { AttributionScreen } from './AttributionScreen';

const editions: Edition[] = [
  {
    kind: 'translation',
    language: 'en',
    key: 'english_rwwad',
    title: 'English Translation - Rowwad Translation Center',
    url: 'https://quranenc.com/en/browse/english_rwwad',
    version: '1.0.21',
    fetchedAt: '2026-11-21',
  },
  {
    kind: 'tafsir',
    language: 'en',
    key: 'english_mokhtasar',
    title: 'Al-Mukhtasar in Interpreting the Noble Quran - English',
    url: 'https://quranenc.com',
    version: null,
    fetchedAt: '2026-11-21',
  },
];

// The content database is the boundary: the screen reads edition versions from it.
const mockContent = { getEditions: async () => editions, getContentVersion: async () => 6 };
jest.mock('../content/ContentProvider', () => ({ useContent: () => mockContent }));

it('credits every source with a link, and each QuranEnc edition with its version', async () => {
  await render(<AttributionScreen />);

  expect(
    await screen.findByText('QuranEnc.com: English Translation - Rowwad Translation Center'),
  ).toBeTruthy();
  expect(screen.getByText('Version 1.0.21. Shown unmodified.')).toBeTruthy();
  expect(
    screen.getByText(
      'QuranEnc publishes no version for this edition; retrieved 2026-11-21. Shown unmodified.',
    ),
  ).toBeTruthy();
  for (const url of [
    'https://corpus.quran.com',
    'https://tanzil.net',
    'https://qurancomplex.gov.sa',
    'https://qul.tarteel.ai',
    'https://quran.foundation',
  ]) {
    expect(screen.getByText(url)).toBeTruthy();
  }
  expect(screen.getByText('Reciter: Mishary Rashid Alafasy')).toBeTruthy();
  expect(screen.getByText('Recitation (Murattal), from Quran Foundation')).toBeTruthy();
});

it('shows the content version, so a mistake report can name it', async () => {
  await render(<AttributionScreen />);
  expect(await screen.findByText('Content version 6')).toBeTruthy();
});
