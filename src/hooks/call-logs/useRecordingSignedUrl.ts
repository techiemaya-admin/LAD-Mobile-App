import { useQuery } from '@tanstack/react-query';
import { getRecordingSignedUrl } from '@/src/services/call-logs';

export function useRecordingSignedUrl(callId: string | null | undefined) {
  return useQuery({
    queryKey: ['recording-signed-url', callId],
    queryFn: () => getRecordingSignedUrl({ callId: callId! }),
    enabled: !!callId,
    staleTime: 300000,
  });
}

