import {
  API_URL,
  RESOLVED_API_URL,
  apiGet,
  apiPatch,
  apiPost,
  buildApiUrl,
  expireAuthSession,
  getAuthToken,
  safeStorage,
  WEB_API_URL,
} from '@/src/api';
import { Platform } from 'react-native';
import { getSocket, SOCKET_URL } from '@/src/services/socketService';
import {
  ApiConversation,
  ApiMessage,
  AssignHandlerParams,
  ChatChannel,
  ChatConversation,
  ChatMessage,
  ConversationActivityPayload,
  ConversationDetail,
  ConversationPageParams,
  CurrentUser,
  MessagePageParams,
  MessageStatus,
  NotificationPayload,
  SendChannelMessageParams,
  SendMessageParams,
  SocketStatus,
} from '@/src/types/chat';

export type {
  ApiConversation,
  ApiMessage,
  AssignHandlerParams,
  Attachment,
  Channel,
  ChatChannel,
  ChatConversation,
  ChatMessage,
  Contact,
  Conversation,
  ConversationActivityPayload,
  ConversationDetail,
  ConversationPageParams,
  ConversationStatus,
  CurrentUser,
  Message,
  MessagePageParams,
  MessageStatus,
  NotificationPayload,
  SendChannelMessageParams,
  SendMessageParams,
  SocketStatus,
} from '@/src/types/chat';

export type RawRecord = Record<string, any>;
export type ConversationListener = (data: ApiConversation) => void;
export type MessageListener = (message: ApiMessage) => void;

export type ConversationNote = {
  id: string;
  content: string;
  displayContent: string;
  authorName?: string;
  createdAt?: string;
  updatedAt?: string;
  isInternal?: boolean;
  raw?: RawRecord;
};

export type BroadcastGroup = {
  id: string;
  name: string;
  memberCount: number;
  avatar?: string;
  color?: string;
  description?: string | null;
  waBackendChannel?: 'waba' | 'personal';
  /** Saved broadcast set (metadata.is_broadcast_list) — groups-of-groups, shown as "N groups" */
  isBroadcastList?: boolean;
  /** Number of member chat groups in a saved broadcast set (metadata.member_group_ids) */
  memberGroupCount?: number;
};

export type BroadcastGroupMember = {
  id: string;
  name?: string | null;
  phone?: string | null;
};

export type BroadcastTemplateSendPayload = {
  templateId?: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
  nameFormat?: 'first' | 'full';
  headerParamCount?: number;
  headerType?: string;
  headerUrl?: string;
  body?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
};

export type StarredMessageRecord = {
  id: string;
  conversationId: string;
  content: string;
  senderName?: string;
  conversationName?: string;
  createdAt?: string;
};

export type WhatsAppLabel = {
  id: string;
  name: string;
  color?: string;
};

export type ConversationTeamMember = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
  workload?: number;
  isOnline?: boolean;
};

export type ConversationAssignmentRecord = {
  id: string;
  assignedToUserId?: string | null;
  assignedByUserId?: string | null;
  assignedAt: string;
  raw?: RawRecord;
};

export type ConversationAssignmentHistory = {
  current: ConversationAssignmentRecord | null;
  history: ConversationAssignmentRecord[];
};

export type MindBodyPaymentOption = {
  id: string;
  name: string;
  price?: string | null;
  description?: string | null;
};

export type MindBodyPaymentLink = {
  portalUrl: string;
  options: MindBodyPaymentOption[];
};

export type MindBodyPaymentVerification = {
  paid: boolean;
  purchases: unknown[];
  services: unknown[];
};

const leadSourceMessagesByConversation = new Map<string, ChatMessage[]>();
// Groups live on a per-channel service (waba → BNI, personal → WAPA); remember
// where each group came from so update/delete/send hit the right backend.
const broadcastGroupChannelById = new Map<string, 'waba' | 'personal'>();
const bniMessagesByConversation = new Map<string, ChatMessage[]>();
const bniConversationIds = new Set<string>();
const bniChannelByConversation = new Map<string, WhatsAppBackendChannel>();
const linkedinConversationIds = new Set<string>();
const emailConversationIds = new Set<string>();
const instagramConversationIds = new Set<string>();
const emailContactIdsByConversation = new Map<string, string>();
const emailProvidersByConversation = new Map<string, string>();
type WhatsAppBackendChannel = 'waba' | 'personal';
type ConversationRouteChannel = WhatsAppBackendChannel | 'linkedin';

const isRecord = (value: unknown): value is RawRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const trimUrl = (value: string) => value.replace(/\/+$/, '');
const BNI_SERVICE_URL =
  process.env.EXPO_PUBLIC_BNI_SERVICE_URL ||
  process.env.EXPO_PUBLIC_WHATSAPP_API_URL ||
  process.env.NEXT_PUBLIC_BNI_SERVICE_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_API_URL ||
  'https://bni-conversation-service-160078175457.us-central1.run.app';
const getWhatsAppBackendChannel = async () => {
  const storedChannel = await safeStorage.getItem('whatsappChannel');
  const configuredChannel = process.env.EXPO_PUBLIC_WHATSAPP_CHANNEL || process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL;
  const channel = storedChannel || configuredChannel || 'personal';

  return channel === 'waba' ? 'waba' : 'personal';
};
const getWhatsAppBackendChannels = async (): Promise<WhatsAppBackendChannel[]> => {
  const preferred = await getWhatsAppBackendChannel();
  return preferred === 'waba' ? ['waba', 'personal'] : ['personal', 'waba'];
};
const canUseDirectBackendFallback = () => Platform.OS !== 'web' && trimUrl(API_URL) !== trimUrl(RESOLVED_API_URL);

const WAPA_SERVICE_URL = (process.env.EXPO_PUBLIC_WAPA_SERVICE_URL || 'https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app').replace(/\/+$/, '');
// LAD-Instagram-Comms (FastAPI) — mirrors lad-frontend-2's instagram-conversations proxy
const INSTAGRAM_SERVICE_URL = (
  process.env.EXPO_PUBLIC_INSTAGRAM_API_URL ||
  process.env.NEXT_PUBLIC_INSTAGRAM_API_URL ||
  'https://lad-instagram-comms-develop-asia-160078175457.asia-south1.run.app'
).replace(/\/+$/, '');
// BNI service serves WABA media at /api/conversations/media/{id} (path differs from WAPA endpoint)
// Mirrors auth-proxy.js smart media routing: pwa_ → WAPA, everything else → BNI with rewritten path
const buildMediaFetchUrl = (mediaId: string) => {
  if (Platform.OS !== 'web') {
    if (mediaId.startsWith('pwa_')) {
      return `${WAPA_SERVICE_URL}/api/whatsapp-conversations/conversations/media/${mediaId}`;
    }
    // WABA: BNI service with rewritten path
    return `${BNI_SERVICE_URL.replace(/\/+$/, '')}/api/conversations/media/${mediaId}`;
  }
  return buildApiUrl(`/api/whatsapp-conversations/conversations/media/${mediaId}`, RESOLVED_API_URL);
};

const buildDirectApiUrl = (path: string, options?: { params?: Record<string, unknown> }) => {
  const url = new URL(buildApiUrl(path, API_URL));

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};

const directBackendRequest = async (
  method: string,
  path: string,
  body?: unknown,
  options?: { params?: Record<string, unknown>; headers?: Record<string, string> },
) => {
  const token = await getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options?.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildDirectApiUrl(path, options), {
    method,
    headers,
    credentials: 'include',
    body: body ? (isFormData ? body as BodyInit : JSON.stringify(body)) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await expireAuthSession();
    }

    const message =
      isRecord(payload) && (payload.message || payload.error)
        ? String(payload.message || payload.error)
        : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
};

const decodeBase64Url = (value: string) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoder = (globalThis as typeof globalThis & { atob?: (input: string) => string }).atob;

    if (!decoder) {
      return null;
    }

    return decodeURIComponent(
      decoder(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return null;
  }
};

const getTenantIdFromToken = (token: string | null) => {
  if (!token) {
    return null;
  }

  const payload = token.split('.')[1];
  const decoded = payload ? decodeBase64Url(payload) : null;

  if (!decoded) {
    return null;
  }

  try {
    const record = JSON.parse(decoded) as RawRecord;
    return String(record.tenantId ?? record.tenant_id ?? record.organizationId ?? record.orgId ?? '') || null;
  } catch {
    return null;
  }
};

const getTenantIdFromRecord = (record: RawRecord) => {
  const tenantId =
    record.activeTenantId ??
    record.active_tenant_id ??
    record.tenantId ??
    record.tenant_id ??
    record.organizationId ??
    record.organization_id ??
    record.orgId;

  return tenantId ? String(tenantId) : null;
};

const getTenantIdFromPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    return null;
  }

  const queue: RawRecord[] = [payload];
  const seen = new WeakSet<object>();

  for (let index = 0; index < queue.length && index < 20; index += 1) {
    const record = queue[index];
    if (seen.has(record)) {
      continue;
    }

    seen.add(record);

    const tenantId = getTenantIdFromRecord(record);
    if (tenantId) {
      return tenantId;
    }

    for (const key of ['user', 'profile', 'account', 'data', 'tenant']) {
      const nested = record[key];
      if (isRecord(nested) && !seen.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return null;
};

const getEffectiveTenantId = async (token: string | null) => {
  const selectedTenantId = await safeStorage.getItem('selectedTenantId');
  if (selectedTenantId && selectedTenantId !== 'default') {
    return selectedTenantId;
  }

  for (const key of ['user', 'userData']) {
    const rawUser = await safeStorage.getItem(key);
    if (!rawUser) {
      continue;
    }

    try {
      const user = JSON.parse(rawUser) as RawRecord;
      const tenantId = getTenantIdFromRecord(user);
      if (tenantId) {
        return tenantId;
      }
    } catch {
      // Ignore malformed cached profile data.
    }
  }

  const tokenTenantId = getTenantIdFromToken(token);
  if (tokenTenantId) {
    return tokenTenantId;
  }

  try {
    const response = await apiGet('/api/auth/me');
    return getTenantIdFromPayload(response.data);
  } catch {
    return null;
  }
};

const buildExternalUrl = (baseUrl: string, path: string, options?: { params?: Record<string, unknown> }) => {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, trimUrl(baseUrl));

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};

const getBniWebProxyPath = (path: string) => {
  if (path.startsWith('/api/')) {
    return path;
  }

  return `/api${path.startsWith('/') ? path : `/${path}`}`;
};

const bniRequest = async (
  method: string,
  path: string,
  body?: unknown,
  options?: { params?: Record<string, unknown>; backendChannel?: WhatsAppBackendChannel | 'linkedin' },
) => {
  const token = await getAuthToken();
  const tenantId = await getEffectiveTenantId(token);
  const backendChannel = options?.backendChannel ?? await getWhatsAppBackendChannel();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-WhatsApp-Channel': backendChannel,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const requestUrl =
    Platform.OS === 'web' && WEB_API_URL
      ? buildExternalUrl(WEB_API_URL, getBniWebProxyPath(path), { params: { ...options?.params, channel: backendChannel } })
      : backendChannel === 'waba'
        ? buildExternalUrl(BNI_SERVICE_URL, path, options)
        : backendChannel === 'linkedin'
          ? buildExternalUrl(API_URL, `/api/linkedin-conversations${path.replace(/^\/api/, '')}`, options)
          // Personal WhatsApp lives on the WAPA service post-Phase 5 (mirrors
          // lad-frontend-2's python-proxy channel routing) — not the main backend.
          : buildExternalUrl(WAPA_SERVICE_URL, `/api/whatsapp-conversations${path.replace(/^\/api/, '')}`, options);

  const response = await fetch(requestUrl, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await expireAuthSession();
    }

    const message =
      isRecord(payload) && (payload.message || payload.error || payload.detail)
        ? String(payload.message || payload.error || payload.detail)
        : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  if (isRecord(payload) && payload.success === false && (payload.error || payload.message || payload.detail)) {
    throw new Error(String(payload.error || payload.message || payload.detail));
  }

  return payload;
};

// Email contacts/messages live on the WABA (BNI) service under /api/email/*
// (mirrors lad-frontend-2's email-conversations proxy). On web the auth-proxy
// rewrites /api/email-conversations/* → BNI /api/email/*; on native we call
// the BNI service directly with the same auth + tenant headers.
const emailCommsRequest = async (
  method: string,
  path: string,
  body?: unknown,
  options?: { params?: Record<string, unknown> },
) => {
  if (Platform.OS === 'web') {
    const webPath = `/api/email-conversations${path}`;
    const response = method === 'GET'
      ? await apiGet(webPath, options)
      : await apiPost(webPath, body, options);
    return response.data;
  }

  const token = await getAuthToken();
  const tenantId = await getEffectiveTenantId(token);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const response = await fetch(buildExternalUrl(BNI_SERVICE_URL, `/api/email${path}`, options), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await expireAuthSession();
    }

    const message =
      isRecord(payload) && (payload.message || payload.error || payload.detail)
        ? String(payload.message || payload.error || payload.detail)
        : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
};

// Instagram conversations live on the standalone LAD-Instagram-Comms service
// (mirrors lad-frontend-2's instagram-conversations catch-all proxy). On web the
// auth-proxy rewrites /api/instagram-conversations/* → Instagram service /api/*;
// on native we call the service directly.
const instagramRequest = async (
  method: string,
  path: string,
  body?: unknown,
  options?: { params?: Record<string, unknown> },
) => {
  if (Platform.OS === 'web') {
    const webPath = `/api/instagram-conversations${path}`;
    const response = method === 'GET'
      ? await apiGet(webPath, options)
      : await apiPost(webPath, body, options);
    return response.data;
  }

  const token = await getAuthToken();
  const tenantId = await getEffectiveTenantId(token);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const response = await fetch(buildExternalUrl(INSTAGRAM_SERVICE_URL, `/api${path}`, options), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await expireAuthSession();
    }

    const message =
      isRecord(payload) && (payload.message || payload.error || payload.detail)
        ? String(payload.message || payload.error || payload.detail)
        : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
};

const uniqueConversationsById = (items: ChatConversation[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
};

const getWithDirectFallback = async (
  path: string,
  options?: { params?: Record<string, unknown> },
  shouldFallback?: (payload: unknown) => boolean,
) => {
  let payload: unknown;
  let requestError: unknown;

  try {
    const response = await apiGet(path, options);
    payload = response.data;

    if (!shouldFallback?.(payload)) {
      return payload;
    }
  } catch (error) {
    requestError = error;
  }

  if (canUseDirectBackendFallback()) {
    try {
      return await directBackendRequest('GET', path, undefined, options);
    } catch (directError) {
      if (requestError) {
        throw requestError;
      }

      throw directError;
    }
  }

  if (requestError) {
    throw requestError;
  }

  return payload;
};

const asDateString = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return new Date().toISOString();
};

const getId = (item: RawRecord) =>
  String(item.id ?? item._id ?? item.conversationId ?? item.conversation_id ?? item.threadId ?? item.thread_id ?? '');

const getDisplayName = (item: RawRecord, lead: RawRecord) => {
  const firstName = lead.firstName ?? lead.first_name;
  const lastName = lead.lastName ?? lead.last_name;
  const combinedName = [firstName, lastName].filter(Boolean).join(' ');
  const directName =
    item.name ??
    item.title ??
    item.contactName ??
    item.contact_name ??
    item.leadName ??
    item.lead_name ??
    item.customerName ??
    item.customer_name ??
    lead.name ??
    lead.fullName ??
    lead.full_name ??
    combinedName;

  return directName || lead.email || lead.phone || 'Unknown lead';
};

const getLeadDisplayName = (lead: RawRecord) => {
  const firstName = lead.firstName ?? lead.first_name;
  const lastName = lead.lastName ?? lead.last_name;
  const combinedName = [firstName, lastName].filter(Boolean).join(' ');

  return (
    lead.name ??
    lead.contact_name ??
    lead.contactName ??
    lead.fullName ??
    lead.full_name ??
    (combinedName ||
    lead.email ||
    lead.phone ||
    lead.company_name ||
    lead.company ||
    'Unknown lead')
  );
};

export const normalizeChannel = (value?: unknown): ChatChannel => {
  if (
    value === 'whatsapp' ||
    value === 'linkedin' ||
    value === 'instagram' ||
    value === 'gmail' ||
    value === 'email' ||
    value === 'web'
  ) {
    return value;
  }

  return 'unknown';
};

export const normalizeStatus = (value?: unknown): MessageStatus => {
  if (value === true) {
    return 'read';
  }

  if (
    value === 'sending' ||
    value === 'sent' ||
    value === 'delivered' ||
    value === 'read' ||
    value === 'failed'
  ) {
    return value;
  }

  return 'sent';
};

const normalizeBniChannel = (value?: unknown): ChatChannel => {
  if (value === 'linkedin') {
    return 'linkedin';
  }

  if (value === 'gmail' || value === 'email') {
    return 'gmail';
  }

  return 'whatsapp';
};

export const getArrayPayload = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const queue: RawRecord[] = [payload];
  const seen = new WeakSet<object>();

  for (let index = 0; index < queue.length && index < 30; index += 1) {
    const record = queue[index];
    if (seen.has(record)) {
      continue;
    }

    seen.add(record);

    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key];
      }
    }

    for (const key of ['data', 'result', 'payload', 'response']) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested;
      }

      if (isRecord(nested) && !seen.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return [];
};

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const getRecordPayload = (payload: unknown, keys: string[]) => {
  if (!isRecord(payload)) {
    return undefined;
  }

  for (const key of keys) {
    if (isRecord(payload[key])) {
      return payload[key] as RawRecord;
    }
  }

  return undefined;
};

