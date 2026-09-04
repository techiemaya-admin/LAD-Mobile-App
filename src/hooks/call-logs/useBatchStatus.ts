import { useQuery } from '@tanstack/react-query';
import { getBatchStatus } from '@/src/services/call-logs';
import type { BatchApiResponse } from '@/src/services/call-logs';

export function useBatchStatus(batchJobId: string | null) {
  return useQuery<BatchApiResponse>({
    queryKey: ['batch-status', batchJobId],
    queryFn: () => getBatchStatus(batchJobId!),
    enabled: !!batchJobId,
    staleTime: 5000,
  });
}

