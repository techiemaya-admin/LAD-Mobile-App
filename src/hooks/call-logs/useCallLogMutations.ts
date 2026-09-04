import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endCall, retryFailedCalls } from '@/src/services/call-logs';
import type { EndCallParams, RetryCallsParams } from '@/src/services/call-logs';

export function useEndCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: EndCallParams) => endCall(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
  });
}

export function useRetryFailedCalls() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: RetryCallsParams) => retryFailedCalls(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
  });
}

