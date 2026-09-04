/**
 * Campaigns Feature - useCampaigns Hook
 * 
 * React hook for fetching campaigns list using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from '@tanstack/react-query';
import { getCampaignsOptions } from '../api';
import type { Campaign, CampaignFilters } from '../types';

export interface UseCampaignsReturn {
  data: Campaign[] | undefined;
  campaigns: Campaign[] | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get campaigns list with TanStack Query
 */
export function useCampaigns(filters?: CampaignFilters): UseCampaignsReturn {
  const query = useQuery(getCampaignsOptions(filters));
  
  return {
    data: query.data,
    campaigns: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}