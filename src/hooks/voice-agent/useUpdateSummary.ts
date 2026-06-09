import { useMutation } from '@tanstack/react-query';
import { updateSummary } from '@/src/services/voice-agent';
import type { UpdateSummaryRequest, UpdateSummaryResponse } from '@/src/services/voice-agent';

export function useUpdateSummary() {
  return useMutation<UpdateSummaryResponse, Error, UpdateSummaryRequest>({
    mutationFn: (payload) => updateSummary(payload),
  });
}

