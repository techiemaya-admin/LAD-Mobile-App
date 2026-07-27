import { useMemo } from 'react';
import Theme from '@/constants/theme';
import useAppPreferencesStore from '@/src/store/appPreferencesStore';

export const getAppTheme = (darkMode: boolean) => ({
  darkMode,
  background: darkMode ? '#000724' : Theme.colors.background,
  surface: darkMode ? '#0F1629' : Theme.colors.surface,
  softSurface: darkMode ? '#1A2A43' : Theme.colors.background,
  input: darkMode ? '#07102B' : Theme.colors.surface,
  text: darkMode ? '#F8FAFC' : Theme.colors.text,
  muted: darkMode ? '#B8C4D6' : Theme.colors.textSecondary,
  disabled: darkMode ? '#7A8BA3' : Theme.colors.textDisabled,
  border: darkMode ? '#243653' : Theme.colors.border,
  borderSoft: darkMode ? '#172643' : Theme.colors.borderLight,
  primary: darkMode ? '#FFFFFF' : Theme.colors.primary,
  primaryAccent: darkMode ? '#2F6BFF' : Theme.colors.primary,
  tabBackground: darkMode ? '#030B28' : Theme.colors.surface,
  tabBorder: darkMode ? '#1D2C4A' : Theme.colors.border,
  tabActive: darkMode ? '#2F86FF' : Theme.colors.primary,
  tabInactive: darkMode ? '#9AABC2' : Theme.colors.textDisabled,
  primarySoft: darkMode ? 'rgba(47, 107, 255, 0.18)' : 'rgba(11, 25, 87, 0.08)',
  success: darkMode ? '#10B981' : Theme.colors.success,
  successSoft: darkMode ? 'rgba(16, 185, 129, 0.18)' : Theme.colors.successLight,
  infoSoft: darkMode ? 'rgba(47, 134, 255, 0.18)' : Theme.colors.infoLight,
  warningSoft: darkMode ? 'rgba(245, 158, 11, 0.18)' : Theme.colors.warningLight,
  errorSoft: darkMode ? 'rgba(239, 68, 68, 0.18)' : Theme.colors.errorLight,
  shadowColor: darkMode ? '#000000' : '#000000',
  statusBarStyle: darkMode ? 'light' as const : 'dark' as const,
});

export const useAppTheme = () => {
  const darkMode = useAppPreferencesStore((state) => state.darkMode);
  return useMemo(() => getAppTheme(darkMode), [darkMode]);
};
