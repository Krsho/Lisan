import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../content/ContentProvider';
import type { Ayah, WordRef } from '../content/repository';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';
import { WordDetailSheet } from './WordDetailSheet';

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

export function SurahScreen({ surah }: { surah: number }) {
  const content = useContent();
  const colors = useColors();
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordRef | null>(null);

  useEffect(() => {
    let cancelled = false;
    content.getSurah(surah, 'en').then(
      (result) => {
        if (!cancelled) setAyahs(result);
      },
      (error: unknown) => {
        console.error('Failed to load surah', surah, error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, surah]);

  if (!ayahs) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {failed ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load this surah.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        {ayahs.map((ayah) => (
          <View key={ayah.ayah} style={[styles.ayah, { borderColor: colors.border }]}>
            <View style={styles.words}>
              {ayah.words.map((word) => (
                <Pressable
                  key={word.position}
                  style={styles.word}
                  accessibilityRole="button"
                  accessibilityHint="Shows the word's grammar"
                  onPress={() => setSelectedWord({ surah, ayah: ayah.ayah, word: word.position })}
                >
                  <Text style={[styles.arabic, { color: colors.text }]}>{word.text}</Text>
                  <Text style={[styles.gloss, { color: colors.muted }]}>{word.gloss ?? '—'}</Text>
                </Pressable>
              ))}
              <View style={styles.word}>
                <Text style={[styles.arabic, { color: colors.accent }]}>
                  {`۝${toArabicDigits(ayah.ayah)}`}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <WordDetailSheet wordRef={selectedWord} onClose={() => setSelectedWord(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 64 },
  ayah: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  // Arabic reads right to left, so words flow from the right edge.
  words: { flexDirection: 'row-reverse', flexWrap: 'wrap', rowGap: 12, columnGap: 14 },
  word: { alignItems: 'center', maxWidth: 140 },
  arabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 30, lineHeight: 56 },
  gloss: { fontSize: 13, textAlign: 'center' },
});
