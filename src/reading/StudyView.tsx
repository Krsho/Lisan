import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { AyahPlayButton } from '../audio/RecitationControls';
import type { AyahPlayback } from '../audio/useRecitation';
import { useAsync } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import type {
  AyahTranslation as AyahTranslationData,
  LinguisticNote,
  Word,
  WordDetails,
} from '../content/repository';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { TafsirSection, TranslationSection } from './AyahTranslation';
import { LinguisticNotes } from './LinguisticNotes';
import { loadConcepts, WordBreakdown, type Concepts } from './WordBreakdown';

/** What one study screen shows: a whole ayah, or one part of a long ayah. */
export type StudyPassage = {
  surah: number;
  ayah: number;
  /** The words on this screen, in order: all of the ayah's, or one part's. */
  words: Word[];
  /** Which part of the ayah this is (1-based); absent when the ayah is shown whole. */
  part?: { number: number; count: number };
};

type Props = {
  passage: StudyPassage;
  /** The ayah's translation and tafsir. Shown with the whole ayah or its first part only. */
  translation: AyahTranslationData | null;
  /** The ayah's linguistic notes; those on words outside this passage are left out. */
  notes: LinguisticNote[];
  playback: AyahPlayback;
  /** On a later part, opens part 1, where the translation and tafsir are. */
  onOpenFirstPart?: () => void;
  /** Whether each word's card shows (default true); the recap shows the ayah without them. */
  showWordCards?: boolean;
  /** Extra content on a word's card, e.g. the session's "new" badge and "I know this". */
  renderWordExtra?: (word: Word) => ReactNode;
  /** Shown above the ayah, e.g. the Basmala before a surah's first ayah. */
  header?: ReactNode;
  /** Shown at the bottom, e.g. "Add this ayah to my review". */
  footer?: ReactNode;
};

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

/**
 * One ayah, or one part of one, fully broken down on one scrolling screen: the ayah in large
 * script, play/pause, the translation, a card for every word, the linguistic note and the folded
 * tafsir. Tapping a word in the ayah scrolls to its card and highlights it.
 */
export function StudyView({
  passage,
  translation,
  notes,
  playback,
  onOpenFirstPart,
  showWordCards = true,
  renderWordExtra,
  header,
  footer,
}: Props) {
  const { surah, ayah, words, part } = passage;
  const colors = useColors();
  const scroll = useRef<ScrollViewInstance>(null);
  const cardsTop = useRef(0);
  const cardTops = useRef(new Map<number, number>());
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const laterPart = part !== undefined && part.number > 1;
  const endsAyah = !part || part.number === part.count;
  const positions = new Set(words.map((w) => w.position));
  const shownNotes = notes.filter((note) =>
    note.word === null ? !laterPart : positions.has(note.word),
  );

  const showCard = (word: Word) => {
    setHighlighted(word.position);
    const top = cardTops.current.get(word.position);
    if (top !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, cardsTop.current + top - 12), animated: true });
    }
  };

  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {header}
      <AyahText
        words={words}
        ayahNumber={endsAyah ? ayah : undefined}
        highlighted={highlighted}
        onPressWord={showWordCards ? showCard : undefined}
      />
      <View style={styles.play}>
        <AyahPlayButton ayahRef={{ surah, ayah }} playback={playback} />
      </View>
      {laterPart ? (
        onOpenFirstPart ? (
          <Pressable accessibilityRole="link" onPress={onOpenFirstPart} hitSlop={8}>
            <Text style={[styles.link, { color: colors.accent }]}>
              Translation and tafsir: part 1
            </Text>
          </Pressable>
        ) : null
      ) : translation ? (
        <TranslationSection data={translation} />
      ) : null}
      {showWordCards ? (
        <View onLayout={(e) => (cardsTop.current = e.nativeEvent.layout.y)} style={styles.cards}>
          <WordCards
            passage={passage}
            colors={colors}
            highlighted={highlighted}
            renderWordExtra={renderWordExtra}
            onCardLayout={(position, y) => cardTops.current.set(position, y)}
          />
        </View>
      ) : null}
      <LinguisticNotes notes={shownNotes} words={words} />
      {!laterPart && translation ? <TafsirSection data={translation} /> : null}
      {footer}
    </ScrollView>
  );
}

