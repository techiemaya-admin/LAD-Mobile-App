import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import { BriefcaseBusiness, CircleUserRound, House, MessageCircle, Phone } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabKey = 'home' | 'crm' | 'chats' | 'calls' | 'profile';

type BottomTabSelectorProps = {
  activeRoute?: TabKey;
};

const tabs: {
  key: TabKey;
  label: string;
  route: string;
  routeName: string;
  icon: typeof House;
}[] = [
    { key: 'home', label: 'Home', route: '/(tabs)', routeName: 'index', icon: House },
    { key: 'crm', label: 'CRM', route: '/(tabs)/crm', routeName: 'crm', icon: BriefcaseBusiness },
    { key: 'chats', label: 'Chats', route: '/(tabs)/chats', routeName: 'chats/index', icon: MessageCircle },
    { key: 'calls', label: 'Calls', route: '/(tabs)/calls', routeName: 'calls', icon: Phone },
    { key: 'profile', label: 'Profile', route: '/(tabs)/profile', routeName: 'profile', icon: CircleUserRound },
  ];

const hiddenTabBarRouteNames = new Set([
  'ai-assistant/index',
]);

const getActiveRoute = (pathname: string): TabKey => {
  if (pathname.includes('/crm') || pathname.includes('/pipeline')) return 'crm';
  if (pathname.includes('/chats')) return 'chats';
  if (pathname.includes('/calls')) return 'calls';
  if (pathname.includes('/profile') || pathname.includes('/(drawer)')) return 'profile';
  return 'home';
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
  const maxWidth = width >= 560 ? 420 : Math.min(408, width - 24);
  const tabWidth = maxWidth / tabs.length;
  const activeBubbleWidth = 56;
  const activeBubbleOffset = (tabWidth - activeBubbleWidth) / 2;
  const darkMode = appTheme.darkMode;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: activeIndex,
      useNativeDriver: true,
      duration: 260,
      easing: Easing.out(Easing.cubic),
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
    inputRange: tabs.map((_, index) => index),
    outputRange: tabs.map((_, index) => index * tabWidth + activeBubbleOffset),
  });
  const hideTranslateY = visibility.interpolate({
    inputRange: [0, 1],
    outputRange: [104, 0],
  });
  const shellBackground = darkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const activeBackground = darkMode ? '#243BFF' : appTheme.primary;
  const activeIconColor = '#FFFFFF';
  const activeLabelColor = '#FFFFFF';
  const inactiveTextColor = darkMode ? '#B8C4D7' : '#64748B';
  const inactiveIconColor = darkMode ? '#CBD5E1' : '#475569';
  const shellBorderColor = darkMode ? 'rgba(226,232,240,0.16)' : 'rgba(203,213,225,0.86)';

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
          paddingBottom: Math.max(insets.bottom, 8),
          opacity: visibility,
          transform: [{ translateY: hideTranslateY }],
        },
      ]}
    >
      <View style={[styles.shell, { width: maxWidth, backgroundColor: shellBackground, borderColor: shellBorderColor }]}>
        <BlurView intensity={darkMode ? 44 : 58} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: shellBackground }]} pointerEvents="none" />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIsland,
            {
              width: activeBubbleWidth,
              backgroundColor: activeBackground,
              borderColor: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(11,25,87,0.12)',
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
            outputRange: [0.94, 1.08],
          });
          const iconLift = distance.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0],
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
              onPress={() => onSelect(tab)}
            >
              <Animated.View
                style={[
                  styles.iconHalo,
                  active && styles.iconHaloActive,
                  {
                    transform: [{ translateY: iconLift }, { scale: iconScale }],
                    opacity: distance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1],
                    }),
                  },
                ]}
              >
                <Icon color={iconColor} size={active ? 23 : 21} strokeWidth={active ? 2.6 : 2.1} />
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
    return tabs.find((tab) => tab.routeName === currentRouteName)?.key ?? 'home';
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
    paddingHorizontal: 12,
    zIndex: 60,
  },
  shell: {
    height: 64,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  activeIsland: {
    position: 'absolute',
    left: 0,
    top: 4,
    height: 56,
    borderRadius: 28,
    borderWidth: 0,
    shadowColor: '#0B1957',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  tab: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconHalo: {
    width: 32,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHaloActive: {
    backgroundColor: 'transparent',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 8.8,
    lineHeight: 11,
    fontWeight: '800',
  },
  labelActive: {
    fontSize: 9.6,
    lineHeight: 12,
    fontWeight: '900',
  },
});
