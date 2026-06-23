import { create } from 'zustand';
import { Platform } from 'react-native';
import { safeStorage } from '@/src/api';
import { getSocket } from '@/src/services/socketService';
import { getCallLogs, searchCallLogsForPhone, subscribeToCallLogsStream } from '@/src/services/call-logs';
import type { CallLogResponse } from '@/src/services/call-logs';
import {
  categorizeLead,
  getEngagementScore,
  getLeadTemperatureColor,
} from '@/src/services/leadCategorization';
import { normalizeBackendCallStatus } from '@/src/utils/callStatus';
import type { CallRecord, CallStatus, CallType } from '@/types/calls';

type RawRecord = Record<string, any>;
const CALL_PAGE_SIZE = 25;
const CALL_RECONCILE_PAGE_SIZE = 100;
const CALL_ALL_PAGES_LIMIT = 1000;
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
  fetchCalls: (options?: { force?: boolean }) => Promise<void>;
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
let liveCallPollTimer: ReturnType<typeof setInterval> | null = null;
let fetchCallsInFlight: Promise<void> | null = null;
const LIVE_CALL_POLL_INTERVAL_MS = 15000;
const manualDialOverrides = new Map<string, { phone: string; startedAt: string; contactName?: string }>();
const pendingManualCalls = new Map<string, CallRecord>();

const isLiveCallStatus = (status: CallStatus) =>
  status === 'queued' || status === 'ringing' || status === 'in_progress';

