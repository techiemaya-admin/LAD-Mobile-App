/**
 * Shared API Client for LAD Frontend SDK
 *
 * The mobile app runs LAD frontend SDK modules inside Expo. On web, direct
 * Cloud Run calls are blocked by browser CORS, so SDK calls must use the same
 * local API proxy as the main app API client.
 */
import { safeStorage } from './storage';

type ApiResponse<T = any> = {
  data: T;
  status: number;
  statusText: string;
};

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, any>;
};

const DEFAULT_BACKEND_URL = 'https://lad-backend-develop-160078175457.us-central1.run.app';
const DEFAULT_WEB_API_URL = 'http://localhost:8091';

const isWeb = () => typeof window !== 'undefined';
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

const unique = (items: Array<string | undefined>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

const getBackendUrl = () =>
  (
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, '');

const getWebBaseUrls = () =>
  unique([
    process.env.EXPO_PUBLIC_WEB_API_URL,
    DEFAULT_WEB_API_URL,
    'http://localhost:8091',
    'http://localhost:8092',
  ]);

const getTenantId = () => {
  const selectedTenantId = safeStorage.getItem('selectedTenantId');
  if (selectedTenantId && selectedTenantId !== 'default') {
    return selectedTenantId;
  }

  for (const key of ['user', 'userData']) {
    const rawUser = safeStorage.getItem(key);
    if (!rawUser) continue;

    try {
      const user = JSON.parse(rawUser) as Record<string, any>;
      const tenantId =
        user.activeTenantId ??
        user.active_tenant_id ??
        user.tenantId ??
        user.tenant_id ??
        user.organizationId ??
        user.organization_id ??
        user.orgId;

      if (tenantId) return String(tenantId);
    } catch {
      // Ignore malformed cached profile data.
    }
  }

  return null;
};

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = isWeb()
      ? process.env.EXPO_PUBLIC_WEB_API_URL || DEFAULT_WEB_API_URL
      : getBackendUrl();
  }

  private getBaseUrls() {
    return isWeb() ? getWebBaseUrls() : [this.baseURL || getBackendUrl()];
  }

  private buildUrl(path: string, baseURL: string, options?: RequestOptions) {
    const base = baseURL.replace(/\/+$/, '');
    const normalizedPath = /^https?:\/\//i.test(path)
      ? path
      : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const url = new URL(normalizedPath);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private getHeaders(options?: RequestOptions) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    const token = safeStorage.getItem('token') || safeStorage.getItem('userToken') || safeStorage.getItem('auth_token');
    const tenantId = getTenantId();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (tenantId && !headers['X-Tenant-ID']) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const headers = this.getHeaders(options);
    let response: Response | undefined;
    let lastNetworkError: unknown;

    for (const baseURL of this.getBaseUrls()) {
      try {
        response = await fetch(this.buildUrl(path, baseURL, options), {
          method,
          headers,
          credentials: 'include',
          body: body ? JSON.stringify(body) : undefined,
        });
        break;
      } catch (error) {
        lastNetworkError = error;
        if (!isWeb() || !isLocalUrl(baseURL)) {
          throw error;
        }
      }
    }

    if (!response) {
      throw lastNetworkError instanceof Error
        ? lastNetworkError
        : new Error('Unable to reach the local LAD API proxy. Start the web app with `npm run web`.');
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const errorData = data && typeof data === 'object' ? data as Record<string, any> : {};
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      data: data as T,
      status: response.status,
      statusText: response.statusText,
    };
  }

  async get<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  setBaseURL(url: string) {
    this.baseURL = url;
  }

  getBaseURL(): string {
    return this.baseURL;
  }
}

export const apiClient = new ApiClient();

export const apiGet = <T = any>(path: string, options?: RequestOptions) =>
  apiClient.get<T>(path, options);
export const apiPost = <T = any>(path: string, body?: any, options?: RequestOptions) =>
  apiClient.post<T>(path, body, options);
export const apiPut = <T = any>(path: string, body?: any, options?: RequestOptions) =>
  apiClient.put<T>(path, body, options);
export const apiDelete = <T = any>(path: string, options?: RequestOptions) =>
  apiClient.delete<T>(path, options);
export const apiPatch = <T = any>(path: string, body?: any, options?: RequestOptions) =>
  apiClient.patch<T>(path, body, options);

export type { ApiClient, ApiResponse, RequestOptions };
