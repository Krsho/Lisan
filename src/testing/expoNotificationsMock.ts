/**
 * A stand-in for expo-notifications in component tests, which have no native module:
 * `jest.mock('expo-notifications', () => jest.requireActual('../testing/expoNotificationsMock'))`.
 * By default notifications are not yet allowed and the learner allows them when asked.
 */

export const AndroidImportance = { DEFAULT: 3 };
export const IosAuthorizationStatus = {
  NOT_DETERMINED: 0,
  DENIED: 1,
  AUTHORIZED: 2,
  PROVISIONAL: 3,
};
export const SchedulableTriggerInputTypes = { DAILY: 'daily' };

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async () => null);
export const getPermissionsAsync = jest.fn(async () => ({ granted: false, canAskAgain: true }));
export const requestPermissionsAsync = jest.fn(async () => ({ granted: true, canAskAgain: true }));
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => {});
export const scheduleNotificationAsync = jest.fn(async () => 'reminder');
