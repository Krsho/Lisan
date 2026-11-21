// Drafts linguistic notes for curriculum path ayahs with Claude, into content/notes/<language>/.
// Drafts are written with status "draft" for a maintainer to review; reviewed notes are never
// changed. Needs ANTHROPIC_API_KEY (or another Anthropic credential) and a built content database.
// See content/README.md, "Linguistic notes".
//
//   npm run notes:draft -- [--surah N] [--limit N] [--redraft] [--language en] [--model id] [--dry-run]
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { createContentRepository, type Language } from '../../src/content/repository.ts';
import {
  ayahsToDraft,
  DRAFT_SCHEMA,
  draftPrompt,
  mergeDrafts,
  parseDraft,
  type DraftInput,
} from './draft-notes.ts';
import { openSqlRunner } from './nodeSqlRunner.ts';
import { readNotesDirectory, serializeNotesFile, type NotesFile } from './notes.ts';

const DEFAULT_MODEL = 'claude-opus-5-5';

const ROOT = join(import.meta.dirname, '..', '..');
const CONTENT_DB = join(ROOT, 'assets', 'content', 'content.db');

const { values } = parseArgs({
  options: {
    surah: { type: 'string' },
    limit: { type: 'string' },
    redraft: { type: 'boolean', default: false },
    language: { type: 'string', default: 'en' },
    model: { type: 'string', default: DEFAULT_MODEL },
    'dry-run': { type: 'boolean', default: false },
  },
});
const language = values.language as Language;
const model = values.model;
const notesDir = join(ROOT, 'content', 'notes', language);
const fileFor = (surah: number) => join(notesDir, `${surah}.json`);

if (!existsSync(CONTENT_DB)) throw new Error(`Missing ${CONTENT_DB}. Run npm run content:build.`);
const db = openSqlRunner(CONTENT_DB);
const content = createContentRepository(db);

const files = new Map<number, NotesFile>(
  readNotesDirectory(join(ROOT, 'content', 'notes'))
    .filter((file) => file.language === language)
    .map((file) => [file.surah, file]),
);

const todo = ayahsToDraft(await content.getPath(), files, {
  redraft: values.redraft,
  surah: values.surah === undefined ? undefined : Number(values.surah),
  limit: values.limit === undefined ? undefined : Number(values.limit),
});
console.log(`Drafting ${todo.length} ayah(s) with ${model}`);

const surahNames = new Map((await content.listSurahs()).map((s) => [s.surah, s.nameEnglish]));

async function inputFor(surah: number, ayah: number): Promise<DraftInput> {
  const [ayahWords] = (await content.getSurah(surah, language)).filter((a) => a.ayah === ayah);
  const words = await Promise.all(
    ayahWords.words.map((w) => content.getWordDetails({ surah, ayah, word: w.position }, language)),
  );
  const translation =
    (await content.getTranslations(surah, language)).find((t) => t.ayah === ayah)?.translation ??
    null;
  return { surah, ayah, surahName: surahNames.get(surah) ?? String(surah), words, translation };
}

const client = values['dry-run'] ? null : new Anthropic();
let drafted = 0;
for (const { surah, ayah } of todo) {
  const input = await inputFor(surah, ayah);
  const { system, user } = draftPrompt(input, language);
  if (!client) {
    console.log(
      `--- ${surah}:${ayah} system ---\n${system}\n--- ${surah}:${ayah} user ---\n${user}`,
    );
    break; // One prompt is enough to check it.
  }

  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      // On a safety decline, retry on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      throw new Error('No valid Anthropic credential: set ANTHROPIC_API_KEY.', { cause: error });
    if (error instanceof Anthropic.APIError) {
      console.error(`${surah}:${ayah}: API error ${error.status}, skipped: ${error.message}`);
      continue;
    }
    throw error;
  }
  if (response.stop_reason !== 'end_turn') {
    console.error(`${surah}:${ayah}: stopped (${response.stop_reason}), skipped`);
    continue;
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let notes;
  try {
    notes = parseDraft(text, input.words.length);
  } catch (error) {
    console.error(`${surah}:${ayah}: unreadable answer, skipped`, error);
    continue;
  }

  const file = files.get(surah) ?? { language, surah, notes: [] };
  const merged = mergeDrafts(file, ayah, notes, response.model);
  files.set(surah, merged);
  // Written after every ayah, so an interrupted run keeps what it drafted.
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(fileFor(surah), serializeNotesFile(merged));
  drafted++;
  console.log(`${surah}:${ayah}: ${notes.length} note(s)`);
}
db.close();
if (client) console.log(`Drafted ${drafted} of ${todo.length} ayah(s) into ${notesDir}`);
