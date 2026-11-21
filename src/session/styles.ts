import { StyleSheet } from 'react-native';

/** The styles the session's steps share: their text and their main button. */
export const sessionStyles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
});
