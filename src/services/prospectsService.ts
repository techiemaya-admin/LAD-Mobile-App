import { apiDelete, apiGet, apiPost, isApiRequestError } from '@/src/api';
import {
  deleteCRMLead,
  fetchCRMData,
  getCRMActivities,
  getCRMLeadById,
  type CRMActivity,
  type CRMLead,
} from '@/src/services/pipelineService';

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
  crm_source?: string | null;
  backend_source?: string | null;
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
  warm_path?: Record<string, unknown> | null;
  warmPath?: Record<string, unknown> | null;
  relationship_graph?: Record<string, unknown> | null;
  relationships?: Record<string, unknown> | null;
  top_connection?: Record<string, unknown> | null;
  warm_path_contact?: Record<string, unknown> | null;
  warm_path_name?: string | null;
  intro_contact_name?: string | null;
  shared_employer?: Record<string, unknown> | null;
  customer_reference?: Record<string, unknown> | null;
  account_pipeline?: Record<string, unknown> | null;
  mutual_connections?: unknown[] | number | null;
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

const shouldFallbackToDealsPipeline = (error: unknown) => {
  if (!isApiRequestError(error)) return true;
  if (error.status === 401) return false;

  const text = [
    error.message,
    typeof error.data === 'string' ? error.data : '',
    JSON.stringify(error.data ?? ''),
  ].join(' ').toLowerCase();

  return (
    [402, 403, 404, 405, 501, 503].includes(error.status) ||
    text.includes('feature') ||
    text.includes('not available') ||
    text.includes('prospect') ||
    text.includes('master agent')
  );
};

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

const getRecordPayload = (payload: unknown, keys: string[] = []) => {
  const root = asRecord(payload);
  for (const key of keys) {
    const candidate = asRecord(root[key]);
    if (Object.keys(candidate).length) return candidate;
  }
  return asRecord(root.data ?? root.result ?? root.payload ?? root);
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isPresent = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const pickValue = (...values: unknown[]) => values.find(isPresent);

const pickString = (...values: unknown[]) => {
  const value = pickValue(...values);
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const pickNumber = (...values: unknown[]) => {
  const value = pickValue(...values);
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickRecord = (...values: unknown[]) => {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length) return record;
  }
  return null;
};

const pickArray = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const parts = value.split(',').map((item) => item.trim()).filter(Boolean);
      if (parts.length) return parts;
    }
  }
  return [];
};

const pickStringArray = (...values: unknown[]) => pickArray(...values)
  .map((item) => {
    if (typeof item === 'string') return item.trim();
    const record = asRecord(item);
    return pickString(record.name, record.company, record.company_name, record.title) || '';
  })
  .filter(Boolean);

const normalizeNetworkDistance = (...values: unknown[]) => {
  const value = pickString(...values);
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
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
  return aliases[normalized] || normalized;
};

const normalizeRatio = (value: unknown) => {
  const parsed = pickNumber(value);
  if (parsed === null) return null;
  const ratio = parsed > 1 ? parsed / 100 : parsed;
  return Math.max(0, Math.min(1, ratio));
};

const withBackendSource = (item: unknown, source: string) => {
  const record = asRecord(item);
  return Object.keys(record).length
    ? { ...record, crm_source: record.crm_source ?? record.backend_source ?? source }
    : item;
};

const prefersPipelineSource = (source?: unknown) => {
  const normalized = String(source || '').toLowerCase();
  return normalized.includes('deal') || normalized.includes('pipeline') || normalized.includes('crm');
};

