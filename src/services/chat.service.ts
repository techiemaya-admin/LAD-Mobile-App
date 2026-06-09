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

const leadSourceMessagesByConversation = new Map<string, ChatMessage[]>();
const bniMessagesByConversation = new Map<string, ChatMessage[]>();
const bniConversationIds = new Set<string>();
const linkedinConversationIds = new Set<string>();
const emailConversationIds = new Set<string>();
const instagramConversationIds = new Set<string>();
const emailContactIdsByConversation = new Map<string, string>();
const emailProvidersByConversation = new Map<string, string>();

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
const canUseDirectBackendFallback = () => Platform.OS !== 'web' && trimUrl(API_URL) !== trimUrl(RESOLVED_API_URL);

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

const bniRequest = async (
  method: string,
  path: string,
  body?: unknown,
  options?: { params?: Record<string, unknown>; backendChannel?: 'waba' | 'personal' | 'linkedin' },
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
      ? buildExternalUrl(WEB_API_URL, path, { params: { ...options?.params, channel: backendChannel } })
      : backendChannel === 'waba'
        ? buildExternalUrl(BNI_SERVICE_URL, path, options)
        : buildExternalUrl(API_URL, `/api/${backendChannel === 'linkedin' ? 'linkedin-conversations' : 'whatsapp-conversations'}${path.replace(/^\/api/, '')}`, options);

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

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: String(item.conversationId ?? item.conversation_id ?? fallbackConversationId),
    content: String(item.content ?? item.text ?? item.body ?? item.message ?? item.caption ?? ''),
    sender: rawRole === 'system' ? 'system' : isOutgoing ? 'agent' : 'lead',
    channel: normalizeBniChannel(item.channel ?? item.source ?? item.platform),
    status: normalizeStatus(item.message_status ?? item.status ?? metadata.delivery_status ?? item.delivery_status),
    createdAt: asDateString(item.created_at ?? item.createdAt ?? item.timestamp),
    humanAgentId: item.humanAgentId || item.human_agent_id || metadata.human_agent_id
      ? String(item.humanAgentId ?? item.human_agent_id ?? metadata.human_agent_id)
      : undefined,
    senderName: senderName ? String(senderName) : undefined,
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
  };
};

