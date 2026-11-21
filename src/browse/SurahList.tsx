import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SurahSummary } from '../content/repository';
import { useSurahs } from '../content/useSurahs';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';

type Props = { onOpenSurah: (surah: number) => void };

/** All 114 surahs, for browsing the whole Quran. */
export function SurahList({ onOpenSurah }: Props) {
  const colors = useColors();
  const state = useSurahs();

  if (state.status !== 'loaded') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {state.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load the surahs.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={state.surahs}
      keyExtractor={(item) => String(item.surah)}
      renderItem={({ item }) => <SurahRow summary={item} onPress={() => onOpenSurah(item.surah)} />}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      )}
    />
  );
}

function SurahRow({ summary, onPress }: { summary: SurahSummary; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Surah ${summary.surah}, ${summary.nameEnglish}, ${summary.ayahCount} ayahs`}
    >
      <View style={[styles.number, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent }}>{summary.surah}</Text>
      </View>
      <View style={styles.names}>
        <Text style={[styles.english, { color: colors.text }]}>{summary.nameEnglish}</Text>
        <Text style={{ color: colors.muted }}>{summary.ayahCount} ayahs</Text>
      </View>
      <Text style={[styles.arabic, { color: colors.text }]}>{summary.nameArabic}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  number: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  names: { flex: 1 },
  english: { fontSize: 16, fontWeight: '600' },
  arabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 24, lineHeight: 44 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
});
