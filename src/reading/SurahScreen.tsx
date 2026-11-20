import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { useContent } from '../content/ContentProvider';
import type { Ayah } from '../content/repository';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

export function SurahScreen({ surah }: { surah: number }) {
  const content = useContent();
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    let cancelled = false;
    content.getSurah(surah, 'en').then((result) => {
      if (!cancelled) setAyahs(result);
    });
    return () => {
      cancelled = true;
    };
  }, [content, surah]);

  if (!ayahs) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {ayahs.map((ayah) => (
        <View key={ayah.ayah} style={[styles.ayah, { borderColor: colors.border }]}>
          <View style={styles.words}>
            {ayah.words.map((word) => (
              <View key={word.position} style={styles.word}>
                <Text style={[styles.arabic, { color: colors.text }]}>{word.text}</Text>
                <Text style={[styles.gloss, { color: colors.muted }]}>{word.gloss ?? '—'}</Text>
              </View>
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
  );
}

const lightColors = {
  background: '#fff',
  text: '#111',
  muted: '#555',
  accent: '#2f6f4e',
  border: '#e5e5e5',
};
const darkColors = {
  background: '#111',
  text: '#eee',
  muted: '#aaa',
  accent: '#7fc49d',
  border: '#2a2a2a',
};

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
