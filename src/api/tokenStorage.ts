import { expireAuthSession, isJwtExpired, safeStorage } from './storage';

export interface StoredUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  tenantId?: string;
  activeTenantId?: string;
  organizationId?: string;
}

const TOKEN_KEY = 'userToken';
const USER_KEY = 'userData';
const TOKEN_ALIAS_KEYS = ['token', 'auth_token'];
const REFRESH_TOKEN_KEY = 'refreshToken';

export async function getStoredToken() {
  const primaryToken = await safeStorage.getItem(TOKEN_KEY);
  if (primaryToken) {
    if (isJwtExpired(primaryToken)) {
      await expireAuthSession();
      return null;
    }
    return primaryToken;
  }

  for (const key of TOKEN_ALIAS_KEYS) {
    const token = await safeStorage.getItem(key);
    if (token) {
      if (isJwtExpired(token)) {
        await expireAuthSession();
        return null;
      }
      return token;
    }
  }

  return null;
}

export async function setStoredToken(token: string) {
  await Promise.all([
    safeStorage.setItem(TOKEN_KEY, token),
    ...TOKEN_ALIAS_KEYS.map((key) => safeStorage.setItem(key, token)),
  ]);
}

export async function clearStoredToken() {
  await Promise.all([
    safeStorage.removeItem(TOKEN_KEY),
    safeStorage.removeItem(REFRESH_TOKEN_KEY),
    ...TOKEN_ALIAS_KEYS.map((key) => safeStorage.removeItem(key)),
  ]);
}

export async function setStoredRefreshToken(refreshToken: string) {
  await safeStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getStoredUser() {
  const userData = await safeStorage.getItem(USER_KEY);
  return userData ? (JSON.parse(userData) as StoredUser) : null;
}

export async function setStoredUser(user: StoredUser) {
  await safeStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearStoredUser() {
  await safeStorage.removeItem(USER_KEY);
}

export async function clearAuthStorage() {
  await Promise.all([clearStoredToken(), clearStoredUser()]);
}
