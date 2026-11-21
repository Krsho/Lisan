// Pure rules for over-the-air content database updates: which manifests to trust, when to
// download, and which database to open. The file system and network live in expoContentStore.ts.

/** Describes the newest published content database. Served next to it as content-manifest.json. */
export type ContentManifest = {
  /** The database's content version (its meta `content_version`). */
  version: number;
  /** Table layout the database uses; the app opens only a schema it knows (CONTENT_SCHEMA). */
  schema: number;
  /** Where to download the database (https). */
  url: string;
  /** Lowercase hex SHA-256 of the database file. */
  sha256: string;
  /** Size of the database file in bytes. */
  bytes: number;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Validates a downloaded manifest. Returns null for anything the app should not act on. */
export function parseManifest(value: unknown): ContentManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const { version, schema, url, sha256, bytes } = value as Record<string, unknown>;
  if (!isPositiveInteger(version) || !isPositiveInteger(schema) || !isPositiveInteger(bytes)) {
    return null;
  }
  if (!isHttpsUrl(url)) return null;
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) return null;
  return { version, schema, url, sha256: sha256.toLowerCase(), bytes };
}

/**
 * Whether to download the manifest's database: it must be newer than the one open, and in a
 * table layout this app build reads. A newer schema waits for an app update that supports it.
 */
export const isUpdateWanted = (
  manifest: ContentManifest,
  activeVersion: number,
  supportedSchema: number,
) => manifest.version > activeVersion && manifest.schema === supportedSchema;

/** How often the app looks for new content. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const isCheckDue = (state: UpdateState, now: number) =>
  state.checkedAt === null || now - state.checkedAt >= CHECK_INTERVAL_MS || now < state.checkedAt;

/** The file name of a content database, bundled or downloaded, in the SQLite directory. */
export const contentDatabaseName = (version: number) => `content-v${version}.db`;

/**
 * What the app remembers about content updates, in a small file in app-private storage
 * (never the user database). `active` is the switch point: it names a downloaded database
 * only once that file is complete and verified.
 */
export type UpdateState = {
  /** Version of the downloaded database to open, if any. */
  active: number | null;
  /** When the manifest was last checked (ms since epoch). */
  checkedAt: number | null;
};

/** Reads the state file. A missing or damaged file means nothing was downloaded. */
export function parseUpdateState(text: string | null): UpdateState {
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    value = null;
  }
  if (typeof value !== 'object' || value === null) return { active: null, checkedAt: null };
  const { active, checkedAt } = value as Record<string, unknown>;
  return {
    active: isPositiveInteger(active) ? active : null,
    checkedAt: typeof checkedAt === 'number' && Number.isFinite(checkedAt) ? checkedAt : null,
  };
}

export type ActiveContent = {
  version: number;
  databaseName: string;
  /** Whether it is the database shipped in the app (opened from the bundled asset). */
  bundled: boolean;
};

/**
 * Picks the content database to open at startup: a downloaded one if it is newer than the
 * bundled one and its file is present, else the bundled one. An app update that bundles
 * newer content therefore wins over an older download.
 */
export function chooseActiveContent(
  bundledVersion: number,
  state: UpdateState,
  fileExists: (databaseName: string) => boolean,
): ActiveContent {
  const { active } = state;
  if (active !== null && active > bundledVersion && fileExists(contentDatabaseName(active))) {
    return { version: active, databaseName: contentDatabaseName(active), bundled: false };
  }
  return {
    version: bundledVersion,
    databaseName: contentDatabaseName(bundledVersion),
    bundled: true,
  };
}

const CONTENT_FILE = /^(content-v\d+\.db)(-wal|-shm|-journal|\.part)?$/;

/** Content databases (and their side files or partial downloads) other than the open one. */
export function staleContentFiles(fileNames: string[], activeDatabaseName: string): string[] {
  return fileNames.filter((name) => {
    const match = CONTENT_FILE.exec(name);
    return match !== null && (match[1] !== activeDatabaseName || match[2] === '.part');
  });
}
