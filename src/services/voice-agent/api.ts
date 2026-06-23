import { apiGet, apiPost, apiPut } from '@/src/api';
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

export async function makeCall(payload: MakeCallRequest) {
  const toNumber = String(payload.phoneNumber || '').trim();
  const fromNumber = payload.fromNumber ? String(payload.fromNumber).trim() : undefined;

  if (!toNumber) {
    throw new Error('Phone number to call is required.');
  }

  const callContext = stringifyCallContext(payload.context);

  // Mirror LAD-Frontend-2's makeCall EXACTLY: 5 fields, no post-call PATCH.
  // Any PATCH within seconds of the POST races the backend agent dispatcher
  // and causes the call to drop before reaching the recipient.
  const ladFrontendPayload = {
    voice_id: 'default',
    agent_id: payload.voiceAgentId,
    to_number: toNumber,
    context: callContext,
    from_number: fromNumber,
  };

  const response = await apiPost<MakeCallResponse>(START_CALL_PATH, ladFrontendPayload);
  return response.data;
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
