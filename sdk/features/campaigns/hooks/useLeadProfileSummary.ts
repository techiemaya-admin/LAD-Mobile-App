/**
 * Campaigns Feature - useLeadProfileSummary Hook
 * 
 * React hook for fetching lead profile summaries using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getLeadProfileSummaryOptions,
  generateLeadProfileSummary,
  campaignKeys 
} from '../api';

export interface UseLeadProfileSummaryReturn {
  data: { summary: string | null; exists: boolean } | undefined;
  summary: string | null | undefined;
  exists: boolean | undefined;
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get lead profile summary with TanStack Query
 */
export function useLeadProfileSummary(campaignId: string, leadId: string): UseLeadProfileSummaryReturn {
  const query = useQuery(getLeadProfileSummaryOptions(campaignId, leadId));
  
  return {
    data: query.data,
    summary: query.data?.summary,
    exists: query.data?.exists,
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}

/**
 * Hook to generate lead profile summary
 */
export function useGenerateLeadProfileSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId, profileData }: { 
      campaignId: string; 
      leadId: string;
      profileData?: any;
    }) =>
      generateLeadProfileSummary(campaignId, leadId, profileData),
    onSuccess: (data, { campaignId, leadId }) => {
      // Update the lead summary cache
      queryClient.setQueryData(
        campaignKeys.leadSummary(campaignId, leadId),
        { summary: data.summary, exists: true }
      );
    },
  });
}