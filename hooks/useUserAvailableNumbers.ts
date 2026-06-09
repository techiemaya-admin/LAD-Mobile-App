import { useEffect } from 'react';
import { useVoiceAgentStore } from '@/src/store/voiceAgentStore';

export function useUserAvailableNumbers() {
  const numbers = useVoiceAgentStore((state) => state.numbers);
  const selectedNumber = useVoiceAgentStore((state) => state.selectedNumber);
  const setSelectedNumber = useVoiceAgentStore((state) => state.setSelectedNumber);
  const isLoading = useVoiceAgentStore((state) => state.isLoadingNumbers);
  const loadNumbers = useVoiceAgentStore((state) => state.loadNumbers);

  useEffect(() => {
    if (numbers.length === 0) {
      void loadNumbers();
    }
  }, [loadNumbers, numbers.length]);

  return { numbers, selectedNumber, setSelectedNumber, isLoading };
}
