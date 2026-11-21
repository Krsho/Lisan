import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContentRepository, Language, Segment, Term } from '../content/repository';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';

/** Glossary entries for the root and lemma labels shown on every stem. */
export type Concepts = { root: Term; lemma: Term };

export async function loadConcepts(
  content: ContentRepository,
  language: Language,
): Promise<Concepts> {
  const [root, lemma] = await Promise.all([
    content.getTerm('concept.root', language),
    content.getTerm('concept.lemma', language),
  ]);
  return { root, lemma };
}

type Props = { segments: Segment[]; concepts: Concepts };

/**
 * A word's pieces (prefixes, stem, suffixes), each with its grammar labels, lemma and root.
 * Tapping a label shows its definition; one is open at a time.
 */
export function WordBreakdown({ segments, concepts }: Props) {
  const colors = useColors();
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const toggleTerm = (id: string) => setOpenTerm((current) => (current === id ? null : id));

  return (
    <View style={styles.segments}>
      {segments.map((segment) => (
        <SegmentCard
          key={segment.position}
          segment={segment}
          concepts={concepts}
          colors={colors}
          openTerm={openTerm}
          onToggleTerm={toggleTerm}
        />
      ))}
    </View>
  );
}

type SegmentCardProps = {
  segment: Segment;
  concepts: Concepts;
  colors: Colors;
  openTerm: string | null;
  onToggleTerm: (id: string) => void;
};

function SegmentCard({ segment, concepts, colors, openTerm, onToggleTerm }: SegmentCardProps) {
  const size = useQuranTextSize();
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
      <Text style={[styles.segmentText, size.text(26, 48), { color: colors.text }]}>
        {segment.text}
      </Text>
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
  segments: { gap: 8 },
  segment: { borderRadius: 12, padding: 12, gap: 8 },
  // Quran text sizes come from the font size setting (useQuranTextSize).
  segmentText: { fontFamily: QURAN_FONT_FAMILY, textAlign: 'right' },
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