const getConversationBackendChannel = async (conversationId?: string): Promise<WhatsAppBackendChannel> => {
  if (conversationId && bniChannelByConversation.has(conversationId)) {
    return bniChannelByConversation.get(conversationId) ?? await getWhatsAppBackendChannel();
  }

  return getWhatsAppBackendChannel();
};

const getConversationRouteChannel = async (conversationId?: string): Promise<ConversationRouteChannel> => {
  if (conversationId && linkedinConversationIds.has(conversationId)) {
    return 'linkedin';
  }

  return getConversationBackendChannel(conversationId);
};

const stripInternalPrefix = (value: string) => value.replace(/^\s*\[internal\]\s*/i, '').trim();

const normalizeConversationNote = (value: unknown, index = 0): ConversationNote | null => {
  if (!isRecord(value)) {
    return null;
  }

  const content = String(value.content ?? value.note ?? value.body ?? value.text ?? '').trim();
  if (!content) {
    return null;
  }

  const isInternal = Boolean(
    value.is_internal ||
      value.isInternal ||
      value.internal ||
      value.private ||
      value.metadata?.is_internal ||
      value.metadata?.visibility === 'internal' ||
      value.visibility === 'internal' ||
      value.note_type === 'internal' ||
      value.type === 'internal' ||
      /^\s*\[internal\]/i.test(content),
  );

  const authorName =
    value.author_name ??
    value.authorName ??
    value.author?.name ??
    value.created_by_name ??
    value.createdByName;

  return {
    id: String(value.id ?? value._id ?? value.note_id ?? `note-${index}`),
    content,
    displayContent: isInternal ? stripInternalPrefix(content) : content,
    authorName: authorName ? String(authorName) : undefined,
    createdAt: value.created_at || value.createdAt || value.timestamp ? asDateString(value.created_at ?? value.createdAt ?? value.timestamp) : undefined,
    updatedAt: value.updated_at || value.updatedAt ? asDateString(value.updated_at ?? value.updatedAt) : undefined,
    isInternal,
    raw: value,
  };
};

const getNoteFromPayload = (payload: unknown): ConversationNote | null => {
  const source = isRecord(payload)
    ? payload.data ?? payload.note ?? payload.result ?? payload
    : payload;
  return normalizeConversationNote(source);
};

const normalizeTeamMember = (value: unknown, index = 0): ConversationTeamMember | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.user_id ?? value.userId ?? value.id ?? value._id;
  if (!id) {
    return null;
  }

  const name =
    value.name ??
    value.full_name ??
    value.fullName ??
    value.display_name ??
    value.email ??
    `Team member ${index + 1}`;

  const workload = value.workload ?? value.active_count ?? value.activeCount ?? value.open_count ?? value.total_count;

  return {
    id: String(id),
    name: String(name),
    email: value.email ? String(value.email) : undefined,
    role: value.role ? String(value.role) : undefined,
    avatar: value.avatar || value.avatar_url ? String(value.avatar ?? value.avatar_url) : undefined,
    workload: workload !== undefined && workload !== null && Number.isFinite(Number(workload)) ? Number(workload) : undefined,
    isOnline: value.isOnline !== undefined ? Boolean(value.isOnline) : value.online !== undefined ? Boolean(value.online) : undefined,
  };
};

const normalizeAssignmentRecord = (value: unknown, index = 0): ConversationAssignmentRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  const assignedToUserId =
    value.assigned_to_user_id ??
    value.assignedToUserId ??
    value.assigned_to ??
    value.assignedTo ??
    value.user_id ??
    value.userId;
  const assignedByUserId =
    value.assigned_by_user_id ??
    value.assignedByUserId ??
    value.assigned_by ??
    value.assignedBy;

  return {
    id: String(value.id ?? value.assignment_id ?? `assignment-${index}`),
    assignedToUserId: assignedToUserId ? String(assignedToUserId) : null,
    assignedByUserId: assignedByUserId ? String(assignedByUserId) : null,
    assignedAt: asDateString(value.assigned_at ?? value.assignedAt ?? value.created_at ?? value.createdAt),
    raw: value,
  };
};

const normalizeAssignmentHistory = (payload: unknown): ConversationAssignmentHistory => {
  const record = getRecordPayload(payload, ['data', 'result', 'assignment']) ?? (isRecord(payload) ? payload : {});
  const currentSource = record.current ?? record.current_assignment ?? record.assignment ?? null;
  const historyItems = getArrayPayload(record, ['history', 'assignments', 'items', 'results']);
  const history = historyItems
    .map((item, index) => normalizeAssignmentRecord(item, index))
    .filter((item): item is ConversationAssignmentRecord => Boolean(item));

  // When the backend explicitly returns a current-assignment field (even null),
  // it is authoritative — a null means the conversation is unassigned. Only when
  // no current field is present at all do we infer it from the latest history
  // entry or a flat record. Previously we always fell back to history[0], which
  // made an unassigned conversation reappear as assigned after a refresh.
  const hasCurrentField =
    isRecord(record) &&
    ('current' in record || 'current_assignment' in record);
  const current = hasCurrentField
    ? normalizeAssignmentRecord(currentSource)
    : normalizeAssignmentRecord(currentSource) ?? history[0] ?? normalizeAssignmentRecord(record) ?? null;

  return { current, history };
};

const normalizeMindBodyPaymentLink = (payload: unknown): MindBodyPaymentLink => {
  if (isRecord(payload) && payload.success === false) {
    throw new Error(String(payload.error ?? payload.message ?? 'Failed to load MindBody payment link'));
  }

  const record = getRecordPayload(payload, ['data', 'result', 'paymentLink']) ?? (isRecord(payload) ? payload : {});
  const portalUrl = String(record.portal_url ?? record.portalUrl ?? record.url ?? record.payment_link ?? '').trim();

  if (!portalUrl) {
    throw new Error('MindBody payment link is not configured.');
  }

  return {
    portalUrl,
    options: getArrayPayload(record.options ?? record.plans ?? record.pricing ?? [], ['options', 'plans', 'items', 'results'])
      .map((option, index) => {
        const item = isRecord(option) ? option : {};
        return {
          id: String(item.id ?? item.option_id ?? item.name ?? `mindbody-option-${index}`),
          name: String(item.name ?? item.title ?? `Plan ${index + 1}`),
          price: item.price !== undefined && item.price !== null ? String(item.price) : null,
          description: item.description !== undefined && item.description !== null ? String(item.description) : null,
        };
      }),
  };
};

const normalizeMindBodyVerification = (payload: unknown): MindBodyPaymentVerification => {
  if (isRecord(payload) && payload.success === false) {
    throw new Error(String(payload.error ?? payload.message ?? 'MindBody payment verification failed'));
  }

  const record = getRecordPayload(payload, ['data', 'result']) ?? (isRecord(payload) ? payload : {});
  const purchases = Array.isArray(record.purchases) ? record.purchases : [];
  const services = Array.isArray(record.services) ? record.services : [];

  return {
    paid: Boolean(record.paid ?? record.payment_found ?? record.hasPayment ?? (purchases.length || services.length)),
    purchases,
    services,
  };
};

const buildMindBodyPaymentMessage = (portalUrl: string) =>
  [
    'Here is your booking and payment link for PAD Pilates & Dance Studio.',
    '',
    portalUrl,
    '',
    "Please complete your booking through the link and let me know once you're done.",
  ].join('\n');

const getLeadConversationCandidates = (lead: RawRecord) => {
  const conversations = getArrayPayload(lead.conversations, ['conversations', 'data', 'items']);
  if (conversations.length) {
    return conversations;
  }

  const conversation = getRecordPayload(lead, ['conversation', 'latestConversation', 'latest_conversation', 'chat']);
  if (conversation) {
    return [conversation];
  }

  if (
    lead.conversationId ||
    lead.conversation_id ||
    lead.lastMessage ||
    lead.last_message ||
    lead.latestMessage ||
    lead.latest_message ||
    Array.isArray(lead.messages)
  ) {
    return [lead];
  }

  return [];
};

const normalizeLeadBackedConversation = (lead: RawRecord, candidate: RawRecord, index: number): ChatConversation | null => {
  const leadId = String(lead.id ?? lead._id ?? lead.leadId ?? lead.lead_id ?? '');
  const conversationId = getId(candidate) || String(candidate.conversationId ?? candidate.conversation_id ?? '');
  const id = conversationId || (leadId ? `lead-${leadId}-${index}` : '');

  if (!id) {
    return null;
  }

  const messages = getArrayPayload(candidate.messages ?? lead.messages ?? [], ['messages', 'data', 'items'])
    .map((message) => normalizeMessage(message, id))
    .filter((message) => message.content);
  const lastMessage = candidate.lastMessage ?? candidate.last_message ?? candidate.latestMessage ?? candidate.latest_message;
  const hasConversationSignal = messages.length || lastMessage || candidate.lastMessageText || candidate.last_message_text;

  if (!hasConversationSignal) {
    return null;
  }

  if (messages.length) {
    leadSourceMessagesByConversation.set(id, messages);
  }

  return normalizeConversation({
    ...candidate,
    id,
    conversationId: id,
    channel: candidate.channel ?? candidate.source ?? candidate.platform ?? lead.channel ?? lead.source ?? lead.platform,
    name: candidate.name ?? getLeadDisplayName(lead),
    contact: {
      id: leadId,
      name: getLeadDisplayName(lead),
      email: lead.email,
      phone: lead.phone,
      company: lead.company_name ?? lead.company,
      avatar: lead.avatar,
    },
    lead: {
      id: leadId,
      name: getLeadDisplayName(lead),
      email: lead.email,
      phone: lead.phone,
      company: lead.company_name ?? lead.company,
      avatar: lead.avatar,
    },
    messages,
    lastMessage: lastMessage ?? messages[messages.length - 1],
    lastMessageAt:
      candidate.lastMessageAt ??
      candidate.last_message_at ??
      candidate.lastMessageTime ??
      candidate.last_message_time ??
      candidate.updatedAt ??
      candidate.updated_at ??
      lead.last_contacted ??
      lead.updated_at,
    unreadCount: candidate.unreadCount ?? candidate.unread_count ?? candidate.unread ?? lead.unreadCount ?? lead.unread_count ?? 0,
    tags: Array.isArray(lead.tags) ? lead.tags : Array.isArray(candidate.tags) ? candidate.tags : undefined,
  });
};

const parseMetadata = (value: unknown): RawRecord => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
};

const compactMetadataRecord = (value: RawRecord): RawRecord => {
  const entries = Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === '') {
      return false;
    }

    if (Array.isArray(item)) {
      return item.length > 0;
    }

    if (isRecord(item)) {
      return Object.keys(item).length > 0;
    }

    return true;
  });

  return Object.fromEntries(entries);
};

const mergeMetadataRecords = (...values: unknown[]) =>
  compactMetadataRecord(Object.assign({}, ...values.map((value) => parseMetadata(value))));

const getConversationMetadata = (item: RawRecord, lead: RawRecord = {}) =>
  mergeMetadataRecords(
    item.metadata,
    item.conversation_metadata,
    item.conversationMetadata,
    lead.conversation_metadata,
    lead.conversationMetadata,
  );

