import { apiGet, apiPost, apiPut, isApiRequestError } from '@/src/api';
import type {
  MakeCallRequest,
  MakeCallResponse,
  ResolvePhonesResponse,
  TriggerBatchCallRequest,
  TriggerBatchCallResponse,
  UpdateSummaryRequest,
  UpdateSummaryResponse,
  UserAvailableAgent,
  UserAvailableNumber,
  VoiceAgentTargetType,
} from './types';

export async function getUserAvailableAgents() {
  const response = await apiGet<{ success: boolean; data: UserAvailableAgent[]; count: number }>(
    '/api/voice-agent/user/available-agents',
  );

  return response.data.data || [];
}

export async function getUserAvailableNumbers() {
  const response = await apiGet<{ success: boolean; data: UserAvailableNumber[]; count: number }>(
    '/api/voice-agent/user/available-numbers',
  );

  return response.data.data || [];
}

export async function resolvePhones(ids: string[], type: VoiceAgentTargetType) {
  const response = await apiPost<ResolvePhonesResponse>('/api/voice-agent/resolve-phones', {
    ids,
    type,
  });

  return response.data;
}

const stringifyCallContext = (context: MakeCallRequest['context']) => {
  if (!context) {
    return '';
  }

  if (typeof context === 'string') {
    return context;
  }

  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
};

const START_CALL_PATH = '/api/voice-agent/calls/start-call';

const normalizeContactName = (value?: string) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(manual\s+)?dial$/i, '')
    .trim();

// LAD-Frontend-2's makeCall (sdk/features/voice-agent/api.ts) only ever sends the
// minimal 5-field payload below and it works reliably. Our richer payload adds
// contact/lead/metadata fields the backend may reject for reasons we can't predict
// from status code alone, so any HTTP-level rejection falls back to that same
// known-good shape rather than guessing which errors are "retriable".
const shouldRetryWithMinimalStartPayload = (error: unknown) => isApiRequestError(error);

export async function makeCall(payload: MakeCallRequest) {
  const toNumber = String(payload.phoneNumber || '').trim();
  const fromNumber = payload.fromNumber ? String(payload.fromNumber).trim() : undefined;

  if (!toNumber) {
    throw new Error('Phone number to call is required.');
  }

  const callContext = stringifyCallContext(payload.context);

  const contactName = normalizeContactName(payload.contactName);
  const metadata = {
    ...(payload.metadata || {}),
    source_table: 'lad_stage.voice_call_logs',
    ...(contactName ? {
      lead_name: contactName,
      contact_name: contactName,
      manual_contact_name: contactName,
      name: contactName,
      full_name: contactName,
      customer_name: contactName,
    } : {}),
    ...(payload.clientCallId ? {
      client_call_id: payload.clientCallId,
      request_id: payload.clientCallId,
      idempotency_key: payload.clientCallId,
    } : {}),
    ...(payload.startedAt ? { local_started_at: payload.startedAt, started_at_client: payload.startedAt } : {}),
    to_number: toNumber,
    phone: toNumber,
    phone_number: toNumber,
  };

  // Keep the start-call POST as the only backend write. Include lead/contact
  // fields here so call-log persistence can store the display name directly.
  const ladFrontendPayload = {
    voice_id: 'default',
    agent_id: payload.voiceAgentId,
    to_number: toNumber,
    context: callContext,
    from_number: fromNumber,
    ...(payload.fromNumberId ? { from_number_id: payload.fromNumberId } : {}),
    ...(contactName ? {
      lead_name: contactName,
      contact_name: contactName,
      manual_contact_name: contactName,
      name: contactName,
      full_name: contactName,
      customer_name: contactName,
      contact: {
        name: contactName,
        full_name: contactName,
        phone: toNumber,
        phone_number: toNumber,
      },
      lead: {
        name: contactName,
        full_name: contactName,
        phone: toNumber,
        phone_number: toNumber,
      },
    } : {}),
    ...(payload.clientCallId ? {
      client_call_id: payload.clientCallId,
      request_id: payload.clientCallId,
      idempotency_key: payload.clientCallId,
    } : {}),
    ...(payload.startedAt ? {
      local_started_at: payload.startedAt,
      started_at_client: payload.startedAt,
    } : {}),
    source_table: 'lad_stage.voice_call_logs',
    metadata,
  };

  try {
    const response = await apiPost<MakeCallResponse>(START_CALL_PATH, ladFrontendPayload);
    return response.data;
  } catch (error) {
    if (!shouldRetryWithMinimalStartPayload(error)) {
      throw error;
    }

    const minimalPayload = {
      voice_id: 'default',
      agent_id: payload.voiceAgentId,
      to_number: toNumber,
      context: callContext,
      from_number: fromNumber,
    };
    const response = await apiPost<MakeCallResponse>(START_CALL_PATH, minimalPayload);
    return response.data;
  }
}

export async function triggerBatchCall(payload: TriggerBatchCallRequest) {
  const response = await apiPost<TriggerBatchCallResponse>(
    '/api/voice-agent/batch/trigger-batch-call',
    payload,
  );

  return response.data;
}

export async function updateSummary(payload: UpdateSummaryRequest) {
  const response = await apiPut<UpdateSummaryResponse>('/api/voice-agent/update-summary', payload);
  return response.data;
}
