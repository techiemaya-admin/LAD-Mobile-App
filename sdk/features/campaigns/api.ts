/**
 * Campaigns Feature - API Functions
 * 
 * All HTTP API calls for the campaigns feature.
 * Uses the shared apiClient for consistent request handling.
 * Enhanced with TanStack Query v5 support for better caching and data management.
 */
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/apiClient';
import type {
  Campaign,
  CampaignStats,
  CampaignFilters,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignAnalytics,
  CampaignLead,
} from './types';

// Query keys for TanStack Query
export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  list: (filters?: CampaignFilters) => [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
  stats: () => [...campaignKeys.all, 'stats'] as const,
  analytics: (id: string) => [...campaignKeys.all, 'analytics', id] as const,
  leads: (id: string, filters?: { search?: string }) => [...campaignKeys.all, 'leads', id, filters] as const,
  leadSummary: (campaignId: string, leadId: string) => [...campaignKeys.all, 'leadSummary', campaignId, leadId] as const,
  activityFeed: (campaignId: string, filters?: { limit?: number; offset?: number; platform?: string; actionType?: string; status?: string }) => 
    [...campaignKeys.all, 'activityFeed', campaignId, filters] as const,
  inboundLeads: (filters?: { limit?: number; offset?: number; search?: string }) => 
    [...campaignKeys.all, 'inbound', filters] as const,
} as const;
// ====================
// Core API Functions
// ====================

/**
 * Get all campaigns with optional filters
 */
export async function getCampaigns(filters?: CampaignFilters): Promise<Campaign[]> {
  const params: Record<string, string> = {};
  if (filters?.search) params.search = filters.search;
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  const response = await apiClient.get<{ data: Campaign[] }>('/api/campaigns', { params });
  return response.data.data || [];
}

/**
 * TanStack Query options for getting campaigns
 */
