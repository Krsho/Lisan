import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AsyncState } from '../async/useAsync';
import type { SurahSummary } from '../content/repository';
import { sessionHeading, type StudyPage } from '../reading/pages';
import { useColors } from '../theme/colors';
import { sessionStyles } from './styles';

type PageHeaderProps = {
  /** What the screens are, e.g. "New today": "New today · 2 of 3". */
  label: string;
  pages: StudyPage[];
  index: number;
  surahs: AsyncState<SurahSummary[]>;
};

/** Above a session screen: which of the session's screens it is, and its place in its surah. */
export function PageHeader({ label, pages, index, surahs }: PageHeaderProps) {
  const colors = useColors();
  const { progress, reference } = sessionHeading(
    label,
    pages,
    index,
    surahs.status === 'loaded' ? surahs.data : null,
  );
  return (
    <View style={styles.progress}>
      <Text style={[styles.progressText, { color: colors.text }]}>{progress}</Text>
      <Text style={[styles.reference, { color: colors.muted }]}>{reference}</Text>
    </View>
  );
}

type NoPagesProps = {
  message: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
};

/** A session step whose ayahs couldn't be shown (one missing from the content): still a way on. */
export function NoPages({ message, actionLabel, actionDisabled = false, onAction }: NoPagesProps) {
  const colors = useColors();
  return (
    <View style={[sessionStyles.content, styles.noPages, { backgroundColor: colors.background }]}>
      <Text style={[sessionStyles.body, { color: colors.muted }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={actionDisabled}
        onPress={onAction}
        style={[
          sessionStyles.button,
          { backgroundColor: colors.accent, opacity: actionDisabled ? 0.6 : 1 },
        ]}
      >
        <Text style={[sessionStyles.buttonText, { color: colors.background }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  noPages: { flex: 1, justifyContent: 'center' },
  progress: { gap: 2 },
  progressText: { fontSize: 16, fontWeight: '700' },
  reference: { fontSize: 13 },
});
