import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSurahs } from '../content/useSurahs';
import { DEFAULT_SETTINGS, learnedLemmas, planSession, type Content } from '../engine';
import { useColors } from '../theme/colors';
import { useEventLog } from '../user/UserStoreProvider';
import { describePassages } from './describe';
import { currentNow, usePath } from './usePath';

type Props = { onStart: () => void; onBrowse: () => void };

/** Home: today's session, and the way into browsing the whole Quran. */
export function TodayScreen({ onStart, onBrowse }: Props) {
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
  return <Today content={path.content} onStart={onStart} onBrowse={onBrowse} />;
}

function Today({ content, onStart, onBrowse }: Props & { content: Content }) {
  const colors = useColors();
  const { events } = useEventLog();
  const surahs = useSurahs();
  const plan = useMemo(
    () => planSession(content, events, DEFAULT_SETTINGS, currentNow()),
    [content, events],
  );
  const learned = useMemo(() => learnedLemmas(events).size, [events]);
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

      <Text style={[styles.body, { color: colors.muted }]}>Words learned: {learned}</Text>

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
