/**
 * Deals Pipeline Feature - useReferenceData Hook
 *
 * React hooks for reference data (statuses, sources, priorities) using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { StatusOption, SourceOption, PriorityOption } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all status options
 */
export function useStatuses(enabled: boolean = true) {
  return useQuery<StatusOption[]>({
    queryKey: ["deals-pipeline", "reference", "statuses"],
    queryFn: () => api.getStatuses(),
    staleTime: 5 * 60 * 1000, // 5 minutes - reference data doesn't change often
    enabled: enabled,
  });
}

/**
 * Hook to fetch all source options
 */
export function useSources(enabled: boolean = true) {
  return useQuery<SourceOption[]>({
    queryKey: ["deals-pipeline", "reference", "sources"],
    queryFn: () => api.getSources(),
    staleTime: 5 * 60 * 1000,
    enabled: enabled,
  });
}

/**
 * Hook to fetch all priority options
 */
export function usePriorities(enabled: boolean = true) {
  return useQuery<PriorityOption[]>({
    queryKey: ["deals-pipeline", "reference", "priorities"],
    queryFn: () => api.getPriorities(),
    staleTime: 5 * 60 * 1000,
    enabled: enabled,
  });
}
