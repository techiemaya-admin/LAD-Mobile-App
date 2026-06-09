import { Platform } from 'react-native';

export const COLORS = {
  primary: '#0B1957',
  primaryLight: '#1A2C7B',
  primaryDark: '#050D33',
  background: '#F8F9FC', // Soft cool off-white
  surface: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.6)', // Simulated oklab background with opacity
  glassDark: 'rgba(255, 255, 255, 0.2)',
  text: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: 'rgba(229, 231, 235, 0.5)',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  transparent: 'transparent',
};

export const Colors = {
  light: {
    text: COLORS.text,
    background: COLORS.background,
    tint: COLORS.primary,
    icon: COLORS.textSecondary,
    tabIconDefault: COLORS.textSecondary,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: COLORS.surface,
    background: COLORS.primaryDark,
    tint: COLORS.surface,
    icon: COLORS.textDisabled,
    tabIconDefault: COLORS.textDisabled,
    tabIconSelected: COLORS.surface,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 5.46,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10.32,
    elevation: 8,
  },
};

export const FONTS = {
  main: Platform.select({
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  rounded: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  mono: Platform.OS === 'ios' ? 'Courier' : 'monospace',
};

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, color: COLORS.text, fontFamily: FONTS.main },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, color: COLORS.text, fontFamily: FONTS.main },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28, color: COLORS.text, fontFamily: FONTS.main },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26, color: COLORS.text, fontFamily: FONTS.main },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, color: COLORS.text, fontFamily: FONTS.main },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, color: COLORS.text, fontFamily: FONTS.main },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, color: COLORS.textSecondary, fontFamily: FONTS.main },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, color: COLORS.textSecondary, fontFamily: FONTS.main },
  overline: { fontSize: 10, fontWeight: '700' as const, lineHeight: 14, textTransform: 'uppercase' as const, letterSpacing: 1, color: COLORS.textDisabled, fontFamily: FONTS.main },
};

export const Theme = {
  colors: COLORS,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  typography: TYPOGRAPHY,
  fonts: FONTS,
};

export const Fonts = FONTS;

export default Theme;
