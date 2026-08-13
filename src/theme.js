import { Platform } from 'react-native';

export const colors = {
  bg: '#f4f1ec',
  surface: '#ffffff',
  ink: '#221f1b',
  muted: '#5f5950',
  border: '#d9d3c9',
  accent: '#2c6e49',
  accentDark: '#245a3c',
  offline: '#b45309',
  error: '#9b1c1c',
  onAccent: '#ffffff',
  onAccentSoft: 'rgba(255, 255, 255, 0.85)',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
