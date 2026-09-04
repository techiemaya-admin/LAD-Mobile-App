import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface AnimatedQuestionMarkProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Decorative help cue used by Accelerator questions.
 *
 * LAD Frontend 2 pulses the badge over 1.8 seconds and lets the surrounding
 * ring dissolve at the midpoint. The animation is disabled when the device's
 * Reduce Motion setting is enabled.
 */
export function AnimatedQuestionMark({ size = 22, style }: AnimatedQuestionMarkProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (reduceMotion) return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);

  const badgeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const haloScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.65],
  });
  const haloOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, { width: size, height: size }, style]}
    >
      {!reduceMotion ? (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      ) : null}
      <Animated.Text
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            fontSize: size * 0.59,
            lineHeight: size,
            transform: [{ scale: badgeScale }],
          },
        ]}
      >
        ?
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  badge: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.16)',
    fontWeight: '800',
    textAlign: 'center',
    overflow: 'hidden',
  },
});
