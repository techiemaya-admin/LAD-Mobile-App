import { expireAuthSession, getAuthToken, safeStorage } from './storage';
import { Platform } from 'react-native';

export type ApiResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
};

export type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
};

export class ApiRequestError extends Error {
  status: number;
  statusText: string;
  data: unknown;

  constructor(message: string, status: number, statusText: string, data: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export const isApiRequestError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError
  || Boolean(error && typeof error === 'object' && 'status' in error && 'data' in error);

export const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://lad-backend-develop-160078175457.us-central1.run.app';

export const AUTH_API_URL =
  process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ||
  process.env.AUTH_BACKEND_URL ||
  process.env.NEXT_PUBLIC_AUTH_BACKEND_URL ||
  'https://lad-backend-develop-160078175457.us-central1.run.app';

const DEFAULT_WEB_API_URL = 'http://localhost:8091';
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

export const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL || DEFAULT_WEB_API_URL;
export const WEB_API_FALLBACK_URLS = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_WEB_API_URL,
      DEFAULT_WEB_API_URL,
      'http://localhost:8091',
      'http://localhost:8092',
    ].filter((value): value is string => Boolean(value)),
  ),
);
export const WEB_AUTH_API_FALLBACK_URLS = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_WEB_API_URL,
      DEFAULT_WEB_API_URL,
      'http://localhost:8091',
      'http://localhost:8092',
    ].filter((value): value is string => Boolean(value)),
  ),
);

export const RESOLVED_API_URL =
  Platform.OS === 'web'
    ? WEB_API_URL
    : API_URL;

export const RESOLVED_AUTH_API_URL =
  Platform.OS === 'web'
    ? WEB_API_URL
    : AUTH_API_URL;

export const buildApiUrl = (path: string, baseURL = API_URL) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = baseURL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${base}${normalizedPath}`;
};

const getTenantIdFromStoredUser = async () => {
  const selectedTenantId = await safeStorage.getItem('selectedTenantId');
  if (selectedTenantId && selectedTenantId !== 'default') {
    return selectedTenantId;
  }

  for (const key of ['user', 'userData']) {
    const rawUser = await safeStorage.getItem(key);
    if (!rawUser) {
      continue;
    }

    try {
      const user = JSON.parse(rawUser) as Record<string, unknown>;
      const tenantId =
        user.activeTenantId ??
        user.active_tenant_id ??
        user.tenantId ??
        user.tenant_id ??
        user.organizationId ??
        user.organization_id ??
        user.orgId;

      if (tenantId) {
        return String(tenantId);
      }
    } catch {
      // Ignore malformed cached profile data.
    }
  }

  return null;
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL = API_URL) {
    this.baseURL = baseURL;
  }

  private getBaseUrls(path: string) {
    if (Platform.OS !== 'web') {
      return [path.startsWith('/api/auth/') ? RESOLVED_AUTH_API_URL : this.baseURL];
    }

    return path.startsWith('/api/auth/') ? WEB_AUTH_API_FALLBACK_URLS : WEB_API_FALLBACK_URLS;
  }

  private buildUrl(path: string, baseURL: string, options?: RequestOptions) {
    const url = new URL(buildApiUrl(path, baseURL));

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async executeFetch(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ) {
    const token = await getAuthToken();
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const tenantId = await getTenantIdFromStoredUser();
    if (tenantId && !headers['X-Tenant-ID']) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const requestBody = body ? (isFormData ? body as BodyInit : JSON.stringify(body)) : undefined;
    const baseUrls = this.getBaseUrls(path);
    let response: Response | undefined;
    let lastNetworkError: unknown;

    for (const baseURL of baseUrls) {
      try {
        response = await fetch(this.buildUrl(path, baseURL, options), {
          method,
          headers,
          credentials: 'include',
          body: requestBody,
        });
        break;
      } catch (error) {
        lastNetworkError = error;
        if (Platform.OS !== 'web' || !isLocalUrl(baseURL)) {
          throw error;
        }
      }
    }

    if (!response) {
      if (Platform.OS === 'web') {
        throw new Error(
          'Unable to reach the local LAD API proxy. Start the web app with `npm run web` so backend requests are proxied without browser CORS errors.',
        );
      }

      throw lastNetworkError instanceof Error ? lastNetworkError : new Error('Network request failed.');
    }

    return response;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    let response = await this.executeFetch(method, path, body, options);

    if (response.status === 401) {
      await expireAuthSession();
      response = await this.executeFetch(method, path, body, options);
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        await expireAuthSession();
      }

      const dataRecord = data && typeof data === 'object' ? data as Record<string, unknown> : null;
      const primaryMessage = dataRecord
        ? dataRecord.message || dataRecord.error || dataRecord.detail || dataRecord.reason
        : null;
      const secondaryDetails = dataRecord
        ? dataRecord.details || dataRecord.errors || dataRecord.cause
        : null;
      const detailsText = secondaryDetails
        ? typeof secondaryDetails === 'string'
          ? secondaryDetails
          : JSON.stringify(secondaryDetails)
        : '';
      const message = primaryMessage
        ? `${String(primaryMessage)}${detailsText ? `: ${detailsText}` : ''}`
        : `HTTP ${response.status}: ${response.statusText}`;

      throw new ApiRequestError(message, response.status, response.statusText, data);
    }

    return {
      data: data as T,
      status: response.status,
      statusText: response.statusText,
    };
  }

  get<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, body, options);
  }

  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, undefined, options);
  }

  setBaseURL(url: string) {
    this.baseURL = url;
  }

  getBaseURL() {
    return this.baseURL;
  }
}

export const apiClient = new ApiClient(RESOLVED_API_URL);

export const apiGet = <T = unknown>(path: string, options?: RequestOptions) =>
  apiClient.get<T>(path, options);
export const apiPost = <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
  apiClient.post<T>(path, body, options);
export const apiPut = <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
  apiClient.put<T>(path, body, options);
export const apiPatch = <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
  apiClient.patch<T>(path, body, options);
export const apiDelete = <T = unknown>(path: string, options?: RequestOptions) =>
  apiClient.delete<T>(path, options);

export type { ApiClient };

