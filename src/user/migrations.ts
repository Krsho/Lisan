import type { UserSqlRunner } from './sql';

/**
 * The user database's schema, one migration per version: migration i takes the database from
 * version i to i + 1 (kept in PRAGMA user_version). Only ever append; never edit a migration that
 * has shipped, since installed databases have already run it. Later features add their tables
 * (settings, for example) as new migrations.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: device id and the append-only event log.
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
  -- Never updated or deleted: progress is derived from this log, and devices merge by union.
  CREATE TABLE review_events (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    lemma_id TEXT,
    surah INTEGER,
    ayah INTEGER,
    word INTEGER,
    rating INTEGER,
    correct INTEGER,
    response_time_ms INTEGER,
    timestamp INTEGER NOT NULL,
    device_id TEXT NOT NULL
  ) STRICT;
  CREATE INDEX review_events_lemma ON review_events (lemma_id, timestamp);
  CREATE INDEX review_events_timestamp ON review_events (timestamp);
  `,
  // 2: settings, one row per setting with its value as JSON (src/settings/settings.ts).
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  `,
  // 3: the UTC offset each event was recorded at, so days (streaks) stay right after travelling.
  // NULL on events recorded before it; the engine places those by the current offset.
  `
  ALTER TABLE review_events ADD COLUMN utc_offset_minutes INTEGER;
  `,
];

/** Brings the database up to the latest schema. Each step commits on its own, with its version. */
export async function migrateUserDb(
  db: UserSqlRunner,
  migrations: readonly string[] = MIGRATIONS,
): Promise<void> {
  const [row] = await db.all<{ user_version: number }>('PRAGMA user_version', []);
  const version = row?.user_version ?? 0;
  if (version > migrations.length) {
    throw new Error(
      `The user database is at version ${version}, newer than this app knows (${migrations.length})`,
    );
  }
  for (let v = version; v < migrations.length; v++) {
    await db.transaction(async () => {
      await db.exec(migrations[v]);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
