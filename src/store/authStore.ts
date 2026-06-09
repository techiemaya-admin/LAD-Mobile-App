import { create } from 'zustand';
import {
  clearAuthStorage,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredRefreshToken,
  setStoredUser,
} from '../api/tokenStorage';
import { LoginCredentials, loginWithEmail } from '../services/authService';

const shouldRequireLoginOnStart = process.env.EXPO_PUBLIC_REQUIRE_LOGIN_ON_START === 'true';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (user: User, token: string) => Promise<void>;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true, // true initially while checking SecureStore
  error: null,

  login: async (user, token) => {
    await setStoredToken(token);
    await setStoredUser(user);
    set({ user, token, error: null });
  },

  signIn: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const result = await loginWithEmail(credentials);
      await setStoredToken(result.token);
      if (result.refreshToken) {
        await setStoredRefreshToken(result.refreshToken);
      }
      await setStoredUser(result.user);
      set({ user: result.user, token: result.token, isLoading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      set({ user: null, token: null, isLoading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    await clearAuthStorage();
    set({ user: null, token: null, isLoading: false, error: null });
  },

  restoreToken: async () => {
    try {
      if (shouldRequireLoginOnStart) {
        await clearAuthStorage();
        set({ user: null, token: null, isLoading: false, error: null });
        return;
      }

      const token = await getStoredToken();
      const user = await getStoredUser();
      
      if (token) {
        set({ token, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      await clearAuthStorage().catch(() => undefined);
      set({ user: null, token: null, isLoading: false, error: null });
    }
  },
}));

export default useAuthStore;
