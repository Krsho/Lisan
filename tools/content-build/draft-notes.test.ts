import type { WordDetails } from '../../src/content/repository';
import { ayahsToDraft, draftPrompt, mergeDrafts, parseDraft, type DraftInput } from './draft-notes';
import type { AuthoredNote, NotesFile } from './notes';

const term = (key: string, name: string, arabic: string) => ({
  key,
  name,
  arabic,
  definition: `${name}.`,
});

const words: WordDetails[] = [
  {
    ref: { surah: 1, ayah: 2, word: 1 },
    position: 1,
    text: 'ٱلۡحَمۡدُ',
    bare: 'ٱلۡحَمۡدُ',
    gloss: 'All praises and thanks',
    segments: [
      {
        position: 1,
        text: 'ٱلۡ',
        lemma: 'ال',
        lemmaFrequency: 1000,
        root: null,
        terms: [term('pos.determiner', 'determiner', 'ال')],
      },
      {
        position: 2,
        text: 'حَمۡدُ',
        lemma: 'حَمْد',
        lemmaFrequency: 43,
        root: 'حمد',
        terms: [term('pos.noun', 'noun', 'اسم'), term('case.nominative', 'nominative', 'مرفوع')],
      },
    ],
  },
  {
    ref: { surah: 1, ayah: 2, word: 2 },
    position: 2,
    text: 'لِلَّهِ',
    bare: 'لِلَّهِ',
    gloss: '(be) to Allah',
    segments: [
      {
        position: 1,
        text: 'لِ',
        lemma: 'ل',
        lemmaFrequency: 3000,
        root: null,
        terms: [term('pos.preposition', 'preposition', 'حرف جر')],
      },
      {
        position: 2,
        text: 'لَّهِ',
        lemma: 'اللَّه',
        lemmaFrequency: 2699,
        root: 'أله',
        terms: [
          term('pos.proper-noun', 'proper noun', 'علم'),
          term('case.genitive', 'genitive', 'مجرور'),
        ],
      },
    ],
  },
];

const input: DraftInput = {
  surah: 1,
  ayah: 2,
  surahName: 'Al-Fatiha',
  words,
  translation: 'All praise is due to Allah, Lord of the worlds.',
};

const note = (overrides: Partial<AuthoredNote>): AuthoredNote => ({
  ayah: 2,
  word: null,
  text: 'x',
  status: 'draft',
  reviewer: null,
  draftedBy: 'claude-opus-5-5',
  ...overrides,
});

const notesFile = (notes: AuthoredNote[]): NotesFile => ({ language: 'en', surah: 1, notes });

describe('drafting prompt', () => {
  it('grounds the note in the morphology of every word', () => {
    const { user } = draftPrompt(input, 'en');

    expect(user).toContain('1:2');
    expect(user).toContain('Word 1: ٱلۡحَمۡدُ ("All praises and thanks")');
    expect(user).toContain('حَمۡدُ: lemma حَمْد, root حمد; noun (اسم), nominative (مرفوع)');
    expect(user).toContain('Word 2: لِلَّهِ');
    expect(user).toContain('لِ: lemma ل; preposition (حرف جر)');
    expect(user).toContain('All praise is due to Allah, Lord of the worlds.');
  });

  it('keeps notes to grammar and linguistics, never interpretation', () => {
    const { system } = draftPrompt(input, 'en');

    expect(system).toMatch(/grammar/i);
    expect(system).toMatch(/never .*interpret/i);
    expect(system).toMatch(/tafsir/i);
    expect(system).toMatch(/English/);
  });
});

describe('parsing a draft', () => {
  it('reads ayah and word notes, word 0 being the whole ayah', () => {
    const raw = JSON.stringify({
      notes: [
        { word: 0, text: ' A nominal sentence. ' },
        { word: 2, text: 'لِ is a preposition.' },
      ],
    });

    expect(parseDraft(raw, 2)).toEqual([
      { word: null, text: 'A nominal sentence.' },
      { word: 2, text: 'لِ is a preposition.' },
    ]);
  });

  it('drops empty notes, notes on words the ayah lacks and repeats of a word', () => {
    const raw = JSON.stringify({
      notes: [
        { word: 1, text: 'First.' },
        { word: 1, text: 'Again.' },
        { word: 3, text: 'No such word.' },
        { word: 0, text: '  ' },
      ],
    });

    expect(parseDraft(raw, 2)).toEqual([{ word: 1, text: 'First.' }]);
  });
});

describe('merging drafts', () => {
  it('adds drafts with their status and model', () => {
    const merged = mergeDrafts(notesFile([]), 2, [{ word: 1, text: 'New.' }], 'claude-opus-5-5');

    expect(merged.notes).toEqual([note({ word: 1, text: 'New.' })]);
  });

  it('never overwrites a reviewed note', () => {
    const approved = note({ text: 'Approved.', status: 'approved', reviewer: 'krsho' });
    const rejected = note({ word: 1, text: 'Rejected.', status: 'rejected', reviewer: 'krsho' });

    const merged = mergeDrafts(
      notesFile([approved, rejected]),
      2,
      [
        { word: null, text: 'Redraft of the ayah.' },
        { word: 1, text: 'Redraft of word 1.' },
        { word: 2, text: 'Word 2.' },
      ],
      'claude-opus-5-5',
    );

    expect(merged.notes).toEqual([approved, rejected, note({ word: 2, text: 'Word 2.' })]);
  });

  it('replaces the earlier drafts of the ayah and leaves other ayahs alone', () => {
    const otherAyah = note({ ayah: 3, text: 'Other ayah.' });

    const merged = mergeDrafts(
      notesFile([note({ text: 'Old.' }), note({ word: 2, text: 'Old word 2.' }), otherAyah]),
      2,
      [{ word: null, text: 'New.' }],
      'claude-opus-5-5',
    );

    expect(merged.notes).toEqual([note({ text: 'New.' }), otherAyah]);
  });
});

describe('choosing ayahs to draft', () => {
  const path = [
    { surah: 1, ayah: 1 },
    { surah: 1, ayah: 2 },
    { surah: 114, ayah: 1 },
  ];
  const files = new Map([[1, notesFile([note({ ayah: 1 })])]]);

  it('takes the path ayahs that have no notes yet, in path order', () => {
    expect(ayahsToDraft(path, files, {})).toEqual([
      { surah: 1, ayah: 2 },
      { surah: 114, ayah: 1 },
    ]);
  });

  it('can redraft ayahs that have notes, limit the count and keep to one surah', () => {
    expect(ayahsToDraft(path, files, { redraft: true, limit: 2 })).toEqual(path.slice(0, 2));
    expect(ayahsToDraft(path, files, { surah: 114 })).toEqual([{ surah: 114, ayah: 1 }]);
  });
});
