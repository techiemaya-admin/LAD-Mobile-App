import { create } from 'zustand';
import { safeStorage } from '@/src/api';
import { getSocket } from '@/src/services/socketService';
import { getCallLogs, searchCallLogsForPhone, subscribeToCallLogsStream } from '@/src/services/call-logs';
import type { CallLogResponse } from '@/src/services/call-logs';
import {
  categorizeLead,
  getEngagementScore,
  getLeadTemperatureColor,
} from '@/src/services/leadCategorization';
import type { CallRecord, CallStatus, CallType } from '@/types/calls';

type RawRecord = Record<string, any>;
const CALL_PAGE_SIZE = 25;
const CALL_RECONCILE_PAGE_SIZE = 100;
const OPTIMISTIC_CALL_TTL_MS = 5 * 60 * 1000;
const MANUAL_DIAL_PENDING_WINDOW_MS = 3 * 60 * 1000;
const MANUAL_DIAL_PENDING_CALL_TTL_MS = 24 * 60 * 60 * 1000;
const MANUAL_DIAL_OVERRIDES_KEY = 'lad.manualDialCallOverrides.v1';
const MANUAL_DIAL_PENDING_CALLS_KEY = 'lad.pendingManualDialCalls.v1';

interface CallState {
  calls: CallRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  lastFetchedAt: number | null;

  initializeRealtime: () => void;
  disposeRealtime: () => void;
  fetchCalls: () => Promise<void>;
  fetchNextCalls: () => Promise<void>;
  setCalls: (calls: CallRecord[]) => void;
  prependCall: (call: CallRecord) => void;
  prependCalls: (calls: CallRecord[]) => void;
}

let callListenersAttached = false;
let callLogStream: { close: () => void } | null = null;
let manualDialOverridesLoaded = false;
let pendingManualCallsLoaded = false;
let pendingManualPollTimer: ReturnType<typeof setTimeout> | null = null;
const manualDialOverrides = new Map<string, { phone: string; startedAt: string }>();
const pendingManualCalls = new Map<string, CallRecord>();

const loadManualDialOverrides = async () => {
  if (manualDialOverridesLoaded) {
    return;
  }

  manualDialOverridesLoaded = true;
  const raw = await safeStorage.getItem(MANUAL_DIAL_OVERRIDES_KEY).catch(() => null);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, { phone?: string; startedAt?: string }>;
    Object.entries(parsed).forEach(([callId, value]) => {
      if (value?.phone && !isBackendPlaceholderNumber(value.phone)) {
        manualDialOverrides.set(callId, {
          phone: value.phone,
          startedAt: value.startedAt || new Date().toISOString(),
        });
      }
    });
  } catch {
    // Ignore malformed local override data.
  }
};

const saveManualDialOverrides = () => {
  const payload = Object.fromEntries(manualDialOverrides.entries());
  void safeStorage.setItem(MANUAL_DIAL_OVERRIDES_KEY, JSON.stringify(payload));
};

export const registerManualDialCallOverride = (callId: string, phone: string, startedAt = new Date().toISOString()) => {
  if (!callId || !phone) {
    return;
  }

  if (isBackendPlaceholderNumber(phone)) {
    manualDialOverrides.delete(callId);
  } else {
    manualDialOverrides.set(callId, { phone, startedAt });
  }
  saveManualDialOverrides();
};

const normalizeCallStatus = (value?: string): CallStatus => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (
    normalizedValue === 'queued' ||
    normalizedValue === 'ringing' ||
    normalizedValue === 'in_progress' ||
    normalizedValue === 'completed' ||
    normalizedValue === 'ended' ||
    normalizedValue === 'failed' ||
    normalizedValue === 'no-answer' ||
    normalizedValue === 'dropped'
  ) {
    return normalizedValue as CallStatus;
  }

  if (normalizedValue === 'no_answer' || normalizedValue === 'no answer') {
    return 'no-answer';
  }

  if (normalizedValue === 'success' || normalizedValue === 'answered' || normalizedValue === 'complete') {
    return 'completed';
  }

  if (normalizedValue === 'active' || normalizedValue === 'processing' || normalizedValue === 'initiated') {
    return 'in_progress';
  }

  return 'queued';
};

const isManualDialLog = (log: CallLogResponse & RawRecord) => {
  const values = [
    log.call_type,
    log.type,
    log.source,
    log.trigger_source,
    log.triggered_by,
    log.origin,
    log.context,
    log.added_context,
    log.client_call_id,
    log.clientCallId,
  ].map((value) => String(value ?? '').toLowerCase());

  return values.some((value) => /manual[\s_-]?dial|manual/.test(value));
};

const normalizeCallType = (log: CallLogResponse & RawRecord): CallType => {
  if (isManualDialLog(log)) {
    return 'manual-dial';
  }

  const direction = log.direction ?? log.call_type;
  const status = normalizeCallStatus(log.status);

  if (status === 'failed' || status === 'no-answer' || status === 'dropped') {
    return 'missed';
  }

  return direction === 'inbound' ? 'incoming' : 'outgoing';
};

const formatCallTime = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getLeadName = (log: CallLogResponse) => {
  const fullName = [log.lead_first_name, log.lead_last_name].filter(Boolean).join(' ').trim();
  const rawLog = log as CallLogResponse & RawRecord;
  const contact = rawLog.contact && typeof rawLog.contact === 'object' ? rawLog.contact as RawRecord : {};
  const lead = rawLog.lead && typeof rawLog.lead === 'object' ? rawLog.lead as RawRecord : {};
  const contactFullName = [contact.first_name ?? contact.firstName, contact.last_name ?? contact.lastName].filter(Boolean).join(' ').trim();
  const leadFullName = [lead.first_name ?? lead.firstName, lead.last_name ?? lead.lastName].filter(Boolean).join(' ').trim();
  const dialedNumber = getDialedNumber(rawLog);
  return String(
    log.lead_name ||
      rawLog.contact_name ||
      fullName ||
      contact.name ||
      contact.full_name ||
      contactFullName ||
      lead.name ||
      lead.full_name ||
      leadFullName ||
      log.lead_id ||
      dialedNumber ||
      rawLog.to_number ||
      rawLog.phone ||
      'Unknown lead',
  );
};

const getTranscript = (log: CallLogResponse & RawRecord) =>
  String(log.transcript ?? log.call_transcript ?? log.transcription ?? 'Transcript is not available yet.');

const getSummary = (log: CallLogResponse & RawRecord, leadName: string, status: CallStatus) => {
  const analysis = log.analysis && typeof log.analysis === 'object' ? log.analysis as RawRecord : {};
  const rawAnalysis =
    analysis.raw_analysis && typeof analysis.raw_analysis === 'object' ? analysis.raw_analysis as RawRecord : {};
  const summary = log.aiSummary ?? log.ai_summary ?? log.summary ?? analysis.summary ?? rawAnalysis.summary;
  if (summary && typeof summary === 'object') {
    return summary;
  }

  const completed = status === 'completed' || status === 'ended';
  return {
    customerIntent: completed
      ? `${leadName} completed an AI voice conversation.`
      : `No full customer intent was captured for ${leadName}.`,
    callOutcome: completed ? 'Conversation completed and is ready for review.' : 'Call did not complete.',
    discussionPoints: completed
      ? ['Review transcript and engagement score.', 'Use lead temperature for prioritization.']
      : ['No meaningful discussion captured.'],
    followUpSuggestion: completed ? 'Follow up based on lead temperature.' : 'Retry at a better time window.',
  };
};

const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const pickLadFrontendDuration = (...values: unknown[]) => {
  const firstPositive = values.map(toFiniteNumber).find((value) => value > 0);
  return firstPositive ?? 0;
};

const extractCategoryFromTags = (tags: unknown) => {
  if (!Array.isArray(tags)) {
    return '';
  }

  const categoryTag = tags.find((tag) => String(tag).toLowerCase().startsWith('category:'));
  const category = String(categoryTag ?? '').split(':')[1]?.toLowerCase();
  return category === 'hot' || category === 'warm' || category === 'cold' ? category : '';
};

const normalizeLeadTemperature = (value: unknown) => {
  const category = String(value ?? '').toLowerCase();
  return category === 'hot' || category === 'warm' || category === 'cold' ? category : '';
};

const getRawDetails = (call: CallRecord) =>
  call.backendDetails && typeof call.backendDetails === 'object'
    ? call.backendDetails as RawRecord
    : {};

const getLocalDialedNumber = (record: RawRecord) => {
  const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata as RawRecord : {};
  return String(
    record.local_dialed_number ??
      record.lad_app_dialed_number ??
      metadata.local_dialed_number ??
      metadata.lad_app_dialed_number ??
      '',
  );
};

const getLocalStartedAt = (record: RawRecord) => {
  const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata as RawRecord : {};
  const value = record.local_started_at ?? metadata.local_started_at;
  const time = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

const isManualDialPending = (call: CallRecord) => {
  const startedAt = getLocalStartedAt(getRawDetails(call));
  return Boolean(startedAt && Date.now() - startedAt < MANUAL_DIAL_PENDING_WINDOW_MS);
};

const mergeCallPreservingManualDial = (existing: CallRecord, incoming: CallRecord) => {
  if (existing.type !== 'manual-dial') {
    return { ...existing, ...incoming };
  }

  const existingDetails = getRawDetails(existing);
  const incomingDetails = getRawDetails(incoming);
  const localDialedNumber = getLocalDialedNumber(existingDetails) || existing.phone;
  const mergedDetails = {
    ...incomingDetails,
    ...existingDetails,
    metadata: {
      ...(incomingDetails.metadata && typeof incomingDetails.metadata === 'object' ? incomingDetails.metadata : {}),
      ...(existingDetails.metadata && typeof existingDetails.metadata === 'object' ? existingDetails.metadata : {}),
    },
  };

  const incomingLooksPrematurelyFailed =
    isManualDialPending(existing) &&
    (incoming.callStatus === 'failed' || incoming.callStatus === 'no-answer' || incoming.callStatus === 'dropped') &&
    incoming.duration <= 1;

  return {
    ...existing,
    ...incoming,
    name: existing.name === existing.phone || existing.name === localDialedNumber ? existing.name : incoming.name || existing.name,
    phone: localDialedNumber || incoming.phone || existing.phone,
    type: 'manual-dial' as CallType,
    callStatus: incomingLooksPrematurelyFailed ? existing.callStatus : incoming.callStatus,
    backendDetails: mergedDetails,
  };
};

const getDialedNumber = (log: CallLogResponse & RawRecord) => {
  const contact = log.contact && typeof log.contact === 'object' ? log.contact as RawRecord : {};
  const lead = log.lead && typeof log.lead === 'object' ? log.lead as RawRecord : {};
  const metadata = log.metadata && typeof log.metadata === 'object' ? log.metadata as RawRecord : {};
  const localDialedNumber = getLocalDialedNumber(log);
  const baseNumber = log.to_base_number ?? log.base_number;
  const countryCode = String(log.to_country_code ?? log.country_code ?? '').trim();
  const composedNumber = baseNumber
    ? `${countryCode || ''}${String(baseNumber).trim()}`
    : '';

  return String(
    localDialedNumber ||
      metadata.dialed_number ||
      metadata.to_number ||
      log.lad_app_dialed_number ||
      log.local_dialed_number ||
      log.to_number ||
      log.phone ||
      log.phone_number ||
      log.lead_phone ||
      contact.phone ||
      contact.phone_number ||
      lead.phone ||
      lead.phone_number ||
      composedNumber ||
      '',
  );
};

const getOptimisticCallCreatedAt = (call: CallRecord) => {
  const match = call.id.match(/^manual-agent-call-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const getClientCallId = (call: CallRecord) => {
  const details = getRawDetails(call);
  const metadata = details.metadata && typeof details.metadata === 'object' ? details.metadata as RawRecord : {};
  return String(details.client_call_id ?? details.clientCallId ?? metadata.client_call_id ?? metadata.clientCallId ?? '');
};

const collectCorrelationValues = (value: unknown, output = new Set<string>()) => {
  if (!value || typeof value !== 'object') {
    return output;
  }

  const record = value as RawRecord;
  [
    'call_log_id',
    'call_id',
    'callId',
    'id',
    'job_id',
    'jobId',
    'room_name',
    'roomName',
    'dispatch_id',
    'dispatchId',
    'worker_id',
    'workerId',
  ].forEach((key) => {
    const item = record[key];
    if (item) {
      output.add(String(item));
    }
  });

  ['metadata', 'data', 'result', 'call', 'call_log', 'start_call_response'].forEach((key) => {
    collectCorrelationValues(record[key], output);
  });

  return output;
};

const callsShareBackendCorrelation = (left: CallRecord, right: CallRecord) => {
  const leftValues = collectCorrelationValues(getRawDetails(left));
  if (!leftValues.size) {
    return false;
  }

  const rightValues = collectCorrelationValues(getRawDetails(right));
  return Array.from(leftValues).some((value) => rightValues.has(value));
};

const getPhoneKey = (value?: string) => String(value ?? '').replace(/\D/g, '').slice(-10);

const getBackendStartedAt = (call: CallRecord) => {
  const details = getRawDetails(call);
  const value = details.started_at ?? details.created_at ?? details.updated_at;
  const time = value ? Date.parse(String(value)) : 0;
  return Number.isNaN(time) ? 0 : time;
};

const isGenericCallDisplayName = (name?: string) => {
  const lower = String(name ?? '').trim().toLowerCase();
  return !lower || lower === 'unknown lead' || lower === '+15555555555' || lower === 'manual dial';
};

const getManualDialPhone = (call: CallRecord) => {
  const details = getRawDetails(call);
  const candidate = call.phone || getLocalDialedNumber(details) || (isGenericCallDisplayName(call.name) ? '' : call.name);
  return isBackendPlaceholderNumber(candidate) ? '' : candidate;
};

const getManualDialStartedAt = (call: CallRecord) =>
  getLocalStartedAt(getRawDetails(call)) || getOptimisticCallCreatedAt(call) || getBackendStartedAt(call);

const getManualDialStartedAtIso = (call: CallRecord) => {
  const details = getRawDetails(call);
  const metadata = details.metadata && typeof details.metadata === 'object' ? details.metadata as RawRecord : {};
  const value = details.local_started_at ?? metadata.local_started_at ?? details.started_at ?? details.created_at;
  if (value) {
    return String(value);
  }

  const startedAt = getManualDialStartedAt(call);
  return startedAt ? new Date(startedAt).toISOString() : new Date().toISOString();
};

const isManualDialBackendCandidate = (call: CallRecord) => {
  if (call.type === 'manual-dial') {
    return true;
  }
  if (isBackendPlaceholderNumber(call.phone || call.name)) {
    return true;
  }

  const details = getRawDetails(call);
  const metadata = details.metadata && typeof details.metadata === 'object' ? details.metadata as RawRecord : {};
  const values = [
    call.name,
    call.type,
    details.call_type,
    details.type,
    details.source,
    details.trigger_source,
    details.triggered_by,
    details.origin,
    details.context,
    details.added_context,
    details.direction,
    metadata.call_type,
    metadata.source,
    metadata.trigger_source,
  ].map((value) => String(value ?? '').toLowerCase());

  return values.some((value) => /manual[\s_-]?dial|manual/.test(value));
};

const manualDialTimesAreCompatible = (pendingCall: CallRecord, backendCall: CallRecord) => {
  const pendingStartedAt = getManualDialStartedAt(pendingCall);
  const backendStartedAt = getBackendStartedAt(backendCall);
  if (!pendingStartedAt || !backendStartedAt) {
    return false;
  }

  return backendStartedAt >= pendingStartedAt - 2 * 60 * 1000
    && backendStartedAt <= pendingStartedAt + MANUAL_DIAL_PENDING_CALL_TTL_MS;
};

const callsLikelySameManualDialWithoutPhone = (pendingCall: CallRecord, backendCall: CallRecord) => {
  if (pendingCall.type !== 'manual-dial' || !isManualDialBackendCandidate(backendCall)) {
    return false;
  }

  const pendingPhone = getPhoneKey(getManualDialPhone(pendingCall));
  if (!pendingPhone) {
    return false;
  }

  const backendPhoneValue = backendCall.phone || getLocalDialedNumber(getRawDetails(backendCall)) || backendCall.name;
  const backendPhone = getPhoneKey(backendPhoneValue);
  const backendHasRealPhone = backendPhone && !isBackendPlaceholderNumber(backendPhoneValue);
  if (backendHasRealPhone && backendPhone !== pendingPhone) {
    return false;
  }

  return manualDialTimesAreCompatible(pendingCall, backendCall);
};

const callsMatchPendingManualDial = (pendingCall: CallRecord, backendCall: CallRecord) => {
  const pendingClientCallId = getClientCallId(pendingCall) || pendingCall.id;
  const backendClientCallId = getClientCallId(backendCall);
  if (pendingClientCallId && backendClientCallId && pendingClientCallId === backendClientCallId) {
    return true;
  }
  if (callsShareBackendCorrelation(pendingCall, backendCall)) {
    return true;
  }

  const pendingPhone = getPhoneKey(pendingCall.phone || getLocalDialedNumber(getRawDetails(pendingCall)) || pendingCall.name);
  const backendPhone = getPhoneKey(backendCall.phone || getLocalDialedNumber(getRawDetails(backendCall)) || backendCall.name);
  if (!pendingPhone || !backendPhone || pendingPhone !== backendPhone) {
    return callsLikelySameManualDialWithoutPhone(pendingCall, backendCall);
  }

  const timesAreCompatible = manualDialTimesAreCompatible(pendingCall, backendCall);
  const backendLooksResolved =
    (backendCall.callStatus === 'completed' || backendCall.callStatus === 'ended') ||
    backendCall.duration > 1 ||
    Boolean(getRawDetails(backendCall).analysis);
  if (backendLooksResolved) {
    return timesAreCompatible;
  }

  const pendingStartedAt = getLocalStartedAt(getRawDetails(pendingCall)) || getOptimisticCallCreatedAt(pendingCall);
  const backendStartedAt = getBackendStartedAt(backendCall);
  if (!pendingStartedAt || !backendStartedAt) {
    return false;
  }

  return backendStartedAt >= pendingStartedAt - 60 * 1000
    && backendStartedAt <= pendingStartedAt + MANUAL_DIAL_PENDING_CALL_TTL_MS;
};

const isResolvedBackendCall = (call: CallRecord) => {
  const details = getRawDetails(call);
  return call.callStatus === 'completed' ||
    call.callStatus === 'ended' ||
    call.duration > 1 ||
    Boolean(details.analysis) ||
    Boolean(details.transcript || details.transcription || details.transcripts);
};

const pendingCallHasVisibleBackendReplacement = (pendingCall: CallRecord, backendCall: CallRecord) =>
  callsMatchPendingManualDial(pendingCall, backendCall) && isResolvedBackendCall(backendCall);

const isFreshManualPendingCall = (call: CallRecord) => {
  const startedAt = getLocalStartedAt(getRawDetails(call)) || getOptimisticCallCreatedAt(call);
  if (!startedAt) {
    return call.type === 'manual-dial' && !isResolvedBackendCall(call);
  }
  return Boolean(startedAt) && Date.now() - startedAt < MANUAL_DIAL_PENDING_CALL_TTL_MS;
};

const savePendingManualCalls = () => {
  const payload = Array.from(pendingManualCalls.values()).filter(isFreshManualPendingCall);
  pendingManualCalls.clear();
  payload.forEach((call) => pendingManualCalls.set(call.id, call));
  void safeStorage.setItem(MANUAL_DIAL_PENDING_CALLS_KEY, JSON.stringify(payload));
  if (payload.length) {
    schedulePendingManualPoll();
  } else {
    clearPendingManualPollIfIdle();
  }
};

const loadPendingManualCalls = async () => {
  if (pendingManualCallsLoaded) {
    return;
  }

  pendingManualCallsLoaded = true;
  const raw = await safeStorage.getItem(MANUAL_DIAL_PENDING_CALLS_KEY).catch(() => null);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((call) => {
        if (call?.id && call?.type === 'manual-dial' && isFreshManualPendingCall(call as CallRecord)) {
          pendingManualCalls.set(String(call.id), call as CallRecord);
        }
      });
    }
  } catch {
    // Ignore malformed local pending-call data.
  }
};

export const registerPendingManualDialCall = (call: CallRecord) => {
  if (!call.id || call.type !== 'manual-dial') {
    return;
  }

  pendingManualCalls.set(call.id, call);
  savePendingManualCalls();
};

export const replacePendingManualDialCall = (localId: string, call: CallRecord) => {
  if (localId) {
    pendingManualCalls.delete(localId);
  }
  if (call.id && call.type === 'manual-dial') {
    pendingManualCalls.set(call.id, call);
  }
  savePendingManualCalls();
};

export const clearPendingManualDialCall = (callId: string) => {
  if (!callId) {
    return;
  }

  pendingManualCalls.delete(callId);
  savePendingManualCalls();
};

const getFreshPendingManualCalls = () =>
  Array.from(pendingManualCalls.values()).filter(isFreshManualPendingCall);

const rememberManualDialOverrideFromPending = (backendCall: CallRecord, pendingCall: CallRecord) => {
  const phone = getManualDialPhone(pendingCall);
  if (!phone) {
    return;
  }

  manualDialOverrides.set(backendCall.id, {
    phone,
    startedAt: getManualDialStartedAtIso(pendingCall),
  });
  saveManualDialOverrides();
};

const applyPendingManualDialDetailsToBackend = (backendCall: CallRecord, pendingCall: CallRecord) => {
  const phone = getManualDialPhone(pendingCall);
  if (!phone) {
    return backendCall;
  }

  const backendDetails = getRawDetails(backendCall);
  const pendingDetails = getRawDetails(pendingCall);
  const backendMetadata = backendDetails.metadata && typeof backendDetails.metadata === 'object'
    ? backendDetails.metadata as RawRecord
    : {};
  const pendingMetadata = pendingDetails.metadata && typeof pendingDetails.metadata === 'object'
    ? pendingDetails.metadata as RawRecord
    : {};
  const startedAt = getManualDialStartedAtIso(pendingCall);
  const clientCallId = getClientCallId(pendingCall);

  return {
    ...backendCall,
    name: isGenericCallDisplayName(backendCall.name) ? phone : backendCall.name,
    phone,
    type: 'manual-dial' as CallType,
    backendDetails: {
      ...backendDetails,
      local_dialed_number: phone,
      lad_app_dialed_number: phone,
      local_started_at: startedAt,
      linked_pending_manual_call_id: pendingCall.id,
      metadata: {
        ...backendMetadata,
        ...pendingMetadata,
        local_dialed_number: phone,
        lad_app_dialed_number: phone,
        to_number: phone,
        ...(clientCallId ? { client_call_id: clientCallId } : {}),
      },
    },
  };
};

const getManualDialMatchScore = (pendingCall: CallRecord, backendCall: CallRecord) => {
  const pendingClientCallId = getClientCallId(pendingCall) || pendingCall.id;
  const backendClientCallId = getClientCallId(backendCall);
  if (pendingClientCallId && backendClientCallId && pendingClientCallId === backendClientCallId) {
    return 0;
  }
  if (callsShareBackendCorrelation(pendingCall, backendCall)) {
    return 1;
  }

  const pendingPhone = getPhoneKey(getManualDialPhone(pendingCall));
  const backendPhoneValue = backendCall.phone || getLocalDialedNumber(getRawDetails(backendCall)) || backendCall.name;
  const backendPhone = getPhoneKey(backendPhoneValue);
  if (pendingPhone && backendPhone && pendingPhone === backendPhone) {
    return 2;
  }

  const pendingStartedAt = getManualDialStartedAt(pendingCall);
  const backendStartedAt = getBackendStartedAt(backendCall);
  if (!pendingStartedAt || !backendStartedAt) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(backendStartedAt - pendingStartedAt);
};

const applyPendingManualDialReplacements = (fetchedCalls: CallRecord[], pendingCalls: CallRecord[]) => {
  const replacements = new Map<string, CallRecord>();
  const usedBackendIds = new Set<string>();

  pendingCalls.forEach((pendingCall) => {
    const backendCall = fetchedCalls
      .filter((call) => !usedBackendIds.has(call.id) && pendingCallHasVisibleBackendReplacement(pendingCall, call))
      .sort((left, right) => getManualDialMatchScore(pendingCall, left) - getManualDialMatchScore(pendingCall, right))[0];

    if (backendCall) {
      replacements.set(backendCall.id, pendingCall);
      usedBackendIds.add(backendCall.id);
    }
  });

  return fetchedCalls.map((call) => {
    const pendingCall = replacements.get(call.id);
    if (!pendingCall) {
      return call;
    }

    rememberManualDialOverrideFromPending(call, pendingCall);
    return applyPendingManualDialDetailsToBackend(call, pendingCall);
  });
};

const schedulePendingManualPoll = () => {
  if (pendingManualPollTimer || !getFreshPendingManualCalls().length) {
    return;
  }

  pendingManualPollTimer = setTimeout(() => {
    pendingManualPollTimer = null;
    void useCallStore.getState().fetchCalls();
  }, 15000);
};

const clearPendingManualPollIfIdle = () => {
  if (getFreshPendingManualCalls().length) {
    return;
  }

  if (pendingManualPollTimer) {
    clearTimeout(pendingManualPollTimer);
    pendingManualPollTimer = null;
  }
};

const findBackendMatchesForPendingCalls = async () => {
  const pendingCalls = getFreshPendingManualCalls();
  const uniquePhones = Array.from(new Set(pendingCalls
    .map((call) => call.phone || getLocalDialedNumber(getRawDetails(call)) || call.name)
    .filter(Boolean)));

  const results = await Promise.allSettled(uniquePhones.map((phone) => searchCallLogsForPhone(phone)));
  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .map((item) => normalizeCallLog(item as CallLogResponse))
    .map(applyManualDialOverride)
    .filter((call) => call.id);
};

const clearPendingCallsMatchedByBackend = (fetchedCalls: CallRecord[]) => {
  let changed = false;
  fetchedCalls.forEach((call) => {
    // Only remove the pending call from local persistence if the backend
    // has firmly resolved the call. Otherwise, if the user refreshes during
    // the call, ElasticSearch lag might cause the call to temporarily disappear.
    if (!isResolvedBackendCall(call)) {
      return;
    }

    const clientCallId = getClientCallId(call);
    if (clientCallId && pendingManualCalls.has(clientCallId)) {
      const pendingCall = pendingManualCalls.get(clientCallId);
      if (pendingCall) {
        rememberManualDialOverrideFromPending(call, pendingCall);
      }
      pendingManualCalls.delete(clientCallId);
      changed = true;
    }
    if (pendingManualCalls.has(call.id) && !isOptimisticCallId(call.id)) {
      const pendingCall = pendingManualCalls.get(call.id);
      if (pendingCall) {
        rememberManualDialOverrideFromPending(call, pendingCall);
      }
      pendingManualCalls.delete(call.id);
      changed = true;
    }
    Array.from(pendingManualCalls.entries()).forEach(([pendingId, pendingCall]) => {
      if (pendingCallHasVisibleBackendReplacement(pendingCall, call)) {
        rememberManualDialOverrideFromPending(call, pendingCall);
        pendingManualCalls.delete(pendingId);
        changed = true;
      }
    });
  });
  if (changed) {
    savePendingManualCalls();
  }
};

const isOptimisticCallId = (id: string) => /^manual-agent-call-\d+$/.test(id);

const isFreshOptimisticCall = (call: CallRecord) => {
  const createdAt = getOptimisticCallCreatedAt(call);
  return Boolean(createdAt) && Date.now() - createdAt < OPTIMISTIC_CALL_TTL_MS;
};

const mergeFetchedCalls = (currentCalls: CallRecord[], fetchedCalls: CallRecord[], deleteMatchedPendingCalls = true) => {
  const freshPendingCalls = getFreshPendingManualCalls();
  const fetchedCallsWithManualDialDetails = applyPendingManualDialReplacements(fetchedCalls, freshPendingCalls);
  if (deleteMatchedPendingCalls) {
    clearPendingCallsMatchedByBackend(fetchedCallsWithManualDialDetails);
  }
  const pendingCalls = freshPendingCalls.map((call) => {
    const backendProgress = fetchedCallsWithManualDialDetails.find((fetchedCall) => (
      callsMatchPendingManualDial(call, fetchedCall) &&
      !pendingCallHasVisibleBackendReplacement(call, fetchedCall)
    ));

    if (!backendProgress) {
      return call;
    }

    const progressDetails = getRawDetails(backendProgress);
    const existingDetails = getRawDetails(call);
    const nextStatus =
      isManualDialPending(call) &&
      (backendProgress.callStatus === 'failed' || backendProgress.callStatus === 'no-answer' || backendProgress.callStatus === 'dropped') &&
      backendProgress.duration <= 1
        ? call.callStatus
        : backendProgress.callStatus;
    const nextCall: CallRecord = {
      ...call,
      time: backendProgress.time || call.time,
      callStatus: nextStatus,
      duration: Math.max(call.duration, backendProgress.duration),
      transcript: backendProgress.transcript && backendProgress.transcript !== 'Transcript is not available yet.'
        ? backendProgress.transcript
        : call.transcript,
      aiSummary: backendProgress.aiSummary || call.aiSummary,
      backendDetails: {
        ...progressDetails,
        ...existingDetails,
        backend_progress: progressDetails,
        metadata: {
          ...(progressDetails.metadata && typeof progressDetails.metadata === 'object' ? progressDetails.metadata : {}),
          ...(existingDetails.metadata && typeof existingDetails.metadata === 'object' ? existingDetails.metadata : {}),
        },
      },
    };
    pendingManualCalls.set(nextCall.id, nextCall);
    savePendingManualCalls();
    return nextCall;
  }).filter((call) => {
    return !fetchedCallsWithManualDialDetails.some((fetchedCall) => (
      pendingCallHasVisibleBackendReplacement(call, fetchedCall)
    ));
  });
  const preservedOptimisticCalls = currentCalls.filter((call) => (
    isFreshOptimisticCall(call)
    && !pendingCalls.some((pendingCall) => pendingCall.id === call.id)
    && !fetchedCallsWithManualDialDetails.some((fetchedCall) => fetchedCall.id === call.id || getClientCallId(fetchedCall) === call.id)
  ));

  const currentById = new Map(currentCalls.map((call) => [call.id, call]));
  const mergedFetchedCalls = fetchedCallsWithManualDialDetails.map((call) => {
    const existing = currentById.get(call.id);
    return existing ? mergeCallPreservingManualDial(existing, call) : call;
  });

  return [...pendingCalls, ...preservedOptimisticCalls, ...mergedFetchedCalls]
    .filter((call, index, array) => (
      array.findIndex((candidate) => candidate.id === call.id) === index
    ))
    .filter((call) => !shouldHideBackendPlaceholderCall(call));
};

const applyManualDialOverride = (call: CallRecord) => {
  const override = manualDialOverrides.get(call.id);
  if (!override) {
    return call;
  }

  const existingDetails = getRawDetails(call);

  return {
    ...call,
    name: isGenericCallDisplayName(call.name) ? override.phone : call.name,
    phone: override.phone,
    type: 'manual-dial' as CallType,
    callStatus:
      isManualDialPending({
        ...call,
        backendDetails: { local_started_at: override.startedAt },
      })
        && (call.callStatus === 'failed' || call.callStatus === 'no-answer' || call.callStatus === 'dropped')
        && call.duration <= 1
        ? 'queued'
        : call.callStatus,
    backendDetails: {
      ...existingDetails,
      local_dialed_number: override.phone,
      lad_app_dialed_number: override.phone,
      local_started_at: override.startedAt,
      metadata: {
        ...(existingDetails.metadata && typeof existingDetails.metadata === 'object' ? existingDetails.metadata : {}),
        local_dialed_number: override.phone,
        lad_app_dialed_number: override.phone,
        to_number: override.phone,
      },
    },
  };
};

const isBackendPlaceholderNumber = (value?: string) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits === '15555555555' || digits === '5555555555';
};

const shouldHideBackendPlaceholderCall = (call: CallRecord) =>
  isBackendPlaceholderNumber(call.phone || call.name)
    && (!manualDialOverrides.has(call.id) || isBackendPlaceholderNumber(manualDialOverrides.get(call.id)?.phone));

const getArrayPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as RawRecord;
    if (Array.isArray(record.logs)) return record.logs;
    if (Array.isArray(record.raw_logs)) return record.raw_logs;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.calls)) return record.calls;
    if (record.data && typeof record.data === 'object') return getArrayPayload(record.data);
    if (record.result && typeof record.result === 'object') return getArrayPayload(record.result);
  }

  return [];
};

const getCallPayload = (payload: unknown) => {
  if (payload && typeof payload === 'object') {
    const record = payload as RawRecord;
    return record.call ?? record.call_log ?? record.data ?? record.result ?? record;
  }

  return payload;
};

export const normalizeCallLog = (log: CallLogResponse): CallRecord => {
  const normalizedLog = getCallPayload(log) as CallLogResponse;
  const rawLog = normalizedLog as CallLogResponse & RawRecord;
  const sourceLog = normalizedLog;
  const analysis = rawLog.analysis && typeof rawLog.analysis === 'object' ? rawLog.analysis as RawRecord : {};
  const rawAnalysis =
    analysis.raw_analysis && typeof analysis.raw_analysis === 'object' ? analysis.raw_analysis as RawRecord : {};
  const duration = pickLadFrontendDuration(
    sourceLog.duration_seconds ??
      rawLog.duration_seconds,
    sourceLog.call_duration ??
      rawLog.call_duration,
    rawLog.duration,
    rawLog.call_duration_seconds,
  );
  const callStatus = normalizeCallStatus(sourceLog.status ?? rawLog.call_status);
  const leadTemperature = categorizeLead(duration, callStatus);
  const leadName = getLeadName(sourceLog);
  const leadScoreFull = rawAnalysis.lead_score_full && typeof rawAnalysis.lead_score_full === 'object'
    ? rawAnalysis.lead_score_full as RawRecord
    : {};
  const score = toFiniteNumber(
    rawLog.lead_score ??
      rawLog.score ??
      rawLog.engagement_score ??
      analysis.lead_score ??
      rawAnalysis.lead_score ??
      leadScoreFull.lead_score ??
      rawLog.leadScore ??
      0,
  );
  const leadCategory =
    sourceLog.lead_category ??
    analysis.lead_category ??
    analysis.category ??
    rawAnalysis.lead_category ??
    rawAnalysis.category ??
    rawLog.category ??
    rawLog.lead_tag ??
    extractCategoryFromTags(rawLog.lead_tags);
  const normalizedLeadTemperature =
    score >= 8
      ? 'hot'
      : score > 0 && score <= 3
        ? 'cold'
        : normalizeLeadTemperature(leadCategory) || leadTemperature;
  const engagementScore =
    score > 0
      ? score
      : toFiniteNumber(rawLog.engagement_score) > 0
        ? toFiniteNumber(rawLog.engagement_score)
        : getEngagementScore(duration, callStatus);

  const typedLeadTemperature =
    normalizedLeadTemperature === 'hot' || normalizedLeadTemperature === 'warm' || normalizedLeadTemperature === 'cold'
      ? normalizedLeadTemperature
      : leadTemperature;

  return {
    id: String(sourceLog.call_log_id ?? sourceLog.id ?? rawLog.call_id ?? `${leadName}-${sourceLog.started_at ?? Date.now()}`),
    name: leadName,
    phone: getDialedNumber(rawLog),
    type: normalizeCallType(rawLog),
    time: formatCallTime(sourceLog.started_at ?? rawLog.created_at ?? rawLog.updated_at) || 'Just now',
    avatar: '',
    statusColor: getLeadTemperatureColor(typedLeadTemperature),
    duration,
    transcript: getTranscript(rawLog),
    engagement_score: engagementScore,
    leadTemperature: typedLeadTemperature,
    aiSummary: getSummary(rawLog, leadName, callStatus),
    callStatus,
    backendDetails: rawLog,
    agent: rawLog.agent || rawLog.assistant || sourceLog.agent_name ? {
      id: String(rawLog.agent_id ?? rawLog.assistant_id ?? sourceLog.agent_name ?? 'backend-agent'),
      name: String(sourceLog.agent_name ?? rawLog.agent_name ?? rawLog.assistant_name ?? rawLog.agent?.name ?? rawLog.assistant?.name ?? 'Voice agent'),
      language: String(rawLog.agent_language ?? rawLog.language ?? 'English'),
      accent: String(rawLog.accent ?? 'Default'),
      gender: String(rawLog.gender ?? 'AI'),
    } : undefined,
    fromNumber: rawLog.from_number ? {
      id: String(rawLog.from_number),
      label: String(rawLog.from_number),
      phoneNumber: String(rawLog.from_number),
    } : undefined,
  };
};

