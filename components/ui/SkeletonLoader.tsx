import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/src/theme/appTheme';

interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

/** Shimmer skeleton block — use inside SkeletonCard or standalone */
export function SkeletonBlock({ style, borderRadius = 8 }: SkeletonProps) {
  const appTheme = useAppTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.85],
  });

  const baseBg = appTheme.darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <Animated.View
      style={[
        { backgroundColor: baseBg, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Skeleton for a summary card (icon + value + label rows) */
export function SkeletonSummaryCard({ width }: { width: number }) {
  return (
    <View style={[styles.summaryCard, { width }]}>
      <View style={styles.summaryTopRow}>
        <SkeletonBlock style={styles.iconBlock} borderRadius={10} />
        <SkeletonBlock style={styles.valueBlock} borderRadius={6} />
      </View>
      <SkeletonBlock style={styles.labelBlock} borderRadius={4} />
      <SkeletonBlock style={styles.detailBlock} borderRadius={4} />
    </View>
  );
}

/** Skeleton for a chat/conversation list row */
export function SkeletonConversationRow() {
  return (
    <View style={styles.convRow}>
      <SkeletonBlock style={styles.convAvatar} borderRadius={22} />
      <View style={styles.convBody}>
        <SkeletonBlock style={styles.convName} borderRadius={4} />
        <SkeletonBlock style={styles.convPreview} borderRadius={4} />
      </View>
      <SkeletonBlock style={styles.convTime} borderRadius={4} />
    </View>
  );
}

/** Skeleton for an activity feed row */
export function SkeletonActivityRow() {
  return (
    <View style={styles.activityRow}>
      <SkeletonBlock style={styles.activityDot} borderRadius={5} />
      <View style={styles.activityBody}>
        <SkeletonBlock style={styles.activityTitle} borderRadius={4} />
        <SkeletonBlock style={styles.activityMeta} borderRadius={4} />
      </View>
    </View>
  );
}

/** Skeleton for a chat message block */
export function SkeletonMessageBlock({ isSender }: { isSender?: boolean }) {
  const appTheme = useAppTheme();
  return (
    <View style={[styles.messageBlock, isSender ? styles.messageSender : styles.messageReceiver, { backgroundColor: isSender ? appTheme.primaryAccent + '40' : appTheme.softSurface }]}>
      <SkeletonBlock style={{ height: 16, width: '80%', borderRadius: 6, marginBottom: 8 }} />
      <SkeletonBlock style={{ height: 16, width: '60%', borderRadius: 6, marginBottom: 8 }} />
      <SkeletonBlock style={{ height: 16, width: '40%', borderRadius: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'transparent',
    gap: 8,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBlock: { width: 34, height: 34 },
  valueBlock: { width: 48, height: 22 },
  labelBlock: { width: '60%', height: 10 },
  detailBlock: { width: '80%', height: 9 },

  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  convAvatar: { width: 44, height: 44, flexShrink: 0 },
  convBody: { flex: 1, gap: 6 },
  convName: { height: 14, width: '50%', borderRadius: 4 },
  convPreview: { height: 11, width: '80%', borderRadius: 4 },
  convTime: { width: 36, height: 10, alignSelf: 'flex-start', marginTop: 4 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityDot: { width: 9, height: 9, flexShrink: 0 },
  activityBody: { flex: 1, gap: 5 },
  activityTitle: { height: 13, width: '65%', borderRadius: 4 },
  activityMeta: { height: 10, width: '45%', borderRadius: 4 },

  messageBlock: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageSender: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageReceiver: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
});
