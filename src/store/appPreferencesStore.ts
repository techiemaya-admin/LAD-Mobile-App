import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'lad.app-preferences.v1';

type StoredPreferences = {
  darkMode?: boolean;
};

type AppPreferencesState = {
  darkMode: boolean;
  hydrated: boolean;
  setDarkMode: (value: boolean) => void;
  hydrate: () => Promise<void>;
};

const readStoredPreferences = async (): Promise<StoredPreferences | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredPreferences;
  } catch {
    return null;
  }
};

const writeStoredPreferences = async (preferences: StoredPreferences) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

const useAppPreferencesStore = create<AppPreferencesState>((set, get) => ({
  darkMode: false,
  hydrated: false,

  setDarkMode: (value) => {
    set({ darkMode: value });
    void writeStoredPreferences({ darkMode: value }).catch(() => undefined);
  },

  hydrate: async () => {
    try {
      const stored = await readStoredPreferences();
      set({
        darkMode: Boolean(stored?.darkMode),
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));

void useAppPreferencesStore.getState().hydrate();

export default useAppPreferencesStore;
