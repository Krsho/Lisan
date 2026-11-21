import {
  completeSession,
  FEATURE_TERMS,
  gradeAnswer,
  lemmaCards,
  markKnown,
  planQuiz,
  planSession,
  RATING,
  type EventDraft,
  type LemmaEntry,
  type PathAyah,
  type QuizContent,
  type QuizItem,
  type QuizWord,
  type ReviewEvent,
  type SessionPlan,
} from '.';

// A fixed clock: 21 November 2026, 09:00 UTC, in UTC.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const START = Date.UTC(2026, 10, 21, 9);
const at = (time: number) => ({ time, utcOffsetMinutes: 0 });

const prefix = (text: string, lemma: string, kind: string) => ({
  text,
  lemma,
  terms: ['role.prefix', kind],
});
const stem = (text: string, lemma: string, ...terms: string[]) => ({
  text,
  lemma,
  terms: ['role.stem', ...terms],
});
const whole = (text: string, lemma: string, ...terms: string[]) => ({ text, lemma, terms });

// Today's words: Al-Fatiha 1:1 and 1:5, with their segments as the corpus has them.
const words: QuizWord[] = [
  {
    ref: { surah: 1, ayah: 1, word: 1 },
    bare: 'بِسْمِ',
    gloss: 'In (the) name',
    segments: [
      prefix('بِ', 'ب', 'particle.preposition'),
      stem('سْمِ', 'اسْم', 'pos.noun', 'gender.masculine', 'case.genitive'),
    ],
  },
  {
    ref: { surah: 1, ayah: 1, word: 2 },
    bare: 'ٱللَّهِ',
    gloss: '(of) Allah',
    segments: [whole('ٱللَّهِ', 'اللَّه', 'pos.proper-noun', 'case.genitive')],
  },
  {
    ref: { surah: 1, ayah: 1, word: 3 },
    bare: 'ٱلرَّحْمَٰنِ',
    gloss: 'the Most Gracious',
    segments: [
      prefix('ٱل', 'ال', 'particle.definite-article'),
      stem('رَّحْمَٰنِ', 'رَحْمٰن', 'pos.noun', 'gender.masculine', 'number.singular', 'case.genitive'),
    ],
  },
  {
    ref: { surah: 1, ayah: 1, word: 4 },
    bare: 'ٱلرَّحِيمِ',
    gloss: 'the Most Merciful',
    segments: [
      prefix('ٱل', 'ال', 'particle.definite-article'),
      stem('رَّحِيمِ', 'رَحِيم', 'pos.noun', 'gender.masculine', 'number.singular', 'case.genitive'),
    ],
  },
  {
    ref: { surah: 1, ayah: 5, word: 2 },
    bare: 'نَعْبُدُ',
    gloss: 'we worship',
    segments: [
      whole(
        'نَعْبُدُ',
        'عَبَدَ',
        'pos.verb',
        'aspect.imperfect',
        'person.first',
        'number.plural',
        'mood.indicative',
      ),
    ],
  },
];

const lemma = (
  lemmaId: string,
  partOfSpeech: string,
  frequency: number,
  bare?: string,
  gloss?: string,
): LemmaEntry => ({
  lemmaId,
  partOfSpeech,
  frequency,
  sample: bare && gloss ? { bare, gloss } : null,
});

