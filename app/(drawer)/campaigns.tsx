import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MoreVertical, Pause, Play, Plus, RefreshCw } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { CampaignItem, CampaignStats, deleteCampaign, getCampaigns, getCampaignStats, updateCampaignLifecycle } from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const formatPercent = (value: number) => `${Math.round((value || 0) * 10) / 10}%`;
const isActiveStatus = (status: string) => ['running', 'active'].includes(status.toLowerCase());

export default function CampaignsScreen() {
  const appTheme = useAppTheme();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');

  const loadCampaigns = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const items = await getCampaigns();
      const latestStats = await getCampaignStats(items);
      setCampaigns(items);
      setStats(latestStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load campaigns.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleLifecycle = async (campaign: CampaignItem) => {
    const status = String(campaign.status).toLowerCase();
    const action = isActiveStatus(status) ? 'pause' : status === 'paused' ? 'resume' : 'start';
    setOpenMenuId('');
    setBusyId(campaign.id);

    try {
      await updateCampaignLifecycle(campaign.id, action);
      await loadCampaigns(true);
    } catch (err) {
      Alert.alert('Campaign update failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteCampaign = async (campaign: CampaignItem) => {
    setOpenMenuId('');
    setBusyId(campaign.id);

    try {
      await deleteCampaign(campaign.id);
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      await loadCampaigns(true);
    } catch (err) {
      Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unable to delete this campaign.');
    } finally {
      setBusyId('');
    }
  };

  const openCampaignMenu = (campaign: CampaignItem) => {
    setOpenMenuId((current) => current === campaign.id ? '' : campaign.id);
  };

  const confirmDeleteCampaign = (campaign: CampaignItem) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Delete this campaign from the backend permanently?')) {
        void handleDeleteCampaign(campaign);
      }
      return;
    }

    Alert.alert(
      'Delete campaign?',
      'This will permanently delete the campaign from the backend.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteCampaign(campaign),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={styles.header}>
        <View>
          <Typography variant="h1">Campaigns</Typography>
          <Typography variant="bodySmall" color={appTheme.muted}>Live campaigns from backend</Typography>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadCampaigns(true)} disabled={refreshing || loading}>
            {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => Alert.alert('Create campaign', 'Open the web campaign builder to create a new workflow.')}>
            <Plus color={Theme.colors.surface} size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCampaigns(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        <View style={styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <Typography variant="h2">{formatNumber(stats?.totalCampaigns || campaigns.length)}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Total Campaigns</Typography>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Typography variant="h2">{formatNumber(stats?.activeCampaigns || 0)}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Active</Typography>
          </GlassCard>
        </View>

        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
          </GlassCard>
        ) : null}

        {loading ? (
          <ActivityIndicator color={appTheme.primaryAccent} style={styles.loader} />
        ) : campaigns.length === 0 ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="h4">No campaigns found</Typography>
            <Typography variant="bodySmall" color={appTheme.muted}>Campaigns created in LAD web will appear here.</Typography>
          </GlassCard>
        ) : (
          campaigns.map((campaign) => {
            const active = isActiveStatus(String(campaign.status));
            const sentBase = campaign.sentCount || campaign.leadsCount;
            const replyRate = sentBase ? (campaign.repliedCount / sentBase) * 100 : 0;

            return (
              <GlassCard key={campaign.id} style={styles.campaignCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleBlock}>
                    <Typography variant="h4" numberOfLines={2}>{campaign.name}</Typography>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={String(campaign.status).toUpperCase()}
                        variant={active ? 'success' : String(campaign.status).toLowerCase() === 'paused' ? 'warning' : 'default'}
                      />
                      {campaign.type ? <Badge label={campaign.type} variant="info" /> : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => openCampaignMenu(campaign)}
                    disabled={busyId === campaign.id}
                    activeOpacity={0.72}
                  >
                    <MoreVertical color={appTheme.muted} size={20} />
                  </TouchableOpacity>
                  {openMenuId === campaign.id ? (
                    <View style={[styles.actionMenu, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => void handleLifecycle(campaign)}
                        disabled={busyId === campaign.id}
                        activeOpacity={0.72}
                      >
                        {active ? <Pause color={appTheme.primaryAccent} size={16} /> : <Play color={appTheme.primaryAccent} size={16} />}
                        <Typography variant="bodySmall" color={appTheme.text} style={styles.actionMenuText}>
                          {active ? 'Pause Campaign' : String(campaign.status).toLowerCase() === 'paused' ? 'Resume Campaign' : 'Start Campaign'}
                        </Typography>
                      </TouchableOpacity>
                      <View style={[styles.actionMenuDivider, { backgroundColor: appTheme.border }]} />
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => confirmDeleteCampaign(campaign)}
                        disabled={busyId === campaign.id}
                        activeOpacity={0.72}
                      >
                        <Typography variant="bodySmall" color={Theme.colors.error} style={styles.actionMenuText}>
                          Delete Campaign
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Typography variant="caption" color={appTheme.muted}>Leads</Typography>
                    <Typography variant="h3">{formatNumber(campaign.leadsCount)}</Typography>
                  </View>
                  <View style={styles.metric}>
                    <Typography variant="caption" color={appTheme.muted}>Sent</Typography>
                    <Typography variant="h3">{formatNumber(campaign.sentCount)}</Typography>
                  </View>
                  <View style={styles.metric}>
                    <Typography variant="caption" color={appTheme.muted}>Reply Rate</Typography>
                    <Typography variant="h3">{formatPercent(replyRate)}</Typography>
                  </View>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => handleLifecycle(campaign)} disabled={busyId === campaign.id}>
                    {busyId === campaign.id ? (
                      <ActivityIndicator color={appTheme.primaryAccent} />
                    ) : active ? (
                      <Pause color={appTheme.primaryAccent} size={20} />
                    ) : (
                      <Play color={appTheme.primaryAccent} size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    paddingTop: 60,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: Theme.spacing.xl, paddingTop: 0, paddingBottom: Theme.spacing.xxxl },
  statsGrid: { flexDirection: 'row', gap: Theme.spacing.md, marginBottom: Theme.spacing.md },
  statCard: { flex: 1, padding: Theme.spacing.lg },
  campaignCard: { padding: Theme.spacing.md, marginBottom: Theme.spacing.md, zIndex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.spacing.lg },
  cardTitleBlock: { flex: 1, paddingRight: Theme.spacing.sm },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 190,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: Theme.spacing.xs,
    zIndex: 40,
    ...Theme.shadows.large,
  },
  actionMenuItem: {
    minHeight: 42,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  actionMenuText: {
    fontWeight: '800',
  },
  actionMenuDivider: {
    height: 1,
    marginVertical: Theme.spacing.xs,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.xs, marginTop: Theme.spacing.xs },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
  metric: { flex: 1 },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  loader: {
    marginTop: Theme.spacing.xxl,
  },
});
