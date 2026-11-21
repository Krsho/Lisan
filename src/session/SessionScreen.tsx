import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { CenteredStatus } from '../async/CenteredStatus';
import { useAsync } from '../async/useAsync';
import { audioSource } from '../audio/source';
import { useAyahPlayback } from '../audio/useRecitation';
import { useContent } from '../content/ContentProvider';
import { ayahKey } from '../content/parts';
import type { Ayah, AyahPart, AyahTranslation as AyahTranslationData } from '../content/repository';
import { currentNow } from '../clock/clock';
import { useSurahs } from '../content/useSurahs';
import {
  completeSession,
  knownLemmas,
  markKnown,
  planQuiz,
  planReview,
  planSession,
  undoKnown,
  type Content,
  type NewLemma,
  type QuizItem,
  type SessionPlan,
} from '../engine';
import { useLinguisticNotes } from '../reading/LinguisticNotes';
import { sessionPages } from '../reading/pages';
import { ReminderOffer } from '../reminder/ReminderOffer';
import { useColors } from '../theme/colors';
import { useSettings } from '../settings/SettingsContext';
import { useEventLog } from '../user/UserStoreProvider';
import { describePassages, describeStreak } from './describe';
import { NewMaterial } from './NewMaterial';
import { QuizScreen, type QuizResult } from './QuizScreen';
import { Recap } from './Recap';
import { sessionStyles } from './styles';
import { useDailyStatus } from './useDailyStatus';
import { useQuizContent } from './useQuizContent';
import { usePath } from './usePath';

type Props = { onDone: () => void };

/**
 * Today's session: a review of earlier words, a recap after a week or more away, the new ayah(s),
 * a quiz on their new words, then a summary.
 */
export function SessionScreen({ onDone }: Props) {
  const path = usePath();
  if (path.status !== 'loaded') {
    return (
      <CenteredStatus failed={path.status === 'failed'} message="Couldn't load today's session." />
    );
  }
  return <Session content={path.data} onDone={onDone} />;
}

type Loaded = {
  ayahs: Map<string, Ayah>;
  translations: Map<string, AyahTranslationData>;
  /** The parts of the path's long ayahs, to show the new material one part a screen. */
  parts: AyahPart[];
};

