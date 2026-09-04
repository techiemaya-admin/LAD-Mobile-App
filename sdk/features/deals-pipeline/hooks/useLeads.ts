/**
 * Deals Pipeline Feature - useLeads Hook
 *
 * React hook for fetching leads using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { Lead, LeadFilters } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all leads with optional filters
 */
export function useLeads(filters?: LeadFilters, enabled: boolean = true) {
  return useQuery<Lead[]>({
    queryKey: ["deals-pipeline", "leads", filters],
    queryFn: () => api.getLeads(filters),
    staleTime: 30000, // 30 seconds
    enabled: enabled,
  });
}

/**
 * Hook to fetch a single lead by ID
 */
export function useLead(id: string | number | null, enabled: boolean = true) {
  return useQuery<Lead>({
    queryKey: ["deals-pipeline", "leads", id],
    queryFn: () => api.getLeadById(id!),
    staleTime: 30000,
    enabled: !!id && enabled,
  });
}

/**
 * Hook to fetch leads with conversation data
 */
export function useLeadsWithConversations(enabled: boolean = true) {
  return useQuery<Lead[]>({
    queryKey: ["deals-pipeline", "leads", "with-conversations"],
    queryFn: () => api.getLeadsWithConversations(),
    staleTime: 30000,
    enabled: enabled,
  });
}

/**
 * Hook to fetch leads by stage
 */
export function useLeadsByStage(
  stageId: string | number | null,
  enabled: boolean = true
) {
  return useQuery<Lead[]>({
    queryKey: ["deals-pipeline", "leads", "by-stage", stageId],
    queryFn: () => api.getLeadsByStage(stageId!),
    staleTime: 30000,
    enabled: !!stageId && enabled,
  });
}
