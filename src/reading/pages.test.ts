import type { Ayah, AyahPart } from '../content/repository';
import { studyPages } from './pages';

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
  first: { surah: 2, ayah: n, word: first },
  last: { surah: 2, ayah: n, word: last },
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
