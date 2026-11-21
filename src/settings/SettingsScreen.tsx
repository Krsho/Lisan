import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { NEW_LEMMA_BUDGET, type Pace } from '../engine';
import { ReminderSettings } from '../reminder/ReminderControls';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { PACE_LABELS } from './pace';
import { useSettings, useUpdateSettings } from './SettingsContext';
import { ARABIC_FONT_SCALES, stepFontScale, type ThemePreference } from './settings';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PACES = Object.keys(NEW_LEMMA_BUDGET) as Pace[];

const SAMPLE = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

/** Reading settings, the daily pace and the reminder, applied at once and kept in the user database. */
export function SettingsScreen() {
  const colors = useColors();
  const settings = useSettings();
  const update = useUpdateSettings();
  const size = useQuranTextSize();
  const scale = settings.arabicFontScale;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Section title="Theme" colors={colors}>
        <View
          style={[styles.segments, { borderColor: colors.accent }]}
          accessibilityRole="radiogroup"
        >
          {THEMES.map(({ value, label }) => {
            const selected = settings.theme === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => update({ theme: value })}
                style={[styles.segment, selected && { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: selected ? colors.background : colors.accent }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>
          System follows your phone&apos;s light or dark mode.
        </Text>
      </Section>

      <Section title="Daily pace" colors={colors}>
        <View
          style={[styles.segments, { borderColor: colors.accent }]}
          accessibilityRole="radiogroup"
        >
          {PACES.map((value) => {
            const selected = settings.pace === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${PACE_LABELS[value]} pace`}
                onPress={() => update({ pace: value })}
                style={[styles.segment, selected && { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: selected ? colors.background : colors.accent }}>
                  {PACE_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {NEW_LEMMA_BUDGET[settings.pace]} new words a session, from the next one.
        </Text>
      </Section>

      <Section title="Reminder" colors={colors}>
        <ReminderSettings />
      </Section>

      <Section title="Arabic font size" colors={colors}>
        <View style={styles.sizeRow}>
          <SizeButton
            label="A−"
            accessibilityLabel="Smaller Arabic text"
            disabled={scale <= ARABIC_FONT_SCALES[0]}
            colors={colors}
            onPress={() => update({ arabicFontScale: stepFontScale(scale, -1) })}
          />
          <Text style={[styles.sizeValue, { color: colors.text }]}>{Math.round(scale * 100)}%</Text>
          <SizeButton
            label="A+"
            accessibilityLabel="Larger Arabic text"
            disabled={scale >= ARABIC_FONT_SCALES[ARABIC_FONT_SCALES.length - 1]}
            colors={colors}
            onPress={() => update({ arabicFontScale: stepFontScale(scale, 1) })}
          />
        </View>
        <Text
          style={[styles.sample, size.text(30, 56), { color: colors.text }]}
          accessibilityLabel="Sample of the Arabic text size"
        >
          {SAMPLE}
        </Text>
      </Section>

      <Section title="Shown by default" colors={colors}>
        <SwitchRow
          label="Translation"
          value={settings.showTranslation}
          colors={colors}
          onChange={(showTranslation) => update({ showTranslation })}
        />
        <SwitchRow
          label="Tafsir"
          value={settings.showTafsir}
          colors={colors}
          onChange={(showTafsir) => update({ showTafsir })}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>
          Hidden ones can still be opened on each ayah.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: Colors;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

type SizeButtonProps = {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  colors: Colors;
  onPress: () => void;
};

function SizeButton({ label, accessibilityLabel, disabled, colors, onPress }: SizeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.sizeButton, { borderColor: colors.accent, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[styles.sizeButtonText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

type SwitchRowProps = {
  label: string;
  value: boolean;
  colors: Colors;
  onChange: (value: boolean) => void;
};

function SwitchRow({ label, value, colors, onChange }: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  section: { gap: 10, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13 },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sizeButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  sizeButtonText: { fontSize: 16, fontWeight: '700' },
  sizeValue: { fontSize: 16, minWidth: 48, textAlign: 'center' },
  sample: { fontFamily: QURAN_FONT_FAMILY, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16 },
});
