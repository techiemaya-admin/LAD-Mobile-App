import { useEffect } from 'react';
import { useVoiceAgentStore } from '@/src/store/voiceAgentStore';

export function useAvailableAgents() {
  const agents = useVoiceAgentStore((state) => state.agents);
  const selectedAgent = useVoiceAgentStore((state) => state.selectedAgent);
  const setSelectedAgent = useVoiceAgentStore((state) => state.setSelectedAgent);
  const isLoading = useVoiceAgentStore((state) => state.isLoadingAgents);
  const loadAgents = useVoiceAgentStore((state) => state.loadAgents);

  useEffect(() => {
    if (agents.length === 0) {
      void loadAgents();
    }
  }, [agents.length, loadAgents]);

  return { agents, selectedAgent, setSelectedAgent, isLoading };
}