export const getCampaignsOptions = (filters?: CampaignFilters) =>
  queryOptions({
    queryKey: campaignKeys.list(filters),
    queryFn: () => getCampaigns(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

/**
 * Get a single campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign> {
  const response = await apiClient.get<{ data: Campaign }>(`/api/campaigns/${campaignId}`);
  return response.data.data;
}

/**
 * TanStack Query options for getting a single campaign
 */
export const getCampaignOptions = (campaignId: string) =>
  queryOptions({
    queryKey: campaignKeys.detail(campaignId),
    queryFn: () => getCampaign(campaignId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!campaignId,
  });

/**
 * Get campaign statistics
 */
export async function getCampaignStats(): Promise<CampaignStats> {
  const response = await apiClient.get<{ data: CampaignStats }>('/api/campaigns/stats');
  return response.data.data;
}

/**
 * TanStack Query options for getting campaign statistics
 */
export const getCampaignStatsOptions = () =>
  queryOptions({
    queryKey: campaignKeys.stats(),
    queryFn: getCampaignStats,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });
// ====================
// Mutation Functions
// ====================

/**
 * Create a new campaign
 */
export async function createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
  const response = await apiClient.post<{ data: Campaign }>('/api/campaigns', data);
  return response.data.data;
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  campaignId: string,
  data: UpdateCampaignRequest
): Promise<Campaign> {
  const response = await apiClient.put<{ data: Campaign }>(`/api/campaigns/${campaignId}`, data);
  return response.data.data;
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  await apiClient.delete(`/api/campaigns/${campaignId}`);
}

/**
 * Start a campaign
 */
export async function startCampaign(campaignId: string): Promise<void> {
  await apiClient.post(`/api/campaigns/${campaignId}/start`, {});
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(campaignId: string): Promise<void> {
  await apiClient.post(`/api/campaigns/${campaignId}/pause`, {});
}

/**
 * Stop a campaign
 */
export async function stopCampaign(campaignId: string): Promise<void> {
  await apiClient.post(`/api/campaigns/${campaignId}/stop`, {});
}
// ====================
// Analytics & Leads Functions
// ====================

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const response = await apiClient.get<{ data: CampaignAnalytics }>(
    `/api/campaigns/${campaignId}/analytics`
  );
  return response.data.data;
}

/**
 * TanStack Query options for getting campaign analytics
 */
export const getCampaignAnalyticsOptions = (campaignId: string) =>
  queryOptions({
    queryKey: campaignKeys.analytics(campaignId),
    queryFn: () => getCampaignAnalytics(campaignId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!campaignId,
  });

/**
 * Get campaign activity feed
 */
export async function getCampaignActivityFeed(
  campaignId: string,
  filters?: {
    limit?: number;
    offset?: number;
    platform?: string;
    actionType?: string;
    status?: string;
  }
): Promise<{ activities: any[]; total: number }> {
  const params: Record<string, string> = {};
  if (filters?.limit) params.limit = String(filters.limit);
  if (filters?.offset) params.offset = String(filters.offset);
  if (filters?.platform) params.platform = filters.platform;
  if (filters?.actionType) params.actionType = filters.actionType;
  if (filters?.status) params.status = filters.status;
  
  const response = await apiClient.get<{ 
    success: boolean; 
    data: { activities: any[]; total: number } 
  }>(`/api/campaigns/${campaignId}/analytics`, { params });
  
  if (!response.data.success) {
    throw new Error('Failed to fetch activity feed');
  }
  
  return {
    activities: response.data.data.activities || [],
    total: response.data.data.total || 0
  };
}

/**
 * TanStack Query options for getting campaign activity feed
 */
export const getCampaignActivityFeedOptions = (
  campaignId: string,
  filters?: {
    limit?: number;
    offset?: number;
    platform?: string;
    actionType?: string;
    status?: string;
  }
) =>
  queryOptions({
    queryKey: campaignKeys.activityFeed(campaignId, filters),
    queryFn: () => getCampaignActivityFeed(campaignId, filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    enabled: !!campaignId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

/**
 * Get campaign leads
 */
export async function getCampaignLeads(
  campaignId: string,
  filters?: { search?: string }
): Promise<CampaignLead[]> {
  const params: Record<string, string> = {};
  if (filters?.search) params.search = filters.search;
  const response = await apiClient.get<{ data: CampaignLead[] }>(
    `/api/campaigns/${campaignId}/leads`,
    { params }
  );
  return response.data.data || [];
}

/**
 * TanStack Query options for getting campaign leads
 */
export const getCampaignLeadsOptions = (
  campaignId: string,
  filters?: { search?: string }
) =>
  queryOptions({
    queryKey: campaignKeys.leads(campaignId, filters),
    queryFn: () => getCampaignLeads(campaignId, filters),
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 8 * 60 * 1000,
    enabled: !!campaignId,
  });
// ====================
// Lead Profile Functions
// ====================

/**
 * Get or generate lead profile summary
 */
export async function getLeadProfileSummary(
  campaignId: string,
  leadId: string
): Promise<{ summary: string | null; exists: boolean }> {
  const response = await apiClient.get<{ success: boolean; summary: string | null; exists: boolean }>(
    `/api/campaigns/${campaignId}/leads/${leadId}/summary`
  );
  return {
    summary: response.data.summary || null,
    exists: response.data.exists || false,
  };
}

/**
 * TanStack Query options for getting lead profile summary
 */
export const getLeadProfileSummaryOptions = (campaignId: string, leadId: string) =>
  queryOptions({
    queryKey: campaignKeys.leadSummary(campaignId, leadId),
    queryFn: () => getLeadProfileSummary(campaignId, leadId),
    staleTime: 10 * 60 * 1000, // 10 minutes (summaries don't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!(campaignId && leadId),
  });

/**
 * Generate lead profile summary
 */
export async function generateLeadProfileSummary(
  campaignId: string,
  leadId: string,
  profileData?: any
): Promise<{ summary: string }> {
  const response = await apiClient.post<{ success: boolean; summary: string }>(
    `/api/campaigns/${campaignId}/leads/${leadId}/summary`,
    profileData ? { leadId, campaignId, profileData } : {}
  );
  return { summary: response.data.summary };
}

/**
 * Fetch summaries for multiple leads in batch
 */
export async function getLeadsSummaries(
  campaignId: string,
  leadIds: string[]
): Promise<Map<string, string>> {
  const summaryMap = new Map<string, string>();
  
  // Fetch summaries in parallel
  const summaryPromises = leadIds.map(async (leadId) => {
    try {
      const data = await getLeadProfileSummary(campaignId, leadId);
      if (data.summary) {
        return { leadId, summary: data.summary };
      }
    } catch (err) {
      // Silently fail - summary might not exist yet
    }
    return null;
  });
  
  const results = await Promise.all(summaryPromises);
  results.forEach((result) => {
    if (result) {
      summaryMap.set(result.leadId, result.summary);
    }
  });
  
  return summaryMap;
}

/**
 * TanStack Query options for getting multiple lead summaries
 */
export const getLeadsSummariesOptions = (campaignId: string, leadIds: string[]) =>
  queryOptions({
    queryKey: [...campaignKeys.all, 'leadsSummaries', campaignId, leadIds.sort()],
    queryFn: () => getLeadsSummaries(campaignId, leadIds),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!(campaignId && leadIds.length > 0),
  });

// ====================
// Lead Reveal Functions
// ====================


/**
 * Hook to reveal lead email
 */
export function useRevealLeadEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId, apolloPersonId }: {
      campaignId: string;
      leadId: string;
      apolloPersonId: string;
    }) => revealLeadEmail(campaignId, leadId, apolloPersonId),
    onSuccess: (_, { campaignId }) => {
      // Invalidate campaign leads to refresh with revealed email
      queryClient.invalidateQueries({ queryKey: campaignKeys.leads(campaignId) });
    },
  });
}

/**
 * Hook to reveal lead phone
 */
export function useRevealLeadPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId, apolloPersonId }: {
      campaignId: string;
      leadId: string;
      apolloPersonId: string;
    }) => revealLeadPhone(campaignId, leadId, apolloPersonId),
    onSuccess: (_, { campaignId }) => {
      // Invalidate campaign leads to refresh with revealed phone
      queryClient.invalidateQueries({ queryKey: campaignKeys.leads(campaignId) });
    },
  });
}
/**
 * Reveal email for a campaign lead
 * Calls campaigns API which proxies to Apollo Leads API
 */
