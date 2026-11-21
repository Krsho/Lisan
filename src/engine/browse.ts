import { lemmaCards } from './cards';
import type { EventDraft, LogEvent } from './events';
import { knownLemmas, learnedLemmas, type PathAyah } from './session';
import { stamp, type Now } from './time';

/** Any ayah of the Quran with the lemmas of each of its words (on the curated path or not). */
export type AyahLemmas = PathAyah;

/**
 * "Add this ayah to my review": the events that bring the ayah's lemmas into the review deck as
 * new cards, due now, each in the first word form where it appears in the ayah. Lemmas already in
 * the deck (learned on the path, reviewed or added before) and lemmas marked "I know this" are
 * left out, so an empty result means there is nothing more to add from this ayah. Browsing never
 * changes learning state by itself: only recording these events does, and they leave the curated
 * path where it was.
 */
export function addAyahToReview(ayah: AyahLemmas, log: LogEvent[], now: Now): EventDraft[] {
  const skip = new Set([...lemmaCards(log).keys(), ...learnedLemmas(log), ...knownLemmas(log)]);
  const drafts: EventDraft[] = [];
  for (const word of ayah.words) {
    for (const lemmaId of word.lemmas) {
      if (skip.has(lemmaId)) continue;
      skip.add(lemmaId);
      drafts.push({
        kind: 'added',
        lemmaId,
        wordRef: { surah: ayah.surah, ayah: ayah.ayah, word: word.position },
        ...stamp(now),
      });
    }
  }
  return drafts;
}
