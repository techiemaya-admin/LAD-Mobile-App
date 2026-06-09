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

const splitDialNumber = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (cleaned.startsWith('+91') && digits.length > 10) {
    return { to_country_code: '+91', to_base_number: digits.slice(2) };
  }

  if (cleaned.startsWith('+1') && digits.length > 10) {
    return { to_country_code: '+1', to_base_number: digits.slice(1) };
  }

  return {
    to_country_code: cleaned.startsWith('+') && digits.length > 10 ? `+${digits.slice(0, digits.length - 10)}` : '',
    to_base_number: digits.length > 10 ? digits.slice(-10) : digits,
  };
};

const shouldTryLegacyCallPayload = (error: unknown) =>
  isApiRequestError(error) && [400, 402, 422].includes(error.status);

const withPrimaryErrorContext = (primaryError: unknown, fallbackError: unknown) => {
  if (!isApiRequestError(fallbackError)) {
    return fallbackError;
  }

  const primaryStatus = isApiRequestError(primaryError) ? primaryError.status : null;
  const prefix = fallbackError.status === 402 || primaryStatus === 402
    ? 'Backend rejected the voice-agent call with 402. This usually means the selected voice account, billing credits, or provider plan is blocking outbound calls.'
    : 'Backend rejected the voice-agent call.';

  return new Error(`${prefix} ${fallbackError.message}`);
};

export async function makeCall(payload: MakeCallRequest) {
  const toNumber = String(payload.phoneNumber || '').trim();
  const fromNumber = payload.fromNumber ? String(payload.fromNumber).trim() : undefined;

  if (!toNumber) {
    throw new Error('Phone number to call is required.');
  }

  const callContext = stringifyCallContext(payload.context);
  const dialParts = splitDialNumber(toNumber);

  // Keep the primary request identical to LAD-Frontend-2's V2 SDK contract.
  // Local correlation fields are stored only in the temporary app row, not in
  // the backend call payload.
  const apiPayload = {
    voice_id: 'default',
    agent_id: payload.voiceAgentId,
    to_number: toNumber,
    context: callContext,
    from_number: fromNumber,
  };

  try {
    const response = await apiPost<MakeCallResponse>(START_CALL_PATH, apiPayload);
    return response.data;
  } catch (primaryError) {
    if (!shouldTryLegacyCallPayload(primaryError)) {
      throw primaryError;
    }

    const legacyPayload = {
      voice_id: 'default',
      agent_id: payload.voiceAgentId,
      voice_agent_id: payload.voiceAgentId,
      to_number: toNumber,
      phone_number: toNumber,
      ...dialParts,
      context: callContext,
      added_context: callContext,
      from_number: fromNumber,
      call_type: 'manual_dial',
      source: 'lad_mobile_app',
      trigger_source: 'manual_dial',
      triggered_by: 'manual_dial',
      client_call_id: payload.clientCallId,
      clientCallId: payload.clientCallId,
      lead_name: 'Manual dial',
      lad_app_dialed_number: toNumber,
      local_dialed_number: toNumber,
      metadata: {
        client_call_id: payload.clientCallId,
        lad_app_dialed_number: toNumber,
        local_dialed_number: toNumber,
        to_number: toNumber,
        call_type: 'manual_dial',
        source: 'lad_mobile_app',
      },
    };

    try {
      const response = await apiPost<MakeCallResponse>(START_CALL_PATH, legacyPayload);
      return response.data;
    } catch (fallbackError) {
      throw withPrimaryErrorContext(primaryError, fallbackError);
    }
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