export async function revealLeadEmail(
  campaignId: string,
  leadId: string,
  apolloPersonId: string
): Promise<{ email: string; from_cache: boolean; credits_used: number }> {
  const response = await apiClient.post<{
    error: string;
    success: boolean;
    email: string;
    from_cache: boolean;
    credits_used: number;
  }>(`/api/campaigns/${campaignId}/leads/${leadId}/reveal-email`, {
    apollo_person_id: apolloPersonId
  });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to reveal email');
  }
  return {
    email: response.data.email,
    from_cache: response.data.from_cache,
    credits_used: response.data.credits_used
  };
}
/**
 * Reveal phone for a campaign lead
 * Calls campaigns API which proxies to Apollo Leads API
 */
export async function revealLeadPhone(
  campaignId: string,
  leadId: string,
  apolloPersonId: string
): Promise<{ phone: string; from_cache: boolean; credits_used: number; processing?: boolean; message?: string }> {
  const response = await apiClient.post<{
    error: string;
    success: boolean;
    phone: string | null;
    from_cache: boolean;
    credits_used: number;
    processing?: boolean;
    message?: string;
  }>(`/api/campaigns/${campaignId}/leads/${leadId}/reveal-phone`, {
    apollo_person_id: apolloPersonId
  });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to reveal phone');
  }
  return {
    phone: response.data.phone || null,
    from_cache: response.data.from_cache,
    credits_used: response.data.credits_used,
    processing: response.data.processing,
    message: response.data.message
  };
}

/**
 * Reveal LinkedIn URL for a campaign lead
 */
export async function revealLeadLinkedIn(
  campaignId: string,
  leadId: string
): Promise<{ linkedin_url: string; from_database: boolean }> {
  const response = await apiClient.post<{
    error: string;
    success: boolean;
    linkedin_url: string;
    from_database: boolean;
  }>(`/api/campaigns/${campaignId}/leads/${leadId}/reveal-linkedin`, {});
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to reveal LinkedIn');
  }
  return {
    linkedin_url: response.data.linkedin_url,
    from_database: response.data.from_database
  };
}

// ====================
// Inbound Leads Functions
// ====================

/**
 * Save inbound leads
 */
export async function saveInboundLeads(data: {
  leads: any[];
  skipDuplicates?: boolean;
}): Promise<{
  success: boolean;
  duplicatesFound: boolean;
  data: {
    saved?: number;
    total?: number;
    skippedDuplicates?: number;
    leads?: any[];
    leadIds?: string[];
    errors?: any[];
    duplicates?: any[];
    duplicateCount?: number;
    newLeadsCount?: number;
    totalUploaded?: number;
  };
  message: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    duplicatesFound: boolean;
    data: any;
    message: string;
  }>('/api/inbound-leads', data);
  return response.data;
}

/**
 * Get inbound leads
 */
export async function getInboundLeads(filters?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<any[]> {
  const params: Record<string, string> = {};
  if (filters?.limit) params.limit = String(filters.limit);
  if (filters?.offset) params.offset = String(filters.offset);
  if (filters?.search) params.search = filters.search;
  
  const response = await apiClient.get<{ success: boolean; data: any[] }>(
    '/api/inbound-leads',
    { params }
  );
  return response.data.data || [];
}

/**
 * TanStack Query options for getting inbound leads
 */
export const getInboundLeadsOptions = (filters?: {
  limit?: number;
  offset?: number;
  search?: string;
}) =>
  queryOptions({
    queryKey: campaignKeys.inboundLeads(filters),
    queryFn: () => getInboundLeads(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });

/**
 * Cancel bookings for leads to re-nurture them
 */
export async function cancelLeadBookingsForReNurturing(leadIds: string[]): Promise<{
  success: boolean;
  data: {
    cancelledBookings: number;
    leadIds: string[];
  };
  message: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    data: {
      cancelledBookings: number;
      leadIds: string[];
    };
    message: string;
  }>('/api/inbound-leads/cancel-bookings', { leadIds });
  return response.data;
}

