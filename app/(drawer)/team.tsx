import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MoreHorizontal, RefreshCw, UserPlus } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { getTeamMembers, TeamMember } from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();

export default function TeamScreen() {
  const appTheme = useAppTheme();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMembers = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load team members.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const activeCount = members.filter((member) => member.status.toLowerCase() !== 'inactive').length;

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Typography variant="bodyLarge" color={appTheme.muted}>Manage tenant users loaded from the LAD overview API.</Typography>
            <Typography variant="caption" color={appTheme.muted}>{formatNumber(activeCount)} active of {formatNumber(members.length)} users</Typography>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadMembers(true)} disabled={refreshing || loading}>
              {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteBtn} onPress={() => Alert.alert('Invite team member', 'Team invitations are managed from the LAD web workspace.')}>
              <UserPlus color={Theme.colors.surface} size={20} />
              <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.inviteText}>Invite</Typography>
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
          </GlassCard>
        ) : null}

        {loading ? (
          <ActivityIndicator color={appTheme.primaryAccent} style={styles.loader} />
        ) : members.length === 0 ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="h4">No team members found</Typography>
            <Typography variant="bodySmall" color={appTheme.muted}>Users returned by /api/overview/users will appear here.</Typography>
          </GlassCard>
        ) : (
          members.map((member) => {
            const active = member.status.toLowerCase() !== 'inactive';

            return (
              <GlassCard key={member.id} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <Avatar fallback={member.name} size="md" />
                  <View style={styles.memberDetails}>
                    <Typography variant="bodyLarge" style={styles.memberName} numberOfLines={1}>{member.name}</Typography>
                    <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1}>{member.email || 'No email on profile'}</Typography>
                  </View>
                </View>
                <View style={styles.memberActions}>
                  <Badge label={member.role} variant={member.role.toLowerCase().includes('admin') ? 'success' : 'default'} style={styles.roleBadge} />
                  <Badge label={active ? 'Active' : 'Inactive'} variant={active ? 'info' : 'warning'} style={styles.statusBadge} />
                  <TouchableOpacity>
                    <MoreHorizontal color={appTheme.muted} size={20} />
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
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
  },
  inviteText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  memberCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  memberDetails: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  memberName: {
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  roleBadge: {
    marginRight: 0,
  },
  statusBadge: {
    marginRight: 'auto',
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  loader: {
    marginTop: Theme.spacing.xxl,
  },
});
