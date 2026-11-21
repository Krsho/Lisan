import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { addAyahToReview, type AyahLemmas, type EventDraft, type ReviewEvent } from '../engine';
import { currentNow } from '../session/usePath';
import { useColors } from '../theme/colors';

type Props = {
  ayah: AyahLemmas;
  /** The learner's log, to tell which of the ayah's words are already in review. */
  events: ReviewEvent[];
  record(drafts: EventDraft[]): Promise<void>;
};

/**
 * "Add this ayah to my review" under a browsed ayah. Browsing records nothing: only pressing this
 * does, and it brings the ayah's new words into the review deck without moving the path on.
 */
export function AddToReview({ ayah, events, record }: Props) {
  const colors = useColors();
  const [added, setAdded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Only how many there are matters here; the events are drafted again, timed, on press.
  const pending = useMemo(
    () => addAyahToReview(ayah, events, { time: 0, utcOffsetMinutes: 0 }).length,
    [ayah, events],
  );

  if (added !== null || pending === 0) {
    return (
      <Text style={[styles.status, { color: colors.muted }]} accessibilityLiveRegion="polite">
        {added !== null
          ? `Added ${added} ${added === 1 ? 'word' : 'words'} to your review`
          : 'Already in your review'}
      </Text>
    );
  }

  const add = async () => {
    const drafts = addAyahToReview(ayah, events, currentNow());
    setSaving(true);
    setFailed(false);
    try {
      await record(drafts);
      setAdded(drafts.length);
    } catch (error: unknown) {
      console.error('Failed to add the ayah to review', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        style={[styles.button, { borderColor: colors.accent, opacity: saving ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Add this ayah to my review"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={add}
      >
        <Text style={[styles.label, { color: colors.accent }]}>Add this ayah to my review</Text>
      </Pressable>
      {failed ? (
        <Text style={[styles.status, { color: colors.muted }]}>
          Couldn&apos;t add it. Please try again.
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: { fontSize: 14 },
  status: { marginTop: 12, fontSize: 14 },
});
