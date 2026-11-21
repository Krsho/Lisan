/** Minimal async SQL access, so the same repository works over expo-sqlite (app) and node:sqlite (tools/tests). */
export type SqlRunner = {
  all<Row>(sql: string, params: (string | number)[]): Promise<Row[]>;
};

export type Language = 'en';

export type Word = {
  position: number;
  text: string;
  gloss: string | null;
};

export type Ayah = {
  surah: number;
  ayah: number;
  words: Word[];
};

export type WordRef = { surah: number; ayah: number; word: number };

/** A grammatical term, named in Arabic and in the explanation language. */
export type Term = {
  /** Stable glossary key, e.g. "case.genitive". */
  key: string;
  /** The Arabic grammatical term, e.g. "مجرور". */
  arabic: string;
  /** The term in the explanation language, e.g. "genitive". */
  name: string;
  /** A short explanation in the explanation language. */
  definition: string;
};

/** One morphological piece of a word: a prefix, the stem, or a suffix. */
export type Segment = {
  position: number;
  text: string;
  /** Dictionary form, e.g. "رَحِيم". Null where the corpus gives none (some attached pronouns). */
  lemma: string | null;
  /** Root letters, e.g. "رحم". Null for particles, pronouns and other root-less words. */
  root: string | null;
  /** Affix role (prefix/suffix), part of speech, then grammatical features. */
  terms: Term[];
};

export type WordDetails = Word & { ref: WordRef; segments: Segment[] };

/** An ayah's full translation and short tafsir, verbatim from QuranEnc. */
export type AyahTranslation = {
  ayah: number;
  translation: string | null;
  /** Translator's notes, `[n] note` entries matching `[n]` markers in the translation. */
  footnotes: string | null;
  tafsir: string | null;
};

/** A published translation or tafsir, with what attribution requires: source and version. */
export type Edition = {
  kind: 'translation' | 'tafsir';
  language: string;
  key: string;
  title: string;
  url: string;
  /** Null where the publisher exposes no version. */
  version: string | null;
  fetchedAt: string;
};

type WordRow = { ayah: number; position: number; text: string; gloss: string | null };
type SegmentRow = { position: number; text: string; lemma: string | null; root: string | null };
type TermRow = Term & { segment: number };

// A term's name and definition in the requested language, falling back to English.
// The joins expect the terms table as `t` and take the language as their one parameter.
const TERM_COLUMNS = `COALESCE(tl.name, en.name) AS name, COALESCE(tl.definition, en.definition) AS definition`;
const TERM_TRANSLATION_JOINS = `
  LEFT JOIN term_translations tl ON tl.term = t.term AND tl.language = ?
  LEFT JOIN term_translations en ON en.term = t.term AND en.language = 'en'`;

export function createContentRepository(db: SqlRunner) {
  return {
    async getSurah(surah: number, language: Language): Promise<Ayah[]> {
      const rows = await db.all<WordRow>(
        `SELECT w.ayah, w.position, w.text, g.text AS gloss
           FROM words w
           LEFT JOIN glosses g
             ON g.surah = w.surah AND g.ayah = w.ayah AND g.word = w.position AND g.language = ?
          WHERE w.surah = ?
          ORDER BY w.ayah, w.position`,
        [language, surah],
      );
      const ayahs: Ayah[] = [];
      for (const row of rows) {
        let current = ayahs[ayahs.length - 1];
        if (!current || current.ayah !== row.ayah) {
          current = { surah, ayah: row.ayah, words: [] };
          ayahs.push(current);
        }
        current.words.push({ position: row.position, text: row.text, gloss: row.gloss });
      }
      return ayahs;
    },

    async getTranslations(surah: number, language: Language): Promise<AyahTranslation[]> {
      return db.all<AyahTranslation>(
        `SELECT a.ayah, tr.text AS translation, tr.footnotes, tf.text AS tafsir
           FROM ayahs a
           LEFT JOIN ayah_texts tr ON tr.surah = a.surah AND tr.ayah = a.ayah
            AND tr.kind = 'translation' AND tr.language = ?
           LEFT JOIN ayah_texts tf ON tf.surah = a.surah AND tf.ayah = a.ayah
            AND tf.kind = 'tafsir' AND tf.language = ?
          WHERE a.surah = ?
          ORDER BY a.ayah`,
        [language, language, surah],
      );
    },

    async getEditions(): Promise<Edition[]> {
      return db.all<Edition>(
        `SELECT kind, language, key, title, url, version, fetched_at AS fetchedAt
           FROM editions ORDER BY kind DESC, language`,
        [],
      );
    },

    async getTerm(key: string, language: Language): Promise<Term> {
      const [term] = await db.all<Term>(
        `SELECT t.term AS key, t.arabic, ${TERM_COLUMNS}
           FROM terms t ${TERM_TRANSLATION_JOINS}
          WHERE t.term = ?`,
        [language, key],
      );
      if (!term) throw new Error(`No glossary term ${key}`);
      return term;
    },

    async getWordDetails(ref: WordRef, language: Language): Promise<WordDetails> {
      const { surah, ayah, word } = ref;
      const [wordRow] = await db.all<WordRow>(
        `SELECT w.ayah, w.position, w.text, g.text AS gloss
           FROM words w
           LEFT JOIN glosses g
             ON g.surah = w.surah AND g.ayah = w.ayah AND g.word = w.position AND g.language = ?
          WHERE w.surah = ? AND w.ayah = ? AND w.position = ?`,
        [language, surah, ayah, word],
      );
      if (!wordRow) throw new Error(`No word at ${surah}:${ayah}:${word}`);

      const segmentRows = await db.all<SegmentRow>(
        `SELECT position, text, lemma, root FROM segments
          WHERE surah = ? AND ayah = ? AND word = ?
          ORDER BY position`,
        [surah, ayah, word],
      );
      // Falls back to English where a term has no translation in the requested language.
      const termRows = await db.all<TermRow>(
        `SELECT st.segment, st.term AS key, t.arabic, ${TERM_COLUMNS}
           FROM segment_terms st
           JOIN terms t ON t.term = st.term ${TERM_TRANSLATION_JOINS}
          WHERE st.surah = ? AND st.ayah = ? AND st.word = ?
          ORDER BY st.segment, st.ordinal`,
        [language, surah, ayah, word],
      );

      return {
        ref,
        position: wordRow.position,
        text: wordRow.text,
        gloss: wordRow.gloss,
        segments: segmentRows.map((segment) => ({
          ...segment,
          terms: termRows
            .filter((row) => row.segment === segment.position)
            .map(({ key, arabic, name, definition }) => ({ key, arabic, name, definition })),
        })),
      };
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;
