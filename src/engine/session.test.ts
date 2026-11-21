import {
  completeSession,
  markKnown,
  planSession,
  SESSION_WORD_LIMIT,
  streak,
  undoKnown,
  type EventDraft,
  type PathAyah,
  type LogEvent,
  type SessionPlan,
  type PlanSettings,
} from '.';

// A fixed clock: 21 November 2026, 09:00 UTC, in UTC.
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number, utcOffsetMinutes = 0) => ({ time, utcOffsetMinutes });
const normal: PlanSettings = { pace: 'normal' };

/** An ayah whose words have the given lemmas, e.g. ayah(1, 1, ['b', 'ism'], ['allah']). */
const ayah = (surah: number, number: number, ...words: string[][]): PathAyah => ({
  surah,
  ayah: number,
  words: words.map((lemmas, i) => ({ position: i + 1, lemmas })),
});

/** An ayah of `count` words, each with its own lemma named `${prefix}1`, `${prefix}2`, ... */
const ayahOfNewWords = (surah: number, number: number, count: number, prefix: string) =>
  ayah(surah, number, ...Array.from({ length: count }, (_, i) => [`${prefix}${i + 1}`]));

/** The ayah split into parts of the given sizes, as the content build splits a long ayah. */
const inParts = (a: PathAyah, ...sizes: number[]): PathAyah => {
  let next = a.words[0].position;
  const parts = sizes.map((size) => {
    const part = { fromWord: next, toWord: next + size - 1 };
    next += size;
    return part;
  });
  return { ...a, parts };
};

// A shortened path in the content's order: part of Al-Fatiha, then part of An-Nas.
const content = {
  path: [
    ayah(1, 1, ['b', 'ism'], ['allah'], ['al', 'rahman'], ['al', 'rahim']),
    ayah(1, 2, ['al', 'hamd'], ['li', 'allah'], ['rabb'], ['al', 'alamin']),
    ayah(1, 3, ['al', 'rahman'], ['al', 'rahim']),
    ayah(1, 4, ['malik'], ['yawm'], ['al', 'din']),
    ayah(1, 5, ['iyya'], ['abada'], ['wa', 'iyya'], ['istaana']),
    ayah(114, 1, ['qul'], ['audhu'], ['b', 'rabb'], ['al', 'nas']),
    ayah(114, 2, ['malik'], ['al', 'nas']),
  ],
};

let nextId = 0;
/** The log after the drafts are recorded on this device. */
const record = (log: LogEvent[], drafts: EventDraft[]): LogEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as LogEvent),
];

/** Completes `days` daily sessions in a row, one each day from START. */
function studyDays(days: number, c = content, settings = normal) {
  let log: LogEvent[] = [];
  const plans: SessionPlan[] = [];
  for (let day = 0; day < days; day++) {
    const now = at(START + day * DAY);
    const plan = planSession(c, log, settings, now);
    plans.push(plan);
    log = record(log, completeSession(plan, log, now));
  }
  return { log, plans };
}

const passages = (plan: SessionPlan) =>
  plan.newMaterial.map((p) => `${p.surah}:${p.ayah}:${p.fromWord}-${p.toWord}`);