const prospectMatchesId = (prospect: ProspectState, id: string) => {
  const target = String(id);
  const raw = asRecord(prospect);
  const ids = [
    prospect.id,
    prospect.core_lead_id,
    raw.id,
    raw._id,
    raw.prospect_id,
    raw.prospectId,
    raw.lead_id,
    raw.leadId,
    raw.contact_id,
    raw.contactId,
    raw.core_lead_id,
  ].map((value) => String(value || '')).filter(Boolean);
  return ids.includes(target);
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

function normalizeChannel(value: unknown): ChannelKey | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const aliases: Record<string, ChannelKey> = {
    linkedin: 'linkedin',
    linked_in: 'linkedin',
    whatsapp: 'whatsapp',
    whats_app: 'whatsapp',
    waba: 'whatsapp',
    wa: 'whatsapp',
    wapa: 'wapa',
    personal_whatsapp: 'wapa',
    email: 'email',
    gmail: 'email',
    outlook: 'email',
    voice: 'voice',
    call: 'voice',
    phone: 'voice',
    instagram: 'instagram',
    ig: 'instagram',
    intent: 'intent',
    signal: 'intent',
    system: 'system',
    manual: 'system',
    deals_pipeline: 'system',
  };
  return aliases[normalized] || (KNOWN_CHANNELS.includes(normalized) ? normalized as ChannelKey : null);
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
  const known = keys.map(normalizeChannel).filter((key): key is ChannelKey => Boolean(key));
  if (known.length) return known;
  const last = normalizeChannel(prospect.last_channel);
  if (last) return [last];
  return [];
}

function lifecycleToType(stage: LifecycleStage): ContactType {
  if (stage === 'won') return 'client';
  if (stage === 'qualified' || stage === 'sah') return 'lead';
  return 'prospect';
}

function warmLabel(prospect: ProspectState): string | null {
  const mutualCount = pickNumber(prospect.mutual_connections_count);
  const distance = normalizeNetworkDistance(prospect.network_distance);
  const degree = distance ? DEGREE_SHORT[distance] || null : null;
  if (mutualCount !== null && mutualCount > 0) {
    return degree ? `${mutualCount} mutual - ${degree}` : `${mutualCount} mutual`;
  }
  return degree;
}

