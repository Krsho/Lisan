// Prepares a content release: the content database under its versioned name and the manifest
// the app downloads (see src/content/update). Publishing them on GitHub is a human step;
// see content/README.md, "Content updates".
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  contentDatabaseName,
  parseManifest,
  type ContentManifest,
} from '../../src/content/update/policy.ts';

export type ReleaseOptions = {
  /** The built content database (assets/content/content.db). */
  dbFile: string;
  outDir: string;
  /** CONTENT_VERSION: the database must carry it. */
  contentVersion: number;
  /** CONTENT_SCHEMA of the app build the database is made for. */
  schema: number;
  /** GitHub repository (owner/name) whose releases host the files. */
  repo: string;
};

/** Checks the database the way the app will before switching to it. Throws if it is unfit. */
function checkDatabase(dbFile: string, contentVersion: number) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    const { integrity_check } = db.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };
    if (integrity_check !== 'ok') throw new Error(`${dbFile} integrity check: ${integrity_check}`);
    const row = db.prepare("SELECT value FROM meta WHERE key = 'content_version'").get() as
      { value: string } | undefined;
    if (Number(row?.value) !== contentVersion) {
      throw new Error(
        `${dbFile} holds content version ${row?.value}, but CONTENT_VERSION is ${contentVersion}. Rebuild it with npm run content:build.`,
      );
    }
  } finally {
    db.close();
  }
}

/** Writes content-vN.db and content-manifest.json to outDir. */
export function prepareContentRelease(options: ReleaseOptions) {
  const { dbFile, outDir, contentVersion, schema, repo } = options;
  checkDatabase(dbFile, contentVersion);

  const name = contentDatabaseName(contentVersion);
  mkdirSync(outDir, { recursive: true });
  const dbOut = join(outDir, name);
  copyFileSync(dbFile, dbOut);
  const bytes = readFileSync(dbOut);

  const manifest = parseManifest({
    version: contentVersion,
    schema,
    url: `https://github.com/${repo}/releases/download/content-v${contentVersion}/${name}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  } satisfies ContentManifest);
  if (!manifest) throw new Error('The release manifest would not pass the app’s checks');

  const manifestOut = join(outDir, 'content-manifest.json');
  writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, files: [dbOut, manifestOut] };
}