// Purge any client-only optimistic / pending manual-dial records (in memory and
// on disk). The call list now mirrors LAD-Frontend-2: it shows ONLY records the
// backend actually persisted, so these fabricated placeholders must never be
// re-injected into the list.
const clearOptimisticArtifacts = () => {
  pendingManualCalls.clear();
  if (pendingManualPollTimer) {
    clearTimeout(pendingManualPollTimer);
    pendingManualPollTimer = null;
  }
  void safeStorage.removeItem(MANUAL_DIAL_PENDING_CALLS_KEY).catch(() => undefined);
};

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
    const parsed = JSON.parse(raw) as Record<string, { phone?: string; startedAt?: string; contactName?: string }>;
    Object.entries(parsed).forEach(([callId, value]) => {
      if (value?.phone && !isBackendPlaceholderNumber(value.phone)) {
        manualDialOverrides.set(callId, {
          phone: value.phone,
          startedAt: value.startedAt || new Date().toISOString(),
          contactName: value.contactName,
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

export const registerManualDialCallOverride = (callId: string, phone: string, startedAt = new Date().toISOString(), contactName?: string) => {
  if (!callId || !phone) {
    return;
  }

  if (isBackendPlaceholderNumber(phone)) {
    manualDialOverrides.delete(callId);
  } else {
    manualDialOverrides.set(callId, { phone, startedAt, contactName });
  }
  saveManualDialOverrides();
};

const normalizeCallStatus = normalizeBackendCallStatus;
const UUID_LIKE_VALUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isCodeLikeValue = (value: unknown) => {
  const text = String(value ?? '').trim();
  return UUID_LIKE_VALUE.test(text) || /^manual-agent-call-\d+$/i.test(text);
};

const PHONE_LIKE_VALUE = /^\+?[\d\s\-\.\(\)]{7,15}$/;
const isPhoneLikeValue = (value: unknown) =>
  PHONE_LIKE_VALUE.test(String(value ?? '').trim());

const isManualDialLog = (log: CallLogResponse & RawRecord) => {
  const metadata = getMetadataObject(log);
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
    metadata.call_type,
    metadata.source,
    metadata.trigger_source,
    metadata.client_call_id,
    metadata.clientCallId,
  ].map((value) => String(value ?? '').toLowerCase());

  if (values.some((value) => /manual[\s_-]?dial|manual/.test(value))) {
    return true;
  }

  const isOutbound = String(log.direction ?? log.call_type ?? metadata.direction ?? '').toLowerCase() === 'outbound';
  const hasCampaign = Boolean(log.campaign_id || log.campaign_lead_id || log.campaign_step_id);
  const isRealName = (v: unknown) => Boolean(v) && !isPhoneLikeValue(v) && !isCodeLikeValue(v);
  const hasNamedLead = Boolean(
    isRealName(log.lead_name) ||
    isRealName(log.contact_name) ||
    isRealName(log.lead_first_name) ||
    isRealName(log.lead_last_name) ||
    isRealName(metadata.lead_name) ||
    isRealName(metadata.contact_name),
  );
  const displayValue = log.lead_name || log.contact_name || log.lead_id || log.call_log_id || log.id || log.call_id;

  return isOutbound && !hasCampaign && !hasNamedLead && (isCodeLikeValue(displayValue) || isPhoneLikeValue(displayValue));
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
  const metadata = getMetadataObject(rawLog);
  const contactFullName = [contact.first_name ?? contact.firstName, contact.last_name ?? contact.lastName].filter(Boolean).join(' ').trim();
  const leadFullName = [lead.first_name ?? lead.firstName, lead.last_name ?? lead.lastName].filter(Boolean).join(' ').trim();
  const dialedNumber = getDialedNumber(rawLog);
  const directName = log.lead_name ||
    rawLog.contact_name ||
    metadata.contact_name ||
    metadata.lead_name ||
    metadata.manual_contact_name ||
    metadata.client_name ||
    fullName ||
    contact.name ||
    contact.full_name ||
    contactFullName ||
    lead.name ||
    lead.full_name ||
    leadFullName;

  const nameIsUsable = directName && !isCodeLikeValue(directName) && !isPhoneLikeValue(directName);

  // Never show a phone number or UUID as a contact name regardless of call type.
  if (!nameIsUsable) {
    return 'Manual Dial';
  }

  return String(directName);
};

const stringifyTranscriptPayload = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          const record = item as RawRecord;
          const speaker = record.speaker ?? record.role ?? record.from;
          const text = record.text ?? record.content ?? record.message ?? record.transcript;
          return text ? [speaker, text].filter(Boolean).join(': ') : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const record = value as RawRecord;
    const direct = record.text ?? record.content ?? record.transcript ?? record.summary;
    if (direct) {
      return String(direct);
    }
    if (Array.isArray(record.messages)) {
      return stringifyTranscriptPayload(record.messages);
    }
  }

  return '';
};

const getTranscript = (log: CallLogResponse & RawRecord) =>
  stringifyTranscriptPayload(
    log.transcript ??
      log.call_transcript ??
      log.transcription ??
      log.transcripts,
  ) || 'Transcript is not available yet.';

const getSummary = (log: CallLogResponse & RawRecord, leadName: string, status: CallStatus) => {
  const analysis = log.analysis && typeof log.analysis === 'object' ? log.analysis as RawRecord : {};
  const rawAnalysis =
    analysis.raw_analysis && typeof analysis.raw_analysis === 'object' ? analysis.raw_analysis as RawRecord : {};
  const dispositionFull =
    rawAnalysis.disposition_full && typeof rawAnalysis.disposition_full === 'object'
      ? rawAnalysis.disposition_full as RawRecord
      : {};
  const metadata = getMetadataObject(log);
  const sipTrail = metadata.sip_trail && typeof metadata.sip_trail === 'object'
    ? metadata.sip_trail as RawRecord
    : {};
  const summary = log.aiSummary ?? log.ai_summary ?? log.summary ?? analysis.summary ?? rawAnalysis.summary;
  if (summary && typeof summary === 'object') {
    return summary;
  }

  const outcome = String(
    log.outcome ??
      log.call_outcome ??
      log.status_reason ??
      log.disposition ??
      analysis.disposition ??
      rawAnalysis.disposition ??
      rawAnalysis.lead_disposition ??
      dispositionFull.disposition ??
      metadata.outcome ??
      metadata.call_outcome ??
      metadata.disposition ??
      metadata.status_reason ??
      sipTrail.status_reason ??
      '',
  ).trim();
  const completed = status === 'completed' || status === 'ended';
  return {
    customerIntent: completed
      ? `${leadName} completed an AI voice conversation.`
      : `No full customer intent was captured for ${leadName}.`,
    callOutcome: outcome || (completed ? 'Conversation completed and is ready for review.' : 'Call did not complete.'),
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

const getMetadataObject = (record?: RawRecord | null): RawRecord => {
  const metadata = record?.metadata;
  if (!metadata) {
    return {};
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RawRecord : {};
    } catch {
      return {};
    }
  }

  return typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as RawRecord : {};
};

const getLocalDialedNumber = (record: RawRecord) => {
  const metadata = getMetadataObject(record);
  return String(
    record.local_dialed_number ??
      record.lad_app_dialed_number ??
      metadata.local_dialed_number ??
      metadata.lad_app_dialed_number ??
      '',
  );
};

const getLocalStartedAt = (record: RawRecord) => {
  const metadata = getMetadataObject(record);
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
      ...getMetadataObject(incomingDetails),
      ...getMetadataObject(existingDetails),
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
  const metadata = getMetadataObject(log);
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
      metadata.phone_number ||
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
  const metadata = getMetadataObject(details);
  return String(details.client_call_id ?? details.clientCallId ?? metadata.client_call_id ?? metadata.clientCallId ?? '');
};

const collectCorrelationValues = (value: unknown, output = new Set<string>()) => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return collectCorrelationValues(parsed, output);
    } catch {
      return output;
    }
  }

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
  const metadata = getMetadataObject(details);
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
  const metadata = getMetadataObject(details);
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
  const backendMetadata = getMetadataObject(backendDetails);
  const pendingMetadata = getMetadataObject(pendingDetails);
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
    void useCallStore.getState().fetchCalls({ force: true });
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
    .filter(Boolean)))
    .slice(0, 3);

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
          ...getMetadataObject(progressDetails),
          ...getMetadataObject(existingDetails),
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
    name: isGenericCallDisplayName(call.name) ? (override.contactName || override.phone) : call.name,
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
        ...getMetadataObject(existingDetails),
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
  const rawStatusValue = sourceLog.status || rawLog.call_status || rawLog.status_text || rawLog.current_status || '';
  const callStatus = normalizeCallStatus(String(rawStatusValue));
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
    fromNumber: rawLog.from_number || rawLog.from_number_id ? {
      id: String(rawLog.from_number_id ?? rawLog.from_number),
      label: String(rawLog.from_number ?? rawLog.from_number_id),
      phoneNumber: String(rawLog.from_number ?? rawLog.from_number_id),
    } : undefined,
  };
};

