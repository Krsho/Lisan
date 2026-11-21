import { randomUUID } from 'node:crypto';

import type { LogEvent } from '../engine';
import { openMemoryDb } from '../testing/memoryDb';
import { MIGRATIONS, migrateUserDb } from './migrations';
import { createUserStore } from './store';

let db: ReturnType<typeof openMemoryDb>;
beforeEach(() => {
  db = openMemoryDb();
});
afterEach(() => db.close());

const version = async () =>
  (await db.all<{ user_version: number }>('PRAGMA user_version', []))[0].user_version;

async function openStore() {
  await migrateUserDb(db);
  return createUserStore(db, randomUUID);
}

const fatiha = { surah: 1, ayah: 1, word: 4 };

describe('user database migrations', () => {
  it('creates a fresh database at the latest version', async () => {
    await migrateUserDb(db);

    expect(await version()).toBe(MIGRATIONS.length);
  });

  it('runs again without changing anything', async () => {
    const store = await openStore();
    await store.record([{ kind: 'learn', lemmaId: 'رَحِيم', wordRef: fatiha, timestamp: 1 }]);

    await migrateUserDb(db);

    expect(await version()).toBe(MIGRATIONS.length);
    expect(await store.listEvents()).toHaveLength(1);
  });

  it('applies only the migrations a database has not had, keeping its data', async () => {
    await migrateUserDb(db, ['CREATE TABLE a (x TEXT) STRICT;']);
    await db.run('INSERT INTO a VALUES (?)', ['kept']);

    await migrateUserDb(db, ['CREATE TABLE a (x TEXT) STRICT;', 'CREATE TABLE b (y TEXT) STRICT;']);

    expect(await version()).toBe(2);
    expect(await db.all('SELECT x FROM a', [])).toEqual([{ x: 'kept' }]);
    expect(await db.all('SELECT y FROM b', [])).toEqual([]);
  });

  it('leaves the database at its last good version when a migration fails', async () => {
    await expect(
      migrateUserDb(db, ['CREATE TABLE a (x TEXT) STRICT;', 'CREATE TABLE b (y TEXT); NOT SQL']),
    ).rejects.toThrow();

    expect(await version()).toBe(1);
    await expect(db.all('SELECT y FROM b', [])).rejects.toThrow();
  });

  it('refuses a database from a newer app version', async () => {
    await db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);

    await expect(migrateUserDb(db)).rejects.toThrow(/newer/);
  });
});

