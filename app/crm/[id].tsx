import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Platform,
  Pressable,
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
  EllipsisVertical,
  Move,
  Mail,
  MapPin,
  MessageCircle,
  MoonStar,
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
import { useAppTheme } from '@/src/theme/appTheme';
import {
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

function useProfilePalette() {
  const appTheme = useAppTheme();
  return useMemo(() => ({
    darkMode: appTheme.darkMode,
    background: appTheme.darkMode ? '#0F172A' : '#F8F9FE',
    surface: appTheme.surface,
    surfaceElevated: appTheme.darkMode ? '#172033' : '#FFFFFF',
    softSurface: appTheme.softSurface,
    input: appTheme.input,
    text: appTheme.text,
    muted: appTheme.muted,
    disabled: appTheme.disabled,
    border: appTheme.border,
    borderSoft: appTheme.borderSoft,
    primary: appTheme.darkMode ? '#B8C7FF' : T.primary,
    primaryStrong: appTheme.darkMode ? '#FFFFFF' : T.primaryHead,
    badgeBg: appTheme.darkMode ? 'rgba(184, 199, 255, 0.16)' : T.badgeBg,
    pillBg: appTheme.darkMode ? '#1E293B' : '#F8FAFC',
    dangerBg: appTheme.darkMode ? 'rgba(239, 68, 68, 0.12)' : '#FFF1F2',
    dangerBorder: appTheme.darkMode ? 'rgba(248, 113, 113, 0.34)' : '#FECDD3',
    dangerText: appTheme.darkMode ? '#FCA5A5' : '#E11D48',
    warningBg: appTheme.darkMode ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
    warningBorder: appTheme.darkMode ? 'rgba(251, 191, 36, 0.34)' : '#FDE68A',
    warningText: appTheme.darkMode ? '#FCD34D' : '#92400E',
    graphCanvas: appTheme.darkMode ? '#0F172A' : '#FFFFFF',
    overlay: appTheme.darkMode ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.38)',
  }), [appTheme]);
}

const CHANNELS: Record<string, { label: string; color: string; Icon: IconComponent }> = {
  linkedin: { label: 'LinkedIn', color: T.linkedin, Icon: BriefcaseBusiness },
  whatsapp: { label: 'WhatsApp', color: T.whatsapp, Icon: MessageCircle },
  waba: { label: 'WhatsApp', color: T.whatsapp, Icon: MessageCircle },
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
  summary?: string;
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

const EMPTY_WARM_PATH: WarmPath = {
  topConnection: { name: '', headline: '', confidence: 0 },
  sharedEmployer: null,
  mutualConnections: [],
  customerReference: null,
  accountPipeline: null,
  sample: false,
};

const LAD_FRONTEND_WARM_PATH: WarmPath = {
  topConnection: {
    name: 'Anil Mehra',
    headline: 'Head of Partnerships, BlueBridge',
    confidence: 0.92,
  },
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
const DEGREE_LABELS: Record<string, string> = {
  FIRST_DEGREE: '1st-degree',
  SECOND_DEGREE: '2nd-degree',
  THIRD_DEGREE: '3rd-degree',
};

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

function cleanText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function numberOrNull(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeNetworkDistance(value: unknown) {
  const text = cleanText(value).toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    '1': 'FIRST_DEGREE',
    '1ST': 'FIRST_DEGREE',
    FIRST: 'FIRST_DEGREE',
    FIRST_DEGREE: 'FIRST_DEGREE',
    '2': 'SECOND_DEGREE',
    '2ND': 'SECOND_DEGREE',
    SECOND: 'SECOND_DEGREE',
    SECOND_DEGREE: 'SECOND_DEGREE',
    '3': 'THIRD_DEGREE',
    '3RD': 'THIRD_DEGREE',
    THIRD: 'THIRD_DEGREE',
    THIRD_DEGREE: 'THIRD_DEGREE',
  };
  return aliases[text] || text;
}

function networkDegreeLabel(value: unknown) {
  const normalized = normalizeNetworkDistance(value);
  return DEGREE_LABELS[normalized] || titleCase(normalized);
}

function employmentItems(raw: Record<string, any>) {
  const nested = asRecord(raw.profile || raw.person || raw.contact || raw.linkedin_profile || raw.linkedinProfile);
  return [
    ...asArray(raw.employment_history),
    ...asArray(raw.employmentHistory),
    ...asArray(raw.experience),
    ...asArray(raw.experiences),
    ...asArray(raw.work_experience),
    ...asArray(raw.workExperience),
    ...asArray(nested.employment_history),
    ...asArray(nested.employmentHistory),
    ...asArray(nested.experience),
  ].map((item) => {
    if (typeof item === 'string') return { company: item };
    return asRecord(item);
  }).filter((item) => Object.keys(item).length);
}

function companyNamesFromRaw(raw: Record<string, any>, contact?: CrmContact) {
  const companies = [
    cleanText(contact?.company),
    cleanText(raw.company_name),
    cleanText(raw.companyName),
    cleanText(raw.company),
    cleanText(raw.organization_name),
    cleanText(raw.account_name),
    ...asArray(raw.company_names).map(cleanText),
    ...asArray(raw.companyNames).map(cleanText),
    ...employmentItems(raw).map((item) => firstText(item.company, item.company_name, item.organization, item.name)),
  ].filter(Boolean);
  return Array.from(new Set(companies));
}

function isLinkedInBacked(raw: Record<string, any>, contact?: CrmContact) {
  return [
    raw.linkedin_url,
    raw.linkedinUrl,
    raw.linkedin,
    raw.profile_url,
    raw.profileUrl,
    raw.source,
    raw.fit_source,
    raw.last_channel,
    raw.profile_enrichment_source,
    contact?.source,
  ].some((value) => String(value || '').toLowerCase().includes('linkedin'));
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
  const normalized = String(channel || 'system').toLowerCase();
  return CHANNELS[normalized] || CHANNELS[HEATMAP_CHANNEL[normalized]] || CHANNELS.system;
}

function lastTouchMeta(channel?: string | null) {
  const normalized = String(channel || '').toLowerCase().replace(/\s+/g, '_');
  const canonical = HEATMAP_CHANNEL[normalized] || normalized;
  if (
    canonical === 'intent' ||
    normalized.includes('signal') ||
    normalized.includes('intent') ||
    normalized.includes('fit')
  ) {
    return CHANNELS.system;
  }
  return channelMeta(channel);
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
    const eventsByType = asRecord(record.events_by_type ?? record.eventsByType);
    const count = typeof record.count === 'number'
      ? record.count
      : Object.values(eventsByType).reduce<number>((sum, value) => sum + toNumber(value), 0);
    const topEventType = Object.entries(eventsByType)
      .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))[0]?.[0];
    return {
      channel: String(channel),
      count,
      eventType: firstText(record.last_event_type, record.lastEventType, record.event_type, topEventType, raw.last_event_type, 'activity'),
      direction: firstText(record.last_direction, record.direction, 'outbound') as ProspectEvent['direction'],
      lastEventAt: firstText(record.last_event_at, record.lastEventAt, raw.last_event_at, raw.updated_at) || null,
    };
  }).filter((item) => item.count > 0);
}

