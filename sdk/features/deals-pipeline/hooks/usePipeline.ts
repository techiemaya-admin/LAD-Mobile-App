/**
 * Deals Pipeline Feature - usePipeline Hook
 *
 * React hooks for pipeline board operations using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { PipelineData, PipelineStats, LeadFilters } from "../types";
import * as api from "../api";

/**
 * Hook to fetch complete pipeline board data (stages + leads)
 */
export function usePipelineData(page: number = 1, limit: number = 50, enabled: boolean = true) {
  return useQuery<PipelineData>({
    queryKey: ["deals-pipeline", "pipeline", { page, limit }],
    queryFn: () => api.getPipelineData(page, limit),
    staleTime: 30000, // 30 seconds
    enabled: enabled,
  });
}

/**
 * Hook to fetch pipeline statistics
 */
export function usePipelineStats(filters?: LeadFilters, enabled: boolean = true) {
  return useQuery<PipelineStats>({
    queryKey: ["deals-pipeline", "stats", filters],
    queryFn: () => api.getPipelineStats(filters),
    staleTime: 60000, // 1 minute
    enabled: enabled,
  });
}
