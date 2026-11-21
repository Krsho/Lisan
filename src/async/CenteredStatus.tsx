import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';

/** A whole screen that is loading (a spinner) or failed to (the message). */
export function CenteredStatus({ failed, message }: { failed: boolean; message: string }) {
  const colors = useColors();
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {failed ? (
        <Text style={{ color: colors.text, textAlign: 'center' }}>{message}</Text>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
