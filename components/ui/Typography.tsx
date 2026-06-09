import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import Theme from '@/constants/theme';
import { useAppTheme } from '@/src/theme/appTheme';

interface TypographyProps extends TextProps {
  variant?: keyof typeof Theme.typography;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  color,
  align = 'left',
  style,
  children,
  ...props
}) => {
  const baseStyle = Theme.typography[variant];
  const appTheme = useAppTheme();
  const defaultColor = variant === 'caption' || variant === 'bodySmall' || variant === 'overline'
    ? appTheme.muted
    : appTheme.text;

  return (
    <RNText
      style={[
        baseStyle,
        { textAlign: align },
        { color: color || defaultColor },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};
