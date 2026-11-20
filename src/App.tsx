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
  const [fontsLoaded] = useFonts(QURAN_FONTS);
  if (!fontsLoaded) return <Loading />;

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
