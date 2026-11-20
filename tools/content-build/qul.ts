/** QUL marks the end of each ayah with an extra "word" holding the ayah number, e.g. "(7)". */
const AYAH_NUMBER = /^\(\d+\)$/;

/**
 * Parses QUL's word-by-word translation export: a JSON object mapping `surah:ayah:word` to a
 * gloss. Drops the ayah-number entries so word positions match the Quran text and morphology.
 */
export function parseQulWordByWord(json: string): Record<string, string> {
  const raw = JSON.parse(json) as Record<string, string>;
  const glosses: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const gloss = value.trim();
    if (!AYAH_NUMBER.test(gloss)) glosses[key] = gloss;
  }
  return glosses;
}