function sourceLabel(prospect: ProspectState): string {
  const source = prospect.source || prospect.fit_source || prospect.last_channel || prospect.profile_enrichment_source || 'system';
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
  const metadata = asRecord(record.metadata);
  const profile = asRecord(record.profile || record.person || record.contact || record.lead);
  const account = asRecord(record.account || record.organization || record.company_profile || record.company_details);
  const enrichment = asRecord(record.enrichment || record.profile_enrichment || record.enrichment_data || metadata.enrichment || metadata.profile_enrichment || profile.enrichment);
  const linkedinProfile = asRecord(
    record.linkedin_profile ||
    record.linkedinProfile ||
    record.linkedin_data ||
    record.linkedinData ||
    metadata.linkedin_profile ||
    metadata.linkedinProfile ||
    profile.linkedin_profile ||
    profile.linkedinProfile,
  );
  const firstName = pickString(record.first_name, record.firstName, profile.first_name, profile.firstName, metadata.first_name);
  const lastName = pickString(record.last_name, record.lastName, profile.last_name, profile.lastName, metadata.last_name);
  const joinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const id = String(
    pickValue(
      record.id,
      record.prospect_id,
      record.prospectId,
      record.lead_id,
      record.leadId,
      record.contact_id,
      record.contactId,
      record.core_lead_id,
      record._id,
      metadata.id,
      metadata.lead_id,
      profile.id,
    ) || `${Date.now()}-${Math.random()}`,
  );
  const fullName = pickString(
    record.full_name,
    record.fullName,
    record.name,
    record.contact_name,
    record.contactName,
    record.display_name,
    record.displayName,
    profile.full_name,
    profile.fullName,
    profile.name,
    metadata.full_name,
    metadata.name,
    joinedName,
  );
  const companyName = pickString(
    record.company_name,
    record.companyName,
    record.company,
    record.organization_name,
    record.organizationName,
    record.account_name,
    record.accountName,
    account.name,
    account.company_name,
    profile.company_name,
    profile.company,
    metadata.company_name,
    metadata.company,
  );
  const employmentHistory = pickArray(
    record.employment_history,
    record.employmentHistory,
    record.experience,
    record.experiences,
    record.work_experience,
    record.workExperience,
    profile.employment_history,
    profile.employmentHistory,
    profile.experience,
    profile.experiences,
    enrichment.employment_history,
    enrichment.employmentHistory,
    enrichment.experience,
    linkedinProfile.employment_history,
    linkedinProfile.employmentHistory,
    linkedinProfile.experience,
    metadata.employment_history,
    metadata.employmentHistory,
  ).map((item) => {
    if (typeof item === 'string') return { company: item };
    return asRecord(item);
  }).filter((item) => Object.keys(item).length);
  const companyNames = Array.from(new Set([
    ...pickStringArray(
      record.company_names,
      record.companyNames,
      record.companies,
      profile.company_names,
      profile.companyNames,
      enrichment.company_names,
      enrichment.companyNames,
      linkedinProfile.company_names,
      linkedinProfile.companyNames,
      metadata.company_names,
      metadata.companyNames,
    ),
    ...employmentHistory.map((job) => pickString(job.company, job.company_name, job.organization, job.name) || ''),
    companyName || '',
  ].map((item) => item.trim()).filter(Boolean)));
  const jobTitle = pickString(
    record.job_title,
    record.jobTitle,
    record.title,
    record.role,
    record.designation,
    profile.job_title,
    profile.title,
    metadata.job_title,
    metadata.title,
  );
  const email = pickString(record.email, record.email_address, record.emailAddress, record.contact_email, profile.email, metadata.email);
  const phone = pickString(
    record.phone_e164,
    record.phone,
    record.phone_number,
    record.phoneNumber,
    record.mobile,
    record.mobile_number,
    record.contact_phone,
    profile.phone_e164,
    profile.phone,
    metadata.phone_e164,
    metadata.phone,
  );
  const location = pickString(
    record.location,
    record.geo,
    record.city,
    record.region,
    record.country,
    record.address,
    profile.location,
    profile.city,
    metadata.location,
  );
  const lastChannel = normalizeChannel(
    pickString(record.last_channel, record.channel, record.source, record.platform, metadata.last_channel, metadata.channel, metadata.source),
  );
  const lastEventAt = pickString(
    record.last_event_at,
    record.lastEventAt,
    record.last_contacted,
    record.lastContacted,
    record.last_activity_at,
    record.lastActivityAt,
    record.updated_at,
    record.updatedAt,
    metadata.last_event_at,
  );
  const createdAt = pickString(record.created_at, record.createdAt, metadata.created_at, lastEventAt, new Date().toISOString()) as string;
  const updatedAt = pickString(record.updated_at, record.updatedAt, metadata.updated_at, lastEventAt, createdAt, new Date().toISOString()) as string;
  const rollups = asRecord(record.channel_rollups ?? record.channelRollups ?? metadata.channel_rollups);
  const mutualConnectionsValue = pickValue(
    record.mutual_connections,
    record.mutualConnections,
    record.mutuals,
    profile.mutual_connections,
    profile.mutualConnections,
    enrichment.mutual_connections,
    enrichment.mutualConnections,
    linkedinProfile.mutual_connections,
    linkedinProfile.mutualConnections,
    metadata.mutual_connections,
    metadata.mutualConnections,
  );
  const mutualConnections = pickArray(mutualConnectionsValue);
  const warmPath = pickRecord(record.warm_path, record.warmPath, profile.warm_path, profile.warmPath, enrichment.warm_path, enrichment.warmPath, metadata.warm_path, metadata.warmPath);
  const relationshipGraph = pickRecord(
    record.relationship_graph,
    record.relationshipGraph,
    record.relationships,
    profile.relationship_graph,
    profile.relationshipGraph,
    profile.relationships,
    enrichment.relationship_graph,
    enrichment.relationshipGraph,
    enrichment.relationships,
    metadata.relationship_graph,
    metadata.relationshipGraph,
    metadata.relationships,
  );
  const graphMutualConnections = pickArray(
    warmPath?.mutual_connections,
    warmPath?.mutualConnections,
    relationshipGraph?.mutual_connections,
    relationshipGraph?.mutualConnections,
  );
  const allMutualConnections = mutualConnections.length ? mutualConnections : graphMutualConnections;
  const canonicalRollups = Object.keys(rollups).length
    ? Object.entries(rollups).reduce<Record<string, unknown>>((acc, [key, value]) => {
      const channel = normalizeChannel(key) || 'system';
      acc[channel] = value;
      return acc;
    }, {})
    : lastChannel
      ? {
        [lastChannel]: {
          count: pickNumber(record.event_count, record.events_count, record.activity_count, 1) ?? 1,
          last_event_at: lastEventAt || updatedAt,
        },
      }
      : {};
  const rollupLastTouch = Object.entries(canonicalRollups)
    .map(([channel, value]) => {
      const rollup = asRecord(value);
      const eventsByType = asRecord(rollup.events_by_type ?? rollup.eventsByType);
      const count = pickNumber(rollup.count)
        ?? Object.values(eventsByType).reduce<number>((sum, item) => sum + (Number(item) || 0), 0);
      const mostCommonEventType = Object.entries(eventsByType)
        .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
      return {
        channel,
        count: count ?? 0,
        lastEventAt: pickString(rollup.last_event_at, rollup.lastEventAt, rollup.updated_at),
        lastEventType: pickString(rollup.last_event_type, rollup.lastEventType, rollup.event_type, mostCommonEventType) || null,
      };
    })
    .filter((item) => item.count > 0 || item.lastEventAt)
    .sort((a, b) => {
      const aTime = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0;
      const bTime = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0;
      return bTime - aTime;
    })[0];
  const resolvedLastChannel = normalizeChannel(rollupLastTouch?.channel) || lastChannel || null;
  const resolvedLastEventAt = rollupLastTouch?.lastEventAt || lastEventAt || updatedAt;
  const resolvedLastEventType = pickString(
    rollupLastTouch?.lastEventType,
    record.last_event_type,
    record.lastEventType,
    record.event_type,
    record.status,
    record.stage,
  ) || null;

  return {
    ...record,
    id,
    crm_source: pickString(record.crm_source, record.backend_source, record.data_source, metadata.crm_source, metadata.backend_source) || 'prospects',
    backend_source: pickString(record.backend_source, record.crm_source, record.data_source, metadata.backend_source, metadata.crm_source) || 'prospects',
    tenant_id: pickString(record.tenant_id, record.tenantId, metadata.tenant_id),
    core_lead_id: pickString(record.core_lead_id, record.coreLeadId, record.lead_id, metadata.core_lead_id) || null,
    full_name: fullName || null,
    headline: pickString(record.headline, profile.headline, jobTitle, companyName) || null,
    company_name: companyName || null,
    job_title: jobTitle || null,
    email: email || null,
    phone_e164: phone || null,
    linkedin_url: pickString(record.linkedin_url, record.linkedinUrl, record.linkedin, profile.linkedin_url, metadata.linkedin_url) || null,
    instagram_handle: pickString(record.instagram_handle, record.instagramHandle, record.instagram, metadata.instagram_handle) || null,
    location: location || null,
    lifecycle_stage: normalizeStage(record.lifecycle_stage || record.lifecycleStage || record.stage || record.status),
    last_channel: resolvedLastChannel,
    last_event_type: resolvedLastEventType,
    last_event_at: resolvedLastEventAt || null,
    channel_rollups: canonicalRollups,
    created_at: createdAt,
    updated_at: updatedAt,
    fit_score: normalizeRatio(pickValue(record.fit_score, record.fitScore, record.lead_score, record.leadScore, record.score, record.match_score, metadata.fit_score)),
    fit_signals: asRecord(record.fit_signals ?? record.fitSignals ?? metadata.fit_signals),
    fit_source: pickString(record.fit_source, record.fitSource, record.source, metadata.fit_source, metadata.source) || null,
    employment_history: employmentHistory,
    company_names: companyNames,
    profile_enriched_at: pickString(record.profile_enriched_at, record.profileEnrichedAt, enrichment.profile_enriched_at, enrichment.enriched_at, linkedinProfile.profile_enriched_at, metadata.profile_enriched_at) || null,
    profile_enrichment_source: pickString(record.profile_enrichment_source, record.profileEnrichmentSource, enrichment.source, linkedinProfile.source, metadata.profile_enrichment_source) || null,
    network_distance: normalizeNetworkDistance(
      record.network_distance,
      record.networkDistance,
      profile.network_distance,
      profile.networkDistance,
      enrichment.network_distance,
      enrichment.networkDistance,
      linkedinProfile.network_distance,
      linkedinProfile.networkDistance,
      metadata.network_distance,
      metadata.networkDistance,
      warmPath?.network_distance,
      warmPath?.networkDistance,
      relationshipGraph?.network_distance,
      relationshipGraph?.networkDistance,
    ),
    mutual_connections_count: pickNumber(
      record.mutual_connections_count,
      record.mutualConnectionsCount,
      record.mutual_count,
      record.mutualCount,
      profile.mutual_connections_count,
      profile.mutualConnectionsCount,
      enrichment.mutual_connections_count,
      enrichment.mutualConnectionsCount,
      linkedinProfile.mutual_connections_count,
      linkedinProfile.mutualConnectionsCount,
      metadata.mutual_connections_count,
      metadata.mutualConnectionsCount,
      warmPath?.mutual_connections_count,
      warmPath?.mutualConnectionsCount,
      relationshipGraph?.mutual_connections_count,
      relationshipGraph?.mutualConnectionsCount,
      allMutualConnections.length || null,
    ),
    mutual_connections: allMutualConnections.length ? allMutualConnections : mutualConnectionsValue as ProspectState['mutual_connections'],
    connections_count: pickNumber(record.connections_count, record.connectionsCount, profile.connections_count, enrichment.connections_count, linkedinProfile.connections_count, metadata.connections_count),
    work_experience_total_count: pickNumber(
      record.work_experience_total_count,
      record.workExperienceTotalCount,
      profile.work_experience_total_count,
      enrichment.work_experience_total_count,
      linkedinProfile.work_experience_total_count,
      metadata.work_experience_total_count,
      employmentHistory.length || null,
    ),
    experience_throttled: Boolean(record.experience_throttled ?? record.experienceThrottled ?? enrichment.experience_throttled ?? linkedinProfile.experience_throttled ?? metadata.experience_throttled ?? false),
    warm_path: warmPath,
    warmPath: warmPath,
    relationship_graph: relationshipGraph,
    relationships: relationshipGraph,
    top_connection: pickRecord(record.top_connection, record.topConnection, warmPath?.top_connection, warmPath?.topConnection, relationshipGraph?.top_connection, relationshipGraph?.topConnection, metadata.top_connection),
    warm_path_contact: pickRecord(record.warm_path_contact, record.warmPathContact, metadata.warm_path_contact),
    warm_path_name: pickString(record.warm_path_name, record.warmPathName, metadata.warm_path_name) || null,
    intro_contact_name: pickString(record.intro_contact_name, record.introContactName, metadata.intro_contact_name) || null,
    shared_employer: pickRecord(record.shared_employer, record.sharedEmployer, warmPath?.shared_employer, warmPath?.sharedEmployer, relationshipGraph?.shared_employer, relationshipGraph?.sharedEmployer, metadata.shared_employer),
    customer_reference: pickRecord(record.customer_reference, record.customerReference, warmPath?.customer_reference, warmPath?.customerReference, relationshipGraph?.customer_reference, relationshipGraph?.customerReference, metadata.customer_reference),
    account_pipeline: pickRecord(record.account_pipeline, record.accountPipeline, warmPath?.account_pipeline, warmPath?.accountPipeline, relationshipGraph?.account_pipeline, relationshipGraph?.accountPipeline, metadata.account_pipeline),
    owner_name: pickString(record.owner_name, record.ownerName, record.assigned_to_name, record.assignee_name, metadata.owner_name) || null,
    value: pickNumber(record.value, record.amount, record.deal_size, record.dealSize, metadata.value),
    amount: pickNumber(record.amount, record.value, record.deal_size, record.dealSize, metadata.amount),
    probability: normalizeRatio(pickValue(record.probability, record.probability_percent, record.win_probability, metadata.probability)),
    next_step: pickString(record.next_step, record.nextStep, record.next_followup, record.nextFollowup, metadata.next_step) || null,
    expected_close: pickString(record.expected_close, record.expected_close_date, record.expectedCloseDate, record.close_date, metadata.expected_close) || null,
  } as ProspectState;
}

