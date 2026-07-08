import { create } from 'zustand';
import { apiGet } from '@/src/api';

interface PreferencesState {
  maskPhoneNumbers: boolean;
  isLoading: boolean;
  fetchMaskPhoneNumbers: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  maskPhoneNumbers: false,
  isLoading: false,
  fetchMaskPhoneNumbers: async () => {
    set({ isLoading: true });
    try {
      const res = await apiGet<any>('/api/auth/me');
      const value = !!(res.data?.maskPhoneNumber ?? res.data?.user?.maskPhoneNumber ?? res.data?.mask_phone_number);
      set({ maskPhoneNumbers: value, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
