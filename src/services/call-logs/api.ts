import { apiGet, apiPost, buildApiUrl, getAuthToken, RESOLVED_API_URL } from '@/src/api';
import type {
  BatchApiResponse,
  CallLogsResponse,
  CallLogsStats,
  CallLeadResponse,
  CallLogsStreamHandle,
  EndCallParams,
  GetCallLogsParams,
  RecordingSignedUrlParams,
  RecordingSignedUrlResponse,
  RetryCallsParams,
} from './types';

type RawRecord = Record<string, any>;

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};

const parseRecord = (value: unknown): RawRecord => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return {};
    }
  }

  return asRecord(value);
};

const normalizeCallLogItem = (item: unknown) => {
  const record = asRecord(item);
  const metadataSource = record.metadata ?? record.meta_data ?? record.meta;
  const metadata = parseRecord(metadataSource);
  const sipTrail = parseRecord(metadata.sip_trail);
  const analysis = parseRecord(record.analysis);
  const rawAnalysis = parseRecord(analysis.raw_analysis);
  const dispositionFull = parseRecord(rawAnalysis.disposition_full);
  const statusReason =
    record.status_reason ||
    metadata.status_reason ||
    sipTrail.status_reason;
  const disposition =
    analysis.disposition ||
    record.disposition ||
    rawAnalysis.disposition ||
    rawAnalysis.lead_disposition ||
    dispositionFull.disposition ||
    'N/A';

  return {
    ...record,
    metadata: metadataSource,
    status_reason: statusReason,
    disposition,
    outcome:
      record.outcome ||
      record.call_outcome ||
      metadata.outcome ||
      metadata.call_outcome ||
      metadata.disposition ||
      statusReason ||
      disposition,
  };
};

const extractLogsArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const record = data as RawRecord;
  if (Array.isArray(record.logs)) return record.logs;
  if (Array.isArray(record.raw_logs)) return record.raw_logs;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.calls)) return record.calls;
  if (record.data && typeof record.data === 'object') return extractLogsArray(record.data);
  if (record.result && typeof record.result === 'object') return extractLogsArray(record.result);
  return [];
};

const extractPagination = (data: unknown): RawRecord => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const record = data as RawRecord;
  if (record.pagination && typeof record.pagination === 'object') return record.pagination as RawRecord;
  if (record.data && typeof record.data === 'object') return extractPagination(record.data);
  if (record.result && typeof record.result === 'object') return extractPagination(record.result);
  return {};
};

const CALL_LOGS_CACHE_MS = 3000;
const callLogsCache = new Map<string, { fetchedAt: number; value: CallLogsResponse }>();
const callLogsInFlight = new Map<string, Promise<CallLogsResponse>>();

const getParamsKey = (params?: GetCallLogsParams) =>
  JSON.stringify(Object.entries(params || {}).sort(([first], [second]) => first.localeCompare(second)));

const fetchAndNormalizeCallLogs = async (params?: GetCallLogsParams) => {
  const response = await apiGet<CallLogsResponse>('/api/voice-agent/calls', {
    params: params as Record<string, unknown> | undefined,
  });
  const rawData = response.data as any;
  const rawLogs = extractLogsArray(rawData);
  const pagination = extractPagination(rawData);

  return {
    ...(rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {}),
    logs: rawLogs.map(normalizeCallLogItem),
    pagination: Object.keys(pagination).length ? pagination : undefined,
  } as CallLogsResponse;
};

export async function getCallLogs(params?: GetCallLogsParams) {
  const key = getParamsKey(params);
  const cached = callLogsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CALL_LOGS_CACHE_MS) {
    return cached.value;
  }

  const existing = callLogsInFlight.get(key);
  if (existing) {
    return existing;
  }

  const request = fetchAndNormalizeCallLogs(params);
  callLogsInFlight.set(key, request);
  try {
    const value = await request;
    callLogsCache.set(key, { value, fetchedAt: Date.now() });
    return value;
  } finally {
    callLogsInFlight.delete(key);
  }
}

