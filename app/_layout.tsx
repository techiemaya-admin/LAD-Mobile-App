import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from '@/src/store/authStore';
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
  const { token, isLoading, restoreToken } = useAuthStore();
  const appTheme = useAppTheme();

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

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
