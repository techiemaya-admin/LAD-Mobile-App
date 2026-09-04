import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated as RNAnimated,
  ScrollViewProps,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';

export interface CollapsibleHeaderProps {
  title: string;
  subtitle?: string;
  backText?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightActions?: React.ReactNode;
  scrollY: RNAnimated.Value;
  compactTitle?: string;
  style?: ViewStyle;
}

export const CollapsibleStickyBar: React.FC<{
  title: string;
  backText?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightActions?: React.ReactNode;
  scrollY: RNAnimated.Value;
  compactTitle?: string;
  stickyBarHeight: number;
  topInset: number;
}> = ({
  title,
  backText = 'BACK TO SETTINGS MENU',
  showBackButton = true,
  onBackPress,
  rightActions,
  scrollY,
  compactTitle,
  stickyBarHeight,
  topInset,
}) => {
  const router = useRouter();
  const appTheme = useAppTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  // Interpolations for Back Text (fades out as you scroll up)
  const backTextOpacity = scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const backTextTranslateX = scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [0, -6],
    extrapolate: 'clamp',
  });

  // Interpolations for Sticky Compact Title (fades in in place of backText as you scroll up)
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [20, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const compactTitleTranslateX = scrollY.interpolate({
    inputRange: [20, 50],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });

  // Background and border opacity of the frosted glass sticky bar
  const stickyHeaderBgOpacity = scrollY.interpolate({
    inputRange: [15, 45],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const glassBackground = appTheme.darkMode
    ? 'rgba(15, 23, 42, 0.72)'
    : 'rgba(255, 255, 255, 0.75)';

  const glassBorderColor = appTheme.darkMode
    ? 'rgba(255, 255, 255, 0.10)'
    : 'rgba(0, 0, 0, 0.07)';

  return (
    <View style={[styles.stickyBarContainer, { height: stickyBarHeight }]} pointerEvents="box-none">
      {/* Frosted Glass Background layer (fades in on scroll with blur and semi-transparency) */}
      <RNAnimated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glassLayer,
          {
            opacity: stickyHeaderBgOpacity,
            borderBottomColor: glassBorderColor,
          },
        ]}
      >
        <BlurView
          intensity={appTheme.darkMode ? 50 : 70}
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
          pointerEvents="none"
        />
      </RNAnimated.View>

      {/* Top Row content (persistent bar) */}
      <View style={[styles.stickyContent, { paddingTop: topInset }]}>
        <View style={styles.topRow}>
          <View style={styles.leftContainer}>
            {showBackButton ? (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backIconButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View
                  style={[
                    styles.backIconWrap,
                    {
                      backgroundColor: appTheme.darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <ArrowLeft color={appTheme.text} size={16} strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Title / Back Text Slot (Cross-fades on scroll) */}
            <View style={styles.titleTransitionContainer}>
              {backText ? (
                <RNAnimated.View
                  style={[
                    styles.backTextAbsolute,
                    {
                      opacity: backTextOpacity,
                      transform: [{ translateX: backTextTranslateX }],
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={handleBack}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Typography
                      variant="caption"
                      color={appTheme.muted}
                      style={styles.backText}
                      numberOfLines={1}
                    >
                      {backText}
                    </Typography>
                  </TouchableOpacity>
                </RNAnimated.View>
              ) : null}

              {/* Compact Title that fades in on scroll */}
              <RNAnimated.View
                style={[
                  styles.compactTitleAbsolute,
                  {
                    opacity: compactTitleOpacity,
                    transform: [{ translateX: compactTitleTranslateX }],
                  },
                ]}
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
            </View>
          </View>

          {/* Right Actions */}
          <View style={styles.rightActionsContainer}>{rightActions}</View>
        </View>
      </View>
    </View>
  );
};

export const CollapsibleHeader: React.FC<CollapsibleHeaderProps> = ({
  title,
  subtitle,
  backText = 'BACK TO SETTINGS MENU',
  showBackButton = true,
  onBackPress,
  rightActions,
  scrollY,
  compactTitle,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12);
  const stickyBarHeight = topInset + 44;

  return (
    <CollapsibleStickyBar
      title={title}
      backText={backText}
      showBackButton={showBackButton}
      onBackPress={onBackPress}
      rightActions={rightActions}
      scrollY={scrollY}
      compactTitle={compactTitle}
      stickyBarHeight={stickyBarHeight}
      topInset={topInset}
    />
  );
};

interface CollapsibleScrollViewProps extends ScrollViewProps {
  title: string;
  subtitle?: string;
  backText?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightActions?: React.ReactNode;
  compactTitle?: string;
  children: React.ReactNode;
}

export const CollapsibleScrollView: React.FC<CollapsibleScrollViewProps> = ({
  title,
  subtitle,
  backText,
  showBackButton = true,
  onBackPress,
  rightActions,
  compactTitle,
  children,
  contentContainerStyle,
  onScroll,
  ...rest
}) => {
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const bottomTabScroll = useBottomTabScrollHandler();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();

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

  // Interpolations for Large Title inside ScrollView
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const largeTitleScale = scrollY.interpolate({
    inputRange: [0, 45],
    outputRange: [1, 0.94],
    extrapolate: 'clamp',
  });

  const largeTitleTranslateY = scrollY.interpolate({
    inputRange: [0, 45],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const topInset = Math.max(insets.top, 12);
  const stickyBarHeight = topInset + 44;

  return (
    <View style={styles.flexOne}>
      {/* Sticky Frosted Glass Top Bar (fixed over the scroll content) */}
      <CollapsibleStickyBar
        title={title}
        backText={backText}
        showBackButton={showBackButton}
        onBackPress={onBackPress}
        rightActions={rightActions}
        scrollY={scrollY}
        compactTitle={compactTitle}
        stickyBarHeight={stickyBarHeight}
        topInset={topInset}
      />

      {/* Animated ScrollView: Starts below status bar, with content scrolling underneath the glass bar */}
      <RNAnimated.ScrollView
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="normal"
        bounces={true}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollPadding,
          {
            paddingTop: stickyBarHeight + 4,
            paddingBottom: insets.bottom + 90,
          },
          contentContainerStyle,
        ]}
      >
        {/* Large Title Area (Inside ScrollView so it scrolls away naturally with zero leftover white space) */}
        <RNAnimated.View
          style={[
            styles.largeTitleContainer,
            {
              opacity: largeTitleOpacity,
              transform: [
                { scale: largeTitleScale },
                { translateY: largeTitleTranslateY },
              ],
            },
          ]}
        >
          <View style={styles.largeTitleRow}>
            <View style={styles.largeTitleTextWrap}>
              <Typography variant="h1" color={appTheme.text} style={styles.largeTitle}>
                {title}
              </Typography>
              {subtitle ? (
                <RNAnimated.View style={{ opacity: subtitleOpacity }}>
                  <Typography variant="bodySmall" color={appTheme.muted} style={styles.subtitle} numberOfLines={2}>
                    {subtitle}
                  </Typography>
                </RNAnimated.View>
              ) : null}
            </View>
          </View>
        </RNAnimated.View>

        {children}
      </RNAnimated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  stickyBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  glassLayer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stickyContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  backIconButton: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTransitionContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  backTextAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  compactTitleAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  compactTitleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  largeTitleContainer: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 16,
  },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTitleTextWrap: {
    flex: 1,
    gap: 4,
  },
  largeTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  scrollPadding: {
    paddingHorizontal: 16,
  },
});