function pipelineLeadToProspect(lead: CRMLead): ProspectState {
  const metadata = asRecord(lead.metadata);
  const id = String(lead.id);
  const source = pickString(lead.source, lead.channel, metadata.source, metadata.channel, 'deals_pipeline') as string;
  const channel = normalizeChannel(source) || 'system';
  const name = pickString(lead.name, lead.contact_name, lead.contactName, metadata.full_name, metadata.name) || '';
  const company = pickString(lead.company_name, lead.company, lead.organization, metadata.company_name, metadata.company) || '';
  const title = pickString(lead.job_title, lead.title, lead.headline, metadata.job_title, metadata.title, metadata.headline) || '';
  const updatedAt = String(lead.updated_at || lead.last_contacted || lead.created_at || new Date().toISOString());

  return normalizeProspect({
    ...metadata,
    ...lead,
    id,
    crm_source: 'deals_pipeline',
    backend_source: 'deals_pipeline',
    core_lead_id: id,
    full_name: name,
    company_name: company,
    job_title: title,
    headline: title || company,
    email: pickString(lead.email, lead.email_address, lead.contact_email, metadata.email) || null,
    phone_e164: pickString(lead.phone, lead.phone_e164, lead.phone_number, lead.mobile, lead.contact_phone, metadata.phone_e164, metadata.phone) || null,
    lifecycle_stage: lead.stage || lead.status || 'new',
    last_channel: channel,
    channel_rollups: {
      [channel]: {
        source: lead.source || 'deals_pipeline',
        count: pickNumber(lead.activity_count, lead.event_count, metadata.activity_count, metadata.event_count, 1) ?? 1,
        last_event_at: updatedAt,
      },
    },
    fit_score: normalizeRatio(pickValue(lead.lead_score, lead.score, lead.fit_score, metadata.fit_score, metadata.lead_score)),
    fit_source: lead.source || 'deals_pipeline',
    owner_name: lead.assignee_name || lead.owner_name || lead.assigned_to_name || metadata.owner_name || '',
    value: lead.value ?? lead.amount ?? lead.deal_size ?? metadata.value ?? 0,
    amount: lead.amount ?? lead.value ?? lead.deal_size ?? metadata.amount ?? 0,
    probability: normalizeRatio(pickValue(lead.probability, metadata.probability)),
    next_step: lead.next_followup || metadata.next_step || '',
    expected_close: lead.expected_close_date || lead.expectedCloseDate || lead.close_date || lead.closeDate || '',
    last_event_type: lead.status || lead.stage || 'pipeline_update',
    last_event_at: updatedAt,
    created_at: String(lead.created_at || updatedAt),
    updated_at: updatedAt,
    profile_enrichment_source: 'deals_pipeline',
  });
}

