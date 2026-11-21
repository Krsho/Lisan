import {
  completeSession,
  gradeAnswer,
  lemmaCards,
  markKnown,
  planReview,
  planSession,
  RATING,
  RECAP_GAP_DAYS,
  REVIEW_LIMIT,
  type EventDraft,
  type PathAyah,
  type QuizContent,
  type Rating,
  type ReviewEvent,
  type WordRef,
} from '.';

// A fixed clock: 21 November 2026, 09:00 UTC, in UTC.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number) => ({ time, utcOffsetMinutes: 0 });

// Ten ayahs of eight words, every word with a lemma of its own named after it: "1:3:5" is ayah 3,
// word 5. At the normal pace (about 15 new lemmas) a session studies one ayah.
const AYAHS = 10;
const WORDS = 8;
const lemmaAt = (ayah: number, word: number) => `1:${ayah}:${word}`;
const refOf = (lemmaId: string): WordRef => {
  const [surah, ayah, word] = lemmaId.split(':').map(Number);
  return { surah, ayah, word };
};
const path: PathAyah[] = Array.from({ length: AYAHS }, (_, a) => ({
  surah: 1,
  ayah: a + 1,
  words: Array.from({ length: WORDS }, (_, w) => ({
    position: w + 1,
    lemmas: [lemmaAt(a + 1, w + 1)],
  })),
}));
const lemmasOf = (ayah: number) => Array.from({ length: WORDS }, (_, w) => lemmaAt(ayah, w + 1));

// What questions are built from: every word is a noun on its own, with a meaning and a sample.
const quizContent: QuizContent = {
  words: path.flatMap((a) =>
    a.words.map((w) => ({
      ref: { surah: 1, ayah: a.ayah, word: w.position },
      bare: `word ${w.lemmas[0]}`,
      gloss: `meaning ${w.lemmas[0]}`,
      segments: [
        {
          text: `word ${w.lemmas[0]}`,
          lemma: w.lemmas[0],
          terms: ['pos.noun', 'case.genitive', 'number.singular'],
        },
      ],
    })),
  ),
  lemmas: path.flatMap((a) =>
    a.words.map((w) => ({
      lemmaId: w.lemmas[0],
      partOfSpeech: 'pos.noun',
      frequency: 10,
      sample: { bare: `word ${w.lemmas[0]}`, gloss: `meaning ${w.lemmas[0]}` },
    })),
  ),
};

let nextId = 0;
const record = (log: ReviewEvent[], drafts: EventDraft[]): ReviewEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as ReviewEvent),
];

const plan = (log: ReviewEvent[], time: number) =>
  planSession({ path }, log, { pace: 'normal' }, at(time));

/** Answers on these lemmas at `time`, rated as given (a quiz or review question on each). */
const answer = (lemmaIds: string[], rating: Rating, time: number): EventDraft[] =>
  lemmaIds.map((lemmaId) => ({
    kind: 'review',
    lemmaId,
    wordRef: refOf(lemmaId),
    rating,
    correct: rating !== RATING.again,
    responseTimeMs: 5_000,
    timestamp: time,
  }));

/**
 * The learner's session at `time`: the planned new material is studied and completed, and the
 * quiz on its lemmas answered as `rating` (or, with null, left before any question).
 */
function session(log: ReviewEvent[], time: number, rating: Rating | null = RATING.good) {
  const today = plan(log, time);
  const studied = record(log, completeSession(today, log, at(time)));
  if (rating === null) return studied;
  return record(
    studied,
    answer(
      today.newLemmas.map((l) => l.lemmaId),
      rating,
      time + 5 * MINUTE,
    ),
  );
}

/** A learner who studied ayahs 1–5 (40 lemmas) on days 0–4 and answered every quiz question. */
function fortyLearned(): ReviewEvent[] {
  let log: ReviewEvent[] = [];
  for (let day = 0; day < 5; day++) log = session(log, START + day * DAY);
  return log;
}

