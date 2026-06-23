import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, ExternalLink, Filter, Mail, Phone, Search, UserRound } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useAdvancedSearch } from '@/src/hooks/useAdvancedSearch';
import { MobileAssistantLead } from '@/src/services/mobileAIAssistantService';
import { useAppTheme } from '@/src/theme/appTheme';

const scoreTone = (score?: number) => {
  if ((score ?? 0) >= 70) return { bg: '#DCFCE7', fg: '#166534', label: 'Strong' };
  if ((score ?? 0) >= 45) return { bg: '#FEF9C3', fg: '#854D0E', label: 'Moderate' };
  return { bg: '#E0E7FF', fg: '#3730A3', label: 'Match' };
};

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const assistant = useAdvancedSearch();
  const [query, setQuery] = useState('');

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assistant.leads;
    return assistant.leads.filter((lead) =>
      [lead.name, lead.headline, lead.company, lead.location, lead.industry, lead.email, lead.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [assistant.leads, query]);

  const openUrl = (url?: string) => {
    if (!url) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  const renderLead = (lead: MobileAssistantLead) => {
    const tone = scoreTone(lead.score);
    return (
      <GlassCard key={lead.id} style={[styles.leadCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        <View style={styles.leadHeader}>
          <View style={[styles.avatar, { backgroundColor: appTheme.infoSoft }]}>
            <UserRound color={appTheme.primaryAccent} size={18} />
          </View>
          <View style={styles.leadInfo}>
            <Typography variant="h4" color={appTheme.text} numberOfLines={1}>{lead.name}</Typography>
            <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1}>
              {lead.headline || lead.company || lead.location || 'Prospect'}
            </Typography>
          </View>
          {lead.score != null ? (
            <View style={[styles.scoreBadge, { backgroundColor: tone.bg }]}>
              <Typography variant="caption" color={tone.fg} style={styles.scoreText}>{lead.score}%</Typography>
            </View>
          ) : null}
        </View>

        <View style={styles.metaList}>
          {lead.company ? (
            <View style={styles.metaItem}>
              <Building2 color={appTheme.muted} size={14} />
              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.company}</Typography>
            </View>
          ) : null}
          {lead.location ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.location}</Typography> : null}
          {lead.industry ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.industry}</Typography> : null}
        </View>

        {lead.reasoning ? (
          <Typography variant="bodySmall" color={appTheme.muted} style={styles.reasoning} numberOfLines={3}>
            {lead.reasoning}
          </Typography>
        ) : null}

        <View style={[styles.actionRow, { borderTopColor: appTheme.borderSoft }]}>
          {lead.profileUrl ? (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: appTheme.softSurface }]} onPress={() => openUrl(lead.profileUrl)}>
              <ExternalLink color={appTheme.primaryAccent} size={16} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.actionText}>LinkedIn</Typography>
            </TouchableOpacity>
          ) : null}
          {lead.email ? (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: appTheme.softSurface }]} onPress={() => openUrl(`mailto:${lead.email}`)}>
              <Mail color={appTheme.primaryAccent} size={16} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.actionText} numberOfLines={1}>Email</Typography>
            </TouchableOpacity>
          ) : null}
          {lead.phone ? (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: appTheme.softSurface }]} onPress={() => openUrl(`tel:${lead.phone}`)}>
              <Phone color={appTheme.primaryAccent} size={16} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.actionText} numberOfLines={1}>Call</Typography>
            </TouchableOpacity>
          ) : null}
        </View>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: appTheme.background }]}>
      <View style={styles.header}>
        <Typography variant="h1" color={appTheme.text}>Leads</Typography>
        <Typography variant="caption" color={appTheme.muted}>
          {assistant.totalResults || assistant.leads.length} assistant result{(assistant.totalResults || assistant.leads.length) === 1 ? '' : 's'}
        </Typography>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          <Search color={appTheme.muted} size={20} />
          <TextInput
            style={[styles.searchInput, { color: appTheme.text }]}
            placeholder="Search leads..."
            placeholderTextColor={appTheme.disabled}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={[styles.filterButton, { backgroundColor: appTheme.infoSoft }]}>
          <Filter color={appTheme.primaryAccent} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        {filteredLeads.length ? filteredLeads.map(renderLead) : (
          <GlassCard style={[styles.emptyCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <Typography variant="body" color={appTheme.text} style={styles.emptyTitle}>No assistant leads yet</Typography>
            <Typography variant="bodySmall" color={appTheme.muted} style={styles.emptyCopy}>
              Ask the AI Assistant to find leads first. This page will show the same LAD Frontend search results.
            </Typography>
          </GlassCard>
        )}

        {assistant.leads.length ? (
          <TouchableOpacity
            style={[styles.loadMoreButton, { backgroundColor: appTheme.primaryAccent }]}
            disabled={assistant.isLoadingMore}
            onPress={() => void assistant.loadMore()}
          >
            {assistant.isLoadingMore ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : (
              <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.loadMoreText}>Get More Leads</Typography>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
  },
  leadCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
  },
  leadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadInfo: {
    flex: 1,
    minWidth: 0,
  },
  scoreBadge: {
    borderRadius: 14,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
  },
  scoreText: {
    fontWeight: '900',
  },
  metaList: {
    marginTop: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  reasoning: {
    marginTop: Theme.spacing.sm,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    borderTopWidth: 1,
    paddingTop: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: Theme.spacing.md,
  },
  actionText: {
    fontWeight: '800',
  },
  emptyCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  loadMoreButton: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.sm,
  },
  loadMoreText: {
    fontWeight: '900',
  },
});