describe('the daily new-ayah session', () => {
  it('starts a new learner at Al-Fatiha', () => {
    const plan = planSession(content, [], normal, at(START));

    expect(passages(plan)[0]).toBe('1:1:1-4');
  });

  it('groups short ayahs until the new-word budget of about 15 lemmas is reached', () => {
    const plan = planSession(content, [], normal, at(START));

    // 1:1 has 6 new lemmas, 1:2 adds 4 (10), 1:3 none, 1:4 adds 3 (13), 1:5 would add 4 (17).
    expect(passages(plan)).toEqual(['1:1:1-4', '1:2:1-4', '1:3:1-2', '1:4:1-3']);
    expect(plan.newLemmas).toHaveLength(13);
  });

  it('counts a lemma once, in the word form where it first appears', () => {
    const plan = planSession(content, [], normal, at(START));

    const rahim = plan.newLemmas.filter((l) => l.lemmaId === 'rahim');
    expect(rahim).toEqual([{ lemmaId: 'rahim', wordRef: { surah: 1, ayah: 1, word: 4 } }]);
  });

  it('continues the next day where the last session stopped, after Al-Fatiha with An-Nas', () => {
    const { plans } = studyDays(2);

    expect(passages(plans[1])).toEqual(['1:5:1-4', '114:1:1-4', '114:2:1-2']);
  });

  it('does not count lemmas learned in earlier sessions as new', () => {
    const { plans } = studyDays(2);

    // b, rabb, al and malik were learned in the first session; iyya and nas recur in this one.
    expect(plans[1].newLemmas.map((l) => l.lemmaId)).toEqual([
      'iyya',
      'abada',
      'wa',
      'istaana',
      'qul',
      'audhu',
      'nas',
    ]);
  });

  it('splits a long ayah across days only at its part boundaries', () => {
    const long = {
      path: [
        inParts(ayahOfNewWords(2, 282, 40, 'w'), 12, 3, 10, 15),
        ayahOfNewWords(2, 283, 3, 'x'),
      ],
    };

    const { plans } = studyDays(5, long);

    // Each day continues from the next part; 2:283 waits whole when it doesn't fit.
    expect(plans.map(passages)).toEqual([
      ['2:282:1-15'],
      ['2:282:16-25'],
      ['2:282:26-40'],
      ['2:283:1-3'],
      [],
    ]);
  });

  it('resumes mid-part from a log split at a word, then keeps to the part boundaries', () => {
    // An older content version split the ayah at word 20; this one splits it into parts.
    const words = ayahOfNewWords(2, 282, 40, 'w');
    const older = { path: [inParts(words, 20, 20)] };
    const { log } = studyDays(1, older);
    const current = { path: [inParts(words, 12, 3, 10, 15)] };

    const day2 = planSession(current, log, normal, at(START + DAY));
    const later = record(log, completeSession(day2, log, at(START + DAY)));
    const day3 = planSession(current, later, normal, at(START + 2 * DAY));

    // Word 21 is inside the part 16–25: the session finishes that part, then goes part by part.
    expect(passages(day2)).toEqual(['2:282:21-25']);
    expect(passages(day3)).toEqual(['2:282:26-40']);
  });

  it('takes a part whole even when it alone is over the budget', () => {
    const long = { path: [inParts(ayahOfNewWords(2, 282, 30, 'w'), 20, 10)] };

    const { plans } = studyDays(2, long);

    expect(plans.map(passages)).toEqual([['2:282:1-20'], ['2:282:21-30']]);
  });

  it('takes an ayah without parts whole, even when it is over the budget', () => {
    const plan = planSession(
      { path: [ayahOfNewWords(1, 1, 20, 'l'), ayah(1, 2, ['j'])] },
      [],
      { pace: 'light' },
      at(START),
    );

    expect(passages(plan)).toEqual(['1:1:1-20']);
  });

  it('sets the budget from the pace', () => {
    const path = { path: [inParts(ayahOfNewWords(2, 282, 40, 'w'), 5, 5, 5, 5, 5, 5, 5, 5)] };

    const budget = (pace: PlanSettings['pace']) =>
      planSession(path, [], { pace }, at(START)).newLemmas.length;

    expect(budget('light')).toBeLessThan(budget('normal'));
    expect(budget('normal')).toBe(15);
    expect(budget('intense')).toBeGreaterThan(budget('normal'));
  });

  it('keeps a session short through ayahs whose words are all known', () => {
    // Thirty ayahs of five words, every lemma already marked "I know this": none is new, so the
    // budget of new lemmas alone would put the whole path in one session.
    const known = { path: Array.from({ length: 30 }, (_, i) => ayahOfNewWords(3, i + 1, 5, 'k')) };
    const log = record(
      [],
      [1, 2, 3, 4, 5].map((i) => markKnown(`k${i}`, { surah: 3, ayah: 1, word: i }, at(START))),
    );

    const plan = planSession(known, log, normal, at(START + 1000));

    const words = plan.newMaterial.reduce((n, p) => n + p.toWord - p.fromWord + 1, 0);
    expect(words).toBe(SESSION_WORD_LIMIT.normal);
    expect(plan.newMaterial[0]).toMatchObject({ ayah: 1, fromWord: 1 });
  });

  it('splits a long ayah of known words at a part boundary within the session word limit', () => {
    const words = ayah(2, 282, ...Array.from({ length: 100 }, () => ['known']));
    const long = { path: [inParts(words, 20, 20, 20, 20, 20)] };
    const log = record([], [markKnown('known', { surah: 2, ayah: 282, word: 1 }, at(START))]);

    const plan = planSession(long, log, normal, at(START + 1000));

    // Two parts of 20 fit the word limit of 45; a third would not.
    expect(SESSION_WORD_LIMIT.normal).toBe(45);
    expect(passages(plan)).toEqual(['2:282:1-40']);
  });

  it('has no new material once the path is finished', () => {
    const { plans } = studyDays(3);

    expect(plans[2].newMaterial).toEqual([]);
    expect(plans[2].newLemmas).toEqual([]);
  });
});

