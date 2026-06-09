import { Stack } from 'expo-router';
import { useAppTheme } from '@/src/theme/appTheme';

export default function WorkspaceStackLayout() {
  const appTheme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: appTheme.surface },
        headerTintColor: appTheme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: appTheme.background },
      }}
    >
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="team" options={{ title: 'Team Management' }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="billing" options={{ title: 'Billing & Plans' }} />
      <Stack.Screen name="support" options={{ title: 'Help & Support' }} />
    </Stack>
  );
}
