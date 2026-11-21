import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createContentRepository } from '../../src/content/repository';
import { buildContentDatabase } from './build';
import { parseGlossary } from './glossary';
import { openSqlRunner } from './nodeSqlRunner';
import { parseQulWordByWord } from './qul';
import { parseQuranEncResult, readQuranEncSqlite } from './quranenc';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const nfc = <T extends { text: string }>(items: T[]) =>
  items.map((item) => ({ ...item, text: item.text.normalize('NFC') }));

// QuranEnc ships Rowwad as SQLite; the fixture is an SQL dump of its Al-Fatiha and 2:4 rows.
function rowwadSqlite(): string {
  const file = join(dir, 'english_rwwad.sqlite');
  if (!existsSync(file)) {
    const db = new DatabaseSync(file);
    db.exec(fixture('quranenc-english_rwwad-sample.sql'));
    db.close();
  }
  return file;
}

const rowwadMeta = {
  key: 'english_rwwad',
  title: 'English Translation - Rowwad Translation Center',
  url: 'https://quranenc.com/en/browse/english_rwwad',
  version: '1.0.21',
  fetchedAt: '2026-11-21',
  sha256: '9ec339776c3a2bdab7dbd922d99ffd14a9e0699d62fca98741207ae73916524a',
};

// QuranEnc exposes no version for the English Mukhtasar.
const mukhtasarMeta = {
  key: 'english_mokhtasar',
  title: 'Al-Mukhtasar in Interpreting the Noble Quran - English',
  url: 'https://quranenc.com',
  version: null,
  fetchedAt: '2026-11-21',
  sha256: 'abc123',
};

const sources = () => ({
  translations: { en: { ...rowwadMeta, ayahs: readQuranEncSqlite(rowwadSqlite()) } },
  // Per-surah API results, as fetched (Al-Fatiha and 2:4).
  tafsirs: {
    en: {
      ...mukhtasarMeta,
      ayahs: parseQuranEncResult(fixture('quranenc-english_mokhtasar-sample.json')),
    },
  },
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

  it('attaches the English translation with its footnotes and the short tafsir to each ayah', async () => {
    const content = build();

    const ayahs = await content.getTranslations(1, 'en');

    expect(ayahs.map((a) => a.ayah)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ayahs[1]).toEqual({
      ayah: 2,
      translation: 'All praise be to Allah[1], the Lord[2] of the worlds[3],',
      footnotes:
        '[1] Allah is God’s most unique name.\n' +
        ' [2] The Arabic term "rabb" (translated as "Lord") includes all of the following meanings: "owner, master, ruler, controller, sustainer, provider, guardian and caretaker."\n' +
        ' [3] "the worlds" means mankind, jinn, and all that exists.',
      tafsir:
        '2. All praise belongs to Allah with regards to His essence, attributes and actions, because He is the Creator of everything. Everything belongs to Him and He is the disposer of their affairs; blessing individuals specifically and humans in general.',
    });
  });

  it('keeps translation and tafsir verbatim, including the tafsir’s ayah-number prefix', async () => {
    const content = build({ surahs: [1, 2] });

    const [opening] = await content.getTranslations(1, 'en');
    const [ayah4] = await content.getTranslations(2, 'en');

    expect(opening).toMatchObject({
      translation: 'In the name of Allah, the Most Compassionate, the Most Merciful.',
      footnotes: null,
    });
    expect(opening.tafsir).toMatch(/^1\. I begin by calling on Allah, Who is Ar-Raḥmān/);
    expect(ayah4).toMatchObject({
      ayah: 4,
      translation:
        'and those who believe in what has been sent down to you [O Prophet] and in what was sent down before you[5], and in the Hereafter they believe with certainty.',
      footnotes: '[5] i.e., the Taurāt (Torah) and the Injīl (Gospel), etc.',
    });
    expect(ayah4.tafsir).toMatch(/^4\. They believe in the revelation that Allah sent down/);
  });

  it('records each translation and tafsir with its source and version', async () => {
    const content = build();

    expect(await content.getEditions()).toEqual([
      {
        kind: 'translation',
        language: 'en',
        key: 'english_rwwad',
        title: 'English Translation - Rowwad Translation Center',
        url: 'https://quranenc.com/en/browse/english_rwwad',
        version: '1.0.21',
        fetchedAt: '2026-11-21',
      },
      {
        kind: 'tafsir',
        language: 'en',
        key: 'english_mokhtasar',
        title: 'Al-Mukhtasar in Interpreting the Noble Quran - English',
        url: 'https://quranenc.com',
        version: null,
        fetchedAt: '2026-11-21',
      },
    ]);
  });

  it('refuses a translation that is missing an ayah', () => {
    const { translations } = sources();
    const without1v5 = translations.en.ayahs.filter((a) => !(a.surah === 1 && a.ayah === 5));

    expect(() =>
      build({ translations: { en: { ...translations.en, ayahs: without1v5 } } }),
    ).toThrow('en translation english_rwwad is missing 1:5');
  });

  it('refuses a tafsir for an ayah the text does not have', () => {
    const { tafsirs } = sources();
    const extra = { surah: 1, ayah: 8, text: '8. ...', footnotes: null };

    expect(() =>
      build({ tafsirs: { en: { ...tafsirs.en, ayahs: [...tafsirs.en.ayahs, extra] } } }),
    ).toThrow('en tafsir english_mokhtasar has 1:8, which is not in the text');
  });

  it('refuses glosses that do not line up with the words', () => {
    const glossForMissingWord = { ...sources().glosses.en, '1:4:4': 'extra' };

    expect(() => build({ glosses: { en: glossForMissingWord } })).toThrow(
      'en gloss 1:4:4 has no matching word',
    );
  });
});
