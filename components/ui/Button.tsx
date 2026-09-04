import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps, View } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'solid' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'solid',
  size = 'md',
  label,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...props
}) => {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Theme.radius.md,
      gap: Theme.spacing.sm,
    };

    switch (size) {
      case 'sm':
        base.paddingVertical = Theme.spacing.sm;
        base.paddingHorizontal = Theme.spacing.md;
        break;
      case 'md':
        base.paddingVertical = Theme.spacing.md;
        base.paddingHorizontal = Theme.spacing.xl;
        break;
      case 'lg':
        base.paddingVertical = Theme.spacing.lg;
        base.paddingHorizontal = Theme.spacing.xxl;
        break;
    }

    switch (variant) {
      case 'solid':
        base.backgroundColor = Theme.colors.primary;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1;
        base.borderColor = Theme.colors.primary;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      case 'glass':
        base.backgroundColor = Theme.colors.glass;
        base.borderWidth = 1;
        base.borderColor = 'rgba(255, 255, 255, 0.4)';
        break;
    }

    if (disabled) {
      base.opacity = 0.6;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let color = Theme.colors.surface;
    if (variant === 'outline' || variant === 'ghost') {
      color = Theme.colors.primary;
    } else if (variant === 'glass') {
      color = Theme.colors.primaryDark; // Dark text on light glass
    }

    return {
      color,
      fontWeight: '600',
    };
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextStyle().color} />
      ) : (
        <>
          {leftIcon}
          <Typography variant={size === 'sm' ? 'bodySmall' : 'bodyLarge'} style={getTextStyle()}>
            {label}
          </Typography>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};
