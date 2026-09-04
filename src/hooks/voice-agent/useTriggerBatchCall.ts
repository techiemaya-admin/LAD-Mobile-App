import { useMutation } from '@tanstack/react-query';
import { triggerBatchCall } from '@/src/services/voice-agent';
import type { TriggerBatchCallRequest, TriggerBatchCallResponse } from '@/src/services/voice-agent';

export function useTriggerBatchCall() {
  return useMutation<TriggerBatchCallResponse, Error, TriggerBatchCallRequest>({
    mutationFn: (payload) => triggerBatchCall(payload),
  });
}

