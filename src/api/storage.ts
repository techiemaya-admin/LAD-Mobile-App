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

// Tenant claim names the backend may embed in the JWT, in priority order.
const TENANT_CLAIM_KEYS = [
  'activeTenantId',
  'active_tenant_id',
  'tenantId',
  'tenant_id',
  'organizationId',
  'organization_id',
  'orgId',
  'tenant',
];

const readTenantClaim = (record: Record<string, unknown>): string | null => {
  for (const key of TENANT_CLAIM_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

/**
 * Resolve the tenant id from the JWT itself.
 *
 * The backend (shared with LAD-Frontend-2) resolves the active tenant from the
 * JWT — the web app sends NO X-Tenant-ID header and relies entirely on the
 * token. Deriving the header from the JWT here guarantees the mobile app scopes
 * every request to the SAME tenant the backend would resolve for the web app,
 * so calls dispatch against the correct from-number pool and call logs land in
 * the same tenant partition the web call-logs view reads. Returns null when the
 * token carries no tenant claim, in which case we send no header (web parity).
 */
export const getTenantIdFromToken = (token: string | null | undefined): string | null => {
  if (!token || token.split('.').length < 3) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as Record<string, unknown>;
    const direct = readTenantClaim(payload);
    if (direct) {
      return direct;
    }

    const nested = payload.user ?? payload.profile ?? payload.account;
    if (nested && typeof nested === 'object') {
      return readTenantClaim(nested as Record<string, unknown>);
    }

    return null;
  } catch {
    return null;
  }
};

export async function getActiveTenantId() {
  const token = await getAuthToken();
  return getTenantIdFromToken(token);
}
