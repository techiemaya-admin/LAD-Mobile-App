import { useEffect } from 'react';
import { useChatStore } from '@/src/store/chatStore';

export function useConversations() {
  const initializeRealtime = useChatStore((state) => state.initializeRealtime);
  const store = useChatStore();

  useEffect(() => {
    initializeRealtime();
  }, [initializeRealtime]);

  return store;
}
