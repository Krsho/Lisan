import { dateChrono, defineScheduler, type Grade } from 'ts-fsrs';
import {
  schedulerDesiredRetentionMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
} from 'ts-fsrs/middlewares';
import { FSRS6_DEFAULT_WEIGHTS, FSRS6Model } from 'ts-fsrs/models/fsrs-6';

import { chronological, type ReviewEvent, type WordRef } from './events';

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
      enableShortTerm: true,
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
  /** How many reviews (quiz answers included) it has had. */
  reps: number;
  /** How many times it was forgotten after being learned. */
  lapses: number;
  stability: number;
  difficulty: number;
  /** When it was last reviewed, in epoch milliseconds. */
  lastReview: number;
};

/**
 * Every lemma's card, derived by replaying the log's review events through FSRS in order. Only
 * reviewed lemmas have a card; cards are never stored, so merged logs reschedule consistently.
 */
export function lemmaCards(log: ReviewEvent[]): Map<string, LemmaCard> {
  const ordered = chronological(log);
  const learnedAt = new Map<string, WordRef>();
  for (const event of ordered) {
    if (event.kind === 'learn' && !learnedAt.has(event.lemmaId)) {
      learnedAt.set(event.lemmaId, event.wordRef);
    }
  }
  const cards = new Map<string, { card: FsrsCard; wordRef: WordRef }>();
  for (const event of ordered) {
    if (event.kind !== 'review') continue;
    const now = new Date(event.timestamp);
    // Cards are keyed by lemma here. ts-fsrs only gives cards ids of its own (with crypto, which
    // Hermes lacks) in its fuzzing middleware, which is not used.
    const current = cards.get(event.lemmaId)?.card ?? scheduler.newCard({ now });
    const { card } = scheduler.review({ card: current, grade: event.rating as Grade, now });
    cards.set(event.lemmaId, {
      card,
      wordRef: cards.get(event.lemmaId)?.wordRef ?? learnedAt.get(event.lemmaId) ?? event.wordRef,
    });
  }

  const result = new Map<string, LemmaCard>();
  for (const [lemmaId, { card, wordRef }] of cards) {
    result.set(lemmaId, {
      lemmaId,
      wordRef,
      due: card.dueAt.getTime(),
      state: STATES[card.state],
      reps: card.reps,
      lapses: card.lapses,
      stability: card.stability,
      difficulty: card.difficulty,
      lastReview: card.lastReviewAt?.getTime() ?? card.dueAt.getTime(),
    });
  }
  return result;
}
