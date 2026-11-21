import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Term } from '../content/repository';
import { gradeAnswer, type GrammarFeature, type QuizItem } from '../engine';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { useEventLog } from '../user/UserStoreProvider';
import { currentNow } from './usePath';

export type QuizResult = { correct: number; total: number };

type Props = {
  items: QuizItem[];
  /** Glossary terms by key, naming the options of grammar questions. */
  terms: Map<string, Term>;
  onDone: (result: QuizResult) => void;
};

const WRONG = '#c0392b';

const FEATURE_NAMES: Record<Exclude<GrammarFeature, 'part-of-speech'>, string> = {
  aspect: 'tense',
  mood: 'mood',
  person: 'person',
  gender: 'gender',
  number: 'number',
  case: 'case',
};

function question(item: QuizItem): string {
  switch (item.type) {
    case 'meaning':
      return 'What does this word mean?';
    case 'arabic':
      return `Which word means “${item.meaning}”?`;
    case 'grammar':
      if (item.feature !== 'part-of-speech') {
        return `What is the ${FEATURE_NAMES[item.feature]} of this word?`;
      }
      return item.segment === item.word
        ? 'What kind of word is this?'
        : 'What is the marked part of this word?';
  }
}

/**
 * The quiz on today's new words, one question at a time. Each answer is graded by correctness and
 * speed and saved as a review event straight away; the learner never grades themselves.
 */
export function QuizScreen({ items, terms, onDone }: Props) {
  const colors = useColors();
  const size = useQuranTextSize();
  const { record } = useEventLog();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  // When the current question appeared, to time the answer.
  const shownAt = useRef(0);
  const item = items[index];

  useEffect(() => {
    shownAt.current = currentNow().time;
  }, [index]);

  if (!item) return null;

  const answer = (option: string) => {
    if (chosen !== null) return;
    const now = currentNow();
    const event = gradeAnswer(item, option, now.time - shownAt.current, now);
    setChosen(option);
    if (event.correct) setCorrect((c) => c + 1);
    record([event]).catch((error: unknown) => console.error('Failed to save a quiz answer', error));
  };

  const next = () => {
    if (index + 1 >= items.length) {
      onDone({ correct, total: items.length });
      return;
    }
    setChosen(null);
    setIndex(index + 1);
  };

  const label = (option: string) =>
    item.type === 'grammar' ? (terms.get(option)?.name ?? option) : option;
  const arabicOptions = item.type === 'arabic';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.progress, { color: colors.muted }]}>
        Question {index + 1} of {items.length} · {item.wordRef.surah}:{item.wordRef.ayah}
      </Text>
      <Text style={[styles.question, { color: colors.text }]}>{question(item)}</Text>

      {item.type !== 'arabic' ? (
        <Text style={[styles.word, size.text(40, 72), { color: colors.text }]}>{item.word}</Text>
      ) : null}
      {item.type === 'grammar' && item.segment !== item.word ? (
        <View style={[styles.segment, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.segmentText, size.text(30, 54), { color: colors.text }]}>
            {item.segment}
          </Text>
        </View>
      ) : null}

      <View style={styles.options}>
        {item.options.map((option) => {
          const isAnswer = option === item.answer;
          const isChosen = option === chosen;
          const revealed = chosen !== null;
          const borderColor =
            revealed && isAnswer ? colors.accent : isChosen ? WRONG : colors.border;
          const term = item.type === 'grammar' ? terms.get(option) : undefined;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ disabled: revealed, selected: isChosen }}
              disabled={revealed}
              onPress={() => answer(option)}
              style={[
                styles.option,
                {
                  borderColor,
                  backgroundColor: revealed && isAnswer ? colors.accentSoft : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  arabicOptions ? [styles.optionArabic, size.text(28, 50)] : styles.optionText,
                  { color: colors.text },
                ]}
              >
                {label(option)}
              </Text>
              {term ? (
                <Text style={[styles.optionTerm, { color: colors.muted }]}>{term.arabic}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {chosen !== null ? (
        <>
          <Text
            style={[styles.feedback, { color: chosen === item.answer ? colors.accent : WRONG }]}
          >
            {chosen === item.answer ? 'Right.' : 'Not quite. The right answer is marked.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {index + 1 >= items.length ? 'See summary' : 'Next'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  progress: { fontSize: 13 },
  question: { fontSize: 18, fontWeight: '600' },
  // Quran text sizes come from the font size setting (useQuranTextSize).
  word: { fontFamily: QURAN_FONT_FAMILY, textAlign: 'center' },
  segment: { alignSelf: 'center', borderRadius: 8, paddingHorizontal: 16 },
  segmentText: { fontFamily: QURAN_FONT_FAMILY },
  options: { gap: 10, marginTop: 8 },
  option: { borderWidth: 1.5, borderRadius: 10, padding: 14, alignItems: 'center' },
  optionText: { fontSize: 16, textAlign: 'center' },
  optionArabic: { fontFamily: QURAN_FONT_FAMILY },
  optionTerm: { fontSize: 14, marginTop: 2 },
  feedback: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
