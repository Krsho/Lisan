import type { EventDraft, ReviewEvent } from '../engine';
import type { SettingRow } from '../settings/settings';
import type { SqlValue, UserSqlRunner } from './sql';

type EventRow = {
  id: string;
  kind: string;
  lemma_id: string | null;
  surah: number | null;
  ayah: number | null;
  word: number | null;
  timestamp: number;
  device_id: string;
};

const KINDS = new Set<string>(['learn', 'known', 'known-undone', 'completed']);

function toEvent(row: EventRow): ReviewEvent | null {
  // Kinds from a newer app version (synced from another device) are kept in the table but left out.
  if (!KINDS.has(row.kind) || row.surah === null || row.ayah === null || row.word === null)
    return null;
  return {
    id: row.id,
    kind: row.kind,
    lemmaId: row.lemma_id,
    wordRef: { surah: row.surah, ayah: row.ayah, word: row.word },
    timestamp: row.timestamp,
    deviceId: row.device_id,
  } as ReviewEvent;
}

function toRow(event: ReviewEvent): SqlValue[] {
  const { id, kind, lemmaId, wordRef, timestamp, deviceId } = event;
  return [id, kind, lemmaId, wordRef.surah, wordRef.ayah, wordRef.word, timestamp, deviceId];
}

const INSERT_EVENT = `
  INSERT OR IGNORE INTO review_events
    (id, kind, lemma_id, surah, ayah, word, timestamp, device_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * The learner's data in the user database: the device id, the append-only event log and
 * settings.
 * The database must already be migrated (migrateUserDb).
 */
export function createUserStore(db: UserSqlRunner, newId: () => string) {
  let deviceId: Promise<string> | null = null;

  async function loadDeviceId(): Promise<string> {
    const [row] = await db.all<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'device_id'",
      [],
    );
    if (row) return row.value;
    // Random, not a hardware id: it only tells which device recorded an event.
    await db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('device_id', ?)", [newId()]);
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
    async record(drafts: EventDraft[]): Promise<ReviewEvent[]> {
      const device = await store.getDeviceId();
      const events = drafts.map((d) => ({ ...d, id: newId(), deviceId: device }) as ReviewEvent);
      await store.addEvents(events);
      return events;
    },

    /** Adds complete events (e.g. from another device); ones already in the log are skipped. */
    async addEvents(events: ReviewEvent[]): Promise<void> {
      await db.transaction(async () => {
        for (const event of events) await db.run(INSERT_EVENT, toRow(event));
      });
    },

    /** The whole log, oldest first. */
    async listEvents(): Promise<ReviewEvent[]> {
      const rows = await db.all<EventRow>(
        `SELECT id, kind, lemma_id, surah, ayah, word, timestamp, device_id
           FROM review_events ORDER BY timestamp, id`,
        [],
      );
      return rows.map(toEvent).filter((e): e is ReviewEvent => e !== null);
    },

    /** Every stored setting, as written by saveSettings. */
    listSettings(): Promise<SettingRow[]> {
      return db.all<SettingRow>('SELECT key, value FROM settings ORDER BY key', []);
    },

    /** Stores settings, replacing their previous values; `updatedAt` is epoch ms. */
    async saveSettings(rows: SettingRow[], updatedAt: number): Promise<void> {
      // One statement per setting, each atomic on its own, and no transaction: a quick run of
      // changes (tapping A+ twice) must not try to open a transaction inside another.
      for (const { key, value } of rows)
        await db.run(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, value, updatedAt],
        );
    },
  };
  return store;
}

export type UserStore = ReturnType<typeof createUserStore>;
