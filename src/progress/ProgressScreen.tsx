import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSurahs } from '../content/useSurahs';
import { progress, streak, type Content } from '../engine';
import { describeStreak } from '../session/describe';
import { currentNow, usePath } from '../session/usePath';
import { useColors } from '../theme/colors';
import { useEventLog } from '../user/UserStoreProvider';

/** How far the learner has come: streak, ayahs completed, words learned and place on the path. */
export function ProgressScreen() {
  const colors = useColors();
  const path = usePath();
  if (path.status !== 'loaded') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {path.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load your progress.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }
  return <Progress content={path.content} />;
}

function Progress({ content }: { content: Content }) {
  const colors = useColors();
  const { events } = useEventLog();
  const surahs = useSurahs();
  const stats = useMemo(() => progress(content, events), [content, events]);
  const days = useMemo(() => streak(events, currentNow()), [events]);
  const name = (surah: number) =>
    (surahs.status === 'loaded' && surahs.surahs.find((s) => s.surah === surah)?.nameEnglish) ||
    `Surah ${surah}`;
  const share = stats.pathAyahs === 0 ? 0 : stats.pathIndex / stats.pathAyahs;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stat label="Streak" value={describeStreak(days)} />
      <Stat label="Ayahs completed" value={String(stats.ayahsCompleted)} />
      <Stat label="Words learned" value={String(stats.wordsLearned)} />
      {stats.wordsKnown > 0 ? (
        <Stat label="Words you already knew" value={String(stats.wordsKnown)} />
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.muted }]}>Place on the path</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {stats.next
            ? `Next: ${name(stats.next.surah)} ${stats.next.ayah}${stats.next.word > 1 ? ` (from word ${stats.next.word})` : ''}`
            : 'Path complete'}
        </Text>
        <View
          style={[styles.track, { backgroundColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: stats.pathAyahs, now: stats.pathIndex }}
        >
          <View
            style={[styles.fill, { backgroundColor: colors.accent, width: `${share * 100}%` }]}
          />
        </View>
        <Text style={{ color: colors.muted }}>
          {stats.pathIndex} of {stats.pathAyahs} ayahs on the path behind you
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: 12, padding: 16, gap: 8, marginTop: 8 },
  label: { fontSize: 15 },
  value: { fontSize: 18, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
});
