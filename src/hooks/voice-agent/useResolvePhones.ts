import { useMutation } from '@tanstack/react-query';
import { resolvePhones } from '@/src/services/voice-agent';
import type { ResolvePhonesResponse, VoiceAgentTargetType } from '@/src/services/voice-agent';

export function useResolvePhones() {
  return useMutation<ResolvePhonesResponse, Error, { ids: string[]; type: VoiceAgentTargetType }>({
    mutationFn: ({ ids, type }) => resolvePhones(ids, type),
  });
}

