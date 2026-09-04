import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp, Easing } from 'react-native';
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

/** 
 * Shimmer wave block — sweeping light animation like real WhatsApp skeleton 
 */
function ShimmerBubble({ style }: { style?: StyleProp<ViewStyle> }) {
  const appTheme = useAppTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const bgBase = appTheme.darkMode ? '#2A2A2A' : '#ECECEC';
  const shimmerColor = appTheme.darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)';

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 220],
  });

  return (
    <View style={[{ backgroundColor: bgBase, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 80,
          backgroundColor: shimmerColor,
          transform: [{ translateX }, { skewX: '-20deg' }],
        }}
      />
    </View>
  );
}

/**
 * One skeleton chat bubble — mimics a WhatsApp message bubble with inner text lines
 */
function SkeletonBubble({
  isSender,
  lines = [0.75, 0.55],
  avatarVisible = false,
  channel,
}: {
  isSender: boolean;
  lines?: number[];
  avatarVisible?: boolean;
  channel?: string;
}) {
  const appTheme = useAppTheme();
  const isLinkedIn = channel === 'linkedin';

  const bubbleBg = isSender
    ? isLinkedIn
      ? (appTheme.darkMode ? '#0A66C2' : '#D6E8FA')
      : (appTheme.darkMode ? '#1A4731' : '#DCF8C6')
    : appTheme.darkMode ? '#2A2A2A' : '#FFFFFF';

  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const lineBg = appTheme.darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const lineShimmer = appTheme.darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)';

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 200],
  });

  return (
    <View
      style={[
        styles.bubbleRow,
        isSender ? styles.bubbleRowSender : styles.bubbleRowReceiver,
      ]}
    >
      {/* Avatar placeholder for received messages */}
      {!isSender && avatarVisible && (
        <View style={styles.bubbleAvatar}>
          <ShimmerBubble style={{ width: 32, height: 32, borderRadius: 16 }} />
        </View>
      )}

      {/* Bubble */}
      <View
        style={[
          styles.bubbleShape,
          isSender ? styles.bubbleSenderTail : styles.bubbleReceiverTail,
          {
            backgroundColor: bubbleBg,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: appTheme.darkMode ? 0.3 : 0.08,
            shadowRadius: 2,
            elevation: 1,
            overflow: 'hidden',
          },
        ]}
      >
        {/* Shimmer sweep over the whole bubble */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 60,
            backgroundColor: lineShimmer,
            transform: [{ translateX }, { skewX: '-20deg' }],
            zIndex: 1,
          }}
        />

        {/* Text line placeholders */}
        {lines.map((widthFraction, idx) => (
          <View
            key={idx}
            style={{
              height: 11,
              width: `${widthFraction * 100}%`,
              borderRadius: 5,
              backgroundColor: lineBg,
              marginBottom: idx < lines.length - 1 ? 7 : 0,
            }}
          />
        ))}

        {/* Timestamp placeholder */}
        <View style={[styles.bubbleTimestamp, isSender && styles.bubbleTimestampSender]}>
          <View
            style={{
              height: 9,
              width: 32,
              borderRadius: 4,
              backgroundColor: lineBg,
              marginRight: isSender ? 4 : 0,
            }}
          />
          {isSender && (
            <View style={{ height: 9, width: 14, borderRadius: 4, backgroundColor: lineBg }} />
          )}
        </View>
      </View>
    </View>
  );
}

/** 
 * WhatsApp-style message loading skeleton — a mix of sent/received bubbles 
 * with shimmer animation and realistic chat bubble shapes.
 */
export function SkeletonMessageBlock({ isSender, channel }: { isSender?: boolean; channel?: string }) {
  // If isSender is specified, render a single bubble; otherwise render a full chat skeleton
  if (isSender !== undefined) {
    return (
      <SkeletonBubble
        isSender={isSender}
        lines={isSender ? [0.7, 0.5] : [0.8, 0.6, 0.4]}
        avatarVisible={false}
        channel={channel}
      />
    );
  }

  // Full chat skeleton — mixed bubbles like a real WhatsApp conversation loading
  return (
    <View style={styles.chatSkeletonContainer}>
      <SkeletonBubble isSender={false} lines={[0.78, 0.52]} channel={channel} />
      <SkeletonBubble isSender={true} lines={[0.6]} channel={channel} />
      <SkeletonBubble isSender={false} lines={[0.85, 0.65, 0.4]} channel={channel} />
      <SkeletonBubble isSender={true} lines={[0.72, 0.48]} channel={channel} />
      <SkeletonBubble isSender={false} lines={[0.55]} channel={channel} />
      <SkeletonBubble isSender={true} lines={[0.8, 0.35]} channel={channel} />
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

  // WhatsApp skeleton chat container
  chatSkeletonContainer: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
  },

  // Per-bubble row
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleRowSender: {
    justifyContent: 'flex-end',
    paddingLeft: 60,
  },
  bubbleRowReceiver: {
    justifyContent: 'flex-start',
    paddingRight: 60,
  },

  // Avatar circle for received messages
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },

  // Bubble shape
  bubbleShape: {
    borderRadius: 16,
    padding: 10,
    maxWidth: '100%',
  },
  bubbleSenderTail: {
    borderBottomRightRadius: 4,
  },
  bubbleReceiverTail: {
    borderBottomLeftRadius: 4,
  },

  // Timestamp row inside bubble
  bubbleTimestamp: {
    flexDirection: 'row',
    marginTop: 5,
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 3,
  },
  bubbleTimestampSender: {
    justifyContent: 'flex-end',
  },
});
