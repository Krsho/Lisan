import { useColorScheme } from 'react-native';

import { useSettings } from '../settings/SettingsContext';
import { resolveColorScheme, type ColorSchemeName } from '../settings/settings';

const light = {
  background: '#fff',
  surface: '#f6f4ef',
  text: '#111',
  muted: '#555',
  accent: '#2f6f4e',
  accentSoft: '#e3efe8',
  border: '#e5e5e5',
};

export type Colors = typeof light;

const dark: Colors = {
  background: '#111',
  surface: '#1c1c1c',
  text: '#eee',
  muted: '#aaa',
  accent: '#7fc49d',
  accentSoft: '#21362b',
  border: '#2a2a2a',
};

/** The colour scheme in use: the theme setting, or the phone's when it is "system". */
export function useColorSchemeName(): ColorSchemeName {
  const system = useColorScheme();
  const { theme } = useSettings();
  return resolveColorScheme(theme, system === 'dark' || system === 'light' ? system : null);
}

export function useColors(): Colors {
  return useColorSchemeName() === 'dark' ? dark : light;
}
