import { createContext, useContext, type ReactNode } from 'react';

import { DEFAULT_APP_SETTINGS, type AppSettings } from './settings';

type SettingsValue = {
  settings: AppSettings;
  /** Applies the change at once and stores it in the user database. */
  update(patch: Partial<AppSettings>): void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

/** Provides the settings to the app; UserStoreProvider loads them from the user database. */
export function SettingsProvider({
  value,
  children,
}: {
  value: SettingsValue;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** The current settings; the defaults until the user database is open (e.g. loading screens). */
export function useSettings(): AppSettings {
  return useContext(SettingsContext)?.settings ?? DEFAULT_APP_SETTINGS;
}

export function useUpdateSettings(): SettingsValue['update'] {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useUpdateSettings must be used inside SettingsProvider');
  return value.update;
}
