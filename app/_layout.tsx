import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
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
        await Promise.all([
          Asset.loadAsync(require('../assets/videos/hero-character-dark.mp4')),
          Asset.loadAsync(require('../assets/videos/hero-character.webm')),
        ]);
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
            {(!isAssetsLoaded || isLoading) ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: appTheme.background }}>
                <ActivityIndicator color={appTheme.primaryAccent} />
              </View>
            ) : (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: appTheme.background } }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(drawer)" />
                <Stack.Screen name="crm/[id]" />
                <Stack.Screen name="campaigns/[id]" />
                <Stack.Screen name="modals" options={{ presentation: 'modal' }} />
              </Stack>
            )}
            {!isLoading ? <FloatingAssistantButton /> : null}
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
