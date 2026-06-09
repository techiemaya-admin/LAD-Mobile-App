import { apiDelete, apiGet, apiPost } from '@/src/api';

export type LifecycleStage =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'sah'
  | 'won'
  | 'lost'
  | 'archived';

export type ChannelKey =
  | 'linkedin'
  | 'whatsapp'
  | 'wapa'
  | 'email'
  | 'voice'
  | 'instagram'
  | 'intent'
  | 'system';

export type ContactType = 'prospect' | 'lead' | 'client' | 'imported' | 'inbound';

export interface ProspectState {
  id: string;
  tenant_id?: string;
  core_lead_id?: string | null;
  linkedin_url?: string | null;
  linkedin_member_urn?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  waba_wa_id?: string | null;
  instagram_handle?: string | null;
  full_name?: string | null;
  headline?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  location?: string | null;
  lifecycle_stage: LifecycleStage;
  last_channel?: ChannelKey | string | null;
  last_event_type?: string | null;
  last_event_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  channel_rollups?: Record<string, unknown>;
  sah_at?: string | null;
  sah_type?: string | null;
  sah_event_id?: string | null;
  quiet_until?: string | null;
  do_not_contact?: boolean | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  last_event_seq?: number;
  apollo_id?: string | null;
  fit_score?: number | null;
  fit_signals?: Record<string, number | boolean | null | undefined>;
  fit_source?: string | null;
  enrichment_status?: string | null;
  email_verified?: boolean;
  email_confidence?: number | null;
  phone_verified?: boolean;
  phone_confidence?: number | null;
  employment_history?: Array<Record<string, unknown>>;
  company_names?: string[];
  profile_enriched_at?: string | null;
  profile_enrichment_source?: string | null;
  network_distance?: string | null;
  mutual_connections_count?: number | null;
  connections_count?: number | null;
  work_experience_total_count?: number | null;
  experience_throttled?: boolean;
  owner_name?: string | null;
  owner_full_name?: string | null;
  assigned_to_name?: string | null;
  user_name?: string | null;
  assignee_name?: string | null;
  value?: number | null;
  amount?: number | null;
  probability?: number | null;
  next_step?: string | null;
  expected_close?: string | null;
  expected_close_date?: string | null;
  plan?: 'Enterprise' | 'Growth' | 'Starter' | string | null;
  mrr?: number | null;
  health?: number | null;
  renewal_date?: string | null;
  nps?: number | null;
  csm_name?: string | null;
  [key: string]: unknown;
}

export interface ProspectEvent {
  id?: string;
  tenant_id?: string;
  seq: number;
  prospect_id?: string;
  channel: ChannelKey | string;
  event_type: string;
  direction?: 'outbound' | 'inbound' | 'system' | null;
  external_event_id?: string | null;
  campaign_id?: string | null;
  core_lead_id?: string | null;
  channel_resource_id?: string | null;
  payload?: Record<string, unknown>;
  attributed_cost_usd?: number | null;
  occurred_at: string;
  received_at?: string;
  created_at?: string;
}

export interface ProspectFollowup {
  id: string;
  channel: string | null;
  type: string | null;
  stage: string | null;
  scheduled_time: string | null;
  attempt: number | null;
}

export interface CrmContact {
  id: string;
  type: ContactType;
  source: string;
  name: string;
  initials: string;
  title: string;
  company: string;
  industry?: string;
  geo?: string;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  channels: ChannelKey[];
  ownerName: string;
  ownerInitials: string;
  createdAt: string;
  lastActivityAt: string | null;
  fit?: number;
  intentSignals?: number;
  warmPath?: string | null;
  stage: LifecycleStage;
  value?: number;
  probability?: number;
  nextStep?: string;
  expectedClose?: string;
  plan?: string;
  mrr?: number;
  health?: number;
  renewalDate?: string;
  nps?: number;
  csmName?: string;
  raw: ProspectState;
}

export interface KanbanLead {
  id: string;
  name: string;
  company: string;
  initials: string;
  value: number;
  stageKey: LifecycleStage;
  fit: number;
  lastAt: string;
  channels: ChannelKey[];
  warmPath: string | null;
  tone: string;
  contact: CrmContact;
}

