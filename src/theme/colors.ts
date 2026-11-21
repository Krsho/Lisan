import { useColorScheme } from 'react-native';

const light = {
  background: '#fff',
  surface: '#f6f4ef',
  text: '#111',
  muted: '#555',
  accent: '#2f6f4e',
  accentSoft: '#e3efe8',
  border: '#e5e5e5',
  backdrop: 'rgba(0,0,0,0.35)',
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
  backdrop: 'rgba(0,0,0,0.6)',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
