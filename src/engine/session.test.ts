import {
  completeSession,
  markKnown,
  planSession,
  undoKnown,
  type EventDraft,
  type PathAyah,
  type ReviewEvent,
  type SessionPlan,
  type Settings,
} from '.';

// A fixed clock: 21 November 2026, 09:00 UTC, in UTC.
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number, utcOffsetMinutes = 0) => ({ time, utcOffsetMinutes });
const normal: Settings = { pace: 'normal' };

/** An ayah whose words have the given lemmas, e.g. ayah(1, 1, ['b', 'ism'], ['allah']). */
const ayah = (surah: number, number: number, ...words: string[][]): PathAyah => ({
  surah,
  ayah: number,
  words: words.map((lemmas, i) => ({ position: i + 1, lemmas })),
});

/** An ayah of `count` words, each with its own lemma named `${prefix}1`, `${prefix}2`, ... */
const ayahOfNewWords = (surah: number, number: number, count: number, prefix: string) =>
  ayah(surah, number, ...Array.from({ length: count }, (_, i) => [`${prefix}${i + 1}`]));

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
const record = (log: ReviewEvent[], drafts: EventDraft[]): ReviewEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as ReviewEvent),
];

/** Completes `days` daily sessions in a row, one each day from START. */
function studyDays(days: number, c = content, settings = normal) {
  let log: ReviewEvent[] = [];
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

  it('splits a long ayah across days', () => {
    const long = { path: [ayahOfNewWords(2, 282, 40, 'w'), ayahOfNewWords(2, 283, 3, 'x')] };

    const { plans } = studyDays(4, long);

    expect(plans.map(passages)).toEqual([
      ['2:282:1-15'],
      ['2:282:16-30'],
      ['2:282:31-40', '2:283:1-3'],
      [],
    ]);
  });

  it('takes at least one word even when a single word exceeds the budget', () => {
    const plan = planSession(
      {
        path: [
          ayah(
            1,
            1,
            Array.from({ length: 40 }, (_, i) => `l${i}`),
          ),
          ayah(1, 2, ['j']),
        ],
      },
      [],
      { pace: 'light' },
      at(START),
    );

    expect(passages(plan)).toEqual(['1:1:1-1']);
  });

  it('sets the budget from the pace', () => {
    const path = { path: [ayahOfNewWords(2, 282, 40, 'w')] };

    const budget = (pace: Settings['pace']) =>
      planSession(path, [], { pace }, at(START)).newLemmas.length;

    expect(budget('light')).toBeLessThan(budget('normal'));
    expect(budget('normal')).toBe(15);
    expect(budget('intense')).toBeGreaterThan(budget('normal'));
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

  it('is not done for a new learner', () => {
    expect(planSession(content, [], normal, at(START)).completedToday).toBe(false);
  });

  it('takes the furthest point reached, whichever order the events arrive in', () => {
    const { log } = studyDays(2);

    const plan = planSession(content, [...log].reverse(), normal, at(START + 2 * DAY));

    expect(plan.newMaterial).toEqual([]);
  });
});