export interface ProspectCRMData {
  prospects: ProspectState[];
  contacts: CrmContact[];
  kanbanLeads: KanbanLead[];
  counts: {
    all: number;
    prospects: number;
    leads: number;
    clients: number;
  };
}

export interface SearchRunResult {
  success?: boolean;
  searchId?: string;
  search_id?: string;
  count?: number;
  candidates?: unknown[];
  backendResults?: Record<string, SearchBackendRollup>;
  backend_results?: Record<string, SearchBackendRollup>;
  totalCostUsd?: number;
  total_cost_usd?: number;
  emitErrors?: number;
  emit_errors?: number;
  error?: string;
  [key: string]: unknown;
}

export interface SearchBackendRollup {
  candidates?: number;
  total_matches?: number;
  cost_usd?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
  [key: string]: unknown;
}

export const CRM_STAGES: Array<{ key: LifecycleStage; label: string }> = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'sah', label: 'Handed off' },
];

const KNOWN_CHANNELS: readonly string[] = [
  'linkedin',
  'whatsapp',
  'wapa',
  'email',
  'voice',
  'instagram',
  'intent',
  'system',
];

const BOARD_STAGES: readonly string[] = ['new', 'contacted', 'engaged', 'qualified', 'sah'];

const STAGE_TONE: Record<string, string> = {
  new: '#475569',
  contacted: '#0ea5e9',
  engaged: '#0ea5e9',
  qualified: '#4f46e5',
  sah: '#16a34a',
};

const DEGREE_SHORT: Record<string, string> = {
  FIRST_DEGREE: '1st',
  SECOND_DEGREE: '2nd',
  THIRD_DEGREE: '3rd',
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const getArrayPayload = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key];
  }
  for (const key of ['data', 'result', 'payload']) {
    const nested = asRecord(root[key]);
    for (const nestedKey of keys) {
      if (Array.isArray(nested[nestedKey])) return nested[nestedKey];
    }
    if (Array.isArray(root[key])) return root[key];
  }
  return [];
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function initialsOf(name: string): string {
  return (
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] || '')
      .join('')
      .toUpperCase() || '?'
  );
}

function normalizeStage(value: unknown): LifecycleStage {
  const normalized = String(value || 'new').toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'handed_off') return 'sah';
  if (normalized === 'sales_accepted' || normalized === 'sales_accepted_handoff') return 'sah';
  if (CRM_STAGES.some((stage) => stage.key === normalized)) return normalized as LifecycleStage;
  if (['won', 'lost', 'archived'].includes(normalized)) return normalized as LifecycleStage;
  return 'new';
}

function displayName(prospect: ProspectState): string {
  return String(
    prospect.full_name ||
    prospect.email ||
    prospect.phone_e164 ||
    prospect.linkedin_url ||
    prospect.waba_wa_id ||
    prospect.id?.slice(0, 8) ||
    'Unknown contact',
  );
}

function channelsOf(prospect: ProspectState): ChannelKey[] {
  const keys = Object.keys(prospect.channel_rollups || {});
  const known = keys.filter((key) => KNOWN_CHANNELS.includes(key)) as ChannelKey[];
  if (known.length) return known;
  if (prospect.last_channel && KNOWN_CHANNELS.includes(String(prospect.last_channel))) {
    return [prospect.last_channel as ChannelKey];
  }
  return [];
}

function lifecycleToType(stage: LifecycleStage): ContactType {
  if (stage === 'won') return 'client';
  if (stage === 'qualified' || stage === 'sah') return 'lead';
  return 'prospect';
}

function warmLabel(prospect: ProspectState): string | null {
  const mutualCount = prospect.mutual_connections_count;
  const degree = prospect.network_distance ? DEGREE_SHORT[prospect.network_distance] || null : null;
  if (typeof mutualCount === 'number' && mutualCount > 0) {
    return degree ? `${mutualCount} mutual - ${degree}` : `${mutualCount} mutual`;
  }
  return degree;
}

