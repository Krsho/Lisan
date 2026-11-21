/** A grammatical term's explanation in one language. */
export type TermTranslation = { name: string; definition: string };

/** Authored glossary (content/glossary.json): term key → Arabic term + per-language explanation. */
export type Glossary = Record<string, { ar: string } & Record<string, TermTranslation | string>>;

export function parseGlossary(json: string): Glossary {
  const glossary = JSON.parse(json) as Glossary;
  for (const [key, entry] of Object.entries(glossary)) {
    if (typeof entry.ar !== 'string' || !entry.ar) {
      throw new Error(`Glossary term ${key} has no Arabic name`);
    }
    for (const [language, translation] of Object.entries(entry)) {
      if (language === 'ar') continue;
      if (typeof translation !== 'object' || !translation.name || !translation.definition) {
        throw new Error(`Glossary term ${key} has an incomplete "${language}" entry`);
      }
    }
  }
  return glossary;
}

export function translationsOf(glossary: Glossary, key: string): [string, TermTranslation][] {
  return Object.entries(glossary[key]).filter(
    (entry): entry is [string, TermTranslation] => entry[0] !== 'ar',
  );
}
