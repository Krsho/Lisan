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

export type Segment = {
  position: number;
  text: string;
  /** Coarse part of speech: N (noun), V (verb) or P (particle). */
  pos: string;
  /** Corpus feature tags, e.g. ["ROOT:رحم", "LEM:رَحِيم", "MS", "GEN", "ADJ"]. */
  tags: string[];
};

type WordRow = { ayah: number; position: number; text: string; gloss: string | null };
type SegmentRow = { position: number; text: string; pos: string; tags: string };

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

    async getSegments({ surah, ayah, word }: WordRef): Promise<Segment[]> {
      const rows = await db.all<SegmentRow>(
        `SELECT position, text, pos, tags FROM segments
          WHERE surah = ? AND ayah = ? AND word = ?
          ORDER BY position`,
        [surah, ayah, word],
      );
      return rows.map((row) => ({ ...row, tags: row.tags ? row.tags.split('|') : [] }));
    },
  };
}

export type ContentRepository = ReturnType<typeof createContentRepository>;
