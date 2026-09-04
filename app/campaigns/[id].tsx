import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Inbox, RefreshCw, Send, Users, Wifi } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Typography } from '@/components/ui/Typography';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { CampaignStatusStepper } from '@/components/features/CampaignStatusStepper';
import Theme from '@/constants/theme';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  CampaignAnalyticsOverview,
  CampaignActivityRow,
  getCampaignActivityFeed,
  getCampaignAnalyticsOverview,
} from '@/src/services/settingsHub';
import { buildDisplaySteps, calculateCurrentStep, groupActivitiesByLead, GroupedLeadStatus, WorkflowStepDisplay } from '@/src/services/campaignActivity';

const POLL_INTERVAL_MS = 30_000;
const isActiveStatus = (status: string) => ['running', 'active'].includes(status.toLowerCase());

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const STATUS_LABEL: Record<GroupedLeadStatus['connectionStatus'], string> = {
  NOT_SENT: 'Not sent',
  SENT: 'Sent',
  FAILED: 'Failed',
  PAUSED: 'Paused',
  WITHDRAWN: 'Withdrawn',
};

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaignId = String(id || '');
  const router = useRouter();
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [overview, setOverview] = useState<CampaignAnalyticsOverview | null>(null);
  const [activities, setActivities] = useState<CampaignActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (!campaignId) return;
    if (asRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [analyticsResult, feedResult] = await Promise.all([
        getCampaignAnalyticsOverview(campaignId),
        getCampaignActivityFeed(campaignId),
      ]);
      setOverview(analyticsResult);
      setActivities(feedResult.activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load campaign activity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live polling — mirrors web's refetchInterval on useCampaignActivityFeed,
  // which is what actually lets a step like "Wait for Profile Visit" resolve:
  // each tick re-derives every lead's position from the latest activity rows.
  useEffect(() => {
    const timer = setInterval(() => {
      void load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const displaySteps: WorkflowStepDisplay[] = useMemo(
    () => buildDisplaySteps(overview?.stepAnalytics ?? []),
    [overview?.stepAnalytics],
  );

  const groupedLeads = useMemo(() => groupActivitiesByLead(activities), [activities]);

  const currentStep = useMemo(() => {
    if (!displaySteps.length || !groupedLeads.length) return 1;
    return Math.max(...groupedLeads.map((lead) => calculateCurrentStep(lead, displaySteps)));
  }, [displaySteps, groupedLeads]);

  const leadContactBack = groupedLeads.filter((lead) => lead.leadReplied).length;
  const active = overview ? isActiveStatus(overview.campaign.status) : false;

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: appTheme.border }]}>
        <TouchableOpacity onPress={() => (router.canGoBack?.() ? router.back() : router.replace('/(drawer)/campaigns' as never))} style={styles.backButton} activeOpacity={0.72}>
          <ArrowLeft color={appTheme.text} size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Typography variant="h4" numberOfLines={1}>{overview?.campaign.name || 'Campaign'}</Typography>
          {overview ? (
            <View style={styles.headerBadgeRow}>
              <Badge label={overview.campaign.status.toUpperCase()} variant={active ? 'success' : overview.campaign.status.toLowerCase() === 'paused' ? 'warning' : 'default'} />
              <View style={styles.liveTag}>
                <Wifi color={appTheme.primaryAccent} size={12} />
                <Typography variant="caption" color={appTheme.primaryAccent} style={styles.liveTagText}>Live</Typography>
              </View>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => void load(true)} disabled={refreshing || loading} style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          {refreshing ? <ActivityIndicator color={appTheme.primaryAccent} size="small" /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
          </GlassCard>
        ) : null}

        {loading && !overview ? (
          <ActivityIndicator color={appTheme.primaryAccent} style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <GlassCard style={styles.statCard}>
                <View style={styles.statIconWrap}><Users color={appTheme.primaryAccent} size={16} /></View>
                <Typography variant="h3">{formatNumber(overview?.overview.totalLeads ?? 0)}</Typography>
                <Typography variant="caption" color={appTheme.muted}>Total Leads</Typography>
              </GlassCard>
              <GlassCard style={styles.statCard}>
                <View style={styles.statIconWrap}><Send color={appTheme.primaryAccent} size={16} /></View>
                <Typography variant="h3">{formatNumber(overview?.overview.sent ?? 0)}</Typography>
                <Typography variant="caption" color={appTheme.muted}>Connections Sent</Typography>
              </GlassCard>
              <GlassCard style={styles.statCard}>
                <View style={styles.statIconWrap}><Users color={appTheme.primaryAccent} size={16} /></View>
                <Typography variant="h3">{formatNumber(overview?.overview.connected ?? 0)}</Typography>
                <Typography variant="caption" color={appTheme.muted}>Connected</Typography>
              </GlassCard>
              <GlassCard style={styles.statCard}>
                <View style={styles.statIconWrap}><Inbox color={appTheme.primaryAccent} size={16} /></View>
                <Typography variant="h3">{formatNumber(leadContactBack)}</Typography>
                <Typography variant="caption" color={appTheme.muted}>Lead Contact Back</Typography>
              </GlassCard>
            </View>

            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <Typography variant="h4">Live Activity Feed</Typography>
                <View style={styles.liveTag}>
                  <Wifi color={appTheme.primaryAccent} size={12} />
                  <Typography variant="caption" color={appTheme.primaryAccent} style={styles.liveTagText}>Live</Typography>
                </View>
              </View>
              <Typography variant="caption" color={appTheme.muted} style={styles.sectionSubtitle}>Campaign Accelerator</Typography>
              {displaySteps.length ? (
                <CampaignStatusStepper currentStep={currentStep} steps={displaySteps} />
              ) : (
                <Typography variant="bodySmall" color={appTheme.muted}>This campaign has no configured outreach steps yet.</Typography>
              )}
            </GlassCard>

            <GlassCard style={styles.section}>
              <Typography variant="h4" style={styles.sectionSubtitle}>Leads ({groupedLeads.length})</Typography>
              {groupedLeads.length === 0 ? (
                <Typography variant="bodySmall" color={appTheme.muted}>No activity recorded yet for this campaign.</Typography>
              ) : (
                groupedLeads
                  .sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime())
                  .map((lead) => (
                    <View key={lead.leadId} style={[styles.leadRow, { borderTopColor: appTheme.borderSoft }]}>
                      <View style={styles.leadNameBlock}>
                        <Typography variant="bodySmall" numberOfLines={1}>{lead.leadName}</Typography>
                        <Typography variant="caption" color={appTheme.muted}>{relativeTime(lead.latestTimestamp)}</Typography>
                      </View>
                      <Badge
                        label={lead.leadReplied ? 'Replied' : STATUS_LABEL[lead.connectionStatus]}
                        variant={lead.leadReplied || lead.connectionStatus === 'SENT' ? 'success' : lead.connectionStatus === 'FAILED' ? 'default' : 'info'}
                      />
                    </View>
                  ))
              )}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 4 },
  headerTitleBlock: { flex: 1, gap: 4 },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  loader: { marginTop: 60 },
  messageCard: { padding: Theme.spacing.lg },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: Theme.spacing.md,
    gap: 4,
  },
  statIconWrap: { marginBottom: 2 },
  section: { padding: Theme.spacing.md, gap: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionSubtitle: { marginBottom: 4 },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveTagText: { fontWeight: '600' },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Theme.spacing.sm,
  },
  leadNameBlock: { flex: 1, gap: 2 },
});
