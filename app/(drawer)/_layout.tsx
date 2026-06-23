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
        header: ({ navigation, options }) => (
          <View
            style={[
              styles.safeHeader,
              {
                paddingTop: Math.max(insets.top, 24) + 8,
                backgroundColor: appTheme.surface,
                borderBottomColor: appTheme.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.72}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                router.replace('/(tabs)/profile' as never);
              }}
            >
              <ArrowLeft color={appTheme.text} size={24} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: appTheme.text }]}>
              {String(options.title || '')}
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
    </Stack>
  );
}

const styles = StyleSheet.create({
  safeHeader: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: '800',
  },
});
