import { apiDelete, apiGet, apiPost, apiPut } from '@/src/api';

export interface CRMLead {
  id: string | number;
  name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: string | null;
  status?: string | null;
  priority?: string | null;
  source?: string | null;
  value?: number | string | null;
  amount?: number | string | null;
  probability?: number | string | null;
  assigned_to?: string | number | null;
  assigned_to_id?: string | number | null;
  assignee?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_contacted?: string | null;
  next_followup?: string | null;
  notes?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  goals?: string[] | string | null;
  metadata?: Record<string, unknown>;
  deal_size?: number | string | null;
  expected_close_date?: string | null;
  expectedCloseDate?: string | null;
  close_date?: string | null;
  closeDate?: string | null;
  lead_score?: number | string | null;
  industry?: string | null;
  company_size?: string | null;
  website?: string | null;
  linkedin?: string | null;
  [key: string]: unknown;
}

export interface CRMStage {
  id?: string | number;
  key: string;
  label: string;
  order?: number;
  display_order?: number;
  color?: string | null;
  probability?: number | null;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface CRMStats {
  total_leads: number;
  total_value: number;
  leads_by_stage: Record<string, number>;
  value_by_stage: Record<string, number>;
  connectionsSent?: number;
  messagesSent?: number;
  contacted?: number;
  [key: string]: unknown;
}

export interface CRMReferenceOption {
  key: string;
  label: string;
  color?: string | null;
  order?: number;
  [key: string]: unknown;
}

export interface CRMNote {
  id: string | number;
  lead_id?: string | number;
  content: string;
  created_by?: string | number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CRMComment {
  id: string | number;
  lead_id?: string | number;
  content?: string;
  text?: string;
  user_name?: string | null;
  created_by?: string | number | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CRMAttachment {
  id: string | number;
  lead_id?: string | number;
  filename?: string;
  file_path?: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface CRMActivity {
  id: string | number;
  lead_id?: string | number;
  type?: string;
  description?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CRMPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
}

export interface CRMData {
  stages: CRMStage[];
  leads: CRMLead[];
  stats: CRMStats;
  statuses: CRMReferenceOption[];
  priorities: CRMReferenceOption[];
  sources: CRMReferenceOption[];
  pagination?: CRMPagination;
}

export interface CRMFilters {
  page?: number;
  limit?: number;
  search?: string;
  stage?: string;
  status?: string;
  priority?: string;
  source?: string;
  assigned_to?: string | number;
  [key: string]: string | number | null | undefined;
}

export type CreateCRMLeadParams = Partial<CRMLead>;
export type UpdateCRMLeadParams = Partial<CRMLead>;

const FALLBACK_STATUSES: CRMReferenceOption[] = [
  { key: 'new', label: 'New', color: '#2563EB' },
  { key: 'active', label: 'Active', color: '#10B981' },
  { key: 'contacted', label: 'Contacted', color: '#F59E0B' },
  { key: 'qualified', label: 'Qualified', color: '#7C3AED' },
  { key: 'closed_won', label: 'Closed Won', color: '#059669' },
  { key: 'closed_lost', label: 'Closed Lost', color: '#DC2626' },
  { key: 'on_hold', label: 'On Hold', color: '#64748B' },
];

const FALLBACK_PRIORITIES: CRMReferenceOption[] = [
  { key: 'low', label: 'Low', color: '#10B981' },
  { key: 'medium', label: 'Medium', color: '#F59E0B' },
  { key: 'high', label: 'High', color: '#EF4444' },
  { key: 'urgent', label: 'Urgent', color: '#BE123C' },
];

const FALLBACK_SOURCES: CRMReferenceOption[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'voice_agent', label: 'Voice Agent' },
  { key: 'referral', label: 'Referral' },
];

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const normalizeKey = (value: unknown, fallback: string) =>
  String(value ?? fallback).trim().toLowerCase().replace(/\s+/g, '_');

const normalizeLabel = (value: unknown, fallback: string) =>
  String(value ?? fallback).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTags = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // Fall through to comma-separated parsing.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const getArrayPayload = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;

  const root = asRecord(payload);
  const queue: Record<string, any>[] = [root];
  const seen = new WeakSet<object>();

  for (let index = 0; index < queue.length && index < 30; index += 1) {
    const record = queue[index];
    if (!record || seen.has(record)) continue;
    seen.add(record);

    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key];
    }

