import type { LogEvent, WordRef } from './events';
import {
  eventDay,
  knownLemmas,
  learnedLemmas,
  localDay,
  pathPosition,
  type Content,
  type Now,
} from './session';

export type Progress = {
  /** Path ayahs studied to their end; ones skipped by a chosen start point don't count. */
  ayahsCompleted: number;
  /** Lemmas learned in sessions, less those since marked "I know this". */
  wordsLearned: number;
  /** Lemmas marked "I know this". */
  wordsKnown: number;
  /** How many ayahs the path has. */
  pathAyahs: number;
  /** How many of the path's ayahs are behind the learner (studied or skipped). */
  pathIndex: number;
  /** The word the next session starts at; null once the path is finished. */
  next: WordRef | null;
};

/** How far the learner has come, derived from the log. */
export function progress(content: Content, log: LogEvent[]): Progress {
  const { path } = content;
  const { next, chosenStart } = pathPosition(path, log);
  const known = knownLemmas(log);
  const learned = [...learnedLemmas(log)].filter((l) => !known.has(l));
  const at = path[next.ayah];
  return {
    ayahsCompleted: Math.max(0, next.ayah - chosenStart),
    wordsLearned: learned.length,
    wordsKnown: known.size,
    pathAyahs: path.length,
    pathIndex: next.ayah,
    next: at ? { surah: at.surah, ayah: at.ayah, word: at.words[next.word].position } : null,
  };
}

/** Whether an event is part of a daily session: completing one, or answering a review or quiz. */
const isSession = (e: LogEvent) => e.kind === 'completed' || e.kind === 'review';

/**
 * How many local days in a row the learner has done a session, ending today, or yesterday when
 * today's is still to do (the streak is not lost until a whole day is missed). 0 if neither.
 *
 * Each session counts on the local day where it happened, so travelling neither breaks a streak
 * nor merges two days into one. After flying west a session can be on a date still ahead of the
 * learner's clock; it counts as today.
 */
export function streak(log: LogEvent[], now: Now): number {
  const days = new Set(log.filter(isSession).map((e) => eventDay(e, now.utcOffsetMinutes)));
  if (days.size === 0) return 0;
  const today = localDay(now.time, now.utcOffsetMinutes);
  const latest = Math.max(...days);
  if (latest < today - 1) return 0;
  let day = latest;
  let count = 0;
  while (days.has(day)) {
    count++;
    day--;
  }
  return count;
}
