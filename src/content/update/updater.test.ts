import { parseUpdateState } from './policy';
import type { ContentStore } from './updater';
import { checkForContentUpdate } from './updater';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const SHA = 'b'.repeat(64);

const manifest = {
  version: 6,
  schema: 1,
  url: 'https://example.com/content-v6.db',
  sha256: SHA,
  bytes: 100,
};

type FakeFile = { sha256: string; integrity: string; contentVersion: string | null };

/** An in-memory content store: installed databases, partial downloads and the state file. */
function fakeStore(options: { manifest?: unknown; download?: FakeFile | Error; state?: string }) {
  const files = new Map<string, FakeFile>();
  const partials = new Map<string, FakeFile>();
  const store: ContentStore & {
    state: string | null;
    files: Map<string, FakeFile>;
    partials: Map<string, FakeFile>;
  } = {
    state: options.state ?? null,
    files,
    partials,
    async readState() {
      return store.state;
    },
    async writeState(text: string) {
      store.state = text;
    },
    async fetchManifest() {
      if (options.manifest instanceof Error) throw options.manifest;
      return options.manifest ?? manifest;
    },
    async download(_url: string, databaseName: string) {
      const result = options.download ?? { sha256: SHA, integrity: 'ok', contentVersion: '6' };
      if (result instanceof Error) throw result;
      partials.set(databaseName, result);
    },
    async sha256(databaseName: string) {
      return partials.get(databaseName)!.sha256;
    },
    async probe(databaseName: string) {
      const { integrity, contentVersion } = partials.get(databaseName)!;
      return { integrity, contentVersion };
    },
    async install(databaseName: string) {
      files.set(databaseName, partials.get(databaseName)!);
      partials.delete(databaseName);
    },
    async discard(databaseName: string) {
      partials.delete(databaseName);
    },
  };
  return store;
}

const run = (store: ContentStore, activeVersion = 4) =>
  checkForContentUpdate(store, { activeVersion, supportedSchema: 1, now: NOW });

describe('checking for a content update', () => {
  it('downloads, verifies and installs a newer database, then points the app at it', async () => {
    const store = fakeStore({});

    await expect(run(store)).resolves.toEqual({ status: 'installed', version: 6 });

    expect([...store.files.keys()]).toEqual(['content-v6.db']);
    expect(JSON.parse(store.state!)).toEqual({ active: 6, checkedAt: NOW });
  });

  const previous = JSON.stringify({ active: 5, checkedAt: NOW - 2 * DAY });

  it.each([
    ['the download fails', { download: new Error('network lost') }],
    ['the file does not match the sha256', { download: { ...good(), sha256: 'c'.repeat(64) } }],
    ['the file is not a sound database', { download: { ...good(), integrity: 'malformed' } }],
    ['the file holds another content version', { download: { ...good(), contentVersion: '5' } }],
  ])('keeps the current database when %s', async (_, options) => {
    const store = fakeStore({ ...options, state: previous });

    await expect(run(store, 5)).resolves.toMatchObject({ status: 'failed' });

    expect(store.files.size).toBe(0);
    expect(store.partials.size).toBe(0);
    expect(parseUpdateState(store.state).active).toBe(5);
  });

  it('ignores a database with a schema this app build cannot read', async () => {
    const store = fakeStore({ manifest: { ...manifest, schema: 2 } });
    await expect(run(store)).resolves.toEqual({ status: 'up-to-date' });
    expect(store.files.size).toBe(0);
  });

  it('records the check when the open database is already the newest', async () => {
    const store = fakeStore({ state: previous });
    await expect(run(store, 6)).resolves.toEqual({ status: 'up-to-date' });
    expect(JSON.parse(store.state!)).toEqual({ active: 5, checkedAt: NOW });
  });

  it('checks at most once a day', async () => {
    const store = fakeStore({ state: JSON.stringify({ active: 5, checkedAt: NOW - DAY / 2 }) });
    await expect(run(store, 5)).resolves.toEqual({ status: 'not-due' });
    expect(store.files.size).toBe(0);
  });

  it.each([
    ['cannot be fetched', new Error('offline')],
    ['is not valid', { version: 6 }],
  ])('keeps the current database when the manifest %s', async (_, published) => {
    const store = fakeStore({ manifest: published, state: previous });
    await expect(run(store, 5)).resolves.toMatchObject({ status: 'failed' });
    expect(store.state).toBe(previous);
  });

  it('retries on the next start after a failure', async () => {
    const store = fakeStore({ download: new Error('network lost'), state: previous });
    await run(store, 5);
    expect(parseUpdateState(store.state).checkedAt).toBe(NOW - 2 * DAY);
  });
});

function good(): FakeFile {
  return { sha256: SHA, integrity: 'ok', contentVersion: '6' };
}
