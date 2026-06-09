import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Users,
  X,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { connectSocket } from '@/src/services/socketService';
import {
  CRM_STAGES,
  ChannelKey,
  CrmContact,
  KanbanLead,
  ProspectCRMData,
  ProspectEvent,
  ProspectFollowup,
  SearchBackendRollup,
  SearchRunResult,
  buildCounts,
  deleteProspect,
  enrichProspect,
  fetchProspectCRMData,
  getProspect,
  getProspectFollowups,
  initialsOf,
  listProspectEvents,
  prospectAction,
  runProspectSearch,
  toCrmContact,
} from '@/src/services/prospectsService';

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

const MAX_RESULTS_OPTIONS = [5, 25, 50, 100, 250, 500];

const LIVE_EVENTS = [
  'prospect.created',
  'prospect.updated',
  'prospect.deleted',
  'prospect:created',
  'prospect:updated',
  'prospects:updated',
  'fit.discovered',
  'fit:discovered',
  'master-agent:prospect',
  'crm:update',
  'crm:updated',
];

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

function friendlySearchError(message: string) {
  if (message === 'no_active_icp') {
    return 'No active ICP found. Define your Ideal Customer Profile first.';
  }
  if (message.toLowerCase().includes('tenant')) {
    return 'Session tenant could not be resolved. Sign in again or check tenant settings.';
  }
  return message;
}

export default function CRMScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [data, setData] = useState<ProspectCRMData>(EMPTY_DATA);
  const [view, setView] = useState<VisibleView>('board');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [events, setEvents] = useState<ProspectEvent[]>([]);
  const [followups, setFollowups] = useState<ProspectFollowup[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(25);
  const [searchRunning, setSearchRunning] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchRunResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const openProfile = useCallback((contact: CrmContact) => {
    router.push(`/crm/${encodeURIComponent(contact.id)}` as never);
  }, [router]);

  const loadCRM = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const next = await fetchProspectCRMData({ limit: 200 });
      setData(next);
      setLastSyncedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load prospects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCRM();
  }, [loadCRM]);

  useEffect(() => {
    const timer = setInterval(() => void loadCRM(true), 20000);
    return () => clearInterval(timer);
  }, [loadCRM]);

  useEffect(() => {
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      const refresh = () => void loadCRM(true);
      LIVE_EVENTS.forEach((event) => socket?.on(event, refresh));
      return () => {
        LIVE_EVENTS.forEach((event) => socket?.off(event, refresh));
      };
    } catch {
      return undefined;
    }
  }, [loadCRM]);

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
          getProspect(selectedContact.id).catch(() => null),
          listProspectEvents(selectedContact.id, { limit: 100 }).catch(() => []),
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
    const prospect = await getProspect(contact.id);
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

  const runSearch = async () => {
    setSearchRunning(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const result = await runProspectSearch({ maxResults, triggeredBy: 'manual' });
      setSearchResult(result);
      setTimeout(() => void loadCRM(true), 1500);
    } catch (searchRunError) {
      setSearchError(searchRunError instanceof Error ? searchRunError.message : 'Search failed.');
    } finally {
      setSearchRunning(false);
    }
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

  const handleProspectAction = async (contact: CrmContact, action: 'pause' | 'suppress' | 'enrich') => {
    setBusyAction(action);
    try {
      if (action === 'pause') {
        await prospectAction(contact.id, { quietDays: 7 });
      } else if (action === 'suppress') {
        await prospectAction(contact.id, { doNotContact: true });
      } else {
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#F8F9FE' }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCRM(true)} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.pageHeader}>
          <View style={styles.titleRow}>
            <TrendingUp color="#1e293b" size={isCompact ? 25 : 30} />
            <View style={styles.titleText}>
              <Typography variant={isCompact ? 'h2' : 'h1'} color="#1e293b" style={styles.pageTitle}>
                Deals Pipeline
              </Typography>
              <Typography variant="bodySmall" color="#56657f">
                Live cross-channel prospects from the Master Agent
              </Typography>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => void loadCRM(true)}
            activeOpacity={0.78}
            style={styles.refreshButton}
          >
            {refreshing ? <ActivityIndicator color={T.primary} size="small" /> : <RefreshCw color={T.primaryHead} size={18} />}
          </TouchableOpacity>
        </View>

        <RunSearchPanel
          maxResults={maxResults}
          setMaxResults={setMaxResults}
          running={searchRunning}
          result={searchResult}
          error={searchError}
          onRun={runSearch}
          onDismiss={() => {
            setSearchError(null);
            setSearchResult(null);
          }}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Typography variant="bodySmall" color="#b45309">{error}</Typography>
          </View>
        ) : null}

        <StatsCards counts={data.counts} selected={view} onSelect={(next) => setView(view === next ? 'board' : next)} />

        <ViewPills view={view} onChange={setView} compact={isCompact} />

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color={T.primary} />
            <Typography variant="bodySmall" color="#64748b">Loading prospects...</Typography>
          </View>
        ) : data.contacts.length === 0 && !error ? (
          <View style={styles.emptyBox}>
            <Inbox color="#94a3b8" size={26} />
            <Typography variant="bodySmall" color="#64748b" align="center">
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
            onNew={() => void runSearch()}
          />
        )}

        <View style={styles.footer}>
          <Typography variant="caption" color="#94a3b8">
            {data.counts.all} contacts - {data.counts.leads} active deals - {data.counts.clients} clients
          </Typography>
          <Typography variant="caption" color="#94a3b8">
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
    </View>
  );
}

