import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createContentRepository } from '../../src/content/repository';
import { buildContentDatabase } from './build';
import { parseGlossary } from './glossary';
import { openSqlRunner } from './nodeSqlRunner';
import { parseQulWordByWord } from './qul';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const nfc = <T extends { text: string }>(items: T[]) =>
  items.map((item) => ({ ...item, text: item.text.normalize('NFC') }));

const sources = () => ({
  tanzilText: fixture('tanzil-sample.txt'),
  morphologyText: fixture('morphology-sample.txt'),
  // Al-Fatiha + 2:4 extract of QUL's English word-by-word file. One value (1:2:3) was given a
  // trailing space, as several real QUL values have (e.g. 3:2:1 "Allah ").
  glosses: { en: parseQulWordByWord(fixture('qul-english-word-by-word-sample.json')) },
  // The real, authored glossary: the build must be able to explain every tag in the sample.
  glossary: parseGlossary(
    readFileSync(join(__dirname, '..', '..', 'content', 'glossary.json'), 'utf8'),
  ),
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

  it('splits a word into its segments, each with its grammatical terms', async () => {
    const content = build({ surahs: [1, 2] });

    // وَبِٱلْـَٔاخِرَةِ "and in the Hereafter" = وَ + بِ + ٱلْ + ءَاخِرَةِ
    const word = await content.getWordDetails({ surah: 2, ayah: 4, word: 10 }, 'en');

    expect(word.gloss).toBe('and in the Hereafter');
    expect(
      nfc(word.segments).map(({ text, terms }) => ({ text, terms: terms.map((t) => t.key) })),
    ).toEqual([
      { text: 'وَ', terms: ['role.prefix', 'particle.resumption'] },
      { text: 'بِ', terms: ['role.prefix', 'particle.preposition'] },
      { text: 'ٱلْ', terms: ['role.prefix', 'particle.definite-article'] },
      {
        text: 'ءَاخِرَةِ',
        terms: ['role.stem', 'pos.noun', 'gender.feminine', 'number.singular', 'case.genitive'],
      },
    ]);
    // Prefixes have a dictionary form but no root; the stem has both.
    expect(word.segments.slice(0, 3).map((s) => s.root)).toEqual([null, null, null]);
    expect(word.segments[3].root).toBe('أخر');
  });

  it('links each stem to its lemma and root', async () => {
    const content = build();

    const word = await content.getWordDetails({ surah: 1, ayah: 5, word: 4 }, 'en');

    // نَسْتَعِينُ "we ask for help": form X imperfect verb from the root ع و ن
    expect(word.segments).toHaveLength(1);
    const [stem] = word.segments;
    expect(stem.root).toBe('عون');
    expect(stem.lemma?.normalize('NFC')).toBe('اسْتَعِينُ'.normalize('NFC'));
    expect(stem.terms.map((t) => t.key)).toEqual([
      'pos.verb',
      'aspect.imperfect',
      'form.10',
      'person.first',
      'number.plural',
      'mood.indicative',
    ]);
  });

  it('names every grammatical term in Arabic and in the explanation language', async () => {
    const content = build();

    const word = await content.getWordDetails({ surah: 1, ayah: 1, word: 1 }, 'en');
    const genitive = word.segments[1].terms.find((t) => t.key === 'case.genitive');

    expect(genitive).toMatchObject({ arabic: 'مجرور', name: 'genitive' });
    expect(genitive?.definition).toEqual(expect.stringContaining('noun'));
  });

  it('looks up glossary terms that are not tied to a word, such as root', async () => {
    const content = build();

    const root = await content.getTerm('concept.root', 'en');

    expect(root).toMatchObject({ key: 'concept.root', arabic: 'الجذر', name: 'root' });
  });

  it('refuses to build when the glossary is missing a term the words use', () => {
    const { 'case.genitive': _removed, ...glossaryWithoutGenitive } = sources().glossary;

    expect(() => build({ glossary: glossaryWithoutGenitive })).toThrow(
      'Glossary has no entry for term case.genitive',
    );
  });

  it('refuses morphology tags the glossary cannot explain', () => {
    const morphologyWithUnknownTag = sources().morphologyText.replace(
      '1:1:1:1\tبِ\tP\tP|PREF|LEM:ب',
      '1:1:1:1\tبِ\tP\tP|PREF|LEM:ب|MYSTERY',
    );

    expect(() => build({ morphologyText: morphologyWithUnknownTag })).toThrow(
      'Unknown morphology tag MYSTERY in 1:1:1:1',
    );
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
