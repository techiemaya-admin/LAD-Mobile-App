/**
 * Campaigns Feature - useInboundLeads Hook
 * 
 * React hook for managing inbound leads using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getInboundLeadsOptions,
  saveInboundLeads,
  cancelLeadBookingsForReNurturing,
  campaignKeys 
} from '../api';

export interface UseInboundLeadsReturn {
  data: any[] | undefined;
  leads: any[] | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}

/**
 * Hook to get inbound leads with TanStack Query
 */
export function useInboundLeads(filters?: {
  limit?: number;
  offset?: number;
  search?: string;
}): UseInboundLeadsReturn {
  const query = useQuery(getInboundLeadsOptions(filters));
  
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

/**
 * Hook to save inbound leads
 */
export function useSaveInboundLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveInboundLeads,
    onSuccess: () => {
      // Invalidate inbound leads queries
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}

/**
 * Hook to cancel lead bookings for re-nurturing
 */
export function useCancelLeadBookingsForReNurturing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelLeadBookingsForReNurturing,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}