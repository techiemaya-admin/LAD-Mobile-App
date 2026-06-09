/**
 * Campaigns Feature - useCampaign Hook
 * 
 * React hook for fetching a single campaign using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from '@tanstack/react-query';
import { getCampaignOptions } from '../api';
import type { Campaign } from '../types';

export interface UseCampaignReturn {
  data: Campaign | undefined;
  campaign: Campaign | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get a single campaign with TanStack Query
 */
export function useCampaign(campaignId: string): UseCampaignReturn {
  const query = useQuery(getCampaignOptions(campaignId));
  
  return {
    data: query.data,
    campaign: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}