import { apiGet, apiPost, apiPut } from "../../shared/apiClient";
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
} from "./types";

export async function getUserAvailableAgents(): Promise<UserAvailableAgent[]> {
  const response = await apiGet<{ success: boolean; data: UserAvailableAgent[]; count: number }>(
    "/api/voice-agent/user/available-agents",
  );
  return response.data.data || [];
}

export async function getUserAvailableNumbers(): Promise<UserAvailableNumber[]> {
  const response = await apiGet<{ success: boolean; data: UserAvailableNumber[]; count: number }>(
    "/api/voice-agent/user/available-numbers",
  );
  return response.data.data || [];
}

export async function resolvePhones(
  ids: string[],
  type: VoiceAgentTargetType,
): Promise<ResolvePhonesResponse> {
  const response = await apiPost<ResolvePhonesResponse>(
    "/api/voice-agent/resolve-phones",
    { ids, type },
  );
  return response.data;
}

export async function makeCall(payload: MakeCallRequest): Promise<MakeCallResponse> {
  // Transform phoneNumber to to_number and add voice_id to match backend API expectations
  const apiPayload = {
    voice_id: "default", // Required by V2 API
    agent_id: payload.voiceAgentId,
    to_number: payload.phoneNumber,
    context: payload.context,
    from_number: payload.fromNumber,
  };
  const response = await apiPost<MakeCallResponse>(
    "/api/voice-agent/calls/start-call",
    apiPayload,
  );
  return response.data;
}

export async function triggerBatchCall(
  payload: TriggerBatchCallRequest,
): Promise<TriggerBatchCallResponse> {
  const response = await apiPost<TriggerBatchCallResponse>(
    "/api/voice-agent/batch/trigger-batch-call",
    payload,
  );
  return response.data;
}

export async function updateSummary(
  payload: UpdateSummaryRequest,
): Promise<UpdateSummaryResponse> {
  const response = await apiPut<UpdateSummaryResponse>(
    "/api/voice-agent/update-summary",
    payload,
  );
  return response.data;
}
