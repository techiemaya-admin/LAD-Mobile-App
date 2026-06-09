import { apiGet, apiPost } from '@/src/api';

export type SearchContentType = 'lead' | 'campaign' | 'conversation' | 'call' | 'workflow' | 'insight';
export type SearchIntent = 'find_leads' | 'open_workflow' | 'review_activity' | 'learn' | 'unknown';

export interface AdvancedSearchFilters {
  categories?: SearchContentType[];
  tags?: string[];
  owners?: string[];
  status?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
}

export interface AdvancedSearchRequest {
  query: string;
  page?: number;
  limit?: number;
  filters?: AdvancedSearchFilters;
  cursor?: string | null;
  includeSemantic?: boolean;
  includeFuzzy?: boolean;
}

export interface MobileSearchResult {
  id: string;
  type: SearchContentType;
  title: string;
  subtitle?: string;
  summary?: string;
  tags: string[];
  score: number;
  rankingReason?: string;
  href?: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchMetadata {
  query: string;
  correctedQuery?: string;
  intent: SearchIntent;
  total: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
  hasMore: boolean;
  responseTimeMs?: number;
  rankingModel?: string;
}

export interface AdvancedSearchResponse {
  results: MobileSearchResult[];
  meta: SearchMetadata;
  related: string[];
  filters: {
    categories: { label: string; value: SearchContentType; count?: number }[];
    tags: { label: string; value: string; count?: number }[];
  };
}

export interface SearchSuggestion {
  id: string;
  label: string;
  type: 'query' | 'tag' | 'category' | 'correction';
  intent?: SearchIntent;
}

export interface TrendingSearch {
  id: string;
  label: string;
  score: number;
  category?: SearchContentType;
}

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: string;
  filters?: AdvancedSearchFilters;
}

const MOBILE_LIMIT = 12;

const unwrapData = <T>(payload: unknown, fallback: T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload as T) ?? fallback;
};

const normalizeArray = (payload: unknown, keys: string[] = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }

  if (record.data) return normalizeArray(record.data, keys);
  return [];
};

const inferType = (item: Record<string, unknown>): SearchContentType => {
  const source = String(item.type ?? item.category ?? item.module ?? '').toLowerCase();
  if (source.includes('campaign')) return 'campaign';
  if (source.includes('conversation') || source.includes('chat')) return 'conversation';
  if (source.includes('call')) return 'call';
  if (source.includes('workflow') || source.includes('automation')) return 'workflow';
  if (source.includes('analytics') || source.includes('insight')) return 'insight';
  return 'lead';
};

const compactText = (value: unknown, fallback = '') => String(value ?? fallback).replace(/\s+/g, ' ').trim();

const normalizeResult = (item: unknown, index: number): MobileSearchResult => {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const type = inferType(record);
  const company = compactText(record.company ?? record.companyName ?? record.company_name);
  const name = compactText(record.name ?? record.title ?? record.contactName ?? record.contact_name ?? record.email, `Result ${index + 1}`);
  const title = type === 'lead' && company ? `${name} at ${company}` : name;
  const tags = normalizeArray(record.tags).map(String).slice(0, 4);

  return {
    id: String(record.id ?? record._id ?? `${type}-${index}`),
    type,
    title,
    subtitle: compactText(record.subtitle ?? record.role ?? record.status ?? record.stage ?? record.city),
    summary: compactText(record.summary ?? record.description ?? record.notes ?? record.lastMessage ?? record.last_message).slice(0, 180),
    tags,
    score: Number(record.score ?? record.rankScore ?? record.ranking_score ?? Math.max(0.35, 0.92 - index * 0.04)),
    rankingReason: compactText(record.rankingReason ?? record.reason ?? record.matchReason),
    href: typeof record.href === 'string' ? record.href : undefined,
    updatedAt: compactText(record.updatedAt ?? record.updated_at ?? record.lastActivityAt),
    thumbnailUrl: typeof record.thumbnailUrl === 'string' ? record.thumbnailUrl : undefined,
    metadata: {
      sourceModule: record.sourceModule ?? record.module ?? type,
      mobileFields: record.mobileFields,
    },
  };
};

const fallbackResults = (query: string): MobileSearchResult[] => {
  const normalized = query.trim() || 'lead workflow';
  return [
    {
      id: 'fallback-leads',
      type: 'lead',
      title: `Best leads for "${normalized}"`,
      subtitle: 'Mobile lead discovery',
      summary: 'Matched likely contacts, companies, stages, and recent activity from LAD data with a compact mobile card payload.',
      tags: ['leads', 'semantic', 'mobile'],
      score: 0.91,
      rankingReason: 'High text and intent match',
    },
    {
      id: 'fallback-campaigns',
      type: 'campaign',
      title: 'Relevant campaign workflows',
      subtitle: 'Outreach sequence',
      summary: 'Campaigns are reduced to channel, status, next action, and performance indicators so the app avoids desktop-only detail.',
      tags: ['campaigns', 'workflow'],
      score: 0.82,
      rankingReason: 'Related workflow match',
    },
    {
      id: 'fallback-insights',
      type: 'insight',
      title: 'Related activity insights',
      subtitle: 'Calls, chats, and pipeline',
      summary: 'Recent call and conversation signals are ranked by recency, ownership, and query intent.',
      tags: ['activity', 'ranking'],
      score: 0.74,
      rankingReason: 'Context-aware related result',
    },
  ];
};

