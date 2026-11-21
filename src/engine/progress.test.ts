import {
  chooseStart,
  completeSession,
  markKnown,
  planSession,
  progress,
  streak,
  type EventDraft,
  type Now,
  type ReviewEvent,
} from '.';

// 21 November 2026, 09:00 UTC.
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number, utcOffsetMinutes = 0): Now => ({ time, utcOffsetMinutes });

const ayah = (surah: number, number: number, ...words: string[][]) => ({
  surah,
  ayah: number,
  words: words.map((lemmas, i) => ({ position: i + 1, lemmas })),
});

// One short ayah per day at the light pace (10 new lemmas): each ayah has 10 new lemmas.
const ayahOfNewWords = (surah: number, number: number) =>
  ayah(surah, number, ...Array.from({ length: 10 }, (_, i) => [`${surah}:${number}:${i}`]));
const content = {
  path: [
    ayahOfNewWords(1, 1),
    ayahOfNewWords(1, 2),
    ayahOfNewWords(1, 3),
    ayahOfNewWords(114, 1),
    ayahOfNewWords(114, 2),
    ayahOfNewWords(113, 1),
  ],
};

let nextId = 0;
const record = (log: ReviewEvent[], drafts: EventDraft[]): ReviewEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as ReviewEvent),
];

/** The log after a session completed at each of the given moments, in order. */
function sessionsAt(...moments: Now[]): ReviewEvent[] {
  let log: ReviewEvent[] = [];
  for (const now of moments) {
    const plan = planSession(content, log, { pace: 'light' }, now);
    log = record(log, completeSession(plan, log, now));
  }
  return log;
}

const passages = (log: ReviewEvent[], now = at(START)) =>
  planSession(content, log, { pace: 'light' }, now).newMaterial.map((p) => `${p.surah}:${p.ayah}`);

describe('choosing a later start point', () => {
  it('starts the first session at the chosen surah', () => {
    const log = record([], [chooseStart(content, 114, at(START))!]);

    expect(passages(log)).toEqual(['114:1']);
  });

  it('carries on along the path from there', () => {
    let log = record([], [chooseStart(content, 114, at(START))!]);
    const plan = planSession(content, log, { pace: 'light' }, at(START));
    log = record(log, completeSession(plan, log, at(START)));

    expect(passages(log, at(START + DAY))).toEqual(['114:2']);
  });

  it('is not a starting point that leaves studied ayahs to do again', () => {
    let log = sessionsAt(at(START - 3 * DAY), at(START - 2 * DAY), at(START - DAY));
    log = record(log, [chooseStart(content, 1, at(START))!]);

    expect(passages(log)).toEqual(['114:1']);
  });

  it('can only be a surah on the path', () => {
    expect(chooseStart(content, 2, at(START))).toBeNull();
  });

  it('recaps only ayahs studied, not the ones skipped', () => {
    let log = record([], [chooseStart(content, 114, at(START - 10 * DAY))!]);
    const plan = planSession(content, log, { pace: 'light' }, at(START - 10 * DAY));
    log = record(log, completeSession(plan, log, at(START - 10 * DAY)));

    const recap = planSession(content, log, { pace: 'light' }, at(START)).recap;

    expect(recap.map((p) => `${p.surah}:${p.ayah}`)).toEqual(['114:1']);
  });
});

