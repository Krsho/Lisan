import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useNow } from '../clock/clock';
import { useSurahs } from '../content/useSurahs';
import { planSession, progress, streak, type Content } from '../engine';
import { useSettings } from '../settings/SettingsContext';
import { useColors } from '../theme/colors';
import { useEventLog } from '../user/UserStoreProvider';
import { describePassages, describeStreak } from './describe';
import { usePath } from './usePath';

type Props = { onStart: () => void; onBrowse: () => void; onProgress: () => void };

/** Home: today's session, and the way into browsing the whole Quran. */
export function TodayScreen(props: Props) {
  const colors = useColors();
  const path = usePath();

  if (path.status !== 'loaded') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {path.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load today&apos;s session.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }
  return <Today content={path.content} {...props} />;
}

function Today({ content, onStart, onBrowse, onProgress }: Props & { content: Content }) {
  const colors = useColors();
  const { events } = useEventLog();
  const { pace } = useSettings();
  const surahs = useSurahs();
  const now = useNow();
  const plan = useMemo(
    () => planSession(content, events, { pace }, now),
    [content, events, pace, now],
  );
  const learned = useMemo(() => progress(content, events).wordsLearned, [content, events]);
  const days = useMemo(() => streak(events, now), [events, now]);
  const next =
    surahs.status === 'loaded' ? describePassages(plan.newMaterial, surahs.surahs) : null;
  const finished = plan.newMaterial.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {finished ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Path complete</Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              You have studied every ayah on the path. Keep exploring the whole Quran.
            </Text>
            {plan.reviews.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onStart}
                style={[styles.button, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.buttonText, { color: colors.background }]}>
                  Review your words
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : plan.completedToday ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Done for today</Text>
            <Text style={[styles.body, { color: colors.muted }]}>Tomorrow: {next ?? '…'}</Text>
            <Pressable accessibilityRole="button" onPress={onStart} hitSlop={8}>
              <Text style={[styles.link, { color: colors.accent }]}>Keep going now</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Today&apos;s session</Text>
            <Text style={[styles.body, { color: colors.text }]}>{next ?? '…'}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              {/* How many reviews wait is never shown, so missed days don't look like a backlog. */}
              {plan.reviews.length > 0 ? 'A short review, then ' : ''}
              {plan.newLemmas.length} new {plan.newLemmas.length === 1 ? 'word' : 'words'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onStart}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>Start</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Quiet on purpose: a line of text, no badges or flames. */}
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Shows your progress along the path"
        onPress={onProgress}
        hitSlop={8}
      >
        <Text style={[styles.body, { color: colors.muted }]}>
          Streak: {describeStreak(days)} · Words learned: {learned}
        </Text>
        <Text style={[styles.link, { color: colors.accent }]}>Your progress</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onBrowse}
        style={[styles.browse, { borderColor: colors.border }]}
      >
        <Text style={[styles.browseText, { color: colors.text }]}>Browse the whole Quran</Text>
        <Text style={{ color: colors.muted }}>Read any surah word by word</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 12, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  link: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  browse: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 4 },
  browseText: { fontSize: 16, fontWeight: '600' },
});
