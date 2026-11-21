/**
 * How many words a part of a long ayah should have: `min` to `max`, and never more than `limit`.
 * A part runs past `max` only where that avoids a break without a pause mark. Ayahs of at most
 * `max` words stay whole.
 */
export type PartSize = { min: number; max: number; limit: number };

/** About 8–15 words a screen, up to 18 rather than break between pause marks. */
export const PART_SIZE: PartSize = { min: 8, max: 15, limit: 18 };

/** A part of an ayah: its first and last displayed word positions (1-based, inclusive). */
export type PartRange = { first: number; last: number };

/**
 * What ending a part after a word with this pause mark costs: nothing where the mushaf says to
 * stop (mīm ۘ, lāzim) or that stopping is better (qilā ۗ), a little where stopping is merely
 * permitted (jīm ۚ), more where continuing is better (ṣilā ۖ) or where only one of a pair may be
 * stopped at (muʿānaqa ۛ). Lā ۙ (do not stop) and the sajdah mark ۩ are not places to break.
 */
const BREAK_COST: Record<string, number> = {
  'ۘ': 0,
  'ۗ': 0,
  'ۚ': 1,
  'ۖ': 2,
  'ۛ': 2,
};

/** Ending a part after a word without a pause mark: only where the marks leave no other way. */
const UNMARKED_BREAK_COST = 50;
/** Each part costs a little, so an ayah is not split more than it needs. */
const PART_COST = 1;
/** Each word a part falls short of `min` costs this. */
const SHORT_WORD_COST = 4;
/** Each word a part runs past `max` costs this. */
const LONG_WORD_COST = 6;

/** Where a part may end after this word, how much that costs. */
function breakCost(word: string): number {
  return BREAK_COST[word.at(-1) ?? ''] ?? UNMARKED_BREAK_COST;
}

/** A part of this many words: parts near the middle of `min`–`max` are best. */
function partCost(length: number, { min, max }: PartSize): number {
  const middle = (min + max) / 2;
  const short = Math.max(0, min - length) * SHORT_WORD_COST;
  const long = Math.max(0, length - max) * LONG_WORD_COST;
  return PART_COST + short + long + 0.1 * (length - middle) ** 2;
}

/**
 * Splits an ayah's displayed words (as printed, pause marks attached) into parts, breaking after
 * pause marks wherever they allow parts of about `size.min` to `size.max` words. No part has more
 * than `size.limit`. Where the marks leave a longer stretch, it is cut without one into parts of
 * even length. An ayah of at most `size.max` words is one part. The cheapest split wins (see the
 * costs above), so the same words always give the same parts.
 */
export function splitAyahIntoParts(words: string[], size: PartSize = PART_SIZE): PartRange[] {
  const n = words.length;
  if (n <= size.max) return [{ first: 1, last: n }];

  // best[i]: the cheapest split of the first i words; from[i]: where its last part starts.
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    const endCost = i < n ? breakCost(words[i - 1]) : 0;
    for (let j = Math.max(0, i - size.limit); j < i; j++) {
      const cost = best[j] + partCost(i - j, size) + endCost;
      if (cost < best[i]) {
        best[i] = cost;
        from[i] = j;
      }
    }
  }

  const parts: PartRange[] = [];
  for (let i = n; i > 0; i = from[i]) parts.unshift({ first: from[i] + 1, last: i });
  return parts;
}