function sourceLabel(prospect: ProspectState): string {
  const source = prospect.fit_source || prospect.last_channel || prospect.profile_enrichment_source || 'system';
  return String(source).replace(/_/g, ' ');
}

function ownerName(prospect: ProspectState): string {
  const nestedOwner = asRecord(prospect.owner).name || asRecord(prospect.assignee).name;
  return String(
    prospect.owner_name ||
    prospect.owner_full_name ||
    prospect.assigned_to_name ||
    prospect.user_name ||
    prospect.assignee_name ||
    nestedOwner ||
    '',
  );
}

function normalizeProspect(item: unknown): ProspectState {
  const record = asRecord(item);
  const id = String(record.id || record.prospect_id || record._id || `${Date.now()}-${Math.random()}`);
  return {
    ...record,
    id,
    lifecycle_stage: normalizeStage(record.lifecycle_stage || record.stage),
    channel_rollups: asRecord(record.channel_rollups),
    created_at: String(record.created_at || record.createdAt || record.updated_at || new Date().toISOString()),
    updated_at: String(record.updated_at || record.updatedAt || record.created_at || new Date().toISOString()),
  } as ProspectState;
}

function countIntentSignals(prospect: ProspectState) {
  const signals = prospect.intent_signals;
  if (Array.isArray(signals)) return signals.length;
  const fitSignals = asRecord(prospect.fit_signals);
  return Object.values(fitSignals).filter((value) => Number(value) > 0).length;
}

export function toCrmContact(prospect: ProspectState): CrmContact {
  const stage = normalizeStage(prospect.lifecycle_stage);
  const name = displayName(prospect);
  const owner = ownerName(prospect);
  const value = toNumber(prospect.value ?? prospect.amount, 0);
  const probability = toNumber(prospect.probability, stage === 'sah' ? 0.9 : stage === 'qualified' ? 0.55 : 0);

  return {
    id: prospect.id,
    type: lifecycleToType(stage),
    source: sourceLabel(prospect),
    name,
    initials: initialsOf(name),
    title: String(prospect.job_title || prospect.headline || ''),
    company: String(prospect.company_name || ''),
    industry: String(prospect.industry || prospect.fit_industry || ''),
    geo: prospect.location || undefined,
    email: prospect.email || null,
    emailVerified: Boolean(prospect.email_verified),
    phone: prospect.phone_e164 || null,
    phoneVerified: Boolean(prospect.phone_verified),
    channels: channelsOf(prospect),
    ownerName: owner,
    ownerInitials: owner ? initialsOf(owner) : '',
    createdAt: prospect.created_at || new Date().toISOString(),
    lastActivityAt: prospect.last_event_at || prospect.updated_at || null,
    fit: prospect.fit_score ?? undefined,
    intentSignals: countIntentSignals(prospect),
    warmPath: warmLabel(prospect),
    stage,
    value,
    probability,
    nextStep: String(prospect.next_step || ''),
    expectedClose: String(prospect.expected_close || prospect.expected_close_date || ''),
    plan: prospect.plan ? String(prospect.plan) : undefined,
    mrr: prospect.mrr == null ? undefined : toNumber(prospect.mrr),
    health: prospect.health == null ? undefined : toNumber(prospect.health),
    renewalDate: prospect.renewal_date || undefined,
    nps: prospect.nps == null ? undefined : toNumber(prospect.nps),
    csmName: prospect.csm_name || undefined,
    raw: prospect,
  };
}

export function toCrmContacts(prospects: ProspectState[]): CrmContact[] {
  return prospects.map(toCrmContact);
}

export function toKanbanLeads(prospects: ProspectState[]): KanbanLead[] {
  return prospects
    .filter((prospect) => BOARD_STAGES.includes(normalizeStage(prospect.lifecycle_stage)))
    .map((prospect) => {
      const contact = toCrmContact(prospect);
      return {
        id: contact.id,
        name: contact.name,
        company: contact.company,
        initials: contact.initials,
        value: contact.value || 0,
        stageKey: contact.stage,
        fit: contact.fit ?? 0,
        lastAt: contact.lastActivityAt || contact.createdAt,
        channels: contact.channels,
        warmPath: contact.warmPath || null,
        tone: STAGE_TONE[contact.stage] || '#0B1957',
        contact,
      };
    });
}

