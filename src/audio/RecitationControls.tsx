import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';
import type { AudioSource, AyahRef } from './source';
import type { AyahPlayback, SurahDownload } from './useRecitation';

/** Credits the reciter and Quran Foundation, and offers the surah's audio for offline use. */
export function RecitationBar({
  source,
  download,
  error,
}: {
  source: AudioSource;
  download: SurahDownload;
  error: string | null;
}) {
  const colors = useColors();
  const { state, status } = download;

  let summary: string | null = null;
  const actions: { label: string; onPress: () => void }[] = [];
  if (status === 'downloading') {
    summary = `Downloading ${state.downloaded} of ${state.total} ayahs…`;
    actions.push({ label: 'Cancel', onPress: download.cancel });
  } else if (state.complete) {
    summary = 'Downloaded for offline use.';
    actions.push({ label: 'Remove download', onPress: download.remove });
  } else if (state.downloaded > 0) {
    summary = `${state.downloaded} of ${state.total} ayahs downloaded.`;
    actions.push({ label: 'Download the rest', onPress: download.start });
    actions.push({ label: 'Remove download', onPress: download.remove });
  } else {
    actions.push({ label: 'Download for offline use', onPress: download.start });
  }

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface }]}>
      <Text style={[styles.credit, { color: colors.muted }]}>
        {`Recitation by ${source.reciter.name}, audio from ${source.provider.name}.`}
      </Text>
      {summary ? <Text style={[styles.credit, { color: colors.text }]}>{summary}</Text> : null}
      <View style={styles.actions}>
        {actions.map(({ label, onPress }) => (
          <Pressable key={label} accessibilityRole="button" onPress={onPress} hitSlop={6}>
            <Text style={[styles.action, { color: colors.accent }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {status === 'failed' ? (
        <Text style={[styles.credit, { color: colors.muted }]}>
          The download stopped. Check your connection and try again.
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.credit, { color: colors.muted }]}>
          Couldn&apos;t play the recitation. Check your connection, or download the surah.
        </Text>
      ) : null}
    </View>
  );
}

/** Play/pause for one ayah. */
export function AyahPlayButton({
  ayahRef,
  playback,
}: {
  ayahRef: AyahRef;
  playback: AyahPlayback;
}) {
  const colors = useColors();
  const current = playback.isCurrent(ayahRef);
  const playing = current && playback.playing;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} the recitation of ayah ${ayahRef.ayah}`}
      onPress={() => playback.toggle(ayahRef)}
      hitSlop={8}
      style={[styles.play, { borderColor: colors.accent }]}
    >
      {current && playback.buffering ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={[styles.playIcon, { color: colors.accent }]}>{playing ? '❚❚' : '▶'}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { padding: 12, borderRadius: 8, gap: 6, marginBottom: 8 },
  credit: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  action: { fontSize: 14, fontWeight: '600' },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 12 },
});
