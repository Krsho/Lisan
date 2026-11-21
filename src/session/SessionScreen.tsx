import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CenteredStatus } from '../async/CenteredStatus';
import { useAsync, type AsyncState } from '../async/useAsync';
import { RecitationCredit, RecitationError } from '../audio/RecitationControls';
import { audioSource } from '../audio/source';
import { useAyahPlayback, type AyahPlayback } from '../audio/useRecitation';
import { useContent } from '../content/ContentProvider';
import type {
  Ayah,
  AyahPart,
  AyahTranslation as AyahTranslationData,
  SurahSummary,
} from '../content/repository';
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
import { notesFor, useLinguisticNotes, type NotesByAyah } from '../reading/LinguisticNotes';
import { sessionPages, translationPageOf, type StudyPage } from '../reading/pages';
import { StudyPager } from '../reading/StudyPager';
import { StudyView } from '../reading/StudyView';
import { ReminderOffer } from '../reminder/ReminderOffer';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { useSettings } from '../settings/SettingsContext';
import { useEventLog } from '../user/UserStoreProvider';
import { describePassages, describeStreak } from './describe';
import { QuizScreen, type QuizResult } from './QuizScreen';
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

const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

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
        pages={sessionPages(plan.recap, loaded.ayahs, loaded.parts)}
        loaded={loaded}
        notes={notes}
        playback={playback}
        onDone={() => setRecapDone(true)}
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

  const quizNext =
    quizContent.status !== 'failed' && !plan.newLemmas.every((l) => known.has(l.lemmaId));
  return (
    <NewMaterial
      pages={sessionPages(plan.newMaterial, loaded.ayahs, loaded.parts)}
      loaded={loaded}
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

type NewMaterialProps = {
  pages: StudyPage[];
  loaded: Loaded;
  notes: NotesByAyah;
  playback: AyahPlayback;
  newLemmas: NewLemma[];
  known: Set<string>;
  onToggleKnown: (lemma: NewLemma) => void;
  finishLabel: string;
  finishDisabled: boolean;
  onFinish: () => void;
};

/**
 * Today's new ayahs one screen each (one part a screen for a long ayah), as in Browse, with each
 * word's card marking the lemmas new today and "I know this"; the last screen goes on to the quiz.
 */
function NewMaterial({
  pages,
  loaded,
  notes,
  playback,
  newLemmas,
  known,
  onToggleKnown,
  finishLabel,
  finishDisabled,
  onFinish,
}: NewMaterialProps) {
  const colors = useColors();
  const surahs = useSurahs();
  const [index, setIndex] = useState(0);
  const extraData = useMemo(
    () => ({ playback, notes, known, finishDisabled, surahs }),
    [playback, notes, known, finishDisabled, surahs],
  );

  return (
    <StudyPager
      pages={pages}
      keyOf={(page) => page.key}
      index={index}
      onIndexChange={setIndex}
      extraData={extraData}
      renderPage={(page, i) => {
        const { surah, ayah } = page;
        const translationPage = translationPageOf(pages, i);
        return (
          <StudyView
            passage={page}
            translation={loaded.translations.get(ayahKey(surah, ayah)) ?? null}
            notes={notesFor(notes, surah, ayah)}
            playback={playback}
            onOpenTranslationPart={
              translationPage !== undefined ? () => setIndex(translationPage) : undefined
            }
            header={<PageHeader label="New ayah" pages={pages} page={page} surahs={surahs} />}
            renderWordExtra={(word) => {
              const lemmas = newLemmas.filter(
                (l) =>
                  l.wordRef.surah === surah &&
                  l.wordRef.ayah === ayah &&
                  l.wordRef.word === word.position,
              );
              return lemmas.length > 0 ? (
                <NewLemmas
                  lemmas={lemmas}
                  known={known}
                  onToggleKnown={onToggleKnown}
                  colors={colors}
                />
              ) : null;
            }}
            footer={
              <>
                <RecitationCredit source={audioSource} />
                <RecitationError error={playback.error} />
                {i === pages.length - 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={finishDisabled}
                    onPress={onFinish}
                    style={[
                      styles.button,
                      { backgroundColor: colors.accent, opacity: finishDisabled ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.buttonText, { color: colors.background }]}>
                      {finishLabel}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            }
          />
        );
      }}
    />
  );
}

type NewLemmasProps = {
  lemmas: NewLemma[];
  known: Set<string>;
  onToggleKnown: (lemma: NewLemma) => void;
  colors: Colors;
};

/** On a word's card: the lemmas it brings that are new today, each with "I know this". */
function NewLemmas({ lemmas, known, onToggleKnown, colors }: NewLemmasProps) {
  const size = useQuranTextSize();
  return lemmas.map((lemma) => {
    const isKnown = known.has(lemma.lemmaId);
    return (
      <View key={lemma.lemmaId} style={styles.lemma}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.background }]}>New</Text>
        </View>
        <Text
          style={[
            styles.lemmaArabic,
            size.text(20, 36),
            { color: colors.text, opacity: isKnown ? 0.5 : 1 },
          ]}
        >
          {lemma.lemmaId}
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`I know ${lemma.lemmaId}`}
          accessibilityState={{ checked: isKnown }}
          onPress={() => onToggleKnown(lemma)}
          hitSlop={8}
          style={[styles.knowButton, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent }}>{isKnown ? '✓ I know this' : 'I know this'}</Text>
        </Pressable>
      </View>
    );
  });
}