describe('the daily review', () => {
  it('reviews nothing for a new learner', () => {
    expect(plan([], START).reviews).toEqual([]);
  });

  it('does not review a card before it is due', () => {
    const log = session([], START, RATING.easy);

    expect(plan(log, START + DAY / 2).reviews).toEqual([]);
  });

  it('reviews a due card in the word form from its ayah', () => {
    const log = session([], START);

    const { reviews } = plan(log, START + 30 * DAY);
    expect(reviews.find((r) => r.lemmaId === lemmaAt(1, 3))).toEqual({
      lemmaId: lemmaAt(1, 3),
      wordRef: { surah: 1, ayah: 1, word: 3 },
    });
  });

  it(`reviews at most ${REVIEW_LIMIT} cards, however many are due`, () => {
    const { reviews } = plan(fortyLearned(), START + 30 * DAY);

    expect(reviews).toHaveLength(REVIEW_LIMIT);
    expect(new Set(reviews.map((r) => r.lemmaId)).size).toBe(REVIEW_LIMIT);
  });

  it('picks the cards most at risk of being forgotten first', () => {
    // Two lemmas of the last ayah were forgotten on day 6, so they are the weakest memories.
    const forgotten = [lemmaAt(5, 7), lemmaAt(5, 8)];
    const log = record(fortyLearned(), answer(forgotten, RATING.again, START + 6 * DAY));

    const { reviews } = plan(log, START + 30 * DAY);
    expect(
      reviews
        .slice(0, 2)
        .map((r) => r.lemmaId)
        .sort(),
    ).toEqual(forgotten.sort());
  });

  it('picks the most overdue of otherwise equal cards first', () => {
    let log = session([], START);
    log = session(log, START + 5 * DAY);

    // Ayah 1's words were last answered five days before ayah 2's.
    const order = plan(log, START + 20 * DAY).reviews.map((r) => r.wordRef.ayah);
    expect(order.slice(0, WORDS)).toEqual(Array(WORDS).fill(1));
    expect(order.slice(WORDS).every((a) => a === 2)).toBe(true);
  });

  it('never shows a backlog: ten missed days plan the same review as one', () => {
    const log = fortyLearned();

    const afterOneDay = plan(log, START + 6 * DAY);
    const afterTenDays = plan(log, START + 15 * DAY);

    expect(afterOneDay.reviews).toHaveLength(REVIEW_LIMIT);
    expect(afterTenDays.reviews).toHaveLength(REVIEW_LIMIT);
    // Nothing else in the plan grows with (or counts) the cards left waiting.
    expect(Object.keys(afterTenDays).sort()).toEqual(Object.keys(afterOneDay).sort());
    expect(afterTenDays.newMaterial).toEqual(afterOneDay.newMaterial);
    expect(afterTenDays.newLemmas).toEqual(afterOneDay.newLemmas);
  });

  it("does not bring today's quiz words back the same day, even when answered wrong", () => {
    const today = plan([], START);
    let log = record([], completeSession(today, [], at(START)));
    const [missed, ...rest] = today.newLemmas.map((l) => l.lemmaId);
    log = record(log, answer([missed], RATING.again, START + MINUTE));
    log = record(log, answer(rest, RATING.good, START + MINUTE));

    // "Keep going now", later the same day.
    expect(plan(log, START + 2 * 60 * MINUTE).reviews).toEqual([]);
    for (const card of lemmaCards(log).values())
      expect(card.due).toBeGreaterThanOrEqual(START + MINUTE + DAY);
  });

  it('reviews lemmas learned but never quizzed (the quiz was left early), first', () => {
    let log = session([], START, null);
    // Only the first three of ayah 1's words were answered before the learner left the quiz.
    const answered = lemmasOf(1).slice(0, 3);
    log = record(log, answer(answered, RATING.easy, START + MINUTE));

    const reviews = plan(log, START + DAY).reviews.map((r) => r.lemmaId);
    const unanswered = lemmasOf(1).filter((l) => !answered.includes(l));
    expect(reviews.sort()).toEqual(unanswered.sort());
  });

  it('reviews every learned lemma when the quiz was left before its first question', () => {
    const log = session([], START, null);

    expect(
      plan(log, START + DAY)
        .reviews.map((r) => r.lemmaId)
        .sort(),
    ).toEqual(lemmasOf(1).sort());
  });

  it('never reviews a lemma marked "I know this"', () => {
    let log = session([], START);
    log = record(log, [markKnown(lemmaAt(1, 2), refOf(lemmaAt(1, 2)), at(START + DAY))]);

    const reviews = plan(log, START + 30 * DAY).reviews.map((r) => r.lemmaId);
    expect(reviews).not.toContain(lemmaAt(1, 2));
    expect(reviews).toHaveLength(WORDS - 1);
  });

  it('reviews a lemma put in the deck by any other kind of event, such as adding from browse', () => {
    // Any lemma event other than "I know this" (and taking it back) puts its lemma in the deck.
    const added = {
      id: 'browse-1',
      deviceId: 'device-a',
      kind: 'added-from-browse',
      lemmaId: 'رَبّ',
      wordRef: { surah: 2, ayah: 21, word: 3 },
      timestamp: START,
    } as unknown as ReviewEvent;

    expect(plan([added], START + MINUTE).reviews).toEqual([
      { lemmaId: 'رَبّ', wordRef: { surah: 2, ayah: 21, word: 3 } },
    ]);
  });

  it('reviews a lemma added to review from a browsed ayah, due at once', () => {
    const added: ReviewEvent = {
      id: 'added-1',
      deviceId: 'device-a',
      kind: 'added',
      lemmaId: 'رَبّ',
      wordRef: { surah: 2, ayah: 21, word: 3 },
      timestamp: START,
    };

    expect(lemmaCards([added]).get('رَبّ')).toMatchObject({ state: 'new', due: START });
    expect(plan([added], START + MINUTE).reviews).toEqual([
      { lemmaId: 'رَبّ', wordRef: { surah: 2, ayah: 21, word: 3 } },
    ]);
  });
});

