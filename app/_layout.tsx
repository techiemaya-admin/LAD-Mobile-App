import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from '@/src/store/authStore';
import { useChatStore } from '@/src/store/chatStore';
import { useCallStore } from '@/src/store/callStore';
import { clearAllScreenCache } from '@/src/utils/screenCache';
import { connectSocket, disconnectSocket } from '@/src/services/socketService';
import { useAppTheme } from '@/src/theme/appTheme';
import { FloatingAssistantButton } from '@/components/features/FloatingAssistantButton';
import { Asset } from 'expo-asset';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
    },
  }), []);
  const router = useRouter();
  const segments = useSegments();
  const { token, user, isLoading, restoreToken } = useAuthStore();
  const appTheme = useAppTheme();
  const loggedInUserIdRef = useRef<string | null>(null);

  const [isAssetsLoaded, setIsAssetsLoaded] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      try {
        const assetsToLoad: any[] = [
          Asset.loadAsync(require('../assets/videos/hero-character-dark.mp4')),
        ];
        if (Platform.OS !== 'ios') {
          try {
            assetsToLoad.push(Asset.loadAsync(require('../assets/videos/hero-character.webm')));
          } catch {
            // Ignore webm require on platforms that do not support it
          }
        }
        await Promise.allSettled(assetsToLoad);
      } catch (e) {
        console.warn('Failed to load assets', e);
      } finally {
        setIsAssetsLoaded(true);
      }
    }
    loadAssets();
  }, []);

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  useEffect(() => {
    const currentUserId = token ? user?.id ?? null : null;
    if (currentUserId && currentUserId !== loggedInUserIdRef.current) {
      // A new session just started (fresh login, or a different account after
      // logout) — wipe every in-memory cache so screens fetch this user's data
      // instead of showing whatever the previous session left behind.
      clearAllScreenCache();
      queryClient.clear();
      useChatStore.getState().reset();
      useCallStore.getState().reset();
    }
    loggedInUserIdRef.current = currentUserId;
  }, [token, user, queryClient]);

  useEffect(() => {
    if (isLoading) return;

    const isAuthRoute = segments[0] === '(auth)';

    if (!token && !isAuthRoute) {
      router.replace('/(auth)');
      return;
    }

    if (token && isAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [isLoading, router, segments, token]);

  useEffect(() => {
    if (token) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && isAssetsLoaded) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isLoading, isAssetsLoaded]);

  // Keeps the native root view (what shows through in any edge-to-edge gap —
  // behind the Android system nav bar, during screen transitions, etc.) in
  // sync with the app's own background instead of the OS's light default.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(appTheme.background).catch(() => undefined);
  }, [appTheme.background]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <StatusBar style={appTheme.statusBarStyle} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: appTheme.background },
                animation: Platform.OS === 'ios' ? 'default' : 'fade',
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(drawer)" options={{ animation: 'default', gestureEnabled: true }} />
              <Stack.Screen name="crm/[id]" options={{ animation: 'default', gestureEnabled: true }} />
              <Stack.Screen name="campaigns/[id]" options={{ animation: 'default', gestureEnabled: true }} />
              <Stack.Screen name="modals" options={{ presentation: 'modal', gestureEnabled: true }} />
            </Stack>
            {(!isAssetsLoaded || isLoading) && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: appTheme.background,
                    zIndex: 9999,
                  },
                ]}
              >
                <ActivityIndicator color={appTheme.primaryAccent} size="large" />
              </View>
            )}
            {!isLoading ? <FloatingAssistantButton /> : null}
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
