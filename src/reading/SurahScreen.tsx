import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CenteredStatus } from '../async/CenteredStatus';
import { useAsync } from '../async/useAsync';
import { RecitationBar } from '../audio/RecitationControls';
import { audioSource } from '../audio/source';
import { useAyahPlayback, useSurahDownload } from '../audio/useRecitation';
import { useContent } from '../content/ContentProvider';
import type { AyahTranslation, LinkedWord, SurahSummary } from '../content/repository';
import type { AyahLemmas } from '../engine';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { useBrowsePositions, useEventLog } from '../user/UserStoreProvider';
import { AddToReview } from './AddToReview';
import { notesFor, useLinguisticNotes } from './LinguisticNotes';
import { JumpToAyah } from './JumpToAyah';
import { placeOf, studyPages, type StudyPage } from './pages';
import { describePosition, pageIndexOf, type Place } from './position';
import { StudyPager } from './StudyPager';
import { StudyView } from './StudyView';

type Props = {
  summary: SurahSummary;
  /** Ayah to open the surah at; where the learner last stopped in it otherwise. */
  initialAyah?: number;
};

/**
 * A surah one ayah per screen (one part per screen for a long ayah), each fully broken down; swipe
 * right or press Next for the next. Opens where the learner last stopped in the surah (ayah 1 on a
 * first visit) and remembers each place they view; tapping the header jumps to any ayah.
 */
export function SurahScreen({ summary, initialAyah }: Props) {
  const { surah, hasBasmala } = summary;
  const content = useContent();
  const positions = useBrowsePositions();
  const state = useAsync(
    () =>
      Promise.all([
        content.getSurah(surah, 'en'),
        hasBasmala ? content.getBasmala('en') : Promise.resolve(null),
        content.getTranslations(surah, 'en'),
        content.getSurahLemmas(surah),
        content.getSurahParts(surah),
        initialAyah ? Promise.resolve({ ayah: initialAyah }) : positions.get(surah),
      ]).then(([ayahs, basmala, texts, lemmas, parts, place]) => ({
        pages: studyPages(ayahs, parts),
        initialPlace: place ?? { ayah: 1 },
        basmala,
        translations: new Map(texts.map((t) => [t.ayah, t])),
        // Each ayah's lemmas, by ayah number, for adding it to review.
        lemmas: new Map(lemmas.map((a) => [a.ayah, a])),
      })),
    [content, surah, hasBasmala, initialAyah, positions],
    `surah ${surah}`,
  );

  if (state.status !== 'loaded') {
    return (
      <>
        <Stack.Screen options={{ title: summary.nameEnglish }} />
        <CenteredStatus failed={state.status === 'failed'} message="Couldn't load this surah." />
      </>
    );
  }
  return <SurahPages summary={summary} {...state.data} />;
}

type PagesProps = {
  summary: SurahSummary;
  /** Where to open: the remembered place, or the ayah asked for. */
  initialPlace: Place;
  pages: StudyPage[];
  basmala: LinkedWord[] | null;
  translations: Map<number, AyahTranslation>;
  lemmas: Map<number, AyahLemmas>;
};

function SurahPages({ summary, initialPlace, pages, basmala, translations, lemmas }: PagesProps) {
  const { surah } = summary;
  const pagePlaces = useMemo(() => pages.map(placeOf), [pages]);
  const [index, setIndex] = useState(() => pageIndexOf(pagePlaces, initialPlace));
  const positions = useBrowsePositions();
  const playback = useAyahPlayback(audioSource);
  // The recitation stops when the learner leaves its page.
  const { stop } = playback;
  useEffect(() => stop, [stop, index]);
  const download = useSurahDownload(audioSource, surah, summary.ayahCount);
  const notes = useLinguisticNotes([surah], 'en');
  const { events, record } = useEventLog();
  // Redraw the pages when playback changes, once the notes load, and when the log changes.
  const extraData = useMemo(
    () => ({ playback, notes, events, download }),
    [playback, notes, events, download],
  );
  const current = pages[index];
  const place = current ? placeOf(current) : null;

  // Remember each place viewed, to reopen the surah there; this records no learning events.
  const { save } = positions;
  const placeAyah = place?.ayah;
  const placePart = place?.part;
  useEffect(() => {
    if (placeAyah !== undefined) save({ surah, ayah: placeAyah, part: placePart });
  }, [save, surah, placeAyah, placePart]);
  const title = current
    ? describePosition(summary.nameEnglish, current.ayah, summary.ayahCount, current.part)
    : summary.nameEnglish;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => (
            <JumpToAyah
              title={title}
              ayahCount={summary.ayahCount}
              current={current?.ayah ?? 1}
              onJump={(ayah) => setIndex(pageIndexOf(pagePlaces, { ayah }))}
            />
          ),
        }}
      />
      <StudyPager
        pages={pages}
        keyOf={(page) => page.key}
        index={index}
        onIndexChange={setIndex}
        extraData={extraData}
        renderPage={(page, i) => {
          const { ayah, part } = page;
          const ayahLemmas = lemmas.get(ayah);
          const firstPart = !part || part.number === 1;
          // The ayah's own controls go after its last part.
          const endsAyah = !part || part.number === part.count;
          return (
            <StudyView
              passage={page}
              translation={translations.get(ayah) ?? null}
              notes={notesFor(notes, surah, ayah)}
              playback={playback}
              onOpenTranslationPart={part ? () => setIndex(i - (part.number - 1)) : undefined}
              header={ayah === 1 && firstPart && basmala ? <Basmala words={basmala} /> : null}
              footer={
                <>
                  {ayahLemmas && endsAyah ? (
                    <AddToReview ayah={ayahLemmas} events={events} record={record} />
                  ) : null}
                  <RecitationBar source={audioSource} download={download} error={playback.error} />
                </>
              }
            />
          );
        }}
      />
    </>
  );
}

/** The Basmala heading a surah's first ayah. */
function Basmala({ words }: { words: LinkedWord[] }) {
  const colors = useColors();
  const size = useQuranTextSize();
  return (
    <View style={[styles.basmala, { borderColor: colors.border }]}>
      <Text style={[styles.basmalaText, size.text(24, 46), { color: colors.muted }]}>
        {words.map((w) => w.text).join(' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  basmala: { paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  // Sizes come from the font size setting (useQuranTextSize).
  basmalaText: { fontFamily: QURAN_FONT_FAMILY, textAlign: 'center' },
});
