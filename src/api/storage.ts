import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_KEYS = new Set(['token', 'auth_token', 'userToken', 'refreshToken']);
const AUTH_TOKEN_KEYS = ['userToken', 'token', 'auth_token'];

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  if (typeof atob === 'function') {
    return atob(padded);
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let index = 0;

  while (index < padded.length) {
    const encoded1 = alphabet.indexOf(padded.charAt(index++));
    const encoded2 = alphabet.indexOf(padded.charAt(index++));
    const encoded3 = alphabet.indexOf(padded.charAt(index++));
    const encoded4 = alphabet.indexOf(padded.charAt(index++));

    const chr1 = (encoded1 << 2) | (encoded2 >> 4);
    const chr2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const chr3 = ((encoded3 & 3) << 6) | encoded4;

    output += String.fromCharCode(chr1);
    if (encoded3 !== 64) output += String.fromCharCode(chr2);
    if (encoded4 !== 64) output += String.fromCharCode(chr3);
  }

  try {
    return decodeURIComponent(output.split('').map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
  } catch {
    return output;
  }
};

export const isJwtExpired = (token: string | null | undefined, skewSeconds = 30) => {
  if (!token || token.split('.').length < 3) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  } catch {
    return false;
  }
};

class SafeStorage {
  private memoryStore = new Map<string, string>();

  private shouldUseSecureStore(key: string) {
    return Platform.OS !== 'web' && SECURE_KEYS.has(key);
  }

  private async getFromSecureStore(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  private async getFromAsyncStorage(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private async setInAsyncStorage(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private async removeFromAsyncStorage(key: string) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  private getFromWebStorage(key: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setInWebStorage(key: string, value: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private removeFromWebStorage(key: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  async getItem(key: string) {
    if (this.shouldUseSecureStore(key)) {
      const secureValue = await this.getFromSecureStore(key);
      if (secureValue) return secureValue;
    }

    const value = await this.getFromAsyncStorage(key);
    return value ?? this.getFromWebStorage(key) ?? this.memoryStore.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.memoryStore.set(key, value);
    this.setInWebStorage(key, value);

    if (this.shouldUseSecureStore(key)) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch {
        // Fall through to AsyncStorage on platforms where SecureStore is unavailable.
      }
    }

    await this.setInAsyncStorage(key, value);
  }

  async removeItem(key: string) {
    this.memoryStore.delete(key);
    this.removeFromWebStorage(key);

    if (this.shouldUseSecureStore(key)) {
      try {
        await SecureStore.deleteItemAsync(key);
        return;
      } catch {
        // Fall through to AsyncStorage cleanup.
      }
    }

    await this.removeFromAsyncStorage(key);
  }

  async clear() {
    this.memoryStore.clear();
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore web storage cleanup failures.
      }
    }
    try {
      await AsyncStorage.clear();
    } catch {
      // Native storage can be unavailable in Expo Go/dev runtimes. Memory is already cleared.
    }
    if (Platform.OS !== 'web') {
      await Promise.all(
        Array.from(SECURE_KEYS).map((key) =>
          SecureStore.deleteItemAsync(key).catch(() => undefined),
        ),
      );
    }
  }
}

export const safeStorage = new SafeStorage();

export async function clearAuthTokens() {
  await Promise.all([
    ...AUTH_TOKEN_KEYS.map((key) => safeStorage.removeItem(key)),
    safeStorage.removeItem('refreshToken'),
  ]);
}

export async function expireAuthSession() {
  await clearAuthTokens();
  try {
    const authStore = await import('@/src/store/authStore');
    const current = authStore.default.getState();
    if (current.token) {
      await current.logout();
    }
  } catch {
    // The API layer can be used before the auth store is mounted.
  }
}

export async function getAuthToken() {
  for (const key of AUTH_TOKEN_KEYS) {
    const token = await safeStorage.getItem(key);
    if (!token) {
      continue;
    }

    if (isJwtExpired(token)) {
      await expireAuthSession();
      return null;
    }

    return token;
  }

  return null;
}
