import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings, useUpdateSettings } from '../settings/SettingsContext';
import { useColors } from '../theme/colors';
import { PERMISSION_DENIED_TEXT, ReminderTimeStepper, useTurnOnReminder } from './ReminderControls';
import { formatReminderTime, shouldOfferReminder } from './reminder';

type Answer = 'none' | 'on' | 'declined' | 'denied';

/**
 * On a completed session's summary: offers the daily reminder, once. It counts as offered as soon
 * as it is shown, so leaving without answering doesn't bring it back next time.
 */
export function ReminderOffer() {
  const colors = useColors();
  const settings = useSettings();
  const update = useUpdateSettings();
  const turnOn = useTurnOnReminder();
  // Decided when the summary opens, so marking it offered doesn't hide it straight away.
  const [shown] = useState(() => shouldOfferReminder(settings));
  const [time, setTime] = useState(settings.reminderTime);
  const [answer, setAnswer] = useState<Answer>('none');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (shown) update({ reminderOffered: true });
  }, [shown, update]);

  if (!shown) return null;

  const accept = async () => {
    setAsking(true);
    const allowed = await turnOn(time);
    setAsking(false);
    setAnswer(allowed ? 'on' : 'denied');
  };

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>A daily reminder?</Text>
      {answer === 'on' ? (
        <Text style={[styles.body, { color: colors.muted }]}>
          You&apos;ll be reminded every day at {formatReminderTime(time)}. You can change it in
          Settings.
        </Text>
      ) : answer === 'declined' ? (
        <Text style={[styles.body, { color: colors.muted }]}>
          No reminder. You can turn it on in Settings.
        </Text>
      ) : (
        <>
          <Text style={[styles.body, { color: colors.muted }]}>
            A notification at a time you choose, to come back for your session.
          </Text>
          <ReminderTimeStepper time={time} onChange={setTime} />
          {answer === 'denied' ? (
            <Text style={[styles.body, { color: colors.muted }]}>{PERMISSION_DENIED_TEXT}</Text>
          ) : null}
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              disabled={asking}
              onPress={accept}
              style={[styles.button, { backgroundColor: colors.accent, opacity: asking ? 0.6 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>
                Remind me at {formatReminderTime(time)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={asking}
              onPress={() => setAnswer('declined')}
              style={[styles.button, { borderColor: colors.accent, borderWidth: 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>No thanks</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12, marginTop: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  buttons: { gap: 8 },
  button: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
