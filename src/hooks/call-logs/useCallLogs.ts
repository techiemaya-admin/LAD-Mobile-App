import { useQuery } from '@tanstack/react-query';
import { getCallLogs } from '@/src/services/call-logs';
import type { CallLogsResponse, GetCallLogsParams } from '@/src/services/call-logs';

export function useCallLogs(params?: GetCallLogsParams, enabled = true) {
  return useQuery<CallLogsResponse>({
    queryKey: ['call-logs', params],
    queryFn: () => getCallLogs(params),
    staleTime: 30000,
    enabled,
  });
}

