import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createContentRepository } from '../../src/content/repository';
import { buildContentDatabase } from './build';
import { openSqlRunner } from './nodeSqlRunner';
import { parseQulWordByWord } from './qul';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const nfc = <T extends { text: string }>(items: T[]) =>
  items.map((item) => ({ ...item, text: item.text.normalize('NFC') }));

const sources = () => ({
  tanzilText: fixture('tanzil-al-fatiha.txt'),
  morphologyText: fixture('morphology-al-fatiha.txt'),
  // Al-Fatiha extract of QUL's English word-by-word file. One value (1:2:3) was given a trailing
  // space, as several real QUL values have (e.g. 3:2:1 "Allah ").
  glosses: { en: parseQulWordByWord(fixture('qul-english-word-by-word-al-fatiha.json')) },
});

let dir: string;
let openDatabases: { close(): void }[];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lisan-content-'));
  openDatabases = [];
});
afterEach(() => {
  openDatabases.forEach((db) => db.close());
  rmSync(dir, { recursive: true, force: true });
});

function openSqlRunnerTracked(file: string) {
  const db = openSqlRunner(file);
  openDatabases.push(db);
  return db;
}

function build(overrides: Partial<Parameters<typeof buildContentDatabase>[0]> = {}) {
  const outFile = join(dir, 'content.db');
  buildContentDatabase({ ...sources(), surahs: [1], contentVersion: 1, outFile, ...overrides });
  return createContentRepository(openSqlRunnerTracked(outFile));
}

describe('content build', () => {
  it('builds Al-Fatiha word by word with English glosses', async () => {
    const content = build();

    const ayahs = await content.getSurah(1, 'en');

    expect(ayahs).toHaveLength(7);
    // Tanzil's text is kept verbatim, and its mark order (e.g. shadda before fatha) differs from
    // how these literals were typed, so compare Unicode-normalized forms.
    expect(nfc(ayahs[0].words)).toEqual([
      { position: 1, text: 'بِسْمِ', gloss: 'In (the) name' },
      { position: 2, text: 'ٱللَّهِ', gloss: '(of) Allah' },
      { position: 3, text: 'ٱلرَّحْمَٰنِ', gloss: 'the Most Gracious' },
      { position: 4, text: 'ٱلرَّحِيمِ', gloss: 'the Most Merciful' },
    ]);
    expect(ayahs[6].words.map((w) => w.text)).toHaveLength(9);
  });

  it('uses QUL glosses without its ayah-number entries or stray whitespace', async () => {
    const content = build();

    const [, secondAyah] = await content.getSurah(1, 'en');

    expect(secondAyah.words.map((w) => w.gloss)).toEqual([
      'All praises and thanks',
      '(be) to Allah',
      'the Lord',
      'of the universe',
    ]);
  });

  it('keeps each word split into its morphological segments', async () => {
    const content = build();

    const segments = await content.getSegments({ surah: 1, ayah: 6, word: 1 });

    expect(nfc(segments)).toEqual([
      { position: 1, text: 'ٱهْدِ', pos: 'V', tags: ['IMPV', 'VF:1', 'ROOT:هدي', 'LEM:هَدَى', '2MS'] },
      { position: 2, text: 'نَا', pos: 'N', tags: ['PRON', 'SUFF', '1P'] },
    ]);
  });

  it('refuses to build when the text and morphology disagree on word count', () => {
    const morphologyMissingAWord = sources()
      .morphologyText.split('\n')
      .filter((line) => !line.startsWith('1:4:3:'))
      .join('\n');

    expect(() => build({ morphologyText: morphologyMissingAWord })).toThrow(
      'Word count mismatch in 1:4',
    );
  });

  it('leaves the previous database untouched when a build fails', async () => {
    const outFile = join(dir, 'content.db');
    const options = { ...sources(), surahs: [1], contentVersion: 1, outFile };
    buildContentDatabase(options);
    const brokenMorphology = sources()
      .morphologyText.split('\n')
      .filter((line) => !line.startsWith('1:4:3:'))
      .join('\n');

    expect(() => buildContentDatabase({ ...options, morphologyText: brokenMorphology })).toThrow(
      'Word count mismatch',
    );

    const content = createContentRepository(openSqlRunnerTracked(join(dir, 'content.db')));
    expect(await content.getSurah(1, 'en')).toHaveLength(7);
  });

  it('refuses glosses that do not line up with the words', () => {
    const glossForMissingWord = { ...sources().glosses.en, '1:4:4': 'extra' };

    expect(() => build({ glosses: { en: glossForMissingWord } })).toThrow(
      'en gloss 1:4:4 has no matching word',
    );
  });
});
