import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style }) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: Theme.colors.successLight, text: Theme.colors.success };
      case 'error':
        return { bg: Theme.colors.errorLight, text: Theme.colors.error };
      case 'warning':
        return { bg: Theme.colors.warningLight, text: Theme.colors.warning };
      case 'info':
        return { bg: Theme.colors.infoLight, text: Theme.colors.info };
      default:
        return { bg: Theme.colors.border, text: Theme.colors.textSecondary };
    }
  };

  const { bg, text } = getBadgeStyle();

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]}>
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
