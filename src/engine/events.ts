/** A word's place in the Quran: surah, ayah and word position (from 1). */
export type WordRef = { surah: number; ayah: number; word: number };

type EventBase = {
  /** Unique id (a UUID), so that merging logs from several devices can drop duplicates. */
  id: string;
  /** When it happened, in epoch milliseconds. */
  timestamp: number;
  /** The device that recorded it. */
  deviceId: string;
  /**
   * The device's UTC offset when it happened, in minutes, which says which local day it was on:
   * a session in Tokyo stays on Tokyo's date after flying to New York. Absent on events recorded
   * before the offset was stored; they fall back to the learner's current offset.
   */
  utcOffsetMinutes?: number;
};

/** A lemma met as new material in a completed session, in the word form where it appeared. */
export type LearnEvent = EventBase & { kind: 'learn'; lemmaId: string; wordRef: WordRef };

/** "I know this": the lemma is never new material (and, later, never reviewed). */
export type KnownEvent = EventBase & { kind: 'known'; lemmaId: string; wordRef: WordRef };

/** Takes back an earlier "I know this" for the lemma. */
export type KnownUndoneEvent = EventBase & {
  kind: 'known-undone';
  lemmaId: string;
  wordRef: WordRef;
};

/**
 * "Add this ayah to my review" while browsing: the lemma enters the review deck as a new card, due
 * at once, in the word form where it was added. It says nothing about the curated path.
 */
export type AddedEvent = EventBase & { kind: 'added'; lemmaId: string; wordRef: WordRef };

/** A session was completed: the path is studied up to and including this word. */
export type CompletedEvent = EventBase & { kind: 'completed'; lemmaId: null; wordRef: WordRef };

/**
 * The learner chose to start the path at this word (the first of a surah's ayahs on it) instead of
 * at the beginning: the path before it is skipped, not studied.
 */
export type StartEvent = EventBase & { kind: 'start'; lemmaId: null; wordRef: WordRef };

/** FSRS's four ratings: 1 again, 2 hard, 3 good, 4 easy. */
export type Rating = 1 | 2 | 3 | 4;

export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const;

/**
 * A quiz or review answer on a lemma, in the word form it was asked in. The rating comes from
 * correctness and speed (gradeAnswer): learners never grade themselves.
 */
export type GradedEvent = EventBase & {
  kind: 'review';
  lemmaId: string;
  wordRef: WordRef;
  rating: Rating;
  correct: boolean;
  responseTimeMs: number;
};

/**
 * One entry of the learner's append-only log. Everything about progress (path position, learned
 * and known lemmas, and later card state and streaks) is derived from the log; nothing else is
 * stored, so logs from several devices can be merged by union.
 */
export type LogEvent =
  | LearnEvent
  | KnownEvent
  | KnownUndoneEvent
  | AddedEvent
  | CompletedEvent
  | StartEvent
  | GradedEvent;

export type EventKind = LogEvent['kind'];

type KindTraits = {
  /** Whether its events are about a lemma (lemmaId is set); the others have lemmaId null. */
  hasLemma: boolean;
  /**
   * Whether it puts its lemma in the review deck: learned in a session, answered in a quiz or
   * review, or added to review. "I know this" and taking it back say nothing about having
   * learned the lemma.
   */
  entersReview: boolean;
  /** Whether it is part of a daily session (completing one, or answering a review or quiz). */
  isSession: boolean;
};

/** What each kind of event is, in one place for the engine and the user store. */
export const EVENT_KINDS: Record<EventKind, KindTraits> = {
  learn: { hasLemma: true, entersReview: true, isSession: false },
  known: { hasLemma: true, entersReview: false, isSession: false },
  'known-undone': { hasLemma: true, entersReview: false, isSession: false },
  added: { hasLemma: true, entersReview: true, isSession: false },
  completed: { hasLemma: false, entersReview: false, isSession: true },
  start: { hasLemma: false, entersReview: false, isSession: false },
  review: { hasLemma: true, entersReview: true, isSession: true },
};

/** Whether `kind` is one this app version knows (a newer one may have synced others). */
export const isEventKind = (kind: string): kind is EventKind =>
  Object.prototype.hasOwnProperty.call(EVENT_KINDS, kind);

type Draft<E> = E extends LogEvent ? Omit<E, 'id' | 'deviceId'> : never;

/** An event the engine decided on, before the user store gives it an id and the device id. */
export type EventDraft = Draft<LogEvent>;

/** Orders ids (or any strings) the same on every device, whatever its locale. */
export const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A word's place as a map key, e.g. "1:2:3". */
export const wordRefKey = ({ surah, ayah, word }: WordRef) => `${surah}:${ayah}:${word}`;

/** Events in the order they happened; ties (same millisecond) broken by id, so on every device alike. */
export function chronological<E extends { timestamp: number; id: string }>(events: E[]): E[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp || byId(a.id, b.id));
}
