import { randomUUID } from 'node:crypto';

import type { ReviewEvent } from '../engine';
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

  it('records where a session stopped, which has no lemma', async () => {
    const store = await openStore();

    await store.record([{ kind: 'completed', lemmaId: null, wordRef: fatiha, timestamp: 5 }]);

    const [event] = await store.listEvents();
    expect(event).toMatchObject({ kind: 'completed', lemmaId: null, wordRef: fatiha });
  });

  it('never overwrites an event: one added again with the same id is skipped', async () => {
    const store = await openStore();
    const event: ReviewEvent = {
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
