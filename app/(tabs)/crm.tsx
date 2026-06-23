import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Inbox,
  Kanban,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShieldMinus,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { SkeletonActivityRow, SkeletonSummaryCard } from '@/components/ui/SkeletonLoader';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';
import {
  CRM_STAGES,
  ChannelKey,
  CrmContact,
  KanbanLead,
  ProspectCRMData,
  ProspectEvent,
  ProspectFollowup,
  buildCounts,
  deleteProspect,
  enrichProspect,
  fetchProspectCRMData,
  getProspect,
  getProspectFollowups,
  initialsOf,
  listProspectEvents,
  prospectAction,
  toCrmContact,
} from '@/src/services/prospectsService';
import { getTeamMembers, TeamMember } from '@/src/services/settingsHub';
import { assignCRMLeadsToUser } from '@/src/services/pipelineService';

type IconComponent = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

type VisibleView = 'board' | 'all' | 'prospects' | 'leads' | 'clients';

const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

const T = {
  primary: '#0B1957',
  primaryHead: '#172560',
  badgeBg: '#e8ebf7',
  linkedin: '#0a66c2',
  whatsapp: '#22c55e',
  gmail: '#ea4335',
  voice: '#7c3aed',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  info: '#0ea5e9',
};

const EMPTY_DATA: ProspectCRMData = {
  prospects: [],
  contacts: [],
  kanbanLeads: [],
  counts: { all: 0, prospects: 0, leads: 0, clients: 0 },
};
type CrmScreenCache = {
  data: ProspectCRMData;
  lastSyncedAt: number;
};
const CRM_CACHE_KEY = 'tabs.crm.data';

const CHANNELS: Record<string, { label: string; color: string; Icon: IconComponent }> = {
  linkedin: { label: 'LinkedIn', color: T.linkedin, Icon: BriefcaseBusiness },
  whatsapp: { label: 'WhatsApp', color: T.whatsapp, Icon: MessageCircle },
  wapa: { label: 'Personal WA', color: T.whatsapp, Icon: MessageCircle },
  email: { label: 'Email', color: T.gmail, Icon: Mail },
  voice: { label: 'Voice', color: T.voice, Icon: Phone },
  instagram: { label: 'Instagram', color: '#ec4899', Icon: Camera },
  intent: { label: 'Signal', color: T.primary, Icon: Radio },
  system: { label: 'System', color: '#64748b', Icon: Settings2 },
};

const VIEW_DEFS: Array<{ key: VisibleView; label: string; Icon: IconComponent }> = [
  { key: 'board', label: 'Board', Icon: Kanban },
  { key: 'all', label: 'All', Icon: Users },
  { key: 'prospects', label: 'Prospects', Icon: Sparkles },
  { key: 'leads', label: 'Leads', Icon: TrendingUp },
  { key: 'clients', label: 'Clients', Icon: BadgeCheck },
];

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contact',
  engaged: 'Engaged',
  qualified: 'Qualified',
  sah: 'Handled',
  won: 'Won',
  lost: 'Lost',
  archived: 'Archived',
};

const STAGE_COLOR: Record<string, string> = {
  new: '#64748b',
  contacted: T.info,
  engaged: '#3b82f6',
  qualified: T.primary,
  sah: T.success,
  won: '#15803d',
  lost: T.danger,
  archived: '#78716c',
};

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  prospect: { label: 'Prospect', color: T.primary, bg: '#e8ebf7' },
  lead: { label: 'Lead', color: T.info, bg: '#e0f2fe' },
  client: { label: 'Client', color: '#16a34a', bg: '#dcfce7' },
  imported: { label: 'Imported', color: '#64748b', bg: '#f1f5f9' },
  inbound: { label: 'Inbound', color: '#a16207', bg: '#fef3c7' },
};

function useCrmPalette() {
  const appTheme = useAppTheme();
  return useMemo(() => ({
    darkMode: appTheme.darkMode,
    background: appTheme.darkMode ? '#0F172A' : '#F8F9FE',
    surface: appTheme.surface,
    surfaceElevated: appTheme.darkMode ? '#172033' : '#fff',
    softSurface: appTheme.softSurface,
    input: appTheme.input,
    text: appTheme.text,
    muted: appTheme.muted,
    disabled: appTheme.disabled,
    border: appTheme.border,
    borderSoft: appTheme.borderSoft,
    primary: appTheme.darkMode ? '#B8C7FF' : T.primary,
    primaryText: appTheme.darkMode ? '#F8FAFC' : T.primaryHead,
    icon: appTheme.darkMode ? '#E2E8F0' : '#1e293b',
    badgeBg: appTheme.darkMode ? 'rgba(184, 199, 255, 0.16)' : T.badgeBg,
    neutralPill: appTheme.darkMode ? '#1E293B' : '#f1f5f9',
    errorBg: appTheme.darkMode ? 'rgba(239, 68, 68, 0.12)' : '#fff1f2',
    errorBorder: appTheme.darkMode ? 'rgba(248, 113, 113, 0.38)' : '#fecdd3',
    errorText: appTheme.darkMode ? '#FCA5A5' : '#be123c',
    successBg: appTheme.darkMode ? 'rgba(34, 197, 94, 0.12)' : '#ecfdf5',
    successBorder: appTheme.darkMode ? 'rgba(34, 197, 94, 0.30)' : '#bbf7d0',
    successText: appTheme.darkMode ? '#86EFAC' : '#166534',
    infoBg: appTheme.darkMode ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
    infoBorder: appTheme.darkMode ? 'rgba(96, 165, 250, 0.30)' : '#bfdbfe',
    infoText: appTheme.darkMode ? '#BFDBFE' : '#1d4ed8',
  }), [appTheme]);
}

