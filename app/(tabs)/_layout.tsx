import { Tabs } from 'expo-router';
import { ArtBottomTabBar } from '@/components/ui/BottomTabSelector';
import { useAppTheme } from '@/src/theme/appTheme';

export default function TabsLayout() {
  const appTheme = useAppTheme();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: appTheme.background },
      }}
      tabBar={(props) => <ArtBottomTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
        }}
      />
      <Tabs.Screen
        name="chats/index"
        options={{
          title: 'Chats',
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      {/* Hide legacy routes */}
      <Tabs.Screen name="ai-assistant/index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="leads/index" options={{ href: null }} />
      <Tabs.Screen name="pipeline" options={{ href: null }} />
    </Tabs>
  );
}
