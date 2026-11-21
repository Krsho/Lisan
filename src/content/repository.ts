/** Minimal async SQL access, so the same repository works over expo-sqlite (app) and node:sqlite (tools/tests). */
export type SqlRunner = {
  all<Row>(sql: string, params: (string | number)[]): Promise<Row[]>;
};

export type Language = 'en';

export type Word = {
  position: number;
  /** The word as printed in the mushaf, including any pause mark on it (e.g. ۚ). */
  text: string;
  /** The word without pause marks, for showing it on its own (quiz and review cards). */
  bare: string;
  gloss: string | null;
};

export type Ayah = {
  surah: number;
  ayah: number;
  words: Word[];
};

export type SurahSummary = {
  surah: number;
  nameEnglish: string;
  /** In KFGQPC's encoding: render it with the Quran font. */
  nameArabic: string;
  ayahCount: number;
  /** Whether the Basmala heads the surah, above ayah 1 (every surah except 1 and 9). */
  hasBasmala: boolean;
};

export type WordRef = { surah: number; ayah: number; word: number };

/** A word shown outside its own ayah (the Basmala header), linked to where its details live. */
export type LinkedWord = Word & { ref: WordRef };

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
  /** How many segments of the Quran have this lemma. Null when there is no lemma. */
  lemmaFrequency: number | null;
  /** Root letters, e.g. "رحم". Null for particles, pronouns and other root-less words. */
  root: string | null;
  /** Affix role (prefix/suffix), part of speech, then grammatical features. */
  terms: Term[];
};

export type WordDetails = Word & { ref: WordRef; segments: Segment[] };

/** An ayah on the curated path, with the lemmas of each of its words (what the engine plans with). */
export type PathAyah = {
  surah: number;
  ayah: number;
  /** Every word of the ayah in order, each with its segments' distinct lemmas in segment order. */
  words: { position: number; lemmas: string[] }[];
};

/** A lemma as quizzes draw wrong options from it. */
export type LemmaSample = {
  lemmaId: string;
  frequency: number;
  /** Glossary key of the sample word's part of speech, e.g. "pos.noun". Null without a sample. */
  partOfSpeech: string | null;
  /** The first word that is this lemma alone, without pause marks; null if it never stands alone. */
  sample: { bare: string; gloss: string } | null;
};

type LemmaSampleRow = { lemmaId: string; bare: string; gloss: string; terms: string };

type WordRow = { ayah: number; position: number; text: string; bare: string; gloss: string | null };
/** `terms` holds the ids of the segment's terms, separated by spaces. */
type SegmentRow = Omit<Segment, 'terms'> & { terms: string };
type SurahRow = Omit<SurahSummary, 'hasBasmala'> & { hasBasmala: number };
type TermRow = Term & { id: number };

// A word with its gloss in the requested language. The join takes the language as its one parameter.
const WORD_COLUMNS = `w.ayah, w.position, w.text, COALESCE(w.bare, w.text) AS bare, g.text AS gloss`;
const GLOSS_JOIN = `
  LEFT JOIN glosses g
    ON g.surah = w.surah AND g.ayah = w.ayah AND g.word = w.position AND g.language = ?`;

const toWord = ({ position, text, bare, gloss }: WordRow): Word => ({
  position,
  text,
  bare,
  gloss,
});

/** An ayah's full translation and short tafsir, verbatim from QuranEnc. */
export type AyahTranslation = {
  ayah: number;
  translation: string | null;
  /** Translator's notes, `[n] note` entries matching `[n]` markers in the translation. */
  footnotes: string | null;
  tafsir: string | null;
};

/**
 * A short grammar note authored for Lisan and approved by a maintainer: what a word or particle
 * does in the ayah, never religious interpretation. Shown apart from the tafsir.
 */
