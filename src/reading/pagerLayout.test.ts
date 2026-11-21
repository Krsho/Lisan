import { pageAtOffset, pagerLayout } from './pagerLayout';

describe('the study pager layout', () => {
  it('reverses a left-to-right list, so page 1 is on the right', () => {
    expect(pagerLayout(false)).toEqual({ direction: 'ltr', inverted: true });
  });

  it('lays out the same under a right-to-left system locale, rather than flipping twice', () => {
    expect(pagerLayout(true)).toEqual(pagerLayout(false));
  });
});

describe('the page a swipe stops on', () => {
  const width = 400;

  it('is the offset in page widths', () => {
    expect(pageAtOffset(0, width, 5)).toBe(0);
    expect(pageAtOffset(800, width, 5)).toBe(2);
  });

  it('rounds to the nearest page', () => {
    expect(pageAtOffset(1190, width, 5)).toBe(3);
    expect(pageAtOffset(1210, width, 5)).toBe(3);
  });

  it('stays within the pages when the list bounces past either end', () => {
    expect(pageAtOffset(-120, width, 5)).toBe(0);
    expect(pageAtOffset(2400, width, 5)).toBe(4);
  });

  it('is the first page before the pager has a width', () => {
    expect(pageAtOffset(300, 0, 5)).toBe(0);
  });
});