const getContactMetadata = (item: RawRecord, lead: RawRecord = {}) =>
  mergeMetadataRecords(
    item.contact_metadata,
    item.contactMetadata,
    item.lead_metadata,
    item.leadMetadata,
    item.customer_metadata,
    item.customerMetadata,
    item.profile_metadata,
    item.profileMetadata,
    item.custom_fields,
    item.customFields,
    item.attributes,
    lead.metadata,
    lead.contact_metadata,
    lead.contactMetadata,
    lead.custom_fields,
    lead.customFields,
    lead.attributes,
  );

// Known WhatsApp placeholder texts for media messages (the text sent when no caption)
const WA_MEDIA_PLACEHOLDERS = new Set([
  '\u{1F4F7} Photo', '\u{1F4F8} Photo', 'Photo',
  '\u{1F3A5} Video', 'Video',
  '\u{1F3B5} Audio', 'Audio',
  '\u{1F4C4} Document', 'Document',
  '\u{1F3A4} Voice message', 'Voice message',
  '\u{1F4CD} Location', 'Location',
  '\u{1F4CE} Attachment', 'Attachment',
  '\u{1F4F9} Video',
  'image', 'video', 'audio', 'document',
]);

const isWaMediaPlaceholder = (text: string, mediaType?: string): boolean => {
  const trimmed = text.trim();
  if (WA_MEDIA_PLACEHOLDERS.has(trimmed)) return true;
  // Also catch patterns like "📷 Photo" from any emoji prefix
  if (/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]\s/u.test(trimmed)) return true;
  // If the type is a media type and content is very short (likely a placeholder)
  if (mediaType && ['image', 'video', 'audio', 'document'].includes(mediaType) && trimmed.length < 30) return true;
  return false;
};

// Convert media filenames used as last-message previews into readable labels
const normalizeLastMessagePreview = (text: string): string => {
  const trimmed = text.trim();
  if (/\.(jpe?g|png|gif|webp|heic|bmp|tiff?)$/i.test(trimmed)) return '📷 Photo';
  if (/\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(trimmed)) return '🎥 Video';
  if (/\.(mp3|ogg|m4a|aac|wav|opus)$/i.test(trimmed)) return '🎵 Audio';
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(trimmed)) return '📄 Document';
  return trimmed;
};

const normalizeBniMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const metadata = parseMetadata(item.metadata);
  const rawRole = item.role ?? item.sender ?? item.direction ?? metadata.sender_type;
  const isOutgoing =
    item.isOutgoing === true ||
    rawRole === 'assistant' ||
    rawRole === 'AI' ||
    rawRole === 'human_agent' ||
    rawRole === 'agent' ||
    rawRole === 'outgoing';
  const senderName =
    item.senderName ??
    item.sender_name ??
    metadata.sender_name ??
    metadata.human_agent_name ??
    (isOutgoing ? 'Agent' : 'Lead');

  // Extract media info (same fields as normalizeMessage)
  const rawType = String(item.type ?? item.message_type ?? metadata.message_type ?? metadata.media_type ?? item.mediaType ?? item.media_type ?? '').toLowerCase();
  const inferredMediaType = rawType === 'image' || rawType === 'video' || rawType === 'audio' || rawType === 'document' ? rawType : undefined;
  let mediaId = metadata.media_id ?? item.media_id ?? item.mediaId ?? item.file_url ?? item.url ?? metadata.url;
  const rawContent = String(item.content ?? item.text ?? item.body ?? item.message ?? item.caption ?? '');

  if (!mediaId && inferredMediaType && rawContent.startsWith('http')) {
    mediaId = rawContent;
  }
  // Outbound media rows sometimes echo the bare Meta media id (15-16 digits) as content
  if (!mediaId && inferredMediaType && /^\d{10,}$/.test(rawContent.trim())) {
    mediaId = rawContent.trim();
  }

  const mediaMimeType = metadata.mime_type ?? item.mime_type ?? item.content_type ?? item.media_mime_type
    ? String(metadata.mime_type ?? item.mime_type ?? item.content_type ?? item.media_mime_type)
    : undefined;
  const mediaFilename = metadata.filename ?? item.filename ?? item.media_filename ?? item.mediaFilename
    ? String(metadata.filename ?? item.filename ?? item.media_filename ?? item.mediaFilename)
    : undefined;
  const mediaCaption = metadata.caption ?? item.caption ?? item.media_caption ?? item.mediaCaption
    ? String(metadata.caption ?? item.caption ?? item.media_caption ?? item.mediaCaption)
    : undefined;

  // Build attachments list from attachments array + mediaId
  const atts = Array.isArray(item.attachments) ? [...item.attachments] : [];
  if (mediaId) {
    const url = String(mediaId);
    const typeStr = inferredMediaType ?? 'document';
    atts.push({
      id: url,
      url: url.startsWith('http') ? url : buildMediaFetchUrl(url),
      type: typeStr === 'image' ? 'image' : typeStr === 'video' ? 'video' : 'document',
      name: String(mediaFilename ?? metadata.filename ?? 'Attachment'),
    });
  }

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: String(item.conversationId ?? item.conversation_id ?? fallbackConversationId),
    content: rawContent,
    sender: rawRole === 'system' ? 'system' : isOutgoing ? 'agent' : 'lead',
    channel: normalizeBniChannel(item.channel ?? item.source ?? item.platform),
    status: normalizeStatus(item.message_status ?? item.status ?? metadata.delivery_status ?? item.delivery_status),
    createdAt: asDateString(item.created_at ?? item.createdAt ?? item.timestamp),
    humanAgentId: item.humanAgentId || item.human_agent_id || metadata.human_agent_id
      ? String(item.humanAgentId ?? item.human_agent_id ?? metadata.human_agent_id)
      : undefined,
    senderName: senderName ? String(senderName) : undefined,
    mediaId: mediaId ? String(mediaId) : undefined,
    mediaType: inferredMediaType,
    mediaMimeType,
    mediaFilename,
    mediaCaption,
    attachments: atts.length ? atts : undefined,
  };
};

const normalizeOwnerType = (type: unknown): 'AI' | 'human_agent' | undefined => {
  if (typeof type !== 'string') return undefined;
  const lower = type.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!lower) return undefined;
  if (
    lower === 'ai' ||
    lower === 'bot' ||
    lower === 'assistant' ||
    lower === 'ai_agent' ||
    lower === 'agent_ai' ||
    lower === 'mr_lad' ||
    lower.includes('ai_agent') ||
    lower.includes('bot') ||
    lower.includes('assistant') ||
    lower.includes('automation')
  ) {
    return 'AI';
  }
  if (
    lower === 'human' ||
    lower === 'human_agent' ||
    lower === 'manual' ||
    lower === 'user' ||
    lower.includes('human') ||
    lower.includes('manual') ||
    lower.includes('team_member')
  ) {
    return 'human_agent';
  }
  return undefined;
};

const normalizeBniConversation = (item: RawRecord, backendChannel?: WhatsAppBackendChannel): ChatConversation | null => {
  const id = getId(item);

  if (!id) {
    return null;
  }

  const metadata = getConversationMetadata(item);
  const contactMetadata = getContactMetadata(item);
  const company = item.lead_company ?? item.company ?? item.company_name ?? item.contact_company ?? contactMetadata.company ?? contactMetadata.company_name ?? metadata.company ?? metadata.company_name;
  const phone = item.lead_phone ?? item.phone ?? item.contact_phone ?? contactMetadata.phone ?? contactMetadata.phone_e164 ?? contactMetadata.contact_phone ?? metadata.phone ?? metadata.contact_phone;
  const email = item.lead_email ?? item.email ?? item.contact_email ?? contactMetadata.email ?? contactMetadata.contact_email ?? metadata.email ?? metadata.contact_email;
  const combinedName = [item.lead_first_name, item.lead_last_name].filter(Boolean).join(' ').trim();
  const name = [item.lead_name, item.contact_name, item.name, contactMetadata.name, contactMetadata.full_name, metadata.name, combinedName, phone, email]
    .find((value) => typeof value === 'string' && Boolean(value.trim())) || 'Unknown lead';
  const lastMessage = item.last_message_content ?? item.lastMessageText ?? item.last_message ?? item.preview ?? item.message;
  const inlineMessages = getArrayPayload(item.messages ?? [], ['messages', 'data', 'items'])
    .map((message) => normalizeBniMessage(message, id))
    .filter((message) => message.content);

  if (inlineMessages.length) {
    bniMessagesByConversation.set(id, inlineMessages);
  }

  const tags = [company, item.owner_name ?? item.owner, item.context_status]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));

  const rawOwner = item.owner ?? item.conversation_owner ?? item.handler ?? item.assigned_to ?? metadata.owner ?? metadata.owner_type ?? metadata.handler;
  const rawOwnerName = item.ownerName ?? item.owner_name ?? item.assigned_agent_name ?? metadata.ownerName ?? metadata.owner_name ?? metadata.assigned_agent_name;
  const isExplicitAi =
    item.is_ai_handled === true ||
    item.ai_handled === true ||
    item.bot_handled === true ||
    item.bot_active === true ||
    item.ai_active === true ||
    item.ai_agent_active === true ||
    item.agent_connected === true ||
    item.ai_agent_connected === true ||
    item.is_bot === true ||
    item.is_ai === true ||
    metadata.is_ai_handled === true ||
    metadata.ai_handled === true ||
    metadata.bot_handled === true ||
    metadata.bot_active === true ||
    metadata.ai_active === true ||
    metadata.ai_agent_active === true ||
    metadata.agent_connected === true ||
    metadata.ai_agent_connected === true ||
    metadata.is_bot === true ||
    metadata.is_ai === true;
  const isExplicitHuman =
    item.is_human_handled === true ||
    item.human_handled === true ||
    item.human_agent_active === true ||
    item.manual_mode === true ||
    Boolean(item.humanAgentId ?? item.human_agent_id ?? metadata.humanAgentId ?? metadata.human_agent_id) ||
    metadata.is_human_handled === true ||
    metadata.human_handled === true ||
    metadata.human_agent_active === true ||
    metadata.manual_mode === true;
  
  const explicitOwnerType = normalizeOwnerType(item.owner_type ?? item.ownerType ?? metadata.owner_type ?? metadata.ownerType);
  let derivedOwnerType: 'AI' | 'human_agent' | undefined;
  if (explicitOwnerType) {
    derivedOwnerType = explicitOwnerType;
  } else if (isExplicitAi) {
    derivedOwnerType = 'AI';
  } else if (isExplicitHuman) {
    derivedOwnerType = 'human_agent';
  } else if (normalizeOwnerType(rawOwner) === 'human_agent' || normalizeOwnerType(rawOwnerName) === 'human_agent') {
    derivedOwnerType = 'human_agent';
  } else if (normalizeOwnerType(rawOwner) === 'AI' || normalizeOwnerType(rawOwnerName) === 'AI') {
    derivedOwnerType = 'AI';
  } else {
    // Aggressive JSON stringification fallback
    const jsonStr = JSON.stringify({ ...item, messages: undefined, last_message_content: undefined, lastMessageText: undefined, last_message: undefined, message: undefined, preview: undefined }).toLowerCase();
    if (jsonStr.includes('"is_bot":true') || jsonStr.includes('"bot_handled":true') || jsonStr.includes('"ai_handled":true') || jsonStr.includes('"is_ai_handled":true') || jsonStr.includes('"ai_active":true')) {
      derivedOwnerType = 'AI';
    } else if (jsonStr.includes('"is_human":true') || jsonStr.includes('"human_handled":true') || jsonStr.includes('"human_agent_active":true')) {
      derivedOwnerType = 'human_agent';
    }
  }
  const ownerType = derivedOwnerType;
  const ownerLabel = rawOwnerName
    ? String(rawOwnerName)
    : ownerType === 'human_agent'
      ? 'Human Agent'
      : ownerType === 'AI'
        ? 'AI Agent'
        : rawOwner
          ? String(rawOwner)
          : undefined;

  return {
    id,
    name: String(name),
    channel: normalizeBniChannel(item.lead_channel ?? item.channel ?? item.source ?? item.platform),
    lastMessage: normalizeLastMessagePreview(String(lastMessage || inlineMessages[inlineMessages.length - 1]?.content || 'No messages yet')),
    lastMessageAt: asDateString(
      item.last_message_at ??
        item.updated_at ??
        item.started_at ??
        item.created_at ??
        inlineMessages[inlineMessages.length - 1]?.createdAt,
    ),
    unreadCount: Number(item.unread_count ?? item.unreadCount ?? item.unread ?? 0),
    avatar: String(item.avatar ?? item.profile_image ?? ''),
    online: Boolean(item.online ?? item.is_online),
    status: normalizeStatus(item.last_message_status ?? item.message_status ?? item.delivery_status),
    tags: tags.length ? tags : undefined,
    email: email ? String(email) : undefined,
    phone: phone ? String(phone) : undefined,
    company: company ? String(company) : undefined,
    leadId: item.lead_id || item.leadId ? String(item.lead_id ?? item.leadId) : undefined,
    startedAt: item.started_at || item.created_at || item.createdAt
      ? asDateString(item.started_at ?? item.created_at ?? item.createdAt)
      : undefined,
    owner: ownerLabel,
    ownerType,
    conversationState: item.context_status || item.conversation_status || item.status
      ? String(item.context_status ?? item.conversation_status ?? item.status)
      : undefined,
    messageCount: Number(item.message_count ?? item.messages_count ?? item.total_messages ?? inlineMessages.length),
    metadata,
    contactMetadata,
    waBackendChannel: backendChannel,
    accountId: item.account_id ?? item.accountId ?? item.phone_number_id ?? item.phoneNumberId ?? item.waba_account_id
      ? String(item.account_id ?? item.accountId ?? item.phone_number_id ?? item.phoneNumberId ?? item.waba_account_id)
      : undefined,
  };
};

const normalizeLinkedInMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const isOutgoing = item.is_sender === true || item.isOutgoing === true || item.role === 'assistant' || item.sender === 'assistant';

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: String(item.conversationId ?? item.conversation_id ?? fallbackConversationId),
    content: String(item.content ?? item.text ?? item.body ?? item.message ?? ''),
    sender: isOutgoing ? 'agent' : 'lead',
    channel: 'linkedin',
    status: normalizeStatus(item.status ?? item.delivery_status ?? item.message_status),
    createdAt: asDateString(item.created_at ?? item.createdAt ?? item.timestamp),
    humanAgentId: item.humanAgentId || item.human_agent_id ? String(item.humanAgentId ?? item.human_agent_id) : undefined,
    senderName: item.senderName || item.sender_name ? String(item.senderName ?? item.sender_name) : undefined,
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
  };
};

const normalizeLinkedInConversation = (item: RawRecord): ChatConversation | null => {
  const id = getId(item);
  if (!id) {
    return null;
  }

  const contact = isRecord(item.contact) ? item.contact : {};
  const name = contact.name ?? item.name ?? item.lead_name ?? item.contact_name ?? item.leadName ?? 'LinkedIn contact';
  const company = item.company ?? item.company_name ?? contact.company ?? contact.headline;
  const lastMessage = item.last_message ?? item.lastMessage ?? item.last_message_content ?? item.preview;
  const state = item.connection_status ?? item.context_status ?? item.status;

  return {
    id,
    name: String(name),
    channel: 'linkedin',
    lastMessage: String(lastMessage || (state === 'pending' ? 'Connection request sent' : 'No messages yet')),
    lastMessageAt: asDateString(item.last_message_time ?? item.last_message_at ?? item.updated_at ?? item.created_at),
    unreadCount: Number(item.unread_count ?? item.unreadCount ?? 0),
    avatar: contact.avatar || item.avatar ? String(contact.avatar ?? item.avatar) : undefined,
    online: item.chat_enabled === true || state === 'active',
    status: normalizeStatus(item.message_status ?? item.status),
    tags: [state, item.chat_enabled === false ? 'chat locked' : undefined]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim())),
    company: company ? String(company) : undefined,
    leadId: item.lead_id || item.leadId ? String(item.lead_id ?? item.leadId) : undefined,
    startedAt: item.created_at || item.createdAt ? asDateString(item.created_at ?? item.createdAt) : undefined,
    conversationState: state ? String(state) : undefined,
    messageCount: Number(item.message_count ?? item.messages_count ?? 0),
  };
};

// Convert an HTML email body to readable plain text. Paragraph/line-break tags
// become newlines (collapsing everything to one line made real emails unreadable),
// list items get bullets, and common entities are decoded.
const stripHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const normalizeEmailMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const isOutgoing = item.direction === 'outbound' || item.isOutgoing === true || item.role === 'assistant';
  const body = stripHtml(item.body_html ?? item.body ?? item.content ?? item.message ?? item.preview_text);
  const subject = String(item.subject ?? '').trim();

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: fallbackConversationId,
    content: body || subject || 'Email message',
    subject: subject || undefined,
    sender: isOutgoing ? 'agent' : 'lead',
    channel: 'email',
    status: normalizeStatus(item.status ?? item.delivery_status ?? item.message_status),
    createdAt: asDateString(item.sent_at ?? item.created_at ?? item.createdAt ?? item.timestamp),
    senderName: item.senderName || item.sender_name ? String(item.senderName ?? item.sender_name) : undefined,
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
  };
};

const normalizeEmailContactConversation = (item: RawRecord): ChatConversation | null => {
  const contactId = getId(item);
  if (!contactId) {
    return null;
  }

  const id = `email:${contactId}`;
  const provider = String(item.channel ?? item.provider ?? 'email');
  const name = item.contact_name ?? item.contactName ?? item.name ?? item.email ?? 'Email contact';
  const company = item.company ?? item.company_name;
  const metadata = parseMetadata(item.metadata);
  const contactMetadata = getContactMetadata(item);
  const lastMessage = item.last_message ?? item.lastMessage ?? item.preview_text ?? metadata.last_message;
  const lastMessageAt = item.last_message_at ?? item.lastMessageAt ?? item.updated_at ?? item.created_at;

  emailConversationIds.add(id);
  emailContactIdsByConversation.set(id, contactId);
  emailProvidersByConversation.set(id, provider);

  return {
    id,
    name: String(name),
    channel: provider === 'gmail' ? 'gmail' : 'email',
    lastMessage: String(lastMessage || item.email || 'Open email thread'),
    lastMessageAt: asDateString(lastMessageAt),
    unreadCount: Number(item.unread_count ?? item.unreadCount ?? 0),
    online: false,
    status: normalizeStatus(item.status ?? item.delivery_status),
    tags: [provider, company].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())),
    email: item.email ? String(item.email) : undefined,
    company: company ? String(company) : undefined,
    leadId: contactId,
    startedAt: item.created_at || item.createdAt ? asDateString(item.created_at ?? item.createdAt) : undefined,
    conversationState: provider,
    messageCount: Number(item.message_count ?? item.messages_count ?? 0),
    metadata,
    contactMetadata,
  };
};

const filterConversations = (conversations: ChatConversation[], params: ConversationPageParams = {}) => {
  const query = params.search?.trim().toLowerCase();
  return conversations
    .filter((conversation) => {
      const searchable = [
        conversation.name,
        conversation.lastMessage,
        conversation.email,
        conversation.phone,
        conversation.company,
        ...(conversation.tags ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesChannel =
        !params.channel ||
        params.channel === 'all' ||
        (params.channel === 'unread' && conversation.unreadCount > 0) ||
        conversation.channel === params.channel ||
        (params.channel === 'email' && conversation.channel === 'gmail') ||
        (params.channel === 'gmail' && conversation.channel === 'email');

      return matchesSearch && matchesChannel;
    })
    .sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));
};

const getConversationsFromBniSource = async (params: ConversationPageParams = {}) => {
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  const requestParams: Record<string, unknown> = {
    limit,
    offset: Math.max(0, page - 1) * limit,
  };

  if (params.search) {
    requestParams.search = params.search;
  }

  const channels = await getWhatsAppBackendChannels();
  const results = await Promise.allSettled(
    channels.map(async (backendChannel) => {
      const payload = await bniRequest('GET', '/api/conversations', undefined, {
        backendChannel,
        params: requestParams,
      });
      const conversations = getArrayPayload(payload, ['data', 'conversations', 'items', 'results'])
        .filter(isRecord)
        .map((item) => normalizeBniConversation(item, backendChannel))
        .filter(Boolean) as ChatConversation[];

      conversations.forEach((conversation) => {
        bniConversationIds.add(conversation.id);
        bniChannelByConversation.set(conversation.id, backendChannel);
      });

      return conversations;
    }),
  );

  const conversations = uniqueConversationsById(
    results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
  );

  if (!conversations.length) {
    const firstError = results.find((result) => result.status === 'rejected');
    if (firstError?.status === 'rejected') {
      throw firstError.reason;
    }
  }

  return filterConversations(conversations, params);
};

const getConversationsFromLinkedInSource = async (params: ConversationPageParams = {}) => {
  const limit = params.limit ?? 100;
  const page = params.page ?? 1;
  const payload = await bniRequest('GET', '/api/conversations', undefined, {
    backendChannel: 'linkedin',
    params: {
      limit,
      offset: Math.max(0, page - 1) * limit,
    },
  });
  const conversations = getArrayPayload(payload, ['data', 'conversations', 'items', 'results'])
    .filter(isRecord)
    .map((item) => normalizeLinkedInConversation(item))
    .filter(Boolean) as ChatConversation[];

  conversations.forEach((conversation) => linkedinConversationIds.add(conversation.id));

  return filterConversations(conversations, params);
};

export const getConversationStats = async (params: ConversationPageParams = {}) => {
  const channel = params.channel ?? 'whatsapp';
  try {
    if (channel === 'whatsapp') {
      try {
        const channels = await getWhatsAppBackendChannels();
        const waba = channels.includes('waba') ? 'waba' : channels[0];
        if (waba) {
          const payload = await bniRequest('GET', '/api/conversations', undefined, {
            backendChannel: waba,
            params: { limit: 1 },
          });
          return payload;
        }
      } catch (e) {
        // Ignore
      }
    }
    const response = await apiGet<any>('/api/conversations', { params: { limit: 1, channel } });
    return response.data;
  } catch (e) {
    // Silent fail
  }
  return null;
};

