import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useColors } from '../theme/colors';

/** Header button opening the reading settings, so they can be changed while reading. */
export function SettingsHeaderButton({ label = 'Aa' }: { label?: string }) {
  const router = useRouter();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      onPress={() => router.push('/settings')}
    >
      <Text style={{ color: colors.accent, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
