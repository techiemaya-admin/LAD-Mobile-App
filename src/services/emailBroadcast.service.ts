/**
 * LAD-Email-Comms client — powers the Gmail/Outlook email-client surfaces
 * (broadcast groups sidebar, Sent folder, compose-to-group), mirroring
 * lad-frontend-2's /api/email-comms proxies + useEmailBroadcast hooks.
 *
 * Web: requests go through the local auth-proxy at /api/email-comms/* which
 * rewrites to the service's /api/email-broadcast/*.
 * Native: requests hit the service directly with JWT + X-Tenant-ID headers.
 */
import { Platform } from 'react-native';
import { WEB_API_URL, getAuthToken } from '@/src/api';
import { getActiveTenantId } from '@/src/api/storage';

const EMAIL_COMMS_URL = (
  process.env.EXPO_PUBLIC_EMAIL_COMMS_URL ||
  process.env.NEXT_PUBLIC_EMAIL_COMMS_URL ||
  'https://lad-email-comms-develop-asia-160078175457.asia-south1.run.app'
).replace(/\/+$/, '');

type RawRecord = Record<string, any>;

export type EmailBroadcastChannel = 'gmail' | 'outlook';

export type EmailBroadcastGroup = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  channel: EmailBroadcastChannel;
  memberCount: number;
};

export type EmailBroadcastGroupMember = {
  id: string;
  email: string;
  contactName: string | null;
  company: string | null;
};

export type EmailBroadcastGroupDetail = EmailBroadcastGroup & {
  members: EmailBroadcastGroupMember[];
};

export type EmailBroadcastRun = {
  id: string;
  fromEmail: string;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string | null;
};

export type EmailBroadcastRunDetail = EmailBroadcastRun & {
  bodyHtml: string;
  bodyText: string | null;
  errorMessage: string | null;
};

export type ConnectedEmailAccount = {
  id: string;
  provider: 'google' | 'microsoft' | 'custom_smtp';
  email: string;
  displayName: string | null;
  status: string;
};

export type EmailBroadcastRecipient = {
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

const request = async (
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
) => {
  const token = await getAuthToken();
  const tenantId = await getActiveTenantId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const base = Platform.OS === 'web' && WEB_API_URL
    ? `${WEB_API_URL.replace(/\/+$/, '')}/api/email-comms${path}`
    : `${EMAIL_COMMS_URL}/api/email-broadcast${path.replace(/^\/broadcast\//, '/')}`;
  const url = new URL(base);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && ('detail' in payload || 'error' in payload || 'message' in payload)
        ? String((payload as RawRecord).detail ?? (payload as RawRecord).error ?? (payload as RawRecord).message)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

const normalizeGroup = (row: RawRecord): EmailBroadcastGroup => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? 'Unnamed group'),
  color: String(row.color ?? '#0078D4'),
  description: row.description !== undefined && row.description !== null ? String(row.description) : null,
  channel: row.channel === 'outlook' ? 'outlook' : 'gmail',
  memberCount: Number(row.member_count ?? row.memberCount ?? 0),
});

const normalizeRun = (row: RawRecord): EmailBroadcastRun => ({
  id: String(row.id ?? ''),
  fromEmail: String(row.from_email ?? row.fromEmail ?? ''),
  subject: String(row.subject ?? '(no subject)'),
  status: String(row.status ?? 'queued'),
  recipientCount: Number(row.recipient_count ?? 0),
  sentCount: Number(row.sent_count ?? 0),
  failedCount: Number(row.failed_count ?? 0),
  createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  completedAt: row.completed_at ? String(row.completed_at) : null,
});

export async function getEmailBroadcastGroups(channel: EmailBroadcastChannel): Promise<EmailBroadcastGroup[]> {
  try {
    const payload = await request('GET', '/groups', undefined, { channel });
    const rows: RawRecord[] = Array.isArray((payload as RawRecord)?.groups)
      ? (payload as RawRecord).groups
      : Array.isArray(payload)
        ? (payload as RawRecord[])
        : [];
    return rows.map(normalizeGroup).filter((group) => group.id);
  } catch {
    return [];
  }
}