describe('user store', () => {
  it('keeps one device id for the install', async () => {
    const first = await (await openStore()).getDeviceId();

    const again = await createUserStore(db, randomUUID).getDeviceId();

    expect(again).toBe(first);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stores each event with an id, lemma, word, kind, time and device', async () => {
    const store = await openStore();

    const [recorded] = await store.record([
      { kind: 'known', lemmaId: 'رَحِيم', wordRef: fatiha, timestamp: 1_700_000_000_000 },
    ]);

    expect(await store.listEvents()).toEqual([
      {
        id: recorded.id,
        kind: 'known',
        lemmaId: 'رَحِيم',
        wordRef: fatiha,
        timestamp: 1_700_000_000_000,
        deviceId: await store.getDeviceId(),
      },
    ]);
  });

  it('stores a quiz answer with its rating, correctness and response time', async () => {
    const store = await openStore();
    const answer = {
      kind: 'review',
      lemmaId: 'رَحِيم',
      wordRef: fatiha,
      rating: 1,
      correct: false,
      responseTimeMs: 4200,
      timestamp: 9,
    } as const;

    const [recorded] = await store.record([answer]);

    expect(await store.listEvents()).toEqual([
      { ...answer, id: recorded.id, deviceId: await store.getDeviceId() },
    ]);
  });

  it('keeps a lemma added to review from a browsed ayah', async () => {
    const store = await openStore();
    const kursi = { surah: 2, ayah: 255, word: 6 };

    await store.record([{ kind: 'added', lemmaId: 'حَىّ', wordRef: kursi, timestamp: 7 }]);

    const [event] = await store.listEvents();
    expect(event).toMatchObject({ kind: 'added', lemmaId: 'حَىّ', wordRef: kursi, timestamp: 7 });
  });

  it('records where a session stopped, which has no lemma', async () => {
    const store = await openStore();

    await store.record([{ kind: 'completed', lemmaId: null, wordRef: fatiha, timestamp: 5 }]);

    const [event] = await store.listEvents();
    expect(event).toMatchObject({ kind: 'completed', lemmaId: null, wordRef: fatiha });
  });

  it('keeps the UTC offset an event was recorded at', async () => {
    const store = await openStore();

    await store.record([
      { kind: 'completed', lemmaId: null, wordRef: fatiha, timestamp: 5, utcOffsetMinutes: -480 },
    ]);

    const [event] = await store.listEvents();
    expect(event.utcOffsetMinutes).toBe(-480);
  });

  it('reads an event stored before offsets were, with no offset', async () => {
    await migrateUserDb(db, MIGRATIONS.slice(0, 2));
    await db.run(
      `INSERT INTO review_events (id, kind, lemma_id, surah, ayah, word, timestamp, device_id)
       VALUES ('old', 'completed', NULL, 1, 1, 4, 5, 'device-a')`,
      [],
    );

    const [event] = await (await openStore()).listEvents();

    expect(event).toEqual({
      id: 'old',
      kind: 'completed',
      lemmaId: null,
      wordRef: fatiha,
      timestamp: 5,
      deviceId: 'device-a',
    });
  });

  it('leaves out stored events that are not valid for their kind', async () => {
    const store = await openStore();
    const insert = (id: string, kind: string, lemma: string | null, rating: number | null = null) =>
      db.run(
        `INSERT INTO review_events
           (id, kind, lemma_id, surah, ayah, word, rating, correct, response_time_ms, timestamp,
            device_id)
         VALUES (?, ?, ?, 1, 1, 4, ?, ?, 100, 5, 'device-b')`,
        [id, kind, lemma, rating, rating === null ? null : 1],
      );
    await insert('learn-without-lemma', 'learn', null);
    await insert('known-without-lemma', 'known', null);
    await insert('review-without-lemma', 'review', null, 3);
    await insert('completed-with-lemma', 'completed', 'رَحِيم');
    await insert('good', 'learn', 'رَحِيم');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await store.listEvents();

    expect(events.map((e) => e.id)).toEqual(['good']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('4'));
    warn.mockRestore();
  });

  it('records a chosen start point on the path', async () => {
    const store = await openStore();
    const nas = { surah: 114, ayah: 1, word: 1 };

    await store.record([{ kind: 'start', lemmaId: null, wordRef: nas, timestamp: 3 }]);

    const [event] = await store.listEvents();
    expect(event).toMatchObject({ kind: 'start', lemmaId: null, wordRef: nas });
  });

  it('never overwrites an event: one added again with the same id is skipped', async () => {
    const store = await openStore();
    const event: LogEvent = {
      id: 'e1',
      kind: 'learn',
      lemmaId: 'رَحِيم',
      wordRef: fatiha,
      timestamp: 1,
      deviceId: 'other-device',
    };
    await store.addEvents([event]);

    await store.addEvents([event, { ...event, lemmaId: 'changed', timestamp: 2 }]);

    expect(await store.listEvents()).toEqual([event]);
  });

  it('keeps every write when several are made at once', async () => {
    const store = await openStore();
    const learn = (lemmaId: string, timestamp: number) =>
      store.record([
        { kind: 'learn', lemmaId, wordRef: fatiha, timestamp },
        { kind: 'learn', lemmaId: `${lemmaId}-2`, wordRef: fatiha, timestamp },
      ]);

    // Answers saved one by one as they are given, and a setting changed meanwhile.
    await Promise.all([
      learn('a', 1),
      learn('b', 2),
      store.saveSettings([{ key: 'theme', value: '"dark"' }], 3),
      learn('c', 4),
    ]);

    expect((await store.listEvents()).map((e) => e.lemmaId).sort()).toEqual([
      'a',
      'a-2',
      'b',
      'b-2',
      'c',
      'c-2',
    ]);
    expect(await store.listSettings()).toEqual([{ key: 'theme', value: '"dark"' }]);
  });

  it('keeps a setting saved while a failing write is rolled back', async () => {
    await migrateUserDb(db);
    // Each statement takes a moment, as on a device, so writes can overlap.
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    const slow = {
      ...db,
      run: async (...args: Parameters<typeof db.run>) => (await tick(), db.run(...args)),
    };
    const store = createUserStore(slow, randomUUID);
    await store.getDeviceId();
    const bad = { kind: 'learn', lemmaId: 'x', wordRef: fatiha, timestamp: Symbol() };

    const recording = store.record([
      { kind: 'learn', lemmaId: 'a', wordRef: fatiha, timestamp: 1 },
      bad as never,
    ]);
    await tick();
    const saving = store.saveSettings([{ key: 'theme', value: '"dark"' }], 2);
    const results = await Promise.allSettled([recording, saving]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(await store.listEvents()).toEqual([]);
    expect(await store.listSettings()).toEqual([{ key: 'theme', value: '"dark"' }]);
  });

  it('lists the log oldest first', async () => {
    const store = await openStore();

    await store.record([
      { kind: 'learn', lemmaId: 'b', wordRef: fatiha, timestamp: 20 },
      { kind: 'learn', lemmaId: 'a', wordRef: fatiha, timestamp: 10 },
    ]);

    expect((await store.listEvents()).map((e) => e.lemmaId)).toEqual(['a', 'b']);
  });
});

describe('settings in the user database', () => {
  it('starts with none stored', async () => {
    const store = await openStore();

    expect(await store.listSettings()).toEqual([]);
  });

  it('keeps the latest value of each setting', async () => {
    const store = await openStore();

    await store.saveSettings(
      [
        { key: 'theme', value: '"dark"' },
        { key: 'showTafsir', value: 'true' },
      ],
      1,
    );
    await store.saveSettings([{ key: 'theme', value: '"light"' }], 2);

    expect(await createUserStore(db, randomUUID).listSettings()).toEqual([
      { key: 'showTafsir', value: 'true' },
      { key: 'theme', value: '"light"' },
    ]);
    expect(await db.all('SELECT updated_at FROM settings WHERE key = ?', ['theme'])).toEqual([
      { updated_at: 2 },
    ]);
  });
});
