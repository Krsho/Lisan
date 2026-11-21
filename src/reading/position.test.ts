import { describePosition, pageIndexOf } from './position';

it('names the surah and the ayah out of its count', () => {
  expect(describePosition('Al-Baqarah', 5, 286)).toBe('Al-Baqarah · 5 / 286');
});

it('adds the part of a long ayah', () => {
  expect(describePosition('Al-Baqarah', 282, 286, { number: 2, count: 5 })).toBe(
    'Al-Baqarah · 282 / 286 · part 2 of 5',
  );
});

it('leaves out the count when it is not known', () => {
  expect(describePosition('Surah 2', 282, undefined, { number: 2, count: 5 })).toBe(
    'Surah 2 · 282 · part 2 of 5',
  );
});

describe('the page showing a place', () => {
  const pages = [{ ayah: 1 }, { ayah: 2, part: 1 }, { ayah: 2, part: 2 }, { ayah: 3 }];

  it('finds an ayah shown whole', () => {
    expect(pageIndexOf(pages, { ayah: 3 })).toBe(3);
  });

  it('finds the part of a long ayah', () => {
    expect(pageIndexOf(pages, { ayah: 2, part: 2 })).toBe(2);
  });

  it("opens a long ayah at its first part when the place doesn't name one", () => {
    expect(pageIndexOf(pages, { ayah: 2 })).toBe(1);
  });

  it('opens at the ayah when the remembered part no longer exists', () => {
    expect(pageIndexOf(pages, { ayah: 2, part: 5 })).toBe(1);
    expect(pageIndexOf(pages, { ayah: 3, part: 2 })).toBe(3);
  });

  it('opens at the first page when the ayah is not in the surah', () => {
    expect(pageIndexOf(pages, { ayah: 99 })).toBe(0);
  });
});
