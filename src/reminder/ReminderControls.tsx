import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useSettings, useUpdateSettings } from '../settings/SettingsContext';
import { useColors } from '../theme/colors';
import { requestReminderPermission } from './notifications';
import { formatReminderTime, stepReminderTime } from './reminder';

export const PERMISSION_DENIED_TEXT =
  "Notifications are off for Lisan. Allow them in your phone's settings to get the reminder.";

/**
 * Turns the reminder on once notifications are allowed; returns whether they were. Turning it on
 * also counts as the offer having been answered, so the summary doesn't offer it again.
 */
export function useTurnOnReminder(): (reminderTime: number) => Promise<boolean> {
  const update = useUpdateSettings();
  return async (reminderTime) => {
    let allowed = false;
    try {
      allowed = await requestReminderPermission();
    } catch (error) {
      console.error('Failed to ask for notification permission', error);
    }
    if (allowed) update({ reminderEnabled: true, reminderTime, reminderOffered: true });
    return allowed;
  };
}

/** The reminder time, moved a quarter hour earlier or later. */
export function ReminderTimeStepper({
  time,
  onChange,
}: {
  time: number;
  onChange: (time: number) => void;
}) {
  const colors = useColors();
  const label = formatReminderTime(time);
  return (
    <View style={styles.row}>
      <StepButton
        label="−"
        accessibilityLabel="Earlier reminder"
        onPress={() => onChange(stepReminderTime(time, -1))}
      />
      <Text
        style={[styles.time, { color: colors.text }]}
        accessibilityLabel={`Reminder time ${label}`}
      >
        {label}
      </Text>
      <StepButton
        label="+"
        accessibilityLabel="Later reminder"
        onPress={() => onChange(stepReminderTime(time, 1))}
      />
    </View>
  );
}

function StepButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={[styles.stepButton, { borderColor: colors.accent }]}
    >
      <Text style={[styles.stepText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** The settings screen's reminder controls: on or off, and the time. */
export function ReminderSettings() {
  const colors = useColors();
  const settings = useSettings();
  const update = useUpdateSettings();
  const turnOn = useTurnOnReminder();
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  const toggle = async (on: boolean) => {
    if (!on) {
      update({ reminderEnabled: false });
      return;
    }
    setAsking(true);
    const allowed = await turnOn(settings.reminderTime);
    setAsking(false);
    setDenied(!allowed);
  };

  return (
    <>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>Daily reminder</Text>
        <Switch
          accessibilityLabel="Daily reminder"
          value={settings.reminderEnabled}
          disabled={asking}
          onValueChange={toggle}
          trackColor={{ true: colors.accent }}
        />
      </View>
      <ReminderTimeStepper
        time={settings.reminderTime}
        onChange={(reminderTime) => update({ reminderTime })}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>
        {denied
          ? PERMISSION_DENIED_TEXT
          : settings.reminderEnabled
            ? `A notification every day at ${formatReminderTime(settings.reminderTime)}.`
            : 'Off. Turn it on for a notification at this time every day.'}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  time: { fontSize: 18, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  stepText: { fontSize: 18, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16 },
  hint: { fontSize: 13 },
});
