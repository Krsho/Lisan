import { dateChrono, defineScheduler, type Grade } from 'ts-fsrs';
import {
  schedulerDesiredRetentionMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
} from 'ts-fsrs/middlewares';
import { FSRS6_DEFAULT_WEIGHTS, FSRS6Model } from 'ts-fsrs/models/fsrs-6';

import { chronological, RATING, type LogEvent, type WordRef } from './events';

// FSRS-6 with its default weights, built synchronously (DefaultScheduler loads the model with a
// dynamic import). Fuzz is off, so replaying the same log gives the same schedule on every device.
const scheduler = defineScheduler({ model: FSRS6Model, chrono: dateChrono })
  .use(schedulerDesiredRetentionMiddleware)
  .use(schedulerStatsMiddleware)
  .use(schedulerLearningStepsMiddleware)
  .use(schedulerMaximumIntervalMiddleware)
  .use(schedulerScheduledDaysMiddleware)
  .create({
    // The config type is generic; ts-fsrs validates it when the scheduler is created.
    config: {
      weights: FSRS6_DEFAULT_WEIGHTS,
      // A once-a-day app: no same-day learning steps, so every answer schedules a day or more out.
      enableShortTerm: false,
      numRelearningSteps: 1,
      fractionalDays: false,
      desiredRetention: 0.9,
      maximumInterval: 36500,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      graduatingInterval: 1,
      allowModelOverride: false,
      enableFuzz: false,
      clearStatsOnForget: true,
    } as never,
  });

type FsrsCard = ReturnType<typeof scheduler.newCard>;

/** FSRS's new / learning / review / relearning states. */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

const STATES: CardState[] = ['new', 'learning', 'review', 'relearning'];

/** A lemma's review card: one per lemma, whichever word forms it was quizzed in. */
export type LemmaCard = {
  lemmaId: string;
  /** The word form the card shows, with its ayah as context: where the lemma was learned. */
  wordRef: WordRef;
  /** When the card is next due, in epoch milliseconds. */
  due: number;
  state: CardState;
  /** How many reviews (quiz answers included) it has had; 0 for a new card. */
  reps: number;
  /** How many times it was forgotten after being learned. */
  lapses: number;
  stability: number;
  difficulty: number;
  /** When it was last reviewed, in epoch milliseconds; null if it never was. */
  lastReview: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an event puts its lemma in the review deck. Every lemma event does (learned in a
 * session, answered in a quiz or review, or added to review some other way), except "I know this"
 * and taking it back, which say nothing about having learned the lemma.
 */
export function entersReview(event: LogEvent): event is Extract<LogEvent, { lemmaId: string }> {
  return event.lemmaId !== null && event.kind !== 'known' && event.kind !== 'known-undone';
}

/**
 * Every lemma's card, derived by replaying the log's review events through FSRS in order. A lemma
 * in the deck with no review yet (learned, but the quiz was left before its question; or added to
 * review) has a new card, due from when it entered the deck, so it is never silently lost. Lemmas
 * marked "I know this" keep their card here; the session leaves them out. Cards are never stored,
 * so merged logs reschedule consistently.
 */
export function lemmaCards(log: LogEvent[]): Map<string, LemmaCard> {
  const ordered = chronological(log);
  // When each lemma entered the deck, and the word form its card shows: where the lemma was first
  // met (learned or added), or else where it was first asked.
  const entered = new Map<string, { wordRef: WordRef; timestamp: number; met: boolean }>();
  for (const event of ordered) {
    if (!entersReview(event)) continue;
    const met = event.kind !== 'review';
    const first = entered.get(event.lemmaId);
    if (!first) {
      entered.set(event.lemmaId, { wordRef: event.wordRef, timestamp: event.timestamp, met });
    } else if (met && !first.met) {
      entered.set(event.lemmaId, { ...first, wordRef: event.wordRef, met });
    }
  }
  const cards = new Map<string, FsrsCard>();
  for (const event of ordered) {
    if (event.kind !== 'review') continue;
    const now = new Date(event.timestamp);
    // Cards are keyed by lemma here. ts-fsrs only gives cards ids of its own (with crypto, which
    // Hermes lacks) in its fuzzing middleware, which is not used.
    const current = cards.get(event.lemmaId);
    // A card's first answer (usually the quiz on the day it was learned) counts as good at best:
    // a quick right answer then shows the word was just seen, not that it is known.
    const grade = current ? event.rating : Math.min(event.rating, RATING.good);
    const { card } = scheduler.review({
      card: current ?? scheduler.newCard({ now }),
      grade: grade as Grade,
      now,
    });
    cards.set(event.lemmaId, card);
  }

  const result = new Map<string, LemmaCard>();
  for (const [lemmaId, { wordRef, timestamp }] of entered) {
    const card = cards.get(lemmaId);
    result.set(
      lemmaId,
      card
        ? {
            lemmaId,
            wordRef,
            due: card.dueAt.getTime(),
            state: STATES[card.state],
            reps: card.reps,
            lapses: card.lapses,
            stability: card.stability,
            difficulty: card.difficulty,
            lastReview: card.lastReviewAt?.getTime() ?? null,
          }
        : {
            lemmaId,
            wordRef,
            due: timestamp,
            state: 'new',
            reps: 0,
            lapses: 0,
            stability: 0,
            difficulty: 0,
            lastReview: null,
          },
    );
  }
  return result;
}

/**
 * How likely (0 to 1) the learner still recalls the card's lemma at `time`, by FSRS's forgetting
 * curve. A card never reviewed has never been recalled, so it is 0.
 */
export function retrievability(card: LemmaCard, time: number): number {
  if (card.lastReview === null || card.stability <= 0) return 0;
  const elapsedDays = Math.max(0, time - card.lastReview) / DAY_MS;
  return scheduler.model.forgettingCurve(
    { stability: card.stability, difficulty: card.difficulty } as never,
    elapsedDays,
  );
}