function activityWeight(event: ProspectEvent) {
  const payload = asRecord(event.payload);
  return Math.max(1, Math.round(toNumber(payload.rollup_count, 1)));
}

function eventTime(event: ProspectEvent) {
  const time = new Date(event.occurred_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function resolveProfileActivity(contact: CrmContact, events: ProspectEvent[]) {
  const normalizedEvents = events
    .filter((event) => event?.occurred_at)
    .map((event, index) => ({
      ...event,
      seq: typeof event.seq === 'number' ? event.seq : index,
      channel: String(event.channel || 'system'),
      event_type: String(event.event_type || 'activity'),
      direction: event.direction || 'system',
      payload: asRecord(event.payload),
    }))
    .sort((a, b) => eventTime(b) - eventTime(a));
  const realCountsByChannel = normalizedEvents.reduce<Record<string, number>>((acc, event) => {
    const channel = HEATMAP_CHANNEL[String(event.channel).toLowerCase()] || 'intent';
    acc[channel] = (acc[channel] || 0) + activityWeight(event);
    return acc;
  }, {});
  const rollupEvents = channelRollups(contact.raw)
    .filter((rollup) => rollup.lastEventAt)
    .map((rollup) => {
      const channel = HEATMAP_CHANNEL[String(rollup.channel).toLowerCase()] || 'intent';
      return { ...rollup, remainingCount: Math.max(0, rollup.count - (realCountsByChannel[channel] || 0)) };
    })
    .filter((rollup) => rollup.remainingCount > 0)
    .map((rollup, index) => ({
      id: `${contact.id}-rollup-${rollup.channel}`,
      seq: -1000 - index,
      prospect_id: contact.id,
      channel: rollup.channel,
      event_type: rollup.eventType,
      direction: rollup.direction || 'outbound',
      payload: {
        rollup_count: rollup.remainingCount,
        preview: `${channelMeta(rollup.channel).label} activity from backend rollup`,
      },
      occurred_at: String(rollup.lastEventAt),
    } as ProspectEvent));
  const hasActivity = normalizedEvents.length || rollupEvents.length;
  const rawFallback = !hasActivity && contact.lastActivityAt
    ? [{
      id: `${contact.id}-last-touch`,
      seq: -1,
      prospect_id: contact.id,
      channel: String(contact.raw.last_channel || 'system'),
      event_type: String(contact.raw.last_event_type || 'activity'),
      direction: 'outbound',
      payload: { preview: 'Last backend activity' },
      occurred_at: contact.lastActivityAt,
    } as ProspectEvent]
    : [];
  return [...normalizedEvents, ...rollupEvents, ...rawFallback].sort((a, b) => eventTime(b) - eventTime(a));
}

function resolveLastTouch(contact: CrmContact, activity: ProspectEvent[]) {
  const latest = activity[0];
  if (latest) {
    return {
      channel: String(latest.channel || contact.raw.last_channel || 'system'),
      occurredAt: latest.occurred_at || contact.lastActivityAt,
      direction: latest.direction || contact.raw.last_event_type || 'system',
    };
  }
  return {
    channel: String(contact.raw.last_channel || 'system'),
    occurredAt: contact.lastActivityAt,
    direction: contact.raw.last_event_type || 'system',
  };
}

function buildWarmPath(contact: CrmContact): WarmPath {
  const raw = asRecord(contact.raw);
  const root = asRecord(raw.warm_path || raw.warmPath || raw.relationship_graph || raw.relationships);
  const topRecord = asRecord(root.top_connection || root.topConnection || raw.top_connection || raw.warm_path_contact);
  const topName = String(topRecord.name || raw.warm_path_name || raw.intro_contact_name || '').trim();
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

  if (topName) {
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

  return LAD_FRONTEND_WARM_PATH;
}

export default function CrmProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; source?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const palette = useProfilePalette();
  const { width, height } = useWindowDimensions();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const source = Array.isArray(params.source) ? params.source[0] : params.source;
  const isCompact = width < 1024;
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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const enrichTriggered = useRef(false);

  const loadProfile = useCallback(async (asRefresh = false) => {
    if (!id) return;
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [prospect, nextEvents, nextFollowups] = await Promise.all([
        getProspect(id, { source }),
        listProspectEvents(id, { limit: 100, source }).catch(() => []),
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
  }, [id, source]);

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
      const listeners = LIVE_EVENTS.map((event) => ({
        event,
        refresh: (payload?: unknown) => {
          const record = asRecord(payload);
          const nestedLead = asRecord(record.lead);
          const nestedContact = asRecord(record.contact);
          const candidateIds = [
            record.prospect_id,
            record.prospectId,
            record.lead_id,
            record.leadId,
            record.contact_id,
            record.contactId,
            nestedLead.id,
            nestedContact.id,
          ].map((value) => String(value || '')).filter(Boolean);
          const recordId = String(record.id || '');
          if (
            !candidateIds.length ||
            candidateIds.includes(id) ||
            ((event.includes('prospect') || event.includes('crm')) && recordId === id)
          ) {
            void loadProfile(true);
          }
        },
      }));
      listeners.forEach(({ event, refresh }) => socket?.on(event, refresh));
      return () => {
        listeners.forEach(({ event, refresh }) => socket?.off(event, refresh));
      };
    } catch {
      return undefined;
    }
  }, [id, loadProfile]);

  useEffect(() => {
    if (!contact || enrichTriggered.current) return;
    const currentWarmPath = buildWarmPath(contact);
    const needsDetailedWarmPath = !currentWarmPath.topConnection.name;
    const canEnrich = Boolean(contact.raw.linkedin_url || contact.raw.linkedinUrl || isLinkedInBacked(asRecord(contact.raw), contact));
    if (canEnrich && (!contact.raw.profile_enriched_at || needsDetailedWarmPath)) {
      enrichTriggered.current = true;
      void enrichProspect(contact.id)
        .then((result) => {
          const enriched = asRecord(result);
          if (Object.keys(enriched).length) {
            setContact((current) => {
              if (!current || current.id !== contact.id) return current;
              return toCrmContact({
                ...current.raw,
                ...enriched,
                profile_enriched_at: enriched.profile_enriched_at || enriched.profileEnrichedAt || current.raw.profile_enriched_at || new Date().toISOString(),
              } as ProspectState);
            });
          }
          [2500, 8000, 18000].forEach((delay) => setTimeout(() => void loadProfile(true), delay));
        })
        .catch(() => undefined);
    }
  }, [contact, loadProfile]);

  const warmPath = useMemo(() => contact ? buildWarmPath(contact) : EMPTY_WARM_PATH, [contact]);
  const profileActivity = useMemo(() => contact ? resolveProfileActivity(contact, events) : [], [contact, events]);
  const temperature = useMemo(() => contact ? engagementTemperature(contact, profileActivity) : null, [contact, profileActivity]);

  useEffect(() => {
    if (!warmPath.topConnection.name && graphVisible) {
      setGraphVisible(false);
    }
  }, [graphVisible, warmPath.topConnection.name]);

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
    setActionMenuOpen(false);
    if (action === 'intro') {
      if (!warmPath.topConnection.name || warmPath.sample) {
        setNotice(`No live warm intro route found yet for ${contact.name}.`);
        return;
      }
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
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: palette.background }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadProfile(true)} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {actionMenuOpen ? (
          <Pressable style={styles.profileMenuDismissLayer} onPress={() => setActionMenuOpen(false)} />
        ) : null}
        <ProfileTopBar
          name={contact?.name || 'Prospect'}
          onBack={handleBack}
          onRemove={handleRemove}
          removing={busyAction === 'remove'}
          contact={contact}
          warmPath={warmPath}
          busyAction={busyAction}
          menuOpen={actionMenuOpen}
          onToggleMenu={() => setActionMenuOpen((current) => !current)}
          onCloseMenu={() => setActionMenuOpen(false)}
          onAction={handleAction}
          onMessage={() => void handleAction('message')}
          compact={isPhone}
        />

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: palette.dangerBg, borderColor: palette.dangerBorder }]}>
            <Typography variant="bodySmall" color={palette.dangerText}>{error}</Typography>
          </View>
        ) : null}

        {loading || !contact ? (
          <View style={[styles.loadingCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
            <ActivityIndicator color={palette.primary} />
            <Typography variant="bodySmall" color={palette.muted}>Loading contact profile...</Typography>
          </View>
        ) : (
          <>
            <HeroKpis
              contact={contact}
              events={profileActivity}
              warmPath={warmPath}
              temperature={temperature}
              compact={isCompact}
              phone={isPhone}
              onWarmPress={toggleWarmPath}
              warmOpen={graphVisible}
            />

            {notice ? (
              <View style={[styles.noticePill, { backgroundColor: palette.badgeBg }]}>
                <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText}>{notice}</Typography>
              </View>
            ) : null}

            {warmPath.sample ? (
              <View style={[styles.samplePill, { backgroundColor: palette.warningBg, borderColor: palette.warningBorder }]}>
                <Typography variant="caption" color={palette.warningText} style={styles.boldText}>
                  Warm-path preview
                </Typography>
              </View>
            ) : null}

            <WarmPathCard
              contact={contact}
              warmPath={warmPath}
              open={graphVisible}
              onToggle={toggleWarmPath}
            />

            <ActivityHeatmap events={profileActivity} compact={isPhone} />

            <View style={[styles.twoColumnGrid, isCompact && styles.singleColumnGrid]}>
              <FitSignalsCard contact={contact} />
              <ChannelMixCard contact={contact} />
            </View>

            <IntentCard contact={contact} />

            {isCompact ? (
              <View style={styles.mobileBottomStack}>
                <RecentActivityCard events={profileActivity} />
                <ActionsCard
                  contact={contact}
                  warmPath={warmPath}
                  busyAction={busyAction}
                  onAction={handleAction}
                />
                <NextFollowupsCard followups={followups} loading={refreshing} />
              </View>
            ) : (
              <View style={styles.bottomGrid}>
                <View style={styles.feedColumn}>
                  <RecentActivityCard events={profileActivity} />
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
  contact,
  warmPath,
  busyAction,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onAction,
  onMessage,
  compact,
}: {
  name: string;
  onBack: () => void;
  onRemove: () => void;
  removing: boolean;
  contact: CrmContact | null;
  warmPath: WarmPath;
  busyAction: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onAction: (action: 'quiet' | 'suppress' | 'intro' | 'message') => Promise<void>;
  onMessage: () => void;
  compact: boolean;
}) {
  const palette = useProfilePalette();
  const quietActive = Boolean(contact?.raw.quiet_until && new Date(contact.raw.quiet_until).getTime() > Date.now());
  const hasIntroRoute = Boolean(warmPath.topConnection.name && !warmPath.sample);
  const actions: Array<{
    key: 'intro' | 'message' | 'quiet' | 'suppress';
    label: string;
    hint: string;
    Icon: IconComponent;
    danger?: boolean;
    busy?: boolean;
  }> = contact ? [
    {
      key: 'intro',
      label: 'Ask for intro',
      hint: hasIntroRoute ? `via ${warmPath.topConnection.name.split(' ')[0]}` : 'no warm route yet',
      Icon: Route,
    },
    {
      key: 'message',
      label: 'Send message',
      hint: `best: ${channelMeta(contact.raw.last_channel).label}`,
      Icon: SendHorizontal,
    },
    {
      key: 'quiet',
      label: quietActive ? 'Quieted' : 'Quiet 7d',
      hint: quietActive ? `until ${fmtDateTime(contact.raw.quiet_until)}` : 'pause outreach',
      Icon: MoonStar,
      busy: busyAction === 'quiet',
    },
    {
      key: 'suppress',
      label: 'Do not contact',
      hint: contact.raw.do_not_contact ? 'suppressed - click to lift' : 'hard suppress',
      Icon: Ban,
      danger: true,
      busy: busyAction === 'suppress',
    },
  ] : [];
  return (
    <View style={[styles.topBar, compact && styles.topBarCompact]}>
      <View style={styles.crumbRow}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.76} style={styles.backButton}>
          <ArrowLeft color={palette.muted} size={14} />
          <Typography variant="caption" color={palette.muted} style={styles.boldText}>All deals</Typography>
        </TouchableOpacity>
        <Typography variant="caption" color={palette.border}>/</Typography>
        <Typography variant="caption" color={palette.primaryStrong} style={styles.crumbName} numberOfLines={1}>
          {name}
        </Typography>
      </View>
      <View style={[styles.topActions, compact && styles.topActionsCompact]}>
        {menuOpen ? <Pressable style={styles.topActionsMenuDismissLayer} onPress={onCloseMenu} /> : null}
        <TouchableOpacity
          onPress={onRemove}
          disabled={removing}
          activeOpacity={0.78}
          style={[
            styles.topActionButton,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.dangerBorder },
            compact && styles.topActionButtonCompact,
          ]}
        >
          {removing ? <ActivityIndicator color={palette.dangerText} size="small" /> : <Trash2 color={palette.dangerText} size={15} />}
          <Typography variant="caption" color={palette.dangerText} style={styles.boldText}>Not a fit</Typography>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMessage} activeOpacity={0.78} style={[styles.messageButton, compact && styles.messageButtonCompact]}>
          <SendHorizontal color="#fff" size={15} />
          <Typography variant="caption" color="#fff" style={styles.boldText}>Message</Typography>
        </TouchableOpacity>
        <View style={styles.moreActionWrap}>
          <TouchableOpacity
            onPress={onToggleMenu}
            activeOpacity={0.78}
            disabled={!contact}
            style={[
              styles.messageMoreButton,
              { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
              !contact && styles.disabledAction,
            ]}
          >
            <EllipsisVertical color={palette.primaryStrong} size={17} />
          </TouchableOpacity>
          {menuOpen && actions.length ? (
            <View style={[styles.actionMenu, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
              {actions.map(({ key, label, hint, Icon, danger, busy }) => (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.78}
                  disabled={busy}
                  onPress={() => void onAction(key)}
                  style={[styles.actionMenuItem, { borderBottomColor: palette.borderSoft }]}
                >
                  <View style={[styles.actionMenuIcon, { backgroundColor: danger ? palette.dangerBg : palette.badgeBg }]}>
                    {busy ? (
                      <ActivityIndicator color={danger ? palette.dangerText : palette.primary} size="small" />
                    ) : (
                      <Icon color={danger ? palette.dangerText : palette.primary} size={15} />
                    )}
                  </View>
                  <View style={styles.actionMenuCopy}>
                    <Typography variant="caption" color={danger ? palette.dangerText : palette.primaryStrong} style={styles.boldText} numberOfLines={1}>
                      {label}
                    </Typography>
                    <Typography variant="caption" color={palette.muted} numberOfLines={1}>{hint}</Typography>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
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
  const palette = useProfilePalette();
  const raw = contact.raw;
  const stage = STAGE_META[contact.stage] || STAGE_META.new;
  const avatarUrl = profileImageUrl(raw);
  const dailyCounts = useMemo(() => engagementDailyCounts(events), [events]);
  const total7d = dailyCounts.reduce((sum, count) => sum + count, 0);
  const routeCount = warmRouteCount(warmPath);
  const lastTouch = useMemo(() => resolveLastTouch(contact, events), [contact, events]);
  const titleLine = contact.title || raw.headline || 'Prospect';
  const companyLine = contact.company || firstText(raw.company, raw.organization_name, raw.account_name);
  const locationLine = contact.geo || firstText(raw.geo, raw.city, raw.region, raw.country, raw.address);

  return (
    <Card padded={false} style={styles.heroCard}>
      <View style={[styles.heroInner, compact && styles.heroInnerCompact]}>
        <View
          style={[
            styles.heroIdentity,
            { borderRightColor: palette.borderSoft, borderBottomColor: palette.borderSoft },
            compact && styles.heroIdentityCompact,
            phone && styles.heroIdentityPhone,
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[styles.profileImage, phone && styles.profileImagePhone]} contentFit="cover" />
          ) : (
            <View style={[styles.heroAvatar, phone && styles.heroAvatarPhone]}>
              <Typography variant="h3" color="#fff" style={styles.avatarText}>{contact.initials}</Typography>
            </View>
          )}
          <View style={[styles.heroCopy, phone && styles.heroCopyPhone]}>
            <View style={[styles.heroNameRow, phone && styles.heroNameRowPhone]}>
              <Typography variant="h3" color={palette.text} style={styles.heroName} numberOfLines={2}>
                {contact.name}
              </Typography>
                <StatusPill label={stage.label} color={stage.color} />
                {!phone && temperature ? <StatusPill label={temperature.label} color={temperature.color} /> : null}
              </View>
            <Typography variant="bodySmall" color={palette.text} numberOfLines={phone ? 2 : 1}>
              {titleLine}
            </Typography>
            <Typography variant="caption" color={palette.muted} numberOfLines={phone ? 2 : 1}>
              {companyLine || 'No company'}
            </Typography>
            <View style={[styles.locationLine, phone && styles.locationLinePhone]}>
              <MapPin color={palette.muted} size={12} />
              <Typography variant="caption" color={palette.muted} numberOfLines={phone ? 2 : 1}>
                {locationLine || 'Location unavailable'}
              </Typography>
            </View>
            <View style={styles.contactLine}>
              <ContactMini icon={Mail} label={contact.email || 'No email'} verified={contact.emailVerified} />
              <ContactMini icon={Phone} label={contact.phone || 'No phone'} verified={contact.phoneVerified} />
            </View>
          </View>
        </View>
        <View style={[styles.kpiGrid, compact && styles.kpiGridCompact]}>
          <KpiFit value={contact.fit ?? null} />
          <KpiSpark counts={dailyCounts} total={total7d} />
          <KpiRoutes count={routeCount} top={warmPath.topConnection.name} open={warmOpen} onPress={onWarmPress} />
          <KpiLast channel={lastTouch.channel} occurredAt={lastTouch.occurredAt} direction={String(lastTouch.direction)} />
        </View>
      </View>
    </Card>
  );
}

function ContactMini({ icon: Icon, label, verified }: { icon: IconComponent; label: string; verified?: boolean }) {
  const palette = useProfilePalette();
  return (
    <View style={[styles.contactMini, { backgroundColor: palette.pillBg }]}>
      <Icon color={palette.muted} size={12} />
      <Typography variant="caption" color={palette.muted} numberOfLines={1}>{label}</Typography>
      {verified ? <View style={styles.verifiedDot} /> : null}
    </View>
  );
}

function KpiFit({ value }: { value: number | null }) {
  const palette = useProfilePalette();
  const band = scoreBand(value);
  return (
    <View style={[styles.kpiTile, { borderRightColor: palette.borderSoft, borderBottomColor: palette.borderSoft }]}>
      <View style={[styles.scoreCircle, { borderColor: palette.badgeBg }]}>
        <Typography variant="bodyLarge" color={palette.primaryStrong} style={styles.kpiValue}>{band.level}</Typography>
      </View>
      <View style={styles.kpiText}>
        <Typography variant="overline" color={palette.muted}>Fit score</Typography>
        <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText}>{band.label}</Typography>
        <Typography variant="caption" color={palette.muted}>{value == null ? 'Scored on discovery' : 'Fit to active ICP'}</Typography>
      </View>
    </View>
  );
}

function KpiSpark({ counts, total }: { counts: number[]; total: number }) {
  const palette = useProfilePalette();
  return (
    <View style={[styles.kpiTileColumn, { borderRightColor: palette.borderSoft, borderBottomColor: palette.borderSoft }]}>
      <Typography variant="overline" color={palette.muted}>Engagement - 7d</Typography>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color={palette.text} style={styles.kpiValue}>{total}</Typography>
        <Typography variant="caption" color={palette.muted}>events</Typography>
      </View>
      <Sparkline counts={counts} />
    </View>
  );
}

function Sparkline({ counts }: { counts: number[] }) {
  const palette = useProfilePalette();
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
      <View style={[styles.sparkBaseline, { top: height - padBottom, backgroundColor: `${palette.primary}44` }]} />
      <View style={[styles.sparkAreaHint, { left: Math.max(0, last.x - 36), top: Math.max(padTop, last.y), height: Math.max(8, height - padBottom - last.y), backgroundColor: palette.badgeBg }]} />
      {points.slice(0, -1).map((point, index) => (
        <SparkSegment key={index} from={point} to={points[index + 1]} />
      ))}
      <View style={[styles.sparkLastDot, { left: last.x - 3, top: last.y - 3, backgroundColor: palette.primary }]} />
    </View>
  );
}

function SparkSegment({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const palette = useProfilePalette();
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
          backgroundColor: palette.primary,
          transform: [{ rotate: angle }],
        },
      ]}
    />
  );
}

function KpiRoutes({ count, top, open, onPress }: { count: number; top: string; open: boolean; onPress: () => void }) {
  const palette = useProfilePalette();
  const hasRoute = Boolean(top);
  return (
    <TouchableOpacity activeOpacity={0.78} disabled={!hasRoute} onPress={onPress} style={[styles.kpiTileColumn, { borderRightColor: palette.borderSoft, borderBottomColor: palette.borderSoft }]}>
      <View style={styles.kpiTopLine}>
        <Typography variant="overline" color={palette.muted}>Warm routes</Typography>
        {hasRoute ? (open ? <ChevronUp color={palette.primary} size={13} /> : <ChevronDown color={palette.primary} size={13} />) : null}
      </View>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color={palette.text} style={styles.kpiValue}>{count}</Typography>
        <Typography variant="caption" color={palette.primary} style={styles.boldText}>paths</Typography>
      </View>
      <View style={styles.routeVia}>
        <View style={styles.tinyAvatar}><Typography variant="caption" color="#fff" style={styles.tinyAvatarText}>{hasRoute ? initialsOf(top) : '-'}</Typography></View>
        <Typography variant="caption" color={palette.muted} numberOfLines={1}>
          {hasRoute ? (
            <>via <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText}>{top}</Typography></>
          ) : 'No path yet'}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function KpiLast({ channel, occurredAt, direction }: { channel?: string | null; occurredAt?: string | null; direction?: string | null }) {
  const palette = useProfilePalette();
  const meta = lastTouchMeta(channel);
  const Icon = meta.Icon;
  return (
    <View style={[styles.kpiTileColumn, { borderRightColor: palette.borderSoft, borderBottomColor: palette.borderSoft }]}>
      <Typography variant="overline" color={palette.muted}>Last touch</Typography>
      <View style={styles.kpiNumberRow}>
        <Typography variant="h2" color={palette.text} style={styles.kpiValue}>{rel(occurredAt)}</Typography>
        <Typography variant="caption" color={palette.muted}>ago</Typography>
      </View>
      <View style={styles.lastTouchPill}>
        <View style={[styles.channelDotLarge, { backgroundColor: `${meta.color}1a` }]}>
          <Icon color={meta.color} size={12} />
        </View>
        <Typography variant="caption" color={meta.color} style={styles.boldText}>{meta.label}</Typography>
        <Typography variant="caption" color={palette.muted}>{direction === 'inbound' ? 'reply' : 'sent'}</Typography>
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
  const palette = useProfilePalette();
  if (!warmPath.topConnection.name) {
    return (
      <Card>
        <CardHeader title="Warm Path" subtitle="Routes from your network to this prospect" />
        <View style={styles.emptyWarmPath}>
          <RouteOff color={palette.disabled} size={22} />
          <Typography variant="bodySmall" color={palette.muted}>No paths found yet.</Typography>
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
          <TouchableOpacity activeOpacity={0.78} onPress={onToggle} style={[styles.graphButton, { backgroundColor: palette.badgeBg }]}>
            <Typography variant="caption" color={palette.primary} style={styles.boldText}>{open ? 'Collapse' : 'Open graph'}</Typography>
            {open ? <ChevronUp color={palette.primary} size={13} /> : <ChevronDown color={palette.primary} size={13} />}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity activeOpacity={0.82} onPress={onToggle} style={[styles.warmSummary, { backgroundColor: palette.pillBg, borderColor: palette.border }]}>
        <View style={[styles.warmIcon, { backgroundColor: palette.badgeBg }]}><Route color={palette.primary} size={20} /></View>
        <View style={styles.warmSummaryText}>
          <Typography variant="bodySmall" color={palette.primaryStrong} numberOfLines={2}>
            {warmPath.summary ? (
              warmPath.summary
            ) : (
              <>
                <Typography variant="bodySmall" color={palette.primaryStrong} style={styles.boldText}>{warmPath.topConnection.name}</Typography>
                {' knows '}
                {contact.name.split(' ')[0]}
                {warmPath.sharedEmployer ? (
                  ` from ${warmPath.sharedEmployer.company} (${warmPath.sharedEmployer.overlap})`
                ) : ''}
                {` - ${Math.round(warmPath.topConnection.confidence * 100)}%`}
              </>
            )}
          </Typography>
          <View style={styles.warmMetaRow}>
            {warmPath.mutualConnections.length ? <WarmMeta icon={Users} label={`${warmPath.mutualConnections.length} mutuals`} /> : null}
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
  const palette = useProfilePalette();
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
    if (!visible) return;
    setPositions({});
    setKidsExpanded(true);
    setActiveId(null);
    dragId.current = null;
  }, [contact.id, visible, warmPath]);

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
        <TouchableOpacity style={[styles.graphBackdrop, { backgroundColor: palette.overlay }]} activeOpacity={1} onPress={onClose} />
        <View style={[styles.graphSheet, { maxHeight: sheetHeight, backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
          <View style={[styles.graphHandle, { backgroundColor: palette.border }]} />
      <View style={styles.graphSheetHeader}>
        <View style={styles.graphTitleBlock}>
          <Typography variant="h3" color={palette.primaryStrong} style={styles.graphSheetTitle}>Warm Path</Typography>
          <Typography variant="bodySmall" color={palette.muted}>{childDefs.length} routes through your network</Typography>
        </View>
        <View style={styles.graphHeaderActions}>
          {Object.keys(positions).length ? (
            <TouchableOpacity activeOpacity={0.78} onPress={resetGraph} style={styles.graphTextButton}>
              <RotateCcw color={palette.muted} size={15} />
              <Typography variant="caption" color={palette.muted} style={styles.boldText}>Reset</Typography>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity activeOpacity={0.78} onPress={onClose} style={[styles.graphCollapseButton, { backgroundColor: palette.badgeBg }]}>
            <Typography variant="caption" color={palette.primary} style={styles.boldText}>Collapse</Typography>
            <ChevronUp color={palette.primary} size={14} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.graphScrollContent}
      >
        <View style={[styles.graphCanvas, { width: graphWidth, backgroundColor: palette.graphCanvas }]} {...panResponder.panHandlers}>
          <View style={[styles.graphHint, { backgroundColor: palette.darkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255,255,255,0.92)', borderColor: palette.border }]}>
            <Move color={palette.muted} size={13} />
            <Typography variant="caption" color={palette.muted}>
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
                        fill={palette.primary}
                      >
                        {Math.round(def.label.confidence * 100)}%
                      </SvgText>
                      <SvgText
                        x={(pos.x + graphCenter.x) / 2}
                        y={(pos.y + graphCenter.y) / 2 + 9}
                        textAnchor="middle"
                        fontSize={10}
                        fill={palette.muted}
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
        <LegendItem color={palette.primary} label="Strong route" />
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
  const palette = useProfilePalette();
  const r = big ? 26 : 18;
  return (
    <G x={x} y={y}>
      <Circle r={r + 14} fill="transparent" />
      <Circle r={r + 4} fill={palette.graphCanvas} />
      <Circle r={r} fill={color} opacity={active ? 0.22 : 0.12} />
      <Circle r={r} fill={palette.surfaceElevated} stroke={color} strokeWidth={isProspect ? 2.5 : active ? 2 : 1.5} />
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
        <SvgText x={0} y={0} textAnchor="middle" fontSize={11.5} fontWeight="800" fill={palette.primaryStrong}>
          {name}
        </SvgText>
        {sub ? (
          <SvgText x={0} y={15} textAnchor="middle" fontSize={10.5} fill={palette.muted}>
            {sub}
          </SvgText>
        ) : null}
      </G>
    </G>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const palette = useProfilePalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { backgroundColor: dashed ? 'transparent' : color, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Typography variant="caption" color={palette.muted}>{label}</Typography>
    </View>
  );
}

function WarmMeta({ icon: Icon, label }: { icon: IconComponent; label: string }) {
  const palette = useProfilePalette();
  return (
    <View style={styles.warmMeta}>
      <Icon color={palette.muted} size={12} />
      <Typography variant="caption" color={palette.muted}>{label}</Typography>
    </View>
  );
}

function ActivityHeatmap({ events, compact }: { events: ProspectEvent[]; compact: boolean }) {
  const palette = useProfilePalette();
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
      const weight = activityWeight(event);
      if (!out[key]) out.intent[days - 1 - diff] += weight;
      else out[key][days - 1 - diff] += weight;
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
                  <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText}>{meta.label}</Typography>
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
                          borderColor: value ? meta.color : palette.borderSoft,
                          opacity: value ? 0.25 + (value / max) * 0.75 : 1,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Typography variant="caption" color={palette.muted} style={styles.heatSum}>{sum}</Typography>
              </View>
            );
          })}
          <View style={styles.heatFooter}>
            <Typography variant="caption" color={palette.muted}>{days} days ago</Typography>
            <Typography variant="caption" color={palette.muted}>Today</Typography>
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

function FitSignalsCard({ contact }: { contact: CrmContact }) {
  const palette = useProfilePalette();
  const signals = fitSignals(contact.raw);
  if (!signals.length) {
    return (
      <Card style={styles.equalCard}>
        <CardHeader title="Fit signals" subtitle="Not scored yet" />
        <View style={styles.emptyFit}>
          <Typography variant="bodySmall" color={palette.muted} align="center">
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
            <Typography variant="caption" color={palette.muted} style={styles.fitLabel}>{signal.label}</Typography>
            <View style={[styles.fitTrack, { backgroundColor: palette.badgeBg }]}>
              <View style={[styles.fitFill, { width: `${signal.value * 100}%` }]} />
            </View>
            <Typography variant="caption" color={palette.primaryStrong} style={styles.fitNumber}>{Math.round(signal.value * 100)}</Typography>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ChannelMixCard({ contact }: { contact: CrmContact }) {
  const palette = useProfilePalette();
  const rolls = channelRollups(contact.raw);
  const total = rolls.reduce((sum, rollup) => sum + rollup.count, 0);
  return (
    <Card style={styles.equalCard}>
      <CardHeader title="Channel mix" subtitle={`${total} events - ${rolls.length} channels`} />
      {total === 0 ? (
        <View style={styles.emptyFit}>
          <Typography variant="bodySmall" color={palette.muted}>No channel events yet.</Typography>
        </View>
      ) : (
        <View style={styles.channelMixContent}>
          <View style={styles.donut}>
            <View style={styles.donutInner}>
              <Typography variant="overline" color={palette.muted}>Events</Typography>
              <Typography variant="h3" color={palette.primaryStrong} style={styles.kpiValue}>{total}</Typography>
            </View>
          </View>
          <View style={styles.channelLegend}>
            {rolls.map((rollup) => {
              const meta = channelMeta(rollup.channel);
              return (
                <View key={rollup.channel} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                  <Typography variant="caption" color={palette.primaryStrong} style={styles.legendName} numberOfLines={1}>{meta.label}</Typography>
                  <Typography variant="caption" color={palette.muted}>{rollup.count}</Typography>
                  <Typography variant="caption" color={palette.disabled} style={styles.percentText}>{Math.round((rollup.count / total) * 100)}%</Typography>
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
  const palette = useProfilePalette();
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
            <View key={signal.id} style={[styles.intentCard, { borderColor: palette.border, backgroundColor: palette.pillBg }]}>
              <View style={[styles.intentIcon, { backgroundColor: `${meta.color}1a` }]}>
                <Icon color={meta.color} size={17} />
              </View>
              <Typography variant="overline" color={palette.muted}>{meta.label}</Typography>
              <Typography variant="bodySmall" color={palette.primaryStrong} style={styles.boldText}>{meta.description(signal.payload)}</Typography>
              <View style={styles.intentConfidence}>
                <View style={[styles.fitTrack, { backgroundColor: palette.badgeBg }]}>
                  <View style={[styles.fitFill, { width: `${signal.confidence * 100}%`, backgroundColor: meta.color }]} />
                </View>
                <Typography variant="caption" color={palette.muted}>{Math.round(signal.confidence * 100)}%</Typography>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function RecentActivityCard({ events }: { events: ProspectEvent[] }) {
  const palette = useProfilePalette();
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
                <Typography variant="caption" color={palette.muted}>
                  <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText}>{meta.label}</Typography>
                  {` - ${event.direction || 'system'}  ${rel(event.occurred_at)} ago`}
                </Typography>
                <Typography variant="caption" color={palette.primaryStrong} numberOfLines={2}>
                  {payloadPreview(event.payload, event.event_type)}
                </Typography>
              </View>
            </View>
          );
        }) : (
          <Typography variant="bodySmall" color={palette.muted}>No activity yet.</Typography>
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
  const hasIntroRoute = Boolean(warmPath.topConnection.name && !warmPath.sample);
  return (
    <Card>
      <CardHeader title="Take action" />
      <View style={styles.actionGrid}>
        <ActionButton
          icon={Route}
          label="Ask for intro"
          hint={hasIntroRoute ? `via ${warmPath.topConnection.name.split(' ')[0]}` : 'no warm route yet'}
          primary={hasIntroRoute}
          onPress={() => onAction('intro')}
        />
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
  const palette = useProfilePalette();
  const color = primary ? '#fff' : danger ? palette.dangerText : palette.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={busy}
      onPress={onPress}
      style={[
        styles.actionButton,
        { backgroundColor: palette.surface, borderColor: danger ? palette.dangerBorder : palette.border },
        primary && styles.actionPrimary,
        danger && [styles.actionDanger, { backgroundColor: palette.dangerBg, borderColor: palette.dangerBorder }],
        active && styles.actionActive,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: palette.badgeBg }, primary && styles.actionIconPrimary, danger && [styles.actionIconDanger, { backgroundColor: palette.dangerBg }]]}>
        {busy ? <ActivityIndicator color={color} size="small" /> : <Icon color={color} size={19} />}
      </View>
      <View style={styles.actionCopy}>
        <Typography variant="caption" color={color} style={styles.boldText} numberOfLines={1}>{label}</Typography>
        <Typography variant="caption" color={primary ? '#DBEAFE' : palette.muted} numberOfLines={1}>{hint}</Typography>
      </View>
    </TouchableOpacity>
  );
}

function NextFollowupsCard({ followups, loading }: { followups: ProspectFollowup[]; loading: boolean }) {
  const palette = useProfilePalette();
  return (
    <Card>
      <CardHeader title="Next follow-ups" subtitle={loading ? 'Loading...' : followups.length ? `${followups.length} scheduled` : 'Automatic outreach'} />
      {loading ? (
        <Typography variant="bodySmall" color={palette.muted}>Checking the schedule...</Typography>
      ) : followups.length === 0 ? (
        <View style={styles.followupEmpty}>
          <CalendarClock color={palette.muted} size={16} />
          <Typography variant="bodySmall" color={palette.muted}>No automatic follow-ups queued.</Typography>
        </View>
      ) : (
        <View style={styles.followupList}>
          {followups.map((followup) => {
            const meta = channelMeta(followup.channel);
            const Icon = meta.Icon;
            return (
              <View key={followup.id} style={styles.followupRow}>
                <View style={[styles.followupIcon, { backgroundColor: palette.badgeBg }]}>
                  <Icon color={meta.color} size={15} />
                </View>
                <View style={styles.followupCopy}>
                  <Typography variant="caption" color={palette.primaryStrong} style={styles.boldText} numberOfLines={1}>
                    {meta.label}{followup.type ? ` - ${titleCase(followup.type)}` : ''}
                  </Typography>
                  <Typography variant="caption" color={palette.muted} numberOfLines={1}>
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
  const palette = useProfilePalette();
  return <View style={[styles.card, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }, padded && styles.cardPadded, style]}>{children}</View>;
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const palette = useProfilePalette();
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderText}>
        <Typography variant="bodySmall" color={palette.primaryStrong} style={styles.cardTitle}>{title}</Typography>
        {subtitle ? <Typography variant="caption" color={palette.muted}>{subtitle}</Typography> : null}
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
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += activityWeight(event);
  });
  return counts;
}

function warmRouteCount(warmPath: WarmPath) {
  return (
    (warmPath.topConnection.name ? 1 : 0) +
    (warmPath.sharedEmployer ? 1 : 0) +
    warmPath.mutualConnections.length +
    (warmPath.customerReference ? 1 : 0) +
    (warmPath.accountPipeline ? 1 : 0)
  );
}

function buildGraphChildren(warmPath: WarmPath, graphWidth: number, center: GraphPos): GraphChildDef[] {
  const out: GraphChildDef[] = [];
  if (!warmPath.topConnection.name) return out;
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
      note: warmPath.sharedEmployer ? `ex-${warmPath.sharedEmployer.company}` : 'network',
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
    position: 'relative',
    gap: 14,
    paddingTop: Theme.spacing.xl,
  },
  profileMenuDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
    elevation: 20,
  },
  topBar: {
    position: 'relative',
    zIndex: 1000,
    elevation: 24,
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
    position: 'relative',
    zIndex: 1001,
    elevation: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  topActionsCompact: {
    width: '100%',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
  },
  topActionsMenuDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1001,
    elevation: 24,
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
  moreActionWrap: {
    position: 'relative',
    zIndex: 1002,
    elevation: 25,
    minHeight: 36,
    overflow: 'visible',
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
  messageButtonCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Theme.spacing.sm,
  },
  messageMoreButton: {
    width: 38,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledAction: {
    opacity: 0.55,
  },
  actionMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 226,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    ...Theme.shadows.medium,
    zIndex: 9999,
    elevation: 30,
  },
  actionMenuItem: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  actionMenuIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuCopy: {
    flex: 1,
    minWidth: 0,
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
  profileDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  profileDetailsGridCompact: {
    gap: Theme.spacing.xs,
  },
  profileDetailItem: {
    flexGrow: 1,
    flexBasis: '23%',
    minWidth: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    backgroundColor: '#f8fafc',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  profileDetailItemCompact: {
    flexBasis: '48%',
    minWidth: 0,
  },
  profileDetailValue: {
    marginTop: 2,
    fontWeight: '800',
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
  graphSheetTitle: {
    fontWeight: '900',
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
    borderRadius: 14,
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