describe('the recap after a gap', () => {
  /** Ayahs 1–4 studied on days 0–3, then the first half of ayah 5 on day 4. */
  function studied(): ReviewEvent[] {
    let log: ReviewEvent[] = [];
    for (let day = 0; day < 4; day++) log = session(log, START + day * DAY);
    return record(log, [
      ...lemmasOf(5)
        .slice(0, 4)
        .map((l): EventDraft => ({
          kind: 'learn',
          lemmaId: l,
          wordRef: refOf(l),
          timestamp: START + 4 * DAY,
        })),
      {
        kind: 'completed',
        lemmaId: null,
        wordRef: refOf(lemmaAt(5, 4)),
        timestamp: START + 4 * DAY,
      },
    ]);
  }
  const lastSession = START + 4 * DAY;

  const recapOf = (log: ReviewEvent[], time: number) =>
    plan(log, time).recap.map((p) => `${p.surah}:${p.ayah}:${p.fromWord}-${p.toWord}`);

  it('is not given to a new learner', () => {
    expect(plan([], START + 30 * DAY).recap).toEqual([]);
  });

  it(`is not given after a gap shorter than ${RECAP_GAP_DAYS} days`, () => {
    expect(recapOf(studied(), lastSession + (RECAP_GAP_DAYS - 1) * DAY)).toEqual([]);
  });

  it(`shows the last few ayahs studied after ${RECAP_GAP_DAYS} days away`, () => {
    // Of ayah 5, only the part studied.
    expect(recapOf(studied(), lastSession + RECAP_GAP_DAYS * DAY)).toEqual([
      '1:3:1-8',
      '1:4:1-8',
      '1:5:1-4',
    ]);
  });

  it('counts answering reviews as a session', () => {
    const log = record(studied(), answer(lemmasOf(4), RATING.good, lastSession + 4 * DAY));

    expect(recapOf(log, lastSession + 9 * DAY)).toEqual([]);
  });

  it(`gives a learner who missed 10 days a recap and at most ${REVIEW_LIMIT} reviews`, () => {
    const missed = plan(fortyLearned(), START + 4 * DAY + 11 * DAY);

    expect(missed.recap.map((p) => p.ayah)).toEqual([3, 4, 5]);
    expect(missed.reviews).toHaveLength(REVIEW_LIMIT);
    // And then the new material continues where the path stopped.
    expect(missed.newMaterial[0]).toMatchObject({ surah: 1, ayah: 6 });
  });
});

describe('review questions', () => {
  const later = START + 30 * DAY;
  const dueLog = () => session([], START);

  it('asks one question per card to review, about the word form its card shows', () => {
    const log = dueLog();
    const today = plan(log, later);

    const items = planReview(today, log, quizContent);
    expect(items.map((i) => i.lemmaId)).toEqual(today.reviews.map((r) => r.lemmaId));
    for (const item of items) expect(item.wordRef).toEqual(refOf(item.lemmaId));
  });

  it('grades answers automatically into review events that reschedule the card', () => {
    const log = dueLog();
    const [item] = planReview(plan(log, later), log, quizContent);

    const event = gradeAnswer(item, item.answer, 3_000, at(later));
    expect(event).toMatchObject({ kind: 'review', lemmaId: item.lemmaId, correct: true });

    const after = record(log, [event]);
    expect(lemmaCards(after).get(item.lemmaId)!.due).toBeGreaterThan(later + DAY);
    expect(plan(after, later + MINUTE).reviews.map((r) => r.lemmaId)).not.toContain(item.lemmaId);
  });

  it('asks about a lemma in another way at its next review', () => {
    const log = dueLog();
    const [first] = planReview(plan(log, later), log, quizContent);
    const after = record(log, [gradeAnswer(first, 'a wrong answer', 3_000, at(later))]);

    const again = planReview(plan(after, later + DAY), after, quizContent).find(
      (i) => i.lemmaId === first.lemmaId,
    )!;
    expect(again.type).not.toBe(first.type);
  });

  it('leaves out a lemma marked "I know this" after the session was planned', () => {
    const log = dueLog();
    const today = plan(log, later);
    const { lemmaId, wordRef } = today.reviews[0];
    const known = record(log, [markKnown(lemmaId, wordRef, at(later))]);

    expect(planReview(today, known, quizContent).map((i) => i.lemmaId)).not.toContain(lemmaId);
  });
});
