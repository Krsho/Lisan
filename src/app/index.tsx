import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { TodayScreen } from '../session/TodayScreen';
import { useSettings } from '../settings/SettingsContext';
import { SettingsHeaderButton } from '../settings/SettingsHeaderButton';
import { useColors } from '../theme/colors';
import { useEventLog } from '../user/UserStoreProvider';

/** Home: onboarding on first launch, then today's session, with a way into browsing. */
export default function HomeRoute() {
  const router = useRouter();
  const colors = useColors();
  const { onboarded } = useSettings();
  const { events } = useEventLog();
  // Someone who studied before onboarding existed (an older app version) needs no welcome.
  if (!onboarded && events.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Welcome', headerRight: () => null }} />
        <OnboardingScreen />
      </>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Lisan',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <SettingsHeaderButton label="Settings" />
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.push('/about')}
              >
                <Text style={{ color: colors.accent, fontSize: 16 }}>About</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <TodayScreen
        onStart={() => router.push('/session')}
        onBrowse={() => router.push('/browse')}
        onProgress={() => router.push('/progress')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 16 },
});