// Lemmas to draw wrong options from, with how often they occur and a word of each on its own.
const lemmas: LemmaEntry[] = [
  lemma('ب', 'particle.preposition', 1200),
  lemma('ال', 'particle.definite-article', 9000),
  lemma('اسْم', 'pos.noun', 39, 'ٱسْمَ', 'name'),
  lemma('اللَّه', 'pos.proper-noun', 2700, 'ٱللَّهُ', 'Allah'),
  lemma('رَحْمٰن', 'pos.noun', 57, 'ٱلرَّحْمَٰنُ', 'the Most Gracious'),
  lemma('رَحِيم', 'pos.noun', 115, 'رَحِيمًا', 'Most Merciful'),
  // A different lemma that means the same as ٱلرَّحِيمِ.
  lemma('رَءُوف', 'pos.noun', 110, 'رَءُوفٌ', 'The most merciful'),
  lemma('عَبَدَ', 'pos.verb', 143, 'يَعْبُدُونَ', 'they worship'),
  // Nouns close in frequency to رَحْمٰن (57) and اسْم (39)...
  lemma('كِتَاب', 'pos.noun', 50, 'كِتَٰبٌ', 'a book'),
  lemma('نَار', 'pos.noun', 60, 'نَارًا', 'a fire'),
  lemma('بَيْت', 'pos.noun', 45, 'بَيْتٍ', 'a house'),
  lemma('مَاء', 'pos.noun', 63, 'مَآءً', 'water'),
  // ...and far from them.
  lemma('يَوْم', 'pos.noun', 405, 'يَوْمٍ', 'a day'),
  lemma('أَرْض', 'pos.noun', 461, 'ٱلْأَرْضِ', 'the earth'),
  // Verbs exactly as frequent as the nouns, which make poor options for a noun.
  lemma('كَتَبَ', 'pos.verb', 57, 'كَتَبَ', 'he wrote'),
  lemma('دَخَلَ', 'pos.verb', 39, 'دَخَلَ', 'he entered'),
  lemma('عَلِمَ', 'pos.verb', 140, 'يَعْلَمُ', 'he knows'),
  lemma('قَالَ', 'pos.verb', 1700, 'قَالَ', 'he said'),
  lemma('خَلَقَ', 'pos.verb', 150, 'خَلَقَ', 'he created'),
];

const content: QuizContent = { words, lemmas };

const path: PathAyah[] = [
  {
    surah: 1,
    ayah: 1,
    words: [
      { position: 1, lemmas: ['ب', 'اسْم'] },
      { position: 2, lemmas: ['اللَّه'] },
      { position: 3, lemmas: ['ال', 'رَحْمٰن'] },
      { position: 4, lemmas: ['ال', 'رَحِيم'] },
    ],
  },
  { surah: 1, ayah: 5, words: [{ position: 2, lemmas: ['عَبَدَ'] }] },
];

let nextId = 0;
const record = (log: ReviewEvent[], drafts: EventDraft[]): ReviewEvent[] => [
  ...log,
  ...drafts.map((d) => ({ ...d, id: `e${nextId++}`, deviceId: 'device-a' }) as ReviewEvent),
];

const todaysPlan = (log: ReviewEvent[] = []) =>
  planSession({ path }, log, { pace: 'normal' }, at(START));

/** A plan that introduces just these lemmas, each in the word it is listed with. */
const planOf = (...entries: [string, number, number][]): SessionPlan => ({
  reviews: [],
  recap: [],
  newMaterial: [],
  newLemmas: entries.map(([lemmaId, ayah, word]) => ({
    lemmaId,
    wordRef: { surah: 1, ayah, word },
  })),
  completedToday: false,
});

const ofType = <T extends QuizItem['type']>(items: QuizItem[], type: T) =>
  items.filter((i): i is Extract<QuizItem, { type: T }> => i.type === type);

const wrongOptions = (item: QuizItem) => item.options.filter((o) => o !== item.answer);