function pipelineActivityToProspectEvent(activity: CRMActivity, index: number): ProspectEvent {
  const record = asRecord(activity);
  const metadata = asRecord(record.metadata ?? record.payload);
  const description = pickString(record.description, record.content, record.message, record.notes);
  return {
    ...record,
    id: String(record.id || `pipeline-event-${index}`),
    seq: toNumber(record.seq, index),
    prospect_id: record.lead_id == null ? undefined : String(record.lead_id),
    channel: String(record.channel || record.source || 'system'),
    event_type: String(record.type || record.event_type || 'pipeline_activity'),
    direction: record.direction || 'system',
    payload: {
      ...metadata,
      preview: pickString(metadata.preview, metadata.subject, metadata.message, description),
      description,
    },
    occurred_at: String(record.created_at || record.occurred_at || new Date().toISOString()),
  } as ProspectEvent;
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
  try {
    const response = await apiGet<unknown>('/api/prospects', { params });
    return getArrayPayload(response.data, ['prospects', 'data', 'items', 'results'])
      .map((item) => normalizeProspect(withBackendSource(item, 'prospects')));
  } catch (error) {
    if (!shouldFallbackToDealsPipeline(error)) throw error;
    const crmData = await fetchCRMData({ page: 1, limit: params.limit ?? 200 });
    const contacts = params.lifecycle_stage
      ? crmData.leads.filter((lead) => normalizeStage(lead.stage || lead.status) === params.lifecycle_stage)
      : crmData.leads;
    return contacts.map(pipelineLeadToProspect);
  }
}