    for (const key of ['data', 'result', 'payload', 'response']) {
      if (Array.isArray(record[key])) return record[key];
      if (record[key] && typeof record[key] === 'object') queue.push(record[key]);
    }
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

const normalizeStage = (item: unknown, index: number): CRMStage => {
  const record = asRecord(item);
  const key = normalizeKey(record.key ?? record.id ?? record.stage, `stage_${index + 1}`);

  return {
    ...record,
    id: record.id ?? key,
    key,
    label: normalizeLabel(record.label ?? record.name ?? record.title, key),
    order: toNumber(record.order ?? record.display_order ?? record.displayOrder, index),
    display_order: toNumber(record.display_order ?? record.displayOrder ?? record.order, index),
    probability: record.probability == null ? null : toNumber(record.probability),
  };
};

const normalizeLead = (item: unknown): CRMLead => {
  const record = asRecord(item);
  const firstName = record.first_name ?? record.firstName ?? '';
  const lastName = record.last_name ?? record.lastName ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const id = record.id ?? record._id ?? record.lead_id ?? `${Date.now()}-${Math.random()}`;
  const stage = normalizeKey(record.stage ?? record.stage_key ?? record.stageKey ?? record.pipeline_stage, 'new');
  const status = normalizeKey(record.status ?? record.status_key ?? record.statusKey ?? 'new', 'new');

  return {
    ...record,
    id,
    name: record.name ?? record.contact_name ?? record.contactName ?? fullName ?? '',
    contact_name: record.contact_name ?? record.contactName ?? record.name ?? fullName ?? '',
    company_name: record.company_name ?? record.companyName ?? record.company ?? record.organization ?? '',
    company: record.company ?? record.company_name ?? record.organization ?? '',
    stage,
    status,
    priority: record.priority ? normalizeKey(record.priority, 'medium') : record.priority,
    source: record.source ? normalizeKey(record.source, 'manual') : record.source,
    value: record.value ?? record.amount ?? record.deal_size ?? null,
    amount: record.amount ?? record.value ?? record.deal_size ?? null,
    tags: normalizeTags(record.tags ?? record.lead_tags ?? record.lead_category),
  };
};

const normalizeOption = (item: unknown, index: number): CRMReferenceOption => {
  const record = asRecord(item);
  const key = normalizeKey(record.key ?? record.value ?? record.id ?? record.name, `option_${index + 1}`);
  return {
    ...record,
    key,
    label: normalizeLabel(record.label ?? record.name ?? record.title ?? record.value, key),
    order: toNumber(record.order ?? record.display_order, index),
  };
};

const normalizeStats = (payload: unknown, leads: CRMLead[]): CRMStats => {
  const statsSource = getRecordPayload(payload, ['stats']);
  const leadsByStage = asRecord(statsSource.leads_by_stage ?? statsSource.leadsByStage);
  const valueByStage = asRecord(statsSource.value_by_stage ?? statsSource.valueByStage);

  const derivedLeadsByStage = leads.reduce<Record<string, number>>((acc, lead) => {
    const key = String(lead.stage || 'new');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const derivedValueByStage = leads.reduce<Record<string, number>>((acc, lead) => {
    const key = String(lead.stage || 'new');
    acc[key] = (acc[key] || 0) + toNumber(lead.amount ?? lead.value);
    return acc;
  }, {});

  return {
    ...statsSource,
    total_leads: toNumber(statsSource.total_leads ?? statsSource.totalLeads, leads.length),
    total_value: toNumber(
      statsSource.total_value ?? statsSource.totalValue,
      leads.reduce((sum, lead) => sum + toNumber(lead.amount ?? lead.value), 0),
    ),
    leads_by_stage: Object.keys(leadsByStage).length
      ? Object.fromEntries(Object.entries(leadsByStage).map(([key, value]) => [normalizeKey(key, key), toNumber(value)]))
      : derivedLeadsByStage,
    value_by_stage: Object.keys(valueByStage).length
      ? Object.fromEntries(Object.entries(valueByStage).map(([key, value]) => [normalizeKey(key, key), toNumber(value)]))
      : derivedValueByStage,
  };
};

const normalizePagination = (payload: unknown): CRMPagination | undefined => {
  const record = getRecordPayload(payload, ['pagination', 'meta']);
  const total = record.total ?? record.total_count ?? record.count;
  if (total == null && record.page == null && record.limit == null) return undefined;

  const page = toNumber(record.page ?? record.currentPage, 1);
  const limit = toNumber(record.limit ?? record.pageSize, 50);
  const totalCount = toNumber(total, 0);

  return {
    total: totalCount,
    page,
    limit,
    totalPages: toNumber(record.totalPages ?? record.total_pages, Math.max(1, Math.ceil(totalCount / Math.max(limit, 1)))),
    hasMore: Boolean(record.hasMore ?? record.has_more ?? page * limit < totalCount),
  };
};

const sortStages = (stages: CRMStage[]) =>
  [...stages].sort((a, b) => toNumber(a.order ?? a.display_order) - toNumber(b.order ?? b.display_order));

const safe = async <T>(promise: Promise<T>, fallback: T) => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

const buildQueryParams = (filters?: CRMFilters) => {
  const params: Record<string, string | number> = {};
  if (!filters) return params;

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  });

  return params;
};

export async function getCRMStages(): Promise<CRMStage[]> {
  const response = await apiGet<unknown>('/api/deals-pipeline/stages');
  return sortStages(getArrayPayload(response.data, ['stages', 'data', 'items', 'results']).map(normalizeStage));
}

export async function createCRMStage(
  name: string,
  positionStageId: string | null = null,
  positionType: 'before' | 'after' = 'after',
) {
  const key = normalizeKey(name, 'stage').slice(0, 50);
  const stages = await safe(getCRMStages(), []);
  const maxOrder = Math.max(...stages.map((stage) => toNumber(stage.order ?? stage.display_order)), 0);
  const referenceStage = positionStageId
    ? stages.find((stage) => String(stage.id) === positionStageId || stage.key === positionStageId)
    : null;
  const referenceOrder = referenceStage ? toNumber(referenceStage.order ?? referenceStage.display_order) : maxOrder;

  const response = await apiPost<unknown>('/api/deals-pipeline/stages', {
    key,
    label: name,
    displayOrder: referenceStage
      ? positionType === 'before'
        ? referenceOrder
        : referenceOrder + 1
      : maxOrder + 1,
  });

  return normalizeStage(response.data, maxOrder + 1);
}

export async function updateCRMStage(stageKey: string, updates: Partial<CRMStage> | string) {
  const body = typeof updates === 'string' ? { label: updates } : updates;
  const response = await apiPut<unknown>(`/api/deals-pipeline/stages/${encodeURIComponent(stageKey)}`, body);
  return normalizeStage(response.data, 0);
}

export async function deleteCRMStage(stageKey: string) {
  await apiDelete(`/api/deals-pipeline/stages/${encodeURIComponent(stageKey)}`);
}

export async function reorderCRMStages(stageOrders: { key: string; order: number }[]) {
  await apiPut('/api/deals-pipeline/stages/reorder', { stageOrders });
}

export async function getCRMLeads(filters?: CRMFilters): Promise<{ leads: CRMLead[]; pagination?: CRMPagination }> {
  const response = await apiGet<unknown>('/api/deals-pipeline/leads', { params: buildQueryParams(filters) });
  return {
    leads: getArrayPayload(response.data, ['leads', 'data', 'items', 'results']).map(normalizeLead),
    pagination: normalizePagination(response.data),
  };
}

export async function getCRMLeadById(id: string | number): Promise<CRMLead> {
  const response = await apiGet<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(id))}`);
  return normalizeLead(response.data);
}

export async function createCRMLead(leadData: CreateCRMLeadParams): Promise<CRMLead> {
  const response = await apiPost<unknown>('/api/deals-pipeline/leads', leadData);
  return normalizeLead(response.data);
}

export async function updateCRMLead(id: string | number, leadData: UpdateCRMLeadParams): Promise<CRMLead> {
  const response = await apiPut<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(id))}`, leadData);
  return normalizeLead(response.data);
}

