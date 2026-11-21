import { EVENT_KINDS, isEventKind, type EventDraft, type LogEvent } from '../engine';
import type { SettingRow } from '../settings/settings';
import type { SqlValue, UserSqlRunner } from './sql';

type EventRow = {
  id: string;
  kind: string;
  lemma_id: string | null;
  surah: number | null;
  ayah: number | null;
  word: number | null;
  rating: number | null;
  correct: number | null;
  response_time_ms: number | null;
  timestamp: number;
  device_id: string;
  utc_offset_minutes: number | null;
};

const RATINGS = new Set([1, 2, 3, 4]);

/** A place in a surah: an ayah, or one part (1-based) of a long ayah shown in parts. */
export type BrowsePosition = { surah: number; ayah: number; part?: number };

/**
 * The event a row holds; 'unknown' for a kind from a newer app version (synced from another
 * device), kept in the table but left out; 'invalid' for a row not valid for its kind.
 */
function toEvent(row: EventRow): LogEvent | 'unknown' | 'invalid' {
  if (!isEventKind(row.kind)) return 'unknown';
  if (row.surah === null || row.ayah === null || row.word === null) return 'invalid';
  if (EVENT_KINDS[row.kind].hasLemma !== (row.lemma_id !== null)) return 'invalid';
  const base = {
    id: row.id,
    lemmaId: row.lemma_id,
    wordRef: { surah: row.surah, ayah: row.ayah, word: row.word },
    timestamp: row.timestamp,
    deviceId: row.device_id,
    ...(row.utc_offset_minutes === null ? {} : { utcOffsetMinutes: row.utc_offset_minutes }),
  };
  if (row.kind === 'review') {
    if (row.rating === null || !RATINGS.has(row.rating) || row.correct === null) return 'invalid';
    return {
      ...base,
      kind: 'review',
      rating: row.rating,
      correct: row.correct === 1,
      responseTimeMs: row.response_time_ms ?? 0,
    } as LogEvent;
  }
  return { ...base, kind: row.kind } as LogEvent;
}

function toRow(event: LogEvent): SqlValue[] {
  const { id, kind, lemmaId, wordRef, timestamp, deviceId, utcOffsetMinutes } = event;
  const graded = event.kind === 'review' ? event : null;
  return [
    id,
    kind,
    lemmaId,
    wordRef.surah,
    wordRef.ayah,
    wordRef.word,
    graded?.rating ?? null,
    graded ? (graded.correct ? 1 : 0) : null,
    graded?.responseTimeMs ?? null,
    timestamp,
    deviceId,
    utcOffsetMinutes ?? null,
  ];
}

const INSERT_EVENT = `
  INSERT OR IGNORE INTO review_events
    (id, kind, lemma_id, surah, ayah, word, rating, correct, response_time_ms, timestamp, device_id,
     utc_offset_minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * The learner's data in the user database: the device id, the append-only event log and
 * settings.
 * The database must already be migrated (migrateUserDb).
 */
export function createUserStore(db: UserSqlRunner, newId: () => string) {
  let deviceId: Promise<string> | null = null;
  // Every write waits for the one before: on one connection, a write made while another's
  // transaction is open would try to open a transaction inside it, or be rolled back with it.
  let writes: Promise<unknown> = Promise.resolve();
  function serially<T>(write: () => Promise<T>): Promise<T> {
    const result = writes.then(write);
    writes = result.catch(() => {});
    return result;
  }

  async function loadDeviceId(): Promise<string> {
    const [row] = await db.all<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'device_id'",
      [],
    );
    if (row) return row.value;
    // Random, not a hardware id: it only tells which device recorded an event.
    await serially(() =>
      db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('device_id', ?)", [newId()]),
    );
    const [created] = await db.all<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'device_id'",
      [],
    );
    return created.value;
  }

  const store = {
    /** This install's id, created on first use and kept with the database. */
    getDeviceId(): Promise<string> {
      deviceId ??= loadDeviceId();
      return deviceId;
    },

    /** Records events the engine decided on, from this device. Returns them as stored. */
    async record(drafts: EventDraft[]): Promise<LogEvent[]> {
      const device = await store.getDeviceId();
      const events = drafts.map((d) => ({ ...d, id: newId(), deviceId: device }) as LogEvent);
      await store.addEvents(events);
      return events;
    },

    /** Adds complete events (e.g. from another device); ones already in the log are skipped. */
    addEvents(events: LogEvent[]): Promise<void> {
      return serially(() =>
        db.transaction(async () => {
          for (const event of events) await db.run(INSERT_EVENT, toRow(event));
        }),
      );
    },

    /** The whole log, oldest first. */
    async listEvents(): Promise<LogEvent[]> {
      const rows = await db.all<EventRow>(
        `SELECT id, kind, lemma_id, surah, ayah, word, rating, correct, response_time_ms,
                timestamp, device_id, utc_offset_minutes
           FROM review_events ORDER BY timestamp, id`,
        [],
      );
      const events: LogEvent[] = [];
      let invalid = 0;
      for (const row of rows) {
        const event = toEvent(row);
        if (event === 'invalid') invalid++;
        else if (event !== 'unknown') events.push(event);
      }
      // Left out rather than failing the whole log; kept in the table for a later fix.
      if (invalid > 0) console.warn(`Left out ${invalid} invalid events from the log`);
      return events;
    },

    /** Every stored setting, as written by saveSettings. */
    listSettings(): Promise<SettingRow[]> {
      return db.all<SettingRow>('SELECT key, value FROM settings ORDER BY key', []);
    },

    /** Stores settings, replacing their previous values; `updatedAt` is epoch ms. */
    saveSettings(rows: SettingRow[], updatedAt: number): Promise<void> {
      return serially(() =>
        db.transaction(async () => {
          for (const { key, value } of rows)
            await db.run(
              `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT (key) DO UPDATE
                   SET value = excluded.value, updated_at = excluded.updated_at`,
              [key, value, updatedAt],
            );
        }),
      );
    },

    /** Where the learner last was in a surah in Browse; null if they haven't browsed it. */
    async getBrowsePosition(surah: number): Promise<BrowsePosition | null> {
      const [row] = await db.all<{ ayah: number; part: number | null }>(
        'SELECT ayah, part FROM browse_positions WHERE surah = ?',
        [surah],
      );
      if (!row) return null;
      return { surah, ayah: row.ayah, ...(row.part === null ? {} : { part: row.part }) };
    },

    /** Remembers the place in a surah, replacing the one before; `updatedAt` is epoch ms. */
    async saveBrowsePosition(
      { surah, ayah, part }: BrowsePosition,
      updatedAt: number,
    ): Promise<void> {
      await serially(() =>
        db.run(
          `INSERT INTO browse_positions (surah, ayah, part, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (surah) DO UPDATE
               SET ayah = excluded.ayah, part = excluded.part, updated_at = excluded.updated_at`,
          [surah, ayah, part ?? null, updatedAt],
        ),
      );
    },
  };
  return store;
}

export type UserStore = ReturnType<typeof createUserStore>;
