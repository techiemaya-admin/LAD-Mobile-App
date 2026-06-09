/**
 * Deals Pipeline Feature - useActivities Hook
 *
 * React hooks for lead activities using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all activities for a lead
 */
export function useLeadActivities(leadId: string | number | null, enabled: boolean = true) {
  return useQuery<Activity[]>({
    queryKey: ["deals-pipeline", "leads", leadId, "activities"],
    queryFn: () => api.getLeadActivities(leadId!),
    staleTime: 30000,
    enabled: !!leadId && enabled,
  });
}
