import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

export default function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.title, isDark && styles.textDark]}>Lisan</Text>
      <Text style={[styles.subtitle, isDark && styles.textDark]}>
        Understand the Quran&apos;s Arabic
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  containerDark: {
    backgroundColor: '#111',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#444',
  },
  textDark: {
    color: '#eee',
  },
});
