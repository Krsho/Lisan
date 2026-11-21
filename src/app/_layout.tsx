import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ContentProvider } from '../content/ContentProvider';
import { useColors } from '../theme/colors';
import { QURAN_FONTS } from '../theme/quranFont';

export default function RootLayout() {
  const colors = useColors();
  // If the Quran font fails to load, carry on with the system font rather than spinning forever.
  const [fontsLoaded, fontError] = useFonts(QURAN_FONTS);
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ContentProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Lisan' }} />
        <Stack.Screen name="about" options={{ title: 'About and sources' }} />
      </Stack>
      <StatusBar style="auto" />
    </ContentProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
