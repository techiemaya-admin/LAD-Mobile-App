import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  ArrowLeft,
  Award,
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  ChevronDown,
  ChevronUp,
  Move,
  Mail,
  MapPin,
  MessageCircle,
  MoonStar,
  MoreHorizontal,
  MousePointerClick,
  Phone,
  Radio,
  Route,
  RouteOff,
  RotateCcw,
  SendHorizontal,
  Settings2,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { connectSocket } from '@/src/services/socketService';
import {
  ChannelKey,
  CrmContact,
  ProspectEvent,
  ProspectFollowup,
  ProspectState,
  deleteProspect,
  enrichProspect,
  getProspect,
  getProspectFollowups,
  initialsOf,
  listProspectEvents,
  prospectAction,
  toCrmContact,
} from '@/src/services/prospectsService';

type IconComponent = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

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

const CHANNELS: Record<string, { label: string; color: string; Icon: IconComponent }> = {
  linkedin: { label: 'LinkedIn', color: T.linkedin, Icon: BriefcaseBusiness },
  whatsapp: { label: 'WhatsApp', color: T.whatsapp, Icon: MessageCircle },
  wapa: { label: 'Personal WA', color: T.whatsapp, Icon: MessageCircle },
  personal_whatsapp: { label: 'Personal WA', color: T.whatsapp, Icon: MessageCircle },
  email: { label: 'Email', color: T.gmail, Icon: Mail },
  voice: { label: 'Voice', color: T.voice, Icon: Phone },
  instagram: { label: 'Instagram', color: '#ec4899', Icon: Camera },
  intent: { label: 'Signal', color: T.primary, Icon: Radio },
  system: { label: 'System', color: '#64748b', Icon: Settings2 },
};

const HEATMAP_CHANNEL: Record<string, string> = {
  whatsapp: 'whatsapp',
  waba: 'whatsapp',
  wapa: 'whatsapp',
  personal_whatsapp: 'whatsapp',
  linkedin: 'linkedin',
  email: 'email',
  gmail: 'email',
  outlook: 'email',
  voice: 'voice',
  instagram: 'instagram',
  ig: 'instagram',
  intent: 'intent',
  signal: 'intent',
  fit: 'intent',
  system: 'intent',
};

const STAGE_META: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#64748b' },
  contacted: { label: 'Contacted', color: T.info },
  engaged: { label: 'Engaged', color: T.info },
  qualified: { label: 'Qualified', color: T.primary },
  sah: { label: 'Handed off', color: T.success },
  won: { label: 'Won', color: '#16a34a' },
  lost: { label: 'Lost', color: T.danger },
  archived: { label: 'Archived', color: '#78716c' },
};

const FIT_LABELS: Record<string, string> = {
  title_match: 'Title',
  industry_match: 'Industry',
  size_match: 'Size',
  geo_match: 'Geo',
  seniority_match: 'Seniority',
  tech_stack_match: 'Tech',
};

const LIVE_EVENTS = [
  'prospect.updated',
  'prospect:updated',
  'prospects:updated',
  'fit.discovered',
  'fit:discovered',
  'master-agent:prospect',
  'crm:update',
  'crm:updated',
];

interface WarmPath {
  topConnection: { name: string; headline: string; confidence: number };
  sharedEmployer: { company: string; overlap: string; confidence: number } | null;
  mutualConnections: Array<{ name: string; title: string; confidence: number }>;
  customerReference: { via: string; confidence: number } | null;
  accountPipeline: { company: string; otherContactsInPipeline: Array<{ name: string; title: string; stage: string }> } | null;
  sample: boolean;
}

interface GraphChildDef {
  id: string;
  x: number;
  y: number;
  name: string;
  sub: string;
  color: string;
  badge: string;
  big?: boolean;
  label?: { confidence: number; note: string };
  linkType: 'primary' | 'mutual' | 'customer' | 'employer';
}

interface GraphPos {
  x: number;
  y: number;
}

const SAMPLE_WARM_PATH: WarmPath = {
  topConnection: { name: 'Anil Mehra', headline: 'Head of Partnerships, BlueBridge', confidence: 0.92 },
  sharedEmployer: { company: 'Cigna MENA', overlap: '2019-2022 (3 yrs)', confidence: 0.88 },
  mutualConnections: [
    { name: 'Reem Al-Hashimi', title: 'VP Marketing, Sehha', confidence: 0.74 },
    { name: 'Daniel Okonkwo', title: 'Founder, Loop Capital', confidence: 0.61 },
    { name: 'Priya Nair', title: 'GM, Telr', confidence: 0.55 },
  ],
  customerReference: { via: 'Sehha Health', confidence: 0.8 },
  accountPipeline: {
    company: 'Catalyst Health',
    otherContactsInPipeline: [{ name: 'Omar Kassem', title: 'Head of Marketing', stage: 'qualified' }],
  },
  sample: true,
};

