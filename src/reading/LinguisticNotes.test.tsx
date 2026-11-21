import { render, screen } from '@testing-library/react-native';

import { LinguisticNotes } from './LinguisticNotes';

const words = [
  { position: 1, text: 'ٱلۡحَمۡدُ', bare: 'ٱلۡحَمۡدُ', gloss: 'All praises' },
  { position: 2, text: 'لِلَّهِ', bare: 'لِلَّهِ', gloss: 'to Allah' },
];

it('labels the notes as linguistic notes, naming the word a note is about', async () => {
  await render(
    <LinguisticNotes
      words={words}
      notes={[
        { ayah: 2, word: null, text: 'A nominal sentence.' },
        { ayah: 2, word: 2, text: 'لِ is a preposition.' },
      ]}
    />,
  );

  expect(screen.getByText('Linguistic note')).toBeTruthy();
  expect(screen.getByText('A nominal sentence.')).toBeTruthy();
  expect(screen.getByText('لِلَّهِ')).toBeTruthy();
  expect(screen.getByText('لِ is a preposition.')).toBeTruthy();
});

it('shows nothing for an ayah without notes', async () => {
  await render(<LinguisticNotes words={words} notes={[]} />);

  expect(screen.queryByText('Linguistic note')).toBeNull();
});
