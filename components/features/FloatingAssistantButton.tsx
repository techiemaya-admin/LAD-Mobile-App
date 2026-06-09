import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Theme from '@/constants/theme';
import { safeStorage } from '@/src/api';
import useAuthStore from '@/src/store/authStore';
import { useChatStore } from '@/src/store/chatStore';
import { useOverlayStore } from '@/src/store/overlayStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { LadLogoMark } from '@/components/ui/LadLogoMark';

const BUTTON_SIZE = 54;
const STORAGE_PREFIX = 'lad.floatingAssistant.position.';
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
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionRef = useRef({ x: 0, y: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const isAuthRoute = segments[0] === '(auth)';
  const isAssistantRoute = pathname.includes('/ai-assistant') || segments.includes('ai-assistant');
  const isCallsRoute = pathname.includes('/calls') || segments.includes('calls');
  const isChatsRoute = pathname.includes('/chats') || segments.includes('chats');
  const bottomOffset = Math.max(insets.bottom, 0) + (isCallsRoute ? 166 : 104);
  const iconColor = appTheme.darkMode ? '#F8FAFC' : '#0B1958';
  const storageKey = `${STORAGE_PREFIX}${pathname || 'home'}`;
  const bounds = useMemo(() => ({
    minX: 8,
    maxX: Math.max(8, width - BUTTON_SIZE - 8),
    minY: Math.max(insets.top + 8, 8),
    maxY: Math.max(insets.top + 8, height - BUTTON_SIZE - Math.max(insets.bottom + 88, 88)),
  }), [height, insets.bottom, insets.top, width]);
  const defaultPosition = useMemo(() => ({
    x: bounds.maxX - (isCallsRoute ? 12 : Theme.spacing.lg - 8),
    y: clamp(height - bottomOffset - BUTTON_SIZE, bounds.minY, bounds.maxY),
  }), [bottomOffset, bounds.maxX, bounds.maxY, bounds.minY, height, isCallsRoute]);

  useEffect(() => {
    let mounted = true;
    setPositionReady(false);

    safeStorage.getItem(storageKey)
      .then((stored) => {
        if (!mounted) return;
        const parsed = stored ? JSON.parse(stored) as { x?: number; y?: number } : null;
        const next = parsed
          ? {
              x: clamp(Number(parsed.x ?? defaultPosition.x), bounds.minX, bounds.maxX),
              y: clamp(Number(parsed.y ?? defaultPosition.y), bounds.minY, bounds.maxY),
            }
          : defaultPosition;
        positionRef.current = next;
        drag.setValue(next);
        setPositionReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        positionRef.current = defaultPosition;
        drag.setValue(defaultPosition);
        setPositionReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, defaultPosition, drag, storageKey]);

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
        x: clamp(positionRef.current.x + gesture.dx, bounds.minX, bounds.maxX),
        y: clamp(positionRef.current.y + gesture.dy, bounds.minY, bounds.maxY),
      });
    },
    onPanResponderRelease: () => {
      drag.stopAnimation((value) => {
        const next = {
          x: clamp(value.x, bounds.minX, bounds.maxX),
          y: clamp(value.y, bounds.minY, bounds.maxY),
        };
        positionRef.current = next;
        Animated.spring(drag, {
          toValue: next,
          useNativeDriver: false,
          speed: 18,
          bounciness: 5,
        }).start();
        void safeStorage.setItem(storageKey, JSON.stringify(next));
      });
    },
  }), [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, drag, storageKey]);

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
        <LadLogoMark color={iconColor} size={36} />
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
