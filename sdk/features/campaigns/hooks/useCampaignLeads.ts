/**
 * Campaigns Feature - useCampaignLeads Hook
 * 
 * React hook for fetching campaign leads using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from '@tanstack/react-query';
import { getCampaignLeadsOptions } from '../api';
import type { CampaignLead } from '../types';

export interface UseCampaignLeadsReturn {
  data: CampaignLead[] | undefined;
  leads: CampaignLead[] | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get campaign leads with TanStack Query
 */
export function useCampaignLeads(
  campaignId: string, 
  filters?: { search?: string }
): UseCampaignLeadsReturn {
  const query = useQuery(getCampaignLeadsOptions(campaignId, filters));
  
  return {
    data: query.data,
    leads: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}