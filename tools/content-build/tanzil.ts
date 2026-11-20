export type TanzilAyah = { surah: number; ayah: number; text: string };

/** Parses Tanzil's `surah|ayah|text` export. The trailing `#` copyright block is kept verbatim. */
export function parseTanzil(text: string): { ayahs: TanzilAyah[]; copyright: string } {
  const ayahs: TanzilAyah[] = [];
  const copyright: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#')) {
      copyright.push(line);
      continue;
    }
    if (!line.trim()) continue;
    const [surah, ayah, ayahText] = line.split('|');
    ayahs.push({ surah: Number(surah), ayah: Number(ayah), text: ayahText.trim() });
  }
  return { ayahs, copyright: copyright.join('\n') };
}

/** Arabic letters. Tokens without any (pause marks such as ۖ or ۛ) are not words. */
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

export function splitWords(ayahText: string): string[] {
  return ayahText.split(/\s+/).filter((token) => ARABIC_LETTER.test(token));
}
