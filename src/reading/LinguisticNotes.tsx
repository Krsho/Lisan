import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useContent } from '../content/ContentProvider';
import type { Language, LinguisticNote, Word } from '../content/repository';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';

type Props = {
  notes: LinguisticNote[];
  /** The ayah's words, to name the word a note is about. */
  words: Word[];
};

/**
 * An ayah's approved linguistic notes: grammar authored for Lisan, labelled and styled apart from
 * the tafsir (which is QuranEnc's and shown verbatim). Renders nothing when there are none.
 */
export function LinguisticNotes({ notes, words }: Props) {
  const colors = useColors();
  if (notes.length === 0) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
    >
      <Text style={[styles.label, { color: colors.accent }]}>Linguistic note</Text>
      {notes.map((note) => {
        const word = note.word === null ? null : words.find((w) => w.position === note.word);
        return (
          <View key={note.word ?? 0} style={styles.note}>
            {word ? <Text style={[styles.word, { color: colors.text }]}>{word.bare}</Text> : null}
            <Text style={[styles.text, { color: colors.text }]}>{note.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Linguistic notes by `surah:ayah`; read them with `notesFor`. */
export type NotesByAyah = ReadonlyMap<string, LinguisticNote[]>;

const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;
const NO_NOTES: LinguisticNote[] = [];

export const notesFor = (notes: NotesByAyah, surah: number, ayah: number): LinguisticNote[] =>
  notes.get(ayahKey(surah, ayah)) ?? NO_NOTES;

/**
 * The approved linguistic notes of the given surahs. Empty until loaded, and if they cannot be
 * loaded: the notes are an extra, so the ayahs still show without them. The map is replaced
 * once they load, so a list can pass it as extraData.
 */
export function useLinguisticNotes(surahs: number[], language: Language): NotesByAyah {
  const content = useContent();
  const [notes, setNotes] = useState<NotesByAyah>(() => new Map());
  const key = surahs.join(',');

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(',').map(Number) : [];
    Promise.all(list.map((surah) => content.getNotes(surah, language))).then(
      (results) => {
        if (cancelled) return;
        const byAyah = new Map<string, LinguisticNote[]>();
        results.forEach((surahNotes, i) => {
          for (const note of surahNotes) {
            const k = ayahKey(list[i], note.ayah);
            byAyah.set(k, [...(byAyah.get(k) ?? []), note]);
          }
        });
        setNotes(byAyah);
      },
      (error: unknown) => console.error('Failed to load linguistic notes', error),
    );
    return () => {
      cancelled = true;
    };
  }, [content, key, language]);

  return notes;
}

const styles = StyleSheet.create({
  container: { marginTop: 8, borderLeftWidth: 3, borderRadius: 4, padding: 10, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  note: { gap: 2 },
  word: { fontFamily: QURAN_FONT_FAMILY, fontSize: 20, lineHeight: 36 },
  text: { fontSize: 15, lineHeight: 22 },
});
