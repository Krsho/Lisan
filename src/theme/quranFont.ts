// The one place that decides how Quran text is rendered.
//
// KFGQPC Uthmanic Script Hafs v9. The file is downloaded by `npm run content:fetch` and kept out
// of git until KFGQPC grants written permission (see content/README.md). Swapping fonts means
// changing only this file; Amiri Quran (SIL OFL) is the fallback if permission is refused.

import { useSettings } from '../settings/SettingsContext';

export const QURAN_FONT_FAMILY = 'UthmanicHafs';

export const QURAN_FONTS = {
  [QURAN_FONT_FAMILY]: require('../../assets/fonts/UthmanicHafs-v9.otf'),
};

/**
 * Sizes Quran text by the learner's font size setting: `text(30, 56)` is the style for text
 * designed at 30 on 56, and `width(140)` scales a width that holds such text.
 */
export function useQuranTextSize() {
  const scale = useSettings().arabicFontScale;
  return {
    text: (fontSize: number, lineHeight: number) => ({
      fontSize: Math.round(fontSize * scale),
      lineHeight: Math.round(lineHeight * scale),
    }),
    width: (width: number) => Math.round(width * scale),
  };
}