describe('the streak', () => {
  it('is 0 for a new learner', () => {
    expect(streak([], at(START))).toBe(0);
  });

  it('counts the days in a row with a completed session, up to today', () => {
    const log = sessionsAt(at(START - 2 * DAY), at(START - DAY), at(START));

    expect(streak(log, at(START + HOUR))).toBe(3);
  });

  it("keeps yesterday's streak while today's session is still to do", () => {
    const log = sessionsAt(at(START - 2 * DAY), at(START - DAY));

    expect(streak(log, at(START))).toBe(2);
  });

  it('starts again after a whole day is missed', () => {
    const log = sessionsAt(at(START - 3 * DAY), at(START - 2 * DAY), at(START));

    expect(streak(log, at(START))).toBe(1);
    expect(streak(sessionsAt(at(START - 2 * DAY)), at(START))).toBe(0);
  });

  it('counts a day of answering reviews only, as once the path is finished', () => {
    const log = record(sessionsAt(at(START - DAY)), [
      {
        kind: 'review',
        lemmaId: '1:1:0',
        wordRef: { surah: 1, ayah: 1, word: 1 },
        rating: 3,
        correct: true,
        responseTimeMs: 2000,
        timestamp: START,
        utcOffsetMinutes: 0,
      },
    ]);

    expect(streak(log, at(START))).toBe(2);
  });

  it('counts by the local day, not the UTC one', () => {
    // In New York (UTC−5): 23:30 on the 20th, then 00:30 on the 21st, an hour later.
    const ny = -5 * 60;
    const lateEvening = Date.UTC(2026, 10, 21, 4, 30);
    const log = sessionsAt(at(lateEvening, ny), at(lateEvening + HOUR, ny));

    // Both are on the 21st in UTC.
    expect(streak(log, at(lateEvening + 2 * HOUR, ny))).toBe(2);
  });

  it('keeps each day where it happened when the learner travels', () => {
    // 23:30 on the 20th in Los Angeles (UTC−8), then 20:00 on the 21st in Tokyo (UTC+9). By
    // Tokyo's clock both are on the 21st, but they were two days in a row.
    const la = -8 * 60;
    const tokyo = 9 * 60;
    const log = sessionsAt(
      at(Date.UTC(2026, 10, 21, 7, 30), la),
      at(Date.UTC(2026, 10, 21, 11), tokyo),
    );

    expect(streak(log, at(Date.UTC(2026, 10, 21, 12), tokyo))).toBe(2);
  });

  it("counts a day that is still ahead of the learner's clock after flying west", () => {
    // 08:00 on the 22nd in Tokyo, then the flight lands in Los Angeles on the evening of the 21st.
    const log = sessionsAt(
      at(Date.UTC(2026, 10, 20, 23), 9 * 60),
      at(Date.UTC(2026, 10, 21, 23), 9 * 60),
    );

    expect(streak(log, at(Date.UTC(2026, 10, 22, 3), -8 * 60))).toBe(2);
  });

  it('places events recorded before offsets were stored by the current offset', () => {
    const log = sessionsAt(at(START - DAY), at(START)).map(
      ({ utcOffsetMinutes: _, ...e }) => e as ReviewEvent,
    );

    expect(log.every((e) => e.utcOffsetMinutes === undefined)).toBe(true);
    expect(streak(log, at(START, 60))).toBe(2);
  });
});

describe('progress', () => {
  it('starts at the beginning of the path with nothing done', () => {
    expect(progress(content, [])).toEqual({
      ayahsCompleted: 0,
      wordsLearned: 0,
      wordsKnown: 0,
      pathAyahs: 6,
      pathIndex: 0,
      next: { surah: 1, ayah: 1, word: 1 },
    });
  });

  it('counts the ayahs completed and the words learned in sessions', () => {
    const log = sessionsAt(at(START - DAY), at(START));

    expect(progress(content, log)).toMatchObject({
      ayahsCompleted: 2,
      wordsLearned: 20,
      pathIndex: 2,
      next: { surah: 1, ayah: 3, word: 1 },
    });
  });

  it('counts an ayah only once it is studied to its end', () => {
    const long = { path: [ayah(1, 1, ...Array.from({ length: 15 }, (_, i) => [`w${i}`]))] };
    const plan = planSession(long, [], { pace: 'light' }, at(START));
    const log = record([], completeSession(plan, [], at(START)));

    expect(progress(long, log)).toMatchObject({
      ayahsCompleted: 0,
      wordsLearned: 10,
      pathIndex: 0,
      next: { surah: 1, ayah: 1, word: 11 },
    });
  });

  it('counts words marked "I know this" apart from the ones learned', () => {
    const log = record(sessionsAt(at(START - DAY)), [
      markKnown('1:1:0', { surah: 1, ayah: 1, word: 1 }, at(START)),
      markKnown('114:1:0', { surah: 114, ayah: 1, word: 1 }, at(START)),
    ]);

    expect(progress(content, log)).toMatchObject({ wordsLearned: 9, wordsKnown: 2 });
  });

  it('does not count the ayahs skipped by a chosen start point as completed', () => {
    let log = record([], [chooseStart(content, 114, at(START - DAY))!]);
    expect(progress(content, log)).toMatchObject({ ayahsCompleted: 0, pathIndex: 3 });

    const plan = planSession(content, log, { pace: 'light' }, at(START));
    log = record(log, completeSession(plan, log, at(START)));

    expect(progress(content, log)).toMatchObject({
      ayahsCompleted: 1,
      pathIndex: 4,
      next: { surah: 114, ayah: 2, word: 1 },
    });
  });

  it('has nothing next once the path is finished', () => {
    const log = sessionsAt(...Array.from({ length: 6 }, (_, i) => at(START + i * DAY)));

    expect(progress(content, log)).toMatchObject({ ayahsCompleted: 6, pathIndex: 6, next: null });
  });
});