export async function getProspect(
  id: string,
  options: { source?: string | null; snapshot?: ProspectState | null } = {},
): Promise<ProspectState> {
  const loadPipeline = async () => pipelineLeadToProspect(await getCRMLeadById(id));
  const loadExactFromList = async () => {
    const rows = await listProspects({ limit: 500 }).catch(() => []);
    return rows.find((row) => prospectMatchesId(row, id)) || null;
  };

  if (prefersPipelineSource(options.source ?? options.snapshot?.crm_source ?? options.snapshot?.backend_source)) {
    try {
      return await loadPipeline();
    } catch {
      // Fall through to the prospects endpoint if the lead endpoint cannot resolve this ID.
    }
  }

  try {
    const response = await apiGet<unknown>(`/api/prospects/${encodeURIComponent(id)}`);
    const prospect = normalizeProspect(withBackendSource(getRecordPayload(response.data, ['prospect', 'contact', 'lead', 'item', 'record']), 'prospects'));
    if (prospectMatchesId(prospect, id)) {
      return prospect;
    }

    try {
      return await loadPipeline();
    } catch {
      const listed = await loadExactFromList();
      if (listed) return listed;
      if (options.snapshot && prospectMatchesId(options.snapshot, id)) return normalizeProspect(options.snapshot);
      throw new Error('The backend returned a different CRM record for this profile. Refresh CRM and open the profile again.');
    }
  } catch (error) {
    if (!shouldFallbackToDealsPipeline(error)) throw error;
    try {
      return await loadPipeline();
    } catch {
      const listed = await loadExactFromList();
      if (listed) return listed;
      if (options.snapshot && prospectMatchesId(options.snapshot, id)) return normalizeProspect(options.snapshot);
      throw error;
    }
  }
}

