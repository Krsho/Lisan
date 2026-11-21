import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../content/ContentProvider';
import type {
  Ayah,
  AyahTranslation as AyahTranslationData,
  Word,
  WordRef,
} from '../content/repository';
import { useSurahs } from '../content/useSurahs';
import {
  completeSession,
  DEFAULT_SETTINGS,
  knownLemmas,
  learnedLemmas,
  markKnown,
  planQuiz,
  planSession,
  undoKnown,
  type Content,
  type NewLemma,
  type Passage,
  type QuizItem,
  type SessionPlan,
} from '../engine';
import { AyahTranslation } from '../reading/AyahTranslation';
import { WordDetailSheet } from '../reading/WordDetailSheet';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';
import { useEventLog } from '../user/UserStoreProvider';
import { describePassages } from './describe';
import { QuizScreen, type QuizResult } from './QuizScreen';
import { useQuizContent } from './useQuizContent';
import { currentNow, usePath } from './usePath';

type Props = { onDone: () => void };

/** Today's session: study the new ayah(s), a quiz on their new words, then a summary. */
export function SessionScreen({ onDone }: Props) {
  const colors = useColors();
  const path = usePath();

  if (path.status !== 'loaded') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {path.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load today&apos;s session.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }
  return <Session content={path.content} onDone={onDone} />;
}

type Loaded = {
  ayahs: Map<string, Ayah>;
  translations: Map<string, AyahTranslationData>;
};

const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

