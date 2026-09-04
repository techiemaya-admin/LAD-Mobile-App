import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Theme from '@/constants/theme';
import { useAppTheme } from '@/src/theme/appTheme';
import { Typography } from './Typography';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style }) => {
  const appTheme = useAppTheme();

  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: appTheme.darkMode ? appTheme.labelBackground : Theme.colors.successLight, text: appTheme.darkMode ? '#5EE6A8' : Theme.colors.success };
      case 'error':
        return { bg: appTheme.darkMode ? appTheme.labelBackground : Theme.colors.errorLight, text: appTheme.darkMode ? '#FB8DA1' : Theme.colors.error };
      case 'warning':
        return { bg: appTheme.darkMode ? appTheme.labelBackground : Theme.colors.warningLight, text: appTheme.darkMode ? '#F8CF63' : Theme.colors.warning };
      case 'info':
        return { bg: appTheme.darkMode ? appTheme.labelBackground : Theme.colors.infoLight, text: appTheme.darkMode ? '#8CB8FF' : Theme.colors.info };
      default:
        return { bg: appTheme.darkMode ? appTheme.labelBackground : Theme.colors.border, text: appTheme.darkMode ? appTheme.labelText : Theme.colors.textSecondary };
    }
  };

  const { bg, text } = getBadgeStyle();

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: appTheme.labelBorder, borderWidth: appTheme.darkMode ? 1 : 0 }, style]}>
      <Typography variant="overline" color={text} style={styles.text}>
        {label}
      </Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs / 2,
    borderRadius: Theme.radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    letterSpacing: 0.5,
  },
});
