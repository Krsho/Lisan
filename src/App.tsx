import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ContentProvider } from './content/ContentProvider';
import { SurahScreen } from './reading/SurahScreen';
import { QURAN_FONTS } from './theme/quranFont';

const AL_FATIHA = 1;

function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator />
    </View>
  );
}

export default function App() {
  // If the Quran font fails to load, carry on with the system font rather than spinning forever.
  const [fontsLoaded, fontError] = useFonts(QURAN_FONTS);
  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <>
      <ContentProvider>
        <SurahScreen surah={AL_FATIHA} />
      </ContentProvider>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
