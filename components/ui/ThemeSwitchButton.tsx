import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useAppTheme } from '@/src/theme/appTheme';
import useAppPreferencesStore from '@/src/store/appPreferencesStore';

interface ThemeSwitchButtonProps {
  style?: StyleProp<ViewStyle>;
}

export function ThemeSwitchButton({ style }: ThemeSwitchButtonProps) {
  const appTheme = useAppTheme();
  const setDarkMode = useAppPreferencesStore((state) => state.setDarkMode);
  const progress = useRef(new Animated.Value(appTheme.darkMode ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: appTheme.darkMode ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  }, [appTheme.darkMode, progress]);

  const sunOpacity = progress.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' });
  const moonOpacity = progress.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: appTheme.darkMode }}
      accessibilityLabel={`Switch to ${appTheme.darkMode ? 'light' : 'dark'} mode`}
      hitSlop={6}
      onPress={() => setDarkMode(!appTheme.darkMode)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: appTheme.surface,
          borderColor: appTheme.border,
          opacity: pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.icon,
          {
            opacity: sunOpacity,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
            ],
          },
        ]}
      >
        <Sun color="#F59E0B" size={20} strokeWidth={2} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.icon,
          {
            opacity: moonOpacity,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ],
          },
        ]}
      >
        <Moon color={appTheme.darkMode ? '#FDE68A' : '#0B1957'} size={20} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
