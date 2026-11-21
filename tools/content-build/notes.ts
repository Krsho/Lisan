/**
 * Authored linguistic notes (content/notes/<language>/<surah>.json): short grammar notes on an
 * ayah or one of its words, each with a review status. Only approved notes are built into the
 * content database; see content/README.md, "Linguistic notes".
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const NOTE_STATUSES = ['draft', 'approved', 'rejected'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export type AuthoredNote = {
  ayah: number;
  /** Displayed word position in the ayah; null for a note on the whole ayah. */
  word: number | null;
  text: string;
  status: NoteStatus;
  /** Who approved or rejected the note. Required once it is reviewed. */
  reviewer: string | null;
  /** The model that drafted the note (e.g. "claude-opus-5-5"), or null if a person wrote it. */
  draftedBy: string | null;
};

export type NotesFile = { language: string; surah: number; notes: AuthoredNote[] };

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const noteRef = (surah: number, note: { ayah: number; word: number | null }) =>
  note.word === null ? `${surah}:${note.ayah}` : `${surah}:${note.ayah}:${note.word}`;

/** Notes in ayah order, the ayah's own note before its word notes. */
export const byPosition = (a: AuthoredNote, b: AuthoredNote) =>
  a.ayah - b.ayah || (a.word ?? 0) - (b.word ?? 0);

/** Reads and checks one notes file. Throws on anything a reviewer should fix by hand. */
export function parseNotesFile(json: string): NotesFile {
  const data = JSON.parse(json) as { language?: unknown; surah?: unknown; notes?: unknown };
  if (typeof data.language !== 'string' || !data.language)
    throw new Error('Notes file needs a language');
  if (!isPositiveInteger(data.surah)) throw new Error('Notes file needs a surah number');
  if (!Array.isArray(data.notes)) throw new Error('Notes file needs a notes list');
  const { language, surah } = data;

  const seen = new Set<string>();
  const notes = data.notes.map((raw: Record<string, unknown>, i): AuthoredNote => {
    const where = `${language} note ${i + 1} of surah ${surah}`;
    if (!isPositiveInteger(raw.ayah)) throw new Error(`${where}: ayah must be a positive number`);
    const word = raw.word ?? null;
    if (word !== null && !isPositiveInteger(word))
      throw new Error(`${where}: word must be a positive number or left out`);
    if (typeof raw.text !== 'string' || !raw.text.trim())
      throw new Error(`${where}: text is empty`);
    if (!NOTE_STATUSES.includes(raw.status as NoteStatus))
      throw new Error(`${where}: status must be one of ${NOTE_STATUSES.join(', ')}`);
    const status = raw.status as NoteStatus;
    const reviewer = typeof raw.reviewer === 'string' && raw.reviewer.trim() ? raw.reviewer : null;
    if (status !== 'draft' && !reviewer)
      throw new Error(`${where}: a ${status} note needs a reviewer`);
    const draftedBy = typeof raw.draftedBy === 'string' && raw.draftedBy ? raw.draftedBy : null;

    const note = { ayah: raw.ayah, word, text: raw.text, status, reviewer, draftedBy };
    const ref = noteRef(surah, note);
    if (seen.has(ref)) throw new Error(`${language} ${ref} has more than one note`);
    seen.add(ref);
    return note;
  });
  return { language, surah, notes };
}

/**
 * Reads every notes file under `dir` (content/notes/<language>/<surah>.json), in every review
 * status. Checks that each file holds the language and surah its path names.
 */
export function readNotesDirectory(dir: string): NotesFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((language) =>
    readdirSync(join(dir, language))
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const path = join(dir, language, name);
        const file = parseNotesFile(readFileSync(path, 'utf8'));
        if (file.language !== language || `${file.surah}.json` !== name)
          throw new Error(`${path} holds ${file.language} notes on surah ${file.surah}`);
        return file;
      }),
  );
}

/** Writes a notes file for review: notes in position order, word left out of ayah notes. */
export function serializeNotesFile({ language, surah, notes }: NotesFile): string {
  const sorted = [...notes].sort(byPosition).map(({ ayah, word, ...rest }) => ({
    ayah,
    ...(word === null ? {} : { word }),
    text: rest.text,
    status: rest.status,
    reviewer: rest.reviewer,
    draftedBy: rest.draftedBy,
  }));
  return `${JSON.stringify({ language, surah, notes: sorted }, null, 2)}\n`;
}
