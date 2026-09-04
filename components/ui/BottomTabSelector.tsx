import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { CircleUserRound, MessageCircle } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** LAD brand mark — the stylised "L" bird silhouette used across the app. */
const LADIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="50 120 110 130">
    <Path
      fill={color}
      fillRule="evenodd"
      d="M90.605 187.719c-13.835-4.52-27.66 7.976-24.097 22.394 4.594 17.77 23.656 26.117 42.418 25.469v-12.828c-31.363.25-42.027-33.168-18.32-35.035Zm5.2 9.379a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.734 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.73 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058ZM98.324 160.398c-14.512-4.254-33.902-13.273-39.133-28.687-1.629 5.144-2.117 10.398-1.593 15.48.383 3.735 1.02 6.989 1.87 9.833 2.571 6.68 7.126 12.62 13.356 16.882-.629-3.601-.172-7.308 1.309-10.648 8.472 10.969 37.125 14.453 50.476 23.406 5.45 3.656 8.785 9.816 8.785 16.477 0 12.058-16.421 23.84-24.168 32.433 17.418-.691 34.508-9.14 39.461-25.011 13.723-44.004-53.984-49.23-76.855-80.922 1.023 15.945 12.512 24.859 26.492 30.757Z"
    />
  </Svg>
);

export type TabKey = 'ai-assistant' | 'chats' | 'profile';

type BottomTabSelectorProps = {
  activeRoute?: TabKey;
};

export const tabs: {
  key: TabKey;
  label: string;
  route: string;
  routeName: string;
  icon: any;
}[] = [
  { key: 'ai-assistant', label: 'LAD', route: '/(tabs)', routeName: 'index', icon: LADIcon },
  { key: 'chats', label: 'Chat', route: '/(tabs)/chats', routeName: 'chats/index', icon: MessageCircle },
  { key: 'profile', label: 'Profile', route: '/(tabs)/profile', routeName: 'profile', icon: CircleUserRound },
];

const hiddenTabBarRouteNames = new Set([
  'ai-assistant/index',
]);

export const getActiveRoute = (pathname: string): TabKey => {
  if (pathname.includes('/chats')) return 'chats';
  if (pathname.includes('/profile') || pathname.includes('/(drawer)')) return 'profile';
  return 'ai-assistant';
};

const scrollListeners = new Set<(hidden: boolean) => void>();
let bottomTabHidden = false;
let bottomTabForcedHidden = false;

export function forceBottomTabHidden(hidden: boolean) {
  bottomTabForcedHidden = hidden;
  emitBottomTabHidden(hidden);
}

function emitBottomTabHidden(hidden: boolean) {
  if (bottomTabForcedHidden && !hidden) return;
  bottomTabHidden = hidden;
  scrollListeners.forEach((listener) => listener(hidden));
}

export function setBottomTabHidden(hidden: boolean) {
  emitBottomTabHidden(hidden);
}

export function useBottomTabHidden() {
  const [hidden, setHidden] = useState(bottomTabHidden);

  useEffect(() => {
    scrollListeners.add(setHidden);
    return () => {
      scrollListeners.delete(setHidden);
    };
  }, []);

  return hidden;
}

export function useBottomTabScrollHandler(onHiddenChange?: (hidden: boolean) => void) {
  const lastOffset = useRef(0);
  const lastHidden = useRef(false);

  const setHidden = (hidden: boolean) => {
    lastHidden.current = hidden;
    onHiddenChange?.(hidden);
    emitBottomTabHidden(hidden);
  };

  return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - lastOffset.current;

    if (y < 12 && lastHidden.current) {
      setHidden(false);
    } else if (delta > 9 && y > 36 && !lastHidden.current) {
      setHidden(true);
    } else if (delta < -9 && lastHidden.current) {
      setHidden(false);
    }

    lastOffset.current = y;
  };
}

