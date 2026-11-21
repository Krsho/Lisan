import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AyahTranslation as AyahTranslationData } from '../content/repository';
import { useSettings } from '../settings/SettingsContext';
import { useColors, type Colors } from '../theme/colors';

/**
 * An ayah's full translation with its footnotes, and its short tafsir. Each starts open or closed
 * as the settings say, until the learner toggles it. Both are shown exactly as QuranEnc publishes
 * them, so the tafsir keeps its "N. " prefix.
 */
export function AyahTranslation({ data }: { data: AyahTranslationData }) {
  const colors = useColors();
  const { showTranslation, showTafsir } = useSettings();
  // null follows the setting, so changing it applies to ayahs already on screen.
  const [translationToggled, setTranslationToggled] = useState<boolean | null>(null);
  const [tafsirToggled, setTafsirToggled] = useState<boolean | null>(null);
  const translationOpen = translationToggled ?? showTranslation;
  const tafsirOpen = tafsirToggled ?? showTafsir;
  const hasTranslation = Boolean(data.translation || data.footnotes);

  return (
    <View style={styles.container}>
      {hasTranslation ? (
        translationOpen ? (
          <>
            {data.translation ? (
              <Text style={[styles.translation, { color: colors.text }]}>{data.translation}</Text>
            ) : null}
            {data.footnotes ? (
              <Text style={[styles.footnotes, { color: colors.muted }]}>{data.footnotes}</Text>
            ) : null}
            {showTranslation ? null : (
              <Toggle
                label="Hide translation"
                expanded
                colors={colors}
                onPress={() => setTranslationToggled(false)}
              />
            )}
          </>
        ) : (
          <Toggle
            label="Show translation"
            expanded={false}
            colors={colors}
            onPress={() => setTranslationToggled(true)}
          />
        )
      ) : null}
      {data.tafsir ? (
        <View style={[styles.tafsir, { backgroundColor: colors.surface }]}>
          <Toggle
            label={tafsirOpen ? 'Hide tafsir' : 'Show tafsir'}
            expanded={tafsirOpen}
            colors={colors}
            onPress={() => setTafsirToggled(!tafsirOpen)}
          />
          {tafsirOpen ? (
            <Text style={[styles.tafsirText, { color: colors.text }]}>{data.tafsir}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type ToggleProps = { label: string; expanded: boolean; colors: Colors; onPress: () => void };

function Toggle({ label, expanded, colors, onPress }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      hitSlop={8}
    >
      <Text style={[styles.toggle, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 8 },
  translation: { fontSize: 16, lineHeight: 24 },
  footnotes: { fontSize: 13, lineHeight: 19 },
  tafsir: { borderRadius: 8, padding: 10, gap: 6 },
  toggle: { fontSize: 14, fontWeight: '600' },
  tafsirText: { fontSize: 15, lineHeight: 22 },
});
