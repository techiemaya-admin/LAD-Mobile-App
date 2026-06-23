import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Megaphone, MessageCircle, PhoneCall, Wallet } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { DashboardSection } from '@/components/features/DashboardSection';
import { SkeletonSummaryCard, SkeletonActivityRow } from '@/components/ui/SkeletonLoader';
import { fetchHomeDashboardData, type HomeDashboardData, type HomeDashboardSection } from '@/src/services/homeDashboard';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

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

const HOME_DASHBOARD_CACHE_KEY = 'tabs.home.dashboard';
const BACKGROUND_POLL_INTERVAL = 60_000; // 60 s

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (absolute >= 1_000) return `${Math.round(value / 100) / 10}K`;
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const user = useAuthStore((state) => state.user);

  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(
    () => readScreenCache<HomeDashboardData>(HOME_DASHBOARD_CACHE_KEY)?.value ?? null,
  );
  const [isLoading, setIsLoading] = useState(
    () => !readScreenCache<HomeDashboardData>(HOME_DASHBOARD_CACHE_KEY),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const columns = isDesktop ? 4 : isTablet ? 3 : width < 380 ? 1 : 2;
  const containerPadding = 24;
  const gap = 12;
  const availableWidth = Math.min(Math.max(width - containerPadding * 2, 200), 1200);
  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

  const loadDashboard = useCallback(async (refreshing = false, silent = false) => {
    if (!silent) {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    }
    setError(null);

    try {
      const data = await fetchHomeDashboardData();
      setDashboard(data);
      writeScreenCache(HOME_DASHBOARD_CACHE_KEY, data);
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof Error && loadError.message.length < 120
            ? loadError.message
            : 'Unable to load dashboard. Please try again.',
        );
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoading) {
      void loadDashboard();
    }
  }, [isLoading, loadDashboard]);

  // Silent background polling while screen is focused
  useFocusEffect(
    useCallback(() => {
      pollRef.current = setInterval(() => {
        void loadDashboard(false, true);
      }, BACKGROUND_POLL_INTERVAL);

      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [loadDashboard]),
  );

  const summaryCards = useMemo(() => {
    const summary = dashboard?.summary;
    return [
      {
        label: 'Campaigns',
        value: formatNumber(summary?.activeCampaigns ?? 0),
        detail: `${formatNumber(summary?.totalCampaigns ?? 0)} total`,
        icon: Megaphone,
        color: CHANNEL_COLORS.campaign,
      },
      {
        label: 'Unread Chats',
        value: formatNumber(summary?.unreadConversations ?? 0),
        detail: `${formatNumber(summary?.totalConversations ?? 0)} synced`,
        icon: MessageCircle,
        color: CHANNEL_COLORS.whatsapp,
      },
      {
        label: 'Voice Calls',
        value: formatNumber(summary?.totalCalls ?? 0),
        detail: `${formatNumber(summary?.answeredCalls ?? 0)} answered`,
        icon: PhoneCall,
        color: appTheme.darkMode ? '#F8FAFC' : CHANNEL_COLORS.voice,
      },
      {
        label: 'Credits',
        value: formatNumber(summary?.walletBalance ?? 0),
        detail: `${formatNumber(summary?.teamMembers ?? 0)} members`,
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
    ? 'Data unavailable'
    : dashboard?.sourceErrors.length
      ? 'Partial sync'
      : isLoading
        ? 'Syncing…'
        : 'System Active';

  const introText = dashboard
    ? `${formatNumber(dashboard.summary.totalConversations)} conversations · ${formatNumber(dashboard.summary.activeCampaigns)} campaigns · ${formatNumber(dashboard.summary.totalCalls)} calls`
    : 'Loading your live workspace data…';

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: appTheme.background, paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <View style={styles.headerContentMaxWidth}>
          <View style={styles.userInfo}>
            <Avatar fallback={getInitials(user?.name, user?.email)} size="md" />
            <View style={styles.welcomeText}>
              <Typography variant="caption" color={appTheme.muted}>{headerStatus}</Typography>
              <Typography variant="h3" color={appTheme.text} style={styles.hubTitle}>Communication Hub</Typography>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/modals/notifications')}
              style={[styles.iconButton, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}
            >
              <Bell color={appTheme.text} size={20} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadDashboard(true)}
            tintColor={appTheme.primaryAccent}
          />
        }
      >
        <View style={styles.contentMaxWidth}>
          {/* Intro */}
          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.intro}>
            <Typography variant="h2" color={appTheme.text} style={styles.title}>Dashboard</Typography>
            <Typography variant="bodySmall" color={appTheme.muted}>{introText}</Typography>
          </Animated.View>

          {/* Summary grid */}
          <View style={styles.summaryGrid}>
            {isLoading
              ? Array.from({ length: columns }).map((_, i) => (
                  <SkeletonSummaryCard key={i} width={cardWidth} />
                ))
              : summaryCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <Animated.View
                      key={card.label}
                      entering={FadeInUp.delay(80 + index * 60).duration(380).springify()}
                    >
                      <GlassCard
                        style={[
                          styles.summaryCard,
                          { borderColor: appTheme.borderSoft, width: cardWidth },
                        ]}
                      >
                        <View style={styles.summaryTopRow}>
                          <View style={[styles.summaryIconShell, { backgroundColor: `${card.color}18` }]}>
                            <Icon color={card.color} size={17} />
                          </View>
                          <Typography variant="h3" color={appTheme.text} style={styles.summaryValue}>
                            {card.value}
                          </Typography>
                        </View>
                        <Typography variant="overline" color={appTheme.muted}>{card.label}</Typography>
                        <Typography variant="caption" color={appTheme.muted}>{card.detail}</Typography>
                      </GlassCard>
                    </Animated.View>
                  );
                })}
          </View>

          {/* Error/sync status — only when there's a real problem */}
          {!isLoading && (error || Boolean(dashboard?.sourceErrors.length)) && (
            <Animated.View entering={FadeIn.duration(300)}>
              <GlassCard style={[styles.statusCard, { borderColor: error ? Theme.colors.errorLight : appTheme.borderSoft }]}>
                <Typography
                  variant="bodySmall"
                  color={error ? Theme.colors.error : appTheme.muted}
                >
                  {error ||
                    (dashboard?.sourceErrors.length
                      ? `Partial data — some sources offline: ${dashboard.sourceErrors.join(', ')}`
                      : '')}
                </Typography>
              </GlassCard>
            </Animated.View>
          )}

          {/* Activity feed — with skeleton while loading */}
          {isLoading ? (
            <Animated.View entering={FadeIn.delay(120).duration(300)} style={styles.activitySection}>
              <View style={styles.activityTitleRow}>
                <Typography variant="h4" color={appTheme.text}>Latest Activity</Typography>
              </View>
              <GlassCard style={[styles.activityCard, { borderColor: appTheme.borderSoft }]}>
                {[0, 1, 2].map((i) => <SkeletonActivityRow key={i} />)}
              </GlassCard>
            </Animated.View>
          ) : dashboard?.latestActivity.length ? (
            <Animated.View
              entering={FadeInDown.delay(200).duration(380)}
              style={styles.activitySection}
            >
              <View style={styles.activityTitleRow}>
                <Typography variant="h4" color={appTheme.text}>Latest Activity</Typography>
              </View>
              <GlassCard style={[styles.activityCard, { borderColor: appTheme.borderSoft }]}>
                {dashboard.latestActivity.map((activity) => (
                  <View key={activity.id} style={styles.activityRow}>
                    <View
                      style={[
                        styles.activityDot,
                        { backgroundColor: CHANNEL_COLORS[activity.channel as keyof typeof CHANNEL_COLORS] ?? appTheme.primaryAccent },
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
            </Animated.View>
          ) : null}

          {/* Dashboard sections */}
          {dashboard?.sections.map((section, index) => {
            const accentColor =
              section.channel === 'voice' && appTheme.darkMode ? '#F8FAFC' : section.accentColor;
            return (
              <Animated.View
                key={section.channel}
                entering={FadeInDown.delay(260 + index * 80).duration(380)}
              >
                <DashboardSection
                  title={section.title}
                  icon={section.icon}
                  channel={section.channel}
                  accentColor={accentColor}
                  cards={section.cards}
                  onCardPress={() => openSection(section)}
                />
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
    zIndex: 10,
    alignItems: 'center',
    width: '100%',
  },
  headerContentMaxWidth: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentMaxWidth: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
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
  hubTitle: {
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.error,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.sm,
  },
  intro: {
    marginBottom: Theme.spacing.lg,
    gap: 4,
  },
  title: {
    marginBottom: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Theme.spacing.xl,
  },
  summaryCard: {
    minHeight: 118,
    justifyContent: 'space-between',
    padding: 14,
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontWeight: '600',
  },
  statusCard: {
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
  },
  activitySection: {
    marginBottom: Theme.spacing.xxl,
  },
  activityTitleRow: {
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
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  activityText: {
    flex: 1,
  },
});