function RunSearchPanel({
  maxResults,
  setMaxResults,
  running,
  result,
  error,
  onRun,
  onDismiss,
}: {
  maxResults: number;
  setMaxResults: (value: number) => void;
  running: boolean;
  result: SearchRunResult | null;
  error: string | null;
  onRun: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.searchPanel}>
      <View style={styles.searchPanelTop}>
        <View style={styles.searchCopy}>
          <Typography variant="bodyLarge" color="#020617" style={styles.panelTitle}>
            Discover new prospects
          </Typography>
          <Typography variant="bodySmall" color="#56657f">
            Runs Apollo + Sales Navigator using your active ICP, dedupes, and emits matches to the Master Agent.
          </Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={running}
          onPress={onRun}
          style={[styles.runButton, running && styles.disabledButton]}
        >
          {running ? <ActivityIndicator color="#fff" size="small" /> : null}
          <Typography variant="bodySmall" color="#fff" style={styles.runButtonText}>
            {running ? 'Running' : 'Run search'}
          </Typography>
        </TouchableOpacity>
      </View>

      <View style={styles.maxResultRow}>
        <Typography variant="caption" color="#475569" style={styles.maxLabel}>Max results</Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionScroller}>
          {MAX_RESULTS_OPTIONS.map((option) => {
            const active = option === maxResults;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.78}
                disabled={running}
                onPress={() => setMaxResults(option)}
                style={[styles.optionChip, active && styles.optionChipActive]}
              >
                <Typography variant="caption" color={active ? '#fff' : T.primaryHead} style={styles.optionText}>
                  {option}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {running ? (
        <View style={styles.runningStrip}>
          <Typography variant="caption" color="#1d4ed8">Calling Apollo + Sales Navigator. Typically 3-8s.</Typography>
        </View>
      ) : null}

      {error ? (
        <View style={styles.searchErrorStrip}>
          <Typography variant="caption" color="#be123c" style={styles.flexText}>
            Search failed: {friendlySearchError(error)}
          </Typography>
          <TouchableOpacity onPress={onDismiss}>
            <Typography variant="caption" color="#be123c" style={styles.underlined}>dismiss</Typography>
          </TouchableOpacity>
        </View>
      ) : null}

      {result && !running && !error ? (
        <SearchResultStrip result={result} onDismiss={onDismiss} />
      ) : null}
    </View>
  );
}