const normalizeBniConversation = (item: RawRecord): ChatConversation | null => {
  const id = getId(item);

  if (!id) {
    return null;
  }

  const company = item.lead_company ?? item.company ?? item.company_name ?? item.contact_company;
  const phone = item.lead_phone ?? item.phone ?? item.contact_phone;
  const email = item.lead_email ?? item.email ?? item.contact_email;
  const combinedName = [item.lead_first_name, item.lead_last_name].filter(Boolean).join(' ').trim();
  const name = [item.lead_name, item.contact_name, item.name, combinedName, phone, email]
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

  return {
    id,
    name: String(name),
    channel: normalizeBniChannel(item.lead_channel ?? item.channel ?? item.source ?? item.platform),
    lastMessage: String(lastMessage || inlineMessages[inlineMessages.length - 1]?.content || 'No messages yet'),
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
    owner: item.owner_name || item.owner ? String(item.owner_name ?? item.owner) : undefined,
    conversationState: item.context_status || item.conversation_status || item.status
      ? String(item.context_status ?? item.conversation_status ?? item.status)
      : undefined,
    messageCount: Number(item.message_count ?? item.messages_count ?? item.total_messages ?? inlineMessages.length),
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

const stripHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeEmailMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const isOutgoing = item.direction === 'outbound' || item.isOutgoing === true || item.role === 'assistant';
  const body = stripHtml(item.preview_text ?? item.body_html ?? item.body ?? item.content ?? item.message);
  const subject = String(item.subject ?? '').trim();
  const content = [subject, body].filter(Boolean).join(subject && body ? '\n' : '');

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${fallbackConversationId}-${Date.now()}-${Math.random()}`),
    conversationId: fallbackConversationId,
    content: content || 'Email message',
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

  const payload = await bniRequest('GET', '/api/conversations', undefined, { params: requestParams });
  const conversations = getArrayPayload(payload, ['data', 'conversations', 'items', 'results'])
    .filter(isRecord)
    .map((item) => normalizeBniConversation(item))
    .filter(Boolean) as ChatConversation[];

  conversations.forEach((conversation) => bniConversationIds.add(conversation.id));

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

const getConversationsFromEmailSource = async (params: ConversationPageParams = {}) => {
  const response = await apiGet('/api/email-conversations/contacts', {
    params: {
      limit: params.limit ?? 500,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  const conversations = getArrayPayload(response.data, ['data', 'contacts', 'items', 'results'])
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
  const response = await apiGet('/api/instagram-conversations/conversations', {
    params: {
      limit: params.limit ?? 100,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  const conversations = getArrayPayload(response.data, ['data', 'conversations', 'items', 'results'])
    .filter(isRecord)
    .map((item) => normalizeInstagramConversation(item))
    .filter(Boolean) as ChatConversation[];

  conversations.forEach((conversation) => instagramConversationIds.add(conversation.id));
  return filterConversations(conversations, params);
};

const getMessagesFromBniSource = async (conversationId: string, page = 1, limit = 20) => {
  const payload = await bniRequest('GET', `/api/conversations/${conversationId}/messages`, undefined, {
    params: {
      limit,
      offset: Math.max(0, page - 1) * limit,
    },
  });
  const messages = getArrayPayload(payload, ['data', 'messages', 'items', 'results'])
    .map((item) => normalizeBniMessage(item, conversationId))
    .filter((message) => message.content);

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
    .filter((message) => message.content);

  return messages;
};

const getMessagesFromEmailSource = async (conversationId: string) => {
  const contactId = emailContactIdsByConversation.get(conversationId) ?? conversationId.replace(/^email:/, '');
  const response = await apiGet('/api/email-conversations/messages', {
    params: {
      contact_id: contactId,
    },
  });
  const messages = getArrayPayload(response.data, ['messages', 'data', 'items', 'results'])
    .map((item) => normalizeEmailMessage(item, conversationId))
    .filter((message) => message.content);

  return messages;
};

const getMessagesFromInstagramSource = async (conversationId: string, limit = 500) => {
  const response = await apiGet(`/api/instagram-conversations/conversations/${conversationId}/messages`, {
    params: { limit },
  });
  const messages = getArrayPayload(response.data, ['messages', 'data', 'items', 'results'])
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
  const lastMessageRecord = isRecord(lastMessage) ? lastMessage : {};
  const name = getDisplayName(item, lead);
  const email = item.email ?? item.contact_email ?? item.lead_email ?? lead.email;
  const phone = item.phone ?? item.contact_phone ?? item.lead_phone ?? lead.phone;
  const company = item.company ?? item.company_name ?? item.contact_company ?? item.lead_company ?? lead.company ?? lead.company_name;
  const rawOwner = item.owner ?? item.conversation_owner ?? item.handler ?? item.assigned_to;
  const rawOwnerName = item.ownerName ?? item.owner_name ?? item.assigned_agent_name;
  const ownerType = /human_agent|human/i.test(String(rawOwner ?? rawOwnerName ?? ''))
    ? 'human_agent'
    : /ai|agent/i.test(String(rawOwner ?? ''))
      ? 'AI'
      : undefined;
  const ownerLabel = rawOwnerName
    ? String(rawOwnerName)
    : ownerType === 'human_agent'
      ? 'Human Agent'
      : ownerType === 'AI'
        ? 'AI'
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
    lastMessage: String(lastMessageText || 'No messages yet'),
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
    avatar: String(item.avatar ?? lead.avatar ?? lead.profileImage ?? ''),
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
  };
};

export const normalizeMessage = (item: ApiMessage | RawRecord, fallbackConversationId: string): ChatMessage => {
  const senderValue = item.sender ?? item.role ?? item.direction ?? item.from;
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  const senderRecord = isRecord(item.sender) ? item.sender : {};
  const humanAgentId = item.humanAgentId ?? item.human_agent_id;
  const senderName = item.senderName ?? item.sender_name ?? senderRecord.name;
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

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${Date.now()}-${Math.random()}`),
    conversationId: String(
      item.conversationId ?? item.conversation_id ?? item.threadId ?? item.thread_id ?? fallbackConversationId,
    ),
    content: String(item.content ?? item.text ?? item.body ?? item.message ?? ''),
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
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
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
      const cachedMessages = bniMessagesByConversation.get(id);
      const messages = cachedMessages?.length ? cachedMessages : await getMessagesFromBniSource(id, 1, 100);

      return {
        conversation: undefined,
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
  }: SendMessageParams) {
    const sender = currentUser ?? { id: humanAgentId, name: 'Agent' };
    const messageText = content ?? message;
    const payload = {
      conversationId,
      human_agent_id: sender.id,
      role,
      content: messageText,
      type: 'text',
      metadata: {
        tags: [],
        read_receipt: false,
        delivery_status: 'sent',
      },
      message_status: 'sent',
    };

    if (bniConversationIds.has(conversationId)) {
      const response = await bniRequest(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        {
          type: 'text',
          content: messageText,
          human_agent_id: sender.id,
        },
      );
      const newMessage = (isRecord(response) ? response.data ?? response.message ?? response : response) as ApiMessage;
      const normalizedMessage = normalizeBniMessage(newMessage, conversationId);
      this.notifyMessageListeners(conversationId, newMessage);

      return normalizedMessage;
    }

    if (linkedinConversationIds.has(conversationId)) {
      const response = await bniRequest(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        {
          content: messageText,
        },
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
      const response = await apiPost('/api/email-conversations/messages', {
        contact_id: contactId,
        direction: 'outbound',
        provider,
        subject: 'Reply',
        body_html: messageText,
        status: 'sent',
      });
      const newMessage = (isRecord(response.data) ? response.data.data ?? response.data.message ?? response.data : response.data) as ApiMessage;
      return normalizeEmailMessage(newMessage, conversationId);
    }

    if (instagramConversationIds.has(conversationId)) {
      const response = await apiPost(`/api/instagram-conversations/conversations/${conversationId}/messages`, {
        text: messageText,
      });
      const newMessage = (isRecord(response.data) ? response.data.message ?? response.data.data ?? response.data : response.data) as ApiMessage;
      return normalizeInstagramMessage(newMessage, conversationId);
    }

    const response = await apiPost('/api/chat', payload);
    const newMessage = (response.data as RawRecord)?.message ?? response.data as ApiMessage;

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
    const response = await apiPost('/api/messages/upload-attachment', formData);
    return response.data;
  }

  async markAsRead(conversationId: string) {
    if (bniConversationIds.has(conversationId)) {
      return bniRequest('GET', `/api/conversations/${conversationId}`);
    }

    const response = await apiPost(`/api/conversations/${conversationId}/read`, {});
    return response.data;
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
export const sendMessageWithAttachment = (formData: FormData) => chatService.sendMessageWithAttachment(formData);
export const markConversationReadRequest = (conversationId: string) => chatService.markAsRead(conversationId);
export const assignConversationHandler = (conversationId: string, payload: AssignHandlerParams) =>
  chatService.assignConversationHandler(conversationId, payload);
export const uploadMessageAttachment = (formData: FormData) => chatService.sendMessageWithAttachment(formData);
export const syncConversations = (params?: ConversationPageParams) => chatService.getConversations(params);

export default chatService;


