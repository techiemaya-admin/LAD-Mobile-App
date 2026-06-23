import { useMemo } from 'react';
import Theme from '@/constants/theme';
import useAppPreferencesStore from '@/src/store/appPreferencesStore';

export const getAppTheme = (darkMode: boolean) => ({
  darkMode,
  background: darkMode ? '#0F172A' : Theme.colors.background,
  surface: darkMode ? '#111827' : Theme.colors.surface,
  softSurface: darkMode ? '#1E293B' : Theme.colors.background,
  input: darkMode ? '#172033' : Theme.colors.surface,
  text: darkMode ? '#F8FAFC' : Theme.colors.text,
  muted: darkMode ? '#CBD5E1' : Theme.colors.textSecondary,
  disabled: darkMode ? '#A7B3C7' : Theme.colors.textDisabled,
  border: darkMode ? '#334155' : Theme.colors.border,
  borderSoft: darkMode ? '#263244' : Theme.colors.borderLight,
  primary: darkMode ? '#FFFFFF' : Theme.colors.primary,
  primaryAccent: darkMode ? '#B8C7FF' : Theme.colors.primary,
  tabBackground: darkMode ? '#111827' : Theme.colors.surface,
  tabBorder: darkMode ? '#334155' : Theme.colors.border,
  tabActive: darkMode ? '#FFFFFF' : Theme.colors.primary,
  tabInactive: darkMode ? '#A7B3C7' : Theme.colors.textDisabled,
  primarySoft: darkMode ? 'rgba(184, 199, 255, 0.18)' : 'rgba(11, 25, 87, 0.08)',
  success: darkMode ? '#10B981' : Theme.colors.success,
  successSoft: darkMode ? 'rgba(16, 185, 129, 0.18)' : Theme.colors.successLight,
  infoSoft: darkMode ? 'rgba(59, 130, 246, 0.18)' : Theme.colors.infoLight,
  warningSoft: darkMode ? 'rgba(245, 158, 11, 0.18)' : Theme.colors.warningLight,
  errorSoft: darkMode ? 'rgba(239, 68, 68, 0.18)' : Theme.colors.errorLight,
  shadowColor: darkMode ? '#000000' : '#000000',
  statusBarStyle: darkMode ? 'light' as const : 'dark' as const,
});

export const useAppTheme = () => {
  const darkMode = useAppPreferencesStore((state) => state.darkMode);
  return useMemo(() => getAppTheme(darkMode), [darkMode]);
};