type AyahTextProps = {
  words: Word[];
  /** Drawn after the last word, as in the mushaf, when this passage ends the ayah. */
  ayahNumber?: number;
  highlighted: number | null;
  /** Absent when there are no cards to go to. */
  onPressWord?: (word: Word) => void;
};

function AyahText({ words, ayahNumber, highlighted, onPressWord }: AyahTextProps) {
  const colors = useColors();
  const size = useQuranTextSize();
  const arabic = [styles.arabic, size.text(34, 64)];
  return (
    <View style={styles.ayahText}>
      {words.map((w) => (
        <Pressable
          key={w.position}
          disabled={!onPressWord}
          accessibilityRole={onPressWord ? 'button' : 'text'}
          accessibilityHint={onPressWord ? "Shows the word's breakdown" : undefined}
          onPress={() => onPressWord?.(w)}
        >
          <Text
            style={[arabic, { color: highlighted === w.position ? colors.accent : colors.text }]}
          >
            {w.text}
          </Text>
        </Pressable>
      ))}
      {ayahNumber ? (
        <Text style={[arabic, { color: colors.accent }]} accessibilityLabel={`Ayah ${ayahNumber}`}>
          {`۝${toArabicDigits(ayahNumber)}`}
        </Text>
      ) : null}
    </View>
  );
}

type WordCardsProps = {
  passage: StudyPassage;
  colors: Colors;
  highlighted: number | null;
  renderWordExtra?: (word: Word) => ReactNode;
  onCardLayout: (position: number, y: number) => void;
};

function WordCards({
  passage,
  colors,
  highlighted,
  renderWordExtra,
  onCardLayout,
}: WordCardsProps) {
  const content = useContent();
  const { surah, ayah, words } = passage;
  const key = words.map((w) => w.position).join(',');
  const state = useAsync(
    () =>
      Promise.all([
        Promise.all(
          words.map((w) => content.getWordDetails({ surah, ayah, word: w.position }, 'en')),
        ),
        loadConcepts(content, 'en'),
      ]),
    [content, surah, ayah, key],
    `word details of ${surah}:${ayah}`,
  );

  if (state.status === 'loading') return <ActivityIndicator style={styles.loading} />;
  if (state.status === 'failed') {
    return (
      <Text style={[styles.status, { color: colors.muted }]}>
        Couldn&apos;t load the words&apos; breakdown.
      </Text>
    );
  }
  const [details, concepts] = state.data;
  return details.map((word, i) => (
    <View key={word.position} onLayout={(e) => onCardLayout(word.position, e.nativeEvent.layout.y)}>
      <WordCard
        word={word}
        concepts={concepts}
        colors={colors}
        highlighted={highlighted === word.position}
        extra={renderWordExtra?.(words[i])}
      />
    </View>
  ));
}

type WordCardProps = {
  word: WordDetails;
  concepts: Concepts;
  colors: Colors;
  highlighted: boolean;
  extra: ReactNode;
};

function WordCard({ word, concepts, colors, highlighted, extra }: WordCardProps) {
  const size = useQuranTextSize();
  return (
    <View
      accessibilityLabel={`Word ${word.position}: ${word.gloss ?? 'no meaning given'}`}
      accessibilityState={{ selected: highlighted }}
      style={[
        styles.card,
        { borderColor: highlighted ? colors.accent : colors.border },
        highlighted ? styles.cardHighlighted : null,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.arabic, size.text(30, 56), { color: colors.text }]}>{word.bare}</Text>
        <Text style={[styles.meaning, { color: colors.text }]}>{word.gloss ?? '—'}</Text>
      </View>
      <WordBreakdown segments={word.segments} concepts={concepts} />
      {extra}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  // Arabic reads right to left, so words flow from the right edge.
  ayahText: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 10,
  },
  // Sizes come from the font size setting (useQuranTextSize).
  arabic: { fontFamily: QURAN_FONT_FAMILY },
  play: { alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '600' },
  cards: { gap: 12 },
  loading: { padding: 16 },
  status: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  cardHighlighted: { borderWidth: 2 },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meaning: { flexShrink: 1, fontSize: 16 },
});
