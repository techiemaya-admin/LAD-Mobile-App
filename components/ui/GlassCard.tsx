import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
// import { BlurView } from 'expo-blur'; // Will instruct user to install expo-blur, for now using rgba
import Theme from '@/constants/theme';
import { useAppTheme } from '@/src/theme/appTheme';

interface GlassCardProps extends ViewProps {
  intensity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ intensity = 50, style, children, ...props }) => {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: appTheme.surface,
          borderColor: appTheme.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.small,
  },
});
