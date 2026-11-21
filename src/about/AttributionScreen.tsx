import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '../content/ContentProvider';
import type { Edition } from '../content/repository';
import { useColors, type Colors } from '../theme/colors';

type Credit = { name: string; role: string; url?: string; detail?: string };

const CREDITS_BEFORE_EDITIONS: Credit[] = [
  {
    name: 'Quranic Arabic Corpus',
    role: 'Word morphology and grammar (v0.4, with corrections from mustafa0x/quran-morphology)',
    url: 'https://corpus.quran.com',
  },
  {
    name: 'Tanzil Project',
    role: 'Uthmani Quran text, used verbatim (CC BY 3.0)',
    url: 'https://tanzil.net',
  },
  {
    name: 'King Fahd Glorious Quran Printing Complex (KFGQPC)',
    role: 'Uthmanic Hafs font and Quran text',
    url: 'https://qurancomplex.gov.sa',
  },
  {
    name: 'Quranic Universal Library (QUL), Tarteel',
    role: 'English word-by-word glosses',
    url: 'https://qul.tarteel.ai',
  },
];

const CREDITS_AFTER_EDITIONS: Credit[] = [
  { name: 'Quran Foundation', role: 'Quran data and APIs', url: 'https://quran.foundation' },
  {
    name: 'Reciters',
    role: 'Recitation audio',
    detail: 'Reciters will be credited here when recitation audio is added.',
  },
];

const editionVersion = (edition: Edition) =>
  edition.version
    ? `Version ${edition.version}`
    : `QuranEnc publishes no version for this edition; retrieved ${edition.fetchedAt}`;

/** Credits every source of the app's content, with links and the QuranEnc edition versions. */
export function AttributionScreen() {
  const content = useContent();
  const colors = useColors();
  const [editions, setEditions] = useState<Edition[]>([]);

  useEffect(() => {
    let cancelled = false;
    content.getEditions().then(
      (result) => {
        if (!cancelled) setEditions(result);
      },
      (error: unknown) => console.error('Failed to load editions', error),
    );
    return () => {
      cancelled = true;
    };
  }, [content]);

  const quranEnc: Credit[] = editions.map((edition) => ({
    name: `QuranEnc.com: ${edition.title}`,
    role: edition.kind === 'translation' ? 'Ayah translation' : 'Short tafsir',
    url: edition.url,
    detail: `${editionVersion(edition)}. Shown unmodified.`,
  }));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Sources and credits</Text>
      {[...CREDITS_BEFORE_EDITIONS, ...quranEnc, ...CREDITS_AFTER_EDITIONS].map((credit) => (
        <CreditRow key={credit.name} credit={credit} colors={colors} />
      ))}
    </ScrollView>
  );
}

function CreditRow({ credit, colors }: { credit: Credit; colors: Colors }) {
  const { name, role, url, detail } = credit;
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.role, { color: colors.muted }]}>{role}</Text>
      {detail ? <Text style={[styles.role, { color: colors.muted }]}>{detail}</Text> : null}
      {url ? (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} hitSlop={6}>
          <Text style={[styles.link, { color: colors.accent }]}>{url}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 4 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  role: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, marginTop: 2 },
});
