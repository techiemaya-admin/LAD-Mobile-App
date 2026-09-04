/**
 * AI Assistant — mobile port of LAD-Frontend-2's advanced-search-ai page.
 *
 * Workflow parity with the web app:
 *  • Blue sparkles button (landing) and the "ICP Discovery" pill (chat header)
 *    open the ICP Discovery drawer — the AI Playground chat that captures the
 *    business profile with completeness tracking.
 *  • "+" in the input bar opens the attach menu: Import leads (CSV/Excel →
 *    parsed locally into the Leads panel), Select contacts, Connect tools.
 *  • Chat drives intent extraction → confirmation → LinkedIn/prospect search.
 *  • Leads panel mirrors the web: per-lead enroll checkboxes, select all/clear,
 *    ICP score pills, reasoning, good/bad match feedback, Get More Leads.
 *  • Flow panel is the n8n-style Workflow Builder canvas (Start → steps → End,
 *    add/remove steps, channel setup) with campaign launch.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Image as ImageIcon,
  Layers,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Sparkles,
  Square,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import * as XLSX from 'xlsx';
import Theme from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Typography } from '@/components/ui/Typography';
import { LadThinkingBubble } from '@/components/ui/LadThinkingBubble';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { IcpDiscoveryModal } from '@/components/features/IcpDiscoveryModal';
import { EditLeadModal } from '@/components/features/EditLeadModal';
import { CheckpointWizard } from '@/components/features/CheckpointWizard';
import { WorkflowCanvas } from '@/components/features/WorkflowCanvas';
import {
  AcceleratorChain,
  AcceleratorRoleCardView,
  AcceleratorTemplateIcon,
} from '@/components/features/AcceleratorRoleCard';
import { useAdvancedSearch } from '@/src/hooks/useAdvancedSearch';
import { useAdvancedSearchStore } from '@/src/store/advancedSearchStore';
import useAuthStore from '@/src/store/authStore';
import {
  AssistantChatMessage,
  MobileAssistantLead,
  extractLeadsFromFileUpload,
  isVisionExtractionFile,
} from '@/src/services/mobileAIAssistantService';
import { BusinessProfile, getBusinessProfile, hasAnyProfileData } from '@/src/services/aiPlaygroundService';
import { apiGet, buildApiUrl, getActiveTenantId, getAuthToken, isApiRequestError } from '@/src/api';
import { runProspectSearch } from '@/src/services/prospectsService';
import type { SearchBackendRollup, SearchRunResult } from '@/src/services/prospectsService';
import {
  WORKFLOW_TEMPLATES,
  splitWizardAnswers,
  templateSearchQuery,
  templateWizardInputs,
  type WorkflowTemplate,
} from '@/src/services/workflowAccelerators';
import { useAppTheme } from '@/src/theme/appTheme';

const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;
const MAX_RESULTS_OPTIONS = [5, 25, 50, 100, 250, 500];
const ICP_LEADS_PROMPT = 'Get leads from my active ICP';
const PLACEHOLDER_SUGGESTIONS = [
  'Connect me with founders in trading companies in UAE',
  'Connect me with CFO in Goldman Sachs in USA',
  'Schedule sales meetings with procurement managers in HVAC in UAE',
  'Find VP of Sales in SaaS companies in UK',
  'Reach out to HR directors in manufacturing in Germany',
  'Strengthen my relationship with existing clients',
];
const LANDING_SUGGESTIONS = [
  { label: 'Founders in trading in UAE', value: 'Connect me with founders in trading companies in UAE', icon: 'search' },
  { label: 'Sales meetings with HVAC managers', value: 'Schedule sales meetings with procurement managers in HVAC in UAE', icon: 'building' },
  { label: 'VP of Sales in UK SaaS', value: 'Find VP of Sales in SaaS companies in UK', icon: 'people' },
  { label: 'Strengthen client relationships', value: 'Strengthen my relationship with existing clients', icon: 'relationship' },
  { label: ICP_LEADS_PROMPT, value: ICP_LEADS_PROMPT, icon: 'spark' },
  { label: 'Media Generation', value: 'Help me generate media for my outreach campaign', icon: 'image' },
];

const AVATAR_COLORS = ['#0B1957', '#7C3AED', '#0A66C2', '#059669', '#D97706', '#DC2626', '#DB2777', '#0891B2'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

const avatarColor = (name: string) => {
  let hash = 0;
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const scoreTone = (score?: number) => {
  if ((score ?? 0) >= 70) return { bg: '#DCFCE7', fg: '#166534', dot: '🟢' };
  if ((score ?? 0) >= 45) return { bg: '#FEF9C3', fg: '#854D0E', dot: '🟡' };
  return { bg: '#E0E7FF', fg: '#3730A3', dot: '🔵' };
};

const LADMark = ({ size = 32, color = '#0B1957' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="50 120 110 130">
    <Path
      fill={color}
      fillRule="evenodd"
      d="M90.605 187.719c-13.835-4.52-27.66 7.976-24.097 22.394 4.594 17.77 23.656 26.117 42.418 25.469v-12.828c-31.363.25-42.027-33.168-18.32-35.035Zm5.2 9.379a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.734 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.73 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058ZM98.324 160.398c-14.512-4.254-33.902-13.273-39.133-28.687-1.629 5.144-2.117 10.398-1.593 15.48.383 3.735 1.02 6.989 1.87 9.833 2.571 6.68 7.126 12.62 13.356 16.882-.629-3.601-.172-7.308 1.309-10.648 8.472 10.969 37.125 14.453 50.476 23.406 5.45 3.656 8.785 9.816 8.785 16.477 0 12.058-16.421 23.84-24.168 32.433 17.418-.691 34.508-9.14 39.461-25.011 13.723-44.004-53.984-49.23-76.855-80.922 1.023 15.945 12.512 24.859 26.492 30.757Z"
    />
  </Svg>
);

const LandingSuggestionIcon = ({ icon, color }: { icon: string; color: string }) => {
  switch (icon) {
    case 'building':
      return <Building2 color={color} size={15} />;
    case 'people':
      return <UsersRound color={color} size={15} />;
    case 'relationship':
      return <UserPlus color={color} size={15} />;
    case 'spark':
      return <Sparkles color={color} size={15} />;
    case 'image':
      return <ImageIcon color={color} size={15} />;
    default:
      return <Search color={color} size={15} />;
  }
};

interface ContactPickerContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  website?: string;
  avatarUrl?: string;
  source: string;
  raw?: Record<string, unknown>;
}

interface ContactPickerResult {
  contacts: ContactPickerContact[];
  total?: number;
  hasMore?: boolean;
}

interface ContactPickerSource {
  key: string;
  label: string;
  color: string;
  fetchContacts: (search: string, page?: number) => Promise<ContactPickerResult>;
}

const CONTACT_PICKER_PAGE_SIZE = 100;
const CONTACT_PICKER_AUTO_PAGE_LIMIT = 50;
const WABA_CONTACT_SERVICE_URL = (
  process.env.EXPO_PUBLIC_BNI_SERVICE_URL ||
  process.env.EXPO_PUBLIC_WHATSAPP_API_URL ||
  process.env.NEXT_PUBLIC_BNI_SERVICE_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_API_URL ||
  'https://bni-conversation-service-160078175457.us-central1.run.app'
).replace(/\/+$/, '');
const EMAIL_CONTACT_SERVICE_URL = (
  process.env.EXPO_PUBLIC_EMAIL_COMMS_URL ||
  process.env.NEXT_PUBLIC_EMAIL_COMMS_URL ||
  'https://lad-email-comms-develop-asia-160078175457.asia-south1.run.app'
).replace(/\/+$/, '');

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const getPayloadArray = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const preferredKeys = [...keys, 'data', 'contacts', 'conversations', 'items', 'results', 'records', 'rows', 'leads'];
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const visited = new WeakSet<object>();

  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') continue;
    if (visited.has(value)) continue;
    visited.add(value);

    const record = value as Record<string, any>;
    for (const key of preferredKeys) {
      if (Array.isArray(record[key])) return record[key];
    }

    if (depth >= 4) continue;
    for (const key of ['data', 'payload', 'result', 'results', 'response', 'body', 'meta']) {
      if (record[key] && typeof record[key] === 'object') {
        queue.push({ value: record[key], depth: depth + 1 });
      }
    }
  }

  return [];
};

const getPayloadTotal = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const visited = new WeakSet<object>();

  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    if (visited.has(value)) continue;
    visited.add(value);

    const record = value as Record<string, any>;
    for (const key of [
      'total',
      'count',
      'total_count',
      'totalCount',
      'total_items',
      'totalItems',
      'total_records',
      'totalRecords',
      'total_contacts',
      'totalContacts',
      'filtered_count',
      'filteredCount',
    ]) {
      const numeric = Number(record[key]);
      if (Number.isFinite(numeric)) return numeric;
    }

    if (depth >= 3) continue;
    for (const key of ['data', 'payload', 'meta', 'pagination', 'pageInfo', 'result']) {
      if (record[key] && typeof record[key] === 'object') {
        queue.push({ value: record[key], depth: depth + 1 });
      }
    }
  }

  return undefined;
};

const pickString = (records: Record<string, any>[], keys: string[]) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
  }
  return '';
};

const contactFullName = (record: Record<string, any>) => {
  const firstName = String(record.first_name ?? record.firstName ?? '').trim();
  const lastName = String(record.last_name ?? record.lastName ?? '').trim();
  return String(
    record.name
    ?? record.full_name
    ?? record.fullName
    ?? record.contact_name
    ?? record.contactName
    ?? record.lead_name
    ?? record.leadName
    ?? record.display_name
    ?? record.displayName
    ?? `${firstName} ${lastName}`.trim()
    ?? '',
  ).trim();
};

const normalizePickerContact = (item: unknown, index: number, source: string): ContactPickerContact => {
  const record = item && typeof item === 'object' ? item as Record<string, any> : {};
  const nestedRecords = [
    record,
    asRecord(record.contact),
    asRecord(record.lead),
    asRecord(record.customer),
    asRecord(record.person),
    asRecord(record.profile),
    asRecord(record.user),
  ];
  const phone = pickString(nestedRecords, [
    'phone',
    'lead_phone',
    'contact_phone',
    'phone_number',
    'phoneNumber',
    'mobile',
    'mobile_phone',
    'whatsapp',
    'whatsapp_number',
    'wa_id',
    'number',
  ]);
  const email = pickString(nestedRecords, [
    'email',
    'lead_email',
    'contact_email',
    'contactEmail',
    'email_address',
    'emailAddress',
    'recipient_email',
    'recipientEmail',
  ]);
  const name = contactFullName(record)
    || pickString(nestedRecords.slice(1), ['name', 'full_name', 'fullName', 'contact_name', 'contactName', 'lead_name', 'leadName', 'display_name', 'displayName'])
    || phone
    || email
    || `Contact ${index + 1}`;
  const firstName = pickString(nestedRecords, ['first_name', 'firstName', 'given_name', 'givenName']) || name.split(/\s+/)[0] || '';
  const lastName = pickString(nestedRecords, ['last_name', 'lastName', 'family_name', 'familyName']) || name.split(/\s+/).slice(1).join(' ');
  const rawId = pickString(nestedRecords, ['id', '_id', 'source_id', 'sourceId', 'contact_id', 'contactId', 'conversation_id', 'lead_id'])
    || phone
    || email
    || `${source}-${index}`;
  return {
    id: `${source}-${String(rawId)}`,
    name,
    firstName,
    lastName,
    phone,
    email,
    company: pickString(nestedRecords, ['company', 'company_name', 'companyName', 'contact_company', 'contactCompany', 'organization', 'organisation', 'business_name']),
    linkedinUrl: pickString(nestedRecords, ['linkedin_url', 'linkedinUrl', 'profile_url', 'profileUrl', 'linkedinProfile']),
    website: pickString(nestedRecords, ['website', 'domain', 'company_website']),
    avatarUrl: pickString(nestedRecords, ['avatar', 'avatar_url', 'avatarUrl', 'profile_photo', 'profile_image', 'photo_url', 'picture']),
    source,
    raw: record,
  };
};

const dedupePickerContacts = (contacts: ContactPickerContact[]) => {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const identity = [
      contact.id,
      contact.phone ? contact.phone.replace(/\D/g, '') : '',
      contact.email ? contact.email.toLowerCase() : '',
    ].filter(Boolean).join('|') || contact.name;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const normalizeContactResponse = (
  payload: unknown,
  source: string,
  keys: string[],
  page: number,
  limit = CONTACT_PICKER_PAGE_SIZE,
): ContactPickerResult => {
  const items = getPayloadArray(payload, keys);
  const contacts = dedupePickerContacts(items.map((item, index) => normalizePickerContact(item, index + (page - 1) * limit, source)));
  const total = getPayloadTotal(payload);
  const hasMore = typeof total === 'number' ? page * limit < total : contacts.length >= limit;
  return { contacts, total, hasMore };
};

const buildContactRequestUrl = (baseUrl: string, path: string, params: Record<string, unknown>) => {
  const url = new URL(buildApiUrl(path, baseUrl));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
};

const getContactApiErrorMessage = (error: unknown, label: string) => {
  if (isApiRequestError(error)) {
    if (error.status === 401 || error.status === 403) {
      return `${label} is connected, but this session is not authorized to read contacts. Please sign in again.`;
    }
    return error.message || `Unable to load ${label}.`;
  }
  return error instanceof Error ? error.message : `Unable to load ${label}.`;
};

const fetchAllContactPages = async (
  source: ContactPickerSource,
  searchText: string,
): Promise<ContactPickerResult> => {
  const allContacts: ContactPickerContact[] = [];
  let total: number | undefined;
  let hasMore = false;

  for (let page = 1; page <= CONTACT_PICKER_AUTO_PAGE_LIMIT; page += 1) {
    const result = await source.fetchContacts(searchText, page);
    allContacts.push(...result.contacts);
    if (typeof result.total === 'number') {
      total = result.total;
    }

    const merged = dedupePickerContacts(allContacts);
    const reachedTotal = typeof total === 'number' && merged.length >= total;
    const shouldContinue = Boolean(result.hasMore) && !reachedTotal && result.contacts.length > 0;

    if (!shouldContinue) {
      hasMore = Boolean(result.hasMore) && !reachedTotal;
      return {
        contacts: merged,
        total: total ?? merged.length,
        hasMore,
      };
    }
  }

  const merged = dedupePickerContacts(allContacts);
  return {
    contacts: merged,
    total: total ?? merged.length,
    hasMore: typeof total === 'number' ? merged.length < total : true,
  };
};

const fetchWabaContactPayload = async (params: Record<string, unknown>) => {
  if (Platform.OS === 'web') {
    const response = await apiGet<any>('/api/conversations', {
      params: { ...params, channel: 'waba' },
      headers: { 'X-WhatsApp-Channel': 'waba' },
    });
    return response.data;
  }

  const token = await getAuthToken();
  const tenantId = await getActiveTenantId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-WhatsApp-Channel': 'waba',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const response = await fetch(buildContactRequestUrl(WABA_CONTACT_SERVICE_URL, '/api/conversations', params), {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message = asRecord(payload).message || asRecord(payload).error || asRecord(payload).detail;
    throw new Error(message ? String(message) : `HTTP ${response.status}: ${response.statusText}`);
  }

  return payload;
};

const fetchEmailContactPayload = async (
  provider: 'google' | 'microsoft',
  params: Record<string, unknown>,
) => {
  const providerParams = {
    ...params,
    provider,
    channel: provider === 'microsoft' ? 'outlook' : 'gmail',
  };

  if (Platform.OS === 'web') {
    const response = await apiGet<any>('/api/email-comms/contacts', { params: providerParams });
    return response.data;
  }

  const token = await getAuthToken();
  const tenantId = await getActiveTenantId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const response = await fetch(buildContactRequestUrl(EMAIL_CONTACT_SERVICE_URL, '/api/email-broadcast/contacts', providerParams), {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message = asRecord(payload).message || asRecord(payload).error || asRecord(payload).detail;
    throw new Error(message ? String(message) : `HTTP ${response.status}: ${response.statusText}`);
  }

  return payload;
};

const normalizeEmailContactResponse = (
  payload: unknown,
  source: 'google' | 'microsoft',
  page: number,
): ContactPickerResult => {
  const providerAliases = source === 'microsoft' ? ['microsoft', 'outlook'] : ['google', 'gmail'];
  const items = getPayloadArray(payload, ['data', 'contacts', 'items', 'results'])
    .filter((item) => {
      const record = asRecord(item);
      const providerHint = pickString([record, asRecord(record.metadata), asRecord(record.account)], [
        'provider',
        'channel',
        'source',
        'account_provider',
        'accountProvider',
        'email_provider',
        'emailProvider',
      ]).toLowerCase();
      return !providerHint || providerAliases.some((alias) => providerHint.includes(alias));
    });
  const contacts = dedupePickerContacts(items.map((item, index) => normalizePickerContact(item, index + (page - 1) * CONTACT_PICKER_PAGE_SIZE, source)));
  const total = getPayloadTotal(payload);
  const hasMore = typeof total === 'number' ? page * CONTACT_PICKER_PAGE_SIZE < total : contacts.length >= CONTACT_PICKER_PAGE_SIZE;
  return { contacts, total, hasMore };
};

const CONTACT_PICKER_SOURCES: ContactPickerSource[] = [
  {
    key: 'crm',
    label: 'CRM Contacts',
    color: '#3B82F6',
    fetchContacts: async (searchText: string, page = 1) => {
      const response = await apiGet<any>('/api/social-integration/gohighlevel/contacts/local', {
        params: { page, limit: CONTACT_PICKER_PAGE_SIZE, search: searchText || undefined },
      });
      return normalizeContactResponse(response.data, 'crm', ['data', 'contacts', 'items', 'results'], page);
    },
  },
  {
    key: 'personal_wa',
    label: 'WAPA',
    color: '#25D366',
    fetchContacts: async (searchText: string, page = 1) => {
      const response = await apiGet<any>('/api/personal-whatsapp/contacts', {
        params: { page, limit: CONTACT_PICKER_PAGE_SIZE, search: searchText || undefined },
      });
      return normalizeContactResponse(response.data, 'personal_wa', ['data', 'contacts', 'items', 'results'], page);
    },
  },
  {
    key: 'waba',
    label: 'WA Business',
    color: '#128C7E',
    fetchContacts: async (searchText: string, page = 1) => {
      const payload = await fetchWabaContactPayload({
        limit: CONTACT_PICKER_PAGE_SIZE,
        offset: (page - 1) * CONTACT_PICKER_PAGE_SIZE,
        search: searchText || undefined,
      });
      return normalizeContactResponse(payload, 'waba', ['conversations', 'data', 'contacts', 'items', 'results'], page);
    },
  },
  {
    key: 'google',
    label: 'Google Contacts',
    color: '#EA4335',
    fetchContacts: async (searchText: string, page = 1) => {
      const payload = await fetchEmailContactPayload('google', {
        page,
        limit: CONTACT_PICKER_PAGE_SIZE,
        offset: (page - 1) * CONTACT_PICKER_PAGE_SIZE,
        search: searchText || undefined,
      });
      return normalizeEmailContactResponse(payload, 'google', page);
    },
  },
  {
    key: 'microsoft',
    label: 'Microsoft Contacts',
    color: '#00A4EF',
    fetchContacts: async (searchText: string, page = 1) => {
      const payload = await fetchEmailContactPayload('microsoft', {
        page,
        limit: CONTACT_PICKER_PAGE_SIZE,
        offset: (page - 1) * CONTACT_PICKER_PAGE_SIZE,
        search: searchText || undefined,
      });
      return normalizeEmailContactResponse(payload, 'microsoft', page);
    },
  },
];

// Markdown text renderer: handles **bold**, bullet lines, and line breaks
const MarkdownText = ({ text, textColor }: { text: string; textColor: string }) => {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 3 }}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const isBullet = /^[-•*]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[-•*]\s+/, '') : line;

        const segments: { text: string; bold: boolean }[] = [];
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(content)) !== null) {
          if (match.index > lastIndex) segments.push({ text: content.slice(lastIndex, match.index), bold: false });
          segments.push({ text: match[1], bold: true });
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < content.length) segments.push({ text: content.slice(lastIndex), bold: false });
        if (segments.length === 0) segments.push({ text: content, bold: false });

        if (!trimmed) return <View key={lineIndex} style={{ height: 4 }} />;

        return (
          <View key={lineIndex} style={isBullet ? { flexDirection: 'row', alignItems: 'flex-start', gap: 6 } : undefined}>
            {isBullet && (
              <Typography variant="bodySmall" color={textColor} style={{ lineHeight: 20, marginTop: 1 }}>{'-'}</Typography>
            )}
            <Typography variant="bodySmall" color={textColor} style={[styles.messageText, { flexShrink: 1, lineHeight: 20 }]}>
              {segments.map((seg, segIndex) => (
                <Typography
                  key={segIndex}
                  variant="bodySmall"
                  color={textColor}
                  style={seg.bold ? { fontWeight: '700', lineHeight: 20 } : { lineHeight: 20 }}
                >
                  {seg.text}
                </Typography>
              ))}
            </Typography>
          </View>
        );
      })}
    </View>
  );
};

// ── Imported-file parsing (mirrors the web's CSV template headers) ───────────

const parseCSVLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') { current += '"'; index++; } else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current); current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

// Fuzzy header mapping — web parity with parseRows in LAD-Frontend-2's
// advanced-search-ai/page.tsx, which matches with includes() rather than exact
// alias lists. Real-world sheets title their columns "Company Name",
// "LinkedIn Profile URL", "Lead Name", "Target Contacts"… — the old exact
// list silently dropped those columns, importing name-only leads. Order
// matters: specific fields claim their headers before the generic name rule
// (so "Company Name" is company, not name).
const matchHeader = (header: string): string | null => {
  const s = header.trim().toLowerCase();
  if (!s) return null;
  if (s.includes('first') && s.includes('name')) return 'firstName';
  if (s.includes('last') && s.includes('name')) return 'lastName';
  if (s.includes('linkedin') || s.includes('profile url') || s === 'profile_url') return 'profileUrl';
  if (s.includes('email') || s.includes('e-mail')) return 'email';
  if (s.includes('whatsapp') || s.includes('phone') || s.includes('mobile')) return 'phone';
  if (s.includes('company') || s.includes('organization') || s.includes('organisation') || s.includes('employer')) return 'company';
  if (s.includes('title') || s.includes('designation') || s.includes('position') || s.includes('role') || s.includes('headline') || s.includes('target')) return 'headline';
  if (s.includes('location') || s.includes('city') || s.includes('country') || s.includes('region') || s.includes('geo')) return 'location';
  if (s.includes('industry') || s.includes('sector')) return 'industry';
  // Single name column ("Name", "Full Name", "Contact Name", "Lead", "Person")
  // — excludes user/file noise columns; first/last/company already claimed.
  if ((s.includes('name') || s === 'contact' || s === 'person' || s === 'lead') && !s.includes('user') && !s.includes('file')) return 'name';
  return null;
};

/**
 * A LinkedIn value is only usable if it points at a PERSON's profile (web
 * parity: usableLinkedInProfile). Search-result and company-page URLs are a
 * query, not a profile — storing one puts a dead link on the lead.
 */
