// Thin file-system and network adapter for content updates (expo-file-system + expo-sqlite).
// All decisions are in policy.ts and updater.ts; this file is verified on a device, not in Jest.
import { Directory, File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';

import { CONTENT_MANIFEST_URL } from './config';
import { staleContentFiles } from './policy';
import type { ContentStore } from './updater';

// expo-sqlite gives a plain path; expo-file-system wants a file:// URI.
const sqliteDirectoryPath: string = defaultDatabaseDirectory;
const sqliteDirectory = () =>
  new Directory(
    sqliteDirectoryPath.startsWith('file://')
      ? sqliteDirectoryPath
      : `file://${sqliteDirectoryPath}`,
  );
const partName = (databaseName: string) => `${databaseName}.part`;
const partFile = (databaseName: string) => new File(sqliteDirectory(), partName(databaseName));

// The update state lives in app-private documents, apart from the user database.
const STATE_FILE = 'content-update.json';
const stateFile = () => new File(Paths.document, STATE_FILE);

/** The update state file's text, read synchronously so the right database opens on first render. */
export function readUpdateStateSync(): string | null {
  try {
    const file = stateFile();
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

export const contentDatabaseExists = (databaseName: string) =>
  new File(sqliteDirectory(), databaseName).exists;

/** Deletes a downloaded database that failed to open, so the next start uses the bundled one. */
export function deleteContentDatabase(databaseName: string) {
  const file = new File(sqliteDirectory(), databaseName);
  if (file.exists) file.delete();
}

/** Deletes content databases other than the open one. They are never open, so this is safe. */
export function removeStaleContentFiles(activeDatabaseName: string) {
  const directory = sqliteDirectory();
  if (!directory.exists) return;
  const names = directory.list().map((entry) => entry.name);
  for (const name of staleContentFiles(names, activeDatabaseName)) {
    try {
      new File(directory, name).delete();
    } catch (error) {
      console.warn(`Could not delete old content file ${name}`, error);
    }
  }
}

export const expoContentStore: ContentStore = {
  async readState() {
    const file = stateFile();
    return file.exists ? file.text() : null;
  },

  async writeState(text) {
    const temp = new File(Paths.document, `${STATE_FILE}.tmp`);
    temp.create({ overwrite: true });
    await temp.write(text);
    // Same-directory rename: the state file is either the old one or the new one, never partial.
    await temp.move(stateFile(), { overwrite: true });
  },

  async fetchManifest() {
    const response = await fetch(CONTENT_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async download(url, databaseName) {
    sqliteDirectory().create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, partFile(databaseName), { idempotent: true });
  },

  size: async (databaseName) => partFile(databaseName).size,

  sha256: (databaseName) => partFile(databaseName).digest('SHA-256'),

  async probe(databaseName) {
    const db = await openDatabaseAsync(
      partName(databaseName),
      { useNewConnection: true },
      sqliteDirectoryPath,
    );
    try {
      const integrity = await db.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check',
      );
      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = 'content_version'",
      );
      return {
        integrity: integrity?.integrity_check ?? 'no result',
        contentVersion: version?.value ?? null,
      };
    } finally {
      await db.closeAsync();
    }
  },

  async install(databaseName) {
    // Same-directory rename, so the final name only ever holds a complete, verified file.
    await partFile(databaseName).move(new File(sqliteDirectory(), databaseName), {
      overwrite: true,
    });
  },

  async discard(databaseName) {
    const file = partFile(databaseName);
    if (file.exists) file.delete();
  },
};