const loadAllCallPages = async (): Promise<CallRecord[]> => {
  const all: CallRecord[] = [];
  let page = 1;

  while (all.length < CALL_ALL_PAGES_LIMIT) {
    const response = await getCallLogs({ page, limit: CALL_RECONCILE_PAGE_SIZE });
    const raw = response as Record<string, any>;
    const pagination = (raw.pagination ?? {}) as Record<string, any>;
    const serverTotal: number | undefined =
      pagination.total ?? raw.total ?? pagination.count ?? raw.count;
    const serverTotalPages: number | undefined =
      pagination.total_pages ?? pagination.totalPages ?? raw.total_pages;

    const fetched = getArrayPayload(response)
      .map((item) => normalizeCallLog(item as CallLogResponse))
      .map(applyManualDialOverride)
      .filter((call) => call.id && !shouldHideBackendPlaceholderCall(call));

    const before = all.length;
    const seen = new Set(all.map((c) => c.id));
    fetched.forEach((c) => { if (!seen.has(c.id)) all.push(c); });

    if (all.length === before || fetched.length === 0) break;

    // Use server-reported totals when available; fall back to page-full heuristic.
    let hasMore: boolean;
    if (serverTotal != null) {
      hasMore = all.length < serverTotal;
    } else if (serverTotalPages != null) {
      hasMore = page < serverTotalPages;
    } else if (pagination.has_more != null) {
      hasMore = Boolean(pagination.has_more);
    } else if (pagination.hasNextPage != null) {
      hasMore = Boolean(pagination.hasNextPage);
    } else {
      hasMore = fetched.length >= CALL_RECONCILE_PAGE_SIZE;
    }

    if (!hasMore) break;
    page++;
  }

  return all;
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

    // Mirror LAD-Frontend-2's patchCallLogById: apply lightweight status/duration/cost/recording
    // patches to existing calls without doing a full re-normalize round-trip.
    const applyStreamPatch = (rawPayload: RawRecord) => {
      const id = String(rawPayload.call_log_id ?? rawPayload.id ?? rawPayload.call_id ?? '');
      if (!id) return;
      const newStatus = normalizeCallStatus(
        String(rawPayload.status || rawPayload.call_status || rawPayload.status_text || ''),
      );
      set((state) => ({
        calls: state.calls.map((c) => {
          if (c.id !== id) return c;
          const updatedDuration = toFiniteNumber(
            rawPayload.duration_seconds ?? rawPayload.call_duration ?? rawPayload.duration,
          );
          const updatedCost = toFiniteNumber(rawPayload.cost ?? rawPayload.call_cost);
          const updatedRecording = rawPayload.signed_recording_url || rawPayload.recording_url || rawPayload.call_recording_url;
          const updatedBackend: RawRecord = { ...(c.backendDetails as RawRecord ?? {}) };
          if (updatedRecording) {
            updatedBackend.signed_recording_url = updatedRecording;
            updatedBackend.recording_url = updatedBackend.recording_url || updatedRecording;
          }
          return {
            ...c,
            callStatus: newStatus || c.callStatus,
            duration: updatedDuration > c.duration ? updatedDuration : c.duration,
            engagement_score: updatedCost > 0 ? c.engagement_score : c.engagement_score,
            backendDetails: updatedRecording ? updatedBackend : c.backendDetails,
          };
        }),
      }));
    };

    const handleCallUpdate = (payload: unknown) => {
      const rawPayload = payload && typeof payload === 'object' ? payload as RawRecord : {};

      // Try lightweight patch first if we can match by call_log_id.
      const directId = String(rawPayload.call_log_id ?? rawPayload.id ?? rawPayload.call_id ?? '');
      if (directId) {
        applyStreamPatch(rawPayload);
      }

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
          const payloadClientCallId = String(
            rawPayload.client_call_id ?? rawPayload.clientCallId ??
            getMetadataObject(rawPayload).client_call_id ??
            getMetadataObject(rawPayload).clientCallId ??
            '',
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
            const cClientCallId = String(
              (c.backendDetails && typeof c.backendDetails === 'object'
                ? (c.backendDetails as RawRecord).client_call_id ?? ''
                : '') ?? '',
            );
            const cPhone = getPhoneKey(c.phone || getLocalDialedNumber(
              c.backendDetails && typeof c.backendDetails === 'object' ? c.backendDetails as RawRecord : {},
            ));
            const matchesId = payloadClientCallId && cClientCallId && payloadClientCallId === cClientCallId;
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

    // The SSE call-logs stream reads a streaming fetch body via
    // response.body.getReader(), which React Native's fetch does NOT support —
    // on a device it fails immediately and reconnects forever ("stream error in
    // network"). Only subscribe on web, where ReadableStream bodies work. On
    // native we rely on the socket.io listeners above plus the live-call poll.
    if (Platform.OS === 'web' && !callLogStream) {
      callLogStream = subscribeToCallLogsStream(handleCallUpdate);
    }

    // Live-call poll: reconcile DB state every 5s whenever a call is in-flight.
    // This is the safety net for missed SSE/socket events (mobile networks drop
    // long-lived connections often). Mirrors LAD-Frontend-2's behavior of
    // React Query refetching while calls are active.
    if (!liveCallPollTimer) {
      liveCallPollTimer = setInterval(() => {
        const hasLive = useCallStore.getState().calls.some((c) => isLiveCallStatus(c.callStatus));
        if (hasLive) {
          void useCallStore.getState().fetchCalls({ force: true });
        }
      }, LIVE_CALL_POLL_INTERVAL_MS);
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
    if (liveCallPollTimer) {
      clearInterval(liveCallPollTimer);
      liveCallPollTimer = null;
    }
  },

  fetchCalls: async (options = {}) => {
    if (fetchCallsInFlight) {
      return fetchCallsInFlight;
    }

    const state = useCallStore.getState();
    // Mirror LAD-Frontend-2's React Query staleTime: 30000ms. If we have cached
    // calls and the last fetch was less than 30s ago, skip. Otherwise re-fetch
    // even when the store has data, so navigating back to the screen surfaces
    // any DB updates that happened while we were away.
    const STALE_TIME_MS = 30000;
    const isStillFresh = state.lastFetchedAt != null && Date.now() - state.lastFetchedAt < STALE_TIME_MS;
    if (!options.force && state.calls.length && isStillFresh) {
      set({ isLoading: false, error: null });
      return;
    }

    fetchCallsInFlight = (async () => {
      set({ isLoading: true, error: null });
      try {
        await loadManualDialOverrides();
        clearOptimisticArtifacts();
        const fetchedCalls = await loadAllCallPages();

        // Preserve any live-status calls we prepended locally (via prependCall after
        // makeCall returned) that the backend hasn't propagated to the list endpoint
        // yet. Without this, the freshly-dialed "queued" entry disappears on the
        // first refresh before the DB write is visible to the read path.
        const currentCalls = useCallStore.getState().calls;
        const backendIds = new Set(fetchedCalls.map((c) => c.id));
        const localLiveCalls = currentCalls.filter(
          (c) => isLiveCallStatus(c.callStatus) && !backendIds.has(c.id),
        );

        const calls = [
          ...localLiveCalls,
          ...fetchedCalls,
        ].filter((call, idx, arr) => arr.findIndex((c) => c.id === call.id) === idx);

        set({
          calls,
          page: 1,
          hasMore: fetchedCalls.length >= CALL_ALL_PAGES_LIMIT,
          isLoading: false,
          lastFetchedAt: Date.now(),
        });
      } catch {
        set({
          isLoading: false,
          hasMore: false,
          error: 'Unable to load real call logs from the backend.',
        });
      }
    })();

    try {
      await fetchCallsInFlight;
    } finally {
      fetchCallsInFlight = null;
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
      await loadManualDialOverrides();
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
