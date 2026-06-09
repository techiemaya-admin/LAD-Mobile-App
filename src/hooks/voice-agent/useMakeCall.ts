import { useMutation } from '@tanstack/react-query';
import { makeCall } from '@/src/services/voice-agent';
import type { MakeCallRequest, MakeCallResponse } from '@/src/services/voice-agent';

export function useMakeCall() {
  return useMutation<MakeCallResponse, Error, MakeCallRequest>({
    mutationFn: (payload) => makeCall(payload),
  });
}

