/**
 * Thin adapter over expo-notifications for the daily reminder: local notifications only, no push
 * server. The decisions (whether it is on, at what time) come from ./reminder.ts.
 *
 * Delivery on Android is approximate (possibly a few minutes late): exact alarms need a
 * permission that Android 14+ denies by default and Google Play scrutinizes, and a daily study
 * reminder doesn't need it.
 */

import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderAction } from './reminder';

const CHANNEL_ID = 'daily-reminder';

/** Android 8+ shows notifications only through a channel; making it again changes nothing. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reminder',
    importance: AndroidImportance.DEFAULT,
  });
}

let handlerSet = false;

/** Shows the reminder even if it fires while the app is open. Safe to call more than once. */
export function configureReminderDisplay(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks to show notifications if it hasn't been allowed yet. Returns whether they are allowed.
 * On Android 13+ the system only asks once a channel exists, so the channel is made first.
 */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const allowed = (p: Notifications.NotificationPermissionsStatus) =>
    p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  const current = await Notifications.getPermissionsAsync();
  if (allowed(current)) return true;
  if (!current.canAskAgain) return false;
  return allowed(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  );
}

/**
 * Makes the phone's schedule match the action. The app schedules only this one notification, so
 * it clears everything it scheduled before (also covering a changed time) and schedules afresh.
 */
export function applyReminder(action: ReminderAction): Promise<void> {
  // One at a time, so quick changes of the time can't interleave and leave two scheduled.
  const run = pending.then(() => schedule(action));
  pending = run.catch(() => {});
  return run;
}

let pending: Promise<void> = Promise.resolve();

async function schedule(action: ReminderAction): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (action.kind === 'cancel') return;
  // The channel may be missing, e.g. after the app was reinstalled and its settings restored.
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Lisan', body: 'Your daily session is ready.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: action.hour,
      minute: action.minute,
      channelId: CHANNEL_ID,
    },
  });
}
