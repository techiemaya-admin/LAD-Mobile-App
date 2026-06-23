import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Eye, EyeOff, MoreHorizontal, RefreshCw, Trash2, UserPlus } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import {
  deleteTeamMember,
  getTeamMembers,
  TeamMember,
  updateTeamMemberPhoneMask,
} from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const formatNumber = (value: number) => Math.round(value || 0).toLocaleString();
const TEAM_CACHE_KEY = 'drawer.team.members';

const PAGE_CAPABILITIES = [
  { key: 'view_overview', label: 'Overview' },
  { key: 'view_conversations', label: 'Conversations' },
  { key: 'view_followup', label: 'Follow-up' },
  { key: 'view_community_roi', label: 'Community ROI' },
  { key: 'view_scraper', label: 'Scraper' },
  { key: 'view_make_call', label: 'Make a Call' },
  { key: 'view_call_logs', label: 'Call Logs' },
  { key: 'view_pipeline', label: 'Pipeline' },
  { key: 'view_pricing', label: 'Pricing' },
  { key: 'view_settings', label: 'Settings' },
];

const CAPABILITY_LABELS = PAGE_CAPABILITIES.reduce<Record<string, string>>((labels, capability) => {
  labels[capability.key] = capability.label;
  return labels;
}, {});

const titleCase = (value: string) =>
  value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPermissionLabels = (capabilities: string[]) =>
  capabilities.map((capability) => CAPABILITY_LABELS[capability] || titleCase(capability));