const getConversationsFromEmailSource = async (params: ConversationPageParams = {}) => {
  const payload = await emailCommsRequest('GET', '/contacts', undefined, {
    params: {
      limit: params.limit ?? 500,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  const conversations = getArrayPayload(payload, ['data', 'contacts', 'items', 'results'])
    .filter(isRecord)
    .map((item) => normalizeEmailContactConversation(item))
    .filter(Boolean) as ChatConversation[];

  return filterConversations(conversations, params);
};

const normalizeInstagramConversation = (item: RawRecord): ChatConversation | null => {
  const id = getId(item);
  if (!id) return null;

  const lastMessage = item.last_message ?? item.lastMessage ?? {};
  const lastMessageRecord = isRecord(lastMessage) ? lastMessage : {};
  const name = item.contact_name ?? item.name ?? item.username ?? item.contact_phone ?? 'Instagram contact';
  const preview = typeof lastMessage === 'string'
    ? lastMessage
    : lastMessageRecord.content ?? item.preview ?? item.last_message_text ?? '';

  return {
    id,
    name: String(name),
    channel: 'instagram',
    lastMessage: String(preview || 'No messages yet'),
    lastMessageAt: asDateString(item.last_message_at ?? item.lastMessageAt ?? lastMessageRecord.created_at ?? item.updated_at ?? item.created_at),
    unreadCount: Number(item.unread_count ?? item.unreadCount ?? 0),
    avatar: String(item.contact_avatar ?? item.avatar ?? ''),
    online: false,
    status: normalizeStatus(item.status),
    phone: item.contact_phone ? String(item.contact_phone).replace(/^ig:/, '') : undefined,
    leadId: item.contact_id ? String(item.contact_id) : undefined,
    startedAt: item.created_at ? asDateString(item.created_at) : undefined,
    owner: item.owner ? String(item.owner) : undefined,
    conversationState: item.context_status ? String(item.context_status) : undefined,
    messageCount: Number(item.message_count ?? 0),
  };
};

const normalizeInstagramMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const role = item.role ?? item.sender;
  const isOutgoing = role === 'assistant' || role === 'agent' || role === 'outgoing';

  return {
    id: String(item.id ?? item._id ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: String(item.conversation_id ?? item.conversationId ?? fallbackConversationId),
    content: String(item.content ?? item.text ?? item.message ?? ''),
    sender: role === 'system' ? 'system' : isOutgoing ? 'agent' : 'lead',
    channel: 'instagram',
    status: normalizeStatus(item.status),
    createdAt: asDateString(item.created_at ?? item.createdAt ?? item.timestamp),
    senderName: isOutgoing ? 'Agent' : 'Instagram',
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
  };
};

const getConversationsFromInstagramSource = async (params: ConversationPageParams = {}) => {
  const payload = await instagramRequest('GET', '/conversations', undefined, {
    params: {
      limit: params.limit ?? 100,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  const conversations = getArrayPayload(payload, ['data', 'conversations', 'items', 'results'])
    .filter(isRecord)
    .map((item) => normalizeInstagramConversation(item))
    .filter(Boolean) as ChatConversation[];

  conversations.forEach((conversation) => instagramConversationIds.add(conversation.id));
  return filterConversations(conversations, params);
};

const getMessagesFromBniSource = async (conversationId: string, page = 1, limit = 20) => {
  const backendChannel = bniChannelByConversation.get(conversationId) ?? await getWhatsAppBackendChannel();
  const payload = await bniRequest('GET', `/api/conversations/${conversationId}/messages`, undefined, {
    backendChannel,
    params: {
      limit,
      offset: Math.max(0, page - 1) * limit,
    },
  });
  const messages = getArrayPayload(payload, ['data', 'messages', 'items', 'results'])
    .map((item) => normalizeBniMessage(item, conversationId))
    .filter((message) => message.content || message.mediaId);

  if (messages.length) {
    bniMessagesByConversation.set(conversationId, messages);
  }

  return messages;
};

const getMessagesFromLinkedInSource = async (conversationId: string, page = 1, limit = 100) => {
  const payload = await bniRequest('GET', `/api/conversations/${conversationId}/messages`, undefined, {
    backendChannel: 'linkedin',
    params: {
      limit,
      offset: Math.max(0, page - 1) * limit,
    },
  });
  const messages = getArrayPayload(payload, ['data', 'messages', 'items', 'results'])
    .map((item) => normalizeLinkedInMessage(item, conversationId))
    .filter((message) => message.content || message.mediaId);

  return messages;
};

const getMessagesFromEmailSource = async (conversationId: string) => {
  const contactId = emailContactIdsByConversation.get(conversationId) ?? conversationId.replace(/^email:/, '');
  const payload = await emailCommsRequest('GET', '/messages', undefined, {
    params: {
      contact_id: contactId,
      limit: 500,
    },
  });
  const messages = getArrayPayload(payload, ['messages', 'data', 'items', 'results'])
    .map((item) => normalizeEmailMessage(item, conversationId))
    .filter((message) => message.content)
    // Guarantee oldest → newest regardless of the backend's ordering; the
    // thread list relies on it (and mirrors lad-frontend-2's thread order).
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return messages;
};

const getMessagesFromInstagramSource = async (conversationId: string, limit = 500) => {
  const payload = await instagramRequest('GET', `/conversations/${conversationId}/messages`, undefined, {
    params: { limit },
  });
  const messages = getArrayPayload(payload, ['messages', 'data', 'items', 'results'])
    .map((item) => normalizeInstagramMessage(item, conversationId))
    .filter((message) => message.content);

  return messages;
};

const getConversationsFromLeadSource = async (params: ConversationPageParams = {}) => {
  if (params.page && params.page > 1) {
    return [];
  }

  const response = await apiGet('/api/deals-pipeline/with-conversations');
  const leads = getArrayPayload(response.data, ['leads', 'data', 'items', 'results']);
  const conversations = leads.flatMap((lead, leadIndex) => {
    if (!isRecord(lead)) {
      return [];
    }

    return getLeadConversationCandidates(lead)
      .filter(isRecord)
      .map((candidate, candidateIndex) => normalizeLeadBackedConversation(lead, candidate, leadIndex + candidateIndex))
      .filter(Boolean) as ChatConversation[];
  });

  const query = params.search?.trim().toLowerCase();
  return conversations
    .filter((conversation) => {
      const matchesSearch =
        !query ||
        conversation.name.toLowerCase().includes(query) ||
        conversation.lastMessage.toLowerCase().includes(query) ||
        conversation.tags?.some((tag) => tag.toLowerCase().includes(query));
      const matchesChannel =
        !params.channel ||
        params.channel === 'all' ||
        (params.channel === 'unread' && conversation.unreadCount > 0) ||
        conversation.channel === params.channel ||
        (params.channel === 'email' && conversation.channel === 'gmail') ||
        (params.channel === 'gmail' && conversation.channel === 'email');

      return matchesSearch && matchesChannel;
    })
    .sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));
};

export const normalizeConversation = (item: ApiConversation | RawRecord): ChatConversation => {
  const inlineMessages = getArrayPayload(item.messages ?? [], ['messages', 'data', 'items']);
  const lastInlineMessage = inlineMessages.length ? inlineMessages[inlineMessages.length - 1] : undefined;
  const lastMessage =
    item.lastMessage ??
    item.last_message ??
    item.latestMessage ??
    item.latest_message ??
    item.preview ??
    item.message ??
    lastInlineMessage ??
    {};
  const lead = item.lead ?? item.contact ?? item.customer ?? item.participant ?? item.participants?.[0] ?? {};
  const metadata = getConversationMetadata(item, lead);
  const contactMetadata = getContactMetadata(item, lead);
  const lastMessageRecord = isRecord(lastMessage) ? lastMessage : {};
  const name = getDisplayName(item, lead);
  const email = item.email ?? item.contact_email ?? item.lead_email ?? lead.email ?? contactMetadata.email ?? contactMetadata.contact_email ?? metadata.email ?? metadata.contact_email;
  const phone = item.phone ?? item.contact_phone ?? item.lead_phone ?? lead.phone ?? contactMetadata.phone ?? contactMetadata.phone_e164 ?? contactMetadata.contact_phone ?? metadata.phone ?? metadata.contact_phone;
  const company = item.company ?? item.company_name ?? item.contact_company ?? item.lead_company ?? lead.company ?? lead.company_name ?? contactMetadata.company ?? contactMetadata.company_name ?? metadata.company ?? metadata.company_name;
  const rawOwner = item.owner ?? item.conversation_owner ?? item.handler ?? item.assigned_to ?? metadata.owner ?? metadata.owner_type ?? metadata.handler;
  const rawOwnerName = item.ownerName ?? item.owner_name ?? item.assigned_agent_name ?? metadata.ownerName ?? metadata.owner_name ?? metadata.assigned_agent_name;
  const isExplicitAi =
    item.is_ai_handled === true ||
    item.ai_handled === true ||
    item.bot_handled === true ||
    item.bot_active === true ||
    item.ai_active === true ||
    item.ai_agent_active === true ||
    item.agent_connected === true ||
    item.ai_agent_connected === true ||
    item.is_bot === true ||
    item.is_ai === true ||
    metadata.is_ai_handled === true ||
    metadata.ai_handled === true ||
    metadata.bot_handled === true ||
    metadata.bot_active === true ||
    metadata.ai_active === true ||
    metadata.ai_agent_active === true ||
    metadata.agent_connected === true ||
    metadata.ai_agent_connected === true ||
    metadata.is_bot === true ||
    metadata.is_ai === true;
  const isExplicitHuman =
    item.is_human_handled === true ||
    item.human_handled === true ||
    item.human_agent_active === true ||
    item.manual_mode === true ||
    Boolean(item.humanAgentId ?? item.human_agent_id ?? metadata.humanAgentId ?? metadata.human_agent_id) ||
    metadata.is_human_handled === true ||
    metadata.human_handled === true ||
    metadata.human_agent_active === true ||
    metadata.manual_mode === true;
  
  const explicitOwnerType = normalizeOwnerType(item.owner_type ?? item.ownerType ?? metadata.owner_type ?? metadata.ownerType);
  let derivedOwnerType: 'AI' | 'human_agent' | undefined;
  if (explicitOwnerType) {
    derivedOwnerType = explicitOwnerType;
  } else if (isExplicitAi) {
    derivedOwnerType = 'AI';
  } else if (isExplicitHuman) {
    derivedOwnerType = 'human_agent';
  } else if (normalizeOwnerType(rawOwner) === 'human_agent' || normalizeOwnerType(rawOwnerName) === 'human_agent') {
    derivedOwnerType = 'human_agent';
  } else if (normalizeOwnerType(rawOwner) === 'AI' || normalizeOwnerType(rawOwnerName) === 'AI') {
    derivedOwnerType = 'AI';
  } else {
    const jsonStr = JSON.stringify({ ...item, messages: undefined, last_message_content: undefined, lastMessageText: undefined, last_message: undefined, message: undefined, preview: undefined }).toLowerCase();
    if (jsonStr.includes('"is_bot":true') || jsonStr.includes('"bot_handled":true') || jsonStr.includes('"ai_handled":true') || jsonStr.includes('"is_ai_handled":true') || jsonStr.includes('"ai_active":true')) {
      derivedOwnerType = 'AI';
    } else if (jsonStr.includes('"is_human":true') || jsonStr.includes('"human_handled":true') || jsonStr.includes('"human_agent_active":true')) {
      derivedOwnerType = 'human_agent';
    }
  }
  const ownerType = derivedOwnerType;
  const ownerLabel = rawOwnerName
    ? String(rawOwnerName)
    : ownerType === 'human_agent'
      ? 'Human Agent'
      : ownerType === 'AI'
        ? 'AI Agent'
        : rawOwner
          ? String(rawOwner)
          : undefined;
  const lastMessageText =
    typeof lastMessage === 'string'
      ? lastMessage
      : lastMessageRecord.content ??
        lastMessageRecord.text ??
        lastMessageRecord.body ??
        item.lastMessageText ??
        '';

  return {
    id: getId(item),
    name: String(name),
    channel: normalizeChannel(item.channel ?? item.source ?? item.platform ?? lastMessageRecord.channel),
    lastMessage: normalizeLastMessagePreview(String(lastMessageText || 'No messages yet')),
    lastMessageAt: asDateString(
      item.lastMessageAt ??
        item.last_message_at ??
        item.lastMessageTime ??
        item.last_message_time ??
        item.updatedAt ??
        item.updated_at ??
        lastMessageRecord.createdAt ??
        lastMessageRecord.created_at ??
        lastMessageRecord.timestamp,
    ),
    unreadCount: Number(item.unreadCount ?? item.unread_count ?? item.unread ?? 0),
    avatar: (() => {
      const url = String(item.avatar ?? lead.avatar ?? lead.profileImage ?? '');
      if (!url) return '';
      return url.startsWith('http') ? url : buildApiUrl(url, RESOLVED_API_URL);
    })(),
    online: Boolean(item.online ?? item.isOnline),
    status: normalizeStatus(item.status ?? item.delivery_status ?? lastMessageRecord.delivery_status),
    tags: Array.isArray(item.tags) ? item.tags : undefined,
    email: email ? String(email) : undefined,
    phone: phone ? String(phone) : undefined,
    company: company ? String(company) : undefined,
    leadId: item.leadId || item.lead_id || lead.id ? String(item.leadId ?? item.lead_id ?? lead.id) : undefined,
    startedAt: item.startedAt || item.started_at || item.createdAt || item.created_at
      ? asDateString(item.startedAt ?? item.started_at ?? item.createdAt ?? item.created_at)
      : undefined,
    owner: ownerLabel,
    ownerType,
    conversationState: item.conversationState || item.conversation_state || item.context_status || item.status
      ? String(item.conversationState ?? item.conversation_state ?? item.context_status ?? item.status)
      : undefined,
    messageCount: Number(item.messageCount ?? item.message_count ?? item.messages_count ?? inlineMessages.length),
    metadata,
    contactMetadata,
    accountId: item.accountId ?? item.account_id ?? item.phone_number_id ?? item.phoneNumberId
      ? String(item.accountId ?? item.account_id ?? item.phone_number_id ?? item.phoneNumberId)
      : undefined,
  };
};

export const normalizeMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const senderValue = item.sender ?? item.role ?? item.direction ?? item.from;
  const metadataRaw = isRecord(item.metadata) ? item.metadata : (typeof item.metadata === 'string' ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })() : {});
  const metadata = isRecord(metadataRaw) ? metadataRaw : {};
  const senderRecord = isRecord(item.sender) ? item.sender : {};
  const humanAgentId = item.humanAgentId ?? item.human_agent_id ?? metadata.human_agent_id;
  const senderName = item.senderName ?? item.sender_name ?? metadata.sender_name ?? senderRecord.name;
  const sender =
    item.isOutgoing === true ||
    senderValue === 'agent' ||
    senderValue === 'assistant' ||
    senderValue === 'outgoing' ||
    senderValue === 'user'
      ? 'agent'
      : senderValue === 'system'
        ? 'system'
        : 'lead';

  const rawType = String(item.type ?? item.message_type ?? metadata.message_type ?? metadata.media_type ?? item.mediaType ?? item.media_type ?? '').toLowerCase();
  let inferredMediaType = rawType === 'image' || rawType === 'video' || rawType === 'audio' || rawType === 'document' ? rawType : undefined;

  let mediaId = metadata.media_id ?? item.media_id ?? item.mediaId ?? item.file_url ?? item.url ?? metadata.url;
  const contentStr = String(item.content ?? item.text ?? item.body ?? item.message ?? '');

  // Outbound media rows sometimes echo the bare Meta media id (15-16 digits) as content
  if (!mediaId && inferredMediaType && /^\d{10,}$/.test(contentStr.trim())) {
    mediaId = contentStr.trim();
  }

  if (!mediaId && contentStr.startsWith('http')) {
    const isImage = /\.(jpe?g|png|gif|webp|heic|bmp)(?:\?.*)?$/i.test(contentStr);
    const isVideo = /\.(mp4|mov|avi|mkv|webm|3gp)(?:\?.*)?$/i.test(contentStr);
    
    if (inferredMediaType) {
      mediaId = contentStr;
    } else if (isImage) {
      mediaId = contentStr;
      inferredMediaType = 'image';
    } else if (isVideo) {
      mediaId = contentStr;
      inferredMediaType = 'video';
    }
  }

  const latitude = metadata.latitude !== undefined ? Number(metadata.latitude) : (item.latitude !== undefined ? Number(item.latitude) : undefined);
  const longitude = metadata.longitude !== undefined ? Number(metadata.longitude) : (item.longitude !== undefined ? Number(item.longitude) : undefined);
  const locationName = metadata.location_name || item.location_name || metadata.locationAddress || item.locationAddress || undefined;
  const locationAddress = metadata.location_address || item.location_address || undefined;

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${Date.now()}-${Math.random()}`),
    conversationId: String(
      item.conversationId ?? item.conversation_id ?? item.threadId ?? item.thread_id ?? fallbackConversationId,
    ),
    content: (latitude != null && longitude != null) 
      ? `Location shared\n${locationName || 'Location'}\nhttps://maps.google.com/maps?q=${latitude},${longitude}`
      : String(item.content ?? item.text ?? item.body ?? item.message ?? ''),
    sender,
    channel: normalizeChannel(item.channel ?? item.source ?? item.platform),
    status: normalizeStatus(
      item.status ??
        item.message_status ??
        item.delivery_status ??
        metadata.delivery_status ??
        metadata.read_receipt ??
        item.read_receipt,
    ),
    createdAt: asDateString(item.createdAt ?? item.created_at ?? item.timestamp),
    humanAgentId: humanAgentId ? String(humanAgentId) : senderRecord.id ? String(senderRecord.id) : undefined,
    senderName: senderName ? String(senderName) : undefined,
    mediaId: mediaId ? String(mediaId) : undefined,
    mediaType: inferredMediaType,
    mediaMimeType: metadata.mime_type ?? item.mime_type ?? item.content_type ?? item.media_mime_type ? String(metadata.mime_type ?? item.mime_type ?? item.content_type ?? item.media_mime_type) : undefined,
    mediaFilename: metadata.filename ?? item.filename ?? item.media_filename ?? item.mediaFilename ? String(metadata.filename ?? item.filename ?? item.media_filename ?? item.mediaFilename) : undefined,
    mediaCaption: metadata.caption ?? item.caption ?? item.media_caption ?? item.mediaCaption ? String(metadata.caption ?? item.caption ?? item.media_caption ?? item.mediaCaption) : undefined,
    latitude,
    longitude,
    locationName,
    locationAddress,
    attachments: (() => {
      const atts = Array.isArray(item.attachments) ? [...item.attachments] : [];
      if (mediaId) {
        const url = String(mediaId);
        const typeStr = inferredMediaType ?? 'document';
        atts.push({
          id: url,
          url: url.startsWith('http') ? url : buildMediaFetchUrl(url),
          type: typeStr === 'image' ? 'image' : typeStr === 'video' ? 'video' : 'document',
          name: String(item.mediaFilename ?? item.media_filename ?? metadata.filename ?? metadata.media_filename ?? 'Attachment'),
        });
      }
      return atts.length ? atts : undefined;
    })(),
  };
};

class ChatService {
  private conversationListeners = new Set<ConversationListener>();
  private messageListeners = new Map<string, Set<MessageListener>>();
  currentConversationId: string | null = null;

  initSocket() {
    return getSocket();
  }

  joinConversationRoom(conversationId: string) {
    this.currentConversationId = conversationId;
    getSocket().emit('join', conversationId);
  }

  leaveConversationRoom(conversationId: string) {
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
    getSocket().emit('leave', conversationId);
  }

  subscribeToConversations(callback: ConversationListener) {
    this.conversationListeners.add(callback);
    return () => {
      this.conversationListeners.delete(callback);
    };
  }

  subscribeToMessages(conversationId: string, callback: MessageListener) {
    const listeners = this.messageListeners.get(conversationId) ?? new Set<MessageListener>();
    listeners.add(callback);
    this.messageListeners.set(conversationId, listeners);

    return () => {
      listeners.delete(callback);
      if (!listeners.size) {
        this.messageListeners.delete(conversationId);
      }
    };
  }

  notifyConversationListeners(data: ApiConversation) {
    this.conversationListeners.forEach((callback) => callback(data));
  }

  notifyMessageListeners(conversationId: string, message: ApiMessage) {
    this.messageListeners.get(conversationId)?.forEach((callback) => callback(message));
  }

