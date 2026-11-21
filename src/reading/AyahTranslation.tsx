import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AyahTranslation as AyahTranslationData } from '../content/repository';
import { useColors } from '../theme/colors';

/**
 * An ayah's full translation with its footnotes, and its short tafsir (collapsed until opened).
 * Both are shown exactly as QuranEnc publishes them, so the tafsir keeps its "N. " prefix.
 */
export function AyahTranslation({ data }: { data: AyahTranslationData }) {
  const colors = useColors();
  const [tafsirOpen, setTafsirOpen] = useState(false);

  return (
    <View style={styles.container}>
      {data.translation ? (
        <Text style={[styles.translation, { color: colors.text }]}>{data.translation}</Text>
      ) : null}
      {data.footnotes ? (
        <Text style={[styles.footnotes, { color: colors.muted }]}>{data.footnotes}</Text>
      ) : null}
      {data.tafsir ? (
        <View style={[styles.tafsir, { backgroundColor: colors.surface }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: tafsirOpen }}
            onPress={() => setTafsirOpen((open) => !open)}
            hitSlop={8}
          >
            <Text style={[styles.tafsirToggle, { color: colors.accent }]}>
              {tafsirOpen ? 'Hide tafsir' : 'Show tafsir'}
            </Text>
          </Pressable>
          {tafsirOpen ? (
            <Text style={[styles.tafsirText, { color: colors.text }]}>{data.tafsir}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 8 },
  translation: { fontSize: 16, lineHeight: 24 },
  footnotes: { fontSize: 13, lineHeight: 19 },
  tafsir: { borderRadius: 8, padding: 10, gap: 6 },
  tafsirToggle: { fontSize: 14, fontWeight: '600' },
  tafsirText: { fontSize: 15, lineHeight: 22 },
});
