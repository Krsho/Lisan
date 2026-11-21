import { parseNotesFile, serializeNotesFile } from './notes';

const file = (notes: unknown[]) => JSON.stringify({ language: 'en', surah: 1, notes });

const approved = {
  ayah: 2,
  text: 'لِ is a preposition: praise belongs "to" Allah.',
  status: 'approved',
  reviewer: 'krsho',
  draftedBy: 'claude-opus-5-5',
};

describe('notes files', () => {
  it('reads ayah and word notes with their review status', () => {
    const parsed = parseNotesFile(
      file([approved, { ayah: 2, word: 1, text: 'A noun.', status: 'draft', reviewer: null }]),
    );

    expect(parsed).toEqual({
      language: 'en',
      surah: 1,
      notes: [
        { ...approved, word: null },
        { ayah: 2, word: 1, text: 'A noun.', status: 'draft', reviewer: null, draftedBy: null },
      ],
    });
  });

  it('refuses an unknown review status', () => {
    expect(() => parseNotesFile(file([{ ...approved, status: 'ok' }]))).toThrow(/status/);
  });

  it('refuses a reviewed note without a reviewer', () => {
    expect(() => parseNotesFile(file([{ ...approved, reviewer: null }]))).toThrow(/reviewer/);
    expect(() =>
      parseNotesFile(file([{ ...approved, status: 'rejected', reviewer: ' ' }])),
    ).toThrow(/reviewer/);
  });

  it('refuses an empty note', () => {
    expect(() => parseNotesFile(file([{ ...approved, text: '  ' }]))).toThrow(/text/);
  });

  it('refuses two notes on the same ayah or word', () => {
    expect(() => parseNotesFile(file([approved, { ...approved, status: 'draft' }]))).toThrow(
      /1:2 has more than one note/,
    );
  });

  it('refuses positions that are not positive whole numbers', () => {
    expect(() => parseNotesFile(file([{ ...approved, ayah: 0 }]))).toThrow(/ayah/);
    expect(() => parseNotesFile(file([{ ...approved, word: 1.5 }]))).toThrow(/word/);
  });

  it('writes a file that reads back the same, notes in ayah and word order', () => {
    const parsed = parseNotesFile(
      file([
        { ayah: 3, text: 'C', status: 'draft', reviewer: null },
        { ayah: 2, word: 2, text: 'B', status: 'draft', reviewer: null },
        approved,
      ]),
    );

    const written = serializeNotesFile(parsed);

    expect(parseNotesFile(written).notes.map((n) => n.text)).toEqual([approved.text, 'B', 'C']);
    expect(written.endsWith('\n')).toBe(true);
  });
});
