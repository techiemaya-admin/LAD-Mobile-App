import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useAppTheme } from '@/src/theme/appTheme';

export default function WorkspaceStackLayout() {
  const appTheme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: appTheme.background },
        animation: Platform.OS === 'ios' ? 'default' : 'fade',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="team" options={{ title: 'Team Management' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="business-profile" options={{ title: 'Business Profile' }} />
      <Stack.Screen name="integrations" options={{ title: 'Integrations' }} />
      <Stack.Screen name="billing" options={{ title: 'Billing & Plans' }} />
      <Stack.Screen name="support" options={{ title: 'Support' }} />
    </Stack>
  );
}
