import { apiGet, apiPost } from '@/src/api';
import {
  ChatChannel,
  ConnectedIntegration,
  IntegrationChannel,
  IntegrationStatus,
  IntegrationSummary,
} from '@/src/types/chat';
import { getConversations } from '@/src/services/chat.service';

type RawRecord = Record<string, any>;

export const CHAT_SYNC_ENDPOINTS = {
  conversations: '/api/conversations',
  messages: '/api/messages',
  markRead: '/api/conversations/:id/read',
  sendMessage: '/api/chat',
  sendChannelMessage: '/api/chat/send-message',
  linkedinAccounts: '/api/campaigns/linkedin/accounts',
  googleStatus: '/api/social-integration/email/google/status',
  microsoftStatus: '/api/social-integration/email/microsoft/status',
  whatsappPersonalAccounts: '/api/personal-whatsapp/accounts',
  whatsappAIAccounts: '/api/whatsapp-conversations/admin/whatsapp-accounts',
  instagramAccounts: '/api/instagram-conversations/accounts',
  goHighLevelStatus: '/api/social-integration/gohighlevel/status',
  mindbodyStatus: '/api/social-integration/mindbody/status',
  routeMagicStatus: '/api/social-integration/routemagic/status',
  currentUser: '/api/auth/me',
} as const;

const isRecord = (value: unknown): value is RawRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const firstRecord = (payload: unknown, keys: string[]) => {
  if (!isRecord(payload)) {
    return {};
  }

  for (const key of keys) {
    if (isRecord(payload[key])) {
      return payload[key] as RawRecord;
    }
  }

  return payload;
};

const firstArray = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  const data = payload.data;
  if (isRecord(data)) {
    for (const key of keys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }

  return [];
};

const normalizeIntegrationStatus = (value: unknown): IntegrationStatus => {
  if (
    value === 'connected' ||
    value === 'connecting' ||
    value === 'checkpoint' ||
    value === 'error' ||
    value === 'unknown' ||
    value === 'disconnected'
  ) {
    return value;
  }

  if (value === 'active') {
    return 'connected';
  }

  if (value === 'stopped' || value === 'credentials_expired') {
    return 'error';
  }

  return 'unknown';
};

const blankIntegration = (
  channel: IntegrationChannel,
  label: string,
  status: IntegrationStatus = 'disconnected',
): ConnectedIntegration => ({
  channel,
  label,
  connected: status === 'connected',
  status,
});

const isFeatureUnavailableError = (error: unknown) =>
  error instanceof Error && /feature not found/i.test(error.message);

export async function getCurrentAgentSession() {
  const response = await apiGet(CHAT_SYNC_ENDPOINTS.currentUser);
  const payload = firstRecord(response.data, ['user', 'data', 'profile']);

  return {
    id: payload.id ? String(payload.id) : undefined,
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name ? String(payload.name) : undefined,
  };
}

export async function getLinkedInIntegrations(): Promise<ConnectedIntegration[]> {
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.linkedinAccounts);
    const accounts = firstArray(response.data, ['accounts', 'connections', 'data']);

    if (!accounts.length) {
      return [blankIntegration('linkedin', 'LinkedIn')];
    }

    return accounts.map((account: RawRecord, index: number) => {
      const status = normalizeIntegrationStatus(account.status ?? account.dbStatus);
      const connected = Boolean(account.connected) || status === 'connected';

      return {
        channel: 'linkedin',
        label: 'LinkedIn',
        connected,
        status: connected ? 'connected' : status,
        accountId: account.id ? String(account.id) : undefined,
        accountName: String(account.profileName ?? account.accountName ?? account.email ?? `LinkedIn ${index + 1}`),
        email: account.email ? String(account.email) : undefined,
        requiresAction: status === 'checkpoint' || status === 'error',
      };
    });
  } catch (error) {
    if (isFeatureUnavailableError(error)) {
      return [blankIntegration('linkedin', 'LinkedIn', 'unknown')];
    }

    return [{ ...blankIntegration('linkedin', 'LinkedIn', 'unknown'), error: error instanceof Error ? error.message : undefined }];
  }
}

export async function getEmailIntegrations(): Promise<ConnectedIntegration[]> {
  const [google, microsoft] = await Promise.allSettled([
    apiPost(CHAT_SYNC_ENDPOINTS.googleStatus),
    apiPost(CHAT_SYNC_ENDPOINTS.microsoftStatus),
  ]);

  const normalizeEmailProvider = (
    label: string,
    result: PromiseSettledResult<Awaited<ReturnType<typeof apiPost>>>,
  ): ConnectedIntegration => {
    if (result.status === 'rejected') {
      if (isFeatureUnavailableError(result.reason)) {
        return blankIntegration('email', label, 'unknown');
      }

      return {
        ...blankIntegration('email', label, 'unknown'),
        error: result.reason instanceof Error ? result.reason.message : undefined,
      };
    }

    const payload = isRecord(result.value.data) ? result.value.data : {};
    const connected = Boolean(payload.connected);

    return {
      channel: 'email',
      label,
      connected,
      status: connected ? 'connected' : 'disconnected',
      email: payload.email ? String(payload.email) : undefined,
    };
  };

  return [
    normalizeEmailProvider('Google/Gmail', google),
    normalizeEmailProvider('Microsoft/Outlook', microsoft),
  ];
}

