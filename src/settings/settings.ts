/**
 * The learner's settings (reading, the learning pace and the daily reminder): what they are, their defaults, and how they are read back from the user
 * database. Pure, so the rules are tested without React or SQLite.
 *
 * Each setting is stored as its own row (key, JSON value), so a device that doesn't know a key
 * (an older app version, after sync) keeps it untouched and a bad value only resets that setting.
 */

import { NEW_LEMMA_BUDGET, type Pace, type PlanSettings } from '../engine';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorSchemeName = 'light' | 'dark';

/** Everything the learner sets; the pace (PlanSettings) is what the engine plans with. */
export type AppSettings = PlanSettings & {
  /** Follows the phone's light/dark mode unless overridden. */
  theme: ThemePreference;
  /** Multiplies the size of Quran text on every ayah screen. */
  arabicFontScale: number;
  /** Whether an ayah's translation is open when it is first shown. */
  showTranslation: boolean;
  /** Whether an ayah's tafsir is open when it is first shown. */
  showTafsir: boolean;
  /** Whether the learner has been through onboarding (shown on first launch). */
  onboarded: boolean;
  /** Whether the daily reminder notification is on. Off until the learner turns it on. */
  reminderEnabled: boolean;
  /** When the daily reminder fires, in minutes after midnight (local time). Kept while it is off. */
  reminderTime: number;
  /** Whether the reminder has been offered after a completed session (it is offered only once). */
  reminderOffered: boolean;
  // Reserved: `hideTashkeel` (the hide-tashkeel challenge mode) is a later feature. Don't reuse
  // the key for anything else.
};

export type SettingKey = keyof AppSettings;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  arabicFontScale: 1,
  showTranslation: true,
  showTafsir: false,
  pace: 'normal',
  onboarded: false,
  reminderEnabled: false,
  reminderTime: 20 * 60,
  reminderOffered: false,
};

export const MINUTES_PER_DAY = 24 * 60;

/** The sizes the settings screen steps through, smallest first. */
export const ARABIC_FONT_SCALES: readonly number[] = [0.85, 1, 1.15, 1.3, 1.5, 1.75];

const MIN_SCALE = ARABIC_FONT_SCALES[0];
const MAX_SCALE = ARABIC_FONT_SCALES[ARABIC_FONT_SCALES.length - 1];

const THEMES = new Set<unknown>(['system', 'light', 'dark']);
const PACES = new Set<unknown>(Object.keys(NEW_LEMMA_BUDGET));

/** Returns the value if it is valid for the setting, else undefined. */
function validate(key: SettingKey, value: unknown): AppSettings[SettingKey] | undefined {
  switch (key) {
    case 'theme':
      return THEMES.has(value) ? (value as ThemePreference) : undefined;
    case 'arabicFontScale':
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
        : undefined;
    case 'showTranslation':
    case 'showTafsir':
    case 'onboarded':
    case 'reminderEnabled':
    case 'reminderOffered':
      return typeof value === 'boolean' ? value : undefined;
    case 'pace':
      return PACES.has(value) ? (value as Pace) : undefined;
    case 'reminderTime':
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < MINUTES_PER_DAY
        ? value
        : undefined;
  }
}

const isSettingKey = (key: string): key is SettingKey => key in DEFAULT_APP_SETTINGS;

export type SettingRow = { key: string; value: string };

/** The settings stored in the user database, with defaults for any missing or unreadable. */
export function parseSettings(rows: readonly SettingRow[]): AppSettings {
  const settings: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS };
  for (const { key, value } of rows) {
    if (!isSettingKey(key)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      continue;
    }
    const valid = validate(key, parsed);
    if (valid !== undefined) settings[key] = valid;
  }
  return settings as AppSettings;
}

/** The rows to store for changed settings. */
export function serializeSettings(patch: Partial<AppSettings>): SettingRow[] {
  return Object.entries(patch)
    .filter(([key, value]) => isSettingKey(key) && value !== undefined)
    .map(([key, value]) => ({ key, value: JSON.stringify(value) }));
}

/** The colour scheme to draw with, given the setting and the phone's own (null if unknown). */
export function resolveColorScheme(
  theme: ThemePreference,
  system: ColorSchemeName | null | undefined,
): ColorSchemeName {
  return theme === 'system' ? (system ?? 'light') : theme;
}

/** The next font size up (+1) or down (-1) from the current one, staying within the steps. */
export function stepFontScale(current: number, direction: 1 | -1): number {
  const steps = ARABIC_FONT_SCALES;
  // A stored size between steps (from an older app version) moves to the neighbouring step.
  const next =
    direction > 0
      ? steps.find((s) => s > current + 1e-6)
      : steps.findLast((s) => s < current - 1e-6);
  return next ?? (direction > 0 ? MAX_SCALE : MIN_SCALE);
}
