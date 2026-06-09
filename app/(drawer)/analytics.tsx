import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { PhoneCall, RefreshCw, TrendingUp, Users, Wallet } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnalyticsOverview, getAnalyticsOverview, getCampaigns } from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const formatPercent = (value: number) => `${Math.round((value || 0) * 10) / 10}%`;

export default function AnalyticsScreen() {
  const appTheme = useAppTheme();
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const channelPerformance = useMemo(() => {
    const stats = analytics?.campaignStats;
    return [
      { label: 'Connections', value: stats?.avgConnectionRate || 0, color: Theme.colors.primary },
      { label: 'Replies', value: stats?.avgReplyRate || 0, color: Theme.colors.success },
      { label: 'Calls Answered', value: analytics?.callAnswerRate || 0, color: Theme.colors.info },
    ];
  }, [analytics]);

  const chartValues = useMemo(() => {
    const breakdown = analytics?.campaignStats.dailyBreakdown || [];
    if (breakdown.length > 0) {
      return breakdown.slice(-7).map((item) => Math.max(item.count, 4));
    }
    return [
      analytics?.campaignStats.totalSent || 4,
      analytics?.campaignStats.totalDelivered || 4,
      analytics?.campaignStats.totalConnected || 4,
      analytics?.campaignStats.totalReplied || 4,
      analytics?.totalCalls || 4,
      analytics?.answeredCalls || 4,
      analytics?.creditsUsed30d || 4,
    ];
  }, [analytics]);

  const maxChartValue = Math.max(...chartValues, 1);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: appTheme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
    >
      <View style={styles.header}>
        <View>
          <Typography variant="h1">Analytics</Typography>
          <Typography variant="body" color={appTheme.muted}>Performance metrics from LAD backend</Typography>
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
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.campaignStats.totalLeads || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Total Leads</Typography>
            </GlassCard>
          </View>

          <View style={styles.grid}>
            <GlassCard style={styles.statCard}>
              <PhoneCall color={Theme.colors.info} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.totalCalls || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Voice Calls</Typography>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Wallet color={Theme.colors.warning} size={24} />
              <Typography variant="h2" style={styles.statValue}>{formatNumber(analytics?.creditsUsed30d || 0)}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Credits 30d</Typography>
            </GlassCard>
          </View>

          <GlassCard style={styles.chartCard}>
            <Typography variant="h3" style={styles.cardTitle}>Activity Trend</Typography>
            <View style={styles.mockChart}>
              {chartValues.map((value, index) => (
                <View key={`${value}-${index}`} style={[styles.bar, { height: Math.max(18, (value / maxChartValue) * 110) }]} />
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.activityCard}>
            <Typography variant="h3" style={styles.cardTitle}>Channel Performance</Typography>
            {channelPerformance.map((item) => (
              <View key={item.label} style={styles.channelRow}>
                <Typography variant="body" style={styles.channelLabel}>{item.label}</Typography>
                <View style={[styles.progressBg, { backgroundColor: appTheme.softSurface }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(item.value, 100)}%`, backgroundColor: item.color }]} />
                </View>
                <Typography variant="bodySmall" style={styles.percentLabel}>{formatPercent(item.value)}</Typography>
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
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
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
  mockChart: { height: 130, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 10 },
  bar: { width: 20, backgroundColor: Theme.colors.primary, borderRadius: 4 },
  activityCard: { padding: Theme.spacing.md, marginBottom: Theme.spacing.md },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  channelLabel: { width: 94 },
  progressBg: { flex: 1, height: 8, backgroundColor: Theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  percentLabel: { width: 42, textAlign: 'right' },
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
