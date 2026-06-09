import { AUTH_API_URL, RESOLVED_AUTH_API_URL, WEB_AUTH_API_FALLBACK_URLS, buildApiUrl } from '@/src/api';
import { StoredUser } from '@/src/api/tokenStorage';
import { Platform } from 'react-native';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  user: StoredUser;
  token: string;
  refreshToken?: string;
}

type LoginResponseShape = {
  success?: boolean;
  message?: string;
  error?: string;
  token?: string;
  accessToken?: string;
  access_token?: string;
  jwt?: string;
  bearerToken?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: Partial<StoredUser>;
  profile?: Partial<StoredUser>;
  account?: Partial<StoredUser>;
  tokens?: LoginResponseShape;
  auth?: LoginResponseShape;
  session?: LoginResponseShape;
  data?: LoginResponseShape;
};

type LoginResponseRecord = LoginResponseShape & Record<string, unknown>;

const LOGIN_ENDPOINT = '/api/auth/login';
const NESTED_AUTH_KEYS = ['tokens', 'auth', 'session', 'data'] as const;

const getApiHost = () => {
  try {
    return new URL(RESOLVED_AUTH_API_URL).host;
  } catch {
    return RESOLVED_AUTH_API_URL;
  }
};

const getLoginBaseUrls = () => {
  if (Platform.OS === 'web') {
    return WEB_AUTH_API_FALLBACK_URLS;
  }

  return Array.from(new Set([RESOLVED_AUTH_API_URL, AUTH_API_URL]));
};

const isRecord = (value: unknown): value is LoginResponseRecord =>
  Boolean(value && typeof value === 'object');

const walkAuthPayload = (payload: unknown) => {
  const queue: LoginResponseRecord[] = [];
  const seen = new WeakSet<object>();

  if (isRecord(payload)) {
    queue.push(payload);
  }

  for (let index = 0; index < queue.length && index < 20; index += 1) {
    const current = queue[index];

    if (seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const key of NESTED_AUTH_KEYS) {
      const nested = current[key];
      if (isRecord(nested) && !seen.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return queue;
};

const firstString = (records: LoginResponseRecord[], keys: string[]) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  return undefined;
};

const getTokenFromPayload = (payload?: LoginResponseShape): string | undefined =>
  firstString(walkAuthPayload(payload), ['token', 'accessToken', 'access_token', 'jwt', 'bearerToken']);

const getRefreshTokenFromPayload = (payload?: LoginResponseShape): string | undefined =>
  firstString(walkAuthPayload(payload), ['refreshToken', 'refresh_token']);

const getUserFromPayload = (payload: LoginResponseShape) => {
  const records = walkAuthPayload(payload);

  for (const record of records) {
    const user = record.user || record.profile || record.account;
    if (isRecord(user)) {
      return user;
    }
  }

  return {};
};

const firstUserString = (userRecord: Record<string, unknown>, dataRecord: Record<string, unknown> | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = userRecord[key] ?? dataRecord?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
};

function normalizeLoginResponse(response: LoginResponseShape, email: string, headers?: Headers): LoginResult {
  const payload = response.data || response;
  const userRecord = getUserFromPayload(payload) as Record<string, unknown>;
  const dataRecord = payload.data as Record<string, unknown> | undefined;
  const authorization = headers?.get('authorization') || headers?.get('Authorization');
  const headerToken = authorization?.replace(/^Bearer\s+/i, '') || headers?.get('x-access-token') || undefined;
  const token = getTokenFromPayload(payload) || headerToken;

  if (!token) {
    throw new Error('Login succeeded but no auth token was returned.');
  }

  return {
    token,
    refreshToken: getRefreshTokenFromPayload(payload),
    user: {
      id: String(userRecord.id || userRecord._id || userRecord.user_id || dataRecord?.id || email),
      email: String(userRecord.email || email),
      name: typeof userRecord.name === 'string' ? userRecord.name : undefined,
      role: typeof userRecord.role === 'string' ? userRecord.role : undefined,
      tenantId: firstUserString(userRecord, dataRecord, ['tenantId', 'tenant_id']),
      activeTenantId: firstUserString(userRecord, dataRecord, ['activeTenantId', 'active_tenant_id']),
      organizationId: firstUserString(userRecord, dataRecord, ['organizationId', 'organization_id', 'orgId']),
    },
  };
}

export async function loginWithEmail(credentials: LoginCredentials) {
  let lastNetworkError: TypeError | null = null;

  for (const baseUrl of getLoginBaseUrls()) {
    try {
      const response = await fetch(buildApiUrl(LOGIN_ENDPOINT, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.text().catch(() => '');

      if (response.status === 404) {
        throw new Error(`Login endpoint was not found on the configured backend URL (${getApiHost()}).`);
      }

      if (!response.ok) {
        const message =
          data && typeof data === 'object'
            ? String(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`)
            : String(data || `HTTP ${response.status}: ${response.statusText}`);
        throw new Error(message);
      }

      if (__DEV__ && data && typeof data === 'object') {
        const payload = data as LoginResponseShape;
        console.info('[auth] Login response received', {
          hasToken: Boolean(getTokenFromPayload(payload)),
          hasUser: Object.keys(getUserFromPayload(payload)).length > 0,
          keys: Object.keys(payload),
        });
      }

      return normalizeLoginResponse(data as LoginResponseShape, credentials.email, response.headers);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Login endpoint was not found')) {
        throw error;
      }

      if (error instanceof TypeError) {
        lastNetworkError = error;
        continue;
      }

      throw error;
    }
  }

  const triedHosts = getLoginBaseUrls()
    .map((url) => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })
    .join(', ');

  if (lastNetworkError) {
    throw new Error(
      `Unable to reach login endpoint. Tried ${triedHosts}. ${lastNetworkError.message || 'Network request failed.'}`,
    );
  }

  throw new Error(`Unable to reach login endpoint. Tried ${triedHosts}.`);
}