export async function deleteCRMLead(id: string | number) {
  await apiDelete(`/api/deals-pipeline/leads/${encodeURIComponent(String(id))}`);
}

export async function moveCRMLead(leadId: string | number, stageKey: string): Promise<CRMLead> {
  const response = await apiPut<unknown>(
    `/api/deals-pipeline/pipeline/leads/${encodeURIComponent(String(leadId))}/stage`,
    { stageKey, stage: stageKey },
  );
  return normalizeLead(response.data);
}

export async function updateCRMLeadStatus(leadId: string | number, status: string): Promise<CRMLead> {
  try {
    const response = await apiPut<unknown>(
      `/api/deals-pipeline/pipeline/leads/${encodeURIComponent(String(leadId))}/status`,
      { status },
    );
    return normalizeLead(response.data);
  } catch (error) {
    const response = await apiPut<unknown>(
      `/api/deals-pipeline/pipeline/leads/${encodeURIComponent(String(leadId))}/status`,
      { statusKey: status, status },
    );
    return normalizeLead(response.data);
  }
}

export async function updateCRMLeadTags(leadId: string | number, tags: string[]) {
  const response = await apiPut<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/tags`,
    { tags },
  );
  return response.data;
}

export async function assignCRMLeadsToUser(userId: string, leadIds: Array<string | number>) {
  const response = await apiPut<unknown>('/api/deals-pipeline/assign-to-user', { userId, leadIds });
  return response.data;
}

export async function getCRMPipelineData(page = 1, limit = 100): Promise<{
  stages: CRMStage[];
  leads: CRMLead[];
  pagination?: CRMPagination;
}> {
  const response = await apiGet<unknown>('/api/deals-pipeline/pipeline/board', { params: { page, limit } });
  return {
    stages: sortStages(getArrayPayload(response.data, ['stages', 'columns']).map(normalizeStage)),
    leads: getArrayPayload(response.data, ['leads', 'items', 'results']).map(normalizeLead),
    pagination: normalizePagination(response.data),
  };
}

export async function getCRMPipelineLeads(params: {
  stage?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const response = await apiGet<unknown>('/api/deals-pipeline/leads', { params: buildQueryParams(params) });
  return {
    leads: getArrayPayload(response.data, ['leads', 'data', 'items', 'results']).map(normalizeLead),
    pagination: normalizePagination(response.data),
  };
}

export async function getCRMStats(filters?: CRMFilters): Promise<CRMStats> {
  const response = await apiGet<unknown>('/api/deals-pipeline/pipeline/stats', { params: buildQueryParams(filters) });
  return normalizeStats(response.data, []);
}

export async function getCRMStatuses() {
  const response = await apiGet<unknown>('/api/deals-pipeline/reference/statuses');
  const options = getArrayPayload(response.data, ['statuses', 'data', 'items', 'results']).map(normalizeOption);
  return options.length ? options : FALLBACK_STATUSES;
}

export async function getCRMSources() {
  const response = await apiGet<unknown>('/api/deals-pipeline/reference/sources');
  const options = getArrayPayload(response.data, ['sources', 'data', 'items', 'results']).map(normalizeOption);
  return options.length ? options : FALLBACK_SOURCES;
}

export async function getCRMPriorities() {
  const response = await apiGet<unknown>('/api/deals-pipeline/reference/priorities');
  const options = getArrayPayload(response.data, ['priorities', 'data', 'items', 'results']).map(normalizeOption);
  return options.length ? options : FALLBACK_PRIORITIES;
}

export async function fetchCRMData(filters: CRMFilters = {}): Promise<CRMData> {
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 100);
  const [board, stats, statuses, priorities, sources] = await Promise.all([
    safe(getCRMPipelineData(page, limit), { stages: [], leads: [], pagination: undefined }),
    safe(getCRMStats(filters), normalizeStats({}, [])),
    safe(getCRMStatuses(), FALLBACK_STATUSES),
    safe(getCRMPriorities(), FALLBACK_PRIORITIES),
    safe(getCRMSources(), FALLBACK_SOURCES),
  ]);

  let stages = board.stages;
  if (!stages.length) stages = await safe(getCRMStages(), []);
  if (!stages.length) {
    stages = Array.from(new Set(board.leads.map((lead) => String(lead.stage || 'new'))))
      .map((stage, index) => normalizeStage({ key: stage, label: stage }, index));
  }

  return {
    stages: sortStages(stages),
    leads: board.leads,
    stats: {
      ...normalizeStats(stats, board.leads),
      ...stats,
    },
    statuses,
    priorities,
    sources,
    pagination: board.pagination,
  };
}

export async function getCRMNotes(leadId: string | number): Promise<CRMNote[]> {
  const response = await apiGet<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/notes`);
  return getArrayPayload(response.data, ['notes', 'data', 'items', 'results']).map((item, index) => {
    const record = asRecord(item);
    return {
      ...record,
      id: record.id ?? `${leadId}-note-${index}`,
      content: String(record.content ?? record.text ?? ''),
    };
  });
}

