/** One row of KFGQPC's UthmanicHafs data (hafsData_v2-0.json); only the columns the build uses. */
type KfgqpcRow = {
  jozz: number;
  page: number;
  sura_no: number;
  sura_name_en: string;
  sura_name_ar: string;
  aya_no: number;
  aya_text: string;
};

export type QuranAyah = {
  surah: number;
  ayah: number;
  /** The ayah text without its ayah-end glyph and ۞ mark, otherwise verbatim. */
  text: string;
  juz: number;
  page: number;
  /** The ayah starts a quarter of a ḥizb (KFGQPC prints ۞ before it). */
  hizbQuarter: boolean;
  surahNameEnglish: string;
  surahNameArabic: string;
};

/** KFGQPC ends each ayah with a no-break space and a private-use ayah-number glyph (U+FC00 + n − 1). */
const AYAH_END = /[\s\u00A0]*[\uFC00-\uFDFF]$/;
/** ۞ (rubʿ al-ḥizb) opens an ayah as its own token, followed by a no-break space. */
const HIZB_QUARTER = /^\u06DE[\s\u00A0]*/;

/** Parses KFGQPC's hafsData JSON into ayahs with display text ready to split into words. */
export function parseKfgqpc(json: string): QuranAyah[] {
  const rows = JSON.parse(json) as KfgqpcRow[];
  return rows.map((row) => {
    const location = `${row.sura_no}:${row.aya_no}`;
    if (!AYAH_END.test(row.aya_text))
      throw new Error(`KFGQPC ayah ${location} has no ayah-end mark`);
    let text = row.aya_text.replace(AYAH_END, '');
    const hizbQuarter = HIZB_QUARTER.test(text);
    text = text.replace(HIZB_QUARTER, '').replace(/\u00A0/g, ' ');
    if (/[\uE000-\uF8FF\uFB50-\uFDFF\u06DE]/.test(text)) {
      throw new Error(`KFGQPC ayah ${location} has an unexpected symbol`);
    }
    return {
      surah: row.sura_no,
      ayah: row.aya_no,
      text,
      juz: row.jozz,
      page: row.page,
      hizbQuarter,
      surahNameEnglish: row.sura_name_en,
      surahNameArabic: row.sura_name_ar,
    };
  });
}

/** Arabic letters. Tokens without any (a standalone pause mark) are not words. */
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

export function splitWords(ayahText: string): string[] {
  return ayahText.split(/\s+/).filter((token) => ARABIC_LETTER.test(token));
}

/**
 * Pause (waqf) marks, which KFGQPC writes at the end of the preceding word: ṣilā ۖ, qilā ۗ, mīm ۘ,
 * lā ۙ, jīm ۚ, muʿānaqa ۛ, and the sajdah mark ۩. The small high sīn ۜ is a pronunciation mark and
 * stays.
 */
const PAUSE_MARKS = /[ۖ-ۛ۩]/g;

/** The word without pause marks, for showing it on its own (quiz and review cards, search). */
export function bareWord(word: string): string {
  return word.replace(PAUSE_MARKS, '');
}
