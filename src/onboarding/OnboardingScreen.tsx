import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CenteredStatus } from '../async/CenteredStatus';
import { currentNow } from '../clock/clock';
import { useSurahs } from '../content/useSurahs';
import { chooseStart, NEW_LEMMA_BUDGET, type Content, type Pace } from '../engine';
import { PACE_LABELS } from '../settings/pace';
import { useUpdateSettings } from '../settings/SettingsContext';
import { usePath } from '../session/usePath';
import { useColors } from '../theme/colors';
import { useEventLog } from '../user/UserStoreProvider';

/**
 * First launch: what the app assumes, the pace, and optionally a later start point on the path.
 * No account is needed; finishing it stores the choices and opens today's session.
 */
export function OnboardingScreen() {
  const path = usePath();
  if (path.status !== 'loaded') {
    return <CenteredStatus failed={path.status === 'failed'} message="Couldn't load the path." />;
  }
  return <Onboarding content={path.data} />;
}

function Onboarding({ content }: { content: Content }) {
  const colors = useColors();
  const update = useUpdateSettings();
  const { record } = useEventLog();
  const surahs = useSurahs();
  const [step, setStep] = useState<'welcome' | 'start'>('welcome');
  const [pace, setPace] = useState<Pace>('normal');
  // The surahs on the path, in its order; the first is where the path begins.
  const pathSurahs = useMemo(() => [...new Set(content.path.map((a) => a.surah))], [content]);
  const [start, setStart] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const name = (surah: number) =>
    (surahs.status === 'loaded' && surahs.data.find((s) => s.surah === surah)?.nameEnglish) ||
    `Surah ${surah}`;

  const finish = async () => {
    setSaving(true);
    try {
      const chosen = start !== null && start !== pathSurahs[0] ? start : null;
      const draft = chosen === null ? null : chooseStart(content, chosen, currentNow());
      if (draft) await record([draft]);
      update({ pace, onboarded: true });
    } catch (error) {
      console.error('Failed to save the start point', error);
      setSaving(false);
    }
  };

  if (step === 'welcome') {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Understand the Quran&apos;s Arabic
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          Each day you study a few ayahs word by word, learn their words and grammar, and review
          earlier words just before you would forget them.
        </Text>
        <View style={[styles.note, { backgroundColor: colors.surface }]}>
          <Text style={[styles.body, { color: colors.text }]}>
            Lisan assumes you can already read Arabic script. It teaches what the words mean and how
            they are built, not how to read the letters.
          </Text>
        </View>
        <Text style={[styles.body, { color: colors.muted }]}>
          No account is needed: your progress stays on this phone.
        </Text>

        <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
          Your pace
        </Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {(Object.keys(NEW_LEMMA_BUDGET) as Pace[]).map((value) => (
            <Option
              key={value}
              label={PACE_LABELS[value]}
              detail={`${NEW_LEMMA_BUDGET[value]} new words a day`}
              selected={pace === value}
              onPress={() => setPace(value)}
            />
          ))}
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>You can change it in Settings.</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setStep('start')}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>Continue</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        Where to start
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        The path starts with Al-Fātiḥah, then Juz&apos; &apos;Amma from An-Nās backwards. If you
        already understand some of these surahs, you can start later on.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {pathSurahs.map((surah, i) => (
          <Option
            key={surah}
            label={name(surah)}
            detail={i === 0 ? 'The beginning of the path' : undefined}
            selected={(start ?? pathSurahs[0]) === surah}
            onPress={() => setStart(surah)}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={finish}
        style={[styles.button, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>Begin</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setStep('welcome')} hitSlop={8}>
        <Text style={[styles.link, { color: colors.accent }]}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

type OptionProps = { label: string; detail?: string; selected: boolean; onPress: () => void };

function Option({ label, detail, selected, onPress }: OptionProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.option,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accentSoft : 'transparent',
        },
      ]}
    >
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      {detail ? <Text style={{ color: colors.muted }}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 22 },
  hint: { fontSize: 13 },
  note: { borderRadius: 12, padding: 16 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
