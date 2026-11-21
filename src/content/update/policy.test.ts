import { chooseActiveContent, parseManifest, parseUpdateState, staleContentFiles } from './policy';

const SHA = 'a'.repeat(64);
const valid = {
  version: 5,
  schema: 1,
  url: 'https://github.com/Krsho/Lisan/releases/download/content-v5/content-v5.db',
  sha256: SHA,
  bytes: 1234,
};

describe('content manifest', () => {
  it('accepts a manifest with version, schema, https url and sha256', () => {
    expect(parseManifest(valid)).toEqual(valid);
  });

  it.each([
    ['not an object', 'content-v5.db'],
    ['no version', { ...valid, version: undefined }],
    ['a fractional version', { ...valid, version: 5.5 }],
    ['a version below 1', { ...valid, version: 0 }],
    ['a version given as text', { ...valid, version: '5' }],
    ['no schema', { ...valid, schema: undefined }],
    ['a plain-http url', { ...valid, url: 'http://example.com/content-v5.db' }],
    ['a url that is not one', { ...valid, url: 'content-v5.db' }],
    ['a short sha256', { ...valid, sha256: 'abc' }],
    ['a non-hex sha256', { ...valid, sha256: 'z'.repeat(64) }],
    ['no size', { ...valid, bytes: undefined }],
  ])('refuses a manifest with %s', (_, manifest) => {
    expect(parseManifest(manifest)).toBeNull();
  });

  it('normalises the sha256 to lowercase and ignores unknown fields', () => {
    expect(parseManifest({ ...valid, sha256: 'A'.repeat(64), notes: 'Fixes 2:3' })).toEqual({
      ...valid,
      sha256: 'a'.repeat(64),
    });
  });
});

describe('update state file', () => {
  it('reads the active downloaded version and the last check time', () => {
    expect(parseUpdateState('{"active":6,"checkedAt":1700000000000}')).toEqual({
      active: 6,
      checkedAt: 1700000000000,
    });
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['truncated', '{"active":6,'],
    ['not an object', '6'],
  ])('treats a %s state file as no downloaded content', (_, text) => {
    expect(parseUpdateState(text)).toEqual({ active: null, checkedAt: null });
  });

  it('ignores an active version that is not a positive integer', () => {
    expect(parseUpdateState('{"active":"6","checkedAt":5}')).toEqual({
      active: null,
      checkedAt: 5,
    });
  });
});

describe('choosing the content database to open', () => {
  const exists = (names: string[]) => (name: string) => names.includes(name);

  it('opens the bundled database when nothing has been downloaded', () => {
    expect(chooseActiveContent(4, { active: null, checkedAt: null }, exists([]))).toEqual({
      version: 4,
      databaseName: 'content-v4.db',
      bundled: true,
    });
  });

  it('opens a downloaded database that is newer than the bundled one', () => {
    expect(chooseActiveContent(4, { active: 6, checkedAt: 1 }, exists(['content-v6.db']))).toEqual({
      version: 6,
      databaseName: 'content-v6.db',
      bundled: false,
    });
  });

  it('falls back to the bundled database when the downloaded file is missing', () => {
    expect(chooseActiveContent(4, { active: 6, checkedAt: 1 }, exists([]))).toMatchObject({
      version: 4,
      bundled: true,
    });
  });

  it('prefers a newer bundled database once an app update ships one', () => {
    expect(
      chooseActiveContent(7, { active: 6, checkedAt: 1 }, exists(['content-v6.db'])),
    ).toMatchObject({ version: 7, bundled: true });
  });

  it('uses the bundled database when it has the same version as the download', () => {
    expect(
      chooseActiveContent(6, { active: 6, checkedAt: 1 }, exists(['content-v6.db'])),
    ).toMatchObject({ version: 6, bundled: true });
  });
});

describe('cleaning up old content databases', () => {
  it('removes every other content database with its side files, and leftover partial downloads', () => {
    const files = [
      'content-v4.db',
      'content-v5.db',
      'content-v5.db-wal',
      'content-v5.db-shm',
      'content-v6.db',
      'content-v6.db-journal',
      'content-v7.db.part',
      'user.db',
      'notes.txt',
    ];
    expect(staleContentFiles(files, 'content-v6.db')).toEqual([
      'content-v4.db',
      'content-v5.db',
      'content-v5.db-wal',
      'content-v5.db-shm',
      'content-v7.db.part',
    ]);
  });
});
