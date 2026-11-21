import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../content/ContentProvider';
import type {
  Ayah,
  AyahTranslation as AyahTranslationData,
  LinkedWord,
  SurahSummary,
  Word,
  WordRef,
} from '../content/repository';
import { useColors } from '../theme/colors';
import { QURAN_FONT_FAMILY } from '../theme/quranFont';
import { AyahTranslation } from './AyahTranslation';
import { WordDetailSheet } from './WordDetailSheet';

const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

type Props = {
  summary: SurahSummary;
  /** Ayah to scroll to when the surah opens. */
  initialAyah?: number;
};

type Loaded = {
  ayahs: Ayah[];
  basmala: LinkedWord[] | null;
  translations: Map<number, AyahTranslationData>;
};

/** A surah word by word with each ayah's translation: tap a word to see its grammar. */
export function SurahScreen({ summary, initialAyah }: Props) {
  const { surah, hasBasmala } = summary;
  const content = useContent();
  const colors = useColors();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordRef | null>(null);
  const list = useRef<FlatList<Ayah>>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      content.getSurah(surah, 'en'),
      hasBasmala ? content.getBasmala('en') : Promise.resolve(null),
      content.getTranslations(surah, 'en'),
    ]).then(
      ([ayahs, basmala, texts]) => {
        if (cancelled) return;
        setLoaded({ ayahs, basmala, translations: new Map(texts.map((t) => [t.ayah, t])) });
      },
      (error: unknown) => {
        console.error('Failed to load surah', surah, error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content, surah, hasBasmala]);

  if (!loaded) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {failed ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t load this surah.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const initialIndex = initialAyah ? loaded.ayahs.findIndex((a) => a.ayah === initialAyah) : -1;

  return (
    <>
      <FlatList
        ref={list}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        data={loaded.ayahs}
        keyExtractor={(ayah) => String(ayah.ayah)}
        initialNumToRender={Math.max(8, initialIndex + 4)}
        onLayout={() => {
          if (initialIndex > 0)
            list.current?.scrollToIndex({ index: initialIndex, animated: false });
        }}
        // Ayahs have different heights, so a far ayah may not be measured yet: jump close to it
        // and try again.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index, animated: false }), 100);
        }}
        ListHeaderComponent={
          loaded.basmala ? (
            <View style={[styles.basmala, { borderColor: colors.border }]}>
              <WordRow words={loaded.basmala} onPressWord={(word) => setSelectedWord(word.ref)} />
            </View>
          ) : undefined
        }
        renderItem={({ item: ayah }) => {
          const translation = loaded.translations.get(ayah.ayah);
          return (
            <View style={[styles.ayah, { borderColor: colors.border }]}>
              <WordRow
                words={ayah.words}
                ayahNumber={ayah.ayah}
                onPressWord={(word) =>
                  setSelectedWord({ surah, ayah: ayah.ayah, word: word.position })
                }
              />
              {translation ? <AyahTranslation data={translation} /> : null}
            </View>
          );
        }}
      />
      <WordDetailSheet wordRef={selectedWord} onClose={() => setSelectedWord(null)} />
    </>
  );
}

type WordRowProps<W extends Word> = {
  words: W[];
  /** Drawn after the last word, as in the mushaf. Omitted for the Basmala header. */
  ayahNumber?: number;
  onPressWord: (word: W) => void;
};

function WordRow<W extends Word>({ words, ayahNumber, onPressWord }: WordRowProps<W>) {
  const colors = useColors();
  return (
    <View style={[styles.words, ayahNumber ? null : styles.centeredWords]}>
      {words.map((word) => (
        <Pressable
          key={word.position}
          style={styles.word}
          accessibilityRole="button"
          accessibilityHint="Shows the word's grammar"
          onPress={() => onPressWord(word)}
        >
          <Text style={[styles.arabic, { color: colors.text }]}>{word.text}</Text>
          <Text style={[styles.gloss, { color: colors.muted }]}>{word.gloss ?? '—'}</Text>
        </Pressable>
      ))}
      {ayahNumber ? (
        <View style={styles.word} accessibilityLabel={`Ayah ${ayahNumber}`}>
          <Text style={[styles.arabic, { color: colors.accent }]}>
            {`۝${toArabicDigits(ayahNumber)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  basmala: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  ayah: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  // Arabic reads right to left, so words flow from the right edge.
  words: { flexDirection: 'row-reverse', flexWrap: 'wrap', rowGap: 12, columnGap: 14 },
  centeredWords: { justifyContent: 'center' },
  word: { alignItems: 'center', maxWidth: 140 },
  arabic: { fontFamily: QURAN_FONT_FAMILY, fontSize: 30, lineHeight: 56 },
  gloss: { fontSize: 13, textAlign: 'center' },
});
