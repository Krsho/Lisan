// The one place that decides how Quran text is rendered.
// Amiri Quran (SIL OFL) is used until written permission for the KFGQPC Uthmanic Hafs font is
// obtained; swapping fonts means changing only this file.

export const QURAN_FONT_FAMILY = 'AmiriQuran';

export const QURAN_FONTS = {
  [QURAN_FONT_FAMILY]: require('../../assets/fonts/AmiriQuran-Regular.ttf'),
};
