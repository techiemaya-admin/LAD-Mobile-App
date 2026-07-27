import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { PhoneCall, RefreshCw, TrendingUp, Users, Wallet } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnalyticsOverview, getAnalyticsOverview, getCampaigns } from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const formatPercent = (value: number) => `${Math.round((value || 0) * 10) / 10}%`;
const formatTrendDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(5) || value;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const ANALYTICS_CACHE_KEY = 'drawer.analytics';

export default function AnalyticsScreen() {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(() => readScreenCache<AnalyticsOverview>(ANALYTICS_CACHE_KEY)?.value ?? null);
  const [loading, setLoading] = useState(() => !readScreenCache<AnalyticsOverview>(ANALYTICS_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const campaigns = await getCampaigns();
      const data = await getAnalyticsOverview(campaigns);
      setAnalytics(data);
      writeScreenCache(ANALYTICS_CACHE_KEY, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      loadAnalytics();
    }
  }, [loadAnalytics, loading]);

  const channelPerformance = useMemo(() => {
    const stats = analytics?.campaignStats;
    const totalSent = stats?.totalSent || 0;
    const totalConnected = stats?.totalConnected || 0;
    const totalReplied = stats?.totalReplied || 0;
    return [
      { label: 'Connections', value: stats?.avgConnectionRate || 0, count: totalConnected, total: totalSent, color: Theme.colors.primary },
      { label: 'Replies', value: stats?.avgReplyRate || 0, count: totalReplied, total: totalSent, color: Theme.colors.success },
      { label: 'Calls Answered', value: analytics?.callAnswerRate || 0, count: analytics?.answeredCalls || 0, total: analytics?.totalCalls || 0, color: Theme.colors.info },
    ];
  }, [analytics]);

  const chartPoints = useMemo(() => {
    const breakdown = analytics?.campaignStats.dailyBreakdown || [];
    if (breakdown.length > 0) {
      return breakdown.slice(-7).map((item) => ({
        label: formatTrendDate(item.date),
        value: item.count,
        series: 'Connections',
      }));
    }
    return [
      { label: 'Sent', value: analytics?.campaignStats.totalSent || 0, series: 'Campaign' },
      { label: 'Delivered', value: analytics?.campaignStats.totalDelivered || 0, series: 'Campaign' },
      { label: 'Connected', value: analytics?.campaignStats.totalConnected || 0, series: 'Campaign' },
      { label: 'Replies', value: analytics?.campaignStats.totalReplied || 0, series: 'Campaign' },
      { label: 'Calls', value: analytics?.totalCalls || 0, series: 'Voice' },
      { label: 'Answered', value: analytics?.answeredCalls || 0, series: 'Voice' },
      { label: 'Credits', value: analytics?.creditsUsed30d || 0, series: 'Billing' },
    ];
  }, [analytics]);

  const hasDailyBreakdown = Boolean(analytics?.campaignStats.dailyBreakdown?.length);
  const maxChartValue = Math.max(...chartPoints.map((point) => point.value), 1);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: appTheme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing.lg, paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Typography variant="h1" style={styles.pageTitle} numberOfLines={2}>Analytics</Typography>
          <Typography variant="body" color={appTheme.muted} numberOfLines={2}>Analyze performance and engagement metrics across your workspace.</Typography>
        </View>
        <TouchableOpacity style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadAnalytics(true)} disabled={refreshing || loading}>
          {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
        </TouchableOpacity>
      </View>

      {error ? (
        <GlassCard style={styles.messageCard}>
          <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
        </GlassCard>
      ) : null}

      {loading ? (
        <ActivityIndicator color={appTheme.primaryAccent} style={styles.loader} />
      ) : (
        <>
          <View style={styles.grid}>
            <GlassCard style={styles.statCard}>
              <TrendingUp color={Theme.colors.success} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatPercent(analytics?.campaignStats.avgConnectionRate || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Connection Rate</Typography>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Users color={appTheme.primaryAccent} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.campaignStats.activeCampaigns || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Active Campaigns</Typography>
            </GlassCard>
          </View>

          <View style={styles.grid}>
            <GlassCard style={styles.statCard}>
              <PhoneCall color={Theme.colors.info} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.answeredCalls || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Calls Answered</Typography>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Wallet color={Theme.colors.warning} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.creditsUsed30d || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Credits 30d</Typography>
            </GlassCard>
          </View>

          <GlassCard style={styles.chartCard}>
            <Typography variant="h3" style={styles.cardTitle}>Activity Trend</Typography>
            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Theme.colors.primary }]} />
                <Typography variant="caption" color={appTheme.muted}>
                  {hasDailyBreakdown ? 'Connections by day' : 'Current totals by metric'}
                </Typography>
              </View>
              <Typography variant="caption" color={appTheme.muted}>Max {formatNumber(maxChartValue)}</Typography>
            </View>
            <View style={styles.chartArea}>
              <View style={styles.yAxisLabels}>
                <Typography variant="caption" color={appTheme.muted}>{formatNumber(maxChartValue)}</Typography>
                <Typography variant="caption" color={appTheme.muted}>0</Typography>
              </View>
              <View style={styles.mockChart}>
                {chartPoints.map((point, index) => (
                  <View key={`${point.label}-${index}`} style={styles.barColumn}>
                    <Typography variant="caption" color={appTheme.muted} style={styles.barValue} numberOfLines={1}>
                      {formatNumber(point.value)}
                    </Typography>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: point.value > 0 ? Math.max(8, (point.value / maxChartValue) * 96) : 2,
                          opacity: point.value > 0 ? 1 : 0.35,
                        },
                      ]}
                    />
                    <Typography variant="caption" color={appTheme.muted} style={styles.xAxisLabel} numberOfLines={1}>
                      {point.label}
                    </Typography>
                  </View>
                ))}
              </View>
            </View>
            <Typography variant="caption" color={appTheme.muted} style={styles.axisTitle}>
              Y-axis: count - X-axis: {hasDailyBreakdown ? 'date' : 'metric'}
            </Typography>
          </GlassCard>

          <GlassCard style={styles.activityCard}>
            <Typography variant="h3" style={styles.cardTitle}>Channel Performance</Typography>
            {channelPerformance.map((item) => (
              <View key={item.label} style={styles.channelRow}>
                <Typography variant="body" style={styles.channelLabel}>{item.label}</Typography>
                <View style={[styles.progressBg, { backgroundColor: appTheme.softSurface }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(item.value, 100)}%`, backgroundColor: item.color }]} />
                </View>
                <View style={styles.channelValue}>
                  <Typography variant="bodySmall" style={styles.percentLabel}>{formatPercent(item.value)}</Typography>
                  <Typography variant="caption" color={appTheme.muted} style={styles.countLabel}>
                    {formatNumber(item.count)} / {formatNumber(item.total)}
                  </Typography>
                </View>
              </View>
            ))}
          </GlassCard>

          {analytics?.topFeatures.length ? (
            <GlassCard style={styles.activityCard}>
              <Typography variant="h3" style={styles.cardTitle}>Top Usage</Typography>
              {analytics.topFeatures.map((feature) => (
                <View key={feature.featureName} style={styles.usageRow}>
                  <Typography variant="body">{feature.featureName}</Typography>
                  <Typography variant="bodySmall" color={appTheme.muted}>{formatNumber(feature.credits)} credits</Typography>
                </View>
              ))}
            </GlassCard>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.xl, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', gap: Theme.spacing.md, marginBottom: Theme.spacing.md },
  statCard: { flex: 1, padding: Theme.spacing.md },
  statValue: { marginTop: 8 },
  chartCard: { padding: Theme.spacing.md, marginBottom: Theme.spacing.md },
  cardTitle: { marginBottom: 16 },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  yAxisLabels: {
    width: 34,
    height: 146,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingBottom: 22,
  },
  mockChart: {
    height: 146,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.borderLight,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    minHeight: 12,
  },
  bar: { width: 20, backgroundColor: Theme.colors.primary, borderRadius: 4 },
  xAxisLabel: {
    fontSize: 9,
    textAlign: 'center',
    minHeight: 18,
    maxWidth: 54,
  },
  axisTitle: {
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  activityCard: { padding: Theme.spacing.md, marginBottom: Theme.spacing.md },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  channelLabel: { width: 96 },
  progressBg: { flex: 1, height: 8, backgroundColor: Theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  channelValue: {
    width: 64,
    alignItems: 'flex-end',
  },
  percentLabel: { textAlign: 'right' },
  countLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  loader: {
    marginTop: Theme.spacing.xxl,
  },
});
