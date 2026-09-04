/**
 * Campaigns Feature - useCampaignStats Hook
 * 
 * React hook for fetching campaign statistics using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from '@tanstack/react-query';
import { getCampaignStatsOptions } from '../api';
import type { CampaignStats } from '../types';

export interface UseCampaignStatsReturn {
  data: CampaignStats | undefined;
  stats: CampaignStats | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get campaign statistics with TanStack Query
 */
export function useCampaignStats(): UseCampaignStatsReturn {
  const query = useQuery(getCampaignStatsOptions());
  
  return {
    data: query.data,
    stats: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}