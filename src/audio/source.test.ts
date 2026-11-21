import { audioSource, quranFoundationCdn } from './source';

it('builds the Quran Foundation per-ayah file URL for a reciter', () => {
  const source = quranFoundationCdn({ id: 'alafasy', name: 'Test', style: 'Murattal' }, 'Alafasy');
  expect(source.ayahUrl({ surah: 1, ayah: 1 })).toBe(
    'https://verses.quran.foundation/Alafasy/mp3/001001.mp3',
  );
  expect(source.ayahUrl({ surah: 2, ayah: 255 })).toBe(
    'https://verses.quran.foundation/Alafasy/mp3/002255.mp3',
  );
  expect(source.ayahUrl({ surah: 114, ayah: 6 })).toBe(
    'https://verses.quran.foundation/Alafasy/mp3/114006.mp3',
  );
});

it('refuses an ayah reference outside the Quran', () => {
  for (const ref of [
    { surah: 0, ayah: 1 },
    { surah: 115, ayah: 1 },
    { surah: 1, ayah: 0 },
    { surah: 2, ayah: 1.5 },
  ]) {
    expect(() => audioSource.ayahUrl(ref)).toThrow();
  }
});

it('uses Mishary Rashid Alafasy, credited to Quran Foundation', () => {
  expect(audioSource.reciter.name).toBe('Mishary Rashid Alafasy');
  expect(audioSource.provider.name).toBe('Quran Foundation');
});