export default function TeamScreen() {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isPhone = width < 520;
  const isSmallPhone = width < 380;
  const pagePadding = isSmallPhone ? Theme.spacing.md : isPhone ? Theme.spacing.lg : Theme.spacing.xl;
  const [members, setMembers] = useState<TeamMember[]>(() => readScreenCache<TeamMember[]>(TEAM_CACHE_KEY)?.value ?? []);
  const [loading, setLoading] = useState(() => !readScreenCache<TeamMember[]>(TEAM_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const [error, setError] = useState('');

  const setMembersAndCache = useCallback((updater: (current: TeamMember[]) => TeamMember[]) => {
    setMembers((current) => {
      const nextMembers = updater(current);
      writeScreenCache(TEAM_CACHE_KEY, nextMembers);
      return nextMembers;
    });
  }, []);

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
      writeScreenCache(TEAM_CACHE_KEY, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load team members.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      loadMembers();
    }
  }, [loadMembers, loading]);

  const activeCount = useMemo(
    () => members.filter((member) => member.status.toLowerCase() !== 'inactive').length,
    [members],
  );

  const closeMemberMenu = useCallback(() => {
    setOpenMenuId('');
  }, []);

  const openMemberMenu = useCallback((memberId: string) => {
    setOpenMenuId((current) => current === memberId ? '' : memberId);
  }, []);

  const handleTogglePhoneMask = useCallback(async (member: TeamMember) => {
    const previousValue = Boolean(member.maskPhoneNumber);
    const nextValue = !previousValue;

    closeMemberMenu();
    setBusyMemberId(member.id);
    setMembersAndCache((current) => current.map((item) =>
      item.id === member.id ? { ...item, maskPhoneNumber: nextValue } : item,
    ));

    try {
      await updateTeamMemberPhoneMask(member.id, nextValue);
    } catch (err) {
      setMembersAndCache((current) => current.map((item) =>
        item.id === member.id ? { ...item, maskPhoneNumber: previousValue } : item,
      ));
      Alert.alert('Privacy not updated', err instanceof Error ? err.message : 'Unable to update phone privacy.');
    } finally {
      setBusyMemberId((current) => current === member.id ? '' : current);
    }
  }, [closeMemberMenu, setMembersAndCache]);

  const handleDeleteMember = useCallback(async (member: TeamMember) => {
    closeMemberMenu();
    setBusyMemberId(member.id);

    try {
      await deleteTeamMember(member.id);
      setMembersAndCache((current) => current.filter((item) => item.id !== member.id));
    } catch (err) {
      Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unable to delete this team member.');
    } finally {
      setBusyMemberId((current) => current === member.id ? '' : current);
    }
  }, [closeMemberMenu, setMembersAndCache]);

  const confirmDeleteMember = useCallback((member: TeamMember) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Delete ${member.name} from the team?`)) {
        void handleDeleteMember(member);
      }
      return;
    }

    Alert.alert(
      'Delete team member?',
      `Delete ${member.name} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteMember(member) },
      ],
    );
  }, [handleDeleteMember]);

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pagePadding, paddingTop: Theme.spacing.lg, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        <View style={styles.contentMaxWidth}>
          {openMenuId ? <Pressable style={styles.menuDismissLayer} onPress={closeMemberMenu} /> : null}

          <View style={[styles.header, isPhone && styles.headerPhone]}>
            <View style={[styles.headerCopy, isPhone && styles.headerCopyPhone]}>
              <Typography variant="bodyLarge" color={appTheme.muted} numberOfLines={3}>Manage and configure member roles and permissions for your team.</Typography>
              <Typography variant="caption" color={appTheme.muted}>{formatNumber(activeCount)} active of {formatNumber(members.length)} users</Typography>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadMembers(true)} disabled={refreshing || loading}>
                {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteBtn} onPress={() => Alert.alert('Invite team member', 'Team invitations are managed from the web workspace.')}>
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
              <Typography variant="bodySmall" color={appTheme.muted}>Registered team members will appear here.</Typography>
            </GlassCard>
          ) : (
            members.map((member) => {
              const active = member.status.toLowerCase() !== 'inactive';
              const masked = Boolean(member.maskPhoneNumber);
              const isBusy = busyMemberId === member.id;
              const permissionLabels = getPermissionLabels(member.capabilities || []);
              const visiblePermissions = permissionLabels.slice(0, isPhone ? 3 : 4);
              const hiddenPermissionCount = Math.max(0, permissionLabels.length - visiblePermissions.length);

              return (
                <GlassCard
                  key={member.id}
                  style={[styles.memberCard, isPhone && styles.memberCardPhone, openMenuId === member.id && styles.memberCardMenuOpen]}
                >
                  {openMenuId === member.id ? (
                    <Pressable style={styles.memberCardDismissLayer} onPress={closeMemberMenu} />
                  ) : null}

                  <View style={styles.memberInfo}>
                    <Avatar fallback={member.name} size="md" />
                    <View style={styles.memberDetails}>
                      <Typography variant="bodyLarge" style={styles.memberName} numberOfLines={1}>{member.name}</Typography>
                      <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1}>{member.email || 'No email on profile'}</Typography>
                    </View>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: appTheme.borderSoft }]} />

                  <View style={[styles.memberBody, !isPhone && styles.memberBodyWide]}>
                    <View style={styles.roleBlock}>
                      <Typography variant="overline" color={appTheme.disabled}>Role & Status</Typography>
                      <View style={styles.badgeRow}>
                        <Badge label={member.role || 'Member'} variant={member.role.toLowerCase().includes('admin') || member.role.toLowerCase().includes('owner') ? 'success' : 'default'} />
                        <Badge label={active ? 'Active' : 'Inactive'} variant={active ? 'info' : 'warning'} />
                      </View>
                    </View>

                    <View style={styles.permissionsBlock}>
                      <Typography variant="overline" color={appTheme.disabled}>Permissions</Typography>
                      {visiblePermissions.length ? (
                        <View style={styles.permissionPills}>
                          {visiblePermissions.map((permission) => (
                            <View key={`${member.id}-${permission}`} style={[styles.permissionChip, { backgroundColor: appTheme.primarySoft }]}>
                              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.permissionText} numberOfLines={1}>{permission}</Typography>
                            </View>
                          ))}
                          {hiddenPermissionCount ? (
                            <View style={[styles.permissionChip, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
                              <Typography variant="caption" color={appTheme.muted} style={styles.permissionText}>+{hiddenPermissionCount} more</Typography>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <Typography variant="bodySmall" color={appTheme.muted}>No page permissions selected</Typography>
                      )}
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: appTheme.borderSoft }]}>
                    <View style={styles.privacyBlock}>
                      <Typography variant="overline" color={appTheme.disabled}>Privacy</Typography>
                      <View style={styles.privacyRow}>
                        <View style={[styles.privacyIcon, { backgroundColor: masked ? appTheme.primarySoft : appTheme.infoSoft }]}>
                          {masked ? <EyeOff color={appTheme.primaryAccent} size={16} /> : <Eye color={Theme.colors.info} size={16} />}
                        </View>
                        <View style={styles.privacyCopy}>
                          <Typography variant="caption" color={masked ? appTheme.primaryAccent : appTheme.muted} style={styles.privacyStatus} numberOfLines={1}>
                            {masked ? 'Phone Masked' : 'Phone Visible'}
                          </Typography>
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>Lead phone privacy</Typography>
                        </View>
                      </View>
                    </View>

                    {isBusy ? (
                      <View style={styles.switchLoading}>
                        <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                      </View>
                    ) : (
                      <TouchableOpacity
                        accessibilityRole="switch"
                        accessibilityState={{ checked: masked, disabled: isBusy }}
                        accessibilityLabel={`${masked ? 'Disable' : 'Enable'} phone masking for ${member.name}`}
                        activeOpacity={0.78}
                        disabled={isBusy}
                        onPress={() => void handleTogglePhoneMask(member)}
                        style={[styles.privacySwitch, { backgroundColor: masked ? appTheme.primaryAccent : appTheme.border }]}
                      >
                        <View style={[styles.privacySwitchThumb, masked && styles.privacySwitchThumbOn]} />
                      </TouchableOpacity>
                    )}

                    <View style={styles.actionBlock}>
                      <Typography variant="overline" color={appTheme.disabled}>Actions</Typography>
                      <View style={styles.memberMenuWrap}>
                        <TouchableOpacity
                          style={[styles.menuButton, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}
                          onPress={() => openMemberMenu(member.id)}
                          disabled={isBusy}
                          activeOpacity={0.72}
                          accessibilityRole="button"
                          accessibilityLabel={`Open actions for ${member.name}`}
                        >
                          {isBusy ? <ActivityIndicator color={appTheme.primaryAccent} size="small" /> : <MoreHorizontal color={appTheme.muted} size={20} />}
                        </TouchableOpacity>

                        {openMenuId === member.id ? (
                          <View style={[styles.actionMenu, isPhone && styles.actionMenuPhone, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                            <TouchableOpacity
                              style={styles.actionMenuItem}
                              onPress={() => void handleTogglePhoneMask(member)}
                              disabled={isBusy}
                              activeOpacity={0.72}
                            >
                              <View style={[styles.actionMenuIcon, { backgroundColor: appTheme.primarySoft }]}>
                                {masked ? <Eye color={appTheme.primaryAccent} size={16} /> : <EyeOff color={appTheme.primaryAccent} size={16} />}
                              </View>
                              <View style={styles.actionMenuCopy}>
                                <Typography variant="bodySmall" color={appTheme.text} style={styles.actionMenuText} numberOfLines={1}>
                                  {masked ? 'Show Phone Numbers' : 'Mask Phone Numbers'}
                                </Typography>
                                <Typography variant="caption" color={appTheme.muted}>{masked ? 'Phone Masked' : 'Phone Visible'}</Typography>
                              </View>
                            </TouchableOpacity>
                            <View style={[styles.actionMenuDivider, { backgroundColor: appTheme.border }]} />
                            <TouchableOpacity
                              style={styles.actionMenuItem}
                              onPress={() => confirmDeleteMember(member)}
                              disabled={isBusy}
                              activeOpacity={0.72}
                            >
                              <View style={[styles.actionMenuIcon, { backgroundColor: appTheme.errorSoft }]}>
                                <Trash2 color={Theme.colors.error} size={16} />
                              </View>
                              <View style={styles.actionMenuCopy}>
                                <Typography variant="bodySmall" color={Theme.colors.error} style={styles.actionMenuText} numberOfLines={1}>Delete Member</Typography>
                                <Typography variant="caption" color={appTheme.muted}>Remove from team</Typography>
                              </View>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
  },
  contentMaxWidth: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    position: 'relative',
  },
  menuDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  headerPhone: {
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 250,
  },
  headerCopyPhone: {
    minWidth: 0,
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
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  memberCardPhone: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
  },
  memberCardMenuOpen: {
    zIndex: 60,
    elevation: 24,
  },
  memberCardDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    zIndex: 1,
  },
  memberDetails: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  memberName: {
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    marginBottom: Theme.spacing.md,
  },
  memberBody: {
    width: '100%',
    marginBottom: Theme.spacing.md,
  },
  memberBodyWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.xl,
  },
  roleBlock: {
    minWidth: 140,
    marginBottom: Theme.spacing.md,
  },
  permissionsBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardFooter: {
    minHeight: 58,
    borderTopWidth: 1,
    paddingTop: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  privacyBlock: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  permissionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  permissionChip: {
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 180,
  },
  permissionText: {
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  privacyRowPhone: {
    minHeight: 40,
  },
  privacyIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCopy: {
    flex: 1,
    minWidth: 0,
  },
  privacyStatus: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  privacySwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 3,
    justifyContent: 'center',
  },
  privacySwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.colors.surface,
    ...Theme.shadows.small,
  },
  privacySwitchThumbOn: {
    transform: [{ translateX: 20 }],
  },
  switchLoading: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBlock: {
    width: 54,
    alignItems: 'center',
    position: 'relative',
    zIndex: 70,
    elevation: 28,
  },
  memberMenuWrap: {
    position: 'relative',
    alignSelf: 'center',
    zIndex: 80,
    elevation: 32,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 240,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: Theme.spacing.xs,
    zIndex: 90,
    ...Theme.shadows.large,
  },
  actionMenuPhone: {
    width: 224,
  },
  actionMenuItem: {
    minHeight: 54,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  actionMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuCopy: {
    flex: 1,
  },
  actionMenuText: {
    fontWeight: '800',
  },
  actionMenuDivider: {
    height: 1,
    marginVertical: Theme.spacing.xs,
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  loader: {
    marginTop: Theme.spacing.xxl,
  },
});