const GRAPH_W = 720;
const GRAPH_H = 320;
const GRAPH_CENTER: GraphPos = { x: GRAPH_W / 2, y: 150 };

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function titleCase(value?: string | null) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function fmtDateTime(value?: string | null): string {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function payloadPreview(payload?: Record<string, unknown>, eventType = 'event') {
  if (!payload || !Object.keys(payload).length) return eventType.replace(/[._]/g, ' ');
  const preview = payload.preview || payload.subject || payload.message || payload.note || payload.role || payload.round;
  if (preview) return String(preview);
  if (Array.isArray(payload.pages)) return payload.pages.join(', ');
  return eventType.replace(/[._]/g, ' ');
}

function scoreBand(value?: number | null) {
  if (value == null) return { label: 'Not scored yet', level: '-', color: T.primary };
  if (value >= 0.8) return { label: 'Strong match', level: `${Math.round(value * 100)}`, color: T.success };
  if (value >= 0.6) return { label: 'Good match', level: `${Math.round(value * 100)}`, color: T.info };
  if (value >= 0.4) return { label: 'Partial match', level: `${Math.round(value * 100)}`, color: T.warning };
  return { label: 'Weak match', level: `${Math.round(value * 100)}`, color: T.danger };
}

function engagementTemperature(contact: CrmContact, events: ProspectEvent[]) {
  const recentEvents = events.filter((event) => {
    const diff = Date.now() - new Date(event.occurred_at).getTime();
    return Number.isFinite(diff) && diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;
  if (contact.raw.do_not_contact) return { label: 'Cold', color: T.danger };
  if ((contact.fit ?? 0) >= 0.75 || recentEvents >= 6 || contact.stage === 'qualified' || contact.stage === 'sah') {
    return { label: 'Hot', color: T.danger };
  }
  if ((contact.fit ?? 0) >= 0.45 || recentEvents > 0 || contact.stage === 'engaged') return { label: 'Warm', color: T.warning };
  return { label: 'Cold', color: '#64748b' };
}

function channelMeta(channel?: string | null) {
  const key = HEATMAP_CHANNEL[String(channel || '').toLowerCase()] || String(channel || 'system').toLowerCase();
  return CHANNELS[key] || CHANNELS.system;
}

function profileImageUrl(raw: ProspectState) {
  const record = asRecord(raw);
  const candidates = [
    record.profile_image_url,
    record.profileImageUrl,
    record.profile_image,
    record.profileImage,
    record.avatar_url,
    record.avatarUrl,
    record.photo_url,
    record.photoUrl,
    record.picture,
    record.image_url,
    record.linkedin_photo_url,
  ];
  return candidates.map((item) => String(item || '').trim()).find((item) => item.startsWith('http')) || '';
}

function fitSignals(raw: ProspectState) {
  const out: Array<{ key: string; label: string; value: number }> = [];
  for (const [key, value] of Object.entries(asRecord(raw.fit_signals))) {
    const numeric = typeof value === 'number' ? value : value ? 1 : 0;
    out.push({ key, label: FIT_LABELS[key] || titleCase(key), value: Math.max(0, Math.min(1, numeric)) });
  }
  return out;
}

function intentSignals(raw: ProspectState) {
  return asArray(asRecord(raw).intent_signals).map((item, index) => {
    const record = asRecord(item);
    return {
      id: String(record.id || `${raw.id}-intent-${index}`),
      signalType: String(record.signal_type || record.type || 'intent.signal'),
      confidence: Math.max(0, Math.min(1, toNumber(record.confidence, 0))),
      recencyDays: toNumber(record.recency_days ?? record.recencyDays, 0),
      payload: asRecord(record.payload),
    };
  });
}

function channelRollups(raw: ProspectState) {
  return Object.entries(asRecord(raw.channel_rollups)).map(([channel, rollup]) => {
    const record = asRecord(rollup);
    const eventsByType = asRecord(record.events_by_type);
    const count = typeof record.count === 'number'
      ? record.count
      : Object.values(eventsByType).reduce<number>((sum, value) => sum + toNumber(value), 0);
    return {
      channel: String(channel),
      count,
      lastEventAt: record.last_event_at == null ? null : String(record.last_event_at),
    };
  }).filter((item) => item.count > 0);
}

function buildWarmPath(contact: CrmContact): WarmPath {
  const raw = asRecord(contact.raw);
  const root = asRecord(raw.warm_path || raw.warmPath || raw.relationship_graph || raw.relationships);
  const topRecord = asRecord(root.top_connection || root.topConnection || raw.top_connection || raw.warm_path_contact);
  const topName = String(topRecord.name || raw.warm_path_name || raw.intro_contact_name || '').trim();

  if (!topName) {
    return {
      ...SAMPLE_WARM_PATH,
      accountPipeline: {
        ...SAMPLE_WARM_PATH.accountPipeline!,
        company: contact.company || SAMPLE_WARM_PATH.accountPipeline!.company,
      },
      sample: true,
    };
  }

  const shared = asRecord(root.shared_employer || root.sharedEmployer || raw.shared_employer);
  const customer = asRecord(root.customer_reference || root.customerReference || raw.customer_reference);
  const account = asRecord(root.account_pipeline || root.accountPipeline || raw.account_pipeline);
  const mutuals = asArray(root.mutual_connections || root.mutualConnections || raw.mutual_connections)
    .map((item, index) => {
      const record = asRecord(item);
      return {
        name: String(record.name || record.full_name || `Mutual ${index + 1}`),
        title: String(record.title || record.headline || record.company || 'Mutual connection'),
        confidence: toNumber(record.confidence, 0.65),
      };
    });

  return {
    topConnection: {
      name: topName,
      headline: String(topRecord.headline || topRecord.title || topRecord.company || 'Warm connection'),
      confidence: toNumber(topRecord.confidence, 0.8),
    },
    sharedEmployer: shared.company ? {
      company: String(shared.company),
      overlap: String(shared.overlap || shared.years || 'shared history'),
      confidence: toNumber(shared.confidence, 0.75),
    } : null,
    mutualConnections: mutuals,
    customerReference: customer.via ? { via: String(customer.via), confidence: toNumber(customer.confidence, 0.75) } : null,
    accountPipeline: account.company ? {
      company: String(account.company),
      otherContactsInPipeline: asArray(account.other_contacts_in_pipeline || account.otherContactsInPipeline).map((item) => {
        const record = asRecord(item);
        return {
          name: String(record.name || record.full_name || 'Contact'),
          title: String(record.title || record.job_title || ''),
          stage: String(record.stage || 'new'),
        };
      }),
    } : null,
    sample: false,
  };
}

export default function CrmProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isCompact = width < 840;
  const isPhone = width < 520;
  const pagePadding = isPhone ? Theme.spacing.lg : Theme.spacing.xl;
  const contentMaxWidth = width >= 1180 ? 1280 : undefined;

  const [contact, setContact] = useState<CrmContact | null>(null);
  const [events, setEvents] = useState<ProspectEvent[]>([]);
  const [followups, setFollowups] = useState<ProspectFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [graphVisible, setGraphVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const enrichTriggered = useRef(false);

  const loadProfile = useCallback(async (asRefresh = false) => {
    if (!id) return;
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [prospect, nextEvents, nextFollowups] = await Promise.all([
        getProspect(id),
        listProspectEvents(id, { limit: 100 }).catch(() => []),
        getProspectFollowups(id).catch(() => []),
      ]);
      setContact(toCrmContact(prospect));
      setEvents(nextEvents);
      setFollowups(nextFollowups);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not load this profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!id) return undefined;
    const timer = setInterval(() => void loadProfile(true), 20000);
    return () => clearInterval(timer);
  }, [id, loadProfile]);

  useEffect(() => {
    if (!id) return undefined;
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      const refresh = (payload?: unknown) => {
        const record = asRecord(payload);
        const eventId = String(record.id || record.prospect_id || record.prospectId || '');
        if (!eventId || eventId === id) void loadProfile(true);
      };
      LIVE_EVENTS.forEach((event) => socket?.on(event, refresh));
      return () => {
        LIVE_EVENTS.forEach((event) => socket?.off(event, refresh));
      };
    } catch {
      return undefined;
    }
  }, [id, loadProfile]);

  useEffect(() => {
    if (!contact || enrichTriggered.current) return;
    if (contact.raw.linkedin_url && !contact.raw.profile_enriched_at) {
      enrichTriggered.current = true;
      void enrichProspect(contact.id)
        .then(() => setTimeout(() => void loadProfile(true), 2500))
        .catch(() => undefined);
    }
  }, [contact, loadProfile]);

  const warmPath = useMemo(() => contact ? buildWarmPath(contact) : SAMPLE_WARM_PATH, [contact]);
  const temperature = useMemo(() => contact ? engagementTemperature(contact, events) : null, [contact, events]);

  const handleBack = () => {
    if (router.canGoBack?.()) router.back();
    else router.replace('/crm' as never);
  };

  const handleRemove = () => {
    if (!contact) return;
    const run = async () => {
      setBusyAction('remove');
      try {
        await deleteProspect(contact.id, 'not_a_fit');
        router.replace('/crm' as never);
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

  const handleAction = async (action: 'quiet' | 'suppress' | 'intro' | 'message') => {
    if (!contact) return;
    if (action === 'intro') {
      setNotice(`Intro route prepared via ${warmPath.topConnection.name}.`);
      return;
    }
    if (action === 'message') {
      setNotice(`Message context prepared for ${contact.name}.`);
      return;
    }

    setBusyAction(action);
    setNotice(null);
    try {
      if (action === 'quiet') {
        const quietActive = Boolean(contact.raw.quiet_until && new Date(contact.raw.quiet_until).getTime() > Date.now());
        await prospectAction(contact.id, { quietDays: quietActive ? 0 : 7 });
      } else {
        await prospectAction(contact.id, { doNotContact: !contact.raw.do_not_contact });
      }
      await loadProfile(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update contact.');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleWarmPath = () => {
    setGraphVisible((current) => !current);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: pagePadding,
            paddingBottom: insets.bottom + Theme.spacing.xxl,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadProfile(true)} tintColor={T.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ProfileTopBar
          name={contact?.name || 'Prospect'}
          onBack={handleBack}
          onRemove={handleRemove}
          removing={busyAction === 'remove'}
          onMore={() => setNotice('More actions are ready for this profile.')}
          onMessage={() => void handleAction('message')}
          compact={isPhone}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Typography variant="bodySmall" color="#be123c">{error}</Typography>
          </View>
        ) : null}

        {loading || !contact ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={T.primary} />
            <Typography variant="bodySmall" color="#64748b">Loading contact profile...</Typography>
          </View>
        ) : (
          <>
            <HeroKpis
              contact={contact}
              events={events}
              warmPath={warmPath}
              temperature={temperature}
              compact={isCompact}
              phone={isPhone}
              onWarmPress={toggleWarmPath}
              warmOpen={graphVisible}
            />

            {notice ? (
              <View style={styles.noticePill}>
                <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{notice}</Typography>
              </View>
            ) : null}

            {warmPath.sample ? (
              <View style={styles.samplePill}>
                <Typography variant="caption" color="#92400e" style={styles.boldText}>
                  Sample data - warm-path is not yet wired to a live source
                </Typography>
              </View>
            ) : null}

            <WarmPathCard
              contact={contact}
              warmPath={warmPath}
              open={graphVisible}
              onToggle={toggleWarmPath}
            />

            <ActivityHeatmap events={events} compact={isPhone} />

            <View style={[styles.twoColumnGrid, isCompact && styles.singleColumnGrid]}>
              <FitSignalsCard contact={contact} />
              <ChannelMixCard contact={contact} />
            </View>

            <IntentCard contact={contact} />

            {isCompact ? (
              <View style={styles.mobileBottomStack}>
                <ActionsCard
                  contact={contact}
                  warmPath={warmPath}
                  busyAction={busyAction}
                  onAction={handleAction}
                />
                <NextFollowupsCard followups={followups} loading={refreshing} />
                <RecentActivityCard events={events} />
              </View>
            ) : (
              <View style={styles.bottomGrid}>
                <View style={styles.feedColumn}>
                  <RecentActivityCard events={events} />
                </View>
                <View style={styles.sideColumn}>
                  <ActionsCard
                    contact={contact}
                    warmPath={warmPath}
                    busyAction={busyAction}
                    onAction={handleAction}
                  />
                  <NextFollowupsCard followups={followups} loading={refreshing} />
                </View>
              </View>
            )}

            <WarmPathGraphSheet
              visible={graphVisible}
              contact={contact}
              warmPath={warmPath}
              maxHeight={Math.max(520, height - insets.top - 24)}
              onClose={() => setGraphVisible(false)}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProfileTopBar({
  name,
  onBack,
  onRemove,
  removing,
  onMore,
  onMessage,
  compact,
}: {
  name: string;
  onBack: () => void;
  onRemove: () => void;
  removing: boolean;
  onMore: () => void;
  onMessage: () => void;
  compact: boolean;
}) {
  return (
    <View style={[styles.topBar, compact && styles.topBarCompact]}>
      <View style={styles.crumbRow}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.76} style={styles.backButton}>
          <ArrowLeft color="#475569" size={14} />
          <Typography variant="caption" color="#475569" style={styles.boldText}>All deals</Typography>
        </TouchableOpacity>
        <Typography variant="caption" color="#cbd5e1">/</Typography>
        <Typography variant="caption" color={T.primaryHead} style={styles.crumbName} numberOfLines={1}>
          {name}
        </Typography>
      </View>
      <View style={[styles.topActions, compact && styles.topActionsCompact]}>
        <TouchableOpacity
          onPress={onRemove}
          disabled={removing}
          activeOpacity={0.78}
          style={[styles.topActionButton, compact && styles.topActionButtonCompact, styles.removeButton]}
        >
          {removing ? <ActivityIndicator color="#e11d48" size="small" /> : <Trash2 color="#e11d48" size={15} />}
          <Typography variant="caption" color="#e11d48" style={styles.boldText}>Not a fit</Typography>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMore} activeOpacity={0.78} style={[styles.topActionButton, compact && styles.topActionButtonCompact]}>
          <MoreHorizontal color={T.primaryHead} size={15} />
          <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>More</Typography>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMessage} activeOpacity={0.78} style={[styles.messageButton, compact && styles.topActionButtonCompact]}>
          <SendHorizontal color="#fff" size={15} />
          <Typography variant="caption" color="#fff" style={styles.boldText}>Message</Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HeroKpis({
  contact,
  events,
  warmPath,
  temperature,
  compact,
  phone,
  onWarmPress,
  warmOpen,
}: {
  contact: CrmContact;
  events: ProspectEvent[];
  warmPath: WarmPath;
  temperature: { label: string; color: string } | null;
  compact: boolean;
  phone: boolean;
  onWarmPress: () => void;
  warmOpen: boolean;
}) {
  const raw = contact.raw;
  const stage = STAGE_META[contact.stage] || STAGE_META.new;
  const avatarUrl = profileImageUrl(raw);
  const dailyCounts = useMemo(() => engagementDailyCounts(events), [events]);
  const total7d = dailyCounts.reduce((sum, count) => sum + count, 0);
  const routeCount = warmRouteCount(warmPath);
  const lastDirection = events[0]?.direction || raw.last_event_type || 'system';

  return (
    <Card padded={false} style={styles.heroCard}>
      <View style={[styles.heroInner, compact && styles.heroInnerCompact]}>
        <View style={[styles.heroIdentity, compact && styles.heroIdentityCompact, phone && styles.heroIdentityPhone]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[styles.profileImage, phone && styles.profileImagePhone]} contentFit="cover" />
          ) : (
            <View style={[styles.heroAvatar, phone && styles.heroAvatarPhone]}>
              <Typography variant="h3" color="#fff" style={styles.avatarText}>{contact.initials}</Typography>
            </View>
          )}
          <View style={[styles.heroCopy, phone && styles.heroCopyPhone]}>
            <View style={[styles.heroNameRow, phone && styles.heroNameRowPhone]}>
              <Typography variant="h3" color="#1e293b" style={styles.heroName} numberOfLines={2}>
                {contact.name}
              </Typography>
              <StatusPill label={stage.label} color={stage.color} />
              {!phone && temperature ? <StatusPill label={temperature.label} color={temperature.color} /> : null}
            </View>
            {!phone ? (
              <>
                <Typography variant="bodySmall" color="#334155" numberOfLines={1}>
                  {contact.title || raw.headline || 'Prospect'}
                </Typography>
                <Typography variant="caption" color="#64748b" numberOfLines={1}>
                  {contact.company || 'No company'}
                </Typography>
              </>
            ) : null}
            <View style={[styles.locationLine, phone && styles.locationLinePhone]}>
              <MapPin color="#64748b" size={12} />
              {!phone ? (
                <Typography variant="caption" color="#64748b" numberOfLines={1}>
                  {contact.geo || 'Location unavailable'}
                </Typography>
              ) : null}
            </View>
            {!phone ? (
              <View style={styles.contactLine}>
                <ContactMini icon={Mail} label={contact.email || 'No email'} verified={contact.emailVerified} />
                <ContactMini icon={Phone} label={contact.phone || 'No phone'} verified={contact.phoneVerified} />
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.kpiGrid, compact && styles.kpiGridCompact]}>
          <KpiFit value={contact.fit ?? null} />
          <KpiSpark counts={dailyCounts} total={total7d} />
          <KpiRoutes count={routeCount} top={warmPath.topConnection.name} open={warmOpen} onPress={onWarmPress} />
          <KpiLast channel={raw.last_channel} occurredAt={contact.lastActivityAt} direction={String(lastDirection)} />
        </View>
      </View>
    </Card>
  );
}

function ContactMini({ icon: Icon, label, verified }: { icon: IconComponent; label: string; verified?: boolean }) {
  return (
    <View style={styles.contactMini}>
      <Icon color="#64748b" size={12} />
      <Typography variant="caption" color="#475569" numberOfLines={1}>{label}</Typography>
      {verified ? <View style={styles.verifiedDot} /> : null}
    </View>
  );
}

function KpiFit({ value }: { value: number | null }) {
  const band = scoreBand(value);
  return (
    <View style={styles.kpiTile}>
      <View style={styles.scoreCircle}>
        <Typography variant="bodyLarge" color={T.primaryHead} style={styles.kpiValue}>{band.level}</Typography>
      </View>
      <View style={styles.kpiText}>
        <Typography variant="overline" color="#64748b">Fit score</Typography>
        <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{band.label}</Typography>
        <Typography variant="caption" color="#64748b">{value == null ? 'Scored on discovery' : 'Fit to active ICP'}</Typography>
      </View>
    </View>
  );
}

function KpiSpark({ counts, total }: { counts: number[]; total: number }) {
  return (
    <View style={styles.kpiTileColumn}>
      <Typography variant="overline" color="#64748b">Engagement - 7d</Typography>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color="#1e293b" style={styles.kpiValue}>{total}</Typography>
        <Typography variant="caption" color="#64748b">events</Typography>
      </View>
      <Sparkline counts={counts} />
    </View>
  );
}

function Sparkline({ counts }: { counts: number[] }) {
  const { width: viewportWidth } = useWindowDimensions();
  const width = viewportWidth < 360 ? 104 : 132;
  const height = 40;
  const padTop = 5;
  const padBottom = 8;
  const usableHeight = height - padTop - padBottom;
  const max = Math.max(1, ...counts);
  const points = counts.map((count, index) => {
    const x = counts.length <= 1 ? 0 : (index / (counts.length - 1)) * width;
    const y = padTop + (1 - count / max) * usableHeight;
    return { x, y };
  });
  const last = points[points.length - 1] || { x: 0, y: height - padBottom };

  return (
    <View style={[styles.sparkline, { width, height }]}>
      <View style={[styles.sparkBaseline, { top: height - padBottom }]} />
      <View style={[styles.sparkAreaHint, { left: Math.max(0, last.x - 36), top: Math.max(padTop, last.y), height: Math.max(8, height - padBottom - last.y) }]} />
      {points.slice(0, -1).map((point, index) => (
        <SparkSegment key={index} from={point} to={points[index + 1]} />
      ))}
      <View style={[styles.sparkLastDot, { left: last.x - 3, top: last.y - 3 }]} />
    </View>
  );
}

function SparkSegment({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  return (
    <View
      style={[
        styles.sparkSegment,
        {
          width: distance,
          left: (from.x + to.x) / 2 - distance / 2,
          top: (from.y + to.y) / 2 - 1,
          transform: [{ rotate: angle }],
        },
      ]}
    />
  );
}

function KpiRoutes({ count, top, open, onPress }: { count: number; top: string; open: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.kpiTileColumn}>
      <View style={styles.kpiTopLine}>
        <Typography variant="overline" color="#64748b">Warm routes</Typography>
        {open ? <ChevronUp color={T.primary} size={13} /> : <ChevronDown color={T.primary} size={13} />}
      </View>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color="#1e293b" style={styles.kpiValue}>{count}</Typography>
        <Typography variant="caption" color={T.primary} style={styles.boldText}>paths</Typography>
      </View>
      <View style={styles.routeVia}>
        <View style={styles.tinyAvatar}><Typography variant="caption" color="#fff" style={styles.tinyAvatarText}>{initialsOf(top)}</Typography></View>
        <Typography variant="caption" color="#64748b" numberOfLines={1}>
          via <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{top}</Typography>
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function KpiLast({ channel, occurredAt, direction }: { channel?: string | null; occurredAt?: string | null; direction?: string | null }) {
  const meta = channelMeta(channel);
  const Icon = meta.Icon;
  return (
    <View style={styles.kpiTileColumn}>
      <Typography variant="overline" color="#64748b">Last touch</Typography>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color="#1e293b" style={styles.kpiValue}>{rel(occurredAt)}</Typography>
        <Typography variant="caption" color="#64748b">ago</Typography>
      </View>
      <View style={styles.lastTouchPill}>
        <View style={[styles.channelDotLarge, { backgroundColor: `${meta.color}1a` }]}>
          <Icon color={meta.color} size={12} />
        </View>
        <Typography variant="caption" color={meta.color} style={styles.boldText}>{meta.label}</Typography>
        <Typography variant="caption" color="#64748b">{direction === 'inbound' ? 'reply' : 'sent'}</Typography>
      </View>
    </View>
  );
}

function WarmPathCard({
  contact,
  warmPath,
  open,
  onToggle,
}: {
  contact: CrmContact;
  warmPath: WarmPath;
  open: boolean;
  onToggle: () => void;
}) {
  if (!warmPath.topConnection.name) {
    return (
      <Card>
        <CardHeader title="Warm Path" subtitle="Routes from your network to this prospect" />
        <View style={styles.emptyWarmPath}>
          <RouteOff color="#94a3b8" size={22} />
          <Typography variant="bodySmall" color="#64748b">No paths found yet.</Typography>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Warm Path"
        subtitle={`${warmRouteCount(warmPath)} routes through your network`}
        action={(
          <TouchableOpacity activeOpacity={0.78} onPress={onToggle} style={styles.graphButton}>
            <Typography variant="caption" color={T.primary} style={styles.boldText}>{open ? 'Collapse' : 'Open graph'}</Typography>
            {open ? <ChevronUp color={T.primary} size={13} /> : <ChevronDown color={T.primary} size={13} />}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity activeOpacity={0.82} onPress={onToggle} style={styles.warmSummary}>
        <View style={styles.warmIcon}><Route color={T.primary} size={20} /></View>
        <View style={styles.warmSummaryText}>
          <Typography variant="bodySmall" color={T.primaryHead} numberOfLines={2}>
            <Typography variant="bodySmall" color={T.primaryHead} style={styles.boldText}>{warmPath.topConnection.name}</Typography>
            {' knows '}
            {contact.name.split(' ')[0]}
            {warmPath.sharedEmployer ? (
              ` from ${warmPath.sharedEmployer.company} (${warmPath.sharedEmployer.overlap})`
            ) : ''}
            {` - ${Math.round(warmPath.topConnection.confidence * 100)}%`}
          </Typography>
          <View style={styles.warmMetaRow}>
            <WarmMeta icon={Users} label={`${warmPath.mutualConnections.length} mutuals`} />
            {warmPath.customerReference ? <WarmMeta icon={Award} label={warmPath.customerReference.via} /> : null}
            {warmPath.accountPipeline ? <WarmMeta icon={BriefcaseBusiness} label="account in pipeline" /> : null}
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
}

function WarmPathGraphSheet({
  visible,
  contact,
  warmPath,
  maxHeight,
  onClose,
}: {
  visible: boolean;
  contact: CrmContact;
  warmPath: WarmPath;
  maxHeight: number;
  onClose: () => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const graphWidth = Math.min(GRAPH_W, Math.max(320, viewportWidth - Theme.spacing.lg * 2));
  const graphCenter = useMemo(() => ({ x: graphWidth / 2, y: GRAPH_CENTER.y }), [graphWidth]);
  const [positions, setPositions] = useState<Record<string, GraphPos>>({});
  const [kidsExpanded, setKidsExpanded] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const startRef = useRef<GraphPos>({ x: 0, y: 0 });

  const childDefs = useMemo(() => buildGraphChildren(warmPath, graphWidth, graphCenter), [graphCenter, graphWidth, warmPath]);
  const hasMoved = useRef(false);
  const sheetHeight = Math.min(maxHeight, 760);

  useEffect(() => {
    if (visible) {
      setPositions({});
      setKidsExpanded(true);
      setActiveId(null);
      dragId.current = null;
    }
  }, [visible, contact.id]);

  const getPos = useCallback((def: GraphChildDef) => positions[def.id] || { x: def.x, y: def.y }, [positions]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const candidate = nearestGraphNode(point, childDefs, getPos, kidsExpanded, graphCenter);
      return Boolean(candidate);
    },
    onMoveShouldSetPanResponder: () => Boolean(dragId.current),
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const candidate = nearestGraphNode(point, childDefs, getPos, kidsExpanded, graphCenter);
      if (!candidate) return;
      dragId.current = candidate;
      startRef.current = point;
      hasMoved.current = false;
      setActiveId(candidate === 'prospect' ? null : candidate);
    },
    onPanResponderMove: (event) => {
      const id = dragId.current;
      if (!id || id === 'prospect') return;
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const dx = point.x - startRef.current.x;
      const dy = point.y - startRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) hasMoved.current = true;
      setPositions((current) => ({
        ...current,
        [id]: {
          x: clamp(point.x, 38, graphWidth - 38),
          y: clamp(point.y, 38, GRAPH_H - 38),
        },
      }));
    },
    onPanResponderRelease: () => {
      if (dragId.current === 'prospect' && !hasMoved.current) {
        setKidsExpanded((current) => !current);
      }
      dragId.current = null;
      hasMoved.current = false;
      setActiveId(null);
    },
    onPanResponderTerminate: () => {
      dragId.current = null;
      hasMoved.current = false;
      setActiveId(null);
    },
  }), [childDefs, getPos, graphCenter, graphWidth, kidsExpanded]);

  const resetGraph = () => {
    setPositions({});
    setKidsExpanded(true);
    setActiveId(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.graphModalRoot}>
        <TouchableOpacity style={styles.graphBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.graphSheet, { maxHeight: sheetHeight }]}>
          <View style={styles.graphHandle} />
          <View style={styles.graphSheetHeader}>
            <View style={styles.graphTitleBlock}>
              <Typography variant="h3" color={T.primaryHead} style={styles.graphSheetTitle}>Warm Path</Typography>
              <Typography variant="bodySmall" color="#56657f">{warmRouteCount(warmPath)} routes through your network</Typography>
            </View>
            <View style={styles.graphHeaderActions}>
              {Object.keys(positions).length ? (
                <TouchableOpacity activeOpacity={0.78} onPress={resetGraph} style={styles.graphTextButton}>
                  <RotateCcw color="#475569" size={15} />
                  <Typography variant="caption" color="#475569" style={styles.boldText}>Reset</Typography>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity activeOpacity={0.78} onPress={onClose} style={styles.graphCollapseButton}>
                <Typography variant="caption" color={T.primary} style={styles.boldText}>Collapse</Typography>
                <ChevronUp color={T.primary} size={14} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.graphScrollContent}
          >
            <View style={[styles.graphCanvas, { width: graphWidth }]} {...panResponder.panHandlers}>
              <View style={styles.graphHint}>
                <Move color="#64748b" size={13} />
                <Typography variant="caption" color="#64748b">
                  drag nodes - click {contact.name.split(' ')[0]} to {kidsExpanded ? 'collapse' : 'expand'}
                </Typography>
              </View>
              <Svg width={graphWidth} height={GRAPH_H} viewBox={`0 0 ${graphWidth} ${GRAPH_H}`}>
                <Defs>
                  <LinearGradient id="ladLinkProfile" x1="0" x2="1">
                    <Stop offset="0%" stopColor={T.primary} stopOpacity="0.7" />
                    <Stop offset="100%" stopColor={T.primary} stopOpacity="0.15" />
                  </LinearGradient>
                  <LinearGradient id="ladLinkBlueProfile" x1="0" x2="1">
                    <Stop offset="0%" stopColor={T.linkedin} stopOpacity="0.1" />
                    <Stop offset="100%" stopColor={T.linkedin} stopOpacity="0.6" />
                  </LinearGradient>
                  <RadialGradient id="ladHaloProfile" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={T.primary} stopOpacity="0.18" />
                    <Stop offset="100%" stopColor={T.primary} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={graphCenter.x} cy={graphCenter.y} r={kidsExpanded ? 60 : 80} fill="url(#ladHaloProfile)" />
                {kidsExpanded ? childDefs.map((def) => {
                  const pos = getPos(def);
                  const style = linkStyleFor(def.linkType);
                  const path = linkPath(pos, graphCenter);
                  const faded = activeId && activeId !== def.id;
                  return (
                    <G key={`link-${def.id}`} opacity={faded ? 0.35 : 1}>
                      <Path
                        d={path}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.dash}
                        fill="none"
                      />
                      {def.linkType === 'primary' && def.label ? (
                        <G>
                          <SvgText
                            x={(pos.x + graphCenter.x) / 2}
                            y={(pos.y + graphCenter.y) / 2 - 6}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight="700"
                            fill={T.primary}
                          >
                            {Math.round(def.label.confidence * 100)}%
                          </SvgText>
                          <SvgText
                            x={(pos.x + graphCenter.x) / 2}
                            y={(pos.y + graphCenter.y) / 2 + 9}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#64748b"
                          >
                            {def.label.note}
                          </SvgText>
                        </G>
                      ) : null}
                    </G>
                  );
                }) : null}
                {kidsExpanded ? childDefs.map((def) => {
                  const pos = getPos(def);
                  return (
                    <GraphNodeSvg
                      key={def.id}
                      x={pos.x}
                      y={pos.y}
                      name={def.name}
                      sub={def.sub}
                      color={def.color}
                      badge={def.badge}
                      big={Boolean(def.big)}
                      active={activeId === def.id}
                    />
                  );
                }) : null}
                <GraphNodeSvg
                  x={graphCenter.x}
                  y={graphCenter.y}
                  name={contact.name.split(' ')[0]}
                  sub={kidsExpanded ? 'Click to collapse' : 'Click to expand'}
                  color={T.primary}
                  badge={contact.initials}
                  big
                  isProspect
                  collapsed={!kidsExpanded}
                  active={dragId.current === 'prospect'}
                />
              </Svg>
            </View>
          </ScrollView>

          <View style={styles.graphLegend}>
            <LegendItem color={T.primary} label="Strong route" />
            <LegendItem color={T.linkedin} label="Mutual" dashed />
            <LegendItem color={T.success} label="Customer reference" dashed />
            <LegendItem color="#0369a1" label="Shared employer" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function GraphNodeSvg({
  x,
  y,
  name,
  sub,
  color,
  badge,
  big = false,
  isProspect,
  collapsed,
  active,
}: {
  x: number;
  y: number;
  name: string;
  sub?: string;
  color: string;
  badge: string;
  big?: boolean;
  isProspect?: boolean;
  collapsed?: boolean;
  active?: boolean;
}) {
  const r = big ? 26 : 18;
  return (
    <G x={x} y={y}>
      <Circle r={r + 14} fill="transparent" />
      <Circle r={r + 4} fill="#fff" />
      <Circle r={r} fill={color} opacity={active ? 0.22 : 0.12} />
      <Circle r={r} fill="#fff" stroke={color} strokeWidth={isProspect ? 2.5 : active ? 2 : 1.5} />
      <SvgText
        x={0}
        y={4}
        textAnchor="middle"
        fontSize={big ? 13 : 10}
        fontWeight="800"
        fill={color}
      >
        {badge}
      </SvgText>
      {isProspect ? (
        <G x={r - 6} y={-r + 6}>
          <Circle r={7} fill={color} />
          <SvgText x={0} y={3.5} textAnchor="middle" fontSize={12} fontWeight="800" fill="#fff">
            {collapsed ? '+' : '-'}
          </SvgText>
        </G>
      ) : null}
      <G y={r + 18}>
        <SvgText x={0} y={0} textAnchor="middle" fontSize={11.5} fontWeight="800" fill={T.primaryHead}>
          {name}
        </SvgText>
        {sub ? (
          <SvgText x={0} y={15} textAnchor="middle" fontSize={10.5} fill="#56657f">
            {sub}
          </SvgText>
        ) : null}
      </G>
    </G>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { backgroundColor: dashed ? 'transparent' : color, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Typography variant="caption" color="#56657f">{label}</Typography>
    </View>
  );
}

function WarmMeta({ icon: Icon, label }: { icon: IconComponent; label: string }) {
  return (
    <View style={styles.warmMeta}>
      <Icon color="#64748b" size={12} />
      <Typography variant="caption" color="#64748b">{label}</Typography>
    </View>
  );
}

function ActivityHeatmap({ events, compact }: { events: ProspectEvent[]; compact: boolean }) {
  const days = 30;
  const channels = ['linkedin', 'whatsapp', 'email', 'voice', 'instagram', 'intent'];
  const grid = useMemo(() => {
    const out: Record<string, number[]> = {};
    channels.forEach((channel) => { out[channel] = new Array(days).fill(0); });
    events.forEach((event) => {
      const date = new Date(event.occurred_at);
      const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff >= days) return;
      const key = HEATMAP_CHANNEL[String(event.channel).toLowerCase()] || 'intent';
      if (!out[key]) out.intent[days - 1 - diff] += 1;
      else out[key][days - 1 - diff] += 1;
    });
    return out;
  }, [events]);
  const max = Math.max(1, ...channels.flatMap((channel) => grid[channel]));
  const cellSize = compact ? 10 : 18;

  return (
    <Card>
      <CardHeader title="Activity" subtitle={`Last ${days} days - all channels`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.heatmapInner}>
          {channels.map((channel) => {
            const meta = channelMeta(channel);
            const Icon = meta.Icon;
            const sum = grid[channel].reduce((a, b) => a + b, 0);
            return (
              <View key={channel} style={styles.heatRow}>
                <View style={styles.heatLabel}>
                  <Icon color={meta.color} size={13} />
                  <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{meta.label}</Typography>
                </View>
                <View style={styles.heatCells}>
                  {grid[channel].map((value, index) => (
                    <View
                      key={index}
                      style={[
                        styles.heatCell,
                        {
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: value ? meta.color : 'transparent',
                          opacity: value ? 0.25 + (value / max) * 0.75 : 1,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Typography variant="caption" color="#64748b" style={styles.heatSum}>{sum}</Typography>
              </View>
            );
          })}
          <View style={styles.heatFooter}>
            <Typography variant="caption" color="#64748b">{days} days ago</Typography>
            <Typography variant="caption" color="#64748b">Today</Typography>
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

function FitSignalsCard({ contact }: { contact: CrmContact }) {
  const signals = fitSignals(contact.raw);
  if (!signals.length) {
    return (
      <Card style={styles.equalCard}>
        <CardHeader title="Fit signals" subtitle="Not scored yet" />
        <View style={styles.emptyFit}>
          <Typography variant="bodySmall" color="#64748b" align="center">
            No fit signals for this prospect yet - fit is computed when it is discovered via a search.
          </Typography>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.equalCard}>
      <CardHeader title="Fit signals" subtitle={`ICP fit - score ${(contact.fit ?? 0).toFixed(2)}`} />
      <View style={styles.fitRows}>
        {signals.map((signal) => (
          <View key={signal.key} style={styles.fitRow}>
            <Typography variant="caption" color="#64748b" style={styles.fitLabel}>{signal.label}</Typography>
            <View style={styles.fitTrack}>
              <View style={[styles.fitFill, { width: `${signal.value * 100}%` }]} />
            </View>
            <Typography variant="caption" color={T.primaryHead} style={styles.fitNumber}>{Math.round(signal.value * 100)}</Typography>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ChannelMixCard({ contact }: { contact: CrmContact }) {
  const rolls = channelRollups(contact.raw);
  const total = rolls.reduce((sum, rollup) => sum + rollup.count, 0);
  return (
    <Card style={styles.equalCard}>
      <CardHeader title="Channel mix" subtitle={`${total} events - ${rolls.length} channels`} />
      {total === 0 ? (
        <View style={styles.emptyFit}>
          <Typography variant="bodySmall" color="#64748b">No channel events yet.</Typography>
        </View>
      ) : (
        <View style={styles.channelMixContent}>
          <View style={styles.donut}>
            <View style={styles.donutInner}>
              <Typography variant="overline" color="#64748b">Events</Typography>
              <Typography variant="h3" color={T.primaryHead} style={styles.kpiValue}>{total}</Typography>
            </View>
          </View>
          <View style={styles.channelLegend}>
            {rolls.map((rollup) => {
              const meta = channelMeta(rollup.channel);
              return (
                <View key={rollup.channel} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                  <Typography variant="caption" color={T.primaryHead} style={styles.legendName} numberOfLines={1}>{meta.label}</Typography>
                  <Typography variant="caption" color="#64748b">{rollup.count}</Typography>
                  <Typography variant="caption" color="#94a3b8" style={styles.percentText}>{Math.round((rollup.count / total) * 100)}%</Typography>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Card>
  );
}

function IntentCard({ contact }: { contact: CrmContact }) {
  const signals = intentSignals(contact.raw);
  if (!signals.length) return null;

  return (
    <Card>
      <CardHeader title="Intent" subtitle="Reasons to reach out this week" />
      <View style={styles.intentGrid}>
        {signals.map((signal) => {
          const meta = intentMeta(signal.signalType);
          const Icon = meta.Icon;
          return (
            <View key={signal.id} style={styles.intentCard}>
              <View style={[styles.intentIcon, { backgroundColor: `${meta.color}1a` }]}>
                <Icon color={meta.color} size={17} />
              </View>
              <Typography variant="overline" color="#64748b">{meta.label}</Typography>
              <Typography variant="bodySmall" color={T.primaryHead} style={styles.boldText}>{meta.description(signal.payload)}</Typography>
              <View style={styles.intentConfidence}>
                <View style={styles.fitTrack}>
                  <View style={[styles.fitFill, { width: `${signal.confidence * 100}%`, backgroundColor: meta.color }]} />
                </View>
                <Typography variant="caption" color="#64748b">{Math.round(signal.confidence * 100)}%</Typography>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function RecentActivityCard({ events }: { events: ProspectEvent[] }) {
  const recent = events.slice(0, 8);
  return (
    <Card>
      <CardHeader title="Recent activity" subtitle={`${events.length} total events`} />
      <View style={styles.feedList}>
        {recent.length ? recent.map((event) => {
          const meta = channelMeta(String(event.channel));
          const Icon = meta.Icon;
          return (
            <View key={`${event.seq}-${event.occurred_at}`} style={styles.feedItem}>
              <View style={[styles.feedIcon, { backgroundColor: `${meta.color}1a` }]}>
                <Icon color={meta.color} size={14} />
              </View>
              <View style={styles.feedCopy}>
                <Typography variant="caption" color="#64748b">
                  <Typography variant="caption" color={T.primaryHead} style={styles.boldText}>{meta.label}</Typography>
                  {` - ${event.direction || 'system'}  ${rel(event.occurred_at)} ago`}
                </Typography>
                <Typography variant="caption" color={T.primaryHead} numberOfLines={2}>
                  {payloadPreview(event.payload, event.event_type)}
                </Typography>
              </View>
            </View>
          );
        }) : (
          <Typography variant="bodySmall" color="#64748b">No activity yet.</Typography>
        )}
      </View>
    </Card>
  );
}

function ActionsCard({
  contact,
  warmPath,
  busyAction,
  onAction,
}: {
  contact: CrmContact;
  warmPath: WarmPath;
  busyAction: string | null;
  onAction: (action: 'quiet' | 'suppress' | 'intro' | 'message') => Promise<void>;
}) {
  const quietActive = Boolean(contact.raw.quiet_until && new Date(contact.raw.quiet_until).getTime() > Date.now());
  return (
    <Card>
      <CardHeader title="Take action" />
      <View style={styles.actionGrid}>
        <ActionButton icon={Route} label="Ask for intro" hint={`via ${warmPath.topConnection.name.split(' ')[0]}`} primary onPress={() => onAction('intro')} />
        <ActionButton icon={SendHorizontal} label="Send message" hint={`best: ${channelMeta(contact.raw.last_channel).label}`} onPress={() => onAction('message')} />
        <ActionButton
          icon={MoonStar}
          label={quietActive ? 'Quieted' : 'Quiet 7d'}
          hint={quietActive ? `until ${fmtDateTime(contact.raw.quiet_until)}` : 'pause outreach'}
          active={quietActive}
          busy={busyAction === 'quiet'}
          onPress={() => onAction('quiet')}
        />
        <ActionButton
          icon={Ban}
          label="Do not contact"
          hint={contact.raw.do_not_contact ? 'suppressed - click to lift' : 'hard suppress'}
          danger
          active={Boolean(contact.raw.do_not_contact)}
          busy={busyAction === 'suppress'}
          onPress={() => onAction('suppress')}
        />
      </View>
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  hint,
  primary,
  danger,
  active,
  busy,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  hint: string;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const color = primary ? '#fff' : danger ? T.danger : T.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={busy}
      onPress={onPress}
      style={[
        styles.actionButton,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        active && styles.actionActive,
      ]}
    >
      <View style={[styles.actionIcon, primary && styles.actionIconPrimary, danger && styles.actionIconDanger]}>
        {busy ? <ActivityIndicator color={color} size="small" /> : <Icon color={color} size={19} />}
      </View>
      <View style={styles.actionCopy}>
        <Typography variant="caption" color={color} style={styles.boldText} numberOfLines={1}>{label}</Typography>
        <Typography variant="caption" color={primary ? '#dbeafe' : '#64748b'} numberOfLines={1}>{hint}</Typography>
      </View>
    </TouchableOpacity>
  );
}

function NextFollowupsCard({ followups, loading }: { followups: ProspectFollowup[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader title="Next follow-ups" subtitle={loading ? 'Loading...' : followups.length ? `${followups.length} scheduled` : 'Automatic outreach'} />
      {loading ? (
        <Typography variant="bodySmall" color="#64748b">Checking the schedule...</Typography>
      ) : followups.length === 0 ? (
        <View style={styles.followupEmpty}>
          <CalendarClock color="#64748b" size={16} />
          <Typography variant="bodySmall" color="#64748b">No automatic follow-ups queued.</Typography>
        </View>
      ) : (
        <View style={styles.followupList}>
          {followups.map((followup) => {
            const meta = channelMeta(followup.channel);
            const Icon = meta.Icon;
            return (
              <View key={followup.id} style={styles.followupRow}>
                <View style={styles.followupIcon}>
                  <Icon color={meta.color} size={15} />
                </View>
                <View style={styles.followupCopy}>
                  <Typography variant="caption" color={T.primaryHead} style={styles.boldText} numberOfLines={1}>
                    {meta.label}{followup.type ? ` - ${titleCase(followup.type)}` : ''}
                  </Typography>
                  <Typography variant="caption" color="#64748b" numberOfLines={1}>
                    {fmtDateTime(followup.scheduled_time)}{followup.attempt ? ` - attempt ${followup.attempt}` : ''}
                  </Typography>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function Card({
  children,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: object;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderText}>
        <Typography variant="bodySmall" color={T.primaryHead} style={styles.cardTitle}>{title}</Typography>
        {subtitle ? <Typography variant="caption" color="#64748b">{subtitle}</Typography> : null}
      </View>
      {action}
    </View>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}1a` }]}>
      <View style={[styles.stageDot, { backgroundColor: color }]} />
      <Typography variant="caption" color={color} style={styles.boldText}>{label}</Typography>
    </View>
  );
}

function engagementDailyCounts(events: ProspectEvent[]) {
  const days = 7;
  const counts = new Array(days).fill(0);
  events.forEach((event) => {
    const date = new Date(event.occurred_at);
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  });
  return counts;
}

function warmRouteCount(warmPath: WarmPath) {
  return (
    (warmPath.topConnection ? 1 : 0) +
    (warmPath.sharedEmployer ? 1 : 0) +
    warmPath.mutualConnections.length +
    (warmPath.customerReference ? 1 : 0) +
    (warmPath.accountPipeline ? 1 : 0)
  );
}

function buildGraphChildren(warmPath: WarmPath, graphWidth: number, center: GraphPos): GraphChildDef[] {
  const out: GraphChildDef[] = [];
  const narrow = graphWidth < 560;
  const leftX = narrow ? Math.max(72, center.x - 128) : 150;
  const rightRadius = narrow ? Math.max(108, Math.min(148, graphWidth * 0.34)) : 250;
  const verticalRadius = narrow ? 76 : 90;
  out.push({
    id: 'champion',
    x: leftX,
    y: center.y,
    name: warmPath.topConnection.name,
    sub: warmPath.topConnection.headline.split(',')[0],
    color: T.primary,
    badge: initialsOf(warmPath.topConnection.name),
    big: true,
    label: {
      confidence: warmPath.topConnection.confidence,
      note: `ex-${warmPath.sharedEmployer?.company || 'colleagues'}`,
    },
    linkType: 'primary',
  });

  warmPath.mutualConnections.slice(0, 3).forEach((mutual, index, arr) => {
    const angles = arr.length === 1 ? [0] : arr.length === 2 ? [-24, 24] : [-35, 0, 35];
    const angle = (angles[index] * Math.PI) / 180;
    out.push({
      id: `mutual-${index}`,
      x: center.x + Math.cos(angle) * rightRadius,
      y: center.y + Math.sin(angle) * verticalRadius,
      name: mutual.name,
      sub: mutual.title,
      color: T.linkedin,
      badge: initialsOf(mutual.name),
      linkType: 'mutual',
    });
  });

  if (warmPath.customerReference) {
    out.push({
      id: 'customer',
      x: center.x,
      y: 44,
      name: warmPath.customerReference.via,
      sub: 'Mr LAD customer',
      color: T.success,
      badge: initialsOf(warmPath.customerReference.via),
      linkType: 'customer',
    });
  }

  if (warmPath.sharedEmployer) {
    out.push({
      id: 'employer',
      x: leftX,
      y: 260,
      name: warmPath.sharedEmployer.company,
      sub: warmPath.sharedEmployer.overlap,
      color: '#0369a1',
      badge: initialsOf(warmPath.sharedEmployer.company),
      linkType: 'employer',
    });
  }

  return out;
}

function linkPath(a: GraphPos, b: GraphPos) {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
}

function linkStyleFor(type: GraphChildDef['linkType']) {
  const stylesByType = {
    primary: { stroke: 'url(#ladLinkProfile)', strokeWidth: 3, dash: '' },
    mutual: { stroke: 'url(#ladLinkBlueProfile)', strokeWidth: 2, dash: '3 3' },
    customer: { stroke: 'rgba(34,197,94,0.55)', strokeWidth: 2, dash: '2 4' },
    employer: { stroke: 'rgba(3,105,161,0.45)', strokeWidth: 1.5, dash: '' },
  };
  return stylesByType[type];
}

function nearestGraphNode(
  point: GraphPos,
  childDefs: GraphChildDef[],
  getPos: (def: GraphChildDef) => GraphPos,
  kidsExpanded: boolean,
  center: GraphPos,
) {
  const centerDistance = distance(point, center);
  if (centerDistance <= 48) return 'prospect';
  if (!kidsExpanded) return null;

  let nearest: { id: string; distance: number } | null = null;
  for (const def of childDefs) {
    const d = distance(point, getPos(def));
    if (d <= (def.big ? 52 : 42) && (!nearest || d < nearest.distance)) {
      nearest = { id: def.id, distance: d };
    }
  }
  return nearest?.id || null;
}

function distance(a: GraphPos, b: GraphPos) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function intentMeta(signalType: string): { Icon: IconComponent; color: string; label: string; description: (payload: Record<string, unknown>) => string } {
  if (signalType === 'hiring.detected') {
    return { Icon: Users, color: T.linkedin, label: 'Hiring', description: (payload) => String(payload.role || 'Hiring signal') };
  }
  if (signalType === 'funding.raised') {
    return {
      Icon: TrendingUp,
      color: T.success,
      label: 'Funding',
      description: (payload) => `${payload.round || 'Round'} - $${Math.round(toNumber(payload.amount_usd) / 1_000_000)}M`,
    };
  }
  if (signalType === 'website.visited') {
    return {
      Icon: MousePointerClick,
      color: T.primary,
      label: 'On site',
      description: (payload) => `${asArray(payload.pages).length} pages - ${Math.round(toNumber(payload.session_dur_s ?? payload.duration_s) / 60)}m`,
    };
  }
  return { Icon: TrendingUp, color: T.primary, label: titleCase(signalType), description: () => titleCase(signalType) };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  content: {
    gap: 14,
    paddingTop: Theme.spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    flexWrap: 'wrap',
  },
  topBarCompact: {
    alignItems: 'stretch',
  },
  crumbRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  backButton: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  crumbName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '900',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  topActionsCompact: {
    width: '100%',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
  },
  topActionButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    backgroundColor: '#fff',
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  topActionButtonCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Theme.spacing.sm,
  },
  removeButton: {
    borderColor: '#fecdd3',
  },
  messageButton: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: T.primary,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  loadingCard: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    padding: Theme.spacing.md,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardPadded: {
    padding: Theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontWeight: '900',
  },
  heroCard: {
    marginTop: Theme.spacing.sm,
  },
  heroInner: {
    flexDirection: 'row',
  },
  heroInnerCompact: {
    flexDirection: 'column',
  },
  heroIdentity: {
    width: '34%',
    minWidth: 320,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    padding: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  heroIdentityCompact: {
    width: '100%',
    minWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  heroIdentityPhone: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: T.badgeBg,
  },
  profileImagePhone: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarPhone: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  avatarText: {
    fontWeight: '900',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroCopyPhone: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
    marginBottom: 4,
  },
  heroNameRowPhone: {
    justifyContent: 'flex-start',
    gap: Theme.spacing.sm,
  },
  heroName: {
    fontWeight: '900',
    flexShrink: 1,
  },
  locationLine: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationLinePhone: {
    marginTop: Theme.spacing.xs,
    justifyContent: 'flex-start',
  },
  contactLine: {
    marginTop: Theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  contactMini: {
    maxWidth: '100%',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.success,
  },
  kpiGrid: {
    flex: 1,
    flexDirection: 'row',
  },
  kpiGridCompact: {
    flexWrap: 'wrap',
  },
  kpiTile: {
    flex: 1,
    minWidth: 142,
    padding: Theme.spacing.lg,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  kpiTileColumn: {
    flex: 1,
    minWidth: 142,
    padding: Theme.spacing.lg,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    gap: Theme.spacing.xs,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 5,
    borderColor: T.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiText: {
    flex: 1,
    minWidth: 0,
  },
  kpiValue: {
    fontWeight: '900',
  },
  kpiNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Theme.spacing.xs,
  },
  sparkline: {
    position: 'relative',
    marginTop: Theme.spacing.xs,
    overflow: 'visible',
  },
  sparkBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: `${T.primary}33`,
  },
  sparkAreaHint: {
    position: 'absolute',
    width: 38,
    borderRadius: 8,
    backgroundColor: T.badgeBg,
    opacity: 0.7,
  },
  sparkSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
    backgroundColor: T.primary,
  },
  sparkLastDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.primary,
  },
  kpiTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  routeVia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  tinyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyAvatarText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  lastTouchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  channelDotLarge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  samplePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 5,
  },
  noticePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: T.badgeBg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
  },
  graphButton: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: T.badgeBg,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyWarmPath: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  warmSummary: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  warmIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: T.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmSummaryText: {
    flex: 1,
    minWidth: 0,
  },
  warmMetaRow: {
    marginTop: Theme.spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  warmMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  graphModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  graphBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  graphSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  graphHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    marginBottom: Theme.spacing.xs,
  },
  graphSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  graphTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  graphSheetTitle: {
    fontWeight: '900',
  },
  graphHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  graphTextButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  graphCollapseButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: T.badgeBg,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  graphScrollContent: {
    paddingVertical: Theme.spacing.xs,
  },
  graphCanvas: {
    width: GRAPH_W,
    height: GRAPH_H,
    position: 'relative',
    backgroundColor: '#fff',
  },
  graphHint: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 5,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  graphLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 14,
    height: 2,
    borderTopWidth: 2,
    borderRadius: 999,
  },
  heatmapInner: {
    gap: 7,
    paddingBottom: 2,
  },
  heatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  heatLabel: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heatCells: {
    flexDirection: 'row',
    gap: 3,
  },
  heatCell: {
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  heatSum: {
    width: 28,
    textAlign: 'right',
  },
  heatFooter: {
    marginLeft: 90 + Theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  bottomGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    alignItems: 'flex-start',
  },
  mobileBottomStack: {
    flexDirection: 'column',
    gap: Theme.spacing.md,
    width: '100%',
  },
  singleColumnGrid: {
    flexDirection: 'column',
  },
  equalCard: {
    flex: 1,
    minHeight: 220,
  },
  emptyFit: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitRows: {
    gap: Theme.spacing.sm,
  },
  fitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  fitLabel: {
    width: 82,
  },
  fitTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: T.badgeBg,
    overflow: 'hidden',
  },
  fitFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: T.primary,
  },
  fitNumber: {
    width: 34,
    textAlign: 'right',
    fontWeight: '900',
  },
  channelMixContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  donut: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 14,
    borderColor: T.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInner: {
    alignItems: 'center',
  },
  channelLegend: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontWeight: '800',
  },
  percentText: {
    width: 40,
    textAlign: 'right',
  },
  intentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  intentCard: {
    flexGrow: 1,
    flexBasis: 240,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 16,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  intentIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  feedColumn: {
    flex: 2,
    minWidth: 0,
  },
  sideColumn: {
    flex: 1,
    minWidth: 280,
    gap: Theme.spacing.md,
  },
  feedList: {
    gap: Theme.spacing.md,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  feedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  actionPrimary: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  actionDanger: {
    borderColor: '#fecdd3',
    backgroundColor: '#fff',
  },
  actionActive: {
    borderWidth: 2,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  actionIconDanger: {
    backgroundColor: '#fff1f2',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  followupEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  followupList: {
    gap: Theme.spacing.md,
  },
  followupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  followupIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followupCopy: {
    flex: 1,
    minWidth: 0,
  },
  boldText: {
    fontWeight: '900',
  },
});
