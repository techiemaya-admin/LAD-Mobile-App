import { useQuery } from '@tanstack/react-query';
import { getUserAvailableNumbers } from '@/src/services/voice-agent';
import type { UserAvailableNumber } from '@/src/services/voice-agent';

export function useUserAvailableNumbers(enabled = true) {
  return useQuery<UserAvailableNumber[]>({
    queryKey: ['voice-agent', 'user-available-numbers'],
    queryFn: () => getUserAvailableNumbers(),
    staleTime: 30000,
    enabled,
  });
}