function Session({ content, onDone }: Props & { content: Content }) {
  const repository = useContent();
  const { events, record } = useEventLog();
  const { pace } = useSettings();
  // Planned once: marking "I know this" during the session doesn't change what is studied today.
  const [plan] = useState<SessionPlan>(() => planSession(content, events, { pace }, currentNow()));
  const [learnedNow, setLearnedNow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Null until the new material is studied; then the questions, or empty if there are none.
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  // The log as the session began, so the review's questions stay the same as answers come in.
  const [startEvents] = useState(events);
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
  const [recapDone, setRecapDone] = useState(false);
  // One player for the session's ayahs, new and recapped, streamed or from a download.
  const playback = useAyahPlayback(audioSource);
  const known = useMemo(() => knownLemmas(events), [events]);
  const studiedSurahs = useMemo(
    () => [...new Set([...plan.recap, ...plan.newMaterial].map((p) => p.surah))],
    [plan],
  );
  const notes = useLinguisticNotes(studiedSurahs, 'en');
  // The words of the review and the quiz, loaded together so the quiz is ready after studying.
  const asked = useMemo(() => [...plan.reviews, ...plan.newLemmas], [plan]);
  const quizContent = useQuizContent(asked);

  // The review's questions: null while their content loads. Without the content (it failed to
  // load) the session goes on without a review.
  const review = useMemo(() => {
    if (plan.reviews.length === 0 || quizContent.status === 'failed') return [];
    if (quizContent.status === 'loading') return null;
    return planReview(plan, startEvents, quizContent.data);
  }, [plan, startEvents, quizContent]);

  // The ayahs of the review's words as well, for their context.
  const ayahsState = useAsync(
    async (): Promise<Loaded> => {
      const surahsShown = [
        ...new Set(
          [...plan.reviews.map((r) => r.wordRef), ...plan.recap, ...plan.newMaterial].map(
            (p) => p.surah,
          ),
        ),
      ];
      const [results, parts] = await Promise.all([
        Promise.all(
          surahsShown.map((surah) =>
            Promise.all([
              repository.getSurah(surah, 'en'),
              repository.getTranslations(surah, 'en'),
            ]),
          ),
        ),
        repository.getPathParts(),
      ]);
      const ayahs = new Map<string, Ayah>();
      const translations = new Map<string, AyahTranslationData>();
      results.forEach(([surahAyahs, texts], i) => {
        surahAyahs.forEach((a) => ayahs.set(ayahKey(a.surah, a.ayah), a));
        texts.forEach((t) => translations.set(ayahKey(surahsShown[i], t.ayah), t));
      });
      return { ayahs, translations, parts };
    },
    [repository, plan],
    'the session ayahs',
  );
  const shown = ayahsState.status === 'loaded' ? ayahsState.data : null;
  const recapPages = useMemo(
    () => (shown ? sessionPages(plan.recap, shown.ayahs, shown.parts) : []),
    [plan, shown],
  );
  const newPages = useMemo(
    () => (shown ? sessionPages(plan.newMaterial, shown.ayahs, shown.parts) : []),
    [plan, shown],
  );
  const endRecap = useCallback(() => setRecapDone(true), []);

  const toggleKnown = useCallback(
    (lemma: NewLemma) =>
      record([
        known.has(lemma.lemmaId)
          ? undoKnown(lemma.lemmaId, lemma.wordRef, currentNow())
          : markKnown(lemma.lemmaId, lemma.wordRef, currentNow()),
      ]).catch((error: unknown) => console.error('Failed to save "I know this"', error)),
    [record, known],
  );

  // The session counts as done once the new material is studied, so leaving during the quiz
  // keeps today's progress; quiz answers are saved one by one as they are given.
  const finish = useCallback(async () => {
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
  }, [plan, events, record, quizContent]);

  // Review → (recap) → new ayah(s) → quiz → summary.
  if (review === null || ayahsState.status !== 'loaded') {
    return (
      <CenteredStatus
        failed={ayahsState.status === 'failed'}
        message="Couldn't load today's ayahs."
      />
    );
  }
  const loaded = ayahsState.data;

  if (review.length > 0 && reviewResult === null && quizContent.status === 'loaded') {
    return (
      <QuizScreen
        key="review"
        title="Review"
        doneLabel="Continue"
        items={review}
        terms={quizContent.data.terms}
        context={loaded.ayahs}
        onDone={setReviewResult}
      />
    );
  }

  if (plan.recap.length > 0 && !recapDone) {
    return (
      <Recap
        pages={recapPages}
        translations={loaded.translations}
        notes={notes}
        playback={playback}
        onDone={endRecap}
      />
    );
  }

  if (learnedNow !== null && quiz !== null && quiz.length > 0 && quizResult === null) {
    return quizContent.status === 'loaded' ? (
      <QuizScreen key="quiz" items={quiz} terms={quizContent.data.terms} onDone={setQuizResult} />
    ) : null;
  }

  // With the path finished, a session is the review alone.
  if ((learnedNow !== null && quiz !== null) || plan.newMaterial.length === 0) {
    return (
      <Summary
        content={content}
        learnedNow={learnedNow}
        reviewResult={reviewResult}
        quizResult={quizResult}
        onDone={onDone}
      />
    );
  }

  const quizNext =
    quizContent.status !== 'failed' && !plan.newLemmas.every((l) => known.has(l.lemmaId));
  return (
    <NewMaterial
      pages={newPages}
      translations={loaded.translations}
      notes={notes}
      playback={playback}
      newLemmas={plan.newLemmas}
      known={known}
      onToggleKnown={toggleKnown}
      finishLabel={quizNext ? 'Continue to the quiz' : 'Finish session'}
      finishDisabled={saving || quizContent.status === 'loading'}
      onFinish={finish}
    />
  );
}

function Summary({
  content,
  learnedNow,
  reviewResult,
  quizResult,
  onDone,
}: {
  content: Content;
  /** How many lemmas the session learned; null if it was a review only (the path is finished). */
  learnedNow: number | null;
  reviewResult: QuizResult | null;
  quizResult: QuizResult | null;
  onDone: () => void;
}) {
  const colors = useColors();
  const surahs = useSurahs();
  const { plan: next, wordsLearned: total, streak: days } = useDailyStatus(content);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={sessionStyles.content}
    >
      <Text style={[sessionStyles.title, { color: colors.text }]}>Session complete</Text>
      {reviewResult ? (
        <Text style={[sessionStyles.body, { color: colors.text }]}>
          Review: {reviewResult.correct} of {reviewResult.total} right
        </Text>
      ) : null}
      {learnedNow !== null ? (
        <Text style={[sessionStyles.body, { color: colors.text }]}>
          New words today: {learnedNow}
        </Text>
      ) : null}
      {quizResult ? (
        <Text style={[sessionStyles.body, { color: colors.text }]}>
          Quiz: {quizResult.correct} of {quizResult.total} right
        </Text>
      ) : null}
      <Text style={[sessionStyles.body, { color: colors.text }]}>
        Words learned in all: {total}
      </Text>
      <Text style={[sessionStyles.body, { color: colors.text }]}>
        Streak: {describeStreak(days)}
      </Text>
      <Text style={[sessionStyles.body, { color: colors.muted }]}>
        {next.newMaterial.length === 0
          ? 'You have finished the path.'
          : `Next: ${surahs.status === 'loaded' ? describePassages(next.newMaterial, surahs.data) : '…'}`}
      </Text>
      {/* Offered after a session on the path, not after a review on its own. */}
      {learnedNow !== null ? <ReminderOffer /> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        style={[sessionStyles.button, { backgroundColor: colors.accent }]}
      >
        <Text style={[sessionStyles.buttonText, { color: colors.background }]}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}
