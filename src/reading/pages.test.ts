import type { Ayah, AyahPart } from '../content/repository';
import { placeOf, sessionHeading, sessionPages, studyPages, translationPageOf } from './pages';
import { pageIndexOf } from './position';

const ayah = (n: number, wordCount: number): Ayah => ({
  surah: 2,
  ayah: n,
  words: Array.from({ length: wordCount }, (_, i) => ({
    position: i + 1,
    text: `w${i + 1}`,
    bare: `w${i + 1}`,
    gloss: null,
  })),
});

const part = (n: number, number: number, count: number, first: number, last: number): AyahPart => ({
  surah: 2,
  ayah: n,
  part: number,
  count,
  fromWord: first,
  toWord: last,
});

it("shows a session's passages one ayah or part a screen, only the parts studied today", () => {
  const ayahs = new Map([
    ['2:2', ayah(2, 20)],
    ['2:3', ayah(3, 2)],
  ]);
  const parts = [part(2, 1, 3, 1, 6), part(2, 2, 3, 7, 12), part(2, 3, 3, 13, 20)];
  const pages = sessionPages(
    [
      { surah: 2, ayah: 2, fromWord: 7, toWord: 20, ayahWords: 20 },
      { surah: 2, ayah: 3, fromWord: 1, toWord: 2, ayahWords: 2 },
    ],
    ayahs,
    parts,
  );
  expect(pages.map((p) => [p.key, p.words[0].position, p.words.length, p.part])).toEqual([
    ['2:2.2', 7, 6, { number: 2, count: 3 }],
    ['2:2.3', 13, 8, { number: 3, count: 3 }],
    ['2:3', 1, 2, undefined],
  ]);
});

it("shows an ayah's translation on the first part studied today when part 1 isn't", () => {
  const ayahs = new Map([
    ['2:2', ayah(2, 20)],
    ['2:3', ayah(3, 20)],
  ]);
  const parts = [
    ...[part(2, 1, 3, 1, 6), part(2, 2, 3, 7, 12), part(2, 3, 3, 13, 20)],
    ...[part(3, 1, 2, 1, 10), part(3, 2, 2, 11, 20)],
  ];
  const pages = sessionPages(
    [
      { surah: 2, ayah: 2, fromWord: 7, toWord: 20, ayahWords: 20 },
      { surah: 2, ayah: 3, fromWord: 1, toWord: 20, ayahWords: 20 },
    ],
    ayahs,
    parts,
  );
  expect(pages.map((p) => [p.key, p.translationPart])).toEqual([
    ['2:2.2', 2],
    ['2:2.3', 2],
    ['2:3.1', undefined],
    ['2:3.2', undefined],
  ]);
  // Each later part links to the page holding its ayah's translation; that page links nowhere.
  expect(pages.map((_, i) => translationPageOf(pages, i))).toEqual([undefined, 0, undefined, 2]);
});

it('shows an ayah without parts whole, on one screen', () => {
  const pages = studyPages([ayah(1, 3)], []);
  expect(pages).toEqual([{ key: '1', surah: 2, ayah: 1, words: ayah(1, 3).words }]);
});

it('shows a long ayah one part a screen, in order, with its position among the parts', () => {
  const pages = studyPages(
    [ayah(1, 2), ayah(2, 20), ayah(3, 2)],
    [part(2, 1, 2, 1, 9), part(2, 2, 2, 10, 20)],
  );
  expect(pages.map((p) => [p.key, p.words[0].position, p.words.length, p.part])).toEqual([
    ['1', 1, 2, undefined],
    ['2.1', 1, 9, { number: 1, count: 2 }],
    ['2.2', 10, 11, { number: 2, count: 2 }],
    ['3', 1, 2, undefined],
  ]);
});

it('resumes on the part of a long ayah the learner was on', () => {
  const pages = studyPages(
    [ayah(1, 2), ayah(2, 30), ayah(3, 2)],
    [part(2, 1, 3, 1, 10), part(2, 2, 3, 11, 20), part(2, 3, 3, 21, 30)],
  );
  const places = pages.map(placeOf);
  expect(places).toEqual([
    { ayah: 1 },
    { ayah: 2, part: 1 },
    { ayah: 2, part: 2 },
    { ayah: 2, part: 3 },
    { ayah: 3 },
  ]);
  // The place saved while viewing a page reopens that same page.
  const saved = placeOf(pages[2]);
  expect(pageIndexOf(places, saved)).toBe(2);
  expect(pages[pageIndexOf(places, saved)].key).toBe('2.2');
});

describe("a session screen's heading", () => {
  const ayahs = new Map([['2:282', ayah(282, 40)]]);
  const parts = [part(282, 3, 5, 1, 20), part(282, 4, 5, 21, 30), part(282, 5, 5, 31, 40)];
  const pages = sessionPages(
    [{ surah: 2, ayah: 282, fromWord: 1, toWord: 40, ayahWords: 40 }],
    ayahs,
    parts,
  );
  const baqarah = {
    surah: 2,
    nameEnglish: 'Al-Baqarah',
    nameArabic: '',
    ayahCount: 286,
    hasBasmala: true,
  };

  it('counts the screens, not the ayahs, so the parts of one ayah move on', () => {
    expect(sessionHeading('New today', pages, 0, [baqarah]).progress).toBe('New today · 1 of 3');
    expect(sessionHeading('New today', pages, 2, [baqarah]).progress).toBe('New today · 3 of 3');
  });

  it("gives the screen's place in its surah", () => {
    expect(sessionHeading('New today', pages, 1, [baqarah]).reference).toBe(
      'Al-Baqarah · 282 / 286 · part 4 of 5',
    );
  });

  it('names the surah by number until the surah names load', () => {
    expect(sessionHeading('Recap', pages, 0, null).reference).toBe('Surah 2 · 282 · part 3 of 5');
  });
});
