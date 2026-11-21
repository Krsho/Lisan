import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { TodayScreen } from '../session/TodayScreen';
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
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/about')}>
              <Text style={{ color: colors.accent }}>About</Text>
            </Pressable>
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
