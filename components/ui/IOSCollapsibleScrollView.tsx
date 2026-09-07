import React, { useRef } from 'react';
import {
  Animated as RNAnimated,
  Platform,
  RefreshControlProps,
  ScrollViewProps,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';

export interface IOSCollapsibleScrollViewProps extends Omit<ScrollViewProps, 'refreshControl'> {
  title: string;
  subtitle?: string;
  compactTitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBack?: boolean;
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle | ViewStyle[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  largeTitleContainerStyle?: ViewStyle;
}

export const IOSCollapsibleScrollView: React.FC<IOSCollapsibleScrollViewProps> = ({
  title,
  subtitle,
  compactTitle,
  onBack,
  rightElement,
  showBack = true,
  children,
  contentContainerStyle,
  refreshControl,
  largeTitleContainerStyle,
  onScroll,
  ...rest
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const bottomTabScroll = useBottomTabScrollHandler();
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const topInset = Math.max(insets.top, 16);
  const navBarHeight = 52;
  const stickyBarHeight = topInset + navBarHeight;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as never);
    }
  };

  const handleScroll = RNAnimated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        if (bottomTabScroll) {
          bottomTabScroll(event);
        }
        if (onScroll) {
          onScroll(event);
        }
      },
    }
  );

  // Animations for Sticky Compact Bar
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [18, 48],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [18, 48],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  const compactTitleScale = scrollY.interpolate({
    inputRange: [18, 48],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  });

  const stickyHeaderBgOpacity = scrollY.interpolate({
    inputRange: [10, 38],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Animations for Large Title in ScrollView
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, 45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const largeTitleScale = scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [1, 0.88],
    extrapolate: 'clamp',
  });

  const largeTitleTranslateY = scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const subtitleTranslateY = scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  const glassBackground = appTheme.darkMode
    ? 'rgba(15, 23, 42, 0.82)'
    : 'rgba(255, 255, 255, 0.85)';

  const glassBorderColor = appTheme.borderSoft;

  const resolvedScrollContentStyle = StyleSheet.flatten([
    styles.scrollContent,
    contentContainerStyle,
    {
      paddingTop: stickyBarHeight + 12,
      paddingBottom: insets.bottom + 80,
    },
  ]);

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      {/* Sticky Top Navigation Bar */}
      <View style={[styles.stickyBar, { height: stickyBarHeight }]} pointerEvents="box-none">
        {/* Frosted Glass Background Layer */}
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.glassLayer,
            {
              opacity: stickyHeaderBgOpacity,
              borderBottomColor: glassBorderColor,
            },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={appTheme.darkMode ? 45 : 65}
            tint={appTheme.darkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: glassBackground },
              Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  } as any)
                : undefined,
            ]}
          />
        </RNAnimated.View>

        {/* Top Controls Row */}
        <View style={[styles.stickyControls, { marginTop: topInset }]}>
          {/* Back Button */}
          {showBack ? (
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: appTheme.darkMode
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)',
                  borderColor: appTheme.borderSoft,
                },
              ]}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft color={appTheme.text} size={22} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          {/* Animated Compact Title (centered in navigation bar) */}
          <RNAnimated.View
            style={[
              styles.compactTitleContainer,
              {
                opacity: compactTitleOpacity,
                transform: [
                  { translateY: compactTitleTranslateY },
                  { scale: compactTitleScale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Typography
              variant="body"
              color={appTheme.text}
              style={styles.compactTitleText}
              numberOfLines={1}
            >
              {compactTitle || title}
            </Typography>
          </RNAnimated.View>

          {/* Right Action Elements */}
          <View style={styles.rightActionsContainer}>
            {rightElement || null}
          </View>
        </View>
      </View>

      {/* Main Animated ScrollView */}
      <RNAnimated.ScrollView
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="normal"
        bounces={true}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        contentContainerStyle={resolvedScrollContentStyle}
      >
        {/* Large Title Area (cleanly situated underneath the top navigation bar) */}
        <RNAnimated.View
          style={[
            styles.largeTitleSection,
            largeTitleContainerStyle,
            {
              opacity: largeTitleOpacity,
              transform: [
                { scale: largeTitleScale },
                { translateY: largeTitleTranslateY },
              ],
            },
          ]}
        >
          <Typography
            variant="h1"
            color={appTheme.text}
            style={styles.largeTitleText}
            numberOfLines={1}
          >
            {title}
          </Typography>

          {subtitle ? (
            <RNAnimated.View
              style={{
                opacity: subtitleOpacity,
                transform: [{ translateY: subtitleTranslateY }],
              }}
            >
              <Typography
                variant="bodySmall"
                color={appTheme.muted}
                style={styles.largeSubtitleText}
                numberOfLines={2}
              >
                {subtitle}
              </Typography>
            </RNAnimated.View>
          ) : null}
        </RNAnimated.View>

        {children}
      </RNAnimated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  glassLayer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stickyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    position: 'relative',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  compactTitleContainer: {
    position: 'absolute',
    left: 60,
    right: 60,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  largeTitleSection: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 20,
  },
  largeTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 38,
  },
  largeSubtitleText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
});