export type LinguisticNote = {
  ayah: number;
  /** The word the note is about, or null for a note on the whole ayah. */
  word: number | null;
  text: string;
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

// A term's name and definition in the requested language, falling back to English.
// The joins expect the terms table as `t` and take the language as their one parameter.
const TERM_COLUMNS = `COALESCE(tl.name, en.name) AS name, COALESCE(tl.definition, en.definition) AS definition`;
const TERM_TRANSLATION_JOINS = `
  LEFT JOIN term_translations tl ON tl.term = t.term AND tl.language = ?
  LEFT JOIN term_translations en ON en.term = t.term AND en.language = 'en'`;

/** Al-Fatiha's first ayah is the Basmala that heads the other surahs. */
const BASMALA = { surah: 1, ayah: 1 };

export function createContentRepository(db: SqlRunner) {
  return {
    async listSurahs(): Promise<SurahSummary[]> {
      const rows = await db.all<SurahRow>(
        `SELECT surah, name_english AS nameEnglish, name_arabic AS nameArabic,
                ayah_count AS ayahCount, has_basmala AS hasBasmala
           FROM surahs ORDER BY surah`,
        [],
      );
      return rows.map((row) => ({ ...row, hasBasmala: row.hasBasmala === 1 }));
    },

    /** The Basmala header's words: those of 1:1, so tapping one shows its details there. */
    async getBasmala(language: Language): Promise<LinkedWord[]> {
      const rows = await db.all<WordRow>(
        `SELECT ${WORD_COLUMNS} FROM words w ${GLOSS_JOIN}
          WHERE w.surah = ? AND w.ayah = ?
          ORDER BY w.position`,
        [language, BASMALA.surah, BASMALA.ayah],
      );
      return rows.map((row) => ({ ...toWord(row), ref: { ...BASMALA, word: row.position } }));
    },

    async getSurah(surah: number, language: Language): Promise<Ayah[]> {
      const rows = await db.all<WordRow>(
        `SELECT ${WORD_COLUMNS} FROM words w ${GLOSS_JOIN}
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
        current.words.push(toWord(row));
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

    /** A surah's linguistic notes, ayah by ayah, each ayah's own note before its word notes. */
    async getNotes(surah: number, language: Language): Promise<LinguisticNote[]> {
      return db.all<LinguisticNote>(
        `SELECT ayah, NULLIF(word, 0) AS word, text
           FROM notes
          WHERE surah = ? AND language = ?
          ORDER BY ayah, word`,
        [surah, language],
      );
    },

    /** The curated path in study order: Al-Fatiha, then Juz' 'Amma from An-Nas backwards. */
    async getPath(): Promise<PathAyah[]> {
      const rows = await db.all<{
        surah: number;
        ayah: number;
        word: number;
        lemma: string | null;
      }>(
        `SELECT p.surah, p.ayah, w.position AS word, s.lemma
           FROM path p
           JOIN words w ON w.surah = p.surah AND w.ayah = p.ayah
           LEFT JOIN segments s ON s.surah = w.surah AND s.ayah = w.ayah AND s.word = w.position
          ORDER BY p.position, w.position, s.position`,
        [],
      );
      const path: PathAyah[] = [];
      for (const { surah, ayah, word, lemma } of rows) {
        let current = path[path.length - 1];
        if (!current || current.surah !== surah || current.ayah !== ayah) {
          current = { surah, ayah, words: [] };
          path.push(current);
        }
        let last = current.words[current.words.length - 1];
        if (!last || last.position !== word) {
          last = { position: word, lemmas: [] };
          current.words.push(last);
        }
        if (lemma && !last.lemmas.includes(lemma)) last.lemmas.push(lemma);
      }
      return path;
    },

    /**
     * Every lemma with its frequency and, where it stands alone as a whole word somewhere, its
     * first such word: its text, gloss and part of speech. Quizzes draw wrong options from these.
     */
    async getLemmaSamples(language: Language): Promise<LemmaSample[]> {
      // Driven from the words (not a join onto every lemma), which keeps it to ~100 ms.
      const [lemmas, rows, terms] = await Promise.all([
        db.all<{ lemmaId: string; frequency: number }>(
          `SELECT lemma AS lemmaId, frequency FROM lemmas ORDER BY lemma`,
          [],
        ),
        db.all<LemmaSampleRow>(
          `WITH alone AS (
             SELECT surah, ayah, word, MIN(lemma) AS lemma, MIN(terms) AS terms
               FROM segments
              WHERE lemma IS NOT NULL
              GROUP BY surah, ayah, word
             HAVING COUNT(*) = 1
           ),
           first AS (
             SELECT lemma, surah, ayah, word, terms, MIN(surah * 1000000 + ayah * 1000 + word)
               FROM alone GROUP BY lemma
           )
           SELECT f.lemma AS lemmaId, COALESCE(w.bare, w.text) AS bare, g.text AS gloss, f.terms
             FROM first f
             JOIN words w ON w.surah = f.surah AND w.ayah = f.ayah AND w.position = f.word
             JOIN glosses g
               ON g.surah = f.surah AND g.ayah = f.ayah AND g.word = f.word AND g.language = ?`,
          [language],
        ),
        db.all<{ id: number; key: string }>(`SELECT id, term AS key FROM terms`, []),
      ]);
      const keys = new Map(terms.map((t) => [t.id, t.key]));
      const samples = new Map(rows.map((row) => [row.lemmaId, row]));
      return lemmas.map(({ lemmaId, frequency }) => {
        const row = samples.get(lemmaId);
        if (!row) return { lemmaId, frequency, partOfSpeech: null, sample: null };
        const partOfSpeech =
          row.terms
            .split(' ')
            .map((id) => keys.get(Number(id)))
            .find((key) => key?.startsWith('pos.') || key?.startsWith('particle.')) ?? null;
        return { lemmaId, frequency, partOfSpeech, sample: { bare: row.bare, gloss: row.gloss } };
      });
    },

    /** Every glossary term, e.g. to name the options of a grammar question. */
    async listTerms(language: Language): Promise<Term[]> {
      return db.all<Term>(
        `SELECT t.term AS key, t.arabic, ${TERM_COLUMNS}
           FROM terms t ${TERM_TRANSLATION_JOINS}
          ORDER BY t.id`,
        [language],
      );
    },

    /** The content database's version, for the about screen and mistake reports. */
    async getContentVersion(): Promise<number> {
      const [row] = await db.all<{ value: string }>(
        `SELECT value FROM meta WHERE key = 'content_version'`,
        [],
      );
      if (!row) throw new Error('Content database has no content_version');
      return Number(row.value);
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
        `SELECT ${WORD_COLUMNS} FROM words w ${GLOSS_JOIN}
          WHERE w.surah = ? AND w.ayah = ? AND w.position = ?`,
        [language, surah, ayah, word],
      );
      if (!wordRow) throw new Error(`No word at ${surah}:${ayah}:${word}`);

      const segmentRows = await db.all<SegmentRow>(
        `SELECT s.position, s.text, s.lemma, l.frequency AS lemmaFrequency, s.root, s.terms
           FROM segments s
           LEFT JOIN lemmas l ON l.lemma = s.lemma
          WHERE s.surah = ? AND s.ayah = ? AND s.word = ?
          ORDER BY s.position`,
        [surah, ayah, word],
      );
      const idsBySegment = segmentRows.map((s) => (s.terms ? s.terms.split(' ').map(Number) : []));
      const ids = [...new Set(idsBySegment.flat())];
      // Falls back to English where a term has no translation in the requested language.
      const termRows = ids.length
        ? await db.all<TermRow>(
            `SELECT t.id, t.term AS key, t.arabic, ${TERM_COLUMNS}
               FROM terms t ${TERM_TRANSLATION_JOINS}
              WHERE t.id IN (${ids.map(() => '?').join(', ')})`,
            [language, ...ids],
          )
        : [];
      const termsById = new Map(
        termRows.map(({ id, key, arabic, name, definition }) => [
          id,
          { key, arabic, name, definition },
        ]),
      );

      return {
        ref,
        ...toWord(wordRow),
        segments: segmentRows.map(({ terms: _ids, ...segment }, i) => ({
          ...segment,
          terms: idsBySegment[i].map((id) => {
            const term = termsById.get(id);
            if (!term) throw new Error(`No glossary term with id ${id}`);
            return term;
          }),
        })),
      };
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;
