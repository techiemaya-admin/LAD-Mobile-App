import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from '@/src/store/authStore';
import { useChatStore } from '@/src/store/chatStore';
import { useCallStore } from '@/src/store/callStore';
import { clearAllScreenCache } from '@/src/utils/screenCache';
import { connectSocket, disconnectSocket } from '@/src/services/socketService';
import { useAppTheme } from '@/src/theme/appTheme';
import { FloatingAssistantButton } from '@/components/features/FloatingAssistantButton';

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

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView
          style={{ flex: 1 }}
          onLayout={() => {
            void SplashScreen.hideAsync().catch(() => undefined);
          }}
        >
          <StatusBar style={appTheme.statusBarStyle} />
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: appTheme.background }}>
              <ActivityIndicator color={appTheme.primaryAccent} />
            </View>
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(drawer)" />
              <Stack.Screen name="crm/[id]" />
              <Stack.Screen name="modals" options={{ presentation: 'modal' }} />
            </Stack>
          )}
          {!isLoading ? <FloatingAssistantButton /> : null}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