function SearchResultStrip({ result, onDismiss }: { result: SearchRunResult; onDismiss: () => void }) {
  if (result.error === 'no_active_icp') {
    return (
      <View style={styles.searchErrorStrip}>
        <Typography variant="caption" color="#be123c" style={styles.flexText}>
          Search failed: {friendlySearchError('no_active_icp')}
        </Typography>
        <TouchableOpacity onPress={onDismiss}>
          <Typography variant="caption" color="#be123c" style={styles.underlined}>dismiss</Typography>
        </TouchableOpacity>
      </View>
    );
  }

  const count = result.count ?? result.candidates?.length ?? 0;
  const searchId = result.searchId ?? result.search_id ?? '';
  const totalCost = Number(result.totalCostUsd ?? result.total_cost_usd ?? 0);
  const backendResults = result.backendResults ?? result.backend_results ?? {};

  return (
    <View style={styles.searchSuccessStrip}>
      <View style={styles.searchSuccessTop}>
        <Typography variant="caption" color="#166534" style={styles.flexText}>
          <Typography variant="caption" color="#166534" style={styles.boldText}>{count}</Typography>
          {' '}candidate{count === 1 ? '' : 's'} discovered - search id {searchId ? searchId.slice(0, 8) : '-'} - cost ${totalCost.toFixed(2)}
        </Typography>
        <TouchableOpacity onPress={onDismiss}>
          <Typography variant="caption" color="#64748b" style={styles.underlined}>dismiss</Typography>
        </TouchableOpacity>
      </View>
      <View style={styles.backendRow}>
        {Object.entries(backendResults).map(([name, rollup]) => (
          <BackendChip key={name} name={name} rollup={rollup} />
        ))}
      </View>
      {count > 0 ? (
        <Typography variant="caption" color="#475569">
          New prospects will appear within seconds as the Master Agent ingests the fit events.
        </Typography>
      ) : null}
    </View>
  );
}

function BackendChip({ name, rollup }: { name: string; rollup: SearchBackendRollup }) {
  const label = name.replace(/_/g, ' ');
  const text = rollup.skipped
    ? `${label}: skipped${rollup.reason ? ` - ${rollup.reason}` : ''}`
    : rollup.error
      ? `${label}: error - ${String(rollup.error).slice(0, 32)}`
      : `${label}: ${rollup.candidates ?? 0}${rollup.total_matches != null ? ` / ${rollup.total_matches}` : ''}`;
  const color = rollup.error ? '#be123c' : rollup.skipped ? '#64748b' : T.primaryHead;
  const backgroundColor = rollup.error ? '#ffe4e6' : '#fff';
  return (
    <View style={[styles.backendChip, { backgroundColor, borderColor: '#e2e8f0' }]}>
      <Typography variant="caption" color={color} style={styles.backendText}>{text}</Typography>
    </View>
  );
}