function rel(from?: string | null, now = new Date()): string {
  if (!from) return '-';
  const date = new Date(from);
  if (Number.isNaN(date.getTime())) return '-';
  const seconds = Math.max(1, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function fmtDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(value: number | undefined, ccy = 'AED'): string {
  const amount = Number(value || 0);
  if (amount >= 1_000_000) return `${ccy} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${ccy} ${(amount / 1_000).toFixed(1)}K`;
  return `${ccy} ${Math.round(amount)}`;
}

function titleCase(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function scoreLabel(value?: number) {
  if (value == null) return '-';
  return String(Math.round(value * 100));
}

function getStageLabel(stage: { key: string; label?: string } | string) {
  const key = typeof stage === 'string' ? stage : stage.key;
  return STAGE_LABEL[key] || (typeof stage === 'string' ? titleCase(stage) : stage.label || titleCase(key));
}

function payloadPreview(payload?: Record<string, unknown>) {
  if (!payload || !Object.keys(payload).length) return '';
  const preview = payload.preview || payload.subject || payload.message || payload.note || payload.role || payload.round;
  if (preview) return String(preview);
  return JSON.stringify(payload).slice(0, 120);
}

export default function CRMScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCrmPalette();
  const { width } = useWindowDimensions();
  const isPhone = width < 480;
  const isCompact = width < 720;
  const horizontalPadding = isPhone ? Theme.spacing.lg : isCompact ? Theme.spacing.xl : Theme.spacing.xl;
  const pageTopPadding = isPhone ? Theme.spacing.lg : Theme.spacing.xl;
  const bottomPadding = insets.bottom + (isPhone ? 104 : 112);
  const contentMaxWidth = width >= 1120 ? 1280 : undefined;
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const columnWidth = isPhone
    ? Math.max(288, width - horizontalPadding * 2)
    : isCompact
      ? Math.min(380, Math.max(320, width - horizontalPadding * 2))
      : 280;

  const [data, setData] = useState<ProspectCRMData>(() => readScreenCache<CrmScreenCache>(CRM_CACHE_KEY)?.value.data ?? EMPTY_DATA);
  const [view, setView] = useState<VisibleView>('board');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [loading, setLoading] = useState(() => !readScreenCache<CrmScreenCache>(CRM_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const cached = readScreenCache<CrmScreenCache>(CRM_CACHE_KEY);
    return cached ? new Date(cached.value.lastSyncedAt) : null;
  });
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [events, setEvents] = useState<ProspectEvent[]>([]);
  const [followups, setFollowups] = useState<ProspectFollowup[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const crmPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Silent background refresh every 90 s while the CRM tab is focused
  useFocusEffect(
    useCallback(() => {
      crmPollRef.current = setInterval(() => {
        fetchProspectCRMData({ limit: 200 })
          .then((next) => {
            setData(next);
            const syncedAt = Date.now();
            setLastSyncedAt(new Date(syncedAt));
            writeScreenCache(CRM_CACHE_KEY, { data: next, lastSyncedAt: syncedAt });
          })
          .catch(() => { /* silent */ });
      }, 90_000);
      return () => {
        if (crmPollRef.current) {
          clearInterval(crmPollRef.current);
          crmPollRef.current = null;
        }
      };
    }, []),
  );

  const openProfile = useCallback((contact: CrmContact) => {
    const source = String(contact.raw.crm_source || contact.raw.backend_source || contact.source || '');
    const sourceQuery = source ? `?source=${encodeURIComponent(source)}` : '';
    router.push(`/crm/${encodeURIComponent(contact.id)}${sourceQuery}` as never);
  }, [router]);

  const loadCRM = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const next = await fetchProspectCRMData({ limit: 200 });
      setData(next);
      const syncedAt = Date.now();
      setLastSyncedAt(new Date(syncedAt));
      writeScreenCache(CRM_CACHE_KEY, { data: next, lastSyncedAt: syncedAt });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load prospects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      void loadCRM();
    }
  }, [loadCRM, loading]);

  const baseRows = useMemo(() => {
    if (view === 'prospects') return data.contacts.filter((contact) => contact.type === 'prospect');
    if (view === 'leads') return data.contacts.filter((contact) => contact.type === 'lead');
    if (view === 'clients') return data.contacts.filter((contact) => contact.type === 'client');
    return data.contacts;
  }, [data.contacts, view]);

  const tableRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return baseRows.filter((contact) => {
      const matchesQuery = !normalized || [
        contact.name,
        contact.title,
        contact.company,
        contact.email,
        contact.phone,
        contact.source,
        contact.ownerName,
        contact.stage,
        contact.geo,
      ].some((item) => String(item || '').toLowerCase().includes(normalized));

      const matchesType = view !== 'all' || typeFilter === 'all' || contact.type === typeFilter;
      const matchesStage = view !== 'leads' || stageFilter === 'all' || contact.stage === stageFilter;
      return matchesQuery && matchesType && matchesStage;
    });
  }, [baseRows, query, stageFilter, typeFilter, view]);

  useEffect(() => {
    if (!selectedContact) return;
    let mounted = true;

    const loadDetails = async () => {
      setDetailLoading(true);
      try {
        const [prospect, nextEvents, nextFollowups] = await Promise.all([
          getProspect(selectedContact.id, {
            source: String(selectedContact.raw.crm_source || selectedContact.raw.backend_source || selectedContact.source || ''),
            snapshot: selectedContact.raw,
          }).catch(() => null),
          listProspectEvents(selectedContact.id, {
            limit: 100,
            source: String(selectedContact.raw.crm_source || selectedContact.raw.backend_source || selectedContact.source || ''),
          }).catch(() => []),
          getProspectFollowups(selectedContact.id).catch(() => []),
        ]);

        if (!mounted) return;
        if (prospect) setSelectedContact(toCrmContact(prospect));
        setEvents(nextEvents);
        setFollowups(nextFollowups);
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    void loadDetails();
    return () => {
      mounted = false;
    };
  }, [selectedContact?.id]);

  const refreshSelected = async (contact: CrmContact) => {
    const prospect = await getProspect(contact.id, {
      source: String(contact.raw.crm_source || contact.raw.backend_source || contact.source || ''),
      snapshot: contact.raw,
    });
    const updated = toCrmContact(prospect);
    setSelectedContact(updated);
    setData((current) => {
      const contacts = current.contacts.map((item) => item.id === updated.id ? updated : item);
      return {
        prospects: current.prospects.map((item) => item.id === prospect.id ? prospect : item),
        contacts,
        kanbanLeads: current.kanbanLeads.map((lead) => lead.id === updated.id ? { ...lead, contact: updated } : lead),
        counts: buildCounts(contacts),
      };
    });
  };

  const confirmRemove = (contact: CrmContact) => {
    const run = async () => {
      setBusyAction('remove');
      try {
        await deleteProspect(contact.id, 'not_a_fit');
        setSelectedContact(null);
        setData((current) => {
          const contacts = current.contacts.filter((item) => item.id !== contact.id);
          return {
            prospects: current.prospects.filter((item) => item.id !== contact.id),
            contacts,
            kanbanLeads: current.kanbanLeads.filter((item) => item.id !== contact.id),
            counts: buildCounts(contacts),
          };
        });
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : 'Unable to remove contact.');
      } finally {
        setBusyAction(null);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Remove ${contact.name} as not a fit?`)) void run();
      return;
    }

    Alert.alert('Remove contact', `Remove ${contact.name} as not a fit?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run() },
    ]);
  };

  const handleProspectAction = async (contact: CrmContact, action: 'pause' | 'suppress' | 'enrich' | 'assign', assigneeId?: string) => {
    setBusyAction(action);
    try {
      if (action === 'pause') {
        await prospectAction(contact.id, { quietDays: 7 });
      } else if (action === 'suppress') {
        await prospectAction(contact.id, { doNotContact: true });
      } else if (action === 'assign' && assigneeId) {
        await assignCRMLeadsToUser(assigneeId, [contact.id]);
      } else if (action === 'enrich') {
        await enrichProspect(contact.id);
      }
      await refreshSelected(contact);
      void loadCRM(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update contact.');
    } finally {
      setBusyAction(null);
    }
  };

  const exportRows = async () => {
    const rows = [
      ['Name', 'Type', 'Source', 'Company', 'Title', 'Email', 'Phone', 'Stage', 'Fit', 'Owner', 'Last Activity'],
      ...tableRows.map((contact) => [
        contact.name,
        contact.type,
        contact.source,
        contact.company,
        contact.title,
        contact.email || '',
        contact.phone || '',
        contact.stage,
        scoreLabel(contact.fit),
        contact.ownerName || '',
        contact.lastActivityAt || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crm-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    await Share.share({ title: 'CRM prospects export', message: csv });
  };

  const lastSynced = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';

  return (
    <AnimatedScreen style={[styles.container, { paddingTop: insets.top, backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: pageTopPadding,
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomPadding,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCRM(true)} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.pageHeader}>
          <View style={styles.titleRow}>
            <TrendingUp color={palette.icon} size={isCompact ? 25 : 30} />
            <View style={styles.titleText}>
              <Typography variant={isCompact ? 'h2' : 'h1'} color={palette.text} style={styles.pageTitle}>
                Deals Pipeline
              </Typography>
              <Typography variant="bodySmall" color={palette.muted}>
                Live cross-channel prospects from the Master Agent
              </Typography>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => void loadCRM(true)}
            activeOpacity={0.78}
            style={[styles.refreshButton, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}
          >
            {refreshing ? <ActivityIndicator color={palette.primary} size="small" /> : <RefreshCw color={palette.primaryText} size={18} />}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: palette.errorBg, borderColor: palette.errorBorder }]}>
            <Typography variant="bodySmall" color={palette.errorText}>{error}</Typography>
          </View>
        ) : null}

        <StatsCards
          counts={data.counts}
          selected={view}
          isPending={false}
          onSelect={(next) => setView(view === next ? 'board' : next)}
        />

        <ViewPills
          view={view}
          onChange={(next) => setView(next)}
          compact={isCompact}
          isPending={false}
        />

        {loading ? (
          <View style={{ gap: 16 }}>
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
          </View>
        ) : data.contacts.length === 0 && !error ? (
          <View style={[styles.emptyBox, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
            <Inbox color={palette.disabled} size={26} />
            <Typography variant="bodySmall" color={palette.muted} align="center">
              No prospects yet. As channel events flow into the Master Agent, they will appear here.
            </Typography>
          </View>
        ) : view === 'board' ? (
          <KanbanBoard
            leads={data.kanbanLeads}
            selectedId={selectedContact?.id ?? null}
            columnWidth={columnWidth}
            compact={isCompact}
            onSelect={(lead) => openProfile(lead.contact)}
          />
        ) : (
          <ContactList
            view={view}
            rows={tableRows}
            totalCount={baseRows.length}
            query={query}
            setQuery={setQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            onSelect={openProfile}
            onRemove={confirmRemove}
            onExport={() => void exportRows()}
          />
        )}

        <View style={styles.footer}>
          <Typography variant="caption" color={palette.disabled}>
            {data.counts.all} contacts - {data.counts.leads} active deals - {data.counts.clients} clients
          </Typography>
          <Typography variant="caption" color={palette.disabled}>
            Mr LAD - Master Agent - synced {lastSynced}
          </Typography>
        </View>
      </ScrollView>

      <ProspectDetailModal
        visible={Boolean(selectedContact)}
        contact={selectedContact}
        events={events}
        followups={followups}
        loading={detailLoading}
        busyAction={busyAction}
        onClose={() => setSelectedContact(null)}
        onRemove={confirmRemove}
        onAction={handleProspectAction}
      />
    </AnimatedScreen>
  );
}

function StatsCards({
  counts,
  selected,
  onSelect,
  isPending = false,
}: {
  counts: ProspectCRMData['counts'];
  selected: VisibleView;
  onSelect: (key: Exclude<VisibleView, 'board'>) => void;
  isPending?: boolean;
}) {
  const palette = useCrmPalette();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const mobileBasis = '48%' as const;
  const cards: Array<{ key: Exclude<VisibleView, 'board'>; title: string; value: number; Icon: IconComponent; bg: string; color: string }> = [
    { key: 'all', title: 'All Contacts', value: counts.all, Icon: Users, bg: '#dbeafe', color: T.primary },
    { key: 'prospects', title: 'Prospects', value: counts.prospects, Icon: Sparkles, bg: '#e0e7ff', color: T.primary },
    { key: 'leads', title: 'Leads', value: counts.leads, Icon: TrendingUp, bg: '#e0f2fe', color: '#0369a1' },
    { key: 'clients', title: 'Clients', value: counts.clients, Icon: BadgeCheck, bg: '#ecfdf5', color: '#059669' },
  ];

  return (
    <View style={[styles.statsGrid, isPending && { opacity: 0.75 }]}>
      {cards.map((card) => {
        const Icon = card.Icon;
        const active = selected === card.key;
        return (
          <TouchableOpacity
            key={card.key}
            activeOpacity={0.82}
            onPress={() => onSelect(card.key)}
            disabled={isPending}
            style={[
              styles.statCard,
              { backgroundColor: palette.surfaceElevated, borderColor: active ? palette.primary : palette.border },
              isMobile && [styles.statCardMobile, { flexBasis: mobileBasis }],
              !isMobile && styles.statCardDesktop,
              active && [styles.statCardActive, { shadowColor: palette.primary }],
            ]}
          >
            <View style={styles.statIconWrap}>
              <View style={[styles.statIcon, isMobile && styles.statIconMobile, { backgroundColor: card.bg }]}>
                <Icon color={card.color} size={isMobile ? 24 : 25} />
              </View>
            </View>
            <View style={styles.statBottom}>
              <Typography variant="caption" color={palette.muted}>{card.title}</Typography>
              <Typography variant="h2" color={palette.text} style={styles.statValue}>{card.value}</Typography>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ViewPills({
  view,
  onChange,
  compact,
  isPending = false,
}: {
  view: VisibleView;
  onChange: (view: VisibleView) => void;
  compact: boolean;
  isPending?: boolean;
}) {
  const palette = useCrmPalette();
  const pills = VIEW_DEFS.map((definition) => {
    const Icon = definition.Icon;
    const active = view === definition.key;
    return (
      <TouchableOpacity
        key={definition.key}
        activeOpacity={0.78}
        onPress={() => onChange(definition.key)}
        disabled={isPending}
        style={[styles.viewPill, compact && styles.viewPillCompact, active && styles.viewPillActive, isPending && { opacity: 0.7 }]}
      >
        <Icon color={active ? '#fff' : palette.primaryText} size={compact ? 12 : 14} />
        <Typography variant="caption" color={active ? '#fff' : palette.primaryText} style={styles.viewPillText}>
          {definition.label}
        </Typography>
      </TouchableOpacity>
    );
  });

  if (compact) {
    return (
      <View style={[styles.viewHeader, styles.viewHeaderCompact]}>
        <Typography variant="caption" color={palette.muted} style={[styles.viewLabel, styles.viewLabelCompact]}>
          VIEW
        </Typography>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.pillScroll, styles.pillScrollCompact]}
          contentContainerStyle={[styles.pillWrap, styles.pillWrapCompact, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}
        >
          {pills}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.viewHeader}>
      <View style={styles.viewLeft}>
        <Typography variant="caption" color={palette.muted} style={styles.viewLabel}>VIEW</Typography>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={[styles.pillWrap, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}
        >
          {pills}
        </ScrollView>
      </View>
      <Typography
        variant="caption"
        color={palette.muted}
        style={styles.clickHint}
        numberOfLines={1}
      >
        {`Click any row to open the contact's profile`}
      </Typography>
    </View>
  );
}

function KanbanBoard({
  leads,
  selectedId,
  columnWidth,
  compact,
  onSelect,
}: {
  leads: KanbanLead[];
  selectedId: string | null;
  columnWidth: number;
  compact: boolean;
  onSelect: (lead: KanbanLead) => void;
}) {
  const palette = useCrmPalette();
  const [activeStageKey, setActiveStageKey] = useState(CRM_STAGES[0]?.key ?? 'new');
  const visibleStages = compact ? CRM_STAGES.filter((stage) => stage.key === activeStageKey) : CRM_STAGES;

  return (
    <View style={styles.boardWrap}>
      {compact ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stageTabScroller}
          contentContainerStyle={styles.stageTabRow}
        >
          {CRM_STAGES.map((stage) => {
            const active = activeStageKey === stage.key;
            const count = leads.filter((lead) => lead.stageKey === stage.key).length;
            const color = STAGE_COLOR[stage.key] || T.primary;
            return (
              <TouchableOpacity
                key={stage.key}
                activeOpacity={0.78}
                onPress={() => setActiveStageKey(stage.key)}
                style={[
                  styles.stageTab,
                  { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
                  active && [styles.stageTabActive, { backgroundColor: color, borderColor: color }],
                ]}
              >
                <Typography variant="caption" color={active ? '#fff' : palette.primaryText} style={styles.stageTabText}>
                  {getStageLabel(stage)}
                </Typography>
                <View style={[styles.stageTabCount, { backgroundColor: active ? '#fff' : palette.neutralPill }, active && styles.stageTabCountActive]}>
                  <Typography variant="caption" color={active ? color : palette.muted} style={styles.stageTabCountText}>
                    {count}
                  </Typography>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal={!compact}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!compact}
        contentContainerStyle={[styles.boardScroller, compact && styles.boardScrollerCompact]}
      >
        {visibleStages.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.stageKey === stage.key);
          const pipelineValue = stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
          return (
            <View key={stage.key} style={[styles.boardColumn, { width: columnWidth, backgroundColor: palette.softSurface }]}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleRow}>
                  <Typography variant="bodyLarge" color={palette.primaryText} style={styles.columnTitle} numberOfLines={1}>
                    {getStageLabel(stage)}
                  </Typography>
                  <View style={[styles.countPill, { backgroundColor: palette.badgeBg }]}>
                    <Typography variant="caption" color={palette.primaryText} style={styles.countText}>{stageLeads.length}</Typography>
                  </View>
                </View>
                <TouchableOpacity activeOpacity={0.76} style={styles.columnAdd}>
                  <Plus color={palette.disabled} size={16} />
                </TouchableOpacity>
              </View>
              <Typography variant="caption" color={palette.muted} style={styles.pipelineValue}>
                {fmtCurrency(pipelineValue)} pipeline
              </Typography>
              <View style={styles.stageCards}>
                {stageLeads.length ? stageLeads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} selected={selectedId === lead.id} onPress={() => onSelect(lead)} />
                )) : (
                  <View style={[styles.noDealsBox, { borderColor: palette.border }]}>
                    <Typography variant="caption" color={palette.disabled}>No deals here</Typography>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function KanbanCard({ lead, selected, onPress }: { lead: KanbanLead; selected: boolean; onPress: () => void }) {
  const palette = useCrmPalette();
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={[
        styles.leadCard,
        { backgroundColor: palette.surfaceElevated, borderColor: selected ? palette.primary : palette.border },
        selected && styles.leadCardSelected,
      ]}
    >
      <View style={styles.leadCardTop}>
        <Avatar name={lead.name} initials={lead.initials} tone={lead.tone} size={40} />
        <View style={styles.leadCardText}>
          <View style={styles.leadNameRow}>
            <Typography variant="bodySmall" color={palette.primaryText} style={styles.rowName} numberOfLines={1}>
              {lead.name}
            </Typography>
            <Typography variant="caption" color={palette.primary} style={styles.moneyText}>{fmtCurrency(lead.value)}</Typography>
          </View>
          <Typography variant="caption" color={palette.muted} numberOfLines={1}>{lead.company || 'No company'}</Typography>
        </View>
      </View>
      <View style={styles.leadCardBottom}>
        <ChannelChips channels={lead.channels} />
        <View style={styles.cardScoreRow}>
          <View style={[styles.scoreMini, { backgroundColor: palette.badgeBg }]}>
            <Sparkles color={palette.primary} size={12} />
            <Typography variant="caption" color={palette.primaryText} style={styles.scoreText}>{scoreLabel(lead.fit)}</Typography>
          </View>
          <Typography variant="caption" color={palette.disabled}>{rel(lead.lastAt)}</Typography>
        </View>
      </View>
      {lead.warmPath ? (
        <View style={styles.warmPathLine}>
          <Route color={palette.primary} size={13} />
          <Typography variant="caption" color={palette.primary} style={styles.warmPathText}>Warm via {lead.warmPath}</Typography>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ContactList({
  view,
  rows,
  totalCount,
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  stageFilter,
  setStageFilter,
  onSelect,
  onRemove,
  onExport,
}: {
  view: Exclude<VisibleView, 'board'>;
  rows: CrmContact[];
  totalCount: number;
  query: string;
  setQuery: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  stageFilter: string;
  setStageFilter: (value: string) => void;
  onSelect: (contact: CrmContact) => void;
  onRemove: (contact: CrmContact) => void;
  onExport: () => void;
}) {
  const palette = useCrmPalette();
  const title = view === 'all' ? 'All Contacts' : view === 'prospects' ? 'Prospects' : view === 'leads' ? 'Leads' : 'Clients';
  const subtitle = view === 'prospects'
    ? 'Top-of-funnel contacts sourced from Apollo, LinkedIn Sales Nav, imports, or referrals.'
    : view === 'leads'
      ? `Pipeline: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.value || 0), 0))} - Weighted: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.value || 0) * (row.probability || 0), 0))}`
      : view === 'clients'
        ? `MRR: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.mrr || 0), 0), 'USD')} - ARR: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.mrr || 0), 0) * 12, 'USD')}`
        : 'Every contact in this tenant: imported, prospected, inbound, and customer.';

  return (
    <View style={[styles.tableShell, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
      <View style={[styles.tableHeader, { borderBottomColor: palette.borderSoft }]}>
        <View style={styles.tableTitleBlock}>
          <View style={styles.tableTitleRow}>
            <Typography variant="bodyLarge" color={palette.primaryText} style={styles.tableTitle}>{title}</Typography>
            <View style={[styles.countPill, { backgroundColor: palette.badgeBg }]}>
              <Typography variant="caption" color={palette.primaryText} style={styles.countText}>
                {rows.length}{rows.length !== totalCount ? ` / ${totalCount}` : ''}
              </Typography>
            </View>
          </View>
          <Typography variant="caption" color={palette.muted}>{subtitle}</Typography>
        </View>
        <View style={styles.tableActions}>
          <TouchableOpacity onPress={onExport} activeOpacity={0.78} style={[styles.tableActionButton, { borderColor: palette.border }]}>
            <Download color={palette.primaryText} size={15} />
            <Typography variant="caption" color={palette.primaryText} style={styles.tableActionText}>Export</Typography>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: palette.input, borderColor: palette.border }]}>
        <Search color={palette.disabled} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search..."
          placeholderTextColor={palette.disabled}
          style={[styles.searchInput, WEB_INPUT_RESET, { color: palette.text }]}
        />
      </View>

      {view === 'all' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'prospect', 'lead', 'client', 'imported', 'inbound'].map((type) => (
            <FilterChip
              key={type}
              label={type === 'all' ? 'Type: All' : TYPE_META[type]?.label || titleCase(type)}
              active={typeFilter === type}
              onPress={() => setTypeFilter(type)}
            />
          ))}
        </ScrollView>
      ) : null}

      {view === 'leads' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'contacted', 'engaged', 'qualified', 'sah'].map((stage) => (
            <FilterChip
              key={stage}
              label={stage === 'all' ? 'Stage: All' : STAGE_LABEL[stage] || titleCase(stage)}
              active={stageFilter === stage}
              onPress={() => setStageFilter(stage)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.rowsWrap}>
        {rows.length ? rows.map((contact) => (
          <ContactRow
            key={contact.id}
            view={view}
            contact={contact}
            onPress={() => onSelect(contact)}
            onRemove={() => onRemove(contact)}
          />
        )) : (
          <View style={styles.noMatches}>
            <Inbox color={palette.disabled} size={24} />
            <Typography variant="bodySmall" color={palette.muted}>No matches.</Typography>
          </View>
        )}
      </View>

      <View style={[styles.tableFooter, { borderTopColor: palette.borderSoft }]}>
        <Typography variant="caption" color={palette.muted}>
          Showing <Typography variant="caption" color={palette.primaryText} style={styles.boldText}>{rows.length}</Typography> of {totalCount}
        </Typography>
        <Typography variant="caption" color={palette.primaryText} style={styles.tableActionText}>Page 1 of 1</Typography>
      </View>
    </View>
  );
}

function ContactRow({
  view,
  contact,
  onPress,
  onRemove,
}: {
  view: Exclude<VisibleView, 'board'>;
  contact: CrmContact;
  onPress: () => void;
  onRemove: () => void;
}) {
  const palette = useCrmPalette();
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.contactRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={styles.contactTop}>
        <View style={styles.contactIdentity}>
          <Avatar name={contact.name} initials={contact.initials} size={34} />
          <View style={styles.contactNameBlock}>
            <Typography variant="bodySmall" color={palette.primaryText} style={styles.rowName} numberOfLines={1}>{contact.name}</Typography>
            <Typography variant="caption" color={palette.muted} numberOfLines={1}>
              {view === 'all' ? contact.title : `${contact.title || '-'} - ${contact.company || 'No company'}`}
            </Typography>
          </View>
        </View>
        <View style={styles.rowRight}>
          {view === 'all' ? <TypePill type={contact.type} /> : <StagePill stage={contact.stage} />}
          <TouchableOpacity activeOpacity={0.78} onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.rowIconButton}>
            <Trash2 color={palette.errorText} size={15} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.rowDetails}>
        {view === 'prospects' ? (
          <>
            <DetailPair label="Fit" value={scoreLabel(contact.fit)} />
            <DetailPair label="Intent" value={`${contact.intentSignals ?? 0} signals`} />
            <DetailPair label="Warm path" value={contact.warmPath || '-'} />
            <DetailPair label="Source" value={titleCase(contact.source)} />
          </>
        ) : view === 'leads' ? (
          <>
            <DetailPair label="Value" value={fmtCurrency(contact.value)} />
            <DetailPair label="Probability" value={scoreLabel(contact.probability)} />
            <DetailPair label="Weighted" value={fmtCurrency((contact.value || 0) * (contact.probability || 0))} />
            <DetailPair label="Next step" value={contact.nextStep || '-'} />
          </>
        ) : view === 'clients' ? (
          <>
            <DetailPair label="Plan" value={contact.plan || '-'} />
            <DetailPair label="MRR" value={fmtCurrency(contact.mrr, 'USD')} />
            <DetailPair label="Health" value={contact.health == null ? '-' : `${contact.health}`} />
            <DetailPair label="Renewal" value={fmtDate(contact.renewalDate)} />
          </>
        ) : (
          <>
            <DetailPair label="Source" value={titleCase(contact.source)} />
            <DetailPair label="Company" value={contact.company || '-'} />
            <DetailPair label="Email" value={contact.email || '-'} />
            <DetailPair label="Phone" value={contact.phone || '-'} />
          </>
        )}
      </View>

      <View style={[styles.rowMeta, { borderTopColor: palette.borderSoft }]}>
        <ChannelChips channels={contact.channels} />
        <Typography variant="caption" color={palette.muted}>
          Owner: {contact.ownerName || 'Unassigned'}
        </Typography>
        <Typography variant="caption" color={palette.muted}>
          {contact.lastActivityAt ? `${rel(contact.lastActivityAt)} ago` : 'No activity'}
        </Typography>
        <ChevronRight color={palette.disabled} size={16} />
      </View>
    </TouchableOpacity>
  );
}

function ProspectDetailModal({
  visible,
  contact,
  events,
  followups,
  loading,
  busyAction,
  onClose,
  onRemove,
  onAction,
}: {
  visible: boolean;
  contact: CrmContact | null;
  events: ProspectEvent[];
  followups: ProspectFollowup[];
  loading: boolean;
  busyAction: string | null;
  onClose: () => void;
  onRemove: (contact: CrmContact) => void;
  onAction: (contact: CrmContact, action: 'pause' | 'suppress' | 'enrich' | 'assign', assigneeId?: string) => void;
}) {
  const palette = useCrmPalette();
  const [assignSheetVisible, setAssignSheetVisible] = useState(false);
  if (!contact) return null;
  const raw = contact.raw;

  const openLink = (url: string) => {
    if (!url || url === '-') return;
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.detailSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.borderSoft }]}>
            <View style={styles.modalIdentity}>
              <Avatar name={contact.name} initials={contact.initials} tone={STAGE_COLOR[contact.stage] || T.primary} size={42} />
              <View style={styles.modalTitleBlock}>
                <Typography variant="h3" color={palette.primaryText} numberOfLines={1}>{contact.name}</Typography>
                <Typography variant="caption" color={palette.muted} numberOfLines={1}>
                  {contact.title || 'Prospect'} - {contact.company || 'No company'}
                </Typography>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.76} style={[styles.closeButton, { backgroundColor: palette.softSurface }]}>
              <X color={palette.primaryText} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.detailHero, { backgroundColor: palette.softSurface, borderColor: palette.border }]}>
              <View style={styles.detailPills}>
                <TypePill type={contact.type} />
                <StagePill stage={contact.stage} />
                {raw.do_not_contact ? <StatusBadge label="Do not contact" color="#be123c" bg="#ffe4e6" /> : null}
                {raw.quiet_until ? <StatusBadge label={`Quiet until ${fmtDate(raw.quiet_until)}`} color="#a16207" bg="#fef3c7" /> : null}
              </View>
              <View style={styles.kpiGrid}>
                <KpiTile label="Fit score" value={scoreLabel(contact.fit)} />
                <KpiTile label="Intent" value={`${contact.intentSignals ?? 0}`} />
                <KpiTile label="Last touch" value={contact.lastActivityAt ? rel(contact.lastActivityAt) : '-'} />
                <KpiTile label="Source" value={titleCase(contact.source)} />
              </View>
            </View>

            <Section title="Contact">
              <InfoLine icon={Mail} label="Email" value={contact.email || '-'} verified={contact.emailVerified} onPress={contact.email ? () => openLink(`mailto:${contact.email}`) : undefined} />
              <InfoLine icon={Phone} label="Phone" value={contact.phone || '-'} verified={contact.phoneVerified} onPress={contact.phone ? () => openLink(`tel:${contact.phone}`) : undefined} />
              <InfoLine icon={ExternalLink} label="LinkedIn" value={String(raw.linkedin_url || '-')} onPress={raw.linkedin_url ? () => openLink(String(raw.linkedin_url)) : undefined} />
              <InfoLine icon={Users} label="Owner" value={contact.ownerName || 'Unassigned'} onPress={() => setAssignSheetVisible(true)} actionLabel="Assign" />
              <InfoLine icon={Route} label="Warm path" value={contact.warmPath || '-'} />
            </Section>

            <Section title="Engagement">
              <View style={styles.channelDetailRow}>
                <ChannelChips channels={contact.channels} />
                <Typography variant="caption" color={palette.muted}>
                  Last channel: {titleCase(String(raw.last_channel || 'system'))}
                </Typography>
              </View>
              {Object.entries(raw.channel_rollups || {}).map(([channel, rollup]) => {
                const record = rollup && typeof rollup === 'object' ? rollup as Record<string, unknown> : {};
                const eventCounts = Object.values((record.events_by_type as Record<string, unknown>) || {});
                const count = typeof record.count === 'number'
                  ? record.count
                  : eventCounts.reduce<number>((sum, value) => sum + Number(value || 0), 0);
                return (
                  <View key={channel} style={styles.rollupRow}>
                    <Typography variant="caption" color={palette.primaryText} style={styles.rollupChannel}>{titleCase(channel)}</Typography>
                    <Typography variant="caption" color={palette.muted}>{count} events</Typography>
                    <Typography variant="caption" color={palette.muted}>{fmtDateTime(String(record.last_event_at || ''))}</Typography>
                  </View>
                );
              })}
            </Section>

            <Section title="Qualification">
              <DetailPair label="Lifecycle stage" value={STAGE_LABEL[contact.stage] || titleCase(contact.stage)} />
              <DetailPair label="Network distance" value={String(raw.network_distance || '-')} />
              <DetailPair label="Mutual connections" value={raw.mutual_connections_count == null ? '-' : String(raw.mutual_connections_count)} />
              <DetailPair label="Enrichment" value={String(raw.enrichment_status || raw.profile_enrichment_source || '-')} />
            </Section>

            <Section title="Scheduled follow-ups">
              {loading ? <ActivityIndicator color={palette.primary} /> : null}
              {followups.length ? followups.map((followup) => (
                <View key={followup.id} style={styles.followupRow}>
                  <Clock color={palette.primary} size={15} />
                  <View style={styles.followupText}>
                    <Typography variant="caption" color={palette.primaryText} style={styles.boldText}>
                      {titleCase(followup.channel || 'channel')} - {titleCase(followup.type || 'follow-up')}
                    </Typography>
                    <Typography variant="caption" color={palette.muted}>
                      {fmtDateTime(followup.scheduled_time)} - attempt {followup.attempt ?? '-'}
                    </Typography>
                  </View>
                </View>
              )) : (
                <Typography variant="caption" color={palette.muted}>No upcoming follow-ups.</Typography>
              )}
            </Section>

            <Section title="Activity timeline">
              {loading ? <ActivityIndicator color={palette.primary} /> : null}
              {events.length ? events.map((event) => (
                <View key={`${event.seq}-${event.occurred_at}`} style={styles.eventRow}>
                  <ChannelDot channel={String(event.channel)} />
                  <View style={styles.eventText}>
                    <Typography variant="caption" color={palette.primaryText} style={styles.boldText}>
                      {titleCase(event.event_type)}
                    </Typography>
                    <Typography variant="caption" color={palette.muted}>
                      {titleCase(String(event.direction || 'system'))} - {fmtDateTime(event.occurred_at)}
                    </Typography>
                    {payloadPreview(event.payload) ? (
                      <Typography variant="caption" color={palette.muted}>{payloadPreview(event.payload)}</Typography>
                    ) : null}
                  </View>
                </View>
              )) : (
                <Typography variant="caption" color={palette.muted}>No activity yet.</Typography>
              )}
            </Section>

            <Section title="Actions">
              <View style={styles.actionGrid}>
                <ActionButton
                  icon={Sparkles}
                  label="Enrich profile"
                  busy={busyAction === 'enrich'}
                  onPress={() => onAction(contact, 'enrich')}
                />
                <ActionButton
                  icon={UserPlus}
                  label="Assign"
                  busy={busyAction === 'assign'}
                  onPress={() => setAssignSheetVisible(true)}
                />
                <ActionButton
                  icon={ShieldMinus}
                  label="Pause 7 days"
                  busy={busyAction === 'pause'}
                  onPress={() => onAction(contact, 'pause')}
                />
                <ActionButton
                  icon={Ban}
                  label="Do not contact"
                  danger
                  busy={busyAction === 'suppress'}
                  onPress={() => onAction(contact, 'suppress')}
                />
                <ActionButton
                  icon={Trash2}
                  label="Not a fit"
                  danger
                  busy={busyAction === 'remove'}
                  onPress={() => onRemove(contact)}
                />
              </View>
            </Section>
          </ScrollView>
        </View>
      </View>
      <AssignMemberSheet
        visible={assignSheetVisible}
        contactId={contact.id}
        contactName={contact.name}
        onClose={() => setAssignSheetVisible(false)}
        onAssigned={(member) => {
          setAssignSheetVisible(false);
          onAction(contact, 'assign', member.id);
        }}
      />
    </Modal>
  );
}

function Avatar({ name, initials, tone, size = 28 }: { name?: string; initials?: string; tone?: string; size?: number }) {
  const display = initials || (name ? initialsOf(name) : '?');
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone || T.primary,
        },
      ]}
    >
      <Typography variant="caption" color="#fff" style={[styles.avatarText, { fontSize: Math.max(10, size * 0.34) }]}>
        {display}
      </Typography>
    </View>
  );
}

function ChannelChips({ channels }: { channels?: ChannelKey[] }) {
  const palette = useCrmPalette();
  if (!channels?.length) {
    return <Typography variant="caption" color={palette.disabled}>-</Typography>;
  }
  return (
    <View style={styles.channelChips}>
      {channels.map((channel) => (
        <ChannelDot key={channel} channel={channel} />
      ))}
    </View>
  );
}

function ChannelDot({ channel }: { channel: string }) {
  const meta = CHANNELS[channel] || CHANNELS.system;
  const Icon = meta.Icon;
  return (
    <View style={[styles.channelDot, { backgroundColor: `${meta.color}1a` }]}>
      <Icon color={meta.color} size={12} />
    </View>
  );
}

function TypePill({ type }: { type: string }) {
  const meta = TYPE_META[type] || TYPE_META.imported;
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Typography variant="caption" color={meta.color} style={styles.pillText}>{meta.label}</Typography>
    </View>
  );
}

