import { lemmaCards, retrievability, type LemmaCard } from './cards';
import {
  byId,
  chronological,
  EVENT_KINDS,
  wordRefKey,
  type EventDraft,
  type LogEvent,
  type WordRef,
} from './events';
import { eventDay, localDay, stamp, type Now } from './time';

/**
 * A run of words in one ayah, by word position (1-based, inclusive): a part of a long ayah, or the
 * words a session studies.
 */
export type WordRange = { fromWord: number; toWord: number };

/** An ayah on the curated path, with the lemmas of each of its words. */
export type PathAyah = {
  surah: number;
  ayah: number;
  words: { position: number; lemmas: string[] }[];
  /**
   * For a long ayah, the parts the content build splits it into (in order, covering every word):
   * a session splits an ayah only between them. An ayah without parts is studied whole.
   */
  parts?: WordRange[];
};

/** What the engine plans with: the curated path in study order. */
export type Content = { path: PathAyah[] };

export type Pace = 'light' | 'normal' | 'intense';

/** What of the learner's settings planning a session depends on. */
export type PlanSettings = { pace: Pace };

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { pace: 'normal' };

/** How many new lemmas a session introduces at each pace. */
export const NEW_LEMMA_BUDGET: Record<Pace, number> = { light: 10, normal: 15, intense: 25 };

/**
 * At most this many words are studied in a session, at each pace (three times its new-lemma
 * budget), so that a run of ayahs whose words are all learned or known, which cost nothing from
 * the budget, still makes a session of about the usual length.
 */
export const SESSION_WORD_LIMIT: Record<Pace, number> = { light: 30, normal: 45, intense: 75 };

/** Words `fromWord` to `toWord` (inclusive) of one ayah, studied as new material. */
export type Passage = WordRange & {
  surah: number;
  ayah: number;
  /** How many words the whole ayah has, to tell part of an ayah from all of it. */
  ayahWords: number;
};

/** A lemma new to the learner, in the word form where the session first meets it. */
export type NewLemma = { lemmaId: string; wordRef: WordRef };

/** A lemma's card to review today, in the word form the card shows (its ayah is the context). */
export type ReviewCard = { lemmaId: string; wordRef: WordRef };

/** At most this many cards are reviewed in a session, however many are due. */
export const REVIEW_LIMIT = 15;

/**
 * Of those, at most this many are cards never reviewed yet while cards already reviewed are due
 * (more when fewer of those are due).
 */
export const NEVER_REVIEWED_LIMIT = 5;

/** After this many days without a session, the next one opens with a recap. */
export const RECAP_GAP_DAYS = 7;

/** How many of the last studied ayahs a recap shows. */
export const RECAP_AYAHS = 3;

export type SessionPlan = {
  /**
   * The cards to review first (see dueReviews for the order): at most REVIEW_LIMIT. Cards
   * due beyond the limit wait, unannounced, so missed days never show as a backlog.
   */
  reviews: ReviewCard[];
  /**
   * After a gap of RECAP_GAP_DAYS or more, the last few ayahs studied (the words of them studied),
   * to read again before the new material. Empty otherwise.
   */
  recap: Passage[];
  /** The next stretch of the path, in order. Empty once the path is finished. */
  newMaterial: Passage[];
  /** The lemmas the new material introduces, in order of first appearance. */
  newLemmas: NewLemma[];
  /** Whether a session was already completed today (the learner's local day). */
  completedToday: boolean;
};

/** The lemmas the learner marked "I know this" and has not taken back. */
export function knownLemmas(log: LogEvent[]): Set<string> {
  const known = new Set<string>();
  for (const event of chronological(log)) {
    if (event.kind === 'known') known.add(event.lemmaId);
    else if (event.kind === 'known-undone') known.delete(event.lemmaId);
  }
  return known;
}

/** The lemmas met as new material in completed sessions. */
export function learnedLemmas(log: LogEvent[]): Set<string> {
  return new Set(log.flatMap((e) => (e.kind === 'learn' ? [e.lemmaId] : [])));
}

/** A place on the path: the index of an ayah in it, and of a word in that ayah (both from 0). */
export type PathPoint = { ayah: number; word: number };

const isAfter = (a: PathPoint, b: PathPoint) =>
  a.ayah > b.ayah || (a.ayah === b.ayah && a.word > b.word);

export type PathPosition = {
  /**
   * Where the next session starts: the word after the furthest one any completed session reached,
   * or the chosen start point if that is further. `ayah` is path.length once the path is finished.
   */
  next: PathPoint;
  /** The ayah the learner chose to start at (0 if they never chose): the ones before are skipped. */
  chosenStart: number;
};

