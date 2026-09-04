import { useEffect, useMemo } from 'react';
import { useAdvancedSearchStore } from '@/src/store/advancedSearchStore';

export function useAdvancedSearch() {
  const store = useAdvancedSearchStore();

  useEffect(() => {
    void useAdvancedSearchStore.getState().hydrate();
  }, []);

  return useMemo(() => store, [store]);
}
