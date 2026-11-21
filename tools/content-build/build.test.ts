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

// QuranEnc ships Rowwad as SQLite; the fixture is an SQL dump of its rows for the sample ayahs.
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
  // Rows of KFGQPC's hafsData_v2-0.json, unmodified: Al-Fatiha, 2:1, 2:2, 2:4, 2:181, 9:1, 15:7,
  // 70:19, 113:1, 114:1 and 114:2.
  quranText: fixture('kfgqpc-sample.json'),
  translations: { en: { ...rowwadMeta, ayahs: readQuranEncSqlite(rowwadSqlite()) } },
  // Per-surah API results, as fetched, for the same ayahs.
  tafsirs: {
    en: {
      ...mukhtasarMeta,
      ayahs: parseQuranEncResult(fixture('quranenc-english_mokhtasar-sample.json')),
    },
  },
  // The corpus morphology for the same ayahs.
  morphologyText: fixture('morphology-sample.txt'),
  // The same ayahs from QUL's English word-by-word file. One value (1:2:3) was given a trailing
  // space, as several real QUL values have (e.g. 3:2:1 "Allah ").
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
  buildContentDatabase({ ...sources(), contentVersion: 1, outFile, ...overrides });
  return createContentRepository(openSqlRunnerTracked(outFile));
}

const withoutMorphologyFor = (prefix: string) =>
  sources()
    .morphologyText.split('\n')
    .filter((line) => !line.startsWith(prefix))
    .join('\n');

