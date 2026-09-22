import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  success: string;
  error: string;
  disabled: string;
  inputBackground: string;
};

export const lightTheme: Theme = {
  dark: false,
  background: '#F8FAF8',
  surface: '#FFFFFF',
  surfaceSecondary: '#E8F0EC',
  textPrimary: '#183E32',
  textSecondary: '#52685C',
  border: '#CEDDD5',
  accent: '#215746',
  accentPressed: '#496E60',
  accentText: '#FFFFFF',
  success: '#17613F',
  error: '#9C2929',
  disabled: '#88958E',
  inputBackground: '#FFFFFF',
};

export const darkTheme: Theme = {
  dark: true,
  background: '#0D1512',
  surface: '#14201B',
  surfaceSecondary: '#20332B',
  textPrimary: '#F0F6F2',
  textSecondary: '#B7C8BE',
  border: '#3A5045',
  accent: '#72C6A2',
  accentPressed: '#4FA47F',
  accentText: '#0A2118',
  success: '#75D4A6',
  error: '#FF9C9C',
  disabled: '#718078',
  inputBackground: '#17241E',
};

export function themeForScheme(scheme: string | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export function useAppTheme(): Theme {
  return themeForScheme(useColorScheme());
}