  async getConversations(params: ConversationPageParams = {}) {
    if (params.channel === 'linkedin') {
      return getConversationsFromLinkedInSource(params);
    }

    if (params.channel === 'instagram') {
      return getConversationsFromInstagramSource(params);
    }

    if (params.channel === 'email' || params.channel === 'gmail') {
      return getConversationsFromEmailSource(params);
    }

    if (!params.channel || params.channel === 'all' || params.channel === 'unread') {
      const results = await Promise.allSettled([
        getConversationsFromBniSource(params),
        getConversationsFromLinkedInSource(params),
        getConversationsFromInstagramSource(params),
        getConversationsFromEmailSource(params),
      ]);
      const conversations = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

      if (conversations.length || Platform.OS === 'web') {
        return filterConversations(conversations, params);
      }
    }

    try {
      const bniConversations = await getConversationsFromBniSource(params);
      if (Platform.OS === 'web' || bniConversations.length) {
        return bniConversations;
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        throw error;
      }

      // If the WhatsApp service is unavailable for a native device, fall back to the LAD backend paths below.
    }

    const requestParams: Record<string, unknown> = {};

    if (params.search) {
      requestParams.search = params.search;
    }

    if (params.page) {
      requestParams.page = params.page;
    }

    if (params.limit) {
      requestParams.limit = params.limit;
    }

    if (params.cursor) {
      requestParams.cursor = params.cursor;
    }

    if (params.channel && params.channel !== 'all' && params.channel !== 'unread') {
      requestParams.channel = params.channel;
    }

    const payload = await getWithDirectFallback(
      '/api/conversations',
      Object.keys(requestParams).length ? { params: requestParams } : undefined,
    );
    const conversations = getArrayPayload(payload, ['conversations', 'data', 'items'])
      .map((item) => normalizeConversation(item))
      .filter((conversation) => conversation.id);

    if (!conversations.length) {
      return getConversationsFromLeadSource(params);
    }

    if (params.channel && params.channel !== 'all' && params.channel !== 'unread') {
      const requestedChannel = params.channel as ChatChannel;
      return conversations.filter((conversation) =>
        conversation.channel === requestedChannel ||
        (requestedChannel === 'email' && conversation.channel === 'gmail') ||
        (requestedChannel === 'gmail' && conversation.channel === 'email')
      );
    }

    if (params.channel === 'unread') {
      return conversations.filter((conversation) => conversation.unreadCount > 0);
    }

    return conversations;
  }

  async searchConversations(query: string) {
    return this.getConversations({ search: query });
  }

  async getConversation(id: string): Promise<ConversationDetail> {
    if (bniConversationIds.has(id)) {
      const backendChannel = await getConversationBackendChannel(id);
      const cachedMessages = bniMessagesByConversation.get(id);
      const [messagesResult, detailResult] = await Promise.allSettled([
        cachedMessages?.length ? Promise.resolve(cachedMessages) : getMessagesFromBniSource(id, 1, 100),
        bniRequest('GET', `/api/conversations/${id}`, undefined, { backendChannel }),
      ]);
      const messages = messagesResult.status === 'fulfilled' ? messagesResult.value : [];
      const detailPayload = detailResult.status === 'fulfilled' ? detailResult.value : null;
      const source = getRecordPayload(detailPayload, ['conversation', 'data', 'result']) ?? (isRecord(detailPayload) ? detailPayload : null);
      const conversation = isRecord(source)
        ? normalizeBniConversation({ ...source, id: getId(source) || id, conversation_id: source.conversation_id ?? id }, backendChannel) ?? undefined
        : undefined;

      return {
        conversation,
        messages,
      };
    }

    if (linkedinConversationIds.has(id)) {
      return {
        conversation: undefined,
        messages: await getMessagesFromLinkedInSource(id, 1, 100),
      };
    }

    if (emailConversationIds.has(id) || id.startsWith('email:')) {
      return {
        conversation: undefined,
        messages: await getMessagesFromEmailSource(id),
      };
    }

    if (instagramConversationIds.has(id)) {
      return {
        conversation: undefined,
        messages: await getMessagesFromInstagramSource(id),
      };
    }

    const leadSourceMessages = leadSourceMessagesByConversation.get(id);
    if (leadSourceMessages) {
      return {
        conversation: undefined,
        messages: leadSourceMessages,
      };
    }

    const payload = await getWithDirectFallback(
      `/api/conversations/${id}`,
      undefined,
      (candidate) => {
        const record = isRecord(candidate) ? candidate : {};
        const source = record.conversation ?? record.data ?? record;
        return !isRecord(source) || getArrayPayload(source.messages ?? record.messages ?? [], ['messages', 'data', 'items']).length === 0;
      },
    ) as RawRecord;
    const source = payload?.conversation ?? payload?.data ?? payload;
    const messagesPayload = payload?.messages ?? source?.messages ?? payload?.data?.messages ?? payload;
    const messages = getArrayPayload(messagesPayload, ['messages', 'data', 'items'])
      .map((item) => normalizeMessage(item, id))
      .filter((message) => message.content);

    return {
      conversation: isRecord(source) && getId(source) ? normalizeConversation(source) : undefined,
      messages,
    };
  }

  async getOlderMessages(conversationId: string, page = 1, limit = 20) {
    if (!conversationId) {
      return [];
    }

    if (bniConversationIds.has(conversationId)) {
      return getMessagesFromBniSource(conversationId, page, limit);
    }

    if (linkedinConversationIds.has(conversationId)) {
      return getMessagesFromLinkedInSource(conversationId, page, limit);
    }

    if (emailConversationIds.has(conversationId) || conversationId.startsWith('email:')) {
      return getMessagesFromEmailSource(conversationId);
    }

    if (instagramConversationIds.has(conversationId)) {
      return getMessagesFromInstagramSource(conversationId, limit);
    }

    const leadSourceMessages = leadSourceMessagesByConversation.get(conversationId);
    if (leadSourceMessages) {
      return leadSourceMessages;
    }

    const payload = await getWithDirectFallback(
      '/api/messages',
      { params: { conversationId, page, limit } },
      (candidate) => getArrayPayload(candidate, ['messages', 'data', 'items']).length === 0,
    );

    const messages = getArrayPayload(payload, ['messages', 'data', 'items'])
      .map((item) => normalizeMessage(item, conversationId))
      .filter((message) => message.content);

    return messages;
  }

  async getConversationMessages(conversationId: string, params: MessagePageParams = {}) {
    return this.getOlderMessages(conversationId, params.page ?? 1, params.limit ?? 20);
  }

  async sendChannelMessage(params: SendChannelMessageParams | Record<string, unknown>) {
    const response = await apiPost('/api/chat/send-message', params);
    return response.status === 204 ? null : response.data;
  }

  async sendMessage({
    conversationId,
    message,
    content,
    currentUser,
    humanAgentId,
    role = 'user',
    type = 'text',
    mediaId,
    mediaType,
    mediaFilename,
    latitude,
    longitude,
    locationName,
    locationAddress,
  }: SendMessageParams) {
    const sender = currentUser ?? { id: humanAgentId, name: 'Agent' };
    const messageText = content ?? message;
    const payload: any = {
      conversationId,
      human_agent_id: sender.id,
      role,
      content: messageText,
      type,
      metadata: {
        tags: [],
        read_receipt: false,
        delivery_status: 'sent',
      },
      message_status: 'sent',
    };

    if (mediaId) {
      payload.mediaId = mediaId;
      payload.media_id = mediaId;
      payload.mediaType = mediaType;
      payload.media_type = mediaType;
      payload.mediaFilename = mediaFilename;
      payload.media_filename = mediaFilename;
    }
    
    if (type === 'location') {
      payload.latitude = latitude;
      payload.longitude = longitude;
      if (locationName) payload.location_name = locationName;
      if (locationAddress) payload.location_address = locationAddress;
    }

    if (bniConversationIds.has(conversationId)) {
      const bniPayload: any = {
        type: type,
        content: messageText,
        human_agent_id: sender.id,
      };

      if (mediaId) {
        bniPayload.media_id = mediaId;
        bniPayload.media_type = mediaType;
        bniPayload.media_filename = mediaFilename;
        bniPayload.url = mediaId;
      }
      
      if (type === 'location') {
        bniPayload.latitude = latitude;
        bniPayload.longitude = longitude;
        if (locationName) bniPayload.location_name = locationName;
        if (locationAddress) bniPayload.location_address = locationAddress;
      }

      const response = await bniRequest(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        bniPayload,
        { backendChannel: bniChannelByConversation.get(conversationId) },
      );
      const newMessage = (isRecord(response) ? response.data ?? response.message ?? response : response) as ApiMessage;
      const normalizedMessage = normalizeBniMessage(newMessage, conversationId);
      this.notifyMessageListeners(conversationId, newMessage);

      return normalizedMessage;
    }

    if (linkedinConversationIds.has(conversationId)) {
      const linkedinPayload: any = {
        type: type,
        content: messageText,
        human_agent_id: sender.id,
      };

      if (mediaId) {
        linkedinPayload.media_id = mediaId;
        linkedinPayload.media_type = mediaType;
        linkedinPayload.media_filename = mediaFilename;
        linkedinPayload.url = mediaId;
      }
      
      if (type === 'location') {
        linkedinPayload.latitude = latitude;
        linkedinPayload.longitude = longitude;
        if (locationName) linkedinPayload.location_name = locationName;
        if (locationAddress) linkedinPayload.location_address = locationAddress;
      }

      const response = await bniRequest(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        linkedinPayload,
        { backendChannel: 'linkedin' },
      );
      const newMessage = (isRecord(response) ? response.data ?? response.message ?? response : response) as ApiMessage;
      const normalizedMessage = normalizeLinkedInMessage(newMessage, conversationId);
      this.notifyMessageListeners(conversationId, newMessage);

      return normalizedMessage;
    }

    if (emailConversationIds.has(conversationId) || conversationId.startsWith('email:')) {
      const contactId = emailContactIdsByConversation.get(conversationId) ?? conversationId.replace(/^email:/, '');
      const provider = emailProvidersByConversation.get(conversationId) ?? 'gmail';
      const payload = await emailCommsRequest('POST', '/messages', {
        contact_id: contactId,
        direction: 'outbound',
        provider,
        subject: 'Reply',
        body_html: messageText,
        status: 'sent',
      });
      const newMessage = (isRecord(payload) ? payload.data ?? payload.message ?? payload : payload) as ApiMessage;
      return normalizeEmailMessage(newMessage, conversationId);
    }

    if (instagramConversationIds.has(conversationId)) {
      const payload = await instagramRequest('POST', `/conversations/${conversationId}/messages`, {
        text: messageText,
      });
      const newMessage = (isRecord(payload) ? payload.message ?? payload.data ?? payload : payload) as ApiMessage;
      return normalizeInstagramMessage(newMessage, conversationId);
    }

    const response = await apiPost('/api/chat', payload);
    const rawNewMessage = (response.data as RawRecord)?.message ?? response.data as ApiMessage;
    const newMessage = { ...rawNewMessage } as any;

    if (payload.mediaId && !newMessage.media_id && !newMessage.mediaId && !(newMessage.metadata?.media_id)) {
      newMessage.media_id = payload.mediaId;
      newMessage.media_type = payload.mediaType;
      newMessage.media_filename = payload.mediaFilename;
      newMessage.media_caption = payload.mediaCaption;
    }

    this.notifyMessageListeners(conversationId, newMessage);
    getSocket().emit('message:new', {
      ...newMessage,
      human_agent_id: sender.id,
      message_status: 'sent',
      delivery_status: newMessage.metadata?.delivery_status || 'sent',
      read_receipt: newMessage.metadata?.read_receipt || false,
    });

    return normalizeMessage(newMessage, conversationId);
  }

  async sendMessageWithAttachment(formData: FormData) {
    const rawChannel = String(formData.get('channel') || 'personal');
    // Normalise to backend channel — 'whatsapp' (general chat channel) falls back to 'personal'
    const channel = rawChannel === 'waba' ? 'waba' : 'personal';
    // Remove it from formData so it's not sent to the python backend if it uses a proxy that doesn't expect it inside the body
    formData.delete('channel');

    const response = await apiPost(
      '/api/whatsapp-conversations/conversations/upload-media',
      formData,
      { params: { channel } },
    );
    
    const data = response.data as any;
    const mediaId = data?.media_id || data?.url;
    const mediaType = data?.media_type || formData.get('type') || 'document';
    const filename = data?.filename || (formData.get('file') as any)?.name || 'Attachment';
    const conversationId = formData.get('conversationId') as string;

    if (!mediaId || !conversationId) {
      return response.data;
    }

    const payload: SendMessageParams = {
      conversationId,
      message: formData.get('caption') ? String(formData.get('caption')) : filename,
      content: mediaId,
      role: 'user',
      type: ['image', 'video', 'audio'].includes(mediaType) ? mediaType : 'document',
      mediaId,
      mediaType,
      mediaFilename: filename,
      mediaCaption: formData.get('caption') ? String(formData.get('caption')) : undefined,
    };

    return this.sendMessage(payload);
  }

  async markAsRead(conversationId: string) {
    // No backend has a working POST /read route — the proxy routes it to the WAPA
    // service which returns 503 for every channel. LinkedIn/email/Instagram have no
    // server-side read persistence at all, so their unread reset stays local-only
    // (same as frontend-2's legacy Redux path).
    if (
      linkedinConversationIds.has(conversationId) ||
      emailConversationIds.has(conversationId) ||
      conversationId.startsWith('email:') ||
      instagramConversationIds.has(conversationId)
    ) {
      return;
    }

    // WhatsApp (WABA/personal) conversations: fetching the conversation detail
    // resets unread_count server-side as a side effect — the same mechanism the
    // web app relies on. Don't gate this on bniConversationIds — it may not be
    // populated yet if the conversation was opened before the list finished loading.
    // Fire-and-forget: read receipts are non-critical.
    const backendChannel = await getConversationBackendChannel(conversationId);
    bniRequest('GET', `/api/conversations/${conversationId}`, undefined, { backendChannel }).catch(() => undefined);
  }

  async assignConversationHandler(conversationId: string, { handler, humanAgentId }: AssignHandlerParams) {
    const owner = handler === 'human' || handler === 'human_agent' ? 'human_agent' : 'AI';

    try {
      const response = await apiPatch(`/api/whatsapp-conversations/conversations/${conversationId}/ownership`, {
        owner,
      });

      return response.data;
    } catch {
      const response = await apiPatch(`/api/conversations/${conversationId}/handler`, {
        handler,
        humanAgentId: humanAgentId === null ? null : humanAgentId,
        human_agent_id: humanAgentId === null ? null : humanAgentId,
        owner,
      });

      return response.data;
    }
  }