const usableLinkedInProfile = (raw: string): string => {
  const s = (raw || '').trim();
  if (!s) return '';
  const m = s.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : '';
};

const rowsToLeads = (rows: string[][]): MobileAssistantLead[] => {
  if (rows.length < 2) return [];
  const mapping = rows[0].map(matchHeader);
  const stamp = Date.now();
  const leads: MobileAssistantLead[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const record: Record<string, string> = {};
    mapping.forEach((field, columnIndex) => {
      if (field && row[columnIndex]) record[field] = String(row[columnIndex]).trim();
    });
    const name = record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim();
    if (!name && !record.email && !record.phone && !record.profileUrl && !record.company) return;
    // Keep only person-profile links; a search-results or company URL in the
    // LinkedIn column is a dead link the connect step cannot act on (web
    // parity) — enrichment discovers the real profile instead.
    const profileUrl = usableLinkedInProfile(record.profileUrl || '');
    leads.push({
      id: `import-${stamp}-${rowIndex}`,
      name: name || record.email || record.phone || 'Imported lead',
      firstName: record.firstName || name.split(' ')[0] || '',
      lastName: record.lastName || name.split(' ').slice(1).join(' ') || '',
      headline: record.headline || '',
      location: record.location || '',
      company: record.company || '',
      profileUrl,
      industry: record.industry || '',
      phone: record.phone || '',
      email: record.email || '',
      locked: false,
      raw: record,
    });
  });
  return leads;
};

