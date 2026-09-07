import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { IOSSubscreenHeader } from '@/components/ui/IOSSubscreenHeader';
import { useBottomTabScrollHandler, BottomTabSelector } from '@/components/ui/BottomTabSelector';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { CinematicThemeSwitcher } from '@/components/ui/CinematicThemeSwitcher';
import { AIVoiceCallingSettings } from '@/components/features/AIVoiceCallingSettings';
import useAppPreferencesStore from '@/src/store/appPreferencesStore';
import { fetchSettingsHubData, SettingsHubData } from '@/src/services/settingsHub';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const SETTINGS_CACHE_KEY = 'drawer.settings';

const DARK_LOGO_STYLE = Platform.OS === 'web'
  ? ({ filter: 'brightness(0) invert(1)', opacity: 0.95 } as const)
  : ({ tintColor: '#F8FAFC', opacity: 0.95 } as const);

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
  background: '#000724',
  surface: '#071131',
  softSurface: 'rgba(30, 41, 59, 0.50)',
  text: '#F8FAFC',
  muted: '#CBD5E1',
  disabled: '#94A3B8',
  border: 'rgba(23, 37, 84, 0.40)',
  borderSoft: 'rgba(23, 37, 84, 0.28)',
  primary: '#2976F4',
  primarySoft: 'rgba(41, 118, 244, 0.18)',
  errorSoft: 'rgba(239, 68, 68, 0.16)',
  logoutBg: 'rgba(239, 68, 68, 0.14)',
  switchOff: '#334155',
};

const formatNumber = (val: number | undefined | null) =>
  val != null ? Number(val).toLocaleString() : '0';

const formatPercent = (val: number | undefined | null) =>
  `${(Number(val || 0) * 100).toFixed(1)}%`;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const handleBottomTabScroll = useBottomTabScrollHandler();

  const globalDarkMode = useAppPreferencesStore((state) => state.darkMode);
  const setGlobalDarkMode = useAppPreferencesStore((state) => state.setDarkMode);

  const [localDarkMode, setLocalDarkMode] = useState(globalDarkMode);
  const [notifications, setNotifications] = useState(true);

  const [hubData, setHubData] = useState<SettingsHubData | null>(
    () => readScreenCache<SettingsHubData>(SETTINGS_CACHE_KEY)?.value ?? null,
  );
  const [loading, setLoading] = useState(() => !readScreenCache<SettingsHubData>(SETTINGS_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Keep local in sync if changed elsewhere
  useEffect(() => {
    setLocalDarkMode(globalDarkMode);
  }, [globalDarkMode]);

  const handleToggleTheme = useCallback((val: boolean) => {
    setLocalDarkMode(val);
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

    return [
      {
        title: 'Campaigns',
        detail: `${formatNumber(stats?.totalLeads || 0)} leads across ${formatNumber(stats?.totalCampaigns || 0)} campaigns`,
        value: `${formatNumber(stats?.activeCampaigns || 0)} active`,
        badge: 'Live',
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
    <AnimatedScreen style={[styles.container, { backgroundColor: palette.background }]}>
      <IOSSubscreenHeader
        title="Settings"
        subtitle="Manage your workspace and profile settings"
        rightElement={
          <TouchableOpacity
            style={[styles.refreshButton, themedCard]}
            onPress={() => loadHubData(true)}
            disabled={refreshing || loading}
            activeOpacity={0.8}
          >
            {refreshing || loading ? (
              <ActivityIndicator color={palette.primary} size="small" />
            ) : (
              <RefreshCw color={palette.primary} size={17} />
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
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
        {error ? (
          <GlassCard style={[styles.errorCard, themedCard, { borderColor: palette.errorSoft }]}>
            <AlertCircle color={Theme.colors.error} size={18} />
            <Typography variant="bodySmall" color={Theme.colors.error} style={styles.errorText}>
              {error}
            </Typography>
          </GlassCard>
        ) : null}

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>
          Workspace Features
        </Typography>
        <View style={styles.featureGrid}>
          {featureCards.map((feature) => (
            <TouchableOpacity
              key={feature.title}
              activeOpacity={0.78}
              onPress={() => router.push(feature.route as never)}
              style={{ width: isTablet ? '48%' : '100%' }}
            >
              <GlassCard style={[styles.featureCard, themedCard]}>
                <View style={styles.featureTop}>
                  <View style={[styles.featureIcon, { backgroundColor: palette.primarySoft }]}>
                    {feature.icon}
                  </View>
                  <Badge label={feature.badge} variant={feature.badge === 'Fallback' ? 'warning' : 'info'} />
                </View>
                <Typography variant="h4" color={palette.text} style={styles.featureTitle}>
                  {feature.title}
                </Typography>
                <Typography variant="h3" color={palette.text} style={styles.featureValue}>
                  {feature.value}
                </Typography>
                <View style={styles.featureBottom}>
                  <Typography variant="caption" color={palette.muted} style={styles.featureDetail}>
                    {feature.detail}
                  </Typography>
                  <ChevronRight color={palette.disabled} size={18} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>
          App Preferences
        </Typography>
        <GlassCard style={[styles.card, themedCard]}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Typography variant="bodyLarge" color={palette.text} style={styles.rowTitle}>
                Push Notifications
              </Typography>
              <Typography variant="caption" color={palette.muted}>
                Receive alerts for new leads
              </Typography>
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
              <Typography variant="bodyLarge" color={palette.text} style={styles.rowTitle}>
                Dark Mode
              </Typography>
              <Typography variant="caption" color={palette.muted}>
                Switch to dark theme
              </Typography>
            </View>
            <CinematicThemeSwitcher
              value={localDarkMode}
              onValueChange={handleToggleTheme}
            />
          </View>
        </GlassCard>

        <Typography variant="h4" color={palette.text} style={styles.sectionTitle}>
          AI Voice Calling
        </Typography>
        <View style={localDarkMode ? styles.darkEmbeddedPanel : undefined}>
          <AIVoiceCallingSettings darkMode={localDarkMode} />
        </View>

        <View style={styles.footerLogo}>
          <Logo variant="code" width={150} height={50} style={localDarkMode ? DARK_LOGO_STYLE : undefined} />
          <Typography variant="caption" color={palette.disabled} style={styles.versionText}>
            v1.0.0
          </Typography>
        </View>
      </ScrollView>

      <BottomTabSelector activeRoute="profile" />
    </AnimatedScreen>
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
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
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