export async function addCRMNote(leadId: string | number, content: string): Promise<CRMNote> {
  const response = await apiPost<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/notes`,
    { content },
  );
  const record = asRecord(response.data);
  return { ...record, id: record.id ?? Date.now(), content: String(record.content ?? content) };
}

export async function updateCRMNote(leadId: string | number, noteId: string | number, content: string) {
  const response = await apiPut<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/notes/${encodeURIComponent(String(noteId))}`,
    { content },
  );
  return response.data;
}

export async function deleteCRMNote(leadId: string | number, noteId: string | number) {
  await apiDelete(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/notes/${encodeURIComponent(String(noteId))}`);
}

export async function getCRMComments(leadId: string | number): Promise<CRMComment[]> {
  const response = await apiGet<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/comments`);
  return getArrayPayload(response.data, ['comments', 'data', 'items', 'results']).map((item, index) => {
    const record = asRecord(item);
    return {
      ...record,
      id: record.id ?? `${leadId}-comment-${index}`,
      content: String(record.content ?? record.text ?? ''),
    };
  });
}

export async function addCRMComment(leadId: string | number, content: string): Promise<CRMComment> {
  const response = await apiPost<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/comments`,
    { text: content, content },
  );
  const record = asRecord(response.data);
  return { ...record, id: record.id ?? Date.now(), content: String(record.content ?? record.text ?? content) };
}

export async function updateCRMComment(leadId: string | number, commentId: string | number, content: string) {
  const response = await apiPut<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/comments/${encodeURIComponent(String(commentId))}`,
    { content },
  );
  return response.data;
}

