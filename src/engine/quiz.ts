import {
  RATING,
  type EventDraft,
  type GradedEvent,
  type Rating,
  type LogEvent,
  type WordRef,
} from './events';
import { lemmaCards } from './cards';
import { knownLemmas, type Now, type SessionPlan } from './session';

/** One morphological piece of a word, with its glossary term keys (e.g. "case.genitive"). */
export type QuizSegment = { text: string; lemma: string | null; terms: string[] };

/** A word a new lemma was met in, as the quiz asks about it. */
export type QuizWord = {
  ref: WordRef;
  /** The word without pause marks. */
  bare: string;
  gloss: string | null;
  segments: QuizSegment[];
};

/** A lemma the quiz can draw wrong options from. */
export type LemmaEntry = {
  lemmaId: string;
  /** The glossary key of its part of speech, e.g. "pos.noun" or "particle.preposition". */
  partOfSpeech: string | null;
  /** How many segments of the Quran have this lemma. */
  frequency: number;
  /** A word that is this lemma alone, for options; null if it never stands alone. */
  sample: { bare: string; gloss: string } | null;
};

/** What the quiz is built from: today's words and the lemmas to draw wrong options from. */
export type QuizContent = { words: QuizWord[]; lemmas: LemmaEntry[] };

/** A grammatical feature a question can ask about, named like the glossary's key prefixes. */
export type GrammarFeature =
  'part-of-speech' | 'aspect' | 'mood' | 'person' | 'gender' | 'number' | 'case';

type ItemBase = {
  lemmaId: string;
  /** The word the question is about, where the lemma was met. */
  wordRef: WordRef;
  /** That word, without pause marks. */
  word: string;
  /** The choices, in the order to show them; exactly one is `answer`. */
  options: string[];
  answer: string;
};

export type QuizItem =
  /** The Arabic word is shown; the options are meanings. */
  | (ItemBase & { type: 'meaning' })
  /** The meaning is shown; the options are Arabic words. */
  | (ItemBase & { type: 'arabic'; meaning: string })
  /** A feature of `segment` (a part of `word`) is asked; the options are glossary term keys. */
  | (ItemBase & { type: 'grammar'; feature: GrammarFeature; segment: string });

export type QuizType = QuizItem['type'];

/** The values of each grammatical feature, as glossary keys. */
export const FEATURE_TERMS: Record<Exclude<GrammarFeature, 'part-of-speech'>, string[]> = {
  aspect: ['aspect.perfect', 'aspect.imperfect', 'aspect.imperative'],
  mood: ['mood.indicative', 'mood.subjunctive', 'mood.jussive'],
  person: ['person.first', 'person.second', 'person.third'],
  gender: ['gender.masculine', 'gender.feminine'],
  number: ['number.singular', 'number.dual', 'number.plural'],
  case: ['case.nominative', 'case.accusative', 'case.genitive'],
};

/** Parts of speech that make plausible wrong options for one another. */
const PARTS_OF_SPEECH = [
  'pos.noun',
  'pos.verb',
  'pos.pronoun',
  'pos.proper-noun',
  'pos.demonstrative',
  'pos.relative',
  'pos.time-adverb',
];
/** The commonest kinds of particle, as wrong options for a particle. */
const PARTICLES = [
  'particle.preposition',
  'particle.conjunction',
  'particle.definite-article',
  'particle.resumption',
  'particle.negative',
  'particle.emphatic',
  'particle.interrogative',
  'particle.vocative',
  'particle.conditional',
];

/** Which features to ask about, by part of speech. Gender is asked only when nothing else is. */
const VERB_FEATURES: GrammarFeature[] = ['aspect', 'person', 'number', 'mood', 'gender'];
const NOMINAL_FEATURES: GrammarFeature[] = ['case', 'number', 'gender'];

const OPTIONS = 4;
const QUIZ_TYPES: QuizType[] = ['meaning', 'arabic', 'grammar'];

