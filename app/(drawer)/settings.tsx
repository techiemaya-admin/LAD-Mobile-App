import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  BarChart3,
  ChevronRight,
  Target,
  Link,
  Megaphone,
  RefreshCw,
  Users,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { BottomTabSelector, useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { AIVoiceCallingSettings } from '@/components/features/AIVoiceCallingSettings';
import { fetchSettingsHubData, SettingsHubData } from '@/src/services/settingsHub';

import useAppPreferencesStore from '@/src/store/appPreferencesStore';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const formatPercent = (value: number) => `${Math.round((value || 0) * 10) / 10}%`;
const SETTINGS_CACHE_KEY = 'drawer.settings.hub';

const lightPalette = {
  background: Theme.colors.background,
  surface: Theme.colors.surface,
  softSurface: Theme.colors.background,
  text: Theme.colors.text,
  muted: Theme.colors.textSecondary,
  disabled: Theme.colors.textDisabled,
  border: Theme.colors.border,
  borderSoft: Theme.colors.borderLight,
  primary: Theme.colors.primary,
  primarySoft: Theme.colors.infoLight,
  errorSoft: Theme.colors.errorLight,
  logoutBg: Theme.colors.errorLight,
  switchOff: Theme.colors.border,
};

const darkPalette = {
  background: '#050D1F',
  surface: '#0B1220',
  softSurface: '#111827',
  text: '#F8FAFC',
  muted: '#CBD5E1',
  disabled: '#94A3B8',
  border: '#243049',
  borderSoft: '#1F2937',
  primary: '#AFC2FF',
  primarySoft: 'rgba(175, 194, 255, 0.16)',
  errorSoft: 'rgba(239, 68, 68, 0.16)',
  logoutBg: 'rgba(239, 68, 68, 0.14)',
  switchOff: '#334155',
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const globalDarkMode = useAppPreferencesStore((state) => state.darkMode);
  const setGlobalDarkMode = useAppPreferencesStore((state) => state.setDarkMode);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  const [localDarkMode, setLocalDarkMode] = useState(globalDarkMode);
  const [notifications, setNotifications] = useState(true);

  const [hubData, setHubData] = useState<SettingsHubData | null>(() => readScreenCache<SettingsHubData>(SETTINGS_CACHE_KEY)?.value ?? null);
  const [loading, setLoading] = useState(() => !readScreenCache<SettingsHubData>(SETTINGS_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const handleBottomTabScroll = useBottomTabScrollHandler();

  // Keep local in sync if changed elsewhere
  useEffect(() => {
    setLocalDarkMode(globalDarkMode);
  }, [globalDarkMode]);

  const handleToggleTheme = useCallback((val: boolean) => {
    setLocalDarkMode(val);
    // Allow the native Switch animation to glide smoothly before locking the main thread
    setTimeout(() => {
      setGlobalDarkMode(val);
    }, 200);
  }, [setGlobalDarkMode]);

  const palette = localDarkMode ? darkPalette : lightPalette;
  const themedCard = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  };

  const loadHubData = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await fetchSettingsHubData();
      setHubData(data);
      writeScreenCache(SETTINGS_CACHE_KEY, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load backend settings data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hubData) {
      loadHubData();
    }
  }, [hubData, loadHubData]);

  const featureCards = useMemo(() => {
    const stats = hubData?.campaigns.stats;
    const analytics = hubData?.analytics;
    const billing = hubData?.billing;

    return [
      {
        title: 'Campaigns',
        detail: `${formatNumber(stats?.totalLeads || 0)} leads across ${formatNumber(stats?.totalCampaigns || 0)} campaigns`,
        value: `${formatNumber(stats?.activeCampaigns || 0)} active`,
        badge: 'Live backend',
        route: '/(drawer)/campaigns',
        icon: <Megaphone color={palette.primary} size={22} />,
      },
      {
        title: 'Analytics',
        detail: `${formatPercent(stats?.avgReplyRate || 0)} reply rate, ${formatNumber(analytics?.totalCalls || 0)} voice calls`,
        value: formatPercent(stats?.avgConnectionRate || 0),
        badge: 'Performance',
        route: '/(drawer)/analytics',
        icon: <BarChart3 color={localDarkMode ? '#93C5FD' : Theme.colors.info} size={22} />,
      },
      {
        title: 'Team Management',
        detail: `${formatNumber(hubData?.team.activeCount || 0)} active users loaded from overview users`,
        value: `${formatNumber(hubData?.team.members.length || 0)} users`,
        badge: 'Tenant users',
        route: '/(drawer)/team',
        icon: <Users color={Theme.colors.success} size={22} />,
      },
      {
        title: 'Business Profile',
        detail: 'Company basics, ICP target, and settings',
        value: 'Settings',
        badge: 'ICP Target',
        route: '/(drawer)/business-profile',
        icon: <Target color={Theme.colors.warning} size={22} />,
      },
      {
        title: 'Integrations',
        detail: 'Connect WhatsApp, LinkedIn, email, and social apps',
        value: 'Connections',
        badge: 'Apps',
        route: '/(drawer)/integrations',
        icon: <Link color={palette.primary} size={22} />,
      },
    ];
  }, [localDarkMode, hubData, palette.primary]);



  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 12) + 12 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHubData(true)}
            tintColor={palette.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Typography variant="h2" color={palette.text} numberOfLines={2}>Settings</Typography>
            <Typography variant="bodySmall" color={palette.muted} numberOfLines={2}>Manage your workspace and profile settings</Typography>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, themedCard]}
            onPress={() => loadHubData(true)}
            disabled={refreshing || loading}
          >
            {refreshing || loading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <RefreshCw color={palette.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <GlassCard style={[styles.errorCard, themedCard, { borderColor: palette.errorSoft }]}>
            <AlertCircle color={Theme.colors.error} size={18} />
            <Typography variant="bodySmall" color={Theme.colors.error} style={styles.errorText}>{error}</Typography>
          </GlassCard>
        ) : null}

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>Workspace Features</Typography>
        <View style={styles.featureGrid}>
          {featureCards.map((feature) => (
            <TouchableOpacity key={feature.title} activeOpacity={0.78} onPress={() => router.push(feature.route as never)} style={{ width: isTablet ? '48%' : '100%' }}>
              <GlassCard style={[styles.featureCard, themedCard]}>
                <View style={styles.featureTop}>
                  <View style={[styles.featureIcon, { backgroundColor: palette.primarySoft }]}>{feature.icon}</View>
                  <Badge label={feature.badge} variant={feature.badge === 'Fallback' ? 'warning' : 'info'} />
                </View>
                <Typography variant="h4" color={palette.text} style={styles.featureTitle}>{feature.title}</Typography>
                <Typography variant="h3" color={palette.text} style={styles.featureValue}>{feature.value}</Typography>
                <View style={styles.featureBottom}>
                  <Typography variant="caption" color={palette.muted} style={styles.featureDetail}>{feature.detail}</Typography>
                  <ChevronRight color={palette.disabled} size={18} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>App Preferences</Typography>
        <GlassCard style={[styles.card, themedCard]}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Typography variant="bodyLarge" color={palette.text} style={styles.rowTitle}>Push Notifications</Typography>
              <Typography variant="caption" color={palette.muted}>Receive alerts for new leads</Typography>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: palette.switchOff, true: Theme.colors.primary }}
              thumbColor={notifications ? Theme.colors.surface : palette.disabled}
            />
          </View>
          <View style={[styles.settingRow, styles.borderTop, { borderTopColor: palette.borderSoft }]}>
            <View style={styles.settingText}>
              <Typography variant="bodyLarge" color={palette.text} style={styles.rowTitle}>Dark Mode</Typography>
              <Typography variant="caption" color={palette.muted}>Switch to dark theme</Typography>
            </View>
            <Switch
              value={localDarkMode}
              onValueChange={handleToggleTheme}
              trackColor={{ false: palette.switchOff, true: Theme.colors.primary }}
              thumbColor={localDarkMode ? Theme.colors.surface : palette.disabled}
            />
          </View>
        </GlassCard>

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>AI Voice Calling</Typography>
        <View style={localDarkMode ? styles.darkEmbeddedPanel : undefined}>
          <AIVoiceCallingSettings darkMode={localDarkMode} />
        </View>



        <View style={styles.footerLogo}>
          <Logo variant="code" width={150} height={50} />
          <Typography variant="caption" color={palette.disabled} style={styles.versionText}>
            v1.0.0
          </Typography>
        </View>
      </ScrollView>

      <BottomTabSelector activeRoute="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingBottom: 132,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  sectionTitle: {
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  featureCard: {
    padding: Theme.spacing.lg,
  },
  featureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    marginBottom: Theme.spacing.xs,
  },
  featureValue: {
    marginBottom: Theme.spacing.sm,
  },
  featureBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  featureDetail: {
    flex: 1,
  },
  card: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  settingText: {
    flex: 1,
    paddingRight: Theme.spacing.md,
  },
  rowTitle: {
    fontWeight: '500',
  },
  borderTop: {
    borderTopWidth: 1,
  },
  darkEmbeddedPanel: {
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  logoutButton: {
    minHeight: 56,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    marginTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  logoutText: {
    fontWeight: '700',
  },
  footerLogo: {
    alignItems: 'center',
    marginTop: Theme.spacing.xxxl,
    paddingBottom: Theme.spacing.xl,
    opacity: 0.65,
  },
  versionText: {
    marginTop: Theme.spacing.xs,
  },
});
