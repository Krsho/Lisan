import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ContentProvider } from '../content/ContentProvider';
import { ReminderScheduler } from '../reminder/ReminderScheduler';
import { useColors, useColorSchemeName } from '../theme/colors';
import { QURAN_FONTS } from '../theme/quranFont';
import { UserStoreProvider } from '../user/UserStoreProvider';

export default function RootLayout() {
  const colors = useColors();
  // If the Quran font fails to load, carry on with the system font rather than spinning forever.
  const [fontsLoaded, fontError] = useFonts(QURAN_FONTS);
  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ContentProvider>
      <UserStoreProvider>
        <ReminderScheduler />
        <AppStack />
      </UserStoreProvider>
    </ContentProvider>
  );
}

/** The screens, drawn in the theme from the settings (inside UserStoreProvider, which loads them). */
function AppStack() {
  const colors = useColors();
  const scheme = useColorSchemeName();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Lisan' }} />
        <Stack.Screen name="session" options={{ title: 'Today' }} />
        <Stack.Screen name="browse" options={{ title: 'Browse' }} />
        <Stack.Screen name="progress" options={{ title: 'Your progress' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="about" options={{ title: 'About and sources' }} />
      </Stack>
      {/* The theme can differ from the phone's, so the status bar follows the theme, not "auto". */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
