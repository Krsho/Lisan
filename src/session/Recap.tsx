import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { RecitationCredit, RecitationError } from '../audio/RecitationControls';
import { audioSource } from '../audio/source';
import type { AyahPlayback } from '../audio/useRecitation';
import { ayahKey } from '../content/parts';
import type { AyahTranslation } from '../content/repository';
import { useSurahs } from '../content/useSurahs';
import { notesFor, type NotesByAyah } from '../reading/LinguisticNotes';
import { keyOfPage, translationPageOf, type StudyPage } from '../reading/pages';
import { StudyPager } from '../reading/StudyPager';
import { StudyView } from '../reading/StudyView';
import { useColors } from '../theme/colors';
import { NoPages, PageHeader } from './PageHeader';
import { sessionStyles } from './styles';

type RecapProps = {
  pages: StudyPage[];
  /** By "surah:ayah". */
  translations: Map<string, AyahTranslation>;
  notes: NotesByAyah;
  playback: AyahPlayback;
  onDone: () => void;
};

/**
 * After a gap of a week or more: the last few ayahs studied, to read again before going on. Each
 * shows the ayah, its audio and translation until the learner asks for the breakdown. It records
 * nothing.
 */
export function Recap({ pages, translations, notes, playback, onDone }: RecapProps) {
  const colors = useColors();
  const surahs = useSurahs();
  const [index, setIndex] = useState(0);
  // The recitation stops when the learner leaves its page, or this step of the session.
  const { stop } = playback;
  useEffect(() => stop, [stop, index]);
  // The pages whose word cards the learner opened.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const toggleBreakdown = useCallback(
    (key: string) =>
      setBroken((open) => {
        const next = new Set(open);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [],
  );

  // Changes, and so redraws the pages, with what they show: not when the learner turns the page.
  const renderPage = useCallback(
    (page: StudyPage, i: number) => {
      const { surah, ayah, key } = page;
      const translationPage = translationPageOf(pages, i);
      const showBreakdown = broken.has(key);
      return (
        <StudyView
          passage={page}
          translation={translations.get(ayahKey(surah, ayah)) ?? null}
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
                  <Text style={[sessionStyles.title, { color: colors.text }]}>Welcome back</Text>
                  <Text style={[sessionStyles.body, { color: colors.muted }]}>
                    Here are the last ayahs you studied, to pick up where you left off.
                  </Text>
                </>
              ) : null}
              <PageHeader label="Recap" pages={pages} index={i} surahs={surahs} />
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
                  style={[sessionStyles.button, { backgroundColor: colors.accent }]}
                >
                  <Text style={[sessionStyles.buttonText, { color: colors.background }]}>
                    Continue
                  </Text>
                </Pressable>
              ) : null}
            </>
          }
        />
      );
    },
    [pages, translations, notes, playback, surahs, broken, toggleBreakdown, colors, onDone],
  );

  if (pages.length === 0) {
    return (
      <NoPages
        message="Couldn't load the ayahs to recap."
        actionLabel="Continue"
        onAction={onDone}
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

const styles = StyleSheet.create({
  toggle: { fontSize: 14, fontWeight: '600' },
});