const unwrapCallLogs = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as any;
    if (Array.isArray(record.logs)) return record.logs;
    if (Array.isArray(record.raw_logs)) return record.raw_logs;
    if (Array.isArray(record.call_logs)) return record.call_logs;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.calls)) return record.calls;
    if (record.data && typeof record.data === 'object') return unwrapCallLogs(record.data);
    if (record.result && typeof record.result === 'object') return unwrapCallLogs(record.result);
  }

  return [];
};

const phoneDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const phoneTail = (value: unknown) => phoneDigits(value).slice(-10);

const PHONE_SEARCH_CACHE_MS = 15000;
const phoneSearchCache = new Map<string, { fetchedAt: number; value: RawRecord[] }>();
const phoneSearchInFlight = new Map<string, Promise<RawRecord[]>>();

const collectPhoneCandidates = (item: unknown) => {
  const record = asRecord(item);
  const metadata = parseRecord(record.metadata ?? record.meta_data ?? record.meta);
  const contact = parseRecord(record.contact);
  const lead = parseRecord(record.lead);
  const baseNumber = record.to_base_number ?? record.base_number ?? metadata.to_base_number ?? metadata.base_number;
  const countryCode = record.to_country_code ?? record.country_code ?? metadata.to_country_code ?? metadata.country_code;

  return [
    record.to_number,
    record.phone,
    record.phone_number,
    record.lead_phone,
    record.local_dialed_number,
    record.lad_app_dialed_number,
    metadata.to_number,
    metadata.phone,
    metadata.phone_number,
    metadata.local_dialed_number,
    metadata.lad_app_dialed_number,
    contact.phone,
    contact.phone_number,
    lead.phone,
    lead.phone_number,
    baseNumber,
    baseNumber ? `${countryCode || ''}${baseNumber}` : '',
  ].filter(Boolean);
};

const logMatchesPhone = (item: unknown, digits: string, last10: string) => {
  if (!digits && !last10) {
    return false;
  }

  return collectPhoneCandidates(item).some((candidate) => {
    const candidateDigits = phoneDigits(candidate);
    return candidateDigits === digits ||
      Boolean(last10 && candidateDigits.endsWith(last10)) ||
      Boolean(last10 && phoneTail(candidateDigits) === last10);
  });
};

const uniqueLogs = (logs: unknown[]) => {
  const seen = new Set<string>();
  return logs.filter((item, index) => {
    const record = item && typeof item === 'object' ? item as any : {};
    const id = String(record.call_log_id ?? record.id ?? record.call_id ?? `idx-${index}`);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

export async function searchCallLogsForPhone(phone: string) {
  const digits = phoneDigits(phone);
  const last10 = digits.slice(-10);
  const cacheKey = last10 || digits || phone.trim();
  if (!cacheKey) {
    return [];
  }

  const cached = phoneSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < PHONE_SEARCH_CACHE_MS) {
    return cached.value;
  }

  const existing = phoneSearchInFlight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const searchValue = last10 || digits || phone.trim();
    const queries = [
      ['/api/voice-agent/calls', { page: 1, limit: 100, search: searchValue }],
      ['/api/voice-agent/calls', { page: 1, limit: 100, phone: searchValue }],
      ['/api/voice-agent/calllogs', { page: 1, limit: 100, search: searchValue }],
    ] as const;
    const collected: unknown[] = [];

    for (const [path, params] of queries) {
      try {
        const response = await apiGet<unknown>(path, { params });
        const matches = unwrapCallLogs(response.data).filter((item: unknown) => logMatchesPhone(item, digits, last10));
        collected.push(...matches);
        if (matches.length) {
          break;
        }
      } catch {
        // Try the next lightweight query shape.
      }
    }

    const value = uniqueLogs(collected).map(normalizeCallLogItem);
    phoneSearchCache.set(cacheKey, { value, fetchedAt: Date.now() });
    return value;
  })();

  phoneSearchInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    phoneSearchInFlight.delete(cacheKey);
  }
}