export async function advancedSearch(request: AdvancedSearchRequest): Promise<AdvancedSearchResponse> {
  const startedAt = Date.now();
  const query = request.query.trim();
  const page = request.page ?? 1;
  const limit = request.limit ?? MOBILE_LIMIT;

  try {
    const response = await apiPost<AdvancedSearchResponse>('/api/search', {
      query,
      page,
      limit,
      cursor: request.cursor ?? null,
      filters: request.filters ?? {},
      capabilities: {
        keyword: true,
        semantic: request.includeSemantic ?? true,
        fuzzy: request.includeFuzzy ?? true,
        aiRanking: true,
        mobileFormatter: true,
      },
    });
    const data = unwrapData<AdvancedSearchResponse>(response.data, response.data);
    const rawResults = normalizeArray(data.results, ['results', 'items']);
    const results = rawResults.map(normalizeResult);

    return {
      results,
      meta: {
        query,
        correctedQuery: data.meta?.correctedQuery,
        intent: data.meta?.intent ?? inferIntent(query),
        total: Number(data.meta?.total ?? results.length),
        page: Number(data.meta?.page ?? page),
        limit: Number(data.meta?.limit ?? limit),
        nextCursor: data.meta?.nextCursor ?? null,
        hasMore: Boolean(data.meta?.hasMore),
        responseTimeMs: data.meta?.responseTimeMs ?? Date.now() - startedAt,
        rankingModel: data.meta?.rankingModel ?? 'hybrid-mobile-v1',
      },
      related: Array.isArray(data.related) ? data.related.map(String) : buildRelatedQueries(query),
      filters: data.filters ?? defaultFilters(),
    };
  } catch {
    const results = fallbackResults(query);
    return {
      results,
      meta: {
        query,
        intent: inferIntent(query),
        total: results.length,
        page,
        limit,
        nextCursor: null,
        hasMore: false,
        responseTimeMs: Date.now() - startedAt,
        rankingModel: 'local-fallback',
      },
      related: buildRelatedQueries(query),
      filters: defaultFilters(),
    };
  }
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];

  try {
    const response = await apiGet('/api/search/suggestions', { params: { query, limit: 8 } });
    const items = normalizeArray(unwrapData(response.data, response.data), ['suggestions', 'items']);
    return items.map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const label = compactText(record.label ?? record.query ?? record.text ?? item);
      return {
        id: String(record.id ?? `${label}-${index}`),
        label,
        type: String(record.type ?? 'query') as SearchSuggestion['type'],
        intent: record.intent ? String(record.intent) as SearchIntent : inferIntent(label),
      };
    }).filter((item) => item.label);
  } catch {
    return buildRelatedQueries(query).map((label, index) => ({
      id: `suggestion-${index}`,
      label,
      type: 'query',
      intent: inferIntent(label),
    }));
  }
}

export async function getTrendingSearches(): Promise<TrendingSearch[]> {
  try {
    const response = await apiGet('/api/search/trending', { params: { limit: 8 } });
    const items = normalizeArray(unwrapData(response.data, response.data), ['trending', 'items']);
    return items.map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: String(record.id ?? `trending-${index}`),
        label: compactText(record.label ?? record.query ?? record.text ?? item),
        score: Number(record.score ?? 1),
        category: record.category ? inferType(record) : undefined,
      };
    }).filter((item) => item.label);
  } catch {
    return [
      { id: 'trend-1', label: 'hot leads this week', score: 1, category: 'lead' },
      { id: 'trend-2', label: 'campaigns needing follow up', score: 0.88, category: 'campaign' },
      { id: 'trend-3', label: 'missed calls with interested prospects', score: 0.79, category: 'call' },
    ];
  }
}

export async function getSearchFilters(query?: string) {
  const response = await apiGet('/api/search/filter', {
    params: {
      ...(query?.trim() ? { query: query.trim() } : {}),
    },
  });
  return unwrapData(response.data, response.data);
}

export async function saveRecentSearch(query: string, filters?: AdvancedSearchFilters) {
  if (!query.trim()) return;
  await apiPost('/api/search/recent', { query: query.trim(), filters }).catch(() => undefined);
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const response = await apiGet('/api/search/recent', { params: { limit: 8 } });
    const items = normalizeArray(unwrapData(response.data, response.data), ['recent', 'items']);
    return items.map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: String(record.id ?? `recent-${index}`),
        query: compactText(record.query ?? record.label ?? item),
        createdAt: compactText(record.createdAt ?? record.created_at ?? new Date().toISOString()),
        filters: record.filters as AdvancedSearchFilters | undefined,
      };
    }).filter((item) => item.query);
  } catch {
    return [];
  }
}

export async function getMobileHomeFeed() {
  const response = await apiGet('/api/mobile/home-feed', { params: { limit: 12 } });
  return response.data;
}

const inferIntent = (query: string): SearchIntent => {
  const normalized = query.toLowerCase();
  if (/lead|prospect|contact|company|founder|owner/.test(normalized)) return 'find_leads';
  if (/workflow|campaign|sequence|automation|follow/.test(normalized)) return 'open_workflow';
  if (/call|chat|message|activity|recent/.test(normalized)) return 'review_activity';
  if (/how|why|what|explain|learn/.test(normalized)) return 'learn';
  return 'unknown';
};

const buildRelatedQueries = (query: string) => {
  const base = query.trim() || 'lead';
  return [
    `${base} with recent activity`,
    `${base} ready for follow up`,
    `${base} campaign workflow`,
  ];
};

const defaultFilters = (): AdvancedSearchResponse['filters'] => ({
  categories: [
    { label: 'Leads', value: 'lead' },
    { label: 'Campaigns', value: 'campaign' },
    { label: 'Calls', value: 'call' },
    { label: 'Workflows', value: 'workflow' },
    { label: 'Insights', value: 'insight' },
  ],
  tags: [
    { label: 'High intent', value: 'high-intent' },
    { label: 'Follow up', value: 'follow-up' },
    { label: 'Recent', value: 'recent' },
    { label: 'Mobile ready', value: 'mobile-ready' },
  ],
});
