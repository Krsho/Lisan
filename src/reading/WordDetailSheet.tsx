import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useContent } from '../content/ContentProvider';
import type { Segment, Term, WordDetails, WordRef } from '../content/repository';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';

type Props = { wordRef: WordRef | null; onClose: () => void };

/** Bottom sheet explaining one word: its segments, lemma, root and grammatical terms. */
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
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [concepts, setConcepts] = useState<{ root: Term; lemma: Term } | null>(null);
  const [failed, setFailed] = useState(false);
  const [openTerm, setOpenTerm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      content.getWordDetails(wordRef, 'en'),
      content.getTerm('concept.root', 'en'),
      content.getTerm('concept.lemma', 'en'),
    ]).then(
      ([word, root, lemma]) => {
        if (cancelled) return;
        setDetails(word);
        setConcepts({ root, lemma });
      },
      (error: unknown) => {
        console.error('Failed to load word details', wordRef, error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, wordRef]);

  const toggleTerm = (id: string) => setOpenTerm((current) => (current === id ? null : id));

  if (!details || !concepts) {
    return (
      <View style={styles.loading}>
        {failed ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load this word.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.word, { color: colors.text }]}>{details.text}</Text>
      <Text style={[styles.gloss, { color: colors.muted }]}>{details.gloss ?? '—'}</Text>
      {details.segments.map((segment) => (
        <SegmentCard
          key={segment.position}
          segment={segment}
          concepts={concepts}
          colors={colors}
          openTerm={openTerm}
          onToggleTerm={toggleTerm}
        />
      ))}
    </ScrollView>
  );
}

type SegmentCardProps = {
  segment: Segment;
  concepts: { root: Term; lemma: Term };
  colors: Colors;
  openTerm: string | null;
  onToggleTerm: (id: string) => void;
};

function SegmentCard({ segment, concepts, colors, openTerm, onToggleTerm }: SegmentCardProps) {
  // Term chips are identified per segment, so the same term can be opened under one segment only.
  const id = (key: string) => `${segment.position}:${key}`;
  const chip = (term: Term, value?: string) => (
    <TermChip
      key={term.key}
      term={term}
      value={value}
      colors={colors}
      open={openTerm === id(term.key)}
      onPress={() => onToggleTerm(id(term.key))}
    />
  );
  const opened = [concepts.lemma, concepts.root, ...segment.terms].find(
    (term) => openTerm === id(term.key),
  );

  return (
    <View style={[styles.segment, { backgroundColor: colors.surface }]}>
      <Text style={[styles.segmentText, { color: colors.text }]}>{segment.text}</Text>
      <View style={styles.chips}>
        {segment.terms.map((term) => chip(term))}
        {segment.lemma ? chip(concepts.lemma, segment.lemma) : null}
        {segment.root ? chip(concepts.root, [...segment.root].join(' ')) : null}
      </View>
      {opened ? (
        <Text style={[styles.definition, { color: colors.text }]}>{opened.definition}</Text>
      ) : null}
    </View>
  );
}

type TermChipProps = {
  term: Term;
  /** A value shown with the term, e.g. the root letters for "root". */
  value?: string;
  colors: Colors;
  open: boolean;
  onPress: () => void;
};

function TermChip({ term, value, colors, open, onPress }: TermChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={[
        styles.chip,
        { borderColor: colors.accent, backgroundColor: open ? colors.accentSoft : 'transparent' },
      ]}
    >
      <Text style={[styles.chipArabic, { color: colors.text }]}>{term.arabic}</Text>
      <Text style={[styles.chipName, { color: colors.muted }]}>
        {term.name}
        {value ? ': ' : ''}
      </Text>
      {value ? <Text style={[styles.chipValue, { color: colors.text }]}>{value}</Text> : null}
    </Pressable>
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
  word: { fontFamily: QURAN_FONT_FAMILY, fontSize: 40, lineHeight: 72, textAlign: 'center' },
  gloss: { fontSize: 16, textAlign: 'center', marginTop: -8 },
  segment: { borderRadius: 12, padding: 12, gap: 8 },
  segmentText: { fontFamily: QURAN_FONT_FAMILY, fontSize: 30, lineHeight: 54, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipArabic: { fontSize: 15 },
  chipName: { fontSize: 13 },
  chipValue: { fontFamily: QURAN_FONT_FAMILY, fontSize: 16 },
  definition: { fontSize: 14, lineHeight: 20 },
});
