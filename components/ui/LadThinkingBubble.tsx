import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Theme from '@/constants/theme';
import { LadLogoMark } from '@/components/ui/LadLogoMark';

interface LadThinkingBubbleProps {
  accentColor?: string;
  avatarBackground?: string;
  bubbleBackground?: string;
  bubbleBorder?: string;
  dotColor?: string;
  logoColor?: string;
  size?: number;
}

export function LadThinkingBubble({
  accentColor = Theme.colors.primary,
  avatarBackground = '#E8ECFA',
  bubbleBackground = Theme.colors.surface,
  bubbleBorder = Theme.colors.borderLight,
  dotColor,
  logoColor,
  size = 32,
}: LadThinkingBubbleProps) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const avatarSize = size;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.delay(300),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: avatarBackground,
          },
        ]}
      >
        <LadLogoMark color={logoColor || accentColor} size={Math.max(18, avatarSize - 10)} />
      </View>
      <View style={[styles.bubble, { backgroundColor: bubbleBackground, borderColor: bubbleBorder }]}>
        {dots.map((dot, index) => {
          const translateY = dot.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -5],
          });
          const opacity = dot.interpolate({
            inputRange: [0, 1],
            outputRange: [0.42, 1],
          });
          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: dotColor || accentColor,
                  opacity,
                  transform: [{ translateY }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    minWidth: 62,
    height: 36,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...Theme.shadows.small,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
