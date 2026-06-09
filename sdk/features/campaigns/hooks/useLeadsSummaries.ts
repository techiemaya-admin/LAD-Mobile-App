/**
 * Campaigns Feature - useLeadsSummaries Hook
 * 
 * React hook for fetching multiple lead summaries in batch using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from '@tanstack/react-query';
import { getLeadsSummariesOptions } from '../api';

export interface UseLeadsSummariesReturn {
  data: Map<string, string> | undefined;
  summaries: Map<string, string> | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get summaries for multiple leads with TanStack Query
 */
export function useLeadsSummaries(
  campaignId: string,
  leadIds: string[]
): UseLeadsSummariesReturn {
  const query = useQuery(getLeadsSummariesOptions(campaignId, leadIds));
  
  return {
    data: query.data,
    summaries: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}
