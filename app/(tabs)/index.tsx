import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Megaphone, MessageCircle, PhoneCall, Wallet } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { DashboardSection } from '@/components/features/DashboardSection';
import { fetchHomeDashboardData, type HomeDashboardData, type HomeDashboardSection } from '@/src/services/homeDashboard';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';

const CHANNEL_COLORS = {
  linkedin: '#0077B5',
  whatsapp: '#25D366',
  email: '#2563EB',
  instagram: '#E1306C',
  voice: '#0B1957',
  campaign: '#7C3AED',
  team: '#0891B2',
  billing: '#F59E0B',
} as const;

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }
  if (absolute >= 1_000) {
    return `${Math.round(value / 100) / 10}K`;
  }
  return String(Math.round(value));
};

const getInitials = (name?: string | null, email?: string | null) => {
  const source = name?.trim() || email?.trim() || 'LAD';
  const parts = source.includes('@') ? [source.charAt(0)] : source.split(/\s+/);
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

export default function HomeDashboard() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchHomeDashboardData();
      setDashboard(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summaryCards = useMemo(() => {
    const summary = dashboard?.summary;
    return [
      {
        label: 'Active Campaigns',
        value: formatNumber(summary?.activeCampaigns ?? 0),
        detail: `${formatNumber(summary?.totalCampaigns ?? 0)} total campaigns`,
        icon: Megaphone,
        color: CHANNEL_COLORS.campaign,
      },
      {
        label: 'Unread Chats',
        value: formatNumber(summary?.unreadConversations ?? 0),
        detail: `${formatNumber(summary?.totalConversations ?? 0)} conversations synced`,
        icon: MessageCircle,
        color: CHANNEL_COLORS.whatsapp,
      },
      {
        label: 'Voice Calls',
        value: formatNumber(summary?.totalCalls ?? 0),
        detail: `${formatNumber(summary?.answeredCalls ?? 0)} answered calls`,
        icon: PhoneCall,
        color: appTheme.darkMode ? '#F8FAFC' : CHANNEL_COLORS.voice,
      },
      {
        label: 'Credits',
        value: formatNumber(summary?.walletBalance ?? 0),
        detail: `${formatNumber(summary?.teamMembers ?? 0)} team members`,
        icon: Wallet,
        color: CHANNEL_COLORS.billing,
      },
    ];
  }, [appTheme.darkMode, dashboard]);

  const openSection = (section: HomeDashboardSection) => {
    if (section.channel === 'voice') {
      router.push('/calls');
      return;
    }

    router.push('/chats');
  };

  const headerStatus = error
    ? 'Backend unavailable'
    : dashboard?.sourceErrors.length
      ? 'Partial sync'
      : isLoading
        ? 'Syncing data'
        : 'System Active';

  const introText = dashboard
    ? `Managing ${dashboard.summary.activeChannels} active channels with ${formatNumber(dashboard.summary.totalConversations)} conversations, ${formatNumber(dashboard.summary.activeCampaigns)} live campaigns, and ${formatNumber(dashboard.summary.totalCalls)} calls.`
    : 'Loading live communication, campaign, billing, team, and voice-agent data.';

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { backgroundColor: appTheme.background }]}>
        <View style={styles.userInfo}>
          <Avatar fallback={getInitials(user?.name, user?.email)} size="md" />
          <View style={styles.welcomeText}>
            <Typography variant="bodySmall" color={appTheme.muted}>{headerStatus}</Typography>
            <Typography variant="h3" color={appTheme.text}>Communication Hub</Typography>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/modals/notifications')}
            style={[styles.iconButton, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}
          >
            <Bell color={appTheme.text} size={22} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadDashboard(true)}
            tintColor={appTheme.primaryAccent}
          />
        )}
      >
        <View style={styles.intro}>
          <Typography variant="h2" color={appTheme.text} style={styles.title}>Dashboard</Typography>
          <Typography variant="body" color={appTheme.muted}>
            {introText}
          </Typography>
        </View>

        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
            <GlassCard key={card.label} style={[styles.summaryCard, { borderColor: appTheme.borderSoft }]}>
              <View style={styles.summaryTopRow}>
                <View style={[styles.summaryIconShell, { backgroundColor: `${card.color}18` }]}>
                  <Icon color={card.color} size={18} />
                </View>
                <Typography variant="h3" color={appTheme.text} style={styles.summaryValue}>
                  {card.value}
                </Typography>
              </View>
              <Typography variant="overline" color={appTheme.muted}>{card.label}</Typography>
              <Typography variant="caption" color={appTheme.muted}>{card.detail}</Typography>
            </GlassCard>
            );
          })}
        </View>

        {(isLoading || error || Boolean(dashboard?.sourceErrors.length)) && (
          <GlassCard style={[styles.statusCard, { borderColor: appTheme.borderSoft }]}>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={appTheme.primaryAccent} />
                <Typography variant="bodySmall" color={appTheme.muted}>
                  Syncing dashboard data from the LAD backend...
                </Typography>
              </View>
            ) : (
              <>
                <Typography variant="bodySmall" color={error ? Theme.colors.error : appTheme.text}>
                  {error || 'Some dashboard sources did not respond. Showing all available live data.'}
                </Typography>
                {dashboard?.sourceErrors.length ? (
                  <Typography variant="caption" color={appTheme.muted} style={styles.sourceText}>
                    Pending sources: {dashboard.sourceErrors.join(', ')}
                  </Typography>
                ) : null}
              </>
            )}
          </GlassCard>
        )}

        {dashboard?.latestActivity.length ? (
          <View style={styles.activitySection}>
            <Typography variant="h4" color={appTheme.text} style={styles.activityTitle}>Latest Activity</Typography>
            <GlassCard style={[styles.activityCard, { borderColor: appTheme.borderSoft }]}>
              {dashboard.latestActivity.map((activity) => (
                <View key={activity.id} style={styles.activityRow}>
                  <View
                    style={[
                      styles.activityDot,
                      { backgroundColor: CHANNEL_COLORS[activity.channel] ?? appTheme.primaryAccent },
                    ]}
                  />
                  <View style={styles.activityText}>
                    <Typography variant="bodySmall" color={appTheme.text} numberOfLines={1}>
                      {activity.title}
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                      {activity.meta}
                    </Typography>
                  </View>
                </View>
              ))}
            </GlassCard>
          </View>
        ) : null}

        {dashboard?.sections.map((section) => {
          const accentColor = section.channel === 'voice' && appTheme.darkMode
            ? '#F8FAFC'
            : section.accentColor;

          return (
            <DashboardSection
              key={section.channel}
              title={section.title}
              icon={section.icon}
              channel={section.channel}
              accentColor={accentColor}
              cards={section.cards}
              onCardPress={() => openSection(section)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.background,
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  welcomeText: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  iconButton: {
    padding: Theme.spacing.xs,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.error,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: 100,
  },
  intro: {
    marginBottom: Theme.spacing.lg,
  },
  title: {
    marginBottom: Theme.spacing.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  summaryCard: {
    width: '47.5%',
    minHeight: 118,
    justifyContent: 'space-between',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
  },
  summaryIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontWeight: '800',
  },
  statusCard: {
    marginBottom: Theme.spacing.xl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  sourceText: {
    marginTop: Theme.spacing.xs,
  },
  activitySection: {
    marginBottom: Theme.spacing.xxl,
  },
  activityTitle: {
    marginBottom: Theme.spacing.md,
  },
  activityCard: {
    gap: Theme.spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  activityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  activityText: {
    flex: 1,
  },
});
