import { splitAyahIntoParts } from './parts';

const JIM = 'ۚ'; // ۚ stopping permitted
const QILA = 'ۗ'; // ۗ stopping preferred
const SILA = 'ۖ'; // ۖ continuing preferred
const SAJDAH = '۩'; // ۩ not a pause mark

/** An ayah of `count` words, with the given pause marks after the given word positions. */
function ayah(count: number, marks: Record<number, string> = {}): string[] {
  return Array.from({ length: count }, (_, i) => `كَلِمَةٌ${marks[i + 1] ?? ''}`);
}

const lengths = (words: string[]) =>
  splitAyahIntoParts(words).map(({ first, last }) => last - first + 1);

describe('splitting long ayahs into parts', () => {
  it('keeps an ayah of up to 15 words whole, whatever its marks', () => {
    expect(splitAyahIntoParts(ayah(15, { 5: JIM, 10: QILA }))).toEqual([{ first: 1, last: 15 }]);
    expect(splitAyahIntoParts(ayah(3))).toEqual([{ first: 1, last: 3 }]);
  });

  it('breaks after a pause mark', () => {
    expect(splitAyahIntoParts(ayah(20, { 9: JIM }))).toEqual([
      { first: 1, last: 9 },
      { first: 10, last: 20 },
    ]);
  });

  it('prefers the marks where the mushaf favours stopping', () => {
    // ṣilā (continuing preferred) after word 10, qilā (stopping preferred) after word 9.
    expect(lengths(ayah(20, { 9: QILA, 10: SILA }))).toEqual([9, 11]);
  });

  it('chooses among marks for parts of about 8 to 15 words', () => {
    // Marks after almost every word: parts stay within the bounds and use as few screens as fit.
    const marks = Object.fromEntries(Array.from({ length: 39 }, (_, i) => [i + 1, JIM]));
    const parts = lengths(ayah(40, marks));
    expect(parts).toHaveLength(3);
    for (const length of parts) {
      expect(length).toBeGreaterThanOrEqual(8);
      expect(length).toBeLessThanOrEqual(15);
    }
  });

  it('lets a part run to 18 words rather than break where there is no mark', () => {
    expect(lengths(ayah(17))).toEqual([17]);
    expect(lengths(ayah(22, { 5: JIM }))).toEqual([5, 17]);
  });

  it('never makes a part longer than 18 words, even to keep to the marks', () => {
    // The only mark leaves 21 words after it: that stretch is cut without one.
    const parts = lengths(ayah(25, { 4: JIM }));
    expect(Math.max(...parts)).toBeLessThanOrEqual(18);
    expect(parts.reduce((a, b) => a + b)).toBe(25);
  });

  it('falls back to even parts where an ayah has no marks', () => {
    expect(lengths(ayah(20))).toEqual([10, 10]);
    expect(lengths(ayah(40)).sort()).toEqual([13, 13, 14]);
  });

  it('splits an ayah of 16 to 18 words at a mark that gives two good parts', () => {
    expect(lengths(ayah(16, { 8: JIM }))).toEqual([8, 8]);
  });

  it('does not break at the sajdah mark, which is not a pause mark', () => {
    expect(lengths(ayah(20, { 6: SAJDAH, 10: JIM }))).toEqual([10, 10]);
    expect(lengths(ayah(20, { 4: SAJDAH }))).toEqual([10, 10]);
  });

  it('covers every word once, in order', () => {
    const parts = splitAyahIntoParts(ayah(128, { 12: JIM, 30: QILA, 41: SILA, 77: JIM }));
    expect(parts[0].first).toBe(1);
    expect(parts[parts.length - 1].last).toBe(128);
    parts.slice(1).forEach((part, i) => expect(part.first).toBe(parts[i].last + 1));
  });
});