describe("the quiz on today's new words", () => {
  it('asks one question per new lemma, of all three types', () => {
    const items = planQuiz(todaysPlan(), [], content);

    expect(items.map((i) => i.lemmaId)).toEqual(['ب', 'اسْم', 'اللَّه', 'ال', 'رَحْمٰن', 'رَحِيم', 'عَبَدَ']);
    expect(new Set(items.map((i) => i.type))).toEqual(new Set(['meaning', 'arabic', 'grammar']));
  });

  it('gives each question four distinct options with the answer among them once', () => {
    for (const item of planQuiz(todaysPlan(), [], content)) {
      expect(new Set(item.options).size).toBe(item.options.length);
      expect(item.options.filter((o) => o === item.answer)).toHaveLength(1);
      // A grammatical feature offers its values (case has three), other questions four options.
      const count =
        item.type === 'grammar' && item.feature !== 'part-of-speech'
          ? FEATURE_TERMS[item.feature].length
          : 4;
      expect(item.options).toHaveLength(count);
    }
  });

  it('asks Arabic word → meaning with the word as it appears in the ayah', () => {
    const [item] = planQuiz(planOf(['رَحْمٰن', 1, 3]), [], content);

    expect(item).toMatchObject({
      type: 'meaning',
      word: 'ٱلرَّحْمَٰنِ',
      wordRef: { surah: 1, ayah: 1, word: 3 },
      answer: 'the Most Gracious',
    });
  });

  it('draws wrong meanings from nouns of a similar frequency for a noun', () => {
    const [item] = planQuiz(planOf(['رَحْمٰن', 1, 3]), [], content);

    // Nouns nearest 57 occurrences, not the equally frequent verb كَتَبَ ("he wrote").
    expect(wrongOptions(item).sort()).toEqual(['a book', 'a fire', 'water'].sort());
  });

  it('asks meaning → Arabic word with wrong words of the same part of speech', () => {
    const items = planQuiz(planOf(['اسْم', 1, 1], ['عَبَدَ', 5, 2]), [], content);
    const [item] = ofType(items, 'arabic');

    expect(item).toMatchObject({ lemmaId: 'عَبَدَ', meaning: 'we worship', answer: 'نَعْبُدُ' });
    // Verbs nearest 143 occurrences.
    expect(wrongOptions(item).sort()).toEqual(['خَلَقَ', 'يَعْلَمُ', 'كَتَبَ'].sort());
  });

  it('never offers a wrong word that means the same as the answer', () => {
    const items = planQuiz(planOf(['اسْم', 1, 1], ['رَحِيم', 1, 4]), [], content);
    const [item] = ofType(items, 'arabic');

    expect(item.lemmaId).toBe('رَحِيم');
    expect(item.options).not.toContain('رَءُوفٌ');
  });

  it("asks about a verb's grammar, offering the values of one feature", () => {
    const items = planQuiz(planOf(['اسْم', 1, 1], ['ب', 1, 1], ['عَبَدَ', 5, 2]), [], content);
    const verb = ofType(items, 'grammar').find((i) => i.lemmaId === 'عَبَدَ')!;

    expect(verb.feature).not.toBe('part-of-speech');
    const values = FEATURE_TERMS[verb.feature as keyof typeof FEATURE_TERMS];
    expect([...verb.options].sort()).toEqual([...values].sort());
    expect(['aspect.imperfect', 'person.first', 'number.plural', 'mood.indicative']).toContain(
      verb.answer,
    );
  });

  it('asks what a prefix is, with other particles as the wrong options', () => {
    const [item] = planQuiz(planOf(['ال', 1, 3]), [], content);

    expect(item).toMatchObject({
      type: 'grammar',
      feature: 'part-of-speech',
      segment: 'ٱل',
      word: 'ٱلرَّحْمَٰنِ',
      answer: 'particle.definite-article',
    });
    expect(wrongOptions(item).every((o) => o.startsWith('particle.'))).toBe(true);
  });

  it('leaves out lemmas marked "I know this"', () => {
    const log = record([], [markKnown('اللَّه', { surah: 1, ayah: 1, word: 2 }, at(START))]);

    const items = planQuiz(todaysPlan(), log, content);

    expect(items.map((i) => i.lemmaId)).not.toContain('اللَّه');
  });

  it('builds the same questions each time', () => {
    expect(planQuiz(todaysPlan(), [], content)).toEqual(planQuiz(todaysPlan(), [], content));
  });
});

