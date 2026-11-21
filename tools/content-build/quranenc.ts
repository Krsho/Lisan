import { DatabaseSync } from 'node:sqlite';

/** One ayah of a QuranEnc translation or tafsir, text exactly as QuranEnc publishes it. */
export type QuranEncAyah = {
  surah: number;
  ayah: number;
  text: string;
  /** `[n] note` entries; null where the ayah has none. */
  footnotes: string | null;
};

/** A QuranEnc translation or tafsir with what its terms require us to show: source and version. */
export type QuranEncEdition = {
  /** QuranEnc key, e.g. "english_rwwad". */
  key: string;
  title: string;
  url: string;
  /** QuranEnc's version number; null where QuranEnc exposes none (English Mukhtasar). */
  version: string | null;
  /** Date the source was downloaded (YYYY-MM-DD). */
  fetchedAt: string;
  /** sha256 of the downloaded data, identifying an unversioned source. */
  sha256: string;
  ayahs: QuranEncAyah[];
};

/** Metadata stored next to a downloaded QuranEnc source (`<key>.meta.json`). */
export type QuranEncMeta = Omit<QuranEncEdition, 'ayahs'>;

// Footnotes are an empty string in QuranEnc's SQLite files and null in its API.
const footnotesOrNull = (footnotes: string | null) => (footnotes ? footnotes : null);

/** Reads a QuranEnc bulk SQLite file (`translations` table, one row per ayah). */
export function readQuranEncSqlite(file: string): QuranEncAyah[] {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db
      .prepare('SELECT sura, aya, translation, footnotes FROM translations ORDER BY sura, aya')
      .all() as { sura: number; aya: number; translation: string; footnotes: string | null }[];
    return rows.map((r) => ({
      surah: r.sura,
      ayah: r.aya,
      text: r.translation,
      footnotes: footnotesOrNull(r.footnotes),
    }));
  } finally {
    db.close();
  }
}

type ApiRow = { sura: string; aya: string; translation: string; footnotes: string | null };

/**
 * Parses QuranEnc API output (`{"result": [...]}`, as returned by `/translation/sura/...`).
 * The text is kept verbatim, including the Mukhtasar's leading "N. " ayah-number prefix.
 */
export function parseQuranEncResult(json: string): QuranEncAyah[] {
  const { result } = JSON.parse(json) as { result: ApiRow[] };
  return result.map((r) => ({
    surah: Number(r.sura),
    ayah: Number(r.aya),
    text: r.translation,
    footnotes: footnotesOrNull(r.footnotes),
  }));
}