type PageHeaderProps = {
  /** What the screens are, e.g. "New ayah": "New ayah 2 of 3". */
  label: string;
  pages: StudyPage[];
  page: StudyPage;
  surahs: AsyncState<SurahSummary[]>;
};

/** Above a session screen: which of the session's ayahs it is, and its reference. */
function PageHeader({ label, pages, page, surahs }: PageHeaderProps) {
  const colors = useColors();
  const ayahKeys = [...new Set(pages.map((p) => ayahKey(p.surah, p.ayah)))];
  const nth = ayahKeys.indexOf(ayahKey(page.surah, page.ayah)) + 1;
  const name =
    surahs.status === 'loaded'
      ? surahs.data.find((s) => s.surah === page.surah)?.nameEnglish
      : undefined;
  const part = page.part ? ` · part ${page.part.number} of ${page.part.count}` : '';
  return (
    <View style={styles.progress}>
      <Text style={[styles.progressText, { color: colors.text }]}>
        {label} {nth} of {ayahKeys.length}
      </Text>
      <Text style={[styles.reference, { color: colors.muted }]}>
        {`${name ?? `Surah ${page.surah}`} ${page.ayah}${part}`}
      </Text>
    </View>
  );
}

type RecapProps = {
  pages: StudyPage[];
  loaded: Loaded;
  notes: NotesByAyah;
  playback: AyahPlayback;
  onDone: () => void;
};

/**
 * After a gap of a week or more: the last few ayahs studied, to read again before going on. Each
 * shows in the study view without its word cards until the learner asks for the breakdown. It
 * records nothing.
 */
function Recap({ pages, loaded, notes, playback, onDone }: RecapProps) {
  const colors = useColors();
  const surahs = useSurahs();
  const [index, setIndex] = useState(0);
  // The pages whose word cards the learner opened.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const extraData = useMemo(
    () => ({ playback, notes, surahs, broken }),
    [playback, notes, surahs, broken],
  );
  const toggleBreakdown = (key: string) =>
    setBroken((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <StudyPager
      pages={pages}
      keyOf={(page) => page.key}
      index={index}
      onIndexChange={setIndex}
      extraData={extraData}
      renderPage={(page, i) => {
        const { surah, ayah, key } = page;
        const translationPage = translationPageOf(pages, i);
        const showBreakdown = broken.has(key);
        return (
          <StudyView
            passage={page}
            translation={loaded.translations.get(ayahKey(surah, ayah)) ?? null}
            // The notes are about the words, so they come with the breakdown.
            notes={showBreakdown ? notesFor(notes, surah, ayah) : []}
            playback={playback}
            showWordCards={showBreakdown}
            onOpenTranslationPart={
              translationPage !== undefined ? () => setIndex(translationPage) : undefined
            }
            header={
              <>
                {i === 0 ? (
                  <>
                    <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
                    <Text style={[styles.body, { color: colors.muted }]}>
                      Here are the last ayahs you studied, to pick up where you left off.
                    </Text>
                  </>
                ) : null}
                <PageHeader label="Recap ayah" pages={pages} page={page} surahs={surahs} />
              </>
            }
            footer={
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showBreakdown }}
                  onPress={() => toggleBreakdown(key)}
                  hitSlop={8}
                >
                  <Text style={[styles.toggle, { color: colors.accent }]}>
                    {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
                  </Text>
                </Pressable>
                <RecitationCredit source={audioSource} />
                <RecitationError error={playback.error} />
                {i === pages.length - 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onDone}
                    style={[styles.button, { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.buttonText, { color: colors.background }]}>Continue</Text>
                  </Pressable>
                ) : null}
              </>
            }
          />
        );
      }}
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
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Session complete</Text>
      {reviewResult ? (
        <Text style={[styles.body, { color: colors.text }]}>
          Review: {reviewResult.correct} of {reviewResult.total} right
        </Text>
      ) : null}
      {learnedNow !== null ? (
        <Text style={[styles.body, { color: colors.text }]}>New words today: {learnedNow}</Text>
      ) : null}
      {quizResult ? (
        <Text style={[styles.body, { color: colors.text }]}>
          Quiz: {quizResult.correct} of {quizResult.total} right
        </Text>
      ) : null}
      <Text style={[styles.body, { color: colors.text }]}>Words learned in all: {total}</Text>
      <Text style={[styles.body, { color: colors.text }]}>Streak: {describeStreak(days)}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        {next.newMaterial.length === 0
          ? 'You have finished the path.'
          : `Next: ${surahs.status === 'loaded' ? describePassages(next.newMaterial, surahs.data) : '…'}`}
      </Text>
      {/* Offered after a session on the path, not after a review on its own. */}
      {learnedNow !== null ? <ReminderOffer /> : null}
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
  content: { padding: 16, gap: 12 },
  reference: { fontSize: 13 },
  progress: { gap: 2 },
  progressText: { fontSize: 16, fontWeight: '700' },
  lemma: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  lemmaArabic: { flex: 1, fontFamily: QURAN_FONT_FAMILY },
  knowButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggle: { fontSize: 14, fontWeight: '600' },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
});
