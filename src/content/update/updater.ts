// Over-the-air content update: check the manifest, download, verify, then switch the pointer.
// Decisions are pure (policy.ts); the file system and network sit behind ContentStore.
import {
  contentDatabaseName,
  isCheckDue,
  isUpdateWanted,
  parseManifest,
  parseUpdateState,
  type ContentManifest,
  type UpdateState,
} from './policy';

/** File system and network access the update needs. Databases are named by their final name. */
export type ContentStore = {
  /** The state file's text, or null if there is none. */
  readState(): Promise<string | null>;
  /** Replaces the state file atomically (write a temporary file, then rename). */
  writeState(text: string): Promise<void>;
  /** The parsed JSON of the published manifest. */
  fetchManifest(): Promise<unknown>;
  /** Downloads to a partial file for `databaseName`, never to the final name. */
  download(url: string, databaseName: string): Promise<void>;
  /** Size of the partial file in bytes. */
  size(databaseName: string): Promise<number>;
  /** Lowercase hex SHA-256 of the partial file. */
  sha256(databaseName: string): Promise<string>;
  /** Opens the partial file as SQLite: `PRAGMA integrity_check` and its meta content_version. */
  probe(databaseName: string): Promise<{ integrity: string; contentVersion: string | null }>;
  /** Renames the verified partial file to `databaseName`. */
  install(databaseName: string): Promise<void>;
  /** Deletes the partial file, if any. */
  discard(databaseName: string): Promise<void>;
};

export type UpdateResult =
  | { status: 'installed'; version: number }
  | { status: 'up-to-date' }
  | { status: 'not-due' }
  | { status: 'failed'; reason: string };

export type UpdateOptions = {
  /** Version of the database the app has open. */
  activeVersion: number;
  /** The table layout this app build can read (CONTENT_SCHEMA). */
  supportedSchema: number;
  now: number;
};

const serialise = (state: UpdateState) => JSON.stringify(state);

/** Why a downloaded database must not be used, or null if it is the one the manifest names. */
async function verify(
  store: ContentStore,
  name: string,
  manifest: ContentManifest,
): Promise<string | null> {
  const bytes = await store.size(name);
  if (bytes !== manifest.bytes) return `size ${bytes} bytes, manifest says ${manifest.bytes}`;
  if ((await store.sha256(name)) !== manifest.sha256) return 'sha256 mismatch';
  const { integrity, contentVersion } = await store.probe(name);
  if (integrity !== 'ok') return `integrity check: ${integrity}`;
  if (Number(contentVersion) !== manifest.version) {
    return `database holds content version ${contentVersion}, manifest says ${manifest.version}`;
  }
  return null;
}

/**
 * Installs a newer content database if one is published. The old database stays active
 * until the new one is downloaded, verified and in place; any failure leaves it untouched.
 * The installed database is opened on the next app start.
 */
export async function checkForContentUpdate(
  store: ContentStore,
  { activeVersion, supportedSchema, now }: UpdateOptions,
): Promise<UpdateResult> {
  const state = parseUpdateState(await store.readState());
  if (!isCheckDue(state, now)) return { status: 'not-due' };

  let manifest: ContentManifest | null;
  try {
    manifest = parseManifest(await store.fetchManifest());
  } catch (error) {
    return { status: 'failed', reason: `manifest: ${String(error)}` };
  }
  if (!manifest) return { status: 'failed', reason: 'invalid manifest' };
  if (!isUpdateWanted(manifest, activeVersion, supportedSchema, state)) {
    await store.writeState(serialise({ ...state, checkedAt: now }));
    return { status: 'up-to-date' };
  }

  const name = contentDatabaseName(manifest.version);
  try {
    await store.download(manifest.url, name);
    const problem = await verify(store, name, manifest);
    if (problem) {
      await store.discard(name);
      return { status: 'failed', reason: problem };
    }
    await store.install(name);
  } catch (error) {
    await store.discard(name).catch(() => {});
    return { status: 'failed', reason: String(error) };
  }
  // The switch point: only now does the state name the new database.
  await store.writeState(serialise({ ...state, active: manifest.version, checkedAt: now }));
  return { status: 'installed', version: manifest.version };
}