function StatsCards({
  counts,
  selected,
  onSelect,
}: {
  counts: ProspectCRMData['counts'];
  selected: VisibleView;
  onSelect: (key: Exclude<VisibleView, 'board'>) => void;
}) {
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
    <View style={styles.statsGrid}>
      {cards.map((card) => {
        const Icon = card.Icon;
        const active = selected === card.key;
        return (
          <TouchableOpacity
            key={card.key}
            activeOpacity={0.82}
            onPress={() => onSelect(card.key)}
            style={[
              styles.statCard,
              isMobile && [styles.statCardMobile, { flexBasis: mobileBasis }],
              !isMobile && styles.statCardDesktop,
              active && styles.statCardActive,
            ]}
          >
            <View style={styles.statIconWrap}>
              <View style={[styles.statIcon, isMobile && styles.statIconMobile, { backgroundColor: card.bg }]}>
                <Icon color={card.color} size={isMobile ? 24 : 25} />
              </View>
            </View>
            <View style={styles.statBottom}>
              <Typography variant="caption" color="#56657f">{card.title}</Typography>
              <Typography variant="h2" color="#071a44" style={styles.statValue}>{card.value}</Typography>
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
}: {
  view: VisibleView;
  onChange: (view: VisibleView) => void;
  compact: boolean;
}) {
  const pills = VIEW_DEFS.map((definition) => {
    const Icon = definition.Icon;
    const active = view === definition.key;
    return (
      <TouchableOpacity
        key={definition.key}
        activeOpacity={0.78}
        onPress={() => onChange(definition.key)}
        style={[styles.viewPill, compact && styles.viewPillCompact, active && styles.viewPillActive]}
      >
        <Icon color={active ? '#fff' : T.primaryHead} size={compact ? 12 : 14} />
        <Typography variant="caption" color={active ? '#fff' : T.primaryHead} style={styles.viewPillText}>
          {definition.label}
        </Typography>
      </TouchableOpacity>
    );
  });

  if (compact) {
    return (
      <View style={[styles.viewHeader, styles.viewHeaderCompact]}>
        <Typography variant="caption" color="#56657f" style={[styles.viewLabel, styles.viewLabelCompact]}>
          VIEW
        </Typography>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.pillScroll, styles.pillScrollCompact]}
          contentContainerStyle={[styles.pillWrap, styles.pillWrapCompact]}
        >
          {pills}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.viewHeader}>
      <View style={styles.viewLeft}>
        <Typography variant="caption" color="#56657f" style={styles.viewLabel}>VIEW</Typography>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pillWrap}
        >
          {pills}
        </ScrollView>
      </View>
      <Typography
        variant="caption"
        color="#64748b"
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
                  active && [styles.stageTabActive, { backgroundColor: color, borderColor: color }],
                ]}
              >
                <Typography variant="caption" color={active ? '#fff' : T.primaryHead} style={styles.stageTabText}>
                  {getStageLabel(stage)}
                </Typography>
                <View style={[styles.stageTabCount, active && styles.stageTabCountActive]}>
                  <Typography variant="caption" color={active ? color : '#64748b'} style={styles.stageTabCountText}>
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
            <View key={stage.key} style={[styles.boardColumn, { width: columnWidth }]}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleRow}>
                  <Typography variant="bodyLarge" color={T.primaryHead} style={styles.columnTitle} numberOfLines={1}>
                    {getStageLabel(stage)}
                  </Typography>
                  <View style={styles.countPill}>
                    <Typography variant="caption" color={T.primaryHead} style={styles.countText}>{stageLeads.length}</Typography>
                  </View>
                </View>
                <TouchableOpacity activeOpacity={0.76} style={styles.columnAdd}>
                  <Plus color="#8aa0c2" size={16} />
                </TouchableOpacity>
              </View>
              <Typography variant="caption" color="#64748b" style={styles.pipelineValue}>
                {fmtCurrency(pipelineValue)} pipeline
              </Typography>
              <View style={styles.stageCards}>
                {stageLeads.length ? stageLeads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} selected={selectedId === lead.id} onPress={() => onSelect(lead)} />
                )) : (
                  <View style={styles.noDealsBox}>
                    <Typography variant="caption" color="#8190ad">No deals here</Typography>
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
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.leadCard, selected && styles.leadCardSelected]}>
      <View style={styles.leadCardTop}>
        <Avatar name={lead.name} initials={lead.initials} tone={lead.tone} size={40} />
        <View style={styles.leadCardText}>
          <View style={styles.leadNameRow}>
            <Typography variant="bodySmall" color={T.primaryHead} style={styles.rowName} numberOfLines={1}>
              {lead.name}
            </Typography>
            <Typography variant="caption" color={T.primary} style={styles.moneyText}>{fmtCurrency(lead.value)}</Typography>
          </View>
          <Typography variant="caption" color="#64748b" numberOfLines={1}>{lead.company || 'No company'}</Typography>
        </View>
      </View>
      <View style={styles.leadCardBottom}>
        <ChannelChips channels={lead.channels} />
        <View style={styles.cardScoreRow}>
          <View style={styles.scoreMini}>
            <Sparkles color={T.primary} size={12} />
            <Typography variant="caption" color={T.primaryHead} style={styles.scoreText}>{scoreLabel(lead.fit)}</Typography>
          </View>
          <Typography variant="caption" color="#94a3b8">{rel(lead.lastAt)}</Typography>
        </View>
      </View>
      {lead.warmPath ? (
        <View style={styles.warmPathLine}>
          <Route color={T.primary} size={13} />
          <Typography variant="caption" color={T.primary} style={styles.warmPathText}>Warm via {lead.warmPath}</Typography>
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
  onNew,
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
  onNew: () => void;
}) {
  const title = view === 'all' ? 'All Contacts' : view === 'prospects' ? 'Prospects' : view === 'leads' ? 'Leads' : 'Clients';
  const subtitle = view === 'prospects'
    ? 'Top-of-funnel contacts sourced from Apollo, LinkedIn Sales Nav, imports, or referrals.'
    : view === 'leads'
      ? `Pipeline: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.value || 0), 0))} - Weighted: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.value || 0) * (row.probability || 0), 0))}`
      : view === 'clients'
        ? `MRR: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.mrr || 0), 0), 'USD')} - ARR: ${fmtCurrency(rows.reduce((sum, row) => sum + (row.mrr || 0), 0) * 12, 'USD')}`
        : 'Every contact in this tenant: imported, prospected, inbound, and customer.';

  return (
    <View style={styles.tableShell}>
      <View style={styles.tableHeader}>
        <View style={styles.tableTitleBlock}>
          <View style={styles.tableTitleRow}>
            <Typography variant="bodyLarge" color={T.primaryHead} style={styles.tableTitle}>{title}</Typography>
            <View style={styles.countPill}>
              <Typography variant="caption" color={T.primaryHead} style={styles.countText}>
                {rows.length}{rows.length !== totalCount ? ` / ${totalCount}` : ''}
              </Typography>
            </View>
          </View>
          <Typography variant="caption" color="#64748b">{subtitle}</Typography>
        </View>
        <View style={styles.tableActions}>
          <TouchableOpacity onPress={onExport} activeOpacity={0.78} style={styles.tableActionButton}>
            <Download color={T.primaryHead} size={15} />
            <Typography variant="caption" color={T.primaryHead} style={styles.tableActionText}>Export</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNew} activeOpacity={0.78} style={styles.newButton}>
            <Plus color="#fff" size={15} />
            <Typography variant="caption" color="#fff" style={styles.tableActionText}>New</Typography>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search color="#94a3b8" size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search..."
          placeholderTextColor="#94a3b8"
          style={[styles.searchInput, WEB_INPUT_RESET]}
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
            <Inbox color="#94a3b8" size={24} />
            <Typography variant="bodySmall" color="#64748b">No matches.</Typography>
          </View>
        )}
      </View>

      <View style={styles.tableFooter}>
        <Typography variant="caption" color="#64748b">
          Showing <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{rows.length}</Typography> of {totalCount}
        </Typography>
        <Typography variant="caption" color={T.primaryHead} style={styles.tableActionText}>Page 1 of 1</Typography>
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
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.contactRow}>
      <View style={styles.contactTop}>
        <View style={styles.contactIdentity}>
          <Avatar name={contact.name} initials={contact.initials} size={34} />
          <View style={styles.contactNameBlock}>
            <Typography variant="bodySmall" color={T.primaryHead} style={styles.rowName} numberOfLines={1}>{contact.name}</Typography>
            <Typography variant="caption" color="#64748b" numberOfLines={1}>
              {view === 'all' ? contact.title : `${contact.title || '-'} - ${contact.company || 'No company'}`}
            </Typography>
          </View>
        </View>
        <View style={styles.rowRight}>
          {view === 'all' ? <TypePill type={contact.type} /> : <StagePill stage={contact.stage} />}
          <TouchableOpacity activeOpacity={0.78} onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.rowIconButton}>
            <Trash2 color="#be123c" size={15} />
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

      <View style={styles.rowMeta}>
        <ChannelChips channels={contact.channels} />
        <Typography variant="caption" color="#64748b">
          Owner: {contact.ownerName || 'Unassigned'}
        </Typography>
        <Typography variant="caption" color="#64748b">
          {contact.lastActivityAt ? `${rel(contact.lastActivityAt)} ago` : 'No activity'}
        </Typography>
        <ChevronRight color="#94a3b8" size={16} />
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
  onAction: (contact: CrmContact, action: 'pause' | 'suppress' | 'enrich') => void;
}) {
  if (!contact) return null;
  const raw = contact.raw;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIdentity}>
              <Avatar name={contact.name} initials={contact.initials} tone={STAGE_COLOR[contact.stage] || T.primary} size={42} />
              <View style={styles.modalTitleBlock}>
                <Typography variant="h3" color={T.primaryHead} numberOfLines={1}>{contact.name}</Typography>
                <Typography variant="caption" color="#64748b" numberOfLines={1}>
                  {contact.title || 'Prospect'} - {contact.company || 'No company'}
                </Typography>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.76} style={styles.closeButton}>
              <X color={T.primaryHead} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHero}>
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
              <InfoLine icon={Mail} label="Email" value={contact.email || '-'} verified={contact.emailVerified} />
              <InfoLine icon={Phone} label="Phone" value={contact.phone || '-'} verified={contact.phoneVerified} />
              <InfoLine icon={ExternalLink} label="LinkedIn" value={String(raw.linkedin_url || '-')} />
              <InfoLine icon={Users} label="Owner" value={contact.ownerName || 'Unassigned'} />
              <InfoLine icon={Route} label="Warm path" value={contact.warmPath || '-'} />
            </Section>

            <Section title="Engagement">
              <View style={styles.channelDetailRow}>
                <ChannelChips channels={contact.channels} />
                <Typography variant="caption" color="#64748b">
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
                    <Typography variant="caption" color={T.primaryHead} style={styles.rollupChannel}>{titleCase(channel)}</Typography>
                    <Typography variant="caption" color="#64748b">{count} events</Typography>
                    <Typography variant="caption" color="#64748b">{fmtDateTime(String(record.last_event_at || ''))}</Typography>
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
              {loading ? <ActivityIndicator color={T.primary} /> : null}
              {followups.length ? followups.map((followup) => (
                <View key={followup.id} style={styles.followupRow}>
                  <Clock color={T.primary} size={15} />
                  <View style={styles.followupText}>
                    <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>
                      {titleCase(followup.channel || 'channel')} - {titleCase(followup.type || 'follow-up')}
                    </Typography>
                    <Typography variant="caption" color="#64748b">
                      {fmtDateTime(followup.scheduled_time)} - attempt {followup.attempt ?? '-'}
                    </Typography>
                  </View>
                </View>
              )) : (
                <Typography variant="caption" color="#64748b">No upcoming follow-ups.</Typography>
              )}
            </Section>

            <Section title="Activity timeline">
              {loading ? <ActivityIndicator color={T.primary} /> : null}
              {events.length ? events.map((event) => (
                <View key={`${event.seq}-${event.occurred_at}`} style={styles.eventRow}>
                  <ChannelDot channel={String(event.channel)} />
                  <View style={styles.eventText}>
                    <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>
                      {titleCase(event.event_type)}
                    </Typography>
                    <Typography variant="caption" color="#64748b">
                      {titleCase(String(event.direction || 'system'))} - {fmtDateTime(event.occurred_at)}
                    </Typography>
                    {payloadPreview(event.payload) ? (
                      <Typography variant="caption" color="#64748b">{payloadPreview(event.payload)}</Typography>
                    ) : null}
                  </View>
                </View>
              )) : (
                <Typography variant="caption" color="#64748b">No activity yet.</Typography>
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
  if (!channels?.length) {
    return <Typography variant="caption" color="#94a3b8">-</Typography>;
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
  if (!stage) return <Typography variant="caption" color="#94a3b8">-</Typography>;
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
  return (
    <View style={styles.detailPair}>
      <Typography variant="overline" color="#94a3b8">{label}</Typography>
      <Typography variant="caption" color={T.primaryHead} numberOfLines={2}>{value || '-'}</Typography>
    </View>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiTile}>
      <Typography variant="overline" color="#94a3b8">{label}</Typography>
      <Typography variant="h3" color={T.primaryHead} style={styles.kpiValue}>{value}</Typography>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      {active ? <Check color="#fff" size={13} /> : null}
      <Typography variant="caption" color={active ? '#fff' : T.primaryHead} style={styles.tableActionText}>{label}</Typography>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailSection}>
      <Typography variant="bodySmall" color={T.primaryHead} style={styles.sectionTitle}>{title}</Typography>
      {children}
    </View>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  verified,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <View style={styles.infoLine}>
      <Icon color={T.primary} size={16} />
      <View style={styles.infoText}>
        <Typography variant="overline" color="#94a3b8">{label}</Typography>
        <Typography variant="caption" color={T.primaryHead} numberOfLines={2}>{value}</Typography>
      </View>
      {verified ? <BadgeCheck color={T.success} size={16} /> : null}
    </View>
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
  const color = danger ? '#be123c' : T.primary;
  return (
    <TouchableOpacity activeOpacity={0.78} disabled={busy} onPress={onPress} style={[styles.detailActionButton, danger && styles.dangerAction]}>
      {busy ? <ActivityIndicator color={color} size="small" /> : <Icon color={color} size={16} />}
      <Typography variant="caption" color={color} style={styles.tableActionText}>{label}</Typography>
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
    flexShrink: 1,
  },
  moneyText: {
    fontWeight: '900',
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
    fontWeight: '900',
  },
  warmPathLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warmPathText: {
    fontWeight: '800',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
  },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontWeight: '900',
  },
  underlined: {
    textDecorationLine: 'underline',
  },
});