export async function deleteCRMComment(leadId: string | number, commentId: string | number) {
  await apiDelete(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/comments/${encodeURIComponent(String(commentId))}`);
}

export async function getCRMActivities(leadId: string | number): Promise<CRMActivity[]> {
  const response = await apiGet<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/activities`);
  return getArrayPayload(response.data, ['activities', 'data', 'items', 'results']).map((item, index) => {
    const record = asRecord(item);
    return {
      ...record,
      id: record.id ?? `${leadId}-activity-${index}`,
      description: String(record.description ?? record.content ?? record.message ?? record.type ?? 'Activity'),
    };
  });
}

export async function getCRMAttachments(leadId: string | number): Promise<CRMAttachment[]> {
  const response = await apiGet<unknown>(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/attachments`);
  return getArrayPayload(response.data, ['attachments', 'data', 'items', 'results']).map((item, index) => {
    const record = asRecord(item);
    return {
      ...record,
      id: record.id ?? `${leadId}-attachment-${index}`,
      filename: record.filename ?? record.name ?? 'Attachment',
    };
  });
}

export async function uploadCRMAttachment(
  leadId: string | number,
  file: { uri: string; name?: string | null; mimeType?: string | null; type?: string | null } | File,
): Promise<CRMAttachment> {
  const formData = new FormData();
  if (typeof File !== 'undefined' && file instanceof File) {
    formData.append('file', file);
  } else {
    const asset = file as { uri: string; name?: string | null; mimeType?: string | null; type?: string | null };
    formData.append('file', {
      uri: asset.uri,
      name: asset.name || 'attachment',
      type: asset.mimeType || asset.type || 'application/octet-stream',
    } as unknown as Blob);
  }

  const response = await apiPost<unknown>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/attachments`,
    formData,
  );
  return asRecord(response.data) as CRMAttachment;
}

export async function deleteCRMAttachment(leadId: string | number, attachmentId: string | number) {
  await apiDelete(`/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/attachments/${encodeURIComponent(String(attachmentId))}`);
}

export async function getCRMAttachmentSignedUrl(leadId: string | number, fileUrl: string) {
  const response = await apiGet<{ signed_url?: string; signedUrl?: string; expires_in_minutes?: number }>(
    `/api/deals-pipeline/leads/${encodeURIComponent(String(leadId))}/attachments/signed-url`,
    { params: { file_url: fileUrl } },
  );
  return response.data;
}

export async function deleteCRMBookingFollowup(bookingId: string | number) {
  await apiDelete(`/api/deals-pipeline/bookings/${encodeURIComponent(String(bookingId))}/followup`);
}

export const fetchPipelineData = fetchCRMData;
export const fetchPipelineOverview = getCRMStats;
export const fetchDealsPipelineBoard = getCRMPipelineData;
export const fetchPipelineBoard = getCRMPipelineData;
export const fetchLeads = getCRMLeads;
export const updateLeadStage = moveCRMLead;
export const movePipelineLead = moveCRMLead;
export const fetchStages = getCRMStages;
export const addStage = createCRMStage;
export const fetchStatuses = getCRMStatuses;
export const fetchSources = getCRMSources;
export const fetchPriorities = getCRMPriorities;

export type PipelineLead = CRMLead;
export type PipelineStage = CRMStage;
export type PipelineStats = CRMStats;
export type PipelineData = CRMData;
