import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AttributionScreen } from '../about/AttributionScreen';
import { useContent } from '../content/ContentProvider';
import type { Ayah, AyahTranslation as AyahTranslationData, WordRef } from '../content/repository';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';
import { AyahTranslation } from './AyahTranslation';
import { WordDetailSheet } from './WordDetailSheet';

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

export function SurahScreen({ surah }: { surah: number }) {
  const content = useContent();
  const colors = useColors();
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [translations, setTranslations] = useState<Map<number, AyahTranslationData>>(new Map());
  const [failed, setFailed] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordRef | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([content.getSurah(surah, 'en'), content.getTranslations(surah, 'en')]).then(
      ([words, texts]) => {
        if (cancelled) return;
        setAyahs(words);
        setTranslations(new Map(texts.map((t) => [t.ayah, t])));
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
        {/* Temporary entry point until the app has navigation. */}
        <Pressable
          style={styles.about}
          accessibilityRole="button"
          onPress={() => setAboutOpen(true)}
          hitSlop={8}
        >
          <Text style={{ color: colors.accent }}>About and sources</Text>
        </Pressable>
        {ayahs.map((ayah) => {
          const translation = translations.get(ayah.ayah);
          return (
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
              {translation ? <AyahTranslation data={translation} /> : null}
            </View>
          );
        })}
      </ScrollView>
      <WordDetailSheet wordRef={selectedWord} onClose={() => setSelectedWord(null)} />
      <Modal
        visible={aboutOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAboutOpen(false)}
      >
        <View style={[styles.aboutSheet, { backgroundColor: colors.background }]}>
          <Pressable
            style={styles.close}
            accessibilityRole="button"
            onPress={() => setAboutOpen(false)}
            hitSlop={8}
          >
            <Text style={{ color: colors.accent }}>Close</Text>
          </Pressable>
          <AttributionScreen />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 64 },
  about: { alignSelf: 'flex-end' },
  aboutSheet: { flex: 1, paddingTop: 16 },
  close: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  ayah: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  // Arabic reads right to left, so words flow from the right edge.
  words: { flexDirection: 'row-reverse', flexWrap: 'wrap', rowGap: 12, columnGap: 14 },
  word: { alignItems: 'center', maxWidth: 140 },
  arabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 30, lineHeight: 56 },
  gloss: { fontSize: 13, textAlign: 'center' },
});