export async function getCallLog(callId: string) {
  const response = await apiGet<unknown>(`/api/voice-agent/calls/${callId}`);
  const rawData = response.data;

  if (Array.isArray(rawData)) {
    return rawData.map(normalizeCallLogItem);
  }

  if (rawData && typeof rawData === 'object') {
    const record = rawData as RawRecord;
    if (Array.isArray(record.data)) {
      return { ...record, data: record.data.map(normalizeCallLogItem) };
    }
    if (record.data && typeof record.data === 'object') {
      return { ...record, data: normalizeCallLogItem(record.data) };
    }
    if (Array.isArray(record.call)) {
      return { ...record, call: record.call.map(normalizeCallLogItem) };
    }
    if (record.call && typeof record.call === 'object') {
      return { ...record, call: normalizeCallLogItem(record.call) };
    }
    if (Array.isArray(record.call_log)) {
      return { ...record, call_log: record.call_log.map(normalizeCallLogItem) };
    }
    if (record.call_log && typeof record.call_log === 'object') {
      return { ...record, call_log: normalizeCallLogItem(record.call_log) };
    }
  }

  return normalizeCallLogItem(rawData);
}

export async function getCallLead(callId: string) {
  const response = await apiGet<CallLeadResponse>(`/api/voice-agent/calls/${callId}/lead`);
  return response.data;
}

export async function getBatchStatus(batchJobId: string) {
  const response = await apiGet<BatchApiResponse>(`/api/voice-agent/batch/batch-status/${batchJobId}`);
  return response.data;
}

export async function endCall({ callId }: EndCallParams) {
  await apiPost(`/api/voice-agent/calls/${callId}/end`, {});
}

export async function getRecordingSignedUrl({ callId }: RecordingSignedUrlParams) {
  const response = await apiGet<RecordingSignedUrlResponse>(
    `/api/voice-agent/calls/${callId}/recording-signed-url`,
  );
  return response.data;
}

export async function retryFailedCalls(params: RetryCallsParams) {
  await apiPost('/api/voice-agent/calls/retry', params);
}

export async function getCallLogsStats(tenantId: string) {
  const response = await apiGet<CallLogsStats>('/api/voice-agent/calls/stats', {
    params: { tenant_id: tenantId },
  });

  return response.data;
}

export function subscribeToCallLogsStream(onMessage: (callLog: unknown) => void): CallLogsStreamHandle {
  let controller: AbortController | null = null;
  let closed = false;
  let reconnectDelay = 1500;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RECONNECT_DELAY = 30000;

  const scheduleReconnect = () => {
    if (closed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!closed) void start();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  };

  const start = async () => {
    if (closed) return;
    controller = new AbortController();
    try {
      const token = await getAuthToken();
      const response = await fetch(buildApiUrl('/api/voice-agent/calls/stream', RESOLVED_API_URL), {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        closed = true;
        return;
      }

      // React Native's fetch does not expose a readable stream body. Without
      // getReader() we can't consume SSE, so close quietly instead of looping
      // reconnect attempts forever (which surfaced as repeated network errors).
      if (!response.body || typeof (response.body as ReadableStream).getReader !== 'function') {
        closed = true;
        return;
      }

      // Reset backoff once the stream is open and serving data.
      reconnectDelay = 1500;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        parts.forEach((part) => {
          const dataLine = part.split('\n').find((line) => line.startsWith('data:'));
          const raw = dataLine?.slice(5).trim();
          if (!raw || raw === '[DONE]') {
            return;
          }
          try {
            onMessage(normalizeCallLogItem(JSON.parse(raw)));
          } catch {
            // Ignore malformed stream events.
          }
        });
      }

      // Connection closed by server — try to reconnect if we didn't intentionally close.
      if (!closed) scheduleReconnect();
    } catch {
      closed = true;
    }
  };

  void start();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      controller?.abort();
    },
  };
}
