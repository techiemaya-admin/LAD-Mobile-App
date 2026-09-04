import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Theme from '@/constants/theme';
import { useBottomTabHidden } from '@/components/ui/BottomTabSelector';
import { safeStorage } from '@/src/api';
import useAuthStore from '@/src/store/authStore';
import { useChatStore } from '@/src/store/chatStore';
import { useOverlayStore } from '@/src/store/overlayStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { Logo } from '@/components/ui/Logo';

const BUTTON_SIZE = 54;
const STORAGE_PREFIX = 'lad.floatingAssistant.position.v3.';
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function FloatingAssistantButton() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const appTheme = useAppTheme();
  const token = useAuthStore((state) => state.token);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const isCallDialerOpen = useOverlayStore((state) => state.isCallDialerOpen);
  const bottomTabHidden = useBottomTabHidden();
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionRef = useRef({ x: 0, y: 0 });
  const desiredPositionRef = useRef({ x: 0, y: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const isAuthRoute = segments[0] === '(auth)';
  const isAssistantRoute = pathname.includes('/ai-assistant') || segments.includes('ai-assistant');
  const isCallsRoute = pathname.includes('/calls') || segments.includes('calls');
  const isChatsRoute = pathname.includes('/chats') || segments.includes('chats');
  const bottomOffset = Math.max(insets.bottom, 0) + (isCallsRoute ? 166 : 104);
  const bottomEdgeReserve = Math.max(insets.bottom, 10) + 12;
  const visibleTabReserve = Math.max(insets.bottom, 10) + 76;
  const iconColor = appTheme.darkMode ? '#F8FAFC' : '#0B1958';
  const storageKey = `${STORAGE_PREFIX}${pathname || 'home'}`;
  const fullScreenBounds = useMemo(() => ({
    minX: 8,
    maxX: Math.max(8, width - BUTTON_SIZE - 8),
    minY: Math.max(insets.top + 8, 8),
    maxY: Math.max(insets.top + 8, height - BUTTON_SIZE - bottomEdgeReserve),
  }), [bottomEdgeReserve, height, insets.top, width]);
  const activeBounds = useMemo(() => {
    const bottomReserve = bottomTabHidden ? bottomEdgeReserve : visibleTabReserve;
    return {
      ...fullScreenBounds,
      maxY: Math.max(fullScreenBounds.minY, height - BUTTON_SIZE - bottomReserve),
    };
  }, [bottomEdgeReserve, bottomTabHidden, fullScreenBounds, height, visibleTabReserve]);
  const toDisplayPosition = useCallback((position: { x: number; y: number }) => ({
    x: clamp(position.x, activeBounds.minX, activeBounds.maxX),
    y: clamp(position.y, activeBounds.minY, activeBounds.maxY),
  }), [activeBounds.maxX, activeBounds.maxY, activeBounds.minX, activeBounds.minY]);
  const defaultPosition = useMemo(() => ({
    x: fullScreenBounds.minX + 8,
    y: height,
  }), [fullScreenBounds.minX, height]);

  useEffect(() => {
    let mounted = true;
    setPositionReady(false);

    safeStorage.getItem(storageKey)
      .then((stored) => {
        if (!mounted) return;
        const parsed = stored ? JSON.parse(stored) as { x?: number; y?: number } : null;
        const desired = parsed
          ? {
              x: clamp(Number(parsed.x ?? defaultPosition.x), fullScreenBounds.minX, fullScreenBounds.maxX),
              y: clamp(Number(parsed.y ?? defaultPosition.y), fullScreenBounds.minY, fullScreenBounds.maxY),
            }
          : defaultPosition;
        const next = toDisplayPosition(desired);
        desiredPositionRef.current = desired;
        positionRef.current = next;
        drag.setValue(next);
        setPositionReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        const next = toDisplayPosition(defaultPosition);
        desiredPositionRef.current = defaultPosition;
        positionRef.current = next;
        drag.setValue(next);
        setPositionReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [defaultPosition, drag, fullScreenBounds.maxX, fullScreenBounds.maxY, fullScreenBounds.minX, fullScreenBounds.minY, storageKey, toDisplayPosition]);

  useEffect(() => {
    if (!positionReady) return;
    const next = toDisplayPosition(desiredPositionRef.current);
    positionRef.current = next;
    Animated.spring(drag, {
      toValue: next,
      useNativeDriver: false,
      speed: 18,
      bounciness: 5,
    }).start();
  }, [bottomTabHidden, drag, positionReady, toDisplayPosition]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      drag.stopAnimation((value) => {
        positionRef.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      drag.setValue({
        x: clamp(positionRef.current.x + gesture.dx, activeBounds.minX, activeBounds.maxX),
        y: clamp(positionRef.current.y + gesture.dy, activeBounds.minY, activeBounds.maxY),
      });
    },
    onPanResponderRelease: () => {
      drag.stopAnimation((value) => {
        const next = {
          x: clamp(value.x, activeBounds.minX, activeBounds.maxX),
          y: clamp(value.y, activeBounds.minY, activeBounds.maxY),
        };
        const isNearBottom = value.y >= activeBounds.maxY - 10;
        const desired = {
          x: clamp(value.x, fullScreenBounds.minX, fullScreenBounds.maxX),
          y: isNearBottom ? height : clamp(value.y, fullScreenBounds.minY, fullScreenBounds.maxY),
        };
        desiredPositionRef.current = desired;
        positionRef.current = next;
        Animated.spring(drag, {
          toValue: next,
          useNativeDriver: false,
          speed: 18,
          bounciness: 5,
        }).start();
        void safeStorage.setItem(storageKey, JSON.stringify(desired));
      });
    },
  }), [activeBounds.maxX, activeBounds.maxY, activeBounds.minX, activeBounds.minY, drag, fullScreenBounds.maxX, fullScreenBounds.maxY, fullScreenBounds.minX, fullScreenBounds.minY, storageKey]);

  if (!token || isAuthRoute || isAssistantRoute || (isChatsRoute && activeConversationId) || (isCallsRoute && isCallDialerOpen)) {
    return null;
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.button,
        {
          opacity: positionReady ? 1 : 0,
          transform: drag.getTranslateTransform(),
          backgroundColor: appTheme.surface,
          borderColor: appTheme.border,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.84} onPress={() => router.push('/ai-assistant')} style={styles.pressTarget}>
        <Logo variant="icon" size={34} tintColor={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 27,
    borderWidth: 1,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  pressTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
