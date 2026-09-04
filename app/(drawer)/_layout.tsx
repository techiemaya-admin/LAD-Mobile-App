import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme/appTheme';
import Theme from '@/constants/theme';

export default function WorkspaceStackLayout() {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => (
          <View
            style={[
              styles.safeHeader,
              {
                paddingTop: Math.max(insets.top, 10) + 6,
                backgroundColor: appTheme.background,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: appTheme.primarySoft }]}
              activeOpacity={0.72}
              onPress={() => router.replace('/(drawer)/settings' as never)}
            >
              <ArrowLeft color={appTheme.primaryAccent} size={14} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: appTheme.muted }]}>
              BACK TO SETTINGS MENU
            </Text>
          </View>
        ),
        headerShadowVisible: false,
        contentStyle: { backgroundColor: appTheme.background },
      }}
    >
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="team" options={{ title: 'Team Management' }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="business-profile" options={{ title: 'Business Profile' }} />
      <Stack.Screen name="integrations" options={{ title: 'Integrations' }} />
      <Stack.Screen name="billing" options={{ title: 'Billing & Plans' }} />
      <Stack.Screen name="support" options={{ title: 'Support' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  safeHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 4,
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
});