  async getMindBodyPaymentLink() {
    const response = await apiGet('/api/social-integration/mindbody/payment-link');
    return normalizeMindBodyPaymentLink(response.data);
  }

  async verifyMindBodyPayment(phone: string) {
    const response = await apiGet('/api/social-integration/mindbody/verify-payment', {
      params: { phone },
    });
    return normalizeMindBodyVerification(response.data);
  }

  async sendMindBodyPaymentLinkMessage(conversationId: string, portalUrl: string, currentUser?: CurrentUser) {
    const content = buildMindBodyPaymentMessage(portalUrl);
    return this.sendMessage({
      conversationId,
      message: content,
      content,
      currentUser,
      role: 'user',
      type: 'text',
    });
  }

  async getConversationNotes(conversationId: string) {
    const backendChannel = await getConversationRouteChannel(conversationId);
    const paths = backendChannel === 'linkedin'
      ? [`/api/conversations/${conversationId}/notes`]
      : backendChannel === 'waba'
      ? [`/api/notes/conversations/${conversationId}`, `/api/conversations/${conversationId}/notes`]
      : [`/api/conversations/${conversationId}/notes`, `/api/notes/conversations/${conversationId}`];
    let lastError: unknown;

    for (const path of paths) {
      try {
        const payload = await bniRequest('GET', path, undefined, { backendChannel });
        return getArrayPayload(payload, ['data', 'notes', 'items', 'results'])
          .map((item, index) => normalizeConversationNote(item, index))
          .filter((item): item is ConversationNote => Boolean(item));
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unable to load notes.');
  }

  async createConversationNote(
    conversationId: string,
    content: string,
    options: { authorName?: string; internal?: boolean } = {},
  ) {
    const backendChannel = await getConversationRouteChannel(conversationId);
    const noteContent = options.internal ? `[Internal] ${content}` : content;
    const payload = await bniRequest(
      'POST',
      `/api/conversations/${conversationId}/notes`,
      {
        content: noteContent,
        author_name: options.authorName || 'Agent',
        ...(options.internal ? { is_internal: true, visibility: 'internal', note_type: 'internal' } : {}),
      },
      { backendChannel },
    );
    const note = getNoteFromPayload(payload);

    if (!note) {
      throw new Error('Backend did not return the created note.');
    }

    return note;
  }

  async updateConversationNote(noteId: string, content: string, options: { internal?: boolean } = {}) {
    const backendChannel = await getConversationBackendChannel();
    const noteContent = options.internal ? `[Internal] ${content}` : content;
    const payload = await bniRequest(
      'PUT',
      `/api/notes/${noteId}`,
      {
        content: noteContent,
        ...(options.internal ? { is_internal: true, visibility: 'internal', note_type: 'internal' } : {}),
      },
      { backendChannel },
    );
    const note = getNoteFromPayload(payload);

    if (!note) {
      throw new Error('Backend did not return the updated note.');
    }

    return note;
  }

  async deleteConversationNote(noteId: string) {
    const backendChannel = await getConversationBackendChannel();
    return bniRequest('DELETE', `/api/notes/${noteId}`, undefined, { backendChannel });
  }

  async getConversationTeamWorkload(conversationId?: string) {
    const backendChannel = await getConversationBackendChannel(conversationId);
    const payload = await bniRequest('GET', '/threads/team/workload', undefined, { backendChannel });
    return getArrayPayload(payload, ['data', 'members', 'users', 'items', 'results', 'workload'])
      .map((item, index) => normalizeTeamMember(item, index))
      .filter((item): item is ConversationTeamMember => Boolean(item));
  }

  async getConversationAssignment(conversationId: string) {
    const backendChannel = await getConversationBackendChannel(conversationId);

    try {
      const payload = await bniRequest('GET', `/threads/${conversationId}/assignment`, undefined, { backendChannel });
      return normalizeAssignmentHistory(payload);
    } catch (error) {
      if (error instanceof Error && /404|not found/i.test(error.message)) {
        return { current: null, history: [] };
      }

      throw error;
    }
  }

  async assignConversationToTeamMember(conversationId: string, userId: string) {
    const backendChannel = await getConversationBackendChannel(conversationId);
    const payload = await bniRequest(
      'POST',
      `/threads/${conversationId}/assign`,
      { user_id: userId },
      { backendChannel },
    );
    return normalizeAssignmentHistory(payload);
  }

  async unassignConversationFromTeamMember(conversationId: string) {
    const backendChannel = await getConversationBackendChannel(conversationId);
    const payload = await bniRequest(
      'POST',
      `/threads/${conversationId}/unassign`,
      {},
      { backendChannel },
    );
    return normalizeAssignmentHistory(payload);
  }

  getSocketStatus(): SocketStatus {
    const socket = getSocket() as { connected?: boolean; id?: string; readyState?: number };
    return {
      connected: Boolean(socket.connected),
      id: socket.id || null,
      readyState: socket.readyState || null,
      url: SOCKET_URL,
      timestamp: new Date().toISOString(),
    };
  }

  handleConversationActivity(payload: ConversationActivityPayload, currentUserId?: string) {
    const messages = Array.isArray(payload.messages)
      ? payload.messages.map((message) => normalizeMessage(message, payload.conversationId))
      : [];
    const inboundMessages = messages.filter(
      (message) => message.humanAgentId && String(message.humanAgentId) !== String(currentUserId ?? ''),
    );

    return {
      conversationId: payload.conversationId,
      messages,
      inboundMessages,
      update: {
        id: payload.conversationId,
        lastMessage: payload.lastMessage ? normalizeMessage(payload.lastMessage, payload.conversationId) : undefined,
        updatedAt: payload.updatedAt,
        unread: typeof payload.unread === 'number' ? payload.unread : undefined,
      },
    };
  }

  normalizeNotification(payload: NotificationPayload) {
    const conversationId = String(payload.conversation_id ?? payload.conversationId ?? payload.id ?? '');
    const message = payload.message ? normalizeMessage(payload.message, conversationId) : undefined;
    const notifId = message?.id || `${conversationId}_${Date.now()}`;

    return { conversationId, message, notifId };
  }

  disconnect() {
    getSocket().disconnect();
  }

  async getBroadcastGroups(): Promise<BroadcastGroup[]> {
    // Chat groups live on the WhatsApp services (waba → BNI /api/chat-groups,
    // personal → WAPA /api/whatsapp-conversations/chat-groups), mirroring
    // lad-frontend-2's chat-groups proxy — the main backend has no such route.
    const channels = await getWhatsAppBackendChannels();
    const results = await Promise.allSettled(
      channels.map(async (backendChannel) => ({
        backendChannel,
        payload: await bniRequest('GET', '/api/chat-groups', undefined, { backendChannel }),
      })),
    );

    const groups: BroadcastGroup[] = [];
    const seen = new Set<string>();

    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        console.warn('Failed to fetch broadcast groups', result.reason);
        return;
      }

      const { backendChannel, payload } = result.value;
      getArrayPayload(payload, ['data', 'groups', 'items', 'results'])
        .filter(isRecord)
        .forEach((g) => {
          const id = String(g.id ?? g._id ?? '');
          if (!id || seen.has(id)) {
            return;
          }

          seen.add(id);
          broadcastGroupChannelById.set(id, backendChannel);
          const metadata = isRecord(g.metadata) ? g.metadata : {};
          // Saved broadcast sets are groups-of-groups: mirror lad-frontend-2 and
          // surface their member_group_ids count as "N groups" instead of members.
          const isBroadcastList = Boolean(metadata.is_broadcast_list);
          const memberGroupCount = Array.isArray(metadata.member_group_ids)
            ? metadata.member_group_ids.length
            : 0;
          groups.push({
            id,
            name: String(g.name || 'Unnamed Group'),
            memberCount: Number(
              metadata.participant_count ??
                g.member_count ??
                g.memberCount ??
                g.conversation_count ??
                g.conversationCount ??
                0,
            ),
            isBroadcastList,
            memberGroupCount,
            avatar: g.avatar ? String(g.avatar) : undefined,
            color: g.color ? String(g.color) : undefined,
            description: g.description !== undefined && g.description !== null ? String(g.description) : null,
            waBackendChannel: backendChannel,
          });
        });
    });