export const useCallStore = create<CallState>((set) => ({
  calls: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  page: 1,
  hasMore: true,
  lastFetchedAt: null,

  initializeRealtime: () => {
    if (callListenersAttached) {
      return;
    }

    callListenersAttached = true;
    const socket = getSocket();
    const handleCallUpdate = (payload: unknown) => {
      const call = applyManualDialOverride(normalizeCallLog(payload as CallLogResponse));
      
      const clientCallId = getClientCallId(call);
      if (clientCallId && pendingManualCalls.has(clientCallId)) {
        const pending = pendingManualCalls.get(clientCallId)!;
        pendingManualCalls.set(clientCallId, { ...pending, callStatus: call.callStatus });
        savePendingManualCalls();
      } else if (pendingManualCalls.has(call.id)) {
        const pending = pendingManualCalls.get(call.id)!;
        pendingManualCalls.set(call.id, { ...pending, callStatus: call.callStatus });
        savePendingManualCalls();
      }

      const matchingPendingCall = getFreshPendingManualCalls().find((pendingCall) => (
        callsMatchPendingManualDial(pendingCall, call)
      ));

      if (shouldHideBackendPlaceholderCall(call) && !matchingPendingCall) {
        // Even if the backend call is a placeholder, use it to update the status
        // of any matching optimistic/pending manual-dial record in the list.
        set((state) => {
          const rawPayload = payload && typeof payload === 'object' ? payload as RawRecord : {};
          const payloadClientCallId = String(
            rawPayload.client_call_id ?? rawPayload.clientCallId ??
            (rawPayload.metadata && typeof rawPayload.metadata === 'object'
              ? (rawPayload.metadata as RawRecord).client_call_id ?? ''
              : '') ?? '',
          );
          const payloadPhone = getLocalDialedNumber(rawPayload);
          const payloadStatus = normalizeCallStatus(
            String(rawPayload.status ?? rawPayload.call_status ?? ''),
          );
          if (!payloadStatus || payloadStatus === 'queued') {
            return state;
          }
          const updatedCalls = state.calls.map((c) => {
            if (c.type !== 'manual-dial') return c;
            const clientCallId = String(
              (c.backendDetails && typeof c.backendDetails === 'object'
                ? (c.backendDetails as RawRecord).client_call_id ?? ''
                : '') ?? '',
            );
            const cPhone = getPhoneKey(c.phone || getLocalDialedNumber(
              c.backendDetails && typeof c.backendDetails === 'object' ? c.backendDetails as RawRecord : {},
            ));
            const matchesId = payloadClientCallId && clientCallId && payloadClientCallId === clientCallId;
            const matchesPhone = payloadPhone && cPhone && getPhoneKey(payloadPhone) === cPhone;
            if (!matchesId && !matchesPhone) return c;
            // Only upgrade status, never downgrade a nearly-completed call to failed/no-answer early
            const isPrematurelyFailed = isManualDialPending(c) &&
              (payloadStatus === 'failed' || payloadStatus === 'no-answer' || payloadStatus === 'dropped') &&
              call.duration <= 1;
            return isPrematurelyFailed ? c : { ...c, callStatus: payloadStatus };
          });
          return { calls: updatedCalls };
        });
        return;
      }
      set((state) => ({
        calls: mergeFetchedCalls(state.calls, [call], false),
      }));
    };

    socket.off('call:status');
    socket.off('call:updated');
    socket.off('call:completed');
    socket.off('call:new');
    socket.on('call:status', handleCallUpdate);
    socket.on('call:updated', handleCallUpdate);
    socket.on('call:completed', handleCallUpdate);
    socket.on('call:new', handleCallUpdate);

    if (!callLogStream) {
      callLogStream = subscribeToCallLogsStream(handleCallUpdate);
    }
  },

  disposeRealtime: () => {
    const socket = getSocket();
    socket.off('call:status');
    socket.off('call:updated');
    socket.off('call:completed');
    socket.off('call:new');
    callLogStream?.close();
    callLogStream = null;
    callListenersAttached = false;
  },

  fetchCalls: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([loadManualDialOverrides(), loadPendingManualCalls()]);
      const response = await getCallLogs({ page: 1, limit: CALL_RECONCILE_PAGE_SIZE });
      const calls = getArrayPayload(response)
        .map((item) => normalizeCallLog(item as CallLogResponse))
        .map(applyManualDialOverride)
        .filter((call) => call.id);
      const searchedCalls = await findBackendMatchesForPendingCalls();
      const allCalls = [...searchedCalls, ...calls].filter((call, index, array) => (
        array.findIndex((candidate) => candidate.id === call.id) === index
      ));

      set((state) => ({
        calls: mergeFetchedCalls(state.calls, allCalls),
        page: 1,
        hasMore: calls.length >= CALL_RECONCILE_PAGE_SIZE,
        isLoading: false,
        lastFetchedAt: Date.now(),
      }));
      schedulePendingManualPoll();
    } catch {
      set({
        isLoading: false,
        hasMore: false,
        error: 'Unable to load real call logs from the backend.',
      });
    }
  },

  fetchNextCalls: async () => {
    const state = useCallStore.getState();
    if (!state.hasMore || state.isLoading || state.isLoadingMore) {
      return;
    }

    const nextPage = state.page + 1;
    set({ isLoadingMore: true });

    try {
      await Promise.all([loadManualDialOverrides(), loadPendingManualCalls()]);
      const response = await getCallLogs({ page: nextPage, limit: CALL_PAGE_SIZE });
      const calls = getArrayPayload(response)
        .map((item) => normalizeCallLog(item as CallLogResponse))
        .map(applyManualDialOverride)
        .filter((call) => call.id && !shouldHideBackendPlaceholderCall(call));
      const incomingIds = new Set(calls.map((call) => call.id));

      set((current) => ({
        calls: [
          ...current.calls.filter((call) => !incomingIds.has(call.id)),
          ...calls,
        ],
        page: nextPage,
        hasMore: calls.length >= CALL_PAGE_SIZE,
        isLoadingMore: false,
      }));
    } catch {
      set({
        isLoadingMore: false,
        error: 'Unable to load more call logs.',
      });
    }
  },

  setCalls: (calls) => set({ calls }),

  prependCall: (call) => set((state) => ({
    calls: [call, ...state.calls.filter((item) => item.id !== call.id)],
  })),

  prependCalls: (calls) => set((state) => {
    const incomingIds = new Set(calls.map((call) => call.id));
    return {
      calls: [...calls, ...state.calls.filter((item) => !incomingIds.has(item.id))],
    };
  }),
}));