describe('content build', () => {
  it('builds Al-Fatiha word by word from the KFGQPC text with English glosses', async () => {
    const content = build();

    const ayahs = await content.getSurah(1, 'en');

    expect(ayahs).toHaveLength(7);
    // KFGQPC's text is kept verbatim (e.g. its small high sukun ۡ), and its mark order differs
    // from how these literals were typed, so compare Unicode-normalized forms.
    expect(
      nfc(ayahs[0].words).map(({ position, text, gloss }) => ({ position, text, gloss })),
    ).toEqual([
      { position: 1, text: 'بِسۡمِ', gloss: 'In (the) name' },
      { position: 2, text: 'ٱللَّهِ', gloss: '(of) Allah' },
      { position: 3, text: 'ٱلرَّحۡمَٰنِ', gloss: 'the Most Gracious' },
      { position: 4, text: 'ٱلرَّحِيمِ', gloss: 'the Most Merciful' },
    ]);
    expect(ayahs[6].words).toHaveLength(9);
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

  it('leaves out the ayah-end glyph and the rubʿ al-ḥizb mark ۞, which are not words', async () => {
    const content = build();

    const ayahs = await content.getSurah(70, 'en');

    // ۞ إِنَّ ٱلۡإِنسَٰنَ خُلِقَ هَلُوعًا ﰒ
    expect(ayahs.map((a) => a.ayah)).toEqual([19]);
    expect(nfc(ayahs[0].words).map((w) => w.text)).toEqual(
      ['إِنَّ', 'ٱلۡإِنسَٰنَ', 'خُلِقَ', 'هَلُوعًا'].map((t) => t.normalize('NFC')),
    );
  });

  it('keeps pause marks on the word as KFGQPC writes them, with a bare form without them', async () => {
    const content = build();

    const [ayah] = (await content.getSurah(2, 'en')).filter((a) => a.ayah === 2);

    // ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ ...: the muʿānaqa marks ۛ sit on words 4 and 5.
    const [, , , rayba, fihi] = nfc(ayah.words);
    expect(rayba.text).toBe('رَيۡبَۛ'.normalize('NFC'));
    expect(rayba.bare.normalize('NFC')).toBe('رَيۡبَ'.normalize('NFC'));
    expect(fihi.bare.normalize('NFC')).toBe('فِيهِ'.normalize('NFC'));
    expect(ayah.words[0].bare).toBe(ayah.words[0].text);
  });

  it('shows two text tokens as one word where the corpus counts one (بَعۡدَ مَا in 2:181)', async () => {
    const content = build();

    const [ayah] = (await content.getSurah(2, 'en')).filter((a) => a.ayah === 181);
    const word = await content.getWordDetails({ surah: 2, ayah: 181, word: 3 }, 'en');

    expect(ayah.words).toHaveLength(13);
    expect(word.text.normalize('NFC')).toBe('بَعۡدَ مَا'.normalize('NFC'));
    expect(word.gloss).toBe('after what');
    expect(nfc(word.segments).map((s) => s.text)).toEqual(
      ['بَعْدَ', 'مَا'].map((t) => t.normalize('NFC')),
    );
    // The words after it keep their own glosses.
    expect(ayah.words[3].gloss).toBe('he (has) heard [it]');
    expect(ayah.words[12].gloss).toBe('All-Knowing');
  });

  it('shows one text token covering two corpus words with the segments of both (لَّوۡمَا in 15:7)', async () => {
    const content = build();

    const [ayah] = await content.getSurah(15, 'en');
    const word = await content.getWordDetails({ surah: 15, ayah: 7, word: 1 }, 'en');

    expect(ayah.words).toHaveLength(7);
    expect(word.gloss).toBe('Why not');
    expect(nfc(word.segments).map((s) => s.text)).toEqual(
      ['لَّوْ', 'مَا'].map((t) => t.normalize('NFC')),
    );
    expect(word.segments.map((s) => s.position)).toEqual([1, 2]);
    expect(word.segments[1].terms.map((t) => t.key)).toEqual(['particle.negative']);
    expect(ayah.words[1].gloss).toBe('you bring to us');
  });

  it('lists the surahs with their names, ayah counts and whether a Basmala heads them', async () => {
    const content = build();

    const surahs = await content.listSurahs();

    expect(surahs.map((s) => s.surah)).toEqual([1, 2, 9, 15, 70, 113, 114]);
    expect(surahs[0]).toEqual({
      surah: 1,
      nameEnglish: 'Al-Fātiḥah',
      nameArabic: 'الفَاتِحة',
      ayahCount: 7,
      // In Al-Fatiha the Basmala is ayah 1, not a header.
      hasBasmala: false,
    });
    expect(surahs.map((s) => s.hasBasmala)).toEqual([false, true, false, true, true, true, true]);
  });

  it('orders the curated path: Al-Fatiha, then Juz’ ʿAmma from An-Nas backwards', async () => {
    const content = build();

    const path = await content.getPath();

    // Only path surahs that the sample contains: 2, 9, 15 and 70 are not on the path.
    expect(path.map((a) => `${a.surah}:${a.ayah}`)).toEqual([
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
      '114:1',
      '114:2',
      '113:1',
    ]);
  });

  it('lists the lemmas of every word on the path, prefixes included', async () => {
    const content = build();

    const path = await content.getPath();
    const nas1 = path.find((a) => a.surah === 114 && a.ayah === 1)!;

    // قُلۡ أَعُوذُ بِرَبِّ ٱلنَّاسِ
    expect(nas1.words.map((w) => w.position)).toEqual([1, 2, 3, 4]);
    expect(nas1.words[2].lemmas.map((l) => l.normalize('NFC'))).toEqual(['ب', 'رَبّ'].map((l) => l.normalize('NFC')));
  });

  it('gives the Basmala header the words of 1:1, linked to their details there', async () => {
    const content = build();

    const basmala = await content.getBasmala('en');

    expect(basmala.map((w) => w.ref)).toEqual(
      [1, 2, 3, 4].map((word) => ({ surah: 1, ayah: 1, word })),
    );
    expect(basmala[0].gloss).toBe('In (the) name');
  });

  it('counts how often each lemma occurs', async () => {
    const content = build();

    // رَحِيم occurs twice in the sample: 1:1 and 1:3.
    const word = await content.getWordDetails({ surah: 1, ayah: 1, word: 4 }, 'en');
    const stem = word.segments[1];

    expect(stem.root).toBe('رحم');
    expect(stem.lemmaFrequency).toBe(2);
  });

  it('splits a word into its segments, each with its grammatical terms', async () => {
    const content = build();

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
    expect(() => build({ morphologyText: withoutMorphologyFor('1:4:3:') })).toThrow(
      'Word count mismatch in 1:4',
    );
  });

  it('refuses a mismatch the word alignment table does not explain', () => {
    expect(() => build({ alignment: {} })).toThrow('Word count mismatch in 2:181');
  });

  it('refuses an alignment entry that no longer fits the text', () => {
    expect(() =>
      build({ alignment: { '1:2': [{ tokens: [1, 2], words: [1, 1], glosses: [1, 1] }] } }),
    ).toThrow('Word alignment for 1:2');
  });

  it('refuses morphology for an ayah the text does not have', () => {
    const extra = `${sources().morphologyText}\n3:1:1:1\tالٓمٓ\tP\tINL|LEM:الم`;

    expect(() => build({ morphologyText: extra })).toThrow('Morphology has words for 3:1');
  });

  it('leaves the previous database untouched when a build fails', async () => {
    const outFile = join(dir, 'content.db');
    const options = { ...sources(), contentVersion: 1, outFile };
    buildContentDatabase(options);

    expect(() =>
      buildContentDatabase({ ...options, morphologyText: withoutMorphologyFor('1:4:3:') }),
    ).toThrow('Word count mismatch');

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
    const content = build();

    const [opening] = await content.getTranslations(1, 'en');
    const [ayah4] = (await content.getTranslations(2, 'en')).filter((a) => a.ayah === 4);

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