    return groups;
  }

  private async getBroadcastGroupChannel(groupId: string) {
    return broadcastGroupChannelById.get(groupId) ?? await getWhatsAppBackendChannel();
  }

  async createBroadcastGroup(name: string, color?: string, description?: string): Promise<BroadcastGroup | null> {
    const backendChannel = await getWhatsAppBackendChannel();
    const payload = await bniRequest('POST', '/api/chat-groups', {
      name,
      color: color || '#10B981',
      description: description || null,
    }, { backendChannel });
    const record = isRecord(payload)
      ? (isRecord(payload.group) ? payload.group : isRecord(payload.data) ? payload.data : payload)
      : null;

    if (!isRecord(record) || !record.id) {
      return null;
    }

    const id = String(record.id);
    broadcastGroupChannelById.set(id, backendChannel);

    return {
      id,
      name: String(record.name ?? name),
      memberCount: Number(record.member_count ?? record.conversation_count ?? 0),
      color: record.color ? String(record.color) : color,
      description: record.description !== undefined && record.description !== null ? String(record.description) : description ?? null,
      waBackendChannel: backendChannel,
    };
  }

  async updateBroadcastGroup(groupId: string, updates: { name?: string; color?: string; description?: string | null }) {
    const backendChannel = await this.getBroadcastGroupChannel(groupId);
    return bniRequest('PUT', `/api/chat-groups/${groupId}`, updates, { backendChannel });
  }

  async deleteBroadcastGroup(groupId: string) {
    const backendChannel = await this.getBroadcastGroupChannel(groupId);
    return bniRequest('DELETE', `/api/chat-groups/${groupId}`, undefined, { backendChannel });
  }

  async addConversationsToBroadcastGroup(groupId: string, conversationIds: string[]) {
    const backendChannel = await this.getBroadcastGroupChannel(groupId);
    return bniRequest('POST', `/api/chat-groups/${groupId}/conversations`, {
      conversation_ids: conversationIds,
    }, { backendChannel });
  }

  async getBroadcastGroupMembers(groupId: string): Promise<BroadcastGroupMember[]> {
    const backendChannel = await this.getBroadcastGroupChannel(groupId);
    const payload = await bniRequest('GET', `/api/chat-groups/${groupId}/members`, undefined, { backendChannel });

    return getArrayPayload(payload, ['members', 'data', 'items', 'results'])
      .filter(isRecord)
      .map((member) => ({
        id: String(member.id ?? member._id ?? ''),
        name: member.name !== undefined && member.name !== null ? String(member.name) : null,
        phone: member.phone !== undefined && member.phone !== null ? String(member.phone) : null,
      }))
      .filter((member) => member.id);
  }

  async removeBroadcastGroupMember(groupId: string, memberId: string) {
    const backendChannel = await this.getBroadcastGroupChannel(groupId);
    return bniRequest('DELETE', `/api/chat-groups/${groupId}/members/${memberId}`, undefined, { backendChannel });
  }

  // Mirrors lad-frontend-2's handleTemplateSend: loops groups, POSTs the WABA
  // template payload with the same default batching parameters.
  async sendTemplateToBroadcastGroups(groupIds: string[], payload: BroadcastTemplateSendPayload) {
    let sent = 0;
    const errors: string[] = [];

    for (const groupId of groupIds) {
      try {
        const backendChannel = await this.getBroadcastGroupChannel(groupId);
        const response = await bniRequest('POST', `/api/chat-groups/${groupId}/send-template`, {
          template_name: payload.templateName,
          language_code: payload.languageCode || 'en',
          parameters: payload.parameters ?? [],
          name_format: payload.nameFormat ?? 'first',
          batch_size: 5,
          delay_min: 120,
          delay_random: 30,
          daily_limit: 250,
          header_param_count: 0,
          header_type: '',
          header_url: '',
        }, { backendChannel });
        sent += Number(isRecord(response) ? response.sent ?? 0 : 0) || 0;
      } catch (error) {
        errors.push(getErrorMessage(error, `Failed to send template to group ${groupId}`));
      }
    }

    return { sent, errors };
  }

  // Mirrors lad-frontend-2's bulk send: POST /api/conversations/bulk/send-template
  async sendTemplateToConversations(conversationIds: string[], payload: BroadcastTemplateSendPayload) {
    const response = await bniRequest('POST', '/api/conversations/bulk/send-template', {
      conversation_ids: conversationIds,
      template_name: payload.templateName,
      language_code: payload.languageCode || 'en',
      parameters: payload.parameters ?? [],
      name_format: payload.nameFormat ?? 'first',
      batch_size: 5,
      delay_min: 120,
      delay_random: 30,
      daily_limit: 250,
      header_param_count: 0,
      header_type: '',
      header_url: '',
    });

    return { sent: Number(isRecord(response) ? response.sent ?? conversationIds.length : conversationIds.length) };
  }

  // Mirrors lad-frontend-2's one-chat template flow. Its Next.js bulk-action
  // route ultimately forwards template sends to /bulk/send-template; calling
  // that backend route directly avoids the local proxy's /bulk 405 on web.
  // LinkedIn templates are saved snippets with optional media, so they ride
  // through the LinkedIn conversation message route.
  async sendTemplateToConversation(
    conversation: { id: string; channel?: ChatChannel; waBackendChannel?: WhatsAppBackendChannel },
    payload: BroadcastTemplateSendPayload,
  ) {
    const conversationId = conversation.id;
    if (!conversationId) {
      throw new Error('Cannot send template without a conversation ID.');
    }

    if (conversation.channel === 'linkedin') {
      const response = await bniRequest(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        {
          template_id: payload.templateId || undefined,
          templateId: payload.templateId || undefined,
          content: payload.body ?? '',
          media_url: payload.mediaUrl || undefined,
          media_type: payload.mediaType || undefined,
          media_filename: payload.mediaFilename || undefined,
        },
        { backendChannel: 'linkedin' },
      );
      const newMessage = (isRecord(response) ? response.data ?? response.message ?? response : response) as ApiMessage;
      const normalizedMessage = normalizeLinkedInMessage(newMessage, conversationId);
      this.notifyMessageListeners(conversationId, newMessage);
      return { sent: 1, message: normalizedMessage };
    }

    const backendChannel = conversation.waBackendChannel ?? await getConversationBackendChannel(conversationId);
    const templatePayload = {
      conversation_ids: [conversationId],
      template_name: payload.templateName,
      language_code: payload.languageCode || 'en',
      parameters: payload.parameters ?? [],
      name_format: payload.nameFormat ?? 'first',
      batch_size: 5,
      delay_min: 120,
      delay_random: 30,
      daily_limit: 250,
      header_param_count: payload.headerParamCount ?? 0,
      header_type: payload.headerType || '',
      header_url: payload.headerUrl || '',
    };

    const response = await bniRequest(
      'POST',
      '/api/conversations/bulk/send-template',
      templatePayload,
      { backendChannel },
    );

    if (isRecord(response)) {
      const sent = Number(response.sent ?? (response.success ? 1 : 0));
      const failed = Number(response.failed ?? 0);
      if (response.success === false || failed > 0 || sent < 1) {
        const firstResult = Array.isArray(response.results) ? response.results.find(isRecord) : undefined;
        throw new Error(String(firstResult?.error ?? response.error ?? 'Template was not sent.'));
      }
      return { sent };
    }

    return { sent: 1 };
  }

  async bulkConversationsAction(action: 'delete' | 'status' | 'labels', body: Record<string, unknown>) {
    return bniRequest('POST', `/api/conversations/bulk/${action}`, body);
  }

  // Create a label (shared labels store, same endpoint frontend-2's
  // email/whatsapp label proxies use).
  async createWhatsAppLabel(name: string, color?: string) {
    const backendChannel = await getWhatsAppBackendChannel();
    return bniRequest('POST', '/api/labels', { name, color: color || '#0078D4' }, { backendChannel });
  }

  // Real email send — mirrors lad-frontend-2's EmailComposePanel/ComposeWindow:
  // POST send-bulk on the main backend (provider google|microsoft|custom_smtp),
  // then persist the message in the WABA email thread store so it survives reloads.
  async sendEmailReply(
    conversation: { id: string; email?: string; name?: string; company?: string },
    params: { subject: string; bodyHtml: string },
  ): Promise<void> {
    if (!conversation.email) {
      throw new Error('This contact has no email address.');
    }

    const conversationId = conversation.id;
    const contactId = emailContactIdsByConversation.get(conversationId) ?? conversationId.replace(/^email:/, '');
    const provider = emailProvidersByConversation.get(conversationId) ?? 'gmail';
    const backendProvider = /outlook|microsoft/i.test(provider)
      ? 'microsoft'
      : /custom/i.test(provider)
        ? 'custom_smtp'
        : 'google';

    await apiPost('/api/social-integration/email/send-bulk', {
      provider: backendProvider,
      recipients: [{ email: conversation.email, name: conversation.name ?? '', company: conversation.company ?? '' }],
      subject: params.subject,
      body_html: params.bodyHtml,
    });

    try {
      await emailCommsRequest('POST', '/messages', {
        contact_id: contactId,
        direction: 'outbound',
        provider,
        subject: params.subject,
        body_html: params.bodyHtml,
        status: 'sent',
      });
    } catch (error) {
      // The email was sent; the thread record is best-effort.
      console.warn('Failed to record sent email in thread history', error);
    }
  }

  // Chat settings (AI inbound debounce etc.) — mirrors lad-frontend-2's
  // chat-settings proxy: waba → BNI /api/settings (GET/PATCH).
  async getWabaChatSettings(): Promise<RawRecord> {
    const payload = await bniRequest('GET', '/api/settings', undefined, { backendChannel: 'waba' });
    return isRecord(payload) ? (isRecord(payload.data) ? payload.data : payload) : {};
  }

  async updateWabaChatSettings(updates: Record<string, unknown>) {
    return bniRequest('PATCH', '/api/settings', updates, { backendChannel: 'waba' });
  }

  // Starred messages live on the WABA (Python) service — same as lad-frontend-2's
  // starred-messages proxy, which always targets the WABA service.
  async getStarredMessages(): Promise<StarredMessageRecord[]> {
    const payload = await bniRequest('GET', '/api/conversations/starred-messages', undefined, {
      backendChannel: 'waba',
    });

    return getArrayPayload(payload, ['data', 'messages', 'starred', 'items', 'results'])
      .filter(isRecord)
      .map((row) => ({
        id: String(row.id ?? row._id ?? ''),
        conversationId: String(row.conversation_id ?? row.conversationId ?? ''),
        content: String(row.content ?? row.text ?? row.body ?? ''),
        senderName: row.sender_name || row.senderName ? String(row.sender_name ?? row.senderName) : undefined,
        conversationName: row.lead_name || row.contact_name || row.conversation_name
          ? String(row.lead_name ?? row.contact_name ?? row.conversation_name)
          : undefined,
        createdAt: row.created_at || row.createdAt ? asDateString(row.created_at ?? row.createdAt) : undefined,
      }))
      .filter((row) => row.id && row.content);
  }

  async getWhatsAppLabels(): Promise<WhatsAppLabel[]> {
    // Labels are channel-routed like chat groups (waba → BNI /api/labels,
    // personal → WAPA /api/whatsapp-conversations/labels), mirroring
    // lad-frontend-2's labels proxy.
    const channels = await getWhatsAppBackendChannels();
    const results = await Promise.allSettled(
      channels.map((backendChannel) => bniRequest('GET', '/api/labels', undefined, { backendChannel })),
    );

    const labels: WhatsAppLabel[] = [];
    const seen = new Set<string>();

    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        console.warn('Failed to fetch whatsapp labels', result.reason);
        return;
      }

      getArrayPayload(result.value, ['data', 'labels', 'items', 'results'])
        .filter(isRecord)
        .forEach((l) => {
          const id = String(l.id ?? l._id ?? '');
          if (!id || seen.has(id)) {
            return;
          }

          seen.add(id);
          labels.push({
            id,
            name: String(l.name || 'Unnamed Label'),
            color: String(l.color || '#00A884'),
          });
        });
    });

    return labels;
  }

  // Message templates are stored per connected account on the channel-specific
  // microservice (waba → BNI /api/conversations/templates, personal → WAPA
  // /api/whatsapp-conversations/conversations/templates), mirroring
  // lad-frontend-2's templates proxy. The main backend 404s these, which is why
  // a direct fetch returned nothing for the connected (e.g. Frontdesk) account.
  async getWhatsAppTemplates(
    backendChannel?: WhatsAppBackendChannel,
    accountId?: string,
  ): Promise<RawRecord[]> {
    const channel = backendChannel ?? await getWhatsAppBackendChannel();
    const payload = await bniRequest('GET', '/api/conversations/templates', undefined, {
      backendChannel: channel,
      params: accountId ? { account_id: accountId } : undefined,
    });

    return getArrayPayload(payload, ['data', 'templates', 'items', 'results']).filter(isRecord);
  }
}

const chatService = new ChatService();

export const getConversations = (params?: ConversationPageParams) => chatService.getConversations(params);
export const searchConversations = (query: string) => chatService.searchConversations(query);
export const getConversation = (id: string) => chatService.getConversation(id);
export const getConversationMessages = (conversationId: string, params?: MessagePageParams) =>
  chatService.getConversationMessages(conversationId, params);
export const getOlderMessages = (conversationId: string, page?: number, limit?: number) =>
  chatService.getOlderMessages(conversationId, page, limit);
export const sendChatMessage = (payload: SendMessageParams) => chatService.sendMessage(payload);
export const sendChannelMessage = (payload: SendChannelMessageParams | Record<string, unknown>) =>
  chatService.sendChannelMessage(payload);
// ── Lead import (mirrors lad-frontend-2's /api/whatsapp-conversations/leads proxies) ──

export type ImportLeadPayload = {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  source?: string | null;
};

export type ImportLeadsResult = {
  total: number;
  imported: number;
  conversationsCreated: number;
  errors: { name: string; phone?: string; error: string }[];
  skipped: { name: string; phone?: string; reason: string }[];
  duplicates: { name: string; phone?: string; reason: string }[];
};

export const importLeads = async (
  leads: ImportLeadPayload[],
  chatGroupIds?: string[],
): Promise<ImportLeadsResult> => {
  const payload = await bniRequest('POST', '/api/leads/import', {
    leads,
    chat_group_ids: chatGroupIds && chatGroupIds.length ? chatGroupIds : null,
  });
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : (isRecord(payload) ? payload : {});
  return {
    total: Number(data.total ?? leads.length),
    imported: Number(data.imported ?? 0),
    conversationsCreated: Number(data.conversations_created ?? 0),
    errors: Array.isArray(data.errors) ? data.errors : [],
    skipped: Array.isArray(data.skipped) ? data.skipped : [],
    duplicates: Array.isArray(data.duplicates) ? data.duplicates : [],
  };
};

export type ScrapedLead = {
  name: string;
  phone: string;
  email: string;
  company: string;
  linkedin_url: string;
  instagram_url: string;
  source: string;
};

export const scrapeLeadsFromUrl = async (url: string): Promise<{ leads: ScrapedLead[]; scrapedChars: number }> => {
  const payload = await bniRequest('POST', '/api/leads/scrape', { url });
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : (isRecord(payload) ? payload : {});
  const rawLeads = Array.isArray(data.leads) ? data.leads : [];
  return {
    leads: rawLeads.filter(isRecord).map((c) => ({
      name: String(c.name ?? '').trim(),
      phone: String(c.phone ?? '').trim(),
      email: String(c.email ?? '').trim(),
      company: String(c.company ?? '').trim(),
      linkedin_url: String(c.linkedin_url ?? '').trim(),
      instagram_url: String(c.instagram_url ?? '').trim(),
      source: String(c.source ?? '').trim() || 'url_scrape',
    })),
    scrapedChars: Number(data.scraped_chars ?? 0),
  };
};

export const getBroadcastGroups = () => chatService.getBroadcastGroups();
export const createBroadcastGroup = (name: string, color?: string, description?: string) =>
  chatService.createBroadcastGroup(name, color, description);
export const updateBroadcastGroup = (groupId: string, updates: { name?: string; color?: string; description?: string | null }) =>
  chatService.updateBroadcastGroup(groupId, updates);
export const deleteBroadcastGroup = (groupId: string) => chatService.deleteBroadcastGroup(groupId);
export const addConversationsToBroadcastGroup = (groupId: string, conversationIds: string[]) =>
  chatService.addConversationsToBroadcastGroup(groupId, conversationIds);
export const getBroadcastGroupMembers = (groupId: string) => chatService.getBroadcastGroupMembers(groupId);
export const removeBroadcastGroupMember = (groupId: string, memberId: string) =>
  chatService.removeBroadcastGroupMember(groupId, memberId);
export const sendTemplateToBroadcastGroups = (groupIds: string[], payload: BroadcastTemplateSendPayload) =>
  chatService.sendTemplateToBroadcastGroups(groupIds, payload);
export const sendTemplateToConversations = (conversationIds: string[], payload: BroadcastTemplateSendPayload) =>
  chatService.sendTemplateToConversations(conversationIds, payload);
export const sendTemplateToConversation = (
  conversation: { id: string; channel?: ChatChannel; waBackendChannel?: 'waba' | 'personal' },
  payload: BroadcastTemplateSendPayload,
) => chatService.sendTemplateToConversation(conversation, payload);
export const bulkConversationsAction = (action: 'delete' | 'status' | 'labels', body: Record<string, unknown>) =>
  chatService.bulkConversationsAction(action, body);
export const getStarredMessages = () => chatService.getStarredMessages();
export const getWabaChatSettings = () => chatService.getWabaChatSettings();
export const sendEmailReply = (
  conversation: { id: string; email?: string; name?: string; company?: string },
  params: { subject: string; bodyHtml: string },
) => chatService.sendEmailReply(conversation, params);
export const updateWabaChatSettings = (updates: Record<string, unknown>) =>
  chatService.updateWabaChatSettings(updates);
export const getWhatsAppLabels = () => chatService.getWhatsAppLabels();
export const getWhatsAppTemplates = (backendChannel?: 'waba' | 'personal', accountId?: string) =>
  chatService.getWhatsAppTemplates(backendChannel, accountId);
export const createWhatsAppLabel = (name: string, color?: string) => chatService.createWhatsAppLabel(name, color);
export const sendMessageWithAttachment = (formData: FormData) => chatService.sendMessageWithAttachment(formData);
export const markConversationReadRequest = (conversationId: string) => chatService.markAsRead(conversationId);
export const assignConversationHandler = (conversationId: string, payload: AssignHandlerParams) =>
  chatService.assignConversationHandler(conversationId, payload);
export const getMindBodyPaymentLink = () => chatService.getMindBodyPaymentLink();
export const verifyMindBodyPayment = (phone: string) => chatService.verifyMindBodyPayment(phone);
export const sendMindBodyPaymentLinkMessage = (conversationId: string, portalUrl: string, currentUser?: CurrentUser) =>
  chatService.sendMindBodyPaymentLinkMessage(conversationId, portalUrl, currentUser);
export const getConversationNotes = (conversationId: string) => chatService.getConversationNotes(conversationId);
export const createConversationNote = (
  conversationId: string,
  content: string,
  options?: { authorName?: string; internal?: boolean },
) => chatService.createConversationNote(conversationId, content, options);
export const updateConversationNote = (noteId: string, content: string, options?: { internal?: boolean }) =>
  chatService.updateConversationNote(noteId, content, options);
export const deleteConversationNote = (noteId: string) => chatService.deleteConversationNote(noteId);
export const getConversationTeamWorkload = (conversationId?: string) =>
  chatService.getConversationTeamWorkload(conversationId);
export const getConversationAssignment = (conversationId: string) =>
  chatService.getConversationAssignment(conversationId);
export const assignConversationToTeamMember = (conversationId: string, userId: string) =>
  chatService.assignConversationToTeamMember(conversationId, userId);
export const unassignConversationFromTeamMember = (conversationId: string) =>
  chatService.unassignConversationFromTeamMember(conversationId);
export const uploadMessageAttachment = (formData: FormData) => chatService.sendMessageWithAttachment(formData);
export const syncConversations = (params?: ConversationPageParams) => chatService.getConversations(params);

export default chatService;


