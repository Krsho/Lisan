import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CenteredStatus } from '../async/CenteredStatus';
import { useAsync } from '../async/useAsync';
import { RecitationBar } from '../audio/RecitationControls';
import { audioSource } from '../audio/source';
import { useAyahPlayback, useSurahDownload } from '../audio/useRecitation';
import { useContent } from '../content/ContentProvider';
import type { Ayah, AyahTranslation, LinkedWord, SurahSummary } from '../content/repository';
import type { AyahLemmas } from '../engine';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY, useQuranTextSize } from '../theme/quranFont';
import { useEventLog } from '../user/UserStoreProvider';
import { AddToReview } from './AddToReview';
import { notesFor, useLinguisticNotes } from './LinguisticNotes';
import { describePosition } from './position';
import { StudyPager } from './StudyPager';
import { StudyView } from './StudyView';

type Props = {
  summary: SurahSummary;
  /** Ayah to open the surah at; the first ayah otherwise. */
  initialAyah?: number;
};

/** A surah one ayah per screen, each fully broken down; swipe right or press Next for the next. */
export function SurahScreen({ summary, initialAyah }: Props) {
  const { surah, hasBasmala } = summary;
  const content = useContent();
  const state = useAsync(
    () =>
      Promise.all([
        content.getSurah(surah, 'en'),
        hasBasmala ? content.getBasmala('en') : Promise.resolve(null),
        content.getTranslations(surah, 'en'),
        content.getSurahLemmas(surah),
      ]).then(([ayahs, basmala, texts, lemmas]) => ({
        ayahs,
        basmala,
        translations: new Map(texts.map((t) => [t.ayah, t])),
        // Each ayah's lemmas, by ayah number, for adding it to review.
        lemmas: new Map(lemmas.map((a) => [a.ayah, a])),
      })),
    [content, surah, hasBasmala],
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
  return <SurahPages summary={summary} initialAyah={initialAyah} {...state.data} />;
}

type PagesProps = Props & {
  ayahs: Ayah[];
  basmala: LinkedWord[] | null;
  translations: Map<number, AyahTranslation>;
  lemmas: Map<number, AyahLemmas>;
};

function SurahPages({ summary, initialAyah, ayahs, basmala, translations, lemmas }: PagesProps) {
  const { surah } = summary;
  const [index, setIndex] = useState(() =>
    Math.max(0, initialAyah ? ayahs.findIndex((a) => a.ayah === initialAyah) : 0),
  );
  const playback = useAyahPlayback(audioSource);
  const download = useSurahDownload(audioSource, surah, summary.ayahCount);
  const notes = useLinguisticNotes([surah], 'en');
  const { events, record } = useEventLog();
  // Redraw the pages when playback changes, once the notes load, and when the log changes.
  const extraData = useMemo(
    () => ({ playback, notes, events, download }),
    [playback, notes, events, download],
  );
  const current = ayahs[index];

  return (
    <>
      <Stack.Screen
        options={{
          title: current
            ? describePosition(summary.nameEnglish, current.ayah, summary.ayahCount)
            : summary.nameEnglish,
        }}
      />
      <StudyPager
        pages={ayahs}
        keyOf={(ayah) => String(ayah.ayah)}
        index={index}
        onIndexChange={setIndex}
        extraData={extraData}
        renderPage={(ayah) => {
          const ayahLemmas = lemmas.get(ayah.ayah);
          return (
            <StudyView
              passage={{ surah, ayah: ayah.ayah, words: ayah.words }}
              translation={translations.get(ayah.ayah) ?? null}
              notes={notesFor(notes, surah, ayah.ayah)}
              playback={playback}
              header={ayah.ayah === 1 && basmala ? <Basmala words={basmala} /> : null}
              footer={
                <>
                  {ayahLemmas ? (
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
