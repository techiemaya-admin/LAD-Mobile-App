/**
 * Call Logs Feature - useBatchStatus Hook
 * 
 * React hook for fetching batch status using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { BatchApiResponse } from "../types";
import * as api from "../api";

/**
 * Hook to fetch batch status
 */
export function useBatchStatus(batchJobId: string | null) {
  return useQuery<BatchApiResponse>({
    queryKey: ["batch-status", batchJobId],
    queryFn: () => api.getBatchStatus(batchJobId!),
    enabled: !!batchJobId,
    staleTime: 5000, // 5 seconds for active batches
  });
}