function StagePill({ stage }: { stage?: string }) {
  const palette = useCrmPalette();
  if (!stage) return <Typography variant="caption" color={palette.disabled}>-</Typography>;
  const color = STAGE_COLOR[stage] || '#64748b';
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}1a` }]}>
      <View style={[styles.stageDot, { backgroundColor: color }]} />
      <Typography variant="caption" color={color} style={styles.pillText}>{STAGE_LABEL[stage] || titleCase(stage)}</Typography>
    </View>
  );
}

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Typography variant="caption" color={color} style={styles.pillText}>{label}</Typography>
    </View>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  const palette = useCrmPalette();
  return (
    <View style={styles.detailPair}>
      <Typography variant="overline" color={palette.disabled}>{label}</Typography>
      <Typography variant="caption" color={palette.primaryText} numberOfLines={2}>{value || '-'}</Typography>
    </View>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  const palette = useCrmPalette();
  return (
    <View style={[styles.kpiTile, { backgroundColor: palette.surfaceElevated, borderColor: palette.borderSoft }]}>
      <Typography variant="overline" color={palette.disabled}>{label}</Typography>
      <Typography variant="h3" color={palette.primaryText} style={styles.kpiValue}>{value}</Typography>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const palette = useCrmPalette();
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={[styles.filterChip, { borderColor: active ? T.primary : palette.border, backgroundColor: active ? T.primary : palette.surface }, active && styles.filterChipActive]}>
      {active ? <Check color="#fff" size={13} /> : null}
      <Typography variant="caption" color={active ? '#fff' : palette.primaryText} style={styles.tableActionText}>{label}</Typography>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const palette = useCrmPalette();
  return (
    <View style={[styles.detailSection, { borderTopColor: palette.borderSoft, backgroundColor: palette.surfaceElevated }]}>
      <Typography variant="bodySmall" color={palette.primaryText} style={styles.sectionTitle}>{title}</Typography>
      {children}
    </View>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  verified,
  onPress,
  actionLabel,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  verified?: boolean;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const palette = useCrmPalette();
  const inner = (
    <>
      <Icon color={onPress ? palette.primary : palette.icon} size={16} />
      <View style={styles.infoText}>
        <Typography variant="overline" color={palette.disabled}>{label}</Typography>
        <Typography variant="caption" color={onPress ? palette.primary : palette.primaryText} numberOfLines={2}>{value}</Typography>
      </View>
      {verified ? <BadgeCheck color={T.success} size={16} /> : null}
      {actionLabel && !verified ? (
        <View style={[styles.infoActionChip, { backgroundColor: palette.softSurface, borderColor: palette.border }]}>
          <Typography variant="overline" color={palette.primary} style={styles.boldText}>{actionLabel}</Typography>
        </View>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.infoLine, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        {inner}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.infoLine, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {inner}
    </View>
  );
}

function AssignMemberSheet({
  visible,
  contactId,
  contactName,
  onClose,
  onAssigned,
}: {
  visible: boolean;
  contactId: string;
  contactName: string;
  onClose: () => void;
  onAssigned: (member: TeamMember) => void;
}) {
  const palette = useCrmPalette();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    getTeamMembers()
      .then((data) => setMembers(data))
      .catch(() => setError('Unable to load team members.'))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleSelect = async (member: TeamMember) => {
    setBusy(member.id);
    setError(null);
    try {
      await assignCRMLeadsToUser(member.id, [contactId]);
      onAssigned(member);
    } catch {
      setError('Failed to assign. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.assignSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.borderSoft }]}>
            <View style={styles.modalTitleBlock}>
              <Typography variant="h3" color={palette.primaryText}>Assign contact</Typography>
              <Typography variant="caption" color={palette.muted} numberOfLines={1}>Assigning {contactName}</Typography>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.76} style={[styles.closeButton, { backgroundColor: palette.softSurface }]}>
              <X color={palette.primaryText} size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.assignList} showsVerticalScrollIndicator={false}>
            {error ? (
              <Typography variant="caption" color={palette.errorText} style={styles.assignError}>{error}</Typography>
            ) : null}
            {loading ? (
              <ActivityIndicator color={palette.primary} style={styles.assignLoader} />
            ) : members.length === 0 ? (
              <Typography variant="caption" color={palette.muted} style={styles.assignEmpty}>No team members found.</Typography>
            ) : (
              members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  activeOpacity={0.78}
                  disabled={busy === member.id}
                  onPress={() => void handleSelect(member)}
                  style={[styles.assignMemberRow, { borderBottomColor: palette.borderSoft }]}
                >
                  <View style={[styles.assignAvatar, { backgroundColor: T.badgeBg }]}>
                    <Typography variant="caption" color={T.primary} style={styles.boldText}>
                      {initialsOf(member.name)}
                    </Typography>
                  </View>
                  <View style={styles.assignMemberInfo}>
                    <Typography variant="caption" color={palette.primaryText} style={styles.boldText}>{member.name}</Typography>
                    <Typography variant="caption" color={palette.muted}>{member.role}{member.email ? ` · ${member.email}` : ''}</Typography>
                  </View>
                  {busy === member.id ? (
                    <ActivityIndicator color={palette.primary} size="small" />
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionButton({
  icon: Icon,
  label,
  danger,
  busy,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  danger?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const palette = useCrmPalette();
  const actionColor = danger ? palette.errorText : palette.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={busy}
      onPress={onPress}
      style={[
        styles.detailActionButton,
        { backgroundColor: danger ? palette.errorBg : palette.surface, borderColor: danger ? palette.errorBorder : palette.border },
        danger && styles.dangerAction,
      ]}
    >
      {busy ? <ActivityIndicator color={actionColor} size="small" /> : <Icon color={actionColor} size={16} />}
      <Typography variant="caption" color={actionColor} style={styles.tableActionText}>{label}</Typography>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: Theme.spacing.xl,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    fontWeight: '600',
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 8,
    marginBottom: Theme.spacing.xl,
    ...Theme.shadows.small,
  },
  searchPanelTop: {
    padding: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    flexWrap: 'wrap',
  },
  searchCopy: {
    flex: 1,
    minWidth: 240,
  },
  panelTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  runButton: {
    minHeight: 40,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  disabledButton: {
    opacity: 0.62,
  },
  runButtonText: {
    fontWeight: '600',
  },
  maxResultRow: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  maxLabel: {
    fontWeight: '600',
  },
  optionScroller: {
    gap: Theme.spacing.sm,
  },
  optionChip: {
    minHeight: 32,
    minWidth: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.sm,
  },
  optionChipActive: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  optionText: {
    fontWeight: '600',
  },
  runningStrip: {
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: Theme.spacing.md,
  },
  searchErrorStrip: {
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  searchSuccessStrip: {
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchSuccessTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  backendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  backendChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
  },
  backendText: {
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  statCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dbe3ef',
    borderRadius: 20,
    padding: Theme.spacing.lg,
    justifyContent: 'space-between',
  },
  statCardMobile: {
    flexGrow: 1,
    minHeight: 156,
  },
  statCardDesktop: {
    flexGrow: 1,
    flexBasis: 250,
    minHeight: 128,
  },
  statCardActive: {
    borderColor: T.primary,
    shadowColor: T.primary,
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  statIconWrap: {
    alignItems: 'flex-end',
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconMobile: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  statBottom: {
    gap: 3,
  },
  statValue: {
    fontWeight: '600',
  },
  viewHeader: {
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    flexWrap: 'wrap',
  },
  viewHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: Theme.spacing.sm,
    flexWrap: 'nowrap',
    marginBottom: Theme.spacing.md,
  },
  viewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  viewLeftCompact: {
    width: '100%',
    flex: 0,
  },
  viewLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  viewLabelCompact: {
    alignSelf: 'flex-start',
    lineHeight: 16,
  },
  pillScroll: {
    flex: 1,
    minWidth: 0,
  },
  pillScrollCompact: {
    width: '100%',
    maxWidth: '100%',
    flex: 0,
    minHeight: 38,
  },
  pillWrap: {
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 999,
    backgroundColor: '#fff',
    padding: 3,
    gap: 3,
  },
  pillWrapCompact: {
    minHeight: 38,
    alignItems: 'center',
    paddingRight: Theme.spacing.xs,
  },
  viewPill: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewPillCompact: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 7,
    gap: 3,
  },
  viewPillActive: {
    backgroundColor: T.primary,
  },
  viewPillText: {
    fontWeight: '600',
  },
  clickHint: {
    flexShrink: 1,
  },
  clickHintCompact: {
    alignSelf: 'flex-start',
    paddingLeft: 0,
  },
  boardWrap: {
    gap: Theme.spacing.md,
  },
  stageTabScroller: {
    width: '100%',
    maxWidth: '100%',
  },
  stageTabRow: {
    gap: Theme.spacing.sm,
    paddingBottom: 2,
  },
  stageTab: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    backgroundColor: '#fff',
    paddingLeft: Theme.spacing.md,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  stageTabActive: {
    shadowColor: T.primary,
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  stageTabText: {
    fontWeight: '600',
  },
  stageTabCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  stageTabCountActive: {
    backgroundColor: '#fff',
  },
  stageTabCountText: {
    fontWeight: '600',
  },
  boardScroller: {
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    paddingRight: Theme.spacing.md,
  },
  boardScrollerCompact: {
    width: '100%',
    paddingRight: 0,
  },
  boardColumn: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    ...Theme.shadows.small,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  columnTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  columnTitle: {
    fontWeight: '600',
    flexShrink: 1,
  },
  countPill: {
    minHeight: 24,
    minWidth: 26,
    borderRadius: 7,
    backgroundColor: T.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontWeight: '600',
  },
  columnAdd: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineValue: {
    marginBottom: Theme.spacing.xs,
  },
  stageCards: {
    gap: Theme.spacing.sm,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 12,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  leadCardSelected: {
    borderColor: T.primary,
    shadowColor: T.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  leadCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  leadCardText: {
    flex: 1,
    minWidth: 0,
  },
  leadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  rowName: {
    fontWeight: '600',
    flexShrink: 1,
  },
  moneyText: {
    fontWeight: '600',
  },
  leadCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  cardScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  scoreMini: {
    minHeight: 22,
    borderRadius: 6,
    backgroundColor: T.badgeBg,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreText: {
    fontWeight: '600',
  },
  warmPathLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warmPathText: {
    fontWeight: '600',
  },
  noDealsBox: {
    minHeight: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#dbe3ef',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.md,
  },
  tableShell: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    padding: Theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    flexWrap: 'wrap',
  },
  tableTitleBlock: {
    flex: 1,
    minWidth: 240,
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: 3,
  },
  tableTitle: {
    fontWeight: '600',
  },
  tableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  tableActionButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  newButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: T.primary,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  tableActionText: {
    fontWeight: '600',
  },
  searchBox: {
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    color: T.primaryHead,
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  filterChip: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  rowsWrap: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  contactRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  contactTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  contactIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  contactNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: Theme.spacing.xs,
  },
  rowIconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  detailPair: {
    minWidth: 112,
    flexGrow: 1,
    flexBasis: 112,
    gap: 2,
  },
  rowMeta: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  tableFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  noMatches: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '600',
  },
  channelChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  channelDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontWeight: '600',
  },
  footer: {
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    flexWrap: 'wrap',
  },
  errorBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  emptyBox: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  modalIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
    gap: Theme.spacing.lg,
  },
  detailHero: {
    gap: Theme.spacing.md,
    borderWidth: 1,
    borderRadius: 14,
    padding: Theme.spacing.md,
  },
  detailPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  kpiTile: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 74,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: Theme.spacing.md,
    justifyContent: 'space-between',
  },
  kpiValue: {
    fontWeight: '600',
  },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  infoLine: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
  },
  channelDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  rollupRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  rollupChannel: {
    fontWeight: '600',
    minWidth: 86,
  },
  followupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  followupText: {
    flex: 1,
    minWidth: 0,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  eventText: {
    flex: 1,
    minWidth: 0,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  detailActionButton: {
    flexGrow: 1,
    flexBasis: 145,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  dangerAction: {
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
  },
  flexText: {
    flex: 1,
  },
  boldText: {
    fontWeight: '600',
  },
  underlined: {
    textDecorationLine: 'underline',
  },
  infoActionChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  assignSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  assignList: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xxl,
  },
  assignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  assignAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignMemberInfo: {
    flex: 1,
    minWidth: 0,
  },
  assignLoader: {
    marginVertical: Theme.spacing.xl,
  },
  assignEmpty: {
    textAlign: 'center',
    marginVertical: Theme.spacing.xl,
  },
  assignError: {
    marginBottom: Theme.spacing.md,
  },
});
