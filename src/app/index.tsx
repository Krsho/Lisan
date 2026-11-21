import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { SurahList } from '../browse/SurahList';
import { useColors } from '../theme/colors';

/** Home: browse the whole Quran (the daily session will take this place later). */
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
      <SurahList
        onOpenSurah={(surah) =>
          router.push({ pathname: '/surah/[surah]', params: { surah: String(surah) } })
        }
      />
    </>
  );
}
