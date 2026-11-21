/** An inclusive range of 1-based positions. */
export type Span = [first: number, last: number];

/**
 * One displayed word whose text tokens, corpus words or word-by-word gloss positions are not
 * one-to-one. Every other word of the ayah maps one token → one corpus word → one gloss position.
 */
export type AlignmentEntry = {
  /** KFGQPC text tokens shown together as this word (joined by a space). */
  tokens: Span;
  /** Corpus morphology words whose segments the word shows. */
  words: Span;
  /** Word positions in QUL's word-by-word glosses, joined into the word's gloss. */
  glosses: Span;
};

/** Alignment exceptions keyed by `surah:ayah`. */
export type WordAlignment = Record<string, AlignmentEntry[]>;

/**
 * The places where KFGQPC's word boundaries differ from the corpus morphology's. The text is
 * never re-split: a displayed word covers whole tokens and whole corpus words. The build refuses
 * any other mismatch.
 */
export const WORD_ALIGNMENT: WordAlignment = {
  // بَعۡدَ مَا: two tokens, one corpus word (بَعْدَ + مَا). QUL glosses the first token only.
  '2:181': [{ tokens: [3, 4], words: [3, 3], glosses: [3, 4] }],
  '8:6': [{ tokens: [4, 5], words: [4, 4], glosses: [4, 5] }],
  '13:37': [{ tokens: [8, 9], words: [8, 8], glosses: [8, 9] }],
  // إِلۡ يَاسِينَ: two tokens, one corpus word (its segment text contains the space).
  '37:130': [{ tokens: [3, 4], words: [3, 3], glosses: [3, 3] }],
  // لَّوۡمَا: one token, corpus words لَّوْ + مَا.
  '15:7': [{ tokens: [1, 1], words: [1, 2], glosses: [1, 2] }],
  // مَالِيَ / وَمَالِيَ: one token, corpus words مَا + لِىَ.
  '27:20': [{ tokens: [4, 4], words: [4, 5], glosses: [4, 5] }],
  '36:22': [{ tokens: [1, 1], words: [1, 2], glosses: [1, 2] }],
};

export type DisplayWord = { text: string; words: Span; glosses: Span };

/** Maps an ayah's text tokens onto corpus words. Throws if they don't line up. */
export function alignAyah(
  location: string,
  tokens: string[],
  corpusWordCount: number,
  entries: AlignmentEntry[] = [],
): DisplayWord[] {
  const pending = [...entries].sort((a, b) => a.tokens[0] - b.tokens[0]);
  const display: DisplayWord[] = [];
  let token = 1;
  let word = 1;
  let gloss = 1;
  const misfit = () =>
    new Error(
      `Word alignment for ${location} does not fit: text has ${tokens.length} tokens, morphology has ${corpusWordCount} words`,
    );
  while (token <= tokens.length) {
    const entry = pending[0]?.tokens[0] === token ? pending.shift()! : undefined;
    const span = entry ?? { tokens: [token, token], words: [word, word], glosses: [gloss, gloss] };
    if (span.words[0] !== word || span.glosses[0] !== gloss || span.tokens[1] > tokens.length) {
      throw misfit();
    }
    display.push({
      text: tokens.slice(span.tokens[0] - 1, span.tokens[1]).join(' '),
      words: span.words,
      glosses: span.glosses,
    });
    token = span.tokens[1] + 1;
    word = span.words[1] + 1;
    gloss = span.glosses[1] + 1;
  }
  if (word - 1 !== corpusWordCount || pending.length > 0) {
    if (entries.length > 0) throw misfit();
    throw new Error(
      `Word count mismatch in ${location}: the text has ${tokens.length}, morphology has ${corpusWordCount}`,
    );
  }
  return display;
}
