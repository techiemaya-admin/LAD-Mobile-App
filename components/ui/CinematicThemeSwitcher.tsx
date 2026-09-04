import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Moon, Sun } from 'lucide-react-native';

interface CinematicThemeSwitcherProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const PARTICLES = [0, 1, 2] as const;

export function CinematicThemeSwitcher({ value, onValueChange }: CinematicThemeSwitcherProps) {
  const thumbProgress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const particleProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(thumbProgress, {
      toValue: value ? 1 : 0,
      stiffness: 300,
      damping: 20,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [thumbProgress, value]);

  const toggle = () => {
    particleProgress.stopAnimation();
    particleProgress.setValue(0);
    Animated.timing(particleProgress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={`Switch to ${value ? 'light' : 'dark'} mode`}
      onPress={toggle}
      style={({ pressed }) => [
        styles.track,
        value ? styles.trackDark : styles.trackLight,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.innerRim, value ? styles.innerRimDark : styles.innerRimLight]} pointerEvents="none" />
      <View style={styles.backgroundIcons} pointerEvents="none">
        <Sun color={value ? '#FEF3C7' : '#D97706'} size={10} strokeWidth={2.2} />
        <Moon color={value ? '#FEF3C7' : '#334155'} size={10} strokeWidth={2.2} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          value ? styles.thumbDark : styles.thumbLight,
          {
            transform: [{ translateX: thumbProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
          },
        ]}
      >
        <View style={styles.thumbShine} />
        {PARTICLES.map((particle) => (
          <Animated.View
            key={particle}
            style={[
              styles.particle,
              {
                backgroundColor: value ? 'rgba(147,197,253,0.22)' : 'rgba(251,191,36,0.28)',
                opacity: particleProgress.interpolate({
                  inputRange: [0, 0.12 + particle * 0.08, 0.78, 1],
                  outputRange: [0, 0.7, 0.16, 0],
                  extrapolate: 'clamp',
                }),
                transform: [{
                  scale: particleProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1.8 + particle * 0.45],
                  }),
                }],
              },
            ]}
          />
        ))}
        <View style={styles.thumbIcon}>
          {value
            ? <Moon color="#FDE68A" size={11} strokeWidth={2.2} />
            : <Sun color="#F59E0B" size={11} strokeWidth={2.2} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  trackDark: {
    backgroundColor: '#071131',
    borderColor: 'rgba(51,65,85,0.60)',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
  },
  trackLight: {
    backgroundColor: '#E2E8F0',
    borderColor: 'rgba(203,213,225,0.80)',
    shadowColor: '#64748B',
    shadowOpacity: 0.18,
  },
  pressed: {
    opacity: 0.9,
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    margin: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
  innerRimDark: {
    borderColor: 'rgba(0,0,0,0.46)',
    backgroundColor: 'rgba(2,6,23,0.20)',
  },
  innerRimLight: {
    borderColor: 'rgba(148,163,184,0.32)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  backgroundIcons: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumb: {
    position: 'relative',
    zIndex: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  thumbDark: {
    backgroundColor: '#475569',
    borderColor: 'rgba(148,163,184,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.58,
  },
  thumbLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#475569',
    shadowOpacity: 0.22,
  },
  thumbShine: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: 6,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  thumbIcon: {
    zIndex: 4,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 3,
  },
});
