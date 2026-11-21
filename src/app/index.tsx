import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TodayScreen } from '../session/TodayScreen';
import { SettingsHeaderButton } from '../settings/SettingsHeaderButton';
import { useColors } from '../theme/colors';

/** Home: today's session, with a way into browsing the whole Quran. */
export default function HomeRoute() {
  const router = useRouter();
  const colors = useColors();
  return (
    <>
      <Stack.Screen
        options={{
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
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 16 },
});