describe('I know this', () => {
  it('never counts a known lemma as new', () => {
    const log = record([], [markKnown('allah', { surah: 1, ayah: 1, word: 2 }, at(START))]);

    const plan = planSession(content, log, normal, at(START + 1000));

    expect(plan.newLemmas.map((l) => l.lemmaId)).not.toContain('allah');
  });

  it('frees budget for more new material', () => {
    const known = ['iyya', 'abada'].map((lemma) =>
      markKnown(lemma, { surah: 1, ayah: 5, word: 1 }, at(START)),
    );

    const plan = planSession(content, record([], known), normal, at(START + 1000));

    // 1:5 now adds only wa and istaana: 15 new lemmas.
    expect(passages(plan)).toEqual(['1:1:1-4', '1:2:1-4', '1:3:1-2', '1:4:1-3', '1:5:1-4']);
  });

  it('is not recorded as learned when marked during the session', () => {
    const plan = planSession(content, [], normal, at(START));
    const log = record([], [markKnown('allah', { surah: 1, ayah: 1, word: 2 }, at(START + 1000))]);

    const drafts = completeSession(plan, log, at(START + 2000));

    const learned = drafts.filter((d) => d.kind === 'learn').map((d) => d.lemmaId);
    expect(learned).toHaveLength(12);
    expect(learned).not.toContain('allah');
  });

  it('can be undone, making the lemma new again', () => {
    const ref = { surah: 1, ayah: 1, word: 2 };
    const log = record(
      [],
      [markKnown('allah', ref, at(START)), undoKnown('allah', ref, at(START + 1000))],
    );

    const plan = planSession(content, log, normal, at(START + 2000));

    expect(plan.newLemmas.map((l) => l.lemmaId)).toContain('allah');
  });
});

describe('completing a session', () => {
  it('records the learned lemmas with their word forms and where the path stopped', () => {
    const plan = planSession(content, [], normal, at(START));

    const drafts = completeSession(plan, [], at(START + 60_000));

    expect(drafts).toContainEqual({
      kind: 'learn',
      lemmaId: 'rahim',
      wordRef: { surah: 1, ayah: 1, word: 4 },
      timestamp: START + 60_000,
      utcOffsetMinutes: 0,
    });
    expect(drafts).toContainEqual({
      kind: 'completed',
      lemmaId: null,
      wordRef: { surah: 1, ayah: 4, word: 3 },
      timestamp: START + 60_000,
      utcOffsetMinutes: 0,
    });
  });

  it('marks today as done until the next local day', () => {
    const { log } = studyDays(1);

    expect(planSession(content, log, normal, at(START + 60_000)).completedToday).toBe(true);
    // 09:00 UTC + 14h59m is still the same day in UTC...
    expect(planSession(content, log, normal, at(START + 14 * 3600_000)).completedToday).toBe(true);
    // ...but already the next day in UTC+10.
    expect(planSession(content, log, normal, at(START + 14 * 3600_000, 600)).completedToday).toBe(
      false,
    );
    expect(planSession(content, log, normal, at(START + DAY)).completedToday).toBe(false);
  });

  it('counts a session on the local day where it happened, after travelling', () => {
    // Completed at 20:00 in New York (UTC-5), then a flight to Tokyo (UTC+9): two hours later it
    // is noon of the next day there, and that day's session is still to do, as the streak says.
    const newYorkEvening = Date.UTC(2026, 10, 22, 1);
    const plan = planSession(content, [], normal, at(newYorkEvening, -300));
    const log = record([], completeSession(plan, [], at(newYorkEvening, -300)));

    const tokyoNoon = at(newYorkEvening + 2 * 3600_000, 540);
    expect(planSession(content, log, normal, tokyoNoon).completedToday).toBe(false);
    expect(streak(log, tokyoNoon)).toBe(1);
  });

  it('is not done for a new learner', () => {
    expect(planSession(content, [], normal, at(START)).completedToday).toBe(false);
  });

  it('takes the furthest point reached, whichever order the events arrive in', () => {
    const { log } = studyDays(2);

    const plan = planSession(content, [...log].reverse(), normal, at(START + 2 * DAY));

    expect(plan.newMaterial).toEqual([]);
  });
});