export async function getWhatsAppIntegrations(): Promise<ConnectedIntegration[]> {
  const integrations: ConnectedIntegration[] = [];
  
  // WhatsApp Personal
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.whatsappPersonalAccounts);
    const accounts = firstArray(response.data, ['accounts', 'data', 'result', 'sessions']);
    const PERSONAL_CONNECTED = new Set(['connected', 'open', 'active', 'ready', 'READY', 'CONNECTED', 'authenticated', 'online']);
    const connected = accounts.some(
      (a: RawRecord) => PERSONAL_CONNECTED.has(String(a.status ?? a.state ?? '')),
    );
    integrations.push(blankIntegration('whatsapp', 'WhatsApp Personal', connected ? 'connected' : 'disconnected'));
  } catch (error) {
    integrations.push(blankIntegration('whatsapp', 'WhatsApp Personal', 'disconnected'));
  }

  // WhatsApp API Agent
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.whatsappAIAccounts);
    const accounts = firstArray(response.data, ['accounts', 'data']);
    // LAD-Frontend-2 checking: a.status === 'active' || a.status === 'connected'
    const connected = accounts.some((a: RawRecord) => a.status === 'active' || a.status === 'connected');
    integrations.push(blankIntegration('whatsapp', 'WhatsApp API Agent', connected ? 'connected' : 'disconnected'));
  } catch (error) {
    integrations.push(blankIntegration('whatsapp', 'WhatsApp API Agent', 'disconnected'));
  }

  return integrations;
}

export async function getInstagramIntegrations(): Promise<ConnectedIntegration[]> {
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.instagramAccounts);
    const accounts = firstArray(response.data, ['accounts', 'data']);
    const connected = accounts.some((a: RawRecord) => (a.status ?? 'active') !== 'inactive' && !a.is_deleted);
    return [blankIntegration('instagram', 'Instagram', connected ? 'connected' : 'disconnected')];
  } catch (error) {
    return [blankIntegration('instagram', 'Instagram', 'disconnected')];
  }
}

export async function getGoHighLevelIntegration(): Promise<ConnectedIntegration[]> {
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.goHighLevelStatus);
    const data = firstRecord(response.data, ['data']);
    const connected = Boolean(data.connected);
    return [blankIntegration('gohighlevel', 'GoHighLevel', connected ? 'connected' : 'disconnected')];
  } catch (error) {
    return [blankIntegration('gohighlevel', 'GoHighLevel', 'disconnected')];
  }
}

export async function getMindBodyIntegration(): Promise<ConnectedIntegration[]> {
  try {
    const response = await apiPost(CHAT_SYNC_ENDPOINTS.mindbodyStatus);
    const payload = isRecord(response.data) ? response.data : {};
    const connected = Boolean(payload.connected);
    return [blankIntegration('mindbody', 'MindBody', connected ? 'connected' : 'disconnected')];
  } catch (error) {
    return [blankIntegration('mindbody', 'MindBody', 'disconnected')];
  }
}

export async function getRouteMagicIntegration(): Promise<ConnectedIntegration[]> {
  try {
    const response = await apiGet(CHAT_SYNC_ENDPOINTS.routeMagicStatus);
    const payload = isRecord(response.data) ? response.data : {};
    const connected = Boolean(payload.connected);
    return [blankIntegration('routemagic', 'Route Magic', connected ? 'connected' : 'disconnected')];
  } catch (error) {
    return [blankIntegration('routemagic', 'Route Magic', 'disconnected')];
  }
}

export async function getCustomEmailIntegration(): Promise<ConnectedIntegration[]> {
  // Custom Email doesn't have a status endpoint in LAD-Frontend-2's IntegrationsSettings
  // Assuming it's disconnected by default or checked differently
  return [blankIntegration('custom-email', 'Custom Email (SMTP)', 'disconnected')];
}

export async function getSlackIntegration(): Promise<ConnectedIntegration[]> {
  // Slack is coming soon
  return [blankIntegration('slack', 'Slack', 'disconnected')];
}

export async function getConnectedIntegrations(): Promise<IntegrationSummary> {
  const session = await getCurrentAgentSession().catch(() => ({ id: undefined }));
  const [linkedin, email, whatsapp, instagram, gohighlevel, mindbody, routemagic, customEmail, slack] = await Promise.all([
    getLinkedInIntegrations(),
    getEmailIntegrations(),
    getWhatsAppIntegrations(),
    getInstagramIntegrations(),
    getGoHighLevelIntegration(),
    getMindBodyIntegration(),
    getRouteMagicIntegration(),
    getCustomEmailIntegration(),
    getSlackIntegration(),
  ]);

  return {
    userId: session.id,
    integrations: [...whatsapp, ...linkedin, ...email, ...instagram, ...gohighlevel, ...mindbody, ...routemagic, ...customEmail, ...slack],
  };
}

export async function refreshChannelConversations(channel?: ChatChannel | 'all') {
  const params = channel && channel !== 'all' ? { channel, page: 1, limit: 25 } : { page: 1, limit: 25 };
  const conversations = await getConversations(params);

  return channel && channel !== 'all'
    ? conversations.filter((conversation) => conversation.channel === channel)
    : conversations;
}
