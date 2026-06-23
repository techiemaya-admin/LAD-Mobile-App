import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional delay in ms before the enter animation starts */
  delay?: number;
}

/**
 * Premium page transition — silky FadeIn combined with a subtle upward
 * slide using a spring curve for a modern, native feel.
 */
export function AnimatedScreen({ children, style, delay = 0 }: AnimatedScreenProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(320).springify().damping(28).stiffness(160)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
