/**
 * How the study pager lays out its pages: page 1 on the right, later pages to its left, as in a
 * mushaf. Under a right-to-left system locale (I18nManager.isRTL, on by default since SDK 58,
 * Expo Go included) React Native already mirrors a horizontal list, and inverting it as well
 * would flip it back. So the pager fixes its own direction to left to right and always inverts:
 * the same layout, and the same scroll offsets, in every locale.
 */
export function pagerLayout(isRTL: boolean): { direction: 'ltr'; inverted: true } {
  void isRTL;
  return { direction: 'ltr', inverted: true };
}

/** The page a scroll offset shows: the nearest whole page, within the `count` pages. */
export function pageAtOffset(offsetX: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetX / width)));
}
