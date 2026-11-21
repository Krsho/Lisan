import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAsync } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import type { WordRef } from '../content/repository';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { loadConcepts, WordBreakdown } from './WordBreakdown';

type Props = { wordRef: WordRef | null; onClose: () => void };

/**
 * Bottom sheet explaining one word: its segments, lemma, root and grammatical terms. Only the
 * daily session still uses it, until it moves to the study view; Browse shows every word's
 * breakdown inline.
 */
export function WordDetailSheet({ wordRef, onClose }: Props) {
  const colors = useColors();

  return (
    <Modal visible={wordRef !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
        onPress={onClose}
        accessibilityLabel="Close word details"
      />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {wordRef ? (
          // Keyed by word, so opening another word starts from fresh state.
          <WordDetailContent
            key={`${wordRef.surah}:${wordRef.ayah}:${wordRef.word}`}
            wordRef={wordRef}
            colors={colors}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function WordDetailContent({ wordRef, colors }: { wordRef: WordRef; colors: Colors }) {
  const content = useContent();
  const size = useQuranTextSize();
  const state = useAsync(
    () => Promise.all([content.getWordDetails(wordRef, 'en'), loadConcepts(content, 'en')]),
    [content, wordRef],
    'word details',
  );

  if (state.status !== 'loaded') {
    return (
      <View style={styles.loading}>
        {state.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load this word.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }
  const [details, concepts] = state.data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.word, size.text(40, 72), { color: colors.text }]}>{details.text}</Text>
      <Text style={[styles.gloss, { color: colors.muted }]}>{details.gloss ?? '—'}</Text>
      <WordBreakdown segments={details.segments} concepts={concepts} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginVertical: 8 },
  loading: { padding: 32, alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  // Quran text sizes come from the font size setting (useQuranTextSize).
  word: { fontFamily: QURAN_FONT_FAMILY, textAlign: 'center' },
  gloss: { fontSize: 16, textAlign: 'center', marginTop: -8 },
});
