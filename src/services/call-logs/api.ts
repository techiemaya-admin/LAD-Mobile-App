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

export async function getCallLogs(params?: GetCallLogsParams) {
  const response = await apiGet<CallLogsResponse>('/api/voice-agent/calls', {
    params: params as Record<string, unknown> | undefined,
  });
  const rawData = response.data as any;
  const rawLogs = Array.isArray(rawData)
    ? rawData
    : rawData?.logs || rawData?.raw_logs || rawData?.data || rawData?.items || rawData?.results || [];

  return {
    ...(rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {}),
    logs: Array.isArray(rawLogs)
      ? rawLogs.map((item: any) => ({
          ...item,
          disposition:
            item.disposition ||
            item.analysis?.disposition ||
            item.analysis?.raw_analysis?.disposition ||
            item.analysis?.raw_analysis?.lead_disposition ||
            'N/A',
        }))
      : [],
  } as CallLogsResponse;
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
  const queries = [
    ['/api/voice-agent/calls', { page: 1, limit: 1000 }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, search: phone }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, q: phone }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, phone }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, to_number: phone }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, search: digits }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, search: last10 }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, phone: last10 }],
    ['/api/voice-agent/calls', { page: 1, limit: 250, to_number: last10 }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 1000 }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, search: phone }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, phone }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, to_number: phone }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, search: last10 }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, phone: last10 }],
    ['/api/voice-agent/calllogs', { page: 1, limit: 250, to_number: last10 }],
  ] as const;

  const responses = await Promise.allSettled(
    queries.map(([path, params]) => apiGet<unknown>(path, { params })),
  );

  return uniqueLogs(responses.flatMap((result) => (
    result.status === 'fulfilled' ? unwrapCallLogs(result.value.data) : []
  )));
}

export async function getCallLog(callId: string) {
  const response = await apiGet<unknown>(`/api/voice-agent/calls/${callId}`);
  return response.data;
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
  const controller = new AbortController();
  let closed = false;

  const start = async () => {
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

      if (!response.ok || !response.body) {
        return;
      }

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
            onMessage(JSON.parse(raw));
          } catch {
            // Ignore malformed stream events.
          }
        });
      }
    } catch {
      // Stream is best-effort; polling remains the fallback.
    }
  };

  void start();

  return {
    close: () => {
      closed = true;
      controller.abort();
    },
  };
}