export async function listProspectEvents(
  id: string,
  params: { limit?: number; before?: string; source?: string | null } = {},
) {
  if (prefersPipelineSource(params.source)) {
    const activities = await getCRMActivities(id).catch(() => []);
    return activities.slice(0, params.limit ?? activities.length).map(pipelineActivityToProspectEvent);
  }

  try {
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
  } catch (error) {
    if (!shouldFallbackToDealsPipeline(error)) throw error;
    const activities = await getCRMActivities(id).catch(() => []);
    return activities.slice(0, params.limit ?? activities.length).map(pipelineActivityToProspectEvent);
  }
}

export async function deleteProspect(id: string, reason = 'not_a_fit') {
  try {
    const response = await apiDelete<{ id: string; deleted: boolean; reason?: string | null }>(
      `/api/prospects/${encodeURIComponent(id)}`,
      { params: { reason } },
    );
    return response.data;
  } catch (error) {
    if (!shouldFallbackToDealsPipeline(error)) throw error;
    await deleteCRMLead(id);
    return { id, deleted: true, reason };
  }
}

export async function enrichProspect(id: string) {
  try {
    const response = await apiPost<unknown>(`/api/prospects/${encodeURIComponent(id)}/enrich`, {});
    return response.data;
  } catch (error) {
    const serviceToken = process.env.LAD_MASTER_AGENT_SERVICE_TOKEN;
    const tenantId = process.env.DEV_TENANT_OVERRIDE;
    if (!serviceToken || !tenantId) throw error;

    const response = await apiPost<unknown>(
      `/api/ai-icp-assistant/prospects/${encodeURIComponent(id)}/enrich-profile`,
      { tenant_id: tenantId },
      { headers: { 'X-Service-Token': serviceToken } },
    );
    return response.data;
  }
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
