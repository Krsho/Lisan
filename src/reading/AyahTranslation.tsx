import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AyahTranslation as AyahTranslationData } from '../content/repository';
import { useSettings } from '../settings/SettingsContext';
import { useColors, type Colors } from '../theme/colors';

type Props = { data: AyahTranslationData };

/**
 * An ayah's full translation with its footnotes, and its short tafsir. Each starts open or closed
 * as the settings say, until the learner toggles it. Both are shown exactly as QuranEnc publishes
 * them, so the tafsir keeps its "N. " prefix.
 */
export function AyahTranslation({ data }: Props) {
  return (
    <View style={styles.container}>
      <TranslationSection data={data} />
      <TafsirSection data={data} />
    </View>
  );
}

/** The translation and its footnotes, open or closed as the settings say until toggled. */
export function TranslationSection({ data }: Props) {
  const colors = useColors();
  const { showTranslation } = useSettings();
  // null follows the setting, so changing it applies to ayahs already on screen.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? showTranslation;
  if (!data.translation && !data.footnotes) return null;

  if (!open) {
    return (
      <Toggle
        label="Show translation"
        expanded={false}
        colors={colors}
        onPress={() => setToggled(true)}
      />
    );
  }
  return (
    <View style={styles.section}>
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
          onPress={() => setToggled(false)}
        />
      )}
    </View>
  );
}

/** The short tafsir, folded or open as the settings say until toggled. */
export function TafsirSection({ data }: Props) {
  const colors = useColors();
  const { showTafsir } = useSettings();
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? showTafsir;
  if (!data.tafsir) return null;

  return (
    <View style={[styles.tafsir, { backgroundColor: colors.surface }]}>
      <Toggle
        label={open ? 'Hide tafsir' : 'Show tafsir'}
        expanded={open}
        colors={colors}
        onPress={() => setToggled(!open)}
      />
      {open ? <Text style={[styles.tafsirText, { color: colors.text }]}>{data.tafsir}</Text> : null}
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
  section: { gap: 8 },
  translation: { fontSize: 16, lineHeight: 24 },
  footnotes: { fontSize: 13, lineHeight: 19 },
  tafsir: { borderRadius: 8, padding: 10, gap: 6 },
  toggle: { fontSize: 14, fontWeight: '600' },
  tafsirText: { fontSize: 15, lineHeight: 22 },
});