describe('grading quiz answers', () => {
  const [item] = planQuiz(planOf(['رَحْمٰن', 1, 3]), [], content);
  const wrong = wrongOptions(item)[0];
  const answeredAt = at(START + 5 * MINUTE);

  it('records the answer as a review event for the lemma', () => {
    expect(gradeAnswer(item, item.answer, 2500, answeredAt)).toEqual({
      kind: 'review',
      lemmaId: 'رَحْمٰن',
      wordRef: { surah: 1, ayah: 1, word: 3 },
      rating: RATING.easy,
      correct: true,
      responseTimeMs: 2500,
      timestamp: answeredAt.time,
      utcOffsetMinutes: 0,
    });
  });

  it('rates right and fast as easy, slower as good, then hard; wrong as again', () => {
    const rating = (answer: string, ms: number) => gradeAnswer(item, answer, ms, answeredAt).rating;

    expect(rating(item.answer, 2_000)).toBe(RATING.easy);
    expect(rating(item.answer, 8_000)).toBe(RATING.good);
    expect(rating(item.answer, 30_000)).toBe(RATING.hard);
    expect(rating(wrong, 2_000)).toBe(RATING.again);
    expect(rating(wrong, 30_000)).toBe(RATING.again);
  });

  /** The card's due date after learning today's words and answering this item once. */
  function dueAfter(answer: string, ms: number) {
    const plan = todaysPlan();
    let log = record([], completeSession(plan, [], at(START)));
    log = record(log, [gradeAnswer(item, answer, ms, answeredAt)]);
    return lemmaCards(log).get('رَحْمٰن')!.due;
  }

  it('schedules every first answer a day or more ahead, wrong or slow sooner than right', () => {
    const good = dueAfter(item.answer, 8_000);
    const hard = dueAfter(item.answer, 30_000);
    const missed = dueAfter(wrong, 30_000);

    expect(missed).toBeGreaterThanOrEqual(answeredAt.time + DAY);
    expect(good).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThanOrEqual(missed);
  });

  it('schedules a right, fast first answer no further out than a good one', () => {
    // On the day a word is learned, a quick right answer shows it was just seen, not that it is
    // known: it is not worth a week's wait.
    expect(dueAfter(item.answer, 2_000)).toBe(dueAfter(item.answer, 8_000));
  });

  it('schedules a right, fast answer at a later review further out than a good one', () => {
    const dueAfterReview = (ms: number) => {
      let log = record([], completeSession(todaysPlan(), [], at(START)));
      log = record(log, [gradeAnswer(item, item.answer, 8_000, answeredAt)]);
      const reviewedAt = at(lemmaCards(log).get('رَحْمٰن')!.due);
      log = record(log, [gradeAnswer(item, item.answer, ms, reviewedAt)]);
      return lemmaCards(log).get('رَحْمٰن')!.due;
    };

    expect(dueAfterReview(2_000)).toBeGreaterThan(dueAfterReview(8_000));
  });

  it('gives a lemma one card, whatever word forms it is asked in', () => {
    const plan = todaysPlan();
    let log = record([], completeSession(plan, [], at(START)));
    const [inWord3] = planQuiz(planOf(['ال', 1, 3]), [], content);
    const [inWord4] = planQuiz(planOf(['ال', 1, 4]), [], content);

    log = record(log, [
      gradeAnswer(inWord3, inWord3.answer, 3_000, at(START + MINUTE)),
      gradeAnswer(inWord4, inWord4.answer, 3_000, at(START + DAY)),
    ]);

    const cards = [...lemmaCards(log).values()].filter((c) => c.lemmaId === 'ال');
    expect(cards).toHaveLength(1);
    expect(cards[0].reps).toBe(2);
    // The card shows the word form where the lemma was first met.
    expect(cards[0].wordRef).toEqual({ surah: 1, ayah: 1, word: 3 });
  });

  it('schedules the same from the log whatever order its events arrive in', () => {
    let log = record([], completeSession(todaysPlan(), [], at(START)));
    log = record(log, [
      gradeAnswer(item, item.answer, 3_000, at(START + MINUTE)),
      gradeAnswer(item, wrong, 3_000, at(START + 3 * DAY)),
      gradeAnswer(item, item.answer, 9_000, at(START + 3 * DAY + 20 * MINUTE)),
    ]);

    expect(lemmaCards([...log].reverse())).toEqual(lemmaCards(log));
    expect(lemmaCards(log).get('رَحْمٰن')).toMatchObject({ reps: 3, lapses: 1 });
  });

  it('gives a learned lemma never quizzed a new card, due from when it was learned', () => {
    const log = record([], completeSession(todaysPlan(), [], at(START)));

    expect(lemmaCards(log).get('رَحْمٰن')).toMatchObject({
      state: 'new',
      reps: 0,
      due: START,
      wordRef: { surah: 1, ayah: 1, word: 3 },
    });
  });

  it('has no card for a lemma only marked "I know this"', () => {
    const log = record([], [markKnown('اللَّه', { surah: 1, ayah: 1, word: 2 }, at(START))]);

    expect(lemmaCards(log).size).toBe(0);
  });
});
