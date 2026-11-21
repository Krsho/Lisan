import { chronological, type EventDraft, type ReviewEvent, type WordRef } from './events';

/** The moment to plan for, with the learner's UTC offset there, which sets where a day begins. */
export type Now = { time: number; utcOffsetMinutes: number };

/** An ayah on the curated path, with the lemmas of each of its words. */
export type PathAyah = {
  surah: number;
  ayah: number;
  words: { position: number; lemmas: string[] }[];
};

/** What the engine plans with: the curated path in study order. */
export type Content = { path: PathAyah[] };

export type Pace = 'light' | 'normal' | 'intense';

export type Settings = { pace: Pace };

export const DEFAULT_SETTINGS: Settings = { pace: 'normal' };

/** How many new lemmas a session introduces at each pace. */
export const NEW_LEMMA_BUDGET: Record<Pace, number> = { light: 10, normal: 15, intense: 25 };

/** Words `fromWord` to `toWord` (inclusive) of one ayah, studied as new material. */
export type Passage = {
  surah: number;
  ayah: number;
  fromWord: number;
  toWord: number;
  /** How many words the whole ayah has, to tell part of an ayah from all of it. */
  ayahWords: number;
};

/** A lemma new to the learner, in the word form where the session first meets it. */
export type NewLemma = { lemmaId: string; wordRef: WordRef };

export type SessionPlan = {
  /** The next stretch of the path, in order. Empty once the path is finished. */
  newMaterial: Passage[];
  /** The lemmas the new material introduces, in order of first appearance. */
  newLemmas: NewLemma[];
  /** Whether a session was already completed today (the learner's local day). */
  completedToday: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The learner's local day number, counted from the epoch. */
const localDay = (time: number, utcOffsetMinutes: number) =>
  Math.floor((time + utcOffsetMinutes * 60_000) / DAY_MS);

/** The lemmas the learner marked "I know this" and has not taken back. */
export function knownLemmas(log: ReviewEvent[]): Set<string> {
  const known = new Set<string>();
  for (const event of chronological(log)) {
    if (event.kind === 'known') known.add(event.lemmaId);
    else if (event.kind === 'known-undone') known.delete(event.lemmaId);
  }
  return known;
}

/** The lemmas met as new material in completed sessions. */
export function learnedLemmas(log: ReviewEvent[]): Set<string> {
  return new Set(log.flatMap((e) => (e.kind === 'learn' ? [e.lemmaId] : [])));
}

const refKey = ({ surah, ayah, word }: WordRef) => `${surah}:${ayah}:${word}`;

/** Where the next session starts: the word after the furthest one any completed session reached. */
function pathStart(path: PathAyah[], log: ReviewEvent[]): { ayah: number; word: number } {
  const index = new Map<string, { ayah: number; word: number }>();
  path.forEach((a, ayah) =>
    a.words.forEach((w, word) =>
      index.set(refKey({ surah: a.surah, ayah: a.ayah, word: w.position }), { ayah, word }),
    ),
  );
  let furthest: { ayah: number; word: number } | null = null;
  for (const event of log) {
    if (event.kind !== 'completed') continue;
    // A word no longer on the path (the content changed) says nothing about progress.
    const at = index.get(refKey(event.wordRef));
    if (
      at &&
      (!furthest ||
        at.ayah > furthest.ayah ||
        (at.ayah === furthest.ayah && at.word > furthest.word))
    )
      furthest = at;
  }
  if (!furthest) return { ayah: 0, word: 0 };
  const isLastWord = furthest.word === path[furthest.ayah].words.length - 1;
  return isLastWord
    ? { ayah: furthest.ayah + 1, word: 0 }
    : { ...furthest, word: furthest.word + 1 };
}

/**
 * Plans today's session: the next ayah(s) on the path, as many whole ayahs as fit in the pace's
 * new-lemma budget. Lemmas already learned or marked "I know this" are not new and cost nothing.
 * An ayah too long for the budget on its own is split at a word, and continued the next day.
 */
export function planSession(
  content: Content,
  log: ReviewEvent[],
  settings: Settings,
  now: Now,
): SessionPlan {
  const budget = NEW_LEMMA_BUDGET[settings.pace];
  const { path } = content;
  const notNew = new Set([...learnedLemmas(log), ...knownLemmas(log)]);
  const newMaterial: Passage[] = [];
  const newLemmas: NewLemma[] = [];

  const start = pathStart(path, log);
  for (let i = start.ayah; i < path.length; i++) {
    const { surah, ayah, words } = path[i];
    const rest = words.slice(i === start.ayah ? start.word : 0);
    const met = new Set(notNew);
    const introduced: NewLemma[] = [];
    for (const w of rest) {
      for (const lemmaId of w.lemmas) {
        if (met.has(lemmaId)) continue;
        met.add(lemmaId);
        introduced.push({ lemmaId, wordRef: { surah, ayah, word: w.position } });
      }
    }

    if (newLemmas.length + introduced.length <= budget) {
      newMaterial.push({
        surah,
        ayah,
        fromWord: rest[0].position,
        toWord: rest[rest.length - 1].position,
        ayahWords: words.length,
      });
      newLemmas.push(...introduced);
      introduced.forEach((l) => notNew.add(l.lemmaId));
      continue;
    }

    // Only the first ayah of a session is split: later ones wait whole for the next day.
    if (newMaterial.length === 0) {
      let taken = 0;
      while (taken < rest.length) {
        const position = rest[taken].position;
        const fromWord = introduced.filter((l) => l.wordRef.word === position);
        // At least one word, even if that word alone is over budget.
        if (taken > 0 && newLemmas.length + fromWord.length > budget) break;
        newLemmas.push(...fromWord);
        taken++;
      }
      newMaterial.push({
        surah,
        ayah,
        fromWord: rest[0].position,
        toWord: rest[taken - 1].position,
        ayahWords: words.length,
      });
    }
    break;
  }

  const today = localDay(now.time, now.utcOffsetMinutes);
  const completedToday = log.some(
    (e) => e.kind === 'completed' && localDay(e.timestamp, now.utcOffsetMinutes) === today,
  );

  return { newMaterial, newLemmas, completedToday };
}

/**
 * The events that record a finished session: each planned new lemma as learned (unless the learner
 * has marked it "I know this" by now), and how far along the path the session went.
 */
export function completeSession(plan: SessionPlan, log: ReviewEvent[], now: Now): EventDraft[] {
  const last = plan.newMaterial[plan.newMaterial.length - 1];
  if (!last) return [];
  const known = knownLemmas(log);
  const timestamp = now.time;
  return [
    ...plan.newLemmas
      .filter((l) => !known.has(l.lemmaId))
      .map((l): EventDraft => ({
        kind: 'learn',
        lemmaId: l.lemmaId,
        wordRef: l.wordRef,
        timestamp,
      })),
    {
      kind: 'completed',
      lemmaId: null,
      wordRef: { surah: last.surah, ayah: last.ayah, word: last.toWord },
      timestamp,
    },
  ];
}

/** "I know this" on a lemma, seen in the word at `wordRef`. */
export function markKnown(lemmaId: string, wordRef: WordRef, now: Now): EventDraft {
  return { kind: 'known', lemmaId, wordRef, timestamp: now.time };
}

/** Takes back "I know this" on a lemma. */
export function undoKnown(lemmaId: string, wordRef: WordRef, now: Now): EventDraft {
  return { kind: 'known-undone', lemmaId, wordRef, timestamp: now.time };
}
