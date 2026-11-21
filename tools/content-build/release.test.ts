import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { parseManifest } from '../../src/content/update/policy.ts';
import { prepareContentRelease } from './release.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lisan-release-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function contentDatabase(version: string) {
  const file = join(dir, 'content.db');
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('content_version', version);
  db.close();
  return file;
}

const release = (dbFile: string, contentVersion = 6) =>
  prepareContentRelease({
    dbFile,
    outDir: join(dir, 'release'),
    contentVersion,
    schema: 1,
    repo: 'Krsho/Lisan',
  });

describe('content release', () => {
  it('writes the database and a manifest pointing at its release download', () => {
    const { manifest, files } = release(contentDatabase('6'));

    expect(files.map((file) => basename(file))).toEqual(['content-v6.db', 'content-manifest.json']);
    expect(manifest).toMatchObject({
      version: 6,
      schema: 1,
      url: 'https://github.com/Krsho/Lisan/releases/download/content-v6/content-v6.db',
    });
    expect(JSON.parse(readFileSync(files[1], 'utf8'))).toEqual(manifest);
  });

  it('describes the released file so the app accepts and verifies it', () => {
    const { manifest, files } = release(contentDatabase('6'));
    const released = readFileSync(files[0]);

    expect(parseManifest(manifest)).toEqual(manifest);
    expect(manifest.sha256).toBe(createHash('sha256').update(released).digest('hex'));
    expect(manifest.bytes).toBe(released.length);
  });

  it('refuses a database built for another content version', () => {
    expect(() => release(contentDatabase('5'), 6)).toThrow(/content version 5.*6/);
  });

  it('refuses a file that is not a sound content database', () => {
    const file = join(dir, 'content.db');
    writeFileSync(file, 'not a database');
    expect(() => release(file)).toThrow();
  });
});
