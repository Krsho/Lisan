import {
  addAyahToReview,
  DEFAULT_SETTINGS,
  lemmaCards,
  markKnown,
  planSession,
  RATING,
  type EventDraft,
  type PathAyah,
  type ReviewEvent,
} from '.';

// A fixed clock: 21 November 2026, 09:00 UTC, in UTC.
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number) => ({ time, utcOffsetMinutes: 0 });

/** An ayah whose words have the given lemmas, e.g. ayah(1, 1, ['b', 'ism'], ['allah']). */
const ayah = (surah: number, number: number, ...words: string[][]): PathAyah => ({
  surah,
  ayah: number,
  words: words.map((lemmas, i) => ({ position: i + 1, lemmas })),
});

let nextId = 0;
/** The log after the drafts are recorded on this device. */
const record = (log: ReviewEvent[], drafts: EventDraft[]): ReviewEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as ReviewEvent),
];

// Ayat al-Kursi's opening, browsed outside the path: 2:255.
const kursi = ayah(2, 255, ['allah'], ['la'], ['ilah'], ['illa'], ['huwa'], ['al', 'hayy']);

describe('adding a browsed ayah to review', () => {
  it("brings the ayah's lemmas into the deck as new cards, due at once", () => {
    const log = record([], addAyahToReview(kursi, [], at(START)));

    const cards = lemmaCards(log);

    expect([...cards.keys()].sort()).toEqual(
      ['al', 'allah', 'hayy', 'huwa', 'ilah', 'illa', 'la'].sort(),
    );
    const hayy = cards.get('hayy')!;
    expect(hayy).toMatchObject({ state: 'new', due: START, reps: 0, lapses: 0 });
    // Shown in the word form where it was added, with its ayah as context.
    expect(hayy.wordRef).toEqual({ surah: 2, ayah: 255, word: 6 });
  });

  it('adds nothing for lemmas already learned on the path, reviewed or marked "I know this"', () => {
    let log: ReviewEvent[] = record(
      [],
      [
        {
          kind: 'learn',
          lemmaId: 'allah',
          wordRef: { surah: 1, ayah: 1, word: 2 },
          timestamp: START,
        },
        {
          kind: 'review',
          lemmaId: 'allah',
          wordRef: { surah: 1, ayah: 1, word: 2 },
          rating: 3,
          correct: true,
          responseTimeMs: 5000,
          timestamp: START,
        },
        // Learned on the path but not yet quizzed.
        { kind: 'learn', lemmaId: 'al', wordRef: { surah: 1, ayah: 1, word: 3 }, timestamp: START },
        markKnown('la', { surah: 2, ayah: 255, word: 2 }, at(START)),
      ],
    );
    const before = lemmaCards(log).get('allah');

    log = record(log, addAyahToReview(kursi, log, at(START + DAY)));

    expect(log.filter((e) => e.kind === 'added').map((e) => e.lemmaId)).toEqual([
      'ilah',
      'illa',
      'huwa',
      'hayy',
    ]);
    // The card already in the deck keeps its schedule and the word form it was learned in.
    expect(lemmaCards(log).get('allah')).toEqual(before);
    expect(lemmaCards(log).has('la')).toBe(false);
  });

  it('adds nothing the second time, and a lemma shared with an earlier added ayah once', () => {
    let log = record([], addAyahToReview(kursi, [], at(START)));

    expect(addAyahToReview(kursi, log, at(START + DAY))).toEqual([]);

    // 2:256 shares "la" and "allah" with 2:255.
    const next = ayah(2, 256, ['la'], ['ikrah'], ['fi'], ['al', 'din']);
    log = record(log, addAyahToReview(next, log, at(START + DAY)));
    expect(lemmaCards(log).get('la')!.wordRef).toEqual({ surah: 2, ayah: 255, word: 2 });
    expect(log.filter((e) => e.kind === 'added' && e.lemmaId === 'la')).toHaveLength(1);
  });

  it('reviews an added card like any other: answering it schedules it ahead', () => {
    let log = record([], addAyahToReview(kursi, [], at(START)));

    log = record(log, [
      {
        kind: 'review',
        lemmaId: 'hayy',
        wordRef: { surah: 2, ayah: 255, word: 6 },
        rating: RATING.good,
        correct: true,
        responseTimeMs: 5000,
        timestamp: START + DAY,
      },
    ]);

    const hayy = lemmaCards(log).get('hayy')!;
    expect(hayy.reps).toBe(1);
    expect(hayy.due).toBeGreaterThan(START + DAY);
    expect(hayy.wordRef).toEqual({ surah: 2, ayah: 255, word: 6 });
  });

  it('does not move the curated path on, nor change what it introduces as new', () => {
    const path = { path: [ayah(1, 1, ['b', 'ism'], ['allah'], ['al', 'rahman'], ['al', 'rahim'])] };
    const before = planSession(path, [], DEFAULT_SETTINGS, at(START + DAY));

    const log = record([], addAyahToReview(kursi, [], at(START)));

    expect(planSession(path, log, DEFAULT_SETTINGS, at(START + DAY))).toEqual(before);
  });
});
