import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AyahPlayback } from '../audio/useRecitation';
import type { Term, WordDetails, WordRef } from '../content/repository';
import { StudyView, type StudyPassage } from './StudyView';

// The KFGQPC font is not committed (see content/README.md), so CI has no file to require.
jest.mock('../theme/quranFont', () => ({
  QURAN_FONT_FAMILY: 'quran',
  useQuranTextSize: () => ({
    text: (fontSize: number, lineHeight: number) => ({ fontSize, lineHeight }),
    width: (width: number) => width,
  }),
}));

const term = (key: string, arabic: string, name: string, definition: string): Term => ({
  key,
  arabic,
  name,
  definition,
});
const mockTerms: Record<string, Term> = {
  'concept.root': term('concept.root', 'جذر', 'root', 'The letters a word is built from.'),
  'concept.lemma': term('concept.lemma', 'أصل', 'lemma', 'The dictionary form.'),
};
const genitive = term('case.genitive', 'مجرور', 'genitive', 'The case after a preposition.');

const mockDetails: Record<number, WordDetails> = {
  1: {
    ref: { surah: 1, ayah: 2, word: 1 },
    position: 1,
    text: 'ٱلۡحَمۡدُ',
    bare: 'ٱلۡحَمۡدُ',
    gloss: 'All praises',
    segments: [
      { position: 1, text: 'ٱلۡ', lemma: null, lemmaFrequency: null, root: null, terms: [] },
      {
        position: 2,
        text: 'حَمۡدُ',
        lemma: 'حَمْد',
        lemmaFrequency: 43,
        root: 'حمد',
        terms: [],
      },
    ],
  },
  2: {
    ref: { surah: 1, ayah: 2, word: 2 },
    position: 2,
    text: 'لِلَّهِ',
    bare: 'لِلَّهِ',
    gloss: 'to Allah',
    segments: [
      { position: 1, text: 'لِ', lemma: 'لِ', lemmaFrequency: 1, root: null, terms: [] },
      { position: 2, text: 'لَّهِ', lemma: 'اللَّه', lemmaFrequency: 2, root: 'اله', terms: [genitive] },
    ],
  },
};

// One repository for the whole test, as the app's is memoized: a new one would reload the words.
jest.mock('../content/ContentProvider', () => {
  const content = {
    getWordDetails: async (ref: WordRef) => mockDetails[ref.word],
    getTerm: async (key: string) => mockTerms[key],
  };
  return { useContent: () => content };
});

const playback: AyahPlayback = {
  isCurrent: () => false,
  playing: false,
  buffering: false,
  error: null,
  toggle: jest.fn(),
  stop: jest.fn(),
};

const words = [mockDetails[1], mockDetails[2]].map(({ position, text, bare, gloss }) => ({
  position,
  text,
  bare,
  gloss,
}));
const whole: StudyPassage = { surah: 1, ayah: 2, words };
const translation = {
  ayah: 2,
  translation: 'All praise is for Allah.',
  footnotes: null,
  tafsir: '2. Praise belongs to Allah alone.',
};

it('shows the ayah, play, translation, a card per word, the note and the folded tafsir', async () => {
  await render(
    <StudyView
      passage={whole}
      translation={translation}
      notes={[{ ayah: 2, word: 2, text: 'لِ is a preposition.' }]}
      playback={playback}
    />,
  );

  expect(await screen.findByLabelText('Word 1: All praises')).toBeTruthy();
  expect(screen.getByLabelText('Word 2: to Allah')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Play the recitation of ayah 2' })).toBeTruthy();
  expect(screen.getByText('All praise is for Allah.')).toBeTruthy();
  expect(screen.getByText('لِ is a preposition.')).toBeTruthy();
  expect(screen.queryByText(translation.tafsir)).toBeNull();
  expect(screen.getByRole('button', { name: 'Show tafsir' })).toBeTruthy();
});

it('opens a grammar label to show its definition', async () => {
  await render(
    <StudyView passage={whole} translation={translation} notes={[]} playback={playback} />,
  );

  await fireEvent.press(await screen.findByRole('button', { name: /genitive/ }));

  expect(screen.getByText('The case after a preposition.')).toBeTruthy();
});

it("highlights a word's card when the word is tapped in the ayah", async () => {
  await render(
    <StudyView passage={whole} translation={translation} notes={[]} playback={playback} />,
  );
  const card = await screen.findByLabelText('Word 2: to Allah');
  expect(card.props.accessibilityState).toEqual({ selected: false });

  // The ayah comes first, then the word's own card.
  const [inAyah] = screen.getAllByText('لِلَّهِ');
  await fireEvent.press(inAyah);

  expect(screen.getByLabelText('Word 2: to Allah').props.accessibilityState).toEqual({
    selected: true,
  });
});

it('links a later part back to part 1 for the translation and tafsir', async () => {
  const openFirstPart = jest.fn();
  await render(
    <StudyView
      passage={{ ...whole, words: [words[1]], part: { number: 2, count: 2 } }}
      translation={translation}
      notes={[]}
      playback={playback}
      onOpenTranslationPart={openFirstPart}
    />,
  );

  expect(screen.queryByText(translation.translation)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show tafsir' })).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: 'Translation and tafsir: part 1' }));
  expect(openFirstPart).toHaveBeenCalled();
});

it('shows the translation and tafsir on a later part that holds them', async () => {
  await render(
    <StudyView
      passage={{ ...whole, words: [words[1]], part: { number: 2, count: 2 }, translationPart: 2 }}
      translation={translation}
      notes={[]}
      playback={playback}
    />,
  );

  expect(screen.getByText(translation.translation)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Show tafsir' })).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});

it('shows only the ayah, audio and translation when compact, the tafsir with the breakdown', async () => {
  await render(
    <StudyView
      passage={whole}
      translation={translation}
      notes={[]}
      playback={playback}
      showWordCards={false}
    />,
  );

  expect(screen.getByRole('button', { name: 'Play the recitation of ayah 2' })).toBeTruthy();
  expect(screen.getByText('All praise is for Allah.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Show tafsir' })).toBeNull();
});

it('can show the ayah without word cards', async () => {
  await render(
    <StudyView
      passage={whole}
      translation={translation}
      notes={[]}
      playback={playback}
      showWordCards={false}
    />,
  );

  expect(screen.getByText('All praise is for Allah.')).toBeTruthy();
  expect(screen.queryByLabelText('Word 1: All praises')).toBeNull();
});