/** A 32-bit hash of a string (FNV-1a), to vary choices per lemma but the same on every device. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Shuffles deterministically from `seed`, so a question looks the same each time it is built. */
function shuffle<T>(items: T[], seed: string): T[] {
  const result = [...items];
  let state = hash(seed);
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const partOfSpeechOf = (segment: QuizSegment) =>
  segment.terms.find((t) => t.startsWith('pos.') || t.startsWith('particle.')) ?? null;

const isAffix = (segment: QuizSegment) =>
  segment.terms.includes('role.prefix') || segment.terms.includes('role.suffix');

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Lemmas to draw wrong options from, most plausible first: the same part of speech, then the
 * closest in frequency (on a log scale, so a word met 10 times sits near one met 20 times).
 */
function similarLemmas(
  lemmas: LemmaEntry[],
  target: { lemmaId: string; partOfSpeech: string | null; frequency: number },
  exclude: Set<string>,
): (LemmaEntry & { sample: NonNullable<LemmaEntry['sample']> })[] {
  const distance = (e: LemmaEntry) =>
    Math.abs(Math.log(e.frequency + 1) - Math.log(target.frequency + 1));
  return lemmas
    .filter(
      (e): e is LemmaEntry & { sample: NonNullable<LemmaEntry['sample']> } =>
        e.sample !== null && e.lemmaId !== target.lemmaId && !exclude.has(e.lemmaId),
    )
    .map((e) => ({ e, samePos: e.partOfSpeech === target.partOfSpeech ? 0 : 1, d: distance(e) }))
    .sort(
      (a, b) =>
        a.samePos - b.samePos ||
        a.d - b.d ||
        (a.e.lemmaId < b.e.lemmaId ? -1 : a.e.lemmaId > b.e.lemmaId ? 1 : 0),
    )
    .map(({ e }) => e);
}

/** Up to `count` distinct strings from `candidates` that are not (and do not equal) any in `taken`. */
function pick(candidates: string[], taken: string[], count: number): string[] {
  const chosen: string[] = [];
  for (const c of candidates) {
    if (chosen.length === count) break;
    if ([...taken, ...chosen].some((t) => same(t, c))) continue;
    chosen.push(c);
  }
  return chosen;
}

type Target = {
  lemmaId: string;
  word: QuizWord;
  segment: QuizSegment;
  partOfSpeech: string | null;
  frequency: number;
  /** A word that is the lemma alone, if there is one. */
  sample: LemmaEntry['sample'];
};

function meaningItem(t: Target, lemmas: LemmaEntry[], exclude: Set<string>): QuizItem | null {
  const gloss = t.word.gloss;
  if (!gloss) return null;
  const wrong = pick(
    similarLemmas(lemmas, t, exclude).map((e) => e.sample.gloss),
    [gloss],
    OPTIONS - 1,
  );
  if (wrong.length === 0) return null;
  return {
    type: 'meaning',
    lemmaId: t.lemmaId,
    wordRef: t.word.ref,
    word: t.word.bare,
    answer: gloss,
    options: shuffle([gloss, ...wrong], `${t.lemmaId}:meaning`),
  };
}

function arabicItem(t: Target, lemmas: LemmaEntry[], exclude: Set<string>): QuizItem | null {
  // Wrong options are words that are their lemma alone. A word that carries other lemmas too (a
  // prefix such as the definite article) would stand out among them, so it is asked as its
  // lemma's own word, with that word's meaning.
  const alone = t.word.segments.every((s) => s.lemma === null || s.lemma === t.lemmaId);
  const shown = alone ? t.word : t.sample;
  const gloss = shown?.gloss;
  if (!shown || !gloss) return null;
  // A word whose meaning reads the same would also be right, so it is no wrong option.
  const meanings = [gloss, t.word.gloss].filter((g): g is string => g !== null);
  const candidates = similarLemmas(lemmas, t, exclude).filter(
    (e) => !meanings.some((g) => same(e.sample.gloss, g)),
  );
  const wrong = pick(
    candidates.map((e) => e.sample.bare),
    [shown.bare, t.word.bare],
    OPTIONS - 1,
  );
  if (wrong.length === 0) return null;
  return {
    type: 'arabic',
    lemmaId: t.lemmaId,
    wordRef: t.word.ref,
    word: t.word.bare,
    meaning: gloss,
    answer: shown.bare,
    options: shuffle([shown.bare, ...wrong], `${t.lemmaId}:arabic`),
  };
}

function grammarItem(t: Target): QuizItem | null {
  const { segment } = t;
  const base = {
    type: 'grammar' as const,
    lemmaId: t.lemmaId,
    wordRef: t.word.ref,
    word: t.word.bare,
  };
  const seed = `${t.lemmaId}:grammar`;

  if (!isAffix(segment)) {
    const order = t.partOfSpeech === 'pos.verb' ? VERB_FEATURES : NOMINAL_FEATURES;
    const present = order.filter((f) =>
      FEATURE_TERMS[f as keyof typeof FEATURE_TERMS].some((k) => segment.terms.includes(k)),
    );
    const askable = present.length > 1 ? present.filter((f) => f !== 'gender') : present;
    if (askable.length > 0) {
      const feature = askable[hash(t.lemmaId) % askable.length] as keyof typeof FEATURE_TERMS;
      const values = FEATURE_TERMS[feature];
      const answer = values.find((k) => segment.terms.includes(k))!;
      return { ...base, feature, segment: segment.text, answer, options: shuffle(values, seed) };
    }
  }

  // Otherwise (and always for a prefix or suffix): what kind of word or particle it is.
  const answer = t.partOfSpeech;
  if (!answer) return null;
  const group = answer.startsWith('particle.') ? PARTICLES : PARTS_OF_SPEECH;
  // A proper noun is also a noun, so "noun" would be a right answer too.
  const others = group.filter(
    (k) => k !== answer && !(answer === 'pos.proper-noun' && k === 'pos.noun'),
  );
  const wrong = shuffle(others, seed).slice(0, OPTIONS - 1);
  return {
    ...base,
    feature: 'part-of-speech',
    segment: segment.text,
    answer,
    options: shuffle([answer, ...wrong], seed),
  };
}

const refKey = ({ surah, ayah, word }: WordRef) => `${surah}:${ayah}:${word}`;

/**
 * The quiz after today's new ayah(s): one question per new lemma, in the order they were met,
 * leaving out lemmas the learner has marked "I know this". Question types take turns (Arabic →
 * meaning, meaning → Arabic, grammar), falling back to another type when one cannot be asked; a
 * prefix or suffix (such as the definite article) is asked about grammatically only. Wrong options
 * come from lemmas of the same part of speech and a similar frequency.
 */
export function planQuiz(plan: SessionPlan, log: LogEvent[], content: QuizContent): QuizItem[] {
  // Types take turns along the quiz.
  return questionsFor(plan.newLemmas, knownLemmas(log), content, (_, index) => index);
}

/**
 * The review at the start of the session: one question per card to review, about the word form
 * the card shows, built like the quiz's (and graded the same, with gradeAnswer). The question type
 * moves on with each review of a card, so a lemma is asked about in turn by meaning, by Arabic word
 * and by grammar. Cards marked "I know this" since the session was planned are left out.
 */
export function planReview(plan: SessionPlan, log: LogEvent[], content: QuizContent): QuizItem[] {
  const cards = lemmaCards(log);
  return questionsFor(
    plan.reviews,
    knownLemmas(log),
    content,
    (lemmaId) => hash(lemmaId) + (cards.get(lemmaId)?.reps ?? 0),
  );
}

function questionsFor(
  targets: { lemmaId: string; wordRef: WordRef }[],
  known: Set<string>,
  content: QuizContent,
  /** Which question type to try first for a lemma (an index into QUIZ_TYPES, wrapped). */
  firstType: (lemmaId: string, index: number) => number,
): QuizItem[] {
  const words = new Map(content.words.map((w) => [refKey(w.ref), w]));
  const entries = new Map(content.lemmas.map((e) => [e.lemmaId, e]));
  const items: QuizItem[] = [];

  for (const { lemmaId, wordRef } of targets) {
    if (known.has(lemmaId)) continue;
    const word = words.get(refKey(wordRef));
    const segment = word?.segments.find((s) => s.lemma === lemmaId);
    if (!word || !segment) continue;
    const entry = entries.get(lemmaId);
    const target: Target = {
      lemmaId,
      word,
      segment,
      partOfSpeech: partOfSpeechOf(segment) ?? entry?.partOfSpeech ?? null,
      frequency: entry?.frequency ?? 1,
      sample: entry?.sample ?? null,
    };
    // The word's other lemmas would make a confusing wrong option (its meaning includes theirs).
    const exclude = new Set(word.segments.flatMap((s) => (s.lemma ? [s.lemma] : [])));

    const build = (type: QuizType) =>
      type === 'grammar'
        ? grammarItem(target)
        : isAffix(segment)
          ? null
          : type === 'meaning'
            ? meaningItem(target, content.lemmas, exclude)
            : arabicItem(target, content.lemmas, exclude);

    const first = firstType(lemmaId, items.length) % QUIZ_TYPES.length;
    for (let k = 0; k < QUIZ_TYPES.length; k++) {
      const item = build(QUIZ_TYPES[(first + k) % QUIZ_TYPES.length]);
      if (item) {
        items.push(item);
        break;
      }
    }
  }
  return items;
}

/** Answers at or under this are fast: rated easy when right. */
export const FAST_ANSWER_MS = 4_000;
/** Answers over this are slow: rated hard when right. */
export const SLOW_ANSWER_MS = 12_000;

/** The FSRS rating for an answer: wrong is again; right is easy, good or hard by speed. */
export function ratingFor(correct: boolean, responseTimeMs: number): Rating {
  if (!correct) return RATING.again;
  if (responseTimeMs <= FAST_ANSWER_MS) return RATING.easy;
  if (responseTimeMs <= SLOW_ANSWER_MS) return RATING.good;
  return RATING.hard;
}

/**
 * Grades an answer to a quiz item into a review event for the item's lemma: the learner never
 * grades themselves. `responseTimeMs` is how long they took to answer.
 */
export function gradeAnswer(
  item: QuizItem,
  answer: string,
  responseTimeMs: number,
  now: Now,
): EventDraft & Omit<GradedEvent, 'id' | 'deviceId'> {
  const correct = answer === item.answer;
  return {
    kind: 'review',
    lemmaId: item.lemmaId,
    wordRef: item.wordRef,
    rating: ratingFor(correct, responseTimeMs),
    correct,
    responseTimeMs: Math.max(0, Math.round(responseTimeMs)),
    timestamp: now.time,
    utcOffsetMinutes: now.utcOffsetMinutes,
  };
}