export function buildCounts(contacts: CrmContact[]) {
  return {
    all: contacts.length,
    prospects: contacts.filter((contact) => contact.type === 'prospect').length,
    leads: contacts.filter((contact) => contact.type === 'lead').length,
    clients: contacts.filter((contact) => contact.type === 'client').length,
  };
}

export async function listProspects(params: {
  lifecycle_stage?: LifecycleStage;
  channel?: ChannelKey;
  limit?: number;
  offset?: number;
} = {}): Promise<ProspectState[]> {
  const response = await apiGet<unknown>('/api/prospects', { params });
  return getArrayPayload(response.data, ['prospects', 'data', 'items', 'results']).map(normalizeProspect);
}

export async function getProspect(id: string): Promise<ProspectState> {
  const response = await apiGet<unknown>(`/api/prospects/${encodeURIComponent(id)}`);
  return normalizeProspect(response.data);
}

export async function listProspectEvents(id: string, params: { limit?: number; before?: string } = {}) {
  const response = await apiGet<unknown>(`/api/prospects/${encodeURIComponent(id)}/events`, { params });
  return getArrayPayload(response.data, ['events', 'data', 'items', 'results']).map((item, index) => {
    const record = asRecord(item);
    return {
      ...record,
      seq: toNumber(record.seq, index),
      channel: String(record.channel || 'system'),
      event_type: String(record.event_type || record.type || 'event'),
      direction: record.direction || 'system',
      payload: asRecord(record.payload),
      occurred_at: String(record.occurred_at || record.created_at || new Date().toISOString()),
    } as ProspectEvent;
  });
}

export async function deleteProspect(id: string, reason = 'not_a_fit') {
  const response = await apiDelete<{ id: string; deleted: boolean; reason?: string | null }>(
    `/api/prospects/${encodeURIComponent(id)}`,
    { params: { reason } },
  );
  return response.data;
}

export async function enrichProspect(id: string) {
  const response = await apiPost<unknown>(`/api/prospects/${encodeURIComponent(id)}/enrich`, {});
  return response.data;
}

export async function getProspectFollowups(id: string): Promise<ProspectFollowup[]> {
  const response = await apiGet<unknown>(`/api/prospects/${encodeURIComponent(id)}/followups`);
  const record = asRecord(response.data);
  return getArrayPayload(record.followups ?? response.data, ['followups', 'data', 'items', 'results']).map((item, index) => {
    const row = asRecord(item);
    return {
      id: String(row.id || `${id}-followup-${index}`),
      channel: row.channel == null ? null : String(row.channel),
      type: row.type == null ? null : String(row.type),
      stage: row.stage == null ? null : String(row.stage),
      scheduled_time: row.scheduled_time == null ? null : String(row.scheduled_time),
      attempt: row.attempt == null ? null : toNumber(row.attempt),
    };
  });
}

export async function prospectAction(
  id: string,
  params: { doNotContact?: boolean; quietDays?: number },
) {
  const response = await apiPost<unknown>(
    `/api/prospects/${encodeURIComponent(id)}/action`,
    {},
    {
      params: {
        do_not_contact: params.doNotContact,
        quiet_days: params.quietDays,
      },
    },
  );
  return response.data;
}

export async function runProspectSearch(input: {
  maxResults?: number;
  triggeredBy?: 'manual' | 'auto' | string;
} = {}): Promise<SearchRunResult> {
  const response = await apiPost<SearchRunResult>('/api/ai-icp-assistant/search', {
    maxResults: input.maxResults ?? 25,
    triggeredBy: input.triggeredBy ?? 'manual',
  });
  return response.data;
}

export async function fetchProspectCRMData(params: { limit?: number; offset?: number } = {}): Promise<ProspectCRMData> {
  const prospects = await listProspects({ limit: params.limit ?? 200, offset: params.offset ?? 0 });
  const contacts = toCrmContacts(prospects);
  return {
    prospects,
    contacts,
    kanbanLeads: toKanbanLeads(prospects),
    counts: buildCounts(contacts),
  };
}
