import { useQuery } from '@tanstack/react-query';
import { getCallLogsStats } from '@/src/services/call-logs';
import type { CallLogsStats } from '@/src/services/call-logs';

export function useCallLogsStats(tenantId: string, enabled = true) {
  return useQuery<CallLogsStats>({
    queryKey: ['call-logs-stats', tenantId],
    queryFn: () => getCallLogsStats(tenantId),
    staleTime: 30000,
    enabled,
  });
}

