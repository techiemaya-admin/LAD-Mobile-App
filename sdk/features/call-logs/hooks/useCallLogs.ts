/**
 * Call Logs Feature - useCallLogs Hook
 * 
 * React hook for fetching call logs using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { CallLogsResponse, GetCallLogsParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch call logs
 */
export function useCallLogs(params?: GetCallLogsParams, enabled: boolean = true) {
  return useQuery<CallLogsResponse>({
    queryKey: ["call-logs", params],
    queryFn: () => api.getCallLogs(params),
    staleTime: 30000, // 30 seconds
    enabled: enabled,
  });
}