/** How far along the path the learner is, from the completed sessions and a chosen start point. */
export function pathPosition(path: PathAyah[], log: LogEvent[]): PathPosition {
  const index = new Map<string, PathPoint>();
  path.forEach((a, ayah) =>
    a.words.forEach((w, word) =>
      index.set(wordRefKey({ surah: a.surah, ayah: a.ayah, word: w.position }), { ayah, word }),
    ),
  );
  let furthest: PathPoint | null = null;
  let chosen: PathPoint | null = null;
  for (const event of chronological(log)) {
    // A word no longer on the path (the content changed) says nothing about progress.
    const at = index.get(wordRefKey(event.wordRef));
    if (!at) continue;
    if (event.kind === 'completed' && (!furthest || isAfter(at, furthest))) furthest = at;
    // The latest choice holds.
    else if (event.kind === 'start') chosen = at;
  }
  let next: PathPoint = { ayah: 0, word: 0 };
  if (furthest) {
    const isLastWord = furthest.word === path[furthest.ayah].words.length - 1;
    next = isLastWord
      ? { ayah: furthest.ayah + 1, word: 0 }
      : { ...furthest, word: furthest.word + 1 };
  }
  // A start point behind what is studied already is not a reason to study it again.
  if (chosen && isAfter(chosen, next)) next = chosen;
  return { next, chosenStart: chosen?.ayah ?? 0 };
}

/**
 * "Start at this surah": the learner skips the path up to its first ayah on the path (the
 * onboarding's optional later start point). Null if the surah is not on the path.
 */
export function chooseStart(content: Content, surah: number, now: Now): EventDraft | null {
  const first = content.path.find((a) => a.surah === surah);
  if (!first || first.words.length === 0) return null;
  return {
    kind: 'start',
    lemmaId: null,
    wordRef: { surah, ayah: first.ayah, word: first.words[0].position },
    ...stamp(now),
  };
}

/**
 * Plans today's session: the next ayah(s) on the path, as many whole ayahs as fit in the pace's
 * new-lemma budget and its word limit. Lemmas already learned or marked "I know this" are not new
 * and cost nothing from the budget.
 * An ayah too long for the budget on its own is split between its parts, and continued from the
 * next part the next day; a part (or an ayah without parts) is taken whole, even over the budget.
 */
