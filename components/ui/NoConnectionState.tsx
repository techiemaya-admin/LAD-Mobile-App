import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { RefreshCw } from 'lucide-react-native';

import Theme from '@/constants/theme';
import { useAppTheme } from '@/src/theme/appTheme';
import { Typography } from './Typography';

const NO_CONNECTION_ANIMATION = require('../../assets/animations/no-connection.svg');

type NoConnectionStateProps = {
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
};

export function NoConnectionState({
  title = 'Oops, connection lost',
  retryLabel = 'Retry',
  onRetry,
  isRetrying = false,
  compact = false,
  minHeight,
  style,
}: NoConnectionStateProps) {
  const appTheme = useAppTheme();
  const imageSize = compact ? 112 : 154;

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        minHeight != null && { minHeight },
        style,
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={title}
    >
      <ExpoImage
        source={NO_CONNECTION_ANIMATION}
        style={{ width: imageSize, height: imageSize }}
        contentFit="contain"
        autoplay
      />
      <Typography
        variant={compact ? 'body' : 'h4'}
        color={appTheme.text}
        style={[styles.title, compact && styles.titleCompact]}
      >
        {title}
      </Typography>
      {onRetry ? (
        <TouchableOpacity
          style={[
            styles.retryButton,
            {
              backgroundColor: appTheme.primaryAccent,
              opacity: isRetrying ? 0.78 : 1,
            },
          ]}
          onPress={onRetry}
          disabled={isRetrying}
          activeOpacity={0.82}
          accessibilityRole="button"
        >
          {isRetrying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <RefreshCw color="#FFFFFF" size={17} />
          )}
          <Typography variant="bodySmall" color="#FFFFFF" style={styles.retryText}>
            {retryLabel}
          </Typography>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xl,
    gap: 14,
  },
  containerCompact: {
    paddingVertical: Theme.spacing.md,
    gap: 10,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleCompact: {
    fontWeight: '700',
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 44,
    minWidth: 122,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Theme.shadows.small,
  },
  retryText: {
    fontWeight: '800',
  },
});
