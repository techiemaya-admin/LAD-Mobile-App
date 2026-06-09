import React, { useEffect, useMemo, useRef } from 'react';
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
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BriefcaseBusiness, CircleUserRound, House, MessageCircle, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';

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

function emitBottomTabHidden(hidden: boolean) {
  bottomTabHidden = hidden;
  scrollListeners.forEach((listener) => listener(hidden));
}

export function setBottomTabHidden(hidden: boolean) {
  emitBottomTabHidden(hidden);
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
  const maxWidth = width >= 560 ? 430 : Math.min(430, width - 20);
  const tabWidth = maxWidth / tabs.length;
  const activeBubbleWidth = Math.min(70, tabWidth - 10);
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
    outputRange: [112, 0],
  });
  const shellBackground = darkMode ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.78)';
  const activeBackground = darkMode ? '#304CFF' : appTheme.primary;
  const activeTextColor = darkMode ? '#FFFFFF' : '#FFFFFF';
  const inactiveTextColor = darkMode ? '#B8C4D7' : '#64748B';
  const inactiveIconColor = darkMode ? '#CBD5E1' : '#475569';

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
      <View style={[styles.shell, { width: maxWidth, backgroundColor: shellBackground, borderColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.82)' }]}>
        <BlurView intensity={darkMode ? 34 : 48} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
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
        <View style={[styles.innerHighlight, { backgroundColor: darkMode ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.72)' }]} pointerEvents="none" />
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
            outputRange: [2, -2],
          });
          const iconColor = active ? activeTextColor : inactiveIconColor;
          const labelColor = active ? activeTextColor : inactiveTextColor;

          return (
            <Pressable
              key={tab.key}
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
                <Icon color={iconColor} size={active ? 25 : 22} strokeWidth={active ? 2.7 : 2.1} />
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
    paddingHorizontal: 10,
    zIndex: 60,
  },
  shell: {
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 14,
  },
  innerHighlight: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 5,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  activeIsland: {
    position: 'absolute',
    left: 0,
    top: 5,
    bottom: 5,
    borderRadius: 30,
    borderWidth: 1,
    shadowColor: '#0B1957',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  tab: {
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  iconHalo: {
    width: 36,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHaloActive: {
    backgroundColor: 'transparent',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  labelActive: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
  },
});
