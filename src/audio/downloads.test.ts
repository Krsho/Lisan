import {
  ayahFileName,
  ayahsToDownload,
  filesOfSurah,
  parseAyahFileName,
  runWithLimit,
  surahDownloadState,
} from './downloads';

it('names each ayah file by zero-padded surah and ayah, and reads the name back', () => {
  expect(ayahFileName({ surah: 2, ayah: 7 })).toBe('002007.mp3');
  expect(parseAyahFileName('002007.mp3')).toEqual({ surah: 2, ayah: 7 });
  for (const name of ['002007.mp3.tmp', 'notes.txt', '2007.mp3', '000001.mp3', '001000x.mp3']) {
    expect(parseAyahFileName(name)).toBeNull();
  }
});

// Al-Fatiha has 7 ayahs. Other surahs' files and stray files share the directory.
const files = ['001001.mp3', '001003.mp3', '002001.mp3', 'stray.tmp', '001009.mp3'];

it('counts only the files of the surah that belong to its ayahs', () => {
  expect(surahDownloadState(1, 7, files)).toEqual({ downloaded: 2, total: 7, complete: false });
  expect(surahDownloadState(3, 200, files)).toEqual({ downloaded: 0, total: 200, complete: false });
  const all = [1, 2, 3, 4, 5, 6, 7].map((ayah) => ayahFileName({ surah: 1, ayah }));
  expect(surahDownloadState(1, 7, all)).toEqual({ downloaded: 7, total: 7, complete: true });
});

it('lists the ayahs still missing, so an interrupted download resumes', () => {
  expect(ayahsToDownload(1, 7, files)).toEqual([2, 4, 5, 6, 7]);
});

it('removes every file of the surah and nothing else', () => {
  expect(filesOfSurah(1, files)).toEqual(['001001.mp3', '001003.mp3', '001009.mp3']);
});

it('runs work with at most the given number in flight', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const done: number[] = [];
  await runWithLimit([1, 2, 3, 4, 5], 2, async (n) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    done.push(n);
    inFlight--;
  });
  expect(maxInFlight).toBe(2);
  expect([...done].sort()).toEqual([1, 2, 3, 4, 5]);
});

it('stops starting new work after a failure and rejects with it', async () => {
  const started: number[] = [];
  await expect(
    runWithLimit([1, 2, 3, 4], 1, async (n) => {
      started.push(n);
      if (n === 2) throw new Error('offline');
    }),
  ).rejects.toThrow('offline');
  expect(started).toEqual([1, 2]);
});
