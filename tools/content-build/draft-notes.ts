/**
 * The pure half of the linguistic-notes drafting pipeline (draft-notes-cli.ts calls Claude):
 * which ayahs to draft, the prompt, reading the model's answer and merging it into a notes file
 * without touching anything a maintainer has reviewed. See content/README.md, "Linguistic notes".
 */
import type { WordDetails } from '../../src/content/repository.ts';
import { byPosition, type AuthoredNote, type NotesFile } from './notes.ts';

/** Everything the model is told about one ayah. */
export type DraftInput = {
  surah: number;
  ayah: number;
  surahName: string;
  words: WordDetails[];
  /** A published translation, for context only. */
  translation: string | null;
};

/** A drafted note before it is filed: word null is a note on the whole ayah. */
export type DraftNote = { word: number | null; text: string };

const LANGUAGE_NAMES: Record<string, string> = { en: 'English' };

export const languageName = (language: string): string => {
  const name = LANGUAGE_NAMES[language];
  if (!name) throw new Error(`No language name for ${language}; add it to LANGUAGE_NAMES`);
  return name;
};

/** The JSON shape the model must answer in (structured outputs). Word 0 is the whole ayah. */
export const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'integer' }, text: { type: 'string' } },
        required: ['word', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['notes'],
  additionalProperties: false,
} as const;

/** The system and user prompts for one ayah's notes, in the given explanation language. */
export function draftPrompt(input: DraftInput, language: string): { system: string; user: string } {
  const system = `You write short linguistic notes for Lisan, an app that teaches learners to understand the Arabic of the Quran. A note explains grammar or linguistics that a learner can check against the word's morphology: what a particle or preposition does here, why a word has its case or mood, what a verb form or noun pattern contributes, word order, agreement, iḍāfa, attached pronouns, and similar points.

Rules:
- Stay within grammar, morphology, syntax and vocabulary. Never give religious interpretation, tafsir, legal rulings, occasions of revelation or theological claims, and never interpret what the ayah teaches beyond its literal wording. The app shows a published tafsir separately; these notes must not compete with it.
- Base every claim on the morphology you are given. Leave out any point you are not certain of: a missing note is better than a wrong one.
- Write in ${languageName(language)}, in plain words for someone still learning Arabic grammar. Give an Arabic grammatical term in Arabic script once where it helps, such as مجرور.
- Quote Arabic words exactly as they are given.
- Each note is one to three sentences. Write at most one note on the whole ayah and at most one note per word, and only where there is something worth pointing out: two or three notes are usually enough for an ayah, and none is acceptable.
- Use word 0 for a note on the whole ayah; otherwise use the word's number.`;

  const wordLines = input.words.map((word) => {
    const gloss = word.gloss ? ` ("${word.gloss}")` : '';
    const segments = word.segments.map((segment) => {
      const lexical = [
        segment.lemma ? `lemma ${segment.lemma}` : null,
        segment.root ? `root ${segment.root}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const terms = segment.terms.map((t) => `${t.name} (${t.arabic})`).join(', ');
      return `  - ${segment.text}: ${lexical ? `${lexical}; ` : ''}${terms}`;
    });
    return [`Word ${word.position}: ${word.text}${gloss}`, ...segments].join('\n');
  });

  const user = [
    `Surah ${input.surahName}, ayah ${input.surah}:${input.ayah}.`,
    'Its words, each split into segments with their morphology from the Quranic Arabic Corpus:',
    wordLines.join('\n'),
    input.translation
      ? `A published translation, only to help you follow the wording (do not comment on it):\n${input.translation}`
      : null,
    'Write the linguistic notes for this ayah.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

/**
 * Reads the model's JSON answer. Drops what a reviewer could not use: empty notes, notes on words
 * the ayah lacks and second notes on the same word.
 */
export function parseDraft(json: string, wordCount: number): DraftNote[] {
  const data = JSON.parse(json) as { notes?: { word?: unknown; text?: unknown }[] };
  if (!Array.isArray(data.notes)) throw new Error('The draft has no notes list');
  const seen = new Set<number>();
  const notes: DraftNote[] = [];
  for (const { word, text } of data.notes) {
    if (typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > wordCount)
      continue;
    if (typeof text !== 'string' || !text.trim() || seen.has(word)) continue;
    seen.add(word);
    notes.push({ word: word === 0 ? null : word, text: text.trim() });
  }
  return notes;
}

/**
 * Files an ayah's new drafts: the ayah's earlier drafts are replaced, its reviewed (approved or
 * rejected) notes are kept as they are, and a draft on a reviewed ayah or word is dropped.
 */
export function mergeDrafts(
  file: NotesFile,
  ayah: number,
  drafts: DraftNote[],
  draftedBy: string,
): NotesFile {
  const kept = file.notes.filter((n) => n.ayah !== ayah || n.status !== 'draft');
  const reviewed = new Set(kept.filter((n) => n.ayah === ayah).map((n) => n.word));
  const added = drafts
    .filter((d) => !reviewed.has(d.word))
    .map((d): AuthoredNote => ({
      ayah,
      word: d.word,
      text: d.text,
      status: 'draft',
      reviewer: null,
      draftedBy,
    }));
  return { ...file, notes: [...kept, ...added].sort(byPosition) };
}

export type DraftSelection = {
  /** Also draft ayahs that already have notes (reviewed notes are still kept). */
  redraft?: boolean;
  /** Keep to one surah. */
  surah?: number;
  /** Draft at most this many ayahs. */
  limit?: number;
};

/** The path ayahs to draft, in path order: by default those with no notes at all yet. */
export function ayahsToDraft<A extends { surah: number; ayah: number }>(
  path: A[],
  files: Map<number, NotesFile>,
  { redraft = false, surah, limit }: DraftSelection,
): A[] {
  const selected = path.filter(
    (a) =>
      (surah === undefined || a.surah === surah) &&
      (redraft || !files.get(a.surah)?.notes.some((n) => n.ayah === a.ayah)),
  );
  return limit === undefined ? selected : selected.slice(0, limit);
}
