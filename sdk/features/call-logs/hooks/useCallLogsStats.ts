/**
 * Call Logs Feature - useCallLogsStats Hook
 * 
 * React hook for fetching call logs statistics using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { CallLogsStats, GetCallLogsParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch call logs statistics
 */
export function useCallLogsStats(tenant_id: string, enabled: boolean = true) {
  return useQuery<CallLogsStats>({
    queryKey: ["call-logs-stats", tenant_id],
    queryFn: () => api.getCallLogsStats(tenant_id),
    staleTime: 30000, // 30 seconds
    enabled: enabled,
  });
}