function AnimatedArtBar({
  current,
  onSelect,
}: {
  current: TabKey;
  onSelect: (tab: (typeof tabs)[number]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const appTheme = useAppTheme();
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === current));
  const progress = useRef(new Animated.Value(activeIndex)).current;
  const visibility = useRef(new Animated.Value(bottomTabHidden ? 0 : 1)).current;
  const hiddenState = useRef(bottomTabHidden);
  const maxWidth = width >= 560 ? 380 : Math.min(360, width - 32);
  const tabWidth = maxWidth / tabs.length;
  const activeBubbleWidth = Math.min(84, tabWidth - 12);
  const activeBubbleOffset = (tabWidth - activeBubbleWidth) / 2;
  const darkMode = appTheme.darkMode;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [activeIndex, progress]);

  useEffect(() => {
    const setHidden = (hidden: boolean) => {
      if (hiddenState.current === hidden) return;
      hiddenState.current = hidden;
      Animated.timing(visibility, {
        toValue: hidden ? 0 : 1,
        duration: hidden ? 220 : 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    scrollListeners.add(setHidden);
    return () => {
      scrollListeners.delete(setHidden);
    };
  }, [visibility]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    let touchY = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 8) emitBottomTabHidden(true);
      if (event.deltaY < -8) emitBottomTabHidden(false);
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? touchY;
    };
    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY ?? touchY;
      const delta = touchY - nextY;
      if (delta > 8) emitBottomTabHidden(true);
      if (delta < -8) emitBottomTabHidden(false);
      touchY = nextY;
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const activeTranslateX = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      activeBubbleOffset,
      tabWidth + activeBubbleOffset,
      2 * tabWidth + activeBubbleOffset,
    ],
  });
  const hideTranslateY = visibility.interpolate({
    inputRange: [0, 1],
    outputRange: [104, 0],
  });
  const shellBackground = darkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const activeBackground = darkMode ? '#2976F4' : appTheme.primary;
  const activeIconColor = '#FFFFFF';
  const activeLabelColor = '#FFFFFF';
  const inactiveTextColor = darkMode ? '#94A3B8' : '#64748B';
  const inactiveIconColor = darkMode ? '#94A3B8' : '#64748B';
  const shellBorderColor = darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(203, 213, 225, 0.8)';

  useEffect(() => {
    if (!bottomTabForcedHidden) {
      emitBottomTabHidden(false);
    }
  }, [current]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.fixedLayer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          opacity: visibility,
          transform: [{ translateY: hideTranslateY }],
        },
      ]}
    >
      <View style={[styles.shell, { width: maxWidth, backgroundColor: shellBackground, borderColor: shellBorderColor }]}>
        <BlurView intensity={darkMode ? 48 : 60} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: shellBackground }]} pointerEvents="none" />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIsland,
            {
              width: activeBubbleWidth,
              backgroundColor: activeBackground,
              transform: [{ translateX: activeTranslateX }],
            },
          ]}
        />
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          const distance = progress.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          const iconScale = distance.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1.08],
          });
          const iconColor = active ? activeIconColor : inactiveIconColor;
          const labelColor = active ? activeLabelColor : inactiveTextColor;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              hitSlop={8}
              style={[styles.tab, { width: tabWidth }]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  void Haptics.selectionAsync().catch(() => {});
                }
                onSelect(tab);
              }}
            >
              <Animated.View
                style={[
                  styles.iconHalo,
                  {
                    transform: [{ scale: iconScale }],
                    opacity: distance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ]}
              >
                <Icon color={iconColor} size={active ? 22 : 20} strokeWidth={active ? 2.5 : 2} />
              </Animated.View>
              <Typography variant="caption" color={labelColor} style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export function ArtBottomTabBar({ state, navigation }: BottomTabBarProps) {
  const currentRouteName = state.routes[state.index]?.name;
  const current = useMemo(() => {
    return tabs.find((tab) => tab.routeName === currentRouteName)?.key ?? 'ai-assistant';
  }, [currentRouteName]);

  if (currentRouteName && hiddenTabBarRouteNames.has(currentRouteName)) {
    return null;
  }

  return (
    <AnimatedArtBar
      current={current}
      onSelect={(tab) => {
        const event = navigation.emit({
          type: 'tabPress',
          target: state.routes.find((route) => route.name === tab.routeName)?.key,
          canPreventDefault: true,
        });

        if (!event.defaultPrevented && tab.routeName !== currentRouteName) {
          navigation.navigate(tab.routeName as never);
        }
      }}
    />
  );
}

export function BottomTabSelector({ activeRoute }: BottomTabSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const current = activeRoute || getActiveRoute(pathname);

  return (
    <AnimatedArtBar
      current={current}
      onSelect={(tab) => {
        router.replace(tab.route as never);
      }}
    />
  );
}

const styles = StyleSheet.create({
  fixedLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 60,
  },
  shell: {
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  activeIsland: {
    position: 'absolute',
    left: 0,
    top: 5,
    height: 54,
    borderRadius: 27,
    shadowColor: '#2976F4',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tab: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconHalo: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '700',
  },
  labelActive: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
});