export async function getEmailBroadcastGroup(groupId: string): Promise<EmailBroadcastGroupDetail> {
  const payload = (await request('GET', `/groups/${encodeURIComponent(groupId)}`)) as RawRecord;
  const membersData: RawRecord[] = Array.isArray(payload?.members) ? payload.members : [];
  
  return {
    ...normalizeGroup(payload ?? {}),
    members: membersData.map((m) => ({
      id: String(m.contact_id || m.id || ''),
      email: String(m.email || ''),
      contactName: m.contact_name || m.name || null,
      company: m.company || null,
    })).filter((m) => m.id),
  };
}

export async function createEmailBroadcastGroup(body: {
  name: string;
  channel: EmailBroadcastChannel;
  color?: string;
  description?: string | null;
}) {
  return request('POST', '/groups', body);
}

export async function deleteEmailBroadcastGroup(groupId: string) {
  return request('DELETE', `/groups/${encodeURIComponent(groupId)}`);
}

export async function getEmailBroadcastRuns(limit = 50, offset = 0): Promise<EmailBroadcastRun[]> {
  try {
    const payload = await request('GET', '/broadcast/runs', undefined, { limit, offset });
    const rows: RawRecord[] = Array.isArray((payload as RawRecord)?.runs)
      ? (payload as RawRecord).runs
      : Array.isArray(payload)
        ? (payload as RawRecord[])
        : [];
    return rows.map(normalizeRun).filter((run) => run.id);
  } catch {
    return [];
  }
}

export async function getEmailBroadcastRun(runId: string): Promise<EmailBroadcastRunDetail> {
  const payload = (await request('GET', `/broadcast/runs/${encodeURIComponent(runId)}`)) as RawRecord;
  return {
    ...normalizeRun(payload ?? {}),
    bodyHtml: String(payload?.body_html ?? ''),
    bodyText: payload?.body_text !== undefined && payload?.body_text !== null ? String(payload.body_text) : null,
    errorMessage: payload?.error_message ? String(payload.error_message) : null,
  };
}

export async function getConnectedEmailAccounts(): Promise<ConnectedEmailAccount[]> {
  try {
    const payload = (await request('GET', '/accounts')) as RawRecord;
    const rows: RawRecord[] = Array.isArray(payload?.accounts) ? payload.accounts : [];
    return rows.map((row) => ({
      id: String(row.id ?? ''),
      provider: row.provider === 'microsoft' ? 'microsoft' : row.provider === 'custom_smtp' ? 'custom_smtp' : 'google',
      email: String(row.email ?? ''),
      displayName: row.display_name !== undefined && row.display_name !== null ? String(row.display_name) : null,
      status: String(row.status ?? 'active'),
    }));
  } catch {
    return [];
  }
}

export async function sendEmailBroadcast(body: {
  fromEmailAccountId: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  templateId?: string | null;
  groupId?: string;
  recipients?: EmailBroadcastRecipient[];
}) {
  return request('POST', '/broadcast/send', {
    from_email_account_id: body.fromEmailAccountId,
    subject: body.subject,
    body_html: body.bodyHtml,
    ...(body.bodyText !== undefined ? { body_text: body.bodyText } : {}),
    ...(body.templateId ? { template_id: body.templateId } : {}),
    ...(body.groupId ? { group_id: body.groupId } : {}),
    ...(body.recipients?.length ? { recipients: body.recipients } : {}),
  });
}

export async function sendEmailBroadcastToGroup(body: {
  fromEmailAccountId: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  templateId?: string | null;
  groupId: string;
}) {
  return sendEmailBroadcast({
    fromEmailAccountId: body.fromEmailAccountId,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    bodyText: body.bodyText,
    templateId: body.templateId,
    groupId: body.groupId,
  });
}