export function planSession(
  content: Content,
  log: LogEvent[],
  settings: PlanSettings,
  now: Now,
): SessionPlan {
  const budget = NEW_LEMMA_BUDGET[settings.pace];
  const wordLimit = SESSION_WORD_LIMIT[settings.pace];
  let studiedWords = 0;
  const { path } = content;
  const notNew = new Set([...learnedLemmas(log), ...knownLemmas(log)]);
  const newMaterial: Passage[] = [];
  const newLemmas: NewLemma[] = [];

  const position = pathPosition(path, log);
  const start = position.next;
  for (let i = start.ayah; i < path.length; i++) {
    const { surah, ayah, words, parts } = path[i];
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

    if (newLemmas.length + introduced.length <= budget && studiedWords + rest.length <= wordLimit) {
      newMaterial.push({
        surah,
        ayah,
        fromWord: rest[0].position,
        toWord: rest[rest.length - 1].position,
        ayahWords: words.length,
      });
      newLemmas.push(...introduced);
      introduced.forEach((l) => notNew.add(l.lemmaId));
      studiedWords += rest.length;
      continue;
    }

    // Only the first ayah of a session is split: later ones wait whole for the next day.
    if (newMaterial.length === 0) {
      // The rest of the ayah's parts (from where the session starts, which may be within one).
      const partEnds = (parts ?? [])
        .map((p) => p.toWord)
        .filter((end) => end >= rest[0].position && end < rest[rest.length - 1].position);
      const units: (typeof rest)[] = [];
      let from = 0;
      for (const end of [...partEnds, rest[rest.length - 1].position]) {
        const to = rest.findIndex((w) => w.position === end) + 1;
        units.push(rest.slice(from, to));
        from = to;
      }
      let taken = 0;
      for (const unit of units) {
        const unitLemmas = introduced.filter((l) =>
          unit.some((w) => w.position === l.wordRef.word),
        );
        // At least one part, even if that part alone is over budget.
        const fits =
          newLemmas.length + unitLemmas.length <= budget && taken + unit.length <= wordLimit;
        if (taken > 0 && !fits) break;
        newLemmas.push(...unitLemmas);
        taken += unit.length;
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
    (e) => e.kind === 'completed' && eventDay(e, now.utcOffsetMinutes) === today,
  );

  return {
    reviews: dueReviews(log, now),
    recap: recapFor(path, log, position, now),
    newMaterial,
    newLemmas,
    completedToday,
  };
}

/**
 * The cards due now, capped at REVIEW_LIMIT, with at most NEVER_REVIEWED_LIMIT cards never
 * reviewed yet (added from browse, or learned but left unquizzed) while reviewed cards are due,
 * so that they never crowd out learned words that are slipping. Never-reviewed cards come first,
 * oldest first; then reviewed cards, lowest retrievability first (among equals the longest
 * overdue). Slots one group leaves spare go to the other. "I know this" lemmas are never reviewed.
 */
function dueReviews(log: LogEvent[], now: Now): ReviewCard[] {
  const known = knownLemmas(log);
  const due = [...lemmaCards(log).values()].filter(
    (c) => c.due <= now.time && !known.has(c.lemmaId),
  );
  const byDue = (a: LemmaCard, b: LemmaCard) => a.due - b.due || byId(a.lemmaId, b.lemmaId);
  const fresh = due.filter((c) => c.lastReview === null).sort(byDue);
  const reviewed = due
    .filter((c) => c.lastReview !== null)
    .map((card) => ({ card, risk: retrievability(card, now.time) }))
    .sort((a, b) => a.risk - b.risk || byDue(a.card, b.card))
    .map(({ card }) => card);

  const freshCount = Math.min(
    fresh.length,
    Math.max(NEVER_REVIEWED_LIMIT, REVIEW_LIMIT - reviewed.length),
  );
  return [...fresh.slice(0, freshCount), ...reviewed.slice(0, REVIEW_LIMIT - freshCount)].map(
    (card) => ({ lemmaId: card.lemmaId, wordRef: card.wordRef }),
  );
}

/**
 * The last RECAP_AYAHS ayahs studied before `start`, if the last session (a completed one, or
 * answering reviews) was RECAP_GAP_DAYS or more local days ago.
 */
function recapFor(
  path: PathAyah[],
  log: LogEvent[],
  { next: start, chosenStart }: PathPosition,
  now: Now,
): Passage[] {
  const sessions = log.filter((e) => EVENT_KINDS[e.kind].isSession);
  if (sessions.length === 0) return [];
  const last = Math.max(...sessions.map((e) => eventDay(e, now.utcOffsetMinutes)));
  const gap = localDay(now.time, now.utcOffsetMinutes) - last;
  if (gap < RECAP_GAP_DAYS) return [];

  const studied: Passage[] = [];
  const through = start.word > 0 ? start.ayah : start.ayah - 1;
  // Ayahs skipped by choosing a later start point were never studied, so are not recapped.
  for (let i = Math.max(chosenStart, through - RECAP_AYAHS + 1); i <= through; i++) {
    const { surah, ayah, words } = path[i];
    const upTo = i === start.ayah ? start.word : words.length;
    studied.push({
      surah,
      ayah,
      fromWord: words[0].position,
      toWord: words[upTo - 1].position,
      ayahWords: words.length,
    });
  }
  return studied;
}

/**
 * The events that record a finished session: each planned new lemma as learned (unless the learner
 * has marked it "I know this" by now), and how far along the path the session went.
 */
export function completeSession(plan: SessionPlan, log: LogEvent[], now: Now): EventDraft[] {
  const last = plan.newMaterial[plan.newMaterial.length - 1];
  if (!last) return [];
  const known = knownLemmas(log);
  const at = stamp(now);
  return [
    ...plan.newLemmas
      .filter((l) => !known.has(l.lemmaId))
      .map((l): EventDraft => ({ kind: 'learn', lemmaId: l.lemmaId, wordRef: l.wordRef, ...at })),
    {
      kind: 'completed',
      lemmaId: null,
      wordRef: { surah: last.surah, ayah: last.ayah, word: last.toWord },
      ...at,
    },
  ];
}

/** "I know this" on a lemma, seen in the word at `wordRef`. */
export function markKnown(lemmaId: string, wordRef: WordRef, now: Now): EventDraft {
  return {
    kind: 'known',
    lemmaId,
    wordRef,
    ...stamp(now),
  };
}

/** Takes back "I know this" on a lemma. */
export function undoKnown(lemmaId: string, wordRef: WordRef, now: Now): EventDraft {
  return {
    kind: 'known-undone',
    lemmaId,
    wordRef,
    ...stamp(now),
  };
}
