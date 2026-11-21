import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSurahs } from '../../content/useSurahs';
import { SurahScreen } from '../../reading/SurahScreen';
import { SettingsHeaderButton } from '../../settings/SettingsHeaderButton';
import { useColors } from '../../theme/colors';

/** `/surah/2` reads Al-Baqarah; `/surah/2?ayah=255` opens it at ayah 255. */
export default function SurahRoute() {
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const colors = useColors();
  const state = useSurahs();
  const surah = Number(params.surah);
  const ayah = params.ayah ? Number(params.ayah) : undefined;

  if (state.status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  const summary = state.status === 'loaded' ? state.data.find((s) => s.surah === surah) : null;
  if (!summary) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Surah' }} />
        <Text style={{ color: colors.text }}>
          {state.status === 'failed' ? "Couldn't load this surah." : 'There is no such surah.'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `${summary.surah}. ${summary.nameEnglish}`,
          headerRight: () => <SettingsHeaderButton />,
        }}
      />
      <SurahScreen summary={summary} initialAyah={ayah} />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
