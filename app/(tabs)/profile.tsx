import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Shield, Link, Target, LogOut, ChevronRight, CreditCard, HelpCircle } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useRouter } from 'expo-router';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const menuItems = [
    { icon: <Settings color={appTheme.muted} size={24} />, title: 'Account Settings', route: '/(drawer)/settings' },
    { icon: <Shield color={appTheme.muted} size={24} />, title: 'Privacy & Security', route: '/(drawer)/settings' },
    { icon: <CreditCard color={appTheme.muted} size={24} />, title: 'Billing & Plans', route: '/(drawer)/billing' },
    { icon: <HelpCircle color={appTheme.muted} size={24} />, title: 'Help & Support', route: '/(drawer)/support' },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <Typography variant="h1" color={appTheme.text}>Profile</Typography>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} 
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        <GlassCard style={styles.profileCard}>
          <Avatar fallback={getInitials(user?.name || user?.email || 'LAD User')} size="lg" style={styles.avatar} />
          <Typography variant="h3" color={appTheme.text}>{user?.name || 'LAD User'}</Typography>
          <Typography variant="body" color={appTheme.muted}>{user?.email || 'Signed in'}</Typography>
          <View style={[styles.planBadge, { backgroundColor: appTheme.darkMode ? 'rgba(175, 194, 255, 0.16)' : Theme.colors.infoLight }]}>
            <Typography variant="caption" color={appTheme.primaryAccent} style={{ fontWeight: '500' }}>ENTERPRISE PLAN</Typography>
          </View>
        </GlassCard>

        <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Settings</Typography>
        <GlassCard style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder, { borderBottomColor: appTheme.borderSoft }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.menuItemLeft}>
                {item.icon}
                <Typography variant="bodyLarge" color={appTheme.text} style={{ marginLeft: Theme.spacing.md }}>{item.title}</Typography>
              </View>
              <ChevronRight color={appTheme.disabled} size={20} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut color={Theme.colors.error} size={24} />
          <Typography variant="bodyLarge" color={Theme.colors.error} style={{ marginLeft: Theme.spacing.md, fontWeight: '600' }}>
            Log Out
          </Typography>
        </TouchableOpacity>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 0,
  },
  profileCard: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  avatar: {
    marginBottom: Theme.spacing.md,
  },
  planBadge: {
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Theme.colors.infoLight,
    borderRadius: Theme.radius.full,
  },
  sectionTitle: {
    marginBottom: Theme.spacing.md,
    paddingLeft: 4,
  },
  menuCard: {
    padding: 0,
    marginBottom: Theme.spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.errorLight,
    borderRadius: Theme.radius.lg,
  },
});

const getInitials = (value: string) =>
  value
    .split(/[ @._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
