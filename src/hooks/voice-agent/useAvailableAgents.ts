import { useQuery } from '@tanstack/react-query';
import { getUserAvailableAgents } from '@/src/services/voice-agent';
import type { UserAvailableAgent } from '@/src/services/voice-agent';

export function useAvailableAgents(enabled = true) {
  return useQuery<UserAvailableAgent[]>({
    queryKey: ['voice-agent', 'user-available-agents'],
    queryFn: () => getUserAvailableAgents(),
    staleTime: 30000,
    enabled,
  });
}

