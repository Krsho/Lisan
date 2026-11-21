import { describePosition } from './position';

it('names the surah and the ayah out of its count', () => {
  expect(describePosition('Al-Baqarah', 5, 286)).toBe('Al-Baqarah · 5 / 286');
});

it('adds the part of a long ayah', () => {
  expect(describePosition('Al-Baqarah', 282, 286, { number: 2, count: 5 })).toBe(
    'Al-Baqarah · 282 / 286 · part 2 of 5',
  );
});