function Session({ content, onDone }: Props & { content: Content }) {
  const repository = useContent();
  const colors = useColors();
  const { events, record } = useEventLog();
  // Planned once: marking "I know this" during the session doesn't change what is studied today.
  const [plan] = useState<SessionPlan>(() =>
    planSession(content, events, DEFAULT_SETTINGS, currentNow()),
  );
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordRef | null>(null);
  const [learnedNow, setLearnedNow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Null until the new material is studied; then the questions, or empty if there are none.
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const known = useMemo(() => knownLemmas(events), [events]);
  // Loaded while the learner studies, so the quiz is ready when they finish.
  const quizContent = useQuizContent(plan.newLemmas);

  useEffect(() => {
    let cancelled = false;
    const surahs = [...new Set(plan.newMaterial.map((p) => p.surah))];
    Promise.all(
      surahs.map((surah) =>
        Promise.all([repository.getSurah(surah, 'en'), repository.getTranslations(surah, 'en')]),
      ),
    ).then(
      (results) => {
        if (cancelled) return;
        const ayahs = new Map<string, Ayah>();
        const translations = new Map<string, AyahTranslationData>();
        results.forEach(([surahAyahs, texts], i) => {
          surahAyahs.forEach((a) => ayahs.set(ayahKey(a.surah, a.ayah), a));
          texts.forEach((t) => translations.set(ayahKey(surahs[i], t.ayah), t));
        });
        setLoaded({ ayahs, translations });
      },
      (error: unknown) => {
        console.error('Failed to load the session ayahs', error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, plan]);

  if (learnedNow !== null && quiz !== null && quiz.length > 0 && quizResult === null) {
    return quizContent.status === 'loaded' ? (
      <QuizScreen items={quiz} terms={quizContent.data.terms} onDone={setQuizResult} />
    ) : null;
  }

  if (learnedNow !== null && quiz !== null) {
    return (
      <Summary content={content} learnedNow={learnedNow} quizResult={quizResult} onDone={onDone} />
    );
  }

  if (!loaded) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {failed ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load today&apos;s ayahs.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  if (plan.newMaterial.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>There is no new material left on the path.</Text>
      </View>
    );
  }

  const wordAt = (ref: WordRef): Word | undefined =>
    loaded.ayahs.get(ayahKey(ref.surah, ref.ayah))?.words.find((w) => w.position === ref.word);

  const toggleKnown = (lemma: NewLemma) =>
    record([
      known.has(lemma.lemmaId)
        ? undoKnown(lemma.lemmaId, lemma.wordRef, currentNow())
        : markKnown(lemma.lemmaId, lemma.wordRef, currentNow()),
    ]).catch((error: unknown) => console.error('Failed to save "I know this"', error));

  // The session counts as done once the new material is studied, so leaving during the quiz
  // keeps today's progress; quiz answers are saved one by one as they are given.
  const finish = async () => {
    setSaving(true);
    try {
      const drafts = completeSession(plan, events, currentNow());
      await record(drafts);
      setLearnedNow(drafts.filter((d) => d.kind === 'learn').length);
      // Without the quiz's content (it failed to load) the session goes straight to the summary.
      setQuiz(quizContent.status === 'loaded' ? planQuiz(plan, events, quizContent.data) : []);
    } catch (error) {
      console.error('Failed to save the session', error);
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        {plan.newMaterial.map((passage) => {
          const ayah = loaded.ayahs.get(ayahKey(passage.surah, passage.ayah));
          const translation = loaded.translations.get(ayahKey(passage.surah, passage.ayah));
          return ayah ? (
            <View
              key={ayahKey(passage.surah, passage.ayah)}
              style={[styles.ayah, { borderColor: colors.border }]}
            >
              <Text style={[styles.reference, { color: colors.muted }]}>
                {passage.surah}:{passage.ayah}
              </Text>
              <PassageWords
                ayah={ayah}
                passage={passage}
                onPressWord={(word) =>
                  setSelectedWord({ surah: ayah.surah, ayah: ayah.ayah, word: word.position })
                }
              />
              {translation ? <AyahTranslation data={translation} /> : null}
            </View>
          ) : null;
        })}

        <Text style={[styles.heading, { color: colors.text }]}>New words</Text>
        {plan.newLemmas.length === 0 ? (
          <Text style={{ color: colors.muted }}>You already know every word here.</Text>
        ) : null}
        {plan.newLemmas.map((lemma) => {
          const word = wordAt(lemma.wordRef);
          const isKnown = known.has(lemma.lemmaId);
          return (
            <View
              key={lemma.lemmaId}
              style={[styles.lemma, { borderColor: colors.border, opacity: isKnown ? 0.5 : 1 }]}
            >
              <Pressable
                style={styles.lemmaText}
                accessibilityRole="button"
                accessibilityHint="Shows the word's grammar"
                onPress={() => setSelectedWord(lemma.wordRef)}
              >
                <Text style={[styles.lemmaArabic, { color: colors.text }]}>
                  {lemma.lemmaId}
                  {word ? `  ·  ${word.bare}` : ''}
                </Text>
                <Text style={{ color: colors.muted }}>{word?.gloss ?? '—'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isKnown }}
                onPress={() => toggleKnown(lemma)}
                hitSlop={8}
                style={[styles.knowButton, { borderColor: colors.accent }]}
              >
                <Text style={{ color: colors.accent }}>
                  {isKnown ? '✓ I know this' : 'I know this'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          disabled={saving || quizContent.status === 'loading'}
          onPress={finish}
          style={[
            styles.button,
            {
              backgroundColor: colors.accent,
              opacity: saving || quizContent.status === 'loading' ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            {quizContent.status === 'failed' || plan.newLemmas.every((l) => known.has(l.lemmaId))
              ? 'Finish session'
              : 'Continue to the quiz'}
          </Text>
        </Pressable>
      </ScrollView>
      <WordDetailSheet wordRef={selectedWord} onClose={() => setSelectedWord(null)} />
    </>
  );
}

type PassageWordsProps = { ayah: Ayah; passage: Passage; onPressWord: (word: Word) => void };

/** The ayah word by word, with words outside today's part of it dimmed. */
function PassageWords({ ayah, passage, onPressWord }: PassageWordsProps) {
  const colors = useColors();
  return (
    <View style={styles.words}>
      {ayah.words.map((word) => {
        const inPassage = word.position >= passage.fromWord && word.position <= passage.toWord;
        return (
          <Pressable
            key={word.position}
            style={[styles.word, { opacity: inPassage ? 1 : 0.35 }]}
            accessibilityRole="button"
            accessibilityHint="Shows the word's grammar"
            onPress={() => onPressWord(word)}
          >
            <Text style={[styles.arabic, { color: colors.text }]}>{word.text}</Text>
            <Text style={[styles.gloss, { color: colors.muted }]}>{word.gloss ?? '—'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Summary({
  content,
  learnedNow,
  quizResult,
  onDone,
}: {
  content: Content;
  learnedNow: number;
  quizResult: QuizResult | null;
  onDone: () => void;
}) {
  const colors = useColors();
  const { events } = useEventLog();
  const surahs = useSurahs();
  const next = useMemo(
    () => planSession(content, events, DEFAULT_SETTINGS, currentNow()),
    [content, events],
  );
  const total = useMemo(() => learnedLemmas(events).size, [events]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Session complete</Text>
      <Text style={[styles.body, { color: colors.text }]}>New words today: {learnedNow}</Text>
      {quizResult ? (
        <Text style={[styles.body, { color: colors.text }]}>
          Quiz: {quizResult.correct} of {quizResult.total} right
        </Text>
      ) : null}
      <Text style={[styles.body, { color: colors.text }]}>Words learned in all: {total}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        {next.newMaterial.length === 0
          ? 'You have finished the path.'
          : `Next: ${surahs.status === 'loaded' ? describePassages(next.newMaterial, surahs.surahs) : '…'}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        style={[styles.button, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  content: { padding: 16, gap: 12 },
  ayah: { paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  reference: { fontSize: 13, marginBottom: 4 },
  // Arabic reads right to left, so words flow from the right edge.
  words: { flexDirection: 'row-reverse', flexWrap: 'wrap', rowGap: 12, columnGap: 14 },
  word: { alignItems: 'center', maxWidth: 140 },
  arabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 30, lineHeight: 56 },
  gloss: { fontSize: 13, textAlign: 'center' },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  lemma: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lemmaText: { flex: 1, gap: 2 },
  lemmaArabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 22, lineHeight: 40 },
  knowButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
});