async function parseLeadFile(uri: string, fileName: string): Promise<MobileAssistantLead[]> {
  const isCsv = /\.csv$/i.test(fileName);
  let rows: string[][];
  if (isCsv) {
    const text = Platform.OS === 'web'
      ? await (await fetch(uri)).text()
      : await (await import('expo-file-system/legacy')).readAsStringAsync(uri);
    rows = text.split('\n').filter((line) => line.trim()).map(parseCSVLine);
  } else {
    let workbook: XLSX.WorkBook;
    if (Platform.OS === 'web') {
      const buffer = await (await fetch(uri)).arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as never });
      workbook = XLSX.read(base64, { type: 'base64' });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][])
      .map((row) => row.map((cell) => String(cell ?? '')));
  }
  return rowsToLeads(rows);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AIAssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const { width } = useWindowDimensions();
  const assistant = useAdvancedSearch();
  const currentUser = useAuthStore((state) => state.user);
  const listRef = useRef<FlatList<AssistantChatMessage>>(null);
  const previousMessageCountRef = useRef(0);
  const previousChatSignalRef = useRef('');
  const landingInputRef = useRef<TextInput>(null);
  const [activePanel, setActivePanel] = useState<'chat' | 'leads' | 'flow'>('chat');
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showIcpDiscovery, setShowIcpDiscovery] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [profileHasData, setProfileHasData] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [showAcceleratorPicker, setShowAcceleratorPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [forceCheckpointInlineVisible, setForceCheckpointInlineVisible] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  // Imported-lead cards whose AI Research Summary accordion is expanded.
  const [openSummaryLeadIds, setOpenSummaryLeadIds] = useState<Set<string>>(() => new Set());
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactPickerStep, setContactPickerStep] = useState<'source' | 'contacts'>('source');
  const [contactSourceKey, setContactSourceKey] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactPickerContacts, setContactPickerContacts] = useState<ContactPickerContact[]>([]);
  const [contactPickerLoading, setContactPickerLoading] = useState(false);
  const [contactPickerLoadingMore, setContactPickerLoadingMore] = useState(false);
  const [contactPickerError, setContactPickerError] = useState('');
  const [contactSelectedIds, setContactSelectedIds] = useState<string[]>([]);
  const [contactSelectedContacts, setContactSelectedContacts] = useState<Record<string, ContactPickerContact>>({});
  const [contactPickerPage, setContactPickerPage] = useState(1);
  const [contactPickerTotal, setContactPickerTotal] = useState<number | null>(null);
  const [contactPickerHasMore, setContactPickerHasMore] = useState(false);
  const [hoveredSend, setHoveredSend] = useState<'landing' | 'chat' | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const contactSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isCompact = width < 520;
  const isNarrowPhone = width < 380;
  const horizontalPadding = isCompact ? Theme.spacing.md : Theme.spacing.xl;
  const contentMaxWidth = width >= 900 ? 860 : undefined;
  const hasLeads = assistant.leads.length > 0;
  const hasConversation = assistant.messages.length > 0;
  const hasUsefulContext = false;
  const landingContentWidth = Math.min(Math.max(width - horizontalPadding * 2, 300), 640);
  const selectedCount = assistant.selectedLeadIds.length;
  const checkpointInlineVisible = forceCheckpointInlineVisible || assistant.cpStep >= 0;
  const shouldShowChatInput = activePanel === 'chat' && !checkpointInlineVisible && !hasLeads && !importing;
  const canSendChat = Boolean(assistant.input.trim()) && !assistant.isBusy && !assistant.isSearching && !importing;
  const chatInputSidePadding = isCompact ? Math.max(24, Math.min(38, width * 0.09)) : horizontalPadding;
  const bottomNavClearance = isKeyboardVisible ? 12 : Math.max(insets.bottom, 8) + 74;

  const handleCheckpointInputFocus = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 250);
  }, []);

  useEffect(() => {
    if (isKeyboardVisible && checkpointInlineVisible) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 250);
    }
  }, [isKeyboardVisible, checkpointInlineVisible]);
  const acceleratorGroups = useMemo(() => ([
    { label: 'General', data: WORKFLOW_TEMPLATES.filter((template) => template.category === 'general') },
    { label: 'By Industry', data: WORKFLOW_TEMPLATES.filter((template) => template.category === 'industry') },
  ]), []);

  // Home clears the persisted assistant session. When this retained tab screen
  // is focused again, reset its local panels as well so it opens at a clean
  // landing page instead of an empty remnant of the previous chat.
  useFocusEffect(
    useCallback(() => {
      const state = useAdvancedSearchStore.getState();
      if (state.messages.length || state.leads.length || state.workflowSteps.length) return;
      setActivePanel('chat');
      setShowDiscovery(false);
      setShowLanding(true);
      setAttachMenuOpen(false);
      setForceCheckpointInlineVisible(false);
    }, []),
  );

  // Hydrate the tenant's saved business profile on mount, same as web's
  // useBusinessProfile() — without this, "Use my ICP" in the Accelerator
  // wizard never has data to show until the user happens to open the ICP
  // Discovery modal first.
  useEffect(() => {
    let cancelled = false;
    void getBusinessProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setBusinessProfile(profile);
        setProfileHasData(hasAnyProfileData(profile));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const lastChatMessage = assistant.messages[assistant.messages.length - 1];
  const chatContentSignal = [
    assistant.messages.length,
    lastChatMessage?.id || '',
    lastChatMessage?.text || '',
    lastChatMessage?.options?.length || 0,
    lastChatMessage?.leads?.length || 0,
    lastChatMessage?.sources?.length || 0,
    lastChatMessage?.roleCard?.stage || '',
    lastChatMessage?.roleCard?.qIdx ?? '',
    assistant.isBusy ? 1 : 0,
    assistant.isSearching ? 1 : 0,
    checkpointInlineVisible ? 1 : 0,
  ].join(':');

  useEffect(() => {
    if (previousChatSignalRef.current === chatContentSignal) return undefined;
    const previousCount = previousMessageCountRef.current;
    const addedCount = Math.max(0, assistant.messages.length - previousCount);
    previousMessageCountRef.current = assistant.messages.length;
    previousChatSignalRef.current = chatContentSignal;

    if (activePanel !== 'chat') return undefined;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: addedCount > 0 });
    });
    const settleTimer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 90);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
    };
  }, [activePanel, assistant.messages.length, chatContentSignal, lastChatMessage?.role, lastChatMessage?.text]);

  useEffect(() => {
    if (activePanel !== 'chat') return undefined;
    const frame = requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [activePanel]);

  useEffect(() => {
    if (!showLanding || assistant.input.trim()) {
      setTypedPlaceholder('');
      return undefined;
    }

    let suggestionIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = PLACEHOLDER_SUGGESTIONS[suggestionIndex];
      if (!deleting) {
        charIndex += 1;
        setTypedPlaceholder(current.slice(0, charIndex));
        if (charIndex === current.length) {
          deleting = true;
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, 48);
        return;
      }

      charIndex -= 1;
      setTypedPlaceholder(current.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        suggestionIndex = (suggestionIndex + 1) % PLACEHOLDER_SUGGESTIONS.length;
        timer = setTimeout(tick, 360);
        return;
      }
      timer = setTimeout(tick, 24);
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [assistant.input, showLanding]);

  useEffect(() => {
    if (!hasLeads && activePanel === 'leads') {
      setActivePanel('chat');
    }
  }, [hasLeads, activePanel]);

  useEffect(() => () => {
    if (contactSearchTimer.current) clearTimeout(contactSearchTimer.current);
  }, []);

  // ── Attach menu actions (same three options as the web "+" menu) ──────────

  const handleImportLeads = async () => {
    setAttachMenuOpen(false);
    setForceCheckpointInlineVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          // Business cards / screenshots / scanned lists — extracted by
          // backend AI vision, same as web's image import path.
          'image/*',
          'application/pdf',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const displayName = file.name || 'leads.csv';
      const minimumSearchTime = new Promise((resolve) => setTimeout(resolve, 1200));
      setImporting(true);
      setUploadedFileName(displayName);
      setShowLanding(false);
      setActivePanel('chat');
      try {
        const leads = isVisionExtractionFile(displayName, file.mimeType)
          ? await extractLeadsFromFileUpload({
              uri: file.uri,
              name: displayName,
              mimeType: file.mimeType,
              file: (file as { file?: Blob | null }).file ?? null,
            })
          : await parseLeadFile(file.uri, displayName);
        await minimumSearchTime;
        void assistant.importLeads(leads, displayName);
        if (leads.length) setActivePanel('leads');
      } catch (parseError) {
        // Surface the failure in chat instead of dying silently — importLeads
        // with an empty list posts the "could not find any leads" guidance.
        console.warn('Lead file parse/extract error:', parseError);
        void assistant.importLeads([], displayName);
      } finally {
        setImporting(false);
        setUploadedFileName('');
      }
    } catch (error) {
      setImporting(false);
      setUploadedFileName('');
      console.warn('Lead import error:', error);
    }
  };

  const openContactPicker = () => {
    setAttachMenuOpen(false);
    setShowContactPicker(true);
    setContactPickerStep('source');
    setContactSourceKey('');
    setContactSearch('');
    setContactPickerContacts([]);
    setContactSelectedIds([]);
    setContactSelectedContacts({});
    setContactPickerError('');
    setContactPickerPage(1);
    setContactPickerTotal(null);
    setContactPickerHasMore(false);
  };

  const openAcceleratorPicker = () => {
    setAttachMenuOpen(false);
    setShowAcceleratorPicker(true);
  };

  const handleAcceleratorPick = (template: WorkflowTemplate) => {
    setShowAcceleratorPicker(false);
    setAttachMenuOpen(false);
    setShowLanding(false);
    setForceCheckpointInlineVisible(false);
    setActivePanel('chat');
    assistant.startAccelerator(template.key);
  };

  const handleAssistantOption = (value: string) => {
    if (value === '__role_review__' || value.startsWith('__role_builder__:')) {
      setShowLanding(false);
      setActivePanel('flow');
    }
    void assistant.chooseOption(value).then(() => {
      if (value === '__role_preview__') {
        setActivePanel('leads');
      }
    });
  };

  const fetchContactPickerContacts = async (sourceKey: string, searchText: string, page = 1, append = false) => {
    const source = CONTACT_PICKER_SOURCES.find((item) => item.key === sourceKey);
    if (!source) return;
    if (append) setContactPickerLoadingMore(true);
    else setContactPickerLoading(true);
    setContactPickerError('');
    try {
      const result = append
        ? await source.fetchContacts(searchText.trim(), page)
        : await fetchAllContactPages(source, searchText.trim());
      setContactPickerContacts((current) =>
        append ? dedupePickerContacts([...current, ...result.contacts]) : result.contacts,
      );
      setContactPickerPage(append ? page : Math.max(1, Math.ceil(result.contacts.length / CONTACT_PICKER_PAGE_SIZE)));
      setContactPickerTotal(typeof result.total === 'number' ? result.total : null);
      setContactPickerHasMore(Boolean(result.hasMore));
    } catch (error) {
      if (!append) setContactPickerContacts([]);
      setContactPickerError(getContactApiErrorMessage(error, source.label));
    } finally {
      if (append) setContactPickerLoadingMore(false);
      else setContactPickerLoading(false);
    }
  };

  const selectContactSource = async (sourceKey: string) => {
    setContactSourceKey(sourceKey);
    setContactPickerStep('contacts');
    setContactSearch('');
    setContactSelectedIds([]);
    setContactSelectedContacts({});
    setContactPickerPage(1);
    setContactPickerTotal(null);
    setContactPickerHasMore(false);
    await fetchContactPickerContacts(sourceKey, '', 1);
  };

  const handleContactSearch = (text: string) => {
    setContactSearch(text);
    if (contactSearchTimer.current) clearTimeout(contactSearchTimer.current);
    contactSearchTimer.current = setTimeout(() => {
      void fetchContactPickerContacts(contactSourceKey, text, 1);
    }, 350);
  };

  const toggleContactSelection = (contactId: string) => {
    const contact = contactPickerContacts.find((item) => item.id === contactId);
    const alreadySelected = contactSelectedIds.includes(contactId);
    setContactSelectedIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
    setContactSelectedContacts((current) => {
      const next = { ...current };
      if (alreadySelected) delete next[contactId];
      else if (contact) next[contactId] = contact;
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    const visibleIds = contactPickerContacts.map((contact) => contact.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => contactSelectedIds.includes(id));

    setContactSelectedIds((current) => {
      const visible = new Set(visibleIds);
      if (allVisibleSelected) return current.filter((id) => !visible.has(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });

    setContactSelectedContacts((current) => {
      const next = { ...current };
      if (allVisibleSelected) {
        visibleIds.forEach((id) => { delete next[id]; });
      } else {
        contactPickerContacts.forEach((contact) => { next[contact.id] = contact; });
      }
      return next;
    });
  };

  const confirmContactPicker = () => {
    const selected = contactSelectedIds
      .map((id) => contactSelectedContacts[id] || contactPickerContacts.find((contact) => contact.id === id))
      .filter(Boolean) as ContactPickerContact[];
    if (!selected.length) return;
    const source = CONTACT_PICKER_SOURCES.find((item) => item.key === contactSourceKey);
    const stamp = Date.now();
    const leads = selected.map((contact, index): MobileAssistantLead => ({
      id: `contact-${contact.source}-${contact.id || index}-${stamp}`,
      name: contact.name,
      firstName: contact.firstName || contact.name.split(/\s+/)[0] || '',
      lastName: contact.lastName || contact.name.split(/\s+/).slice(1).join(' '),
      headline: '',
      company: contact.company || '',
      profileUrl: contact.linkedinUrl || '',
      industry: '',
      phone: contact.phone || '',
      email: contact.email || '',
      locked: false,
      raw: { ...contact.raw, contact_source: contact.source, website: contact.website },
    }));

    setShowContactPicker(false);
    setShowLanding(false);
    setActivePanel('flow');
    void assistant.importLeads(leads, source?.label || 'selected contacts');
    assistant.startOutreachWorkflow();
  };

  const loadMoreContactPickerContacts = () => {
    if (!contactSourceKey || contactPickerLoading || contactPickerLoadingMore || !contactPickerHasMore) return;
    void fetchContactPickerContacts(contactSourceKey, contactSearch, contactPickerPage + 1, true);
  };

  const handleConnectTools = () => {
    setAttachMenuOpen(false);
    router.push('/(drawer)/integrations');
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  // Leaving the assistant entirely should start fresh next time it's opened —
  // otherwise stale leads/chat/flow from the previous visit resurface (they're
  // persisted in a module-level store, not component state).
  const handleBack = () => {
    setForceCheckpointInlineVisible(false);
    assistant.resetConversation();
    setActivePanel('chat');
    setShowDiscovery(false);
    setShowLanding(true);
    setAttachMenuOpen(false);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  // Back from the chat panel goes to the landing page without resetting the conversation.
  const handleBackToLanding = () => {
    if (assistant.cpStep >= 0) {
      setForceCheckpointInlineVisible(false);
      assistant.closeCheckpointWizard();
      return;
    }
    setForceCheckpointInlineVisible(false);
    setShowLanding(true);
    setAttachMenuOpen(false);
  };

  // "Get leads from my active ICP" — runs the active ICP discovery search
  // inline in chat (mirrors the web's SearchDispatcher panel).
  const openActiveIcpSearch = () => {
    assistant.setInput('');
    setActivePanel('chat');
    setShowLanding(false);
    setAttachMenuOpen(false);
    setShowDiscovery(true);
  };

  const handleLandingSubmit = async (value?: string) => {
    const text = (value ?? assistant.input).trim();
    if (!text || assistant.isBusy || assistant.isSearching) return;

    if (text === ICP_LEADS_PROMPT) {
      openActiveIcpSearch();
      return;
    }

    assistant.resetConversation();
    setActivePanel('chat');
    setShowDiscovery(false);
    setShowLanding(false);
    setAttachMenuOpen(false);
    await assistant.submitMessage(text);
  };

  const handleLandingSuggestion = (value: string) => {
    assistant.setInput(value);
    requestAnimationFrame(() => landingInputRef.current?.focus());
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  const openOutreachSetup = () => {
    assistant.startOutreachWorkflow();
    setActivePanel('flow');
  };

  const launchOutreachJourney = async () => {
    if (assistant.outreachWorkflowStage === 'idle') {
      assistant.startOutreachWorkflow();
    }
    const campaignId = await assistant.launchOutreachCampaign();
    if (campaignId !== null) {
      assistant.resetConversation();
      router.replace('/(drawer)/campaigns' as never);
    }
  };

  const scrollChatToEndSoon = () => {
    const scroll = () => listRef.current?.scrollToEnd({ animated: true });
    requestAnimationFrame(() => {
      setTimeout(scroll, 80);
      setTimeout(scroll, 320);
      setTimeout(scroll, 760);
    });
  };

  const handleChatScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleBottomTabScroll(event);
  };

  const revealInlineCheckpointWizard = () => {
    setShowLanding(false);
    setActivePanel('chat');
    setForceCheckpointInlineVisible(true);
    scrollChatToEndSoon();
  };

  const closeInlineCheckpointWizard = () => {
    setForceCheckpointInlineVisible(false);
    assistant.closeCheckpointWizard();
  };

  const handleLetAgentDealPress = () => {
    revealInlineCheckpointWizard();
    assistant.openCheckpointWizard(0);
    void assistant.letAgentDeal().finally(() => {
      setForceCheckpointInlineVisible(true);
      assistant.openCheckpointWizard(0);
      scrollChatToEndSoon();
    });
  };

  const handleConfigureManuallyPress = () => {
    revealInlineCheckpointWizard();
    assistant.openManualConfigWizard();
    scrollChatToEndSoon();
  };

  // ── Shared attach menu (web-parity "+" options) ───────────────────────────

  const renderAttachMenu = (inline = false) => (
    <View
      style={[
        inline ? styles.attachmentMenuInline : styles.attachmentMenu,
        { backgroundColor: appTheme.surface, borderColor: appTheme.border },
      ]}
    >
      <TouchableOpacity style={styles.attachmentItem} onPress={() => void handleImportLeads()}>
        <View style={[styles.attachmentIcon, { backgroundColor: '#DCFCE7' }]}>
          <Upload color="#16A34A" size={16} />
        </View>
        <View style={styles.attachmentCopy}>
          <Typography variant="bodySmall" color={appTheme.text} style={styles.attachmentTitle}>Import leads</Typography>
          <Typography variant="caption" color={appTheme.muted}>CSV, Excel, images, PDFs — parsed into your lead list</Typography>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.attachmentItem} onPress={openContactPicker}>
        <View style={[styles.attachmentIcon, { backgroundColor: '#DCE3F5' }]}>
          <UserRound color="#0B1957" size={16} />
        </View>
        <View style={styles.attachmentCopy}>
          <Typography variant="bodySmall" color={appTheme.text} style={styles.attachmentTitle}>Select contacts</Typography>
          <Typography variant="caption" color={appTheme.muted}>Pick from your existing contacts</Typography>
        </View>
      </TouchableOpacity>
      <View style={[styles.attachmentDivider, { backgroundColor: appTheme.borderSoft }]} />
      <TouchableOpacity style={styles.attachmentItem} onPress={handleConnectTools}>
        <View style={[styles.attachmentIcon, { backgroundColor: '#FEF3C7' }]}>
          <Layers color="#D97706" size={16} />
        </View>
        <View style={styles.attachmentCopy}>
          <Typography variant="bodySmall" color={appTheme.text} style={styles.attachmentTitle}>Connect tools</Typography>
          <Typography variant="caption" color={appTheme.muted}>LinkedIn, HubSpot, Salesforce</Typography>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ── Lead card (web-parity: checkbox, score, feedback, reasoning) ──────────

  const renderContactPickerModal = () => {
    const selectedSource = CONTACT_PICKER_SOURCES.find((source) => source.key === contactSourceKey);
    const visibleSelectedCount = contactPickerContacts.filter((contact) => contactSelectedIds.includes(contact.id)).length;
    const allVisibleSelected = contactPickerContacts.length > 0 && visibleSelectedCount === contactPickerContacts.length;
    const partiallyVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

    return (
      <Modal
        visible={showContactPicker}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={styles.contactPickerOverlay}>
          <View
            style={[
              styles.contactPickerSheet,
              contactPickerStep === 'contacts' ? styles.contactPickerContactsSheet : styles.contactPickerSourceSheet,
              {
                marginTop: Math.max(insets.top, 14),
                marginBottom: Math.max(insets.bottom, 14),
                backgroundColor: appTheme.surface,
                borderColor: appTheme.border,
              },
            ]}
          >
            <View style={[styles.contactPickerHeader, { borderBottomColor: appTheme.borderSoft }]}>
              <View style={styles.contactPickerHeaderLeft}>
                {contactPickerStep === 'contacts' ? (
                  <TouchableOpacity activeOpacity={0.76} onPress={() => setContactPickerStep('source')} style={styles.contactPickerBack}>
                    <ArrowLeft color={appTheme.muted} size={17} />
                  </TouchableOpacity>
                ) : null}
                <View style={[styles.contactPickerIcon, { backgroundColor: appTheme.infoSoft }]}>
                  <UserRound color={appTheme.primaryAccent} size={16} />
                </View>
                <View style={styles.contactPickerTitleBlock}>
                  <Typography variant="body" color={appTheme.text} style={styles.contactPickerTitle} numberOfLines={1}>
                    {contactPickerStep === 'source' ? 'Select contact source' : selectedSource?.label || 'Contacts'}
                  </Typography>
                  <Typography variant="caption" color={appTheme.muted} numberOfLines={2} style={styles.contactPickerSubtitle}>
                    {contactPickerStep === 'source' ? 'Choose where to pull contacts from' : 'Select contacts for your campaign'}
                  </Typography>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.76} onPress={() => setShowContactPicker(false)} style={styles.contactPickerClose}>
                <X color={appTheme.muted} size={18} />
              </TouchableOpacity>
            </View>

            {contactPickerStep === 'source' ? (
              <ScrollView style={styles.contactSourceList} showsVerticalScrollIndicator={false}>
                {CONTACT_PICKER_SOURCES.map((source) => (
                  <TouchableOpacity
                    key={source.key}
                    activeOpacity={0.78}
                    onPress={() => void selectContactSource(source.key)}
                    style={[styles.contactSourceRow, { borderBottomColor: appTheme.borderSoft }]}
                  >
                    <View style={[styles.contactSourceDot, { backgroundColor: source.color }]} />
                    <Typography variant="bodySmall" color={appTheme.text} style={styles.contactSourceLabel}>
                      {source.label}
                    </Typography>
                    <ChevronRight color={appTheme.disabled} size={16} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.contactPickerBody}>
                <View style={[styles.contactSearchWrap, { borderBottomColor: appTheme.borderSoft }]}>
                  <View style={[styles.contactSearchBox, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
                    <Search color={appTheme.disabled} size={14} />
                    <TextInput
                      style={[styles.contactSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                      value={contactSearch}
                      onChangeText={handleContactSearch}
                      placeholder="Search by name, phone or email..."
                      placeholderTextColor={appTheme.disabled}
                      autoFocus
                    />
                  </View>
                </View>

                {!contactPickerLoading && contactPickerContacts.length > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={toggleSelectAllContacts}
                    style={[styles.contactSelectAllRow, { backgroundColor: appTheme.softSurface, borderBottomColor: appTheme.borderSoft }]}
                  >
                    <View
                      style={[
                        styles.contactCheckbox,
                        {
                          backgroundColor: allVisibleSelected ? appTheme.primaryAccent : appTheme.surface,
                          borderColor: (allVisibleSelected || partiallyVisibleSelected) ? appTheme.primaryAccent : appTheme.border,
                        },
                      ]}
                    >
                      {allVisibleSelected ? <Check color="#FFFFFF" size={11} /> : partiallyVisibleSelected ? <View style={[styles.contactCheckboxDash, { backgroundColor: appTheme.primaryAccent }]} /> : null}
                    </View>
                    <Typography variant="caption" color={appTheme.muted} style={styles.contactSelectAllText}>
                      {allVisibleSelected ? 'Deselect all' : `Select all ${contactPickerContacts.length} shown`}
                    </Typography>
                  </TouchableOpacity>
                ) : null}

                <ScrollView style={styles.contactList} showsVerticalScrollIndicator={false}>
                  {contactPickerLoading ? (
                    <View style={styles.contactEmptyState}>
                      <ActivityIndicator color={appTheme.primaryAccent} />
                      <Typography variant="caption" color={appTheme.muted}>Loading contacts...</Typography>
                    </View>
                  ) : contactPickerError ? (
                    <View style={styles.contactEmptyState}>
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.contactEmptyTitle}>Unable to load contacts</Typography>
                      <Typography variant="caption" color={appTheme.muted} style={styles.contactEmptyCopy}>{contactPickerError}</Typography>
                    </View>
                  ) : contactPickerContacts.length === 0 ? (
                    <View style={styles.contactEmptyState}>
                      <UserRound color={appTheme.disabled} size={32} />
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.contactEmptyTitle}>No contacts found</Typography>
                      <Typography variant="caption" color={appTheme.muted} style={styles.contactEmptyCopy}>
                        {contactSearch ? 'Try a different search term' : 'No contacts in this source'}
                      </Typography>
                    </View>
                  ) : contactPickerContacts.map((contact) => {
                    const checked = contactSelectedIds.includes(contact.id);
                    const subtitle = [contact.company, contact.phone, contact.email].filter(Boolean).join(' - ');
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        activeOpacity={0.78}
                        onPress={() => toggleContactSelection(contact.id)}
                        style={[
                          styles.contactRow,
                          {
                            backgroundColor: checked ? appTheme.primarySoft : appTheme.surface,
                            borderBottomColor: appTheme.borderSoft,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.contactCheckbox,
                            {
                              backgroundColor: checked ? appTheme.primaryAccent : appTheme.surface,
                              borderColor: checked ? appTheme.primaryAccent : appTheme.border,
                            },
                          ]}
                        >
                          {checked ? <Check color="#FFFFFF" size={11} /> : null}
                        </View>
                        <View style={[styles.contactAvatar, { backgroundColor: avatarColor(contact.name) }]}>
                          {contact.avatarUrl ? (
                            <Image source={{ uri: contact.avatarUrl }} style={styles.contactAvatarImage} />
                          ) : (
                            <Typography variant="caption" color="#FFFFFF" style={styles.contactAvatarText}>{initials(contact.name) || '?'}</Typography>
                          )}
                        </View>
                        <View style={styles.contactCopy}>
                          <Typography variant="bodySmall" color={appTheme.text} style={styles.contactName} numberOfLines={1}>
                            {contact.name}
                          </Typography>
                          {subtitle ? (
                            <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                              {subtitle}
                            </Typography>
                          ) : null}
                        </View>
                        {contact.phone ? <Phone color={appTheme.disabled} size={13} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                  {contactPickerHasMore ? (
                    <TouchableOpacity
                      activeOpacity={0.78}
                      disabled={contactPickerLoadingMore}
                      onPress={loadMoreContactPickerContacts}
                      style={[styles.contactLoadMoreBtn, { borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
                    >
                      {contactPickerLoadingMore ? <ActivityIndicator size="small" color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={14} />}
                      <Typography variant="caption" color={appTheme.text} style={styles.contactLoadMoreText}>
                        {contactPickerLoadingMore ? 'Loading more...' : 'Load more contacts'}
                      </Typography>
                      {contactPickerTotal ? (
                        <Typography variant="caption" color={appTheme.muted}>
                          {contactPickerContacts.length} of {contactPickerTotal}
                        </Typography>
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                </ScrollView>

                <View style={[styles.contactPickerFooter, { borderTopColor: appTheme.borderSoft }]}>
                  <Typography variant="caption" color={appTheme.muted}>
                    {contactSelectedIds.length ? `${contactSelectedIds.length} selected` : 'None selected'}
                  </Typography>
                  <View style={styles.contactPickerFooterActions}>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      onPress={() => setContactPickerStep('source')}
                      style={[styles.contactFooterBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
                    >
                      <Typography variant="caption" color={appTheme.muted} style={styles.contactFooterText}>Back</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      disabled={!contactSelectedIds.length}
                      onPress={confirmContactPicker}
                      style={[
                        styles.contactFooterPrimary,
                        {
                          backgroundColor: contactSelectedIds.length ? appTheme.primaryAccent : appTheme.border,
                        },
                      ]}
                    >
                      <ArrowRight color={contactSelectedIds.length ? '#FFFFFF' : appTheme.muted} size={13} />
                      <Typography variant="caption" color={contactSelectedIds.length ? '#FFFFFF' : appTheme.muted} style={styles.contactFooterPrimaryText}>
                        Start Campaign{contactSelectedIds.length ? ` (${contactSelectedIds.length})` : ''}
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderAcceleratorPickerModal = () => (
    <Modal
      visible={showAcceleratorPicker}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => setShowAcceleratorPicker(false)}
    >
      <View style={styles.contactPickerOverlay}>
        <View
          style={[
            styles.acceleratorSheet,
            {
              marginTop: Math.max(insets.top, 14),
              marginBottom: Math.max(insets.bottom, 14),
              backgroundColor: appTheme.surface,
              borderColor: appTheme.border,
            },
          ]}
        >
          <View style={[styles.acceleratorHeader, { borderBottomColor: appTheme.borderSoft }]}>
            <View style={styles.contactPickerHeaderLeft}>
              <View style={[styles.contactPickerIcon, { backgroundColor: appTheme.infoSoft }]}>
                <Briefcase color={appTheme.primaryAccent} size={16} />
              </View>
              <View style={styles.contactPickerTitleBlock}>
                <Typography variant="body" color={appTheme.text} style={styles.contactPickerTitle} numberOfLines={1}>
                  Pick an Accelerator
                </Typography>
                <Typography variant="caption" color={appTheme.muted} numberOfLines={2} style={styles.contactPickerSubtitle}>
                  {WORKFLOW_TEMPLATES.length} prebuilt pipelines from LAD Frontend 2
                </Typography>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.76} onPress={() => setShowAcceleratorPicker(false)} style={styles.contactPickerClose}>
              <X color={appTheme.muted} size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.acceleratorList}
            contentContainerStyle={styles.acceleratorListContent}
            showsVerticalScrollIndicator={false}
          >
            {acceleratorGroups.map((group) => (
              <View key={group.label} style={styles.acceleratorSection}>
                <View style={styles.acceleratorSectionHeader}>
                  <Typography variant="overline" color={appTheme.disabled} style={styles.acceleratorSectionTitle}>
                    {group.label}
                  </Typography>
                  <View style={[styles.acceleratorSectionLine, { backgroundColor: appTheme.borderSoft }]} />
                </View>
                {group.data.map((template) => (
                  <TouchableOpacity
                    key={template.key}
                    activeOpacity={0.8}
                    onPress={() => handleAcceleratorPick(template)}
                    style={[styles.acceleratorCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}
                  >
                    <View style={[styles.acceleratorCardIcon, { backgroundColor: `${template.accent}16` }]}>
                      <AcceleratorTemplateIcon tplKey={template.key} color={template.accent} size={18} />
                    </View>
                    <View style={styles.acceleratorCardCopy}>
                      <View style={styles.acceleratorCardTop}>
                        <Typography variant="bodySmall" color={appTheme.text} style={styles.acceleratorCardTitle} numberOfLines={2}>
                          {template.name}
                        </Typography>
                        {template.badge ? (
                          <View style={[styles.acceleratorBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${template.accent}14`, borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
                            <Typography variant="overline" color={template.accent} style={styles.acceleratorBadgeText}>
                              {template.badge.label}
                            </Typography>
                          </View>
                        ) : null}
                      </View>
                      <Typography variant="caption" color={appTheme.muted} style={styles.acceleratorCardTagline} numberOfLines={2}>
                        {template.tagline}
                      </Typography>
                      <AcceleratorChain template={template} compact />
                      <View style={styles.acceleratorMetaRow}>
                        <View style={[styles.acceleratorMetaPill, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                          <Clock color={appTheme.disabled} size={11} />
                          <Typography variant="overline" color={appTheme.muted} style={styles.acceleratorMetaText}>
                            {template.meta.cycleDays}d
                          </Typography>
                        </View>
                        <View style={[styles.acceleratorMetaPill, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                          <Layers color={appTheme.disabled} size={11} />
                          <Typography variant="overline" color={appTheme.muted} style={styles.acceleratorMetaText}>
                            {template.meta.channels} channels
                          </Typography>
                        </View>
                      </View>
                    </View>
                    <ChevronRight color={appTheme.disabled} size={17} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderLeadCard = (lead: MobileAssistantLead, options?: { selectable?: boolean }) => {
    const tone = scoreTone(lead.score);
    const selectable = options?.selectable ?? false;
    const selected = assistant.selectedLeadIds.includes(lead.id);
    const feedback = assistant.leadFeedback[lead.id];

    return (
      <GlassCard key={lead.id} style={[styles.leadCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        <View style={styles.leadTop}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(lead.name) }]}>
            <Typography variant="caption" color="#FFFFFF" style={styles.avatarText}>
              {initials(lead.name) || '?'}
            </Typography>
          </View>
          <View style={styles.leadTitleBlock}>
            <View style={styles.leadNameRow}>
              <Typography variant="body" color={appTheme.text} style={styles.leadName} numberOfLines={1}>
                {lead.name}
              </Typography>
              {!lead.locked ? (
                <Typography variant="caption" color="#10B981" style={styles.verified}>✓</Typography>
              ) : null}
            </View>
            <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
              {lead.headline || lead.company || lead.location || 'Prospect'}
            </Typography>
          </View>
          {lead.score != null ? (
            <View style={[styles.scorePill, {
              backgroundColor: appTheme.darkMode ? appTheme.labelBackground : tone.bg,
              borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent',
              borderWidth: appTheme.darkMode ? 1 : 0,
            }]}>
              <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : tone.fg} style={styles.scoreText}>{tone.dot} {lead.score}%</Typography>
            </View>
          ) : null}
          {selectable ? (
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => assistant.toggleLeadSelection(lead.id)}
            >
              {selected
                ? <CheckSquare color={appTheme.primaryAccent} size={21} />
                : <Square color={appTheme.disabled} size={21} />}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.leadMeta}>
          {lead.company ? (
            <View style={styles.metaItem}>
              <Building2 color={appTheme.muted} size={14} />
              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.company}</Typography>
            </View>
          ) : null}
          {lead.location ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>📍 {lead.location}</Typography> : null}
          {lead.industry ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.industry}</Typography> : null}
        </View>

        {lead.reasoning ? (
          <Typography variant="bodySmall" color={appTheme.muted} style={styles.reasoning} numberOfLines={3}>
            {lead.reasoning}
          </Typography>
        ) : null}

        <View style={styles.leadActions}>
          {lead.profileUrl ? (
            <TouchableOpacity style={[styles.smallAction, { borderColor: appTheme.border }]} onPress={() => openUrl(lead.profileUrl)}>
              <ExternalLink color={appTheme.primaryAccent} size={14} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.actionText}>LinkedIn</Typography>
            </TouchableOpacity>
          ) : null}
          {lead.email ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.leadContact}>✉️ {lead.email}</Typography> : null}
          {lead.phone ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>📞 {lead.phone}</Typography> : null}
          {selectable && !lead.locked ? (
            <View style={styles.feedbackRow}>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={() => assistant.toggleLeadFeedback(lead.id, 'good')}
                style={[styles.feedbackBtn, feedback === 'good' && { backgroundColor: '#DCFCE7' }]}
              >
                <ThumbsUp color={feedback === 'good' ? '#16A34A' : appTheme.disabled} size={14} />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={() => assistant.toggleLeadFeedback(lead.id, 'bad')}
                style={[styles.feedbackBtn, feedback === 'bad' && { backgroundColor: '#FEE2E2' }]}
              >
                <ThumbsDown color={feedback === 'bad' ? '#DC2626' : appTheme.disabled} size={14} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </GlassCard>
    );
  };

  // ── Imported-lead card (web-parity: Image 1 — checkbox, "?" avatar + green
  // verified badge, name/company, LinkedIn link, Edit/Delete icons) ─────────

  const openEditLead = (leadId: string) => setEditingLeadId(leadId);

  const confirmRemoveLead = (lead: MobileAssistantLead) => {
    Alert.alert(
      'Remove lead',
      `Remove ${lead.name || 'this lead'} from your imported leads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => assistant.removeLead(lead.id) },
      ],
    );
  };

  const editingLead = editingLeadId ? assistant.leads.find((lead) => lead.id === editingLeadId) || null : null;

  const renderImportedLeadCard = (lead: MobileAssistantLead) => {
    const selected = assistant.selectedLeadIds.includes(lead.id);
    const displayName = lead.name && lead.name !== 'Imported lead' ? lead.name : 'Unknown';
    const hasRealName = displayName !== 'Unknown';
    const roleLine = (lead.headline || '').trim();
    const researchSummary = String((lead.raw as Record<string, unknown> | undefined)?.background_summary ?? '').trim();
    const summaryOpen = openSummaryLeadIds.has(lead.id);
    const toggleSummary = () => {
      setOpenSummaryLeadIds((current) => {
        const next = new Set(current);
        if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
        return next;
      });
    };

    return (
      <GlassCard key={lead.id} style={[styles.leadCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        <View style={styles.leadTop}>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => assistant.toggleLeadSelection(lead.id)}
          >
            {selected
              ? <CheckSquare color={appTheme.primaryAccent} size={21} />
              : <Square color={appTheme.disabled} size={21} />}
          </TouchableOpacity>

          <View style={styles.importedAvatarWrap}>
            <View style={[styles.avatar, { backgroundColor: '#0B1957' }]}>
              <Typography variant="caption" color="#FFFFFF" style={[styles.avatarText, !hasRealName && styles.avatarQuestionMark]}>
                {hasRealName ? (initials(displayName) || '?') : '?'}
              </Typography>
            </View>
            <View style={styles.verifiedBadge}>
              <Check color="#FFFFFF" size={9} />
            </View>
          </View>

          <View style={styles.leadTitleBlock}>
            <Typography variant="body" color={appTheme.text} style={styles.leadName} numberOfLines={1}>
              {displayName}
            </Typography>
            <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
              {lead.company || 'No company'}
            </Typography>
            {roleLine && roleLine !== lead.company ? (
              <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
                {roleLine}
              </Typography>
            ) : null}
            {lead.email ? (
              <View style={styles.leadContactRow}>
                <Mail color={appTheme.muted} size={11} />
                <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.leadContactText}>
                  {lead.email}
                </Typography>
              </View>
            ) : null}
            {lead.phone ? (
              <View style={styles.leadContactRow}>
                <Phone color={appTheme.muted} size={11} />
                <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.leadContactText}>
                  {lead.phone}
                </Typography>
              </View>
            ) : null}
            {lead.profileUrl ? (
              <TouchableOpacity activeOpacity={0.75} onPress={() => openUrl(lead.profileUrl)} style={styles.linkedinLinkRow}>
                <ExternalLink color="#0A66C2" size={12} />
                <Typography variant="caption" color="#0A66C2" style={styles.linkedinLinkText}>LinkedIn Profile</Typography>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.leadRowActions}>
            <TouchableOpacity
              style={[styles.iconActionBtn, { backgroundColor: appTheme.softSurface }]}
              onPress={() => openEditLead(lead.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Pencil color={appTheme.muted} size={15} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconActionBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => confirmRemoveLead(lead)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 color="#DC2626" size={15} />
            </TouchableOpacity>
          </View>
        </View>

        {researchSummary ? (
          <View style={[styles.researchSummaryBox, { borderColor: appTheme.borderSoft }]}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={toggleSummary}
              style={styles.researchSummaryHeader}
            >
              <View style={styles.researchSummaryTitleRow}>
                <Sparkles color={appTheme.primaryAccent} size={12} />
                <Typography variant="overline" color={appTheme.muted} style={styles.researchSummaryTitle}>
                  AI Research Summary
                </Typography>
              </View>
              <ChevronDown
                color={appTheme.muted}
                size={14}
                style={summaryOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </TouchableOpacity>
            {summaryOpen ? (
              <View style={[styles.researchSummaryBody, { borderTopColor: appTheme.borderSoft, backgroundColor: appTheme.softSurface }]}>
                <Typography variant="caption" color={appTheme.text} style={styles.researchSummaryText}>
                  {researchSummary}
                </Typography>
              </View>
            ) : null}
          </View>
        ) : null}
      </GlassCard>
    );
  };

  const renderMessage = ({ item }: { item: AssistantChatMessage }) => {
    const isUser = item.role === 'user';
    const isUploadMessage = isUser && item.text.trim().startsWith('Uploaded:');
    const isRoleMessage = isUser && /^Role:\s*/i.test(item.text.trim());
    const isRoleCard = Boolean(item.roleCard);
    const uploadLabel = isUploadMessage ? item.text.replace(/^Uploaded:\s*/i, '').trim() || 'leads.csv' : '';
    const roleAvatarLabel = initials(currentUser?.name || currentUser?.email || 'User').slice(0, 1) || 'U';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant, isRoleCard && styles.roleMessageRow]}>
        {!isUser && !isRoleCard ? (
          <View style={[styles.botDot, { backgroundColor: appTheme.infoSoft }]}>
            <LADMark color={appTheme.primaryAccent} size={20} />
          </View>
        ) : isRoleCard ? (
          <View style={[styles.roleAssistantSpacer, isNarrowPhone && styles.roleAssistantSpacerNarrow]} />
        ) : null}
        <View style={[
          styles.bubble,
          item.roleCard && styles.acceleratorBubble,
          item.roleCard && isNarrowPhone && styles.acceleratorBubbleNarrow,
          item.roleCard && { maxWidth: isCompact ? Math.min(540, width * 0.72) : 560 },
          isUploadMessage && styles.uploadMessageBubble,
          isRoleMessage && styles.roleUserBubble,
          {
            backgroundColor: isRoleCard ? 'transparent' : isUser ? appTheme.primaryAccent : appTheme.surface,
            borderColor: isRoleCard ? 'transparent' : isUser ? appTheme.primaryAccent : appTheme.border,
          },
        ]}>
          {isUser ? (
            isUploadMessage ? (
              <View style={styles.uploadMessageContent}>
                <Upload color="#FFFFFF" size={14} />
                <Typography variant="bodySmall" color="#FFFFFF" style={styles.uploadMessageText} numberOfLines={1}>
                  Uploaded: {uploadLabel}
                </Typography>
              </View>
            ) : (
              <Typography
                variant={isRoleMessage ? 'body' : 'bodySmall'}
                color={Theme.colors.surface}
                style={[styles.messageText, isRoleMessage && styles.roleMessageText]}
              >
                {item.text}
              </Typography>
            )
          ) : item.roleCard ? (
            <>
              <View style={styles.roleAssistantLabel}>
                <Typography
                  variant="overline"
                  color={appTheme.darkMode ? '#B8C7FF' : '#0B1957'}
                  style={styles.roleAssistantLabelText}
                >
                  LAD IN ACTION
                </Typography>
                <View style={styles.roleAssistantDot} />
              </View>
              <AcceleratorRoleCardView
                card={item.roleCard}
                onOption={handleAssistantOption}
                previewing={assistant.acceleratorPreviewing}
                profile={businessProfile}
              />
              {item.text ? <MarkdownText text={item.text} textColor={appTheme.text} /> : null}
            </>
          ) : (
            <MarkdownText text={item.text} textColor={appTheme.text} />
          )}
          {item.options?.length ? (
            <View style={styles.optionWrap}>
              {item.options.map((option) => (
                <TouchableOpacity
                  key={`${item.id}-${option.value}`}
                  activeOpacity={0.78}
                  onPress={() => handleAssistantOption(option.value)}
                  style={[styles.optionChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border }]}
                >
                  <Typography variant="caption" color={appTheme.text} style={styles.optionText}>{option.label}</Typography>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {item.leads?.length ? (
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setActivePanel('leads')}
              style={[styles.leadsFoundChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border }]}
            >
              <UsersRound color={appTheme.primaryAccent} size={15} />
              <Typography variant="caption" color={appTheme.text} style={styles.leadsFoundChipText}>
                {item.leads.length} lead{item.leads.length === 1 ? '' : 's'} found — View leads
              </Typography>
            </TouchableOpacity>
          ) : null}
        </View>
        {isUploadMessage ? (
          <View style={[styles.uploadMessageAvatar, { backgroundColor: appTheme.darkMode ? '#15245F' : '#172560' }]}>
            <Typography variant="caption" color="#FFFFFF" style={styles.uploadedAvatarText}>U</Typography>
          </View>
        ) : isRoleMessage ? (
          <View style={[styles.uploadMessageAvatar, styles.roleMessageAvatar, { backgroundColor: appTheme.darkMode ? '#15245F' : '#172560' }]}>
            <Typography variant="caption" color="#FFFFFF" style={styles.uploadedAvatarText}>{roleAvatarLabel}</Typography>
          </View>
        ) : null}
      </View>
    );
  };

  const renderOutreachStatusCard = () => {
    if (assistant.outreachWorkflowStage === 'idle') return null;

    const selectedChannels = assistant.selectedOutreachChannels.length
      ? assistant.selectedOutreachChannels
      : ['linkedin', 'email', 'whatsapp', 'voice'];
    const hasLaunchError = Boolean(assistant.error && assistant.outreachWorkflowStage !== 'launching' && assistant.outreachWorkflowStage !== 'launched');
    const statusTitle = assistant.outreachWorkflowStage === 'launching'
      ? 'Creating outreach journey'
      : assistant.outreachWorkflowStage === 'launched'
        ? 'Outreach journey created'
        : hasLaunchError
          ? 'Outreach journey not created'
          : 'Outreach journey ready';
    const enrolled = selectedCount || assistant.leads.length;
    const statusBody = assistant.outreachWorkflowStage === 'launching'
      ? 'Preparing the campaign, leads, channels, and workflow steps.'
      : assistant.outreachWorkflowStage === 'launched'
        ? assistant.launchedCampaignId
          ? `Campaign ID ${assistant.launchedCampaignId} is now available in Campaigns.`
          : 'The journey is ready. You can monitor it from Campaigns.'
        : hasLaunchError
          ? assistant.error
          : `${enrolled} lead${enrolled === 1 ? '' : 's'} · ${selectedChannels.join(', ')} · ${assistant.campaignDays || 30} days`;

    return (
      <GlassCard
        style={[
          styles.launchStatusCard,
          {
            backgroundColor: hasLaunchError ? '#FFF7ED' : appTheme.surface,
            borderColor: hasLaunchError ? '#FDBA74' : appTheme.border,
          },
        ]}
      >
        <View style={styles.launchStatusHeader}>
          <View style={[styles.launchStatusIcon, { backgroundColor: hasLaunchError ? '#FED7AA' : appTheme.infoSoft }]}>
            {assistant.outreachWorkflowStage === 'launching' ? (
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
            ) : assistant.outreachWorkflowStage === 'launched' ? (
              <Check color={appTheme.primaryAccent} size={16} />
            ) : (
              <Zap color={hasLaunchError ? '#EA580C' : appTheme.primaryAccent} size={16} />
            )}
          </View>
          <View style={styles.launchStatusCopy}>
            <Typography variant="bodySmall" color={hasLaunchError ? '#9A3412' : appTheme.text} style={styles.launchStatusTitle}>
              {statusTitle}
            </Typography>
            <Typography variant="caption" color={hasLaunchError ? '#C2410C' : appTheme.muted} style={styles.launchStatusText}>
              {statusBody}
            </Typography>
          </View>
        </View>
      </GlassCard>
    );
  };

  const renderResultActions = () => {
    if (!hasLeads) return null;
    const shouldLaunch = activePanel === 'flow';
    const isLaunching = assistant.outreachWorkflowStage === 'launching';
    const isLaunched = assistant.outreachWorkflowStage === 'launched';
    const outlineColor = appTheme.darkMode ? appTheme.primaryAccent : '#0B1957';
    // "Configure manually" replaces the old generic "Create Outreach Journey"
    // label outside the Flow tab — both it and the inbound summary card's
    // "Create Outreach Journey" button open the same wizard at step 0.
    const primaryLabel = isLaunched && shouldLaunch
      ? 'Journey Created'
      : shouldLaunch
        ? `Launch Campaign${selectedCount ? ` (${selectedCount})` : ''}`
        : 'Configure manually';
    const showManualConfigure = !shouldLaunch;

    return (
      <View style={styles.resultActionsWrap}>
        {!shouldLaunch && !isLaunched ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleLetAgentDealPress}
            disabled={assistant.cpAgentDealLoading}
            style={[styles.agentDealBtn, { backgroundColor: '#312E81' }, assistant.cpAgentDealLoading && styles.disabled]}
          >
            {assistant.cpAgentDealLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Zap color="#FFFFFF" size={16} />}
            <Typography variant="bodySmall" color="#FFFFFF" style={styles.agentDealText}>
              {assistant.cpAgentDealLoading ? 'Building your campaign…' : 'Let Agent Deal — auto-build every connected channel'}
            </Typography>
          </TouchableOpacity>
        ) : null}
        <View style={[styles.resultActionBar, { borderTopColor: appTheme.borderSoft }]}>
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => {
              setActivePanel('chat');
              assistant.refineTargeting();
            }}
            style={[styles.refineBtn, { backgroundColor: appTheme.surface, borderColor: outlineColor }]}
          >
            <Typography variant="caption" color={outlineColor} style={styles.refineText}>Refine</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={shouldLaunch ? () => void launchOutreachJourney() : handleConfigureManuallyPress}
            disabled={isLaunching || (isLaunched && shouldLaunch)}
            style={[
              styles.journeyBtn,
              showManualConfigure
                ? { backgroundColor: appTheme.surface, borderColor: outlineColor }
                : { backgroundColor: appTheme.primaryAccent, borderColor: appTheme.primaryAccent },
              (isLaunching || (isLaunched && shouldLaunch)) && styles.disabled,
            ]}
          >
            {isLaunching && shouldLaunch ? (
              <ActivityIndicator color={Theme.colors.surface} size="small" />
            ) : (
              <Typography variant="caption" color={showManualConfigure ? outlineColor : Theme.colors.surface} style={styles.journeyText}>{primaryLabel}</Typography>
            )}
          </TouchableOpacity>
        </View>
        {checkpointInlineVisible ? (
          <View style={[styles.inlineCheckpointHost, { borderTopColor: appTheme.borderSoft }]}>
            <CheckpointWizard
              visible
              presentation="inline"
              onClose={closeInlineCheckpointWizard}
              onInputFocus={handleCheckpointInputFocus}
              style={{ width: '100%' }}
            />
          </View>
        ) : null}
      </View>
    );
  };

  // ── Leads panel (web parity) ───────────────────────────────────────────────

  const renderImportSearchingPanel = () => (
    <ScrollView
      style={styles.panelPage}
      contentContainerStyle={[
        styles.importSearchingContent,
        {
          paddingTop: insets.top + 68,
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom + 112, 140),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomTabScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.uploadedRow}>
        <View style={[styles.uploadedPill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackgroundActive : '#0B1957', borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
          <Upload color="#FFFFFF" size={15} />
          <Typography variant="bodySmall" color="#FFFFFF" style={styles.uploadedText} numberOfLines={1}>
            Uploaded: {uploadedFileName || 'leads.csv'}
          </Typography>
        </View>
        <View style={[styles.uploadedAvatar, { backgroundColor: appTheme.darkMode ? '#15245F' : '#172560' }]}>
          <Typography variant="caption" color="#FFFFFF" style={styles.uploadedAvatarText}>U</Typography>
        </View>
      </View>

      <View style={styles.importActionBlock}>
        <View style={styles.importActionTitleRow}>
          <Typography
            variant="overline"
            color={appTheme.darkMode ? '#B8C7FF' : '#0B1957'}
            style={styles.importActionTitle}
          >
            LAD IN ACTION
          </Typography>
          <View style={styles.importActionDot} />
        </View>
        <Typography variant="bodySmall" color={appTheme.text} style={styles.importSearchingText}>
          Searching and analysing uploaded leads...
        </Typography>
        <Typography variant="caption" color={appTheme.muted} style={styles.importSearchingDetail}>
          Building profiles in the background - searching Google and LinkedIn for additional context on each lead.
        </Typography>
      </View>
    </ScrollView>
  );

  const renderLeadsPanel = () => (
    <ScrollView
      style={styles.panelPage}
      contentContainerStyle={[
        styles.panelPageContent,
        {
          paddingTop: insets.top + 68,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomNavClearance + 24,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomTabScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.panelTitleRow}>
        <View style={styles.panelTitleCopy}>
          <Typography variant="h3" color={appTheme.text}>
            {assistant.importedMode ? 'Your Imported Leads' : 'Your Lead Results'}
          </Typography>
          <Typography variant="caption" color={appTheme.muted}>
            <Typography variant="caption" color={appTheme.primaryAccent}>✦ </Typography>
            {assistant.importedMode
              ? 'Leads imported from your file — ready to launch a campaign'
              : 'Contacts ready for outreach — review and launch your campaign.'}
          </Typography>
        </View>
        <View style={[styles.countBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.infoSoft, borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
          <Typography variant="caption" color={appTheme.primaryAccent} style={styles.countBadgeText}>
            {assistant.totalResults || assistant.leads.length}
          </Typography>
        </View>
      </View>

      {/* Selection bar — pick which prospects to enroll into the campaign */}
      <View style={[styles.selectionBar, { backgroundColor: appTheme.infoSoft, borderColor: appTheme.borderSoft }]}>
        <Typography variant="caption" color={appTheme.text} style={styles.selectionText}>
          {selectedCount} of {assistant.leads.length} selected
        </Typography>
        <View style={styles.selectionActions}>
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={assistant.selectAllLeads}
            style={[styles.selectionBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
          >
            <Typography variant="caption" color={appTheme.primaryAccent} style={styles.selectionBtnText}>Select all</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={assistant.clearLeadSelection}
            style={[styles.selectionBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
          >
            <Typography variant="caption" color={appTheme.muted} style={styles.selectionBtnText}>Clear</Typography>
          </TouchableOpacity>
        </View>
      </View>

      {assistant.leads.map((lead) => (
        assistant.importedMode ? renderImportedLeadCard(lead) : renderLeadCard(lead, { selectable: true })
      ))}

      {!assistant.importedMode && hasLeads ? (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => void assistant.loadMore()}
          disabled={assistant.isLoadingMore}
          style={[styles.getMoreBtn, { backgroundColor: appTheme.primaryAccent }, assistant.isLoadingMore && styles.disabled]}
        >
          {assistant.isLoadingMore ? (
            <ActivityIndicator color={Theme.colors.surface} size="small" />
          ) : (
            <>
              <Typography variant="caption" color={Theme.colors.surface} style={styles.loadMoreText}>Get More Leads</Typography>
              <ArrowRight color={Theme.colors.surface} size={14} />
            </>
          )}
        </TouchableOpacity>
      ) : null}

    </ScrollView>
  );

  // ── Flow panel (n8n-style Workflow Builder) ────────────────────────────────

  const renderFlowPanel = () => (
    <View
      style={[
        styles.flowPage,
        {
          paddingTop: insets.top + 68,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomNavClearance + 24,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
    >
      <View style={styles.flowTitleRow}>
        <View style={styles.panelTitleCopy}>
          <Typography variant="h3" color={appTheme.text} style={styles.flowTitle}>Campaign Accelerator</Typography>
          <Typography variant="caption" color={appTheme.muted}>Live preview of your outreach sequence</Typography>
        </View>
      </View>

      <WorkflowCanvas
        style={styles.flowCanvas}
        steps={assistant.workflowSteps}
        mode={assistant.importedMode ? 'inbound' : 'outbound'}
        campaignStatus={assistant.outreachWorkflowStage}
        onAddStep={assistant.addWorkflowStep}
        onRemoveStep={assistant.removeWorkflowStep}
        onEditStep={assistant.updateWorkflowStep}
      />
    </View>
  );

  // ── Bottom Chat / Leads / Flow nav (mirrors web mobile footer) ─────────────

  const renderMobilePanelNav = () => {
    if (isKeyboardVisible || (!hasConversation && !hasLeads)) return null;
    const items = [
      { id: 'chat' as const, label: 'Chat', icon: MessageSquare, disabled: false },
      { id: 'leads' as const, label: 'Leads', icon: UsersRound, disabled: !hasLeads },
      { id: 'flow' as const, label: 'Flow', icon: Zap, disabled: false },
    ];
    const navMaxWidth = width >= 560 ? 420 : Math.min(408, width - 24);
    const darkMode = appTheme.darkMode;
    const shellBackground = darkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
    const shellBorderColor = darkMode ? 'rgba(226,232,240,0.16)' : 'rgba(203,213,225,0.86)';
    const activeBackground = darkMode ? '#2976F4' : appTheme.primary;

    return (
      <View
        pointerEvents="box-none"
        style={[styles.bottomPanelNavWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <View style={[styles.bottomPanelNav, { width: navMaxWidth, backgroundColor: shellBackground, borderColor: shellBorderColor }]}>
          <BlurView intensity={darkMode ? 44 : 58} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: shellBackground }]} pointerEvents="none" />
          {items.map((item) => {
            const selected = activePanel === item.id;
            const Icon = item.icon;
            const iconColor = selected ? '#FFFFFF' : darkMode ? '#94A3B8' : '#64748B';
            const labelColor = selected ? (darkMode ? '#60A5FA' : appTheme.primary) : (darkMode ? '#94A3B8' : '#64748B');

            return (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={8}
                activeOpacity={0.78}
                disabled={item.disabled}
                onPress={() => setActivePanel(item.id)}
                style={[styles.panelNavItem, item.disabled && styles.disabled]}
              >
                <View
                  style={[
                    styles.panelNavIconHalo,
                    selected && [
                      styles.panelNavIconHaloActive,
                      { backgroundColor: activeBackground },
                    ],
                  ]}
                >
                  <Icon color={iconColor} size={19} strokeWidth={selected ? 2.5 : 2} />
                </View>
                <Typography
                  variant="caption"
                  color={labelColor}
                  style={[styles.panelNavLabel, selected && styles.panelNavLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const handleIcpProfileChange = useCallback((profile: BusinessProfile) => {
    setBusinessProfile(profile);
    setProfileHasData(hasAnyProfileData(profile));
  }, []);

  const icpModal = (
    <IcpDiscoveryModal
      visible={showIcpDiscovery}
      onClose={() => setShowIcpDiscovery(false)}
      onProfileChange={handleIcpProfileChange}
    />
  );
  const contactPickerModal = renderContactPickerModal();
  const acceleratorPickerModal = renderAcceleratorPickerModal();

  // ── LANDING ────────────────────────────────────────────────────────────────

  if (showLanding) {
    const landingChipWidth = width < 360 ? '100%' : '48%';
    const canSendLanding = Boolean(assistant.input.trim()) && !assistant.isBusy && !assistant.isSearching;
    const landingBackground = appTheme.darkMode ? appTheme.background : '#FFFFFF';
    const landingAccent = appTheme.darkMode ? '#B8C7FF' : '#0B1957';
    const landingBorder = appTheme.darkMode ? appTheme.primaryAccent : '#2B6CFF';

    return (
      // behavior="padding" on BOTH platforms: Expo SDK 54 forces Android
      // edge-to-edge, which disables adjustResize — without an explicit
      // behavior the keyboard covers the input on device builds.
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: landingBackground }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {icpModal}
        {contactPickerModal}
        {acceleratorPickerModal}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.landingContent,
            {
              paddingTop: insets.top + Theme.spacing.lg,
              paddingBottom: Math.max(insets.bottom + 32, Theme.spacing.xxl),
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          {attachMenuOpen ? (
            <Pressable
              style={styles.attachDismissLayer}
              onPress={() => setAttachMenuOpen(false)}
            />
          ) : null}
          <View style={[styles.landingTopBar, { width: landingContentWidth }]}>
            <TouchableOpacity onPress={handleBack} style={[styles.landingBackBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} activeOpacity={0.76}>
              <ArrowLeft color={appTheme.text} size={22} />
            </TouchableOpacity>
            {/* Blue ICP Discovery button — opens the AI Playground drawer (web parity) */}
            <TouchableOpacity
              onPress={() => setShowIcpDiscovery(true)}
              style={[styles.landingMagicBtn, { backgroundColor: '#0B1957' }]}
              activeOpacity={0.82}
            >
              <Sparkles color={Theme.colors.surface} size={25} />
              {profileHasData ? <View style={styles.profileDot} /> : null}
            </TouchableOpacity>
          </View>

          <View style={[styles.landingHero, { width: landingContentWidth }]}>
            <View style={styles.landingLogoWrap}>
              <LADMark color={landingAccent} size={48} />
            </View>
            <View style={styles.landingTitleRow}>
              <Typography variant={isCompact ? 'h4' : 'h3'} color={appTheme.text} style={styles.landingTitle} numberOfLines={2}>
                Hey! I am LAD, How can I help you today?
              </Typography>
              <Sparkles color={appTheme.darkMode ? '#B8C7FF' : '#C5D8F4'} size={24} />
            </View>
          </View>

          <View style={[styles.landingInputOuter, attachMenuOpen && styles.attachMenuHost, { width: landingContentWidth, borderColor: landingBorder, backgroundColor: appTheme.surface }]}>
            <TextInput
              ref={landingInputRef}
              style={[styles.landingInput, WEB_INPUT_RESET, { color: appTheme.text }]}
              placeholder={typedPlaceholder || 'Ask LAD to find leads, research accounts, or build outreach...'}
              placeholderTextColor={appTheme.darkMode ? appTheme.primaryAccent : '#0B1957'}
              value={assistant.input}
              onChangeText={assistant.setInput}
              editable={!assistant.isBusy && !assistant.isSearching && !importing}
              multiline
              blurOnSubmit
              returnKeyType="send"
              onFocus={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
              onSubmitEditing={() => void handleLandingSubmit()}
            />
            <View style={styles.landingInputFooter}>
              <View style={styles.landingFooterCluster}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setAttachMenuOpen((value) => !value)}
                  style={[styles.landingCircleBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
                >
                  <Plus color={landingAccent} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={openAcceleratorPicker}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  style={[styles.landingAcceleratorChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border }]}
                >
                  <Briefcase color={landingAccent} size={13} />
                  <Typography variant="caption" color={appTheme.text} style={styles.landingAcceleratorText} numberOfLines={1}>
                    Accelerators
                  </Typography>
                  <ChevronDown color={appTheme.muted} size={12} />
                </TouchableOpacity>
              </View>
              <View style={styles.landingFooterCluster}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={assistant.toggleSalesNav}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={assistant.useSalesNav ? 'Premium Search on' : 'Premium Search off'}
                  style={[
                    styles.landingPremiumChip,
                    {
                      backgroundColor: appTheme.darkMode
                        ? assistant.useSalesNav ? appTheme.labelBackgroundActive : appTheme.labelBackground
                        : assistant.useSalesNav ? appTheme.primaryAccent : appTheme.softSurface,
                      borderColor: appTheme.darkMode ? appTheme.labelBorder : assistant.useSalesNav ? appTheme.primaryAccent : appTheme.border,
                    },
                  ]}
                >
                  <Star color={assistant.useSalesNav && !appTheme.darkMode ? Theme.colors.surface : appTheme.primaryAccent} size={16} />
                </TouchableOpacity>
                <Pressable
                  disabled={!canSendLanding}
                  onHoverIn={() => setHoveredSend('landing')}
                  onHoverOut={() => setHoveredSend(null)}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  onPress={() => void handleLandingSubmit()}
                  style={({ pressed }) => [
                    styles.landingSendBtn,
                    {
                      backgroundColor: canSendLanding
                        ? hoveredSend === 'landing'
                          ? appTheme.darkMode ? '#1D5CC2' : '#122A75'
                          : appTheme.darkMode ? '#1647A5' : '#0B1957'
                        : appTheme.darkMode ? '#13285C' : '#E7ECF5',
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  {assistant.isBusy || assistant.isSearching
                    ? <ActivityIndicator color={canSendLanding ? '#FFFFFF' : appTheme.disabled} size="small" />
                    : <Send color={canSendLanding ? '#FFFFFF' : appTheme.darkMode ? '#7890BE' : appTheme.muted} size={18} />}
                </Pressable>
              </View>
            </View>
            {attachMenuOpen ? renderAttachMenu(true) : null}
          </View>

          <View style={[styles.landingSuggestions, { width: landingContentWidth }]}>
            {LANDING_SUGGESTIONS.map((suggestion, index) => {
              const isLastOdd =
                index === LANDING_SUGGESTIONS.length - 1 &&
                LANDING_SUGGESTIONS.length % 2 !== 0;
              const chipWidth = landingChipWidth === '100%' || isLastOdd ? '100%' : '48%';
              return (
                <TouchableOpacity
                  key={suggestion.label}
                  activeOpacity={0.78}
                  onPress={() => handleLandingSuggestion(suggestion.value)}
                  style={[
                    styles.landingSuggestionChip,
                    {
                      width: chipWidth,
                      borderColor: appTheme.darkMode ? appTheme.border : '#8FB1FF',
                      backgroundColor: appTheme.surface,
                    },
                  ]}
                >
                  <View style={[styles.landingSuggestionIcon, { backgroundColor: appTheme.softSurface }]}>
                    <LandingSuggestionIcon icon={suggestion.icon} color={appTheme.darkMode ? appTheme.primaryAccent : '#0B1957'} />
                  </View>
                  <Typography variant="caption" color={appTheme.text} style={styles.landingSuggestionText}>
                    {suggestion.label}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── CHAT / LEADS / FLOW ────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: appTheme.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {icpModal}
      {contactPickerModal}
      {acceleratorPickerModal}
      <EditLeadModal
        visible={Boolean(editingLeadId)}
        lead={editingLead}
        onClose={() => setEditingLeadId(null)}
        onSave={(leadId, patch) => assistant.updateLead(leadId, patch)}
      />
      {attachMenuOpen ? (
        <Pressable
          style={styles.attachDismissLayer}
          onPress={() => setAttachMenuOpen(false)}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.header, styles.headerMinimal, { paddingTop: insets.top + 10, paddingHorizontal: horizontalPadding, backgroundColor: 'transparent', borderBottomColor: 'transparent' }]}
      >
        <TouchableOpacity onPress={handleBackToLanding} style={[styles.iconBtn, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]} activeOpacity={0.76}>
          <ArrowLeft color={appTheme.text} size={21} />
        </TouchableOpacity>
        {/* ICP Discovery pill — web parity: opens the AI context drawer */}
      </View>

      {hasUsefulContext ? (
        <View style={[styles.contextBand, { paddingHorizontal: horizontalPadding, backgroundColor: appTheme.surface, borderBottomColor: appTheme.borderSoft }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.contextScroll, { maxWidth: contentMaxWidth }]}>
            {assistant.lastSearchQuery ? (
              <View style={[styles.contextChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.successSoft }]}>
                <Search color={Theme.colors.success} size={15} />
                <Typography variant="caption" color={appTheme.text} style={styles.contextText} numberOfLines={1}>
                  {assistant.lastModuleUsed ? assistant.lastModuleUsed.replace(/_/g, ' ') : 'Unified search'}
                </Typography>
              </View>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                setActivePanel('chat');
                setShowDiscovery((current) => !current);
              }}
              style={[styles.contextChip, { backgroundColor: appTheme.darkMode ? (showDiscovery ? appTheme.labelBackgroundActive : appTheme.labelBackground) : (showDiscovery ? appTheme.primaryAccent : appTheme.softSurface) }]}
            >
              <Sparkles color={appTheme.darkMode ? appTheme.primaryAccent : showDiscovery ? Theme.colors.surface : appTheme.primaryAccent} size={15} />
              <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : showDiscovery ? Theme.colors.surface : appTheme.text} style={styles.contextText}>
                Discover prospects
              </Typography>
            </TouchableOpacity>
            {hasLeads ? (
              <View style={[styles.contextChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.warningSoft }]}>
                <Zap color={Theme.colors.warning} size={15} />
                <Typography variant="caption" color={appTheme.text} style={styles.contextText}>
                  {assistant.totalResults || assistant.leads.length} leads
                </Typography>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {activePanel === 'chat' && importing && uploadedFileName ? (
        renderImportSearchingPanel()
      ) : activePanel === 'chat' ? (
        <FlatList
          ref={listRef}
          data={assistant.messages}
          extraData={`${checkpointInlineVisible}-${assistant.cpStep}-${assistant.cpAgentDealLoading}`}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingTop: insets.top + 68,
              paddingHorizontal: horizontalPadding,
              paddingBottom: isKeyboardVisible
                ? (shouldShowChatInput ? bottomNavClearance + 120 : 280)
                : shouldShowChatInput
                  ? bottomNavClearance + 132
                  : hasLeads
                    ? Math.max(insets.bottom + 72, 88)
                    : Theme.spacing.xl,
              maxWidth: contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleChatScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              {showDiscovery ? (
                <ProspectDiscoveryPanel onComplete={() => undefined} />
              ) : null}
              {assistant.recentSearches.length ? (
                <View style={styles.recentBlock}>
                  <View style={styles.recentTitle}>
                    <History color={appTheme.muted} size={15} />
                    <Typography variant="caption" color={appTheme.muted} style={styles.contextText}>Recent searches</Typography>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroller}>
                    {assistant.recentSearches.map((item) => (
                      <TouchableOpacity key={item} style={[styles.recentChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.surface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border }]} onPress={() => void assistant.submitMessage(item)}>
                        <Typography variant="caption" color={appTheme.text} numberOfLines={1}>{item}</Typography>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {importing ? (
                <GlassCard style={[styles.thinkingCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                  <Typography variant="caption" color={appTheme.muted}>Reading your file and extracting leads...</Typography>
                </GlassCard>
              ) : null}
              {assistant.isBusy || assistant.isSearching ? (
                <LadThinkingBubble
                  accentColor={appTheme.darkMode ? '#FFFFFF' : '#0B1957'}
                  avatarBackground={appTheme.darkMode ? appTheme.infoSoft : '#E8ECFA'}
                  bubbleBackground={appTheme.surface}
                  bubbleBorder={appTheme.borderSoft}
                  logoColor={appTheme.darkMode ? '#FFFFFF' : '#0B1957'}
                />
              ) : null}

              {assistant.leads.length ? (
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setActivePanel('leads')}
                  style={[styles.resultsToggle, { backgroundColor: appTheme.infoSoft, borderColor: appTheme.borderSoft }]}
                >
                  <UsersRound color={appTheme.primaryAccent} size={14} />
                  <Typography variant="caption" color={appTheme.primaryAccent} style={styles.resultsToggleText}>
                    {assistant.totalResults || assistant.leads.length} leads found — tap to view
                  </Typography>
                </TouchableOpacity>
              ) : null}

              {assistant.outreachJourney.length ? (
                <View style={styles.panel}>
                  <View style={styles.panelHeader}>
                    <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Suggested outreach journey</Typography>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      onPress={openOutreachSetup}
                      style={[styles.createJourneyBtn, { backgroundColor: appTheme.primaryAccent }]}
                      disabled={assistant.outreachWorkflowStage === 'launching'}
                    >
                      {assistant.outreachWorkflowStage === 'launching' ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : (
                        <Typography variant="caption" color={Theme.colors.surface} style={styles.createJourneyText}>
                          Create
                        </Typography>
                      )}
                    </TouchableOpacity>
                  </View>
                  {assistant.outreachJourney.map((step) => (
                    <TouchableOpacity
                      key={step.channel}
                      activeOpacity={0.78}
                      onPress={() => {
                        assistant.startOutreachWorkflow();
                        setActivePanel('flow');
                      }}
                    >
                      <GlassCard style={[styles.journeyCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                        <View style={[styles.journeyIcon, { backgroundColor: getJourneyColor(step.channel, appTheme.darkMode) }]}>
                          {getJourneyIcon(step.channel, Theme.colors.surface)}
                        </View>
                        <View style={styles.journeyCopy}>
                          <Typography variant="bodySmall" color={appTheme.text} style={styles.journeyTitle}>{step.channel}</Typography>
                          <Typography variant="caption" color={appTheme.muted}>{step.action}</Typography>
                        </View>
                        {step.recommended ? (
                          <View style={[styles.recommendedPill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.infoSoft, borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
                            <Typography variant="overline" color={appTheme.primaryAccent} style={styles.recommendedText}>Recommended</Typography>
                          </View>
                        ) : null}
                      </GlassCard>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {assistant.error ? (
                <Typography variant="caption" color={Theme.colors.warning} style={styles.errorText}>{assistant.error}</Typography>
              ) : null}
              {renderResultActions()}
            </View>
          }
        />
      ) : activePanel === 'leads' ? renderLeadsPanel() : renderFlowPanel()}

      {shouldShowChatInput ? (
        <View
          style={[
            styles.inputArea,
            attachMenuOpen && styles.attachMenuHost,
            {
              paddingHorizontal: chatInputSidePadding,
              bottom: bottomNavClearance,
              backgroundColor: 'transparent',
              borderTopColor: 'transparent',
            },
          ]}
        >
          {attachMenuOpen && renderAttachMenu()}
          <GlassCard style={[styles.inputCard, { maxWidth: contentMaxWidth, backgroundColor: appTheme.surface, borderColor: '#2563FF' }]}>
            <TextInput
              style={[styles.input, WEB_INPUT_RESET, { color: appTheme.text }]}
              placeholder="Ask Mr LAD..."
              placeholderTextColor={appTheme.disabled}
              value={assistant.input}
              onChangeText={assistant.setInput}
              multiline
              editable={!assistant.isBusy && !assistant.isSearching && !importing}
              onFocus={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
              onSubmitEditing={() => {
                if (Platform.OS !== 'web') void assistant.submitMessage();
              }}
            />
            <View style={styles.chatInputFooter}>
              <View style={styles.chatInputFooterCluster}>
                <TouchableOpacity
                  style={[styles.attachBtn, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}
                  onPress={() => setAttachMenuOpen(!attachMenuOpen)}
                >
                  <Plus color={appTheme.muted} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={openAcceleratorPicker}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  style={[
                    styles.acceleratorMini,
                    isNarrowPhone && styles.acceleratorMiniNarrow,
                    { backgroundColor: appTheme.softSurface, borderColor: appTheme.border },
                  ]}
                >
                  <Briefcase color={appTheme.primaryAccent} size={13} />
                  <Typography variant="caption" color={appTheme.text} style={styles.acceleratorMiniText} numberOfLines={1}>
                    Accelerators
                  </Typography>
                  <ChevronDown color={appTheme.muted} size={12} />
                </TouchableOpacity>
              </View>
              <View style={styles.chatInputFooterCluster}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={assistant.toggleSalesNav}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={assistant.useSalesNav ? 'Premium Search on' : 'Premium Search off'}
                  style={[
                    styles.premiumMini,
                    {
                      backgroundColor: assistant.useSalesNav ? '#0A66C2' : appTheme.softSurface,
                      borderColor: assistant.useSalesNav ? '#0A66C2' : appTheme.border,
                    },
                  ]}
                >
                  <Star color={assistant.useSalesNav ? '#FFFFFF' : appTheme.primaryAccent} size={16} />
                </TouchableOpacity>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  onHoverIn={() => setHoveredSend('chat')}
                  onHoverOut={() => setHoveredSend(null)}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    {
                      backgroundColor: canSendChat
                        ? hoveredSend === 'chat'
                          ? appTheme.darkMode ? '#1D5CC2' : '#1D66D6'
                          : appTheme.darkMode ? '#1647A5' : appTheme.primaryAccent
                        : appTheme.darkMode ? '#13285C' : '#E7ECF5',
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                  disabled={!canSendChat}
                  onPressIn={() => { if (attachMenuOpen) setAttachMenuOpen(false); }}
                  onPress={() => void assistant.submitMessage()}
                >
                  <Send color={canSendChat ? '#FFFFFF' : appTheme.darkMode ? '#7890BE' : appTheme.muted} size={19} />
                </Pressable>
              </View>
            </View>
            <Typography variant="caption" color={appTheme.disabled} style={styles.inputUsageText}>
              0 messages used
            </Typography>
          </GlassCard>
        </View>
      ) : null}
      {renderMobilePanelNav()}
    </KeyboardAvoidingView>
  );
}

function discoveryError(message: string) {
  if (message === 'no_active_icp') {
    return 'No active ICP found. Define your Ideal Customer Profile first.';
  }
  if (message.toLowerCase().includes('tenant')) {
    return 'Session tenant could not be resolved. Sign in again or check tenant settings.';
  }
  return message;
}

function ProspectDiscoveryPanel({ onComplete }: { onComplete?: (result: SearchRunResult) => void }) {
  const appTheme = useAppTheme();
  const [maxResults, setMaxResults] = useState(25);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SearchRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const next = await runProspectSearch({ maxResults, triggeredBy: 'manual' });
      setResult(next);
      onComplete?.(next);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setRunning(false);
    }
  };

  const count = result ? result.count ?? result.candidates?.length ?? 0 : 0;
  const searchId = result ? result.searchId ?? result.search_id ?? '' : '';
  const totalCost = result ? Number(result.totalCostUsd ?? result.total_cost_usd ?? 0) : 0;
  const backendResults = result ? result.backendResults ?? result.backend_results ?? {} : {};

  return (
    <GlassCard style={[styles.discoveryPanel, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
      <View style={styles.discoveryHeader}>
        <View style={styles.discoveryTitleCopy}>
          <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Discover new prospects</Typography>
          <Typography variant="caption" color={appTheme.muted}>
            Runs the active ICP search and adds matching prospects to CRM.
          </Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={running}
          onPress={runSearch}
          style={[styles.discoveryRunButton, { backgroundColor: appTheme.primaryAccent }, running && styles.disabled]}
        >
          {running ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : null}
          <Typography variant="caption" color={Theme.colors.surface} style={styles.loadMoreText}>
            {running ? 'Running' : 'Run search'}
          </Typography>
        </TouchableOpacity>
      </View>

      <View style={[styles.discoveryOptions, { borderTopColor: appTheme.borderSoft }]}>
        <Typography variant="caption" color={appTheme.muted} style={styles.discoveryOptionLabel}>Max results</Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryOptionScroll}>
          {MAX_RESULTS_OPTIONS.map((option) => {
            const active = option === maxResults;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.78}
                disabled={running}
                onPress={() => setMaxResults(option)}
                style={[
                  styles.discoveryOption,
                  {
                    backgroundColor: active ? appTheme.primaryAccent : appTheme.softSurface,
                    borderColor: active ? appTheme.primaryAccent : appTheme.border,
                  },
                ]}
              >
                <Typography variant="caption" color={active ? Theme.colors.surface : appTheme.text} style={styles.optionText}>
                  {option}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {running ? (
        <View style={[styles.discoveryStrip, { backgroundColor: appTheme.infoSoft, borderTopColor: appTheme.borderSoft }]}>
          <Typography variant="caption" color={appTheme.primaryAccent}>Calling Apollo + Sales Navigator. Typically 3-8s.</Typography>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.discoveryStrip, { backgroundColor: '#FFF7ED', borderTopColor: '#FDBA74' }]}>
          <Typography variant="caption" color="#C2410C">Search failed: {discoveryError(error)}</Typography>
        </View>
      ) : null}

      {result && !running && !error ? (
        <View style={[styles.discoveryResult, { borderTopColor: appTheme.borderSoft }]}>
          {result.error === 'no_active_icp' ? (
            <Typography variant="caption" color="#C2410C">Search failed: {discoveryError('no_active_icp')}</Typography>
          ) : (
            <>
              <Typography variant="caption" color={appTheme.text} style={styles.discoveryResultText}>
                {count} candidate{count === 1 ? '' : 's'} discovered
                {searchId ? ` - search ${searchId.slice(0, 8)}` : ''}
                {` - cost $${totalCost.toFixed(2)}`}
              </Typography>
              {Object.entries(backendResults).length ? (
                <View style={styles.discoveryBackendRow}>
                  {Object.entries(backendResults).map(([name, rollup]) => (
                    <DiscoveryBackendChip key={name} name={name} rollup={rollup} />
                  ))}
                </View>
              ) : null}
              {count > 0 ? (
                <Typography variant="caption" color={appTheme.muted}>
                  New prospects will appear in CRM after the discovery run completes.
                </Typography>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </GlassCard>
  );
}

function DiscoveryBackendChip({ name, rollup }: { name: string; rollup: SearchBackendRollup }) {
  const appTheme = useAppTheme();
  const label = name.replace(/_/g, ' ');
  const text = rollup.skipped
    ? `${label}: skipped${rollup.reason ? ` - ${rollup.reason}` : ''}`
    : rollup.error
      ? `${label}: error - ${String(rollup.error).slice(0, 32)}`
      : `${label}: ${rollup.candidates ?? 0}${rollup.total_matches != null ? ` / ${rollup.total_matches}` : ''}`;
  return (
    <View style={[styles.discoveryBackendChip, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border }]}>
      <Typography variant="caption" color={rollup.error ? appTheme.darkMode ? '#FB8DA1' : '#C2410C' : appTheme.text} style={styles.discoveryBackendText}>
        {text}
      </Typography>
    </View>
  );
}

const getJourneyColor = (channel: string, darkMode: boolean) => {
  const normalized = channel.toLowerCase();
  if (normalized.includes('whatsapp')) return '#25D366';
  if (normalized.includes('email')) return darkMode ? '#818CF8' : '#0B1957';
  if (normalized.includes('voice')) return '#F97316';
  return '#0A66C2';
};

const getJourneyIcon = (channel: string, color: string) => {
  const normalized = channel.toLowerCase();
  if (normalized.includes('whatsapp')) return <MessageSquare color={color} size={18} />;
  if (normalized.includes('email')) return <Mail color={color} size={18} />;
  if (normalized.includes('voice')) return <Phone color={color} size={18} />;
  return <UsersRound color={color} size={18} />;
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  attachDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  attachMenuHost: {
    zIndex: 40,
    elevation: 40,
  },

  // ── Landing ────────────────────────────────────────────────────────────────
  landingContent: {
    flexGrow: 1,
    alignItems: 'center',
    position: 'relative',
  },
  landingTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  landingBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  landingMagicBtn: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.large,
  },
  profileDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  landingHero: {
    alignItems: 'center',
    marginTop: 50,
  },
  landingLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  landingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: Theme.spacing.sm,
  },
  landingTitle: {
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0,
    flexShrink: 1,
  },
  landingSparkleGhost: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingInputOuter: {
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 24,
    paddingBottom: 60,
    marginTop: 34,
    minHeight: 112,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  landingInput: {
    minHeight: 46,
    maxHeight: 96,
    fontSize: 19,
    lineHeight: 27,
    textAlign: 'center',
    textAlignVertical: 'top',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 0,
    fontWeight: '500',
  },
  landingInputFooter: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  landingFooterCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  landingCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingAcceleratorChip: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    width: 142,
    maxWidth: 142,
  },
  landingAcceleratorText: {
    fontWeight: '800',
    flexShrink: 1,
  },
  landingPremiumChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingPremiumText: {
    fontWeight: '800',
  },
  landingSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Theme.spacing.sm,
    marginTop: 20,
  },
  landingSuggestionChip: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  landingSuggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingSuggestionText: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 17,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerMinimal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    borderBottomWidth: 0,
    minHeight: 0,
    paddingBottom: 0,
    justifyContent: 'flex-start',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  icpPill: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icpPillDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },

  // ── Context band ───────────────────────────────────────────────────────────
  contextBand: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  contextScroll: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    width: '100%',
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  contextText: {
    fontWeight: '700',
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  messagesContent: {
    paddingTop: Theme.spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Theme.spacing.md,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  roleMessageRow: {
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  botDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  roleAssistantSpacer: {
    width: 32,
    height: 32,
    marginTop: 2,
  },
  roleAssistantSpacerNarrow: {
    width: 0,
    height: 0,
    marginTop: 0,
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  acceleratorBubble: {
    flex: 1,
    minWidth: 0,
    maxWidth: 560,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 20,
    overflow: 'visible',
  },
  acceleratorBubbleNarrow: {
    maxWidth: '100%',
  },
  roleUserBubble: {
    maxWidth: '76%',
    minWidth: 218,
    minHeight: 48,
    borderRadius: 20,
    borderBottomRightRadius: 5,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    flexShrink: 1,
    ...Theme.shadows.medium,
  },
  roleMessageText: {
    fontWeight: '600',
    lineHeight: 21,
  },
  uploadMessageBubble: {
    maxWidth: 288,
    minHeight: 46,
    borderRadius: 7,
    justifyContent: 'center',
    ...Theme.shadows.medium,
  },
  uploadMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  uploadMessageText: {
    flex: 1,
    fontWeight: '800',
  },
  uploadMessageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  roleMessageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  messageText: {
    lineHeight: 20,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionText: {
    fontWeight: '600',
  },
  inlineLeads: {
    marginTop: 10,
    gap: 8,
  },
  leadsFoundChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leadsFoundChipText: {
    fontWeight: '700',
  },
  roleAssistantLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginLeft: 2,
  },
  roleAssistantLabelText: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  roleAssistantDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  recentBlock: {
    marginBottom: Theme.spacing.sm,
    gap: 6,
  },
  recentTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentScroller: {
    flexDirection: 'row',
    gap: 8,
  },
  recentChip: {
    maxWidth: 240,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  footer: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    paddingBottom: 0,
  },
  thinkingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  resultsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  resultsToggleText: {
    fontWeight: '700',
  },
  errorText: {
    marginTop: 2,
  },

  // ── Panels shared ──────────────────────────────────────────────────────────
  panelPage: {
    flex: 1,
  },
  panelPageContent: {
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  flowPage: {
    flex: 1,
    gap: 12,
  },
  flowTitleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowTitle: {
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  flowCanvas: {
    flex: 1,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  countBadge: {
    minWidth: 34,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontWeight: '800',
  },
  compactLoadBtn: {
    minWidth: 74,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontWeight: '700',
  },
  panel: {
    gap: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    fontWeight: '800',
  },
  createJourneyBtn: {
    minWidth: 66,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createJourneyText: {
    fontWeight: '700',
  },
  journeyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Theme.spacing.sm,
  },
  journeyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyCopy: {
    flex: 1,
    minWidth: 0,
  },
  journeyTitle: {
    fontWeight: '700',
  },
  recommendedPill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedText: {
    fontWeight: '800',
    fontSize: 8,
    letterSpacing: 0,
  },

  // ── Leads panel ────────────────────────────────────────────────────────────
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionText: {
    fontWeight: '700',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 6,
  },
  selectionBtn: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  selectionBtnText: {
    fontWeight: '700',
  },
  leadCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Theme.spacing.md,
    gap: 8,
  },
  leadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '800',
  },
  avatarQuestionMark: {
    fontSize: 16,
  },
  importedAvatarWrap: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedinLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  leadContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  leadContactText: {
    flexShrink: 1,
  },
  linkedinLinkText: {
    fontWeight: '600',
  },
  researchSummaryBox: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  researchSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  researchSummaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  researchSummaryTitle: {
    letterSpacing: 1.4,
    fontSize: 10,
  },
  researchSummaryBody: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  researchSummaryText: {
    lineHeight: 18,
  },
  leadRowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  leadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  leadName: {
    fontWeight: '700',
    flexShrink: 1,
  },
  verified: {
    fontWeight: '800',
  },
  scorePill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: {
    fontWeight: '800',
  },
  leadMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 3,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reasoning: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  leadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 5,
  },
  smallAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionText: {
    fontWeight: '700',
  },
  leadContact: {
    maxWidth: 200,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  feedbackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 11,
    marginTop: 4,
    ...Theme.shadows.small,
  },
  importSearchingContent: {
    flexGrow: 1,
    paddingTop: Theme.spacing.xl,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: Theme.spacing.xl,
  },
  uploadedPill: {
    flex: 1,
    maxWidth: 288,
    minHeight: 46,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0B1957',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Theme.shadows.medium,
  },
  uploadedText: {
    flex: 1,
    fontWeight: '800',
  },
  uploadedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#172560',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedAvatarText: {
    fontWeight: '900',
  },
  importActionBlock: {
    gap: 10,
  },
  importActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  importActionTitle: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  importActionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  importSearchingText: {
    fontStyle: 'italic',
    fontWeight: '700',
  },
  importSearchingDetail: {
    lineHeight: 20,
    maxWidth: 340,
  },

  // ── Flow panel ─────────────────────────────────────────────────────────────
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  channelChipText: {
    fontWeight: '700',
  },
  launchStatusCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Theme.spacing.md,
  },
  launchStatusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  launchStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchStatusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  launchStatusTitle: {
    fontWeight: '800',
  },
  launchStatusText: {
    lineHeight: 17,
  },
  resultActionsWrap: {
    gap: 10,
  },
  agentDealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  agentDealText: {
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  resultActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: Theme.spacing.md,
    marginTop: 4,
  },
  refineBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refineText: {
    fontWeight: '700',
  },
  journeyBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  journeyText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  inlineCheckpointHost: {
    borderTopWidth: 1,
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.xs,
  },
  disabled: {
    opacity: 0.55,
  },

  // ── Input area ─────────────────────────────────────────────────────────────
  inputArea: {
    borderTopWidth: 0,
    paddingTop: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'visible',
    zIndex: 20,
  },
  inputCard: {
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: 24,
    minHeight: 108,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 12,
    shadowColor: '#0B1957',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 4,
  },
  chatInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  chatInputFooterCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceleratorMini: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    flexShrink: 1,
  },
  acceleratorMiniNarrow: {
    paddingHorizontal: 7,
    gap: 4,
  },
  acceleratorMiniText: {
    fontWeight: '800',
    flexShrink: 1,
  },
  input: {
    width: '100%',
    minHeight: 38,
    maxHeight: 118,
    fontSize: 15,
    lineHeight: 20,
    paddingTop: Platform.OS === 'ios' ? 9 : 7,
    paddingBottom: 7,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
  },
  premiumMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputUsageText: {
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0,
  },
  attachmentMenu: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    gap: 4,
    width: 272,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    ...Theme.shadows.medium,
    zIndex: 50,
    elevation: 50,
  },
  attachmentMenuInline: {
    position: 'absolute',
    left: 14,
    bottom: 58,
    width: 260,
    maxWidth: '92%',
    borderWidth: 1,
    borderRadius: 16,
    padding: Theme.spacing.sm,
    gap: 4,
    zIndex: 30,
    ...Theme.shadows.medium,
    elevation: 30,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  attachmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCopy: {
    flex: 1,
    minWidth: 0,
  },
  attachmentTitle: {
    fontWeight: '800',
  },
  attachmentDivider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 10,
  },

  // ── Bottom panel nav ───────────────────────────────────────────────────────
  acceleratorSheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Theme.shadows.large,
  },
  acceleratorHeader: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  acceleratorList: {
    flexGrow: 0,
  },
  acceleratorListContent: {
    padding: 12,
    paddingBottom: 18,
    gap: 12,
  },
  acceleratorSection: {
    gap: 8,
  },
  acceleratorSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  acceleratorSectionTitle: {
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  acceleratorSectionLine: {
    flex: 1,
    height: 1,
  },
  acceleratorCard: {
    minHeight: 106,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  acceleratorCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceleratorCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  acceleratorCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  acceleratorCardTitle: {
    flex: 1,
    fontWeight: '900',
    lineHeight: 18,
  },
  acceleratorBadge: {
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  acceleratorBadgeText: {
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0,
  },
  acceleratorCardTagline: {
    lineHeight: 16,
  },
  acceleratorMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 1,
  },
  acceleratorMetaPill: {
    minHeight: 23,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceleratorMetaText: {
    fontWeight: '800',
    fontSize: 8,
    letterSpacing: 0,
  },
  contactPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  contactPickerSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: 620,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...Theme.shadows.large,
  },
  contactPickerSourceSheet: {
    maxHeight: 420,
  },
  contactPickerContactsSheet: {
    height: '82%',
    maxHeight: 680,
  },
  contactPickerHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  contactPickerHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactPickerBack: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPickerIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPickerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  contactPickerTitle: {
    fontWeight: '700',
  },
  contactPickerSubtitle: {
    lineHeight: 16,
  },
  contactPickerClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPickerBody: {
    flex: 1,
  },
  contactSourceList: {
    maxHeight: 360,
  },
  contactSourceRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  contactSourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  contactSourceLabel: {
    flex: 1,
    fontWeight: '600',
  },
  contactSearchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contactSearchBox: {
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  contactSearchInput: {
    flex: 1,
    minHeight: 34,
    fontSize: 13,
    paddingVertical: 0,
  },
  contactSelectAllRow: {
    minHeight: 38,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactSelectAllText: {
    fontWeight: '600',
  },
  contactList: {
    flex: 1,
  },
  contactRow: {
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  contactCheckbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCheckboxDash: {
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  contactAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contactAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  contactAvatarText: {
    fontWeight: '800',
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontWeight: '700',
  },
  contactEmptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Theme.spacing.xl,
  },
  contactEmptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  contactEmptyCopy: {
    textAlign: 'center',
  },
  contactLoadMoreBtn: {
    marginHorizontal: 20,
    marginVertical: 12,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  contactLoadMoreText: {
    fontWeight: '700',
  },
  contactPickerFooter: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  contactPickerFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactFooterBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactFooterText: {
    fontWeight: '700',
  },
  contactFooterPrimary: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactFooterPrimaryText: {
    fontWeight: '800',
  },
  bottomPanelNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 60,
  },
  bottomPanelNav: {
    height: 64,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  panelNavItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  panelNavIconHalo: {
    width: 46,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelNavIconHaloActive: {
    shadowColor: '#2976F4',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  panelNavLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
  },
  panelNavLabelActive: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0,
  },

  // ── Discovery panel (active ICP run) ───────────────────────────────────────
  discoveryPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 0,
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
  },
  discoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Theme.spacing.md,
  },
  discoveryTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  discoveryRunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 17,
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
  },
  discoveryOptions: {
    borderTopWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    gap: 7,
  },
  discoveryOptionLabel: {
    fontWeight: '700',
  },
  discoveryOptionScroll: {
    flexDirection: 'row',
    gap: 7,
  },
  discoveryOption: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  discoveryStrip: {
    borderTopWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 9,
  },
  discoveryResult: {
    borderTopWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    gap: 7,
  },
  discoveryResultText: {
    fontWeight: '700',
  },
  discoveryBackendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  discoveryBackendChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discoveryBackendText: {
    textTransform: 'capitalize',
  },
});
