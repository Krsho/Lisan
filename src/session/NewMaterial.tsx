import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecitationCredit, RecitationError } from '../audio/RecitationControls';
import { audioSource } from '../audio/source';
import type { AyahPlayback } from '../audio/useRecitation';
import { ayahKey } from '../content/parts';
import type { AyahTranslation } from '../content/repository';
import { useSurahs } from '../content/useSurahs';
import type { NewLemma } from '../engine';
import { notesFor, type NotesByAyah } from '../reading/LinguisticNotes';
import { keyOfPage, translationPageOf, type StudyPage } from '../reading/pages';
import { StudyPager } from '../reading/StudyPager';
import { StudyView } from '../reading/StudyView';
import { useColors, type Colors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { NoPages, PageHeader } from './PageHeader';
import { sessionStyles } from './styles';

type NewMaterialProps = {
  pages: StudyPage[];
  /** By "surah:ayah". */
  translations: Map<string, AyahTranslation>;
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
export function NewMaterial({
  pages,
  translations,
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
  // The recitation stops when the learner leaves its page, or this step of the session.
  const { stop } = playback;
  useEffect(() => stop, [stop, index]);
  // Changes, and so redraws the pages, with what they show: not when the learner turns the page.
  const renderPage = useCallback(
    (page: StudyPage, i: number) => {
      const { surah, ayah } = page;
      const translationPage = translationPageOf(pages, i);
      return (
        <StudyView
          passage={page}
          translation={translations.get(ayahKey(surah, ayah)) ?? null}
          notes={notesFor(notes, surah, ayah)}
          playback={playback}
          onOpenTranslationPart={
            translationPage !== undefined ? () => setIndex(translationPage) : undefined
          }
          header={<PageHeader label="New today" pages={pages} index={i} surahs={surahs} />}
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
                    sessionStyles.button,
                    { backgroundColor: colors.accent, opacity: finishDisabled ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[sessionStyles.buttonText, { color: colors.background }]}>
                    {finishLabel}
                  </Text>
                </Pressable>
              ) : null}
            </>
          }
        />
      );
    },
    [
      pages,
      translations,
      notes,
      playback,
      surahs,
      newLemmas,
      known,
      onToggleKnown,
      colors,
      finishDisabled,
      finishLabel,
      onFinish,
    ],
  );

  if (pages.length === 0) {
    return (
      <NoPages
        message="Couldn't load today's ayahs."
        actionLabel={finishLabel}
        actionDisabled={finishDisabled}
        onAction={onFinish}
      />
    );
  }
  return (
    <StudyPager
      pages={pages}
      keyOf={keyOfPage}
      index={index}
      onIndexChange={setIndex}
      renderPage={renderPage}
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

const styles = StyleSheet.create({
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
});
