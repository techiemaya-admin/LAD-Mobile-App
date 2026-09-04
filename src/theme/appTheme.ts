import { useMemo } from 'react';
import Theme from '@/constants/theme';
import useAppPreferencesStore from '@/src/store/appPreferencesStore';

export const getAppTheme = (darkMode: boolean) => ({
  darkMode,
  background: darkMode ? '#000724' : Theme.colors.background,
  surface: darkMode ? '#071131' : Theme.colors.surface,
  softSurface: darkMode ? 'rgba(30, 41, 59, 0.50)' : Theme.colors.background,
  input: darkMode ? '#0A1957' : Theme.colors.surface,
  text: darkMode ? '#F8FAFC' : Theme.colors.text,
  muted: darkMode ? '#B8C4D6' : Theme.colors.textSecondary,
  disabled: darkMode ? '#7A8BA3' : Theme.colors.textDisabled,
  border: darkMode ? 'rgba(23, 37, 84, 0.40)' : Theme.colors.border,
  borderSoft: darkMode ? 'rgba(23, 37, 84, 0.28)' : Theme.colors.borderLight,
  primary: darkMode ? '#FFFFFF' : Theme.colors.primary,
  primaryAccent: darkMode ? '#2976F4' : Theme.colors.primary,
  tabBackground: darkMode ? '#071131' : Theme.colors.surface,
  tabBorder: darkMode ? 'rgba(23, 37, 84, 0.40)' : Theme.colors.border,
  tabActive: darkMode ? '#2976F4' : Theme.colors.primary,
  tabInactive: darkMode ? '#9AABC2' : Theme.colors.textDisabled,
  primarySoft: darkMode ? 'rgba(41, 118, 244, 0.18)' : 'rgba(11, 25, 87, 0.08)',
  success: darkMode ? '#10B981' : Theme.colors.success,
  successSoft: darkMode ? 'rgba(16, 185, 129, 0.18)' : Theme.colors.successLight,
  infoSoft: darkMode ? 'rgba(41, 118, 244, 0.18)' : Theme.colors.infoLight,
  warningSoft: darkMode ? 'rgba(245, 158, 11, 0.18)' : Theme.colors.warningLight,
  errorSoft: darkMode ? 'rgba(239, 68, 68, 0.18)' : Theme.colors.errorLight,
  // Labels, tags, badges and status chips use an opaque navy surface in dark
  // mode so semantic colors stay readable without producing bright patches.
  labelBackground: darkMode ? '#0A1738' : Theme.colors.borderLight,
  labelBackgroundActive: darkMode ? '#102A5C' : Theme.colors.primaryLight,
  labelBorder: darkMode ? '#20365F' : Theme.colors.border,
  labelText: darkMode ? '#DCE7FA' : Theme.colors.textSecondary,
  shadowColor: darkMode ? '#000000' : '#000000',
  statusBarStyle: darkMode ? 'light' as const : 'dark' as const,
});

export const useAppTheme = () => {
  const darkMode = useAppPreferencesStore((state) => state.darkMode);
  return useMemo(() => getAppTheme(darkMode), [darkMode]);
};
