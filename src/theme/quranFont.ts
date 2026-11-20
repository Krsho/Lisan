// The one place that decides how Quran text is rendered.
//
// KFGQPC Uthmanic Script Hafs v9. The file is downloaded by `npm run content:fetch` and kept out
// of git until KFGQPC grants written permission (see content/README.md). Swapping fonts means
// changing only this file; Amiri Quran (SIL OFL) is the fallback if permission is refused.

export const QURAN_FONT_FAMILY = 'UthmanicHafs';

export const QURAN_FONTS = {
  [QURAN_FONT_FAMILY]: require('../../assets/fonts/UthmanicHafs-v9.otf'),
};
