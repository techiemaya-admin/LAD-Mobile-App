import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Image, Keyboard, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ChevronDown, Delete, Goal, Pause, Phone, Play, Plus, RefreshCw, Search, X } from 'lucide-react-native';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { LadLogoMark } from '@/components/ui/LadLogoMark';
import { CallCard } from '@/components/features/CallCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { SkeletonConversationRow } from '@/components/ui/SkeletonLoader';
import { NoConnectionState } from '@/components/ui/NoConnectionState';
import { apiGet, apiPut, isApiRequestError, safeStorage } from '@/src/api';
import { RESOLVED_API_URL } from '@/src/api/apiClient';
import { getCallLead, getCallLog, getCallLogs, getRecordingSignedUrl, searchCallLogsForPhone } from '@/src/services/call-logs';
import { DEFAULT_OUTBOUND_STARTER_PROMPT, fetchVoiceCallOptions, loadVoiceCallConfig, phoneNumbersMatch, SavedVoiceCallConfig, syncVoiceAgentCallPrompt } from '@/src/services/voiceCallConfig';
import { makeCall } from '@/src/services/voice-agent';
import {
  clearPendingManualDialCall,
  normalizeCallLog,
  registerManualDialCallOverride,
  registerPendingManualDialCall,
  useCallStore,
} from '@/src/store/callStore';
import { useOverlayStore } from '@/src/store/overlayStore';
import { CallRecord } from '@/types/calls';
import { useAppTheme } from '@/src/theme/appTheme';
import { formatCallStatusLabel, getCallStatusDisplayMeta } from '@/src/utils/callStatus';
import { getFriendlyError, isConnectionUnavailableError } from '@/src/utils/errors';

const DIAL_KEY_META = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: ',' },
  { digit: '0', letters: '+' },
  { digit: 'backspace', letters: '' },
];
const CALL_GOALS_STORAGE_KEY = 'lad.callGoals.v1';
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;
const DIAL_PAD_ICON = require('../../assets/images/dial-pad.png');

type CallGoalType = 'get_meeting' | 'share_resource' | 'explore_collab' | 'general';

type CallGoal = {
  id: string;
  title: string;
  type: CallGoalType;
  targetCalls: number;
  notes?: string;
  createdAt: string;
};

type CallFeedback = {
  type: 'info' | 'success' | 'error';
  text: string;
};

type CallFailureDialog = {
  message: string;
  phoneNumber: string;
};

type RawCallDetails = Record<string, unknown>;
type RawLeadDetails = Record<string, unknown>;
type AppTheme = ReturnType<typeof useAppTheme>;
type VoiceAgent = {
  id: string;
  name: string;
  language?: string;
  accent?: string;
  gender?: string;
  provider?: string;
  description?: string;
};

type VoiceNumber = {
  id: string;
  phone_number: string;
  base_number?: string;
  country_code?: string;
  provider?: string;
  assignedAgentId?: string;
};

type DialCountryOption = {
  iso: string;
  flagUri: string;
  dialCode: string;
  label: string;
};

type DialContactSuggestion = {
  id: string;
  name: string;
  phone: string;
  source: 'prospects' | 'pipeline' | 'call-log' | 'crm' | 'personal-whatsapp' | 'whatsapp-business' | 'gmail' | 'outlook';
  raw: RawCallDetails;
};

const DIAL_COUNTRY_OPTIONS: DialCountryOption[] = [
  { iso: 'IN', flagUri: 'https://flagcdn.com/w40/in.png', dialCode: '+91', label: 'India' },
  { iso: 'US', flagUri: 'https://flagcdn.com/w40/us.png', dialCode: '+1', label: 'United States' },
  { iso: 'GB', flagUri: 'https://flagcdn.com/w40/gb.png', dialCode: '+44', label: 'United Kingdom' },
  { iso: 'CA', flagUri: 'https://flagcdn.com/w40/ca.png', dialCode: '+1', label: 'Canada' },
  { iso: 'AU', flagUri: 'https://flagcdn.com/w40/au.png', dialCode: '+61', label: 'Australia' },
  { iso: 'AE', flagUri: 'https://flagcdn.com/w40/ae.png', dialCode: '+971', label: 'United Arab Emirates' },
];

const DEFAULT_DIAL_COUNTRY = DIAL_COUNTRY_OPTIONS[0];

const isOptimisticManualCallId = (id: string) => /^manual-agent-call-\d+$/.test(id);

const findCallLogIdInPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as RawCallDetails;
  const direct =
    record.id ??
    record.call_log_id ??
    record.callLogId ??
    record.call_id ??
    record.callId;

  if (direct) {
    return String(direct);
  }

  for (const key of ['data', 'result', 'call', 'call_log']) {
    const nested = record[key];
    const nestedId = findCallLogIdInPayload(nested);
    if (nestedId) {
      return nestedId;
    }
  }

  return null;
};

const phoneKey = (value?: string | null) => String(value ?? '').replace(/\D/g, '').slice(-10);

const getStartedAtMs = (details?: RawCallDetails | null) => {
  const value = details?.started_at ?? details?.created_at ?? details?.updated_at ?? details?.local_started_at;
  const time = value ? Date.parse(String(value)) : 0;
  return Number.isNaN(time) ? 0 : time;
};

const getDetailsPhone = (details?: RawCallDetails | null) => {
  if (!details) {
    return '';
  }

  const metadata = getBackendMetadata(details);
  const contact = details.contact && typeof details.contact === 'object' ? details.contact as RawCallDetails : {};
  const lead = details.lead && typeof details.lead === 'object' ? details.lead as RawCallDetails : {};
  const baseNumber = details.to_base_number ?? details.base_number;
  const countryCode = String(details.to_country_code ?? details.country_code ?? '').trim();
  const composedNumber = baseNumber ? `${countryCode}${String(baseNumber)}` : '';

  return String(
    details.local_dialed_number ||
      details.lad_app_dialed_number ||
      metadata.local_dialed_number ||
      metadata.lad_app_dialed_number ||
      metadata.to_number ||
      details.to_number ||
      details.phone ||
      details.phone_number ||
      details.lead_phone ||
      contact.phone ||
      contact.phone_number ||
      lead.phone ||
      lead.phone_number ||
      composedNumber ||
      '',
  );
};

const getDetailsLeadId = (details?: RawCallDetails | null) =>
  details ? String(details.lead_id ?? details.leadId ?? (details.lead && typeof details.lead === 'object' ? (details.lead as RawCallDetails).id : '') ?? '') : '';

const unwrapLeadDetails = (payload: unknown): RawLeadDetails | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as RawLeadDetails;
  const nested = record.lead ?? record.data ?? record.result;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as RawLeadDetails;
  }

  return record;
};

const getRawObject = (value: unknown): RawCallDetails =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RawCallDetails : {};

const collectBackendCorrelationValues = (value: unknown, output = new Set<string>()) => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return collectBackendCorrelationValues(parsed, output);
    } catch {
      return output;
    }
  }

  if (!value || typeof value !== 'object') {
    return output;
  }

  const record = value as RawCallDetails;
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
    collectBackendCorrelationValues(record[key], output);
  });

  return output;
};

const detailsShareCorrelation = (left?: RawCallDetails | null, right?: RawCallDetails | null) => {
  const leftValues = collectBackendCorrelationValues(left);
  if (!leftValues.size) {
    return false;
  }
  const rightValues = collectBackendCorrelationValues(right);
  return Array.from(leftValues).some((value) => rightValues.has(value));
};

const getLeadDisplayName = (lead?: RawLeadDetails | null) => {
  if (!lead) {
    return '';
  }

  return String(
    lead.name ||
      lead.full_name ||
      [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
      '',
  );
};

const isPlaceholderPhone = (value?: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits === '15555555555' || digits === '5555555555';
};

const GOAL_OPTIONS: { id: CallGoalType; label: string; description: string }[] = [
  { id: 'get_meeting', label: 'Book a call', description: 'Optimize calls toward scheduled meetings.' },
  { id: 'share_resource', label: 'Share a resource', description: 'Guide leads toward a deck, link, or document.' },
  { id: 'explore_collab', label: 'Explore collab', description: 'Qualify partnership or collaboration interest.' },
  { id: 'general', label: 'Start a chat', description: 'Start a warm conversation and collect context.' },
];

const getGoalLabel = (goalType: CallGoalType) => GOAL_OPTIONS.find((option) => option.id === goalType)?.label ?? 'Call goal';

const normalizeE164Like = (phone: unknown) => String(phone ?? '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^\d+]/g, '')
  .replace(/^\+{2,}/, '+');

const MAX_DIAL_PHONE_DIGITS = 15;
const MIN_DIAL_PHONE_DIGITS = 7;

const sanitizeDialNumberInput = (phone: unknown) => {
  const raw = String(phone ?? '').trim();
  let hasLeadingPlus = false;
  let digits = '';

  for (const char of raw) {
    if (char === '+' && !hasLeadingPlus && digits.length === 0) {
      hasLeadingPlus = true;
      continue;
    }
    if (/\d/.test(char) && digits.length < MAX_DIAL_PHONE_DIGITS) {
      digits += char;
    }
  }

  return `${hasLeadingPlus ? '+' : ''}${digits}`;
};

const isValidDialNumber = (phone: string) => {
  const sanitized = sanitizeDialNumberInput(phone);
  const digits = sanitized.replace(/\D/g, '');
  const hasPlus = sanitized.startsWith('+');

  return (
    digits.length >= MIN_DIAL_PHONE_DIGITS
    && digits.length <= MAX_DIAL_PHONE_DIGITS
    && /[1-9]/.test(digits)
    && (hasPlus ? /^\+[1-9]\d{6,14}$/.test(sanitized) : /^\d{7,15}$/.test(sanitized))
  );
};

const findVoiceNumber = (numbers: VoiceNumber[], value?: string | null) => {
  if (!value) {
    return undefined;
  }

  return numbers.find((number) => (
    number.id === value
    || number.phone_number === value
    || phoneNumbersMatch(number.phone_number, value)
  ));
};

const normalizeDialNumber = (phone: string) => {
  const cleaned = sanitizeDialNumberInput(phone);
  if (!cleaned || !isValidDialNumber(cleaned)) {
    return '';
  }
  return cleaned;
};

const findDialCountryForNumber = (phone: string) => {
  const sanitized = sanitizeDialNumberInput(phone);
  if (!sanitized.startsWith('+')) {
    return null;
  }

  return DIAL_COUNTRY_OPTIONS
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => sanitized.startsWith(country.dialCode)) ?? null;
};

const stripDialCountryCode = (phone: string, country: DialCountryOption) => {
  const sanitized = sanitizeDialNumberInput(phone);
  if (sanitized.startsWith(country.dialCode)) {
    return sanitized.slice(country.dialCode.length).replace(/\D/g, '');
  }
  return sanitized.replace(/^\+/, '').replace(/\D/g, '');
};

const normalizeDialInputForCountry = (phone: string, country: DialCountryOption) => {
  const sanitized = sanitizeDialNumberInput(phone);
  const detected = findDialCountryForNumber(sanitized);
  if (detected) {
    return {
      country: detected,
      localNumber: stripDialCountryCode(sanitized, detected),
    };
  }

  return {
    country,
    localNumber: sanitized.replace(/\D/g, ''),
  };
};

const normalizeDialNumberForCountry = (phone: string, country: DialCountryOption) => {
  const sanitized = sanitizeDialNumberInput(phone);
  if (!sanitized) {
    return '';
  }
  if (sanitized.startsWith('+')) {
    return normalizeDialNumber(sanitized);
  }

  const digits = sanitized.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return normalizeDialNumber(`${country.dialCode}${digits}`);
};

const isLikelyTechnicalId = (value?: string | null) => {
  const text = String(value ?? '').trim();
  if (!text) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    || /^[0-9a-f]{24,}$/i.test(text);
};

const isPhoneLikeValue = (value?: string | null) => {
  const text = String(value ?? '').trim();
  const digits = text.replace(/\D/g, '');
  return Boolean(digits.length >= 7 && digits.length <= 15 && !isLikelyTechnicalId(text));
};

const DEFAULT_AGENT_CALL_CONTEXT = [
  'You are placing an outbound call from LAD for TechieMaya.',
  `Start speaking immediately when the person answers. Open with: "${DEFAULT_OUTBOUND_STARTER_PROMPT}"`,
  'Then explain the purpose of the call clearly, listen to the user, answer briefly, and end politely. Do not stay silent after the call connects.',
].join(' ');

const GENERIC_AGENT_CONTEXTS = new Set([
  'call initiated from lad mobile dial pad',
  'call initiated from dashboard',
]);

const buildAgentCallContext = (savedContext: string | undefined, phoneNumber: string, contactName?: string) => {
  const trimmedContext = savedContext?.trim();
  const usefulContext = trimmedContext && !GENERIC_AGENT_CONTEXTS.has(trimmedContext.toLowerCase())
    ? trimmedContext
    : DEFAULT_AGENT_CALL_CONTEXT;
  const displayName = normalizeManualContactName(contactName, phoneNumber);

  return [
    `MANDATORY FIRST SPOKEN LINE: As soon as the call connects, immediately say: "${DEFAULT_OUTBOUND_STARTER_PROMPT}" Do not wait silently for the receiver to speak first.`,
    'After the first line, follow these call instructions:',
    usefulContext,
    displayName !== phoneNumber ? 'Contact name: ' + displayName + '.' : '',
    'Target number: ' + phoneNumber + '.',
    'If the receiver is silent, ask once: "Can you hear me clearly?" Then continue politely.',
  ].filter(Boolean).join('\n\n');
};

const normalizeManualContactName = (name: string | undefined, phoneNumber: string) => {
  const trimmed = sanitizeDialContactName(name);
  if (!trimmed) {
    return phoneNumber;
  }

  const lower = trimmed.toLowerCase();
  const placeholders = ['optional name', 'optional', '(optional)', 'lead name (optional)', 'enter name', 'name here'];
  return placeholders.includes(lower) ? phoneNumber : trimmed;
};

const scheduleCallHistoryRefresh = (fetchCalls: () => Promise<void>) => {
  // First refresh at 4 s — gives the backend time to propagate the call log to the
  // read endpoint before we overwrite the locally-prepended "queued" entry.
  [4000, 12000, 30000, 60000, 120000].forEach((delay) => {
    setTimeout(() => {
      void fetchCalls();
    }, delay);
  });
};

const toSentenceCaseCountry = (value: string) =>
  value.replace(/Detected country:\s*([a-z]+)/i, (_match, country: string) => `Detected country: ${country.charAt(0).toUpperCase()}${country.slice(1).toLowerCase()}`);

const appendSentence = (value: string, sentence: string) =>
  `${value.replace(/[.?!]\s*$/, '')}. ${sentence}`;

const extractCallErrorDetail = (message: string) => {
  const jsonMatch = message.match(/\{.*\}/);
  if (!jsonMatch) {
    return '';
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const detail = parsed.detail || parsed.message || parsed.error;
    return typeof detail === 'string' ? toSentenceCaseCountry(detail.trim()) : '';
  } catch {
    return '';
  }
};

const getCallErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to initiate the voice-agent call.';
  const status = isApiRequestError(error) ? error.status : null;
  const backendDetail = extractCallErrorDetail(message);
  const readableMessage = backendDetail || message;

  if (/only\s+uae\s+calls\s+allowed/i.test(readableMessage)) {
    return appendSentence(readableMessage, 'Use a UAE recipient number or switch to a calling number that supports this country.');
  }

  if (status === 402 || /402|payment|required|billing|credit|credits|balance|insufficient|plan/i.test(readableMessage)) {
    return 'Out of credits. Please add credits and try again.';
  }

  // A real HTTP status means the request reached the backend and got a response —
  // that is a backend/voice-provider failure, not a device connectivity problem, even
  // if its message happens to mention "network" or "timeout" (e.g. the voice provider
  // timing out). Only a thrown fetch error with no status at all is an actual
  // client-side network failure.
  if (status == null && /network|fetch failed|unable to reach|timeout|offline|proxy/i.test(readableMessage)) {
    return 'Network issue. Please check your connection and try again.';
  }

  if (/verified|calling number|from number|provider|voice account|agent/i.test(readableMessage)) {
    return 'Voice calling setup needs attention. Check your agent and calling number, then try again.';
  }

  if (/PRODUCTION database config missing|DB_HOST|DB_DATABASE|DB_USER|DB_PASSWORD/i.test(readableMessage)) {
    return 'Voice calling is temporarily unavailable. Please try again later.';
  }

  if (status != null && readableMessage) {
    return readableMessage;
  }

  return 'Unable to start the voice call. Please try again.';
};

const formatDetailValue = (value: unknown) => {
  if (value == null || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatCallTypeLabel = (type: CallRecord['type']) => {
  if (type === 'manual-dial') {
    return 'voice call';
  }

  if (type === 'missed') {
    return 'missed call';
  }

  return type;
};

const isResolvedBackendCall = (call: CallRecord) => {
  const details = call.backendDetails && typeof call.backendDetails === 'object' ? call.backendDetails as RawCallDetails : {};
  return call.callStatus === 'completed' ||
    call.callStatus === 'ended' ||
    call.duration > 1 ||
    Boolean(details.analysis) ||
    Boolean(details.transcript || details.transcription || details.transcripts);
};

const isGenericCallName = (value?: string | null) => {
  const normalized = sanitizeDialContactName(value).toLowerCase();
  return !normalized || normalized === 'unknown lead' || normalized === 'unknown contact' || normalized === 'manual dial' || isPlaceholderPhone(normalized) || phoneKey(normalized).length >= 7;
};

const getManualDialDisplayName = (call: CallRecord, details?: RawCallDetails | null) => {
  const metadata = getBackendMetadata(details);
  const value = normalizeContactDisplayName(String(
    pickBackendOrMetadataValue(details, 'contact_name', 'lead_name', 'manual_contact_name', 'client_name') ||
      metadata.contact_name ||
      metadata.lead_name ||
      metadata.manual_contact_name ||
      call.name ||
      '',
  ));
  return isGenericCallName(value) ? '' : value;
};

const isManualDialBackendCandidate = (call: CallRecord, details?: RawCallDetails | null) => {
  if (call.type === 'manual-dial') {
    return true;
  }
  if (isPlaceholderPhone(call.phone || call.name)) {
    return true;
  }

  const metadata = getBackendMetadata(details);
  const values = [
    call.name,
    call.type,
    details?.call_type,
    details?.type,
    details?.source,
    details?.trigger_source,
    details?.triggered_by,
    details?.direction,
    metadata.call_type,
    metadata.source,
    metadata.trigger_source,
  ].map((item) => String(item ?? '').toLowerCase());

  return values.some((item) => /manual[\s_-]?dial|manual/.test(item));
};

const getSelectedManualDialPhone = (call: CallRecord, details?: RawCallDetails | null) => {
  const value = call.phone || getDetailsPhone(details) || (isGenericCallName(call.name) ? '' : call.name);
  return isPlaceholderPhone(value) ? '' : value;
};

const manualDialTimesAreCompatible = (
  selectedDetails?: RawCallDetails | null,
  itemDetails?: RawCallDetails | null,
) => {
  const selectedStartedAt = getStartedAtMs(selectedDetails);
  const itemStartedAt = getStartedAtMs(itemDetails);
  if (!selectedStartedAt || !itemStartedAt) {
    return false;
  }

  return itemStartedAt >= selectedStartedAt - 2 * 60 * 1000
    && itemStartedAt <= selectedStartedAt + 24 * 60 * 60 * 1000;
};

const manualDialCandidateScore = (
  selectedCall: CallRecord,
  selectedDetails: RawCallDetails | null,
  item: CallRecord,
) => {
  const itemDetails = item.backendDetails && typeof item.backendDetails === 'object' ? item.backendDetails as RawCallDetails : null;
  if (item.id === selectedCall.id) {
    return isResolvedBackendCall(item) ? 0 : 100000;
  }
  if (detailsShareCorrelation(selectedDetails, itemDetails)) {
    return isResolvedBackendCall(item) ? 1 : 100001;
  }

  const selectedPhoneKey = phoneKey(getSelectedManualDialPhone(selectedCall, selectedDetails));
  const itemPhoneValue = item.phone || getDetailsPhone(itemDetails) || item.name;
  const itemPhoneKey = phoneKey(itemPhoneValue);
  if (
    selectedPhoneKey &&
    itemPhoneKey &&
    selectedPhoneKey === itemPhoneKey &&
    !isPlaceholderPhone(itemPhoneValue) &&
    manualDialTimesAreCompatible(selectedDetails, itemDetails)
  ) {
    return isResolvedBackendCall(item) ? 2 : 100002;
  }

  if (
    selectedCall.type === 'manual-dial' &&
    isResolvedBackendCall(item) &&
    isManualDialBackendCandidate(item, itemDetails) &&
    manualDialTimesAreCompatible(selectedDetails, itemDetails)
  ) {
    const selectedStartedAt = getStartedAtMs(selectedDetails);
    const itemStartedAt = getStartedAtMs(itemDetails);
    return selectedStartedAt && itemStartedAt ? 10 + Math.abs(itemStartedAt - selectedStartedAt) : 10;
  }

  return Number.MAX_SAFE_INTEGER;
};

const mergeManualDialBackendCall = (
  backendCall: CallRecord,
  selectedCall: CallRecord,
  selectedDetails?: RawCallDetails | null,
): CallRecord => {
  const phone = getSelectedManualDialPhone(selectedCall, selectedDetails) || backendCall.phone;
  const backendDetails = backendCall.backendDetails && typeof backendCall.backendDetails === 'object'
    ? backendCall.backendDetails as RawCallDetails
    : {};
  const metadata = getBackendMetadata(backendDetails);
  const selectedName = getManualDialDisplayName(selectedCall, selectedDetails);
  const backendName = getManualDialDisplayName(backendCall, backendDetails);
  const displayName = selectedName || backendName || (isGenericCallName(backendCall.name) && phone ? phone : backendCall.name);

  return {
    ...backendCall,
    name: displayName,
    phone,
    type: 'manual-dial',
    backendDetails: {
      ...backendDetails,
      local_dialed_number: phone,
      lad_app_dialed_number: phone,
      metadata: {
        ...metadata,
        local_dialed_number: phone,
        lad_app_dialed_number: phone,
        to_number: phone,
      },
    },
  };
};

const unwrapBackendCallDetails = (payload: unknown): RawCallDetails => {
  if (payload && typeof payload === 'object') {
    const record = payload as RawCallDetails;
    const nested = record.call ?? record.call_log ?? record.data ?? record.result;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as RawCallDetails;
    }
    return record;
  }

  return { value: payload };
};

const pickBackendValue = (details: RawCallDetails | null | undefined, ...keys: string[]) => {
  if (!details) {
    return undefined;
  }

  for (const key of keys) {
    const value = details[key];
    if (value != null && value !== '') {
      return value;
    }
  }

  return undefined;
};

const getBackendMetadata = (details: RawCallDetails | null | undefined): RawCallDetails => {
  const metadata = details?.metadata;
  if (!metadata) {
    return {};
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RawCallDetails : {};
    } catch {
      return {};
    }
  }

  return typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as RawCallDetails : {};
};

const pickBackendOrMetadataValue = (details: RawCallDetails | null | undefined, ...keys: string[]) => {
  const direct = pickBackendValue(details, ...keys);
  if (direct != null && direct !== '') {
    return direct;
  }

  return pickBackendValue(getBackendMetadata(details), ...keys);
};

const getNestedBackendRecord = (value: unknown): RawCallDetails => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as RawCallDetails : {}
);

const getBackendStatusReason = (details: RawCallDetails | null | undefined) => {
  const metadata = getBackendMetadata(details);
  const sipTrail = getNestedBackendRecord(metadata.sip_trail);
  return pickBackendOrMetadataValue(details, 'status_reason') ?? sipTrail.status_reason;
};

const getBackendOutcomeValue = (details: RawCallDetails | null | undefined) =>
  pickBackendOrMetadataValue(details, 'outcome', 'call_outcome', 'disposition');

const formatBackendDate = (value: unknown) => {
  if (!value) {
    return '-';
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildAbsoluteApiUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${RESOLVED_API_URL.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
};

const getRecordingUrlFromDetails = (details?: RawCallDetails | null) => {
  const metadata = getBackendMetadata(details);
  const value = pickBackendValue(
    details,
    'signed_recording_url',
    'recording_signed_url',
    'recording_url',
    'call_recording_url',
    'recordingUrl',
    'callRecordingUrl',
    'audio_url',
    'audioUrl',
  ) || pickBackendValue(
    metadata,
    'signed_recording_url',
    'recording_signed_url',
    'recording_url',
    'call_recording_url',
    'recordingUrl',
    'callRecordingUrl',
    'audio_url',
    'audioUrl',
  );

  return typeof value === 'string' && value.trim() ? buildAbsoluteApiUrl(value) : '';
};

const getCallIdForRecording = (details?: RawCallDetails | null, selected?: CallRecord | null) => String(
  pickBackendValue(details, 'call_log_id', 'id', 'call_id', 'callId') ||
    selected?.id ||
    '',
).trim();

const formatRecordingTime = (millis?: number) => {
  const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const unwrapRecordArray = (payload: unknown): RawCallDetails[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as RawCallDetails[];
  }

  const record = getRawObject(payload);
  for (const key of ['data', 'prospects', 'leads', 'contacts', 'items', 'results', 'rows']) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item) => item && typeof item === 'object') as RawCallDetails[];
    }
    const nested = getRawObject(value);
    for (const nestedKey of ['data', 'prospects', 'leads', 'contacts', 'items', 'results', 'rows']) {
      const nestedValue = nested[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue.filter((item) => item && typeof item === 'object') as RawCallDetails[];
      }
    }
  }

  for (const key of ['data', 'result', 'payload', 'contact', 'lead', 'prospect', 'item', 'record']) {
    const value = getRawObject(record[key]);
    if (Object.keys(value).length) {
      return [value];
    }
  }

  return Object.keys(record).length ? [record] : [];
};

const pickDisplayString = (...values: unknown[]) => {
  for (const value of values) {
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
};

const sanitizeDialContactName = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(manual\s+)?dial$/i, '')
    .trim();

const normalizeContactDisplayName = (value: string) => {
  const text = sanitizeDialContactName(value);
  if (!text) {
    return '';
  }

  const parts = text.split(' ');
  if (parts.length % 2 === 0) {
    const mid = parts.length / 2;
    const first = parts.slice(0, mid).join(' ').toLowerCase();
    const second = parts.slice(mid).join(' ').toLowerCase();
    if (first === second) {
      return parts.slice(0, mid).join(' ');
    }
  }

  return text;
};

const getDialContactNameFromRecord = (record: RawCallDetails) => {
  const metadata = getRawObject(record.metadata);
  const profile = getRawObject(record.profile || record.person || record.contact || record.lead || record.customer);
  const nested = getRawObject(record.data || record.result || record.payload || record.record);
  const name = normalizeContactDisplayName(pickDisplayString(
    record.contact_name,
    record.contactName,
    record.contact_full_name,
    record.contactFullName,
    record.manual_contact_name,
    record.manualContactName,
    record.client_name,
    record.clientName,
    record.customer_name,
    record.customerName,
    record.lead_name,
    record.leadName,
    record.lead_full_name,
    record.leadFullName,
    record.name,
    record.full_name,
    record.fullName,
    record.display_name,
    record.displayName,
    record.pushname,
    record.profile_name,
    [record.first_name, record.last_name].filter(Boolean).join(' '),
    [record.firstName, record.lastName].filter(Boolean).join(' '),
    profile.name,
    profile.full_name,
    profile.fullName,
    profile.contact_name,
    profile.contactName,
    profile.display_name,
    profile.displayName,
    [profile.first_name, profile.last_name].filter(Boolean).join(' '),
    [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    metadata.name,
    metadata.contact_name,
    metadata.contactName,
    metadata.manual_contact_name,
    metadata.manualContactName,
    metadata.client_name,
    metadata.clientName,
    metadata.customer_name,
    metadata.customerName,
    metadata.lead_name,
    metadata.leadName,
    metadata.display_name,
    metadata.displayName,
    [metadata.first_name, metadata.last_name].filter(Boolean).join(' '),
    [metadata.firstName, metadata.lastName].filter(Boolean).join(' '),
    nested.contact_name,
    nested.contactName,
    nested.manual_contact_name,
    nested.manualContactName,
    nested.client_name,
    nested.clientName,
    nested.customer_name,
    nested.customerName,
    nested.lead_name,
    nested.leadName,
    nested.name,
    nested.full_name,
    nested.fullName,
    nested.display_name,
    nested.displayName,
    [nested.first_name, nested.last_name].filter(Boolean).join(' '),
    [nested.firstName, nested.lastName].filter(Boolean).join(' '),
  ));
  return isPhoneLikeValue(name) || isLikelyTechnicalId(name) ? '' : name;
};

const getDialContactPhoneFromRecord = (record: RawCallDetails) => {
  const metadata = getRawObject(record.metadata);
  const profile = getRawObject(record.profile || record.person || record.contact || record.lead || record.customer);
  const nested = getRawObject(record.data || record.result || record.payload || record.record);
  const baseNumber = pickDisplayString(record.to_base_number, record.base_number, metadata.to_base_number, metadata.base_number);
  const countryCode = pickDisplayString(record.to_country_code, record.country_code, metadata.to_country_code, metadata.country_code);
  const composedNumber = baseNumber ? `${countryCode}${baseNumber}` : '';
  return pickDisplayString(
    record.phone,
    record.phone_e164,
    record.phone_number,
    record.phoneNumber,
    record.to_number,
    record.toNumber,
    record.local_dialed_number,
    record.localDialedNumber,
    record.lad_app_dialed_number,
    record.ladAppDialedNumber,
    record.mobile,
    record.mobile_number,
    record.mobileNumber,
    record.number,
    record.whatsapp_number,
    record.whatsappNumber,
    record.wa_id,
    record.waId,
    record.remote_jid,
    record.remoteJid,
    record.contact_phone,
    record.contactPhone,
    record.lead_phone,
    record.leadPhone,
    profile.phone,
    profile.phone_e164,
    profile.phone_number,
    profile.phoneNumber,
    profile.mobile,
    profile.mobile_number,
    profile.mobileNumber,
    profile.number,
    profile.whatsapp_number,
    profile.whatsappNumber,
    profile.wa_id,
    profile.waId,
    metadata.phone,
    metadata.phone_e164,
    metadata.phone_number,
    metadata.phoneNumber,
    metadata.to_number,
    metadata.toNumber,
    metadata.local_dialed_number,
    metadata.localDialedNumber,
    metadata.lad_app_dialed_number,
    metadata.ladAppDialedNumber,
    metadata.mobile,
    metadata.mobile_number,
    metadata.number,
    metadata.whatsapp_number,
    metadata.whatsappNumber,
    metadata.wa_id,
    metadata.waId,
    nested.phone,
    nested.phone_e164,
    nested.phone_number,
    nested.phoneNumber,
    nested.to_number,
    nested.toNumber,
    nested.local_dialed_number,
    nested.localDialedNumber,
    nested.lad_app_dialed_number,
    nested.ladAppDialedNumber,
    nested.mobile,
    nested.mobile_number,
    nested.number,
    nested.whatsapp_number,
    nested.whatsappNumber,
    nested.wa_id,
    composedNumber,
  );
};

const normalizeDialContactSuggestion = (
  record: RawCallDetails,
  source: DialContactSuggestion['source'],
  fallbackPhone = '',
): DialContactSuggestion | null => {
  const metadata = getRawObject(record.metadata);
  const profile = getRawObject(record.profile || record.person || record.contact || record.lead || record.customer);
  const nested = getRawObject(record.data || record.result || record.payload || record.record);
  const id = pickDisplayString(
    record.id,
    record._id,
    record.lead_id,
    record.leadId,
    record.contact_id,
    record.contactId,
    profile.id,
    profile._id,
    profile.lead_id,
    profile.leadId,
    profile.contact_id,
    profile.contactId,
    metadata.id,
    metadata.lead_id,
    metadata.contact_id,
    nested.id,
    nested._id,
    nested.lead_id,
    nested.leadId,
    nested.contact_id,
    nested.contactId,
  );
  const phone = getDialContactPhoneFromRecord(record) || fallbackPhone;
  const name = getDialContactNameFromRecord(record);
  if (!phone || !name) {
    return null;
  }

  return { id: id || `${source}-${phoneKey(phone) || phone}`, name, phone, source, raw: record };
};

const findLocalDialContact = (calls: CallRecord[], phone: string): DialContactSuggestion | null => {
  const search = phoneKey(phone);
  if (!search) {
    return null;
  }

  for (const call of calls) {
    const details = getRawObject(call.backendDetails);
    const metadata = getBackendMetadata(details);
    const localPhone = getSelectedManualDialPhone(call, details) || getDetailsPhone(details) || call.phone || phone;
    if (phoneKey(localPhone) !== search) {
      continue;
    }

    const localName = getManualDialDisplayName(call, details) || getDialContactNameFromRecord(details);
    const suggestion = normalizeDialContactSuggestion(
      {
        ...details,
        id: details.id || details.call_log_id || call.id,
        phone: localPhone,
        contact_name: localName,
        lead_name: localName,
        metadata: {
          ...metadata,
          phone: localPhone,
          contact_name: localName,
          lead_name: localName,
          manual_contact_name: localName,
        },
      },
      'call-log',
      phone,
    );

    if (suggestion && phoneKey(suggestion.phone) === search) {
      return suggestion;
    }
  }

  return null;
};

const findExistingDialContact = async (phone: string): Promise<DialContactSuggestion | null> => {
  const search = phoneKey(phone) || phone.replace(/\D/g, '');
  if (!search) {
    return null;
  }

  const callLogMatch = (await searchCallLogsForPhone(phone).catch(() => []))
    .map((item) => {
      const rawItem = getRawObject(item);
      const details = getRawObject(rawItem.backendDetails);
      return normalizeDialContactSuggestion(Object.keys(details).length ? details : getRawObject(item), 'call-log', phone);
    })
    .filter((item): item is DialContactSuggestion => Boolean(item))
    .find((item) => phoneKey(item.phone) === search || phoneKey(item.phone) === phoneKey(phone));

  if (callLogMatch) {
    return callLogMatch;
  }

  const queries = [
    { source: 'prospects' as const, path: '/api/prospects' },
    { source: 'pipeline' as const, path: '/api/deals-pipeline/leads' },
    { source: 'crm' as const, path: '/api/social-integration/gohighlevel/contacts/local' },
    { source: 'personal-whatsapp' as const, path: '/api/personal-whatsapp/contacts' },
    { source: 'whatsapp-business' as const, path: '/api/conversations' },
    { source: 'gmail' as const, path: '/api/email-comms/contacts', extraParams: { provider: 'google', channel: 'gmail' } },
    { source: 'outlook' as const, path: '/api/email-comms/contacts', extraParams: { provider: 'microsoft', channel: 'outlook' } },
  ];

  for (const query of queries) {
    const paramVariants = [
      { search, limit: 10 },
      { q: search, limit: 10 },
      { query: search, limit: 10 },
      { phone: search, limit: 10 },
      { phone_e164: phone, limit: 10 },
      { phone_number: search, limit: 10 },
      { phoneNumber: search, limit: 10 },
      { mobile: search, limit: 10 },
      { mobile_number: search, limit: 10 },
      { number: search, limit: 10 },
      { whatsapp_number: search, limit: 10 },
    ];

    for (const params of paramVariants) {
      try {
        const response = await apiGet<unknown>(query.path, { params: { ...params, ...(query.extraParams ?? {}) } });
        const records = unwrapRecordArray(response.data);
        const allowFallbackPhone = records.length === 1 ? phone : '';
        const match = records
          .map((item) => normalizeDialContactSuggestion(item, query.source, allowFallbackPhone))
          .filter((item): item is DialContactSuggestion => Boolean(item))
          .find((item) => phoneKey(item.phone) === search || phoneKey(item.phone) === phoneKey(phone));
        if (match) {
          return match;
        }
      } catch {
        // Try the next lightweight query shape.
      }
    }
  }

  return null;
};

const buildExistingContactMetadata = (contact: DialContactSuggestion | null) => {
  if (!contact) {
    return {};
  }

  return {
    contact_source: contact.source,
    existing_contact_lookup_id: String(contact.id),
    existing_contact_lookup_name: contact.name,
    existing_contact_lookup_phone: contact.phone,
  };
};

const updateExistingDialContactName = async (contact: DialContactSuggestion, name: string) => {
  const trimmed = normalizeContactDisplayName(name);
  if (!trimmed || trimmed === contact.name) {
    return;
  }

  if (contact.source === 'pipeline') {
    await apiPut(`/api/deals-pipeline/leads/${encodeURIComponent(contact.id)}`, { name: trimmed });
    return;
  }

  if (contact.source === 'prospects') {
    return;
  }

  if (contact.source === 'call-log') {
    return;
  }

  if (contact.source === 'crm') {
    return;
  }

  if (contact.source === 'personal-whatsapp') {
    return;
  }

  if (contact.source === 'whatsapp-business') {
    return;
  }

  if (contact.source === 'gmail' || contact.source === 'outlook') {
    return;
  }
};

const renameCallsForDialContact = (
  calls: CallRecord[],
  contact: DialContactSuggestion,
  phone: string,
  name: string,
) => {
  const contactPhoneKey = phoneKey(contact.phone) || phoneKey(phone);
  const contactId = String(contact.id);
  return calls.map((call) => {
    const details = getRawObject(call.backendDetails);
    const metadata = getBackendMetadata(details);
    const callIds = [
      details.contact_id,
      details.contactId,
      details.lead_id,
      details.leadId,
      details.existing_contact_id,
      metadata.contact_id,
      metadata.contactId,
      metadata.lead_id,
      metadata.leadId,
      metadata.existing_contact_id,
    ].map((value) => String(value ?? '')).filter(Boolean);
    const callPhoneKey = phoneKey(call.phone || getDetailsPhone(details));
    const matches = callIds.includes(contactId) || (contactPhoneKey && callPhoneKey === contactPhoneKey);

    if (!matches) {
      return call;
    }

    return {
      ...call,
      name,
      backendDetails: {
        ...details,
        contact_name: name,
        lead_name: name,
        manual_contact_name: name,
        metadata: {
          ...metadata,
          contact_name: name,
          lead_name: name,
          manual_contact_name: name,
        },
      },
    };
  });
};

const getDisplayFromNumber = (
  call: CallRecord | null,
  details: RawCallDetails | null,
  numbers: VoiceNumber[],
) => {
  const metadata = getBackendMetadata(details);
  const candidates = [
    pickBackendValue(details, 'from_number', 'caller_number', 'caller_id', 'from_phone_number'),
    pickBackendValue(metadata, 'from_number', 'caller_number', 'caller_id', 'from_phone_number'),
    call?.fromNumber?.phoneNumber,
    call?.fromNumber?.label,
  ].map((item) => String(item ?? '').trim());

  const phoneCandidate = candidates.find(isPhoneLikeValue);
  if (phoneCandidate) {
    return phoneCandidate;
  }

  const fromId = String(
    pickBackendValue(details, 'from_number_id', 'fromNumberId') ||
      pickBackendValue(metadata, 'from_number_id', 'fromNumberId') ||
      call?.fromNumber?.id ||
      '',
  ).trim();
  const matchedNumber = numbers.find((number) => number.id === fromId || phoneNumbersMatch(number.phone_number, fromId));
  return matchedNumber?.phone_number || '-';
};

const getCallFailureDetail = (details: RawCallDetails | null, call: CallRecord | null) => {
  const metadata = getBackendMetadata(details);
  const value = pickDisplayString(
    getBackendStatusReason(details),
    getBackendOutcomeValue(details),
    pickBackendValue(details, 'error_message', 'failure_reason', 'message', 'provider_message'),
    pickBackendValue(metadata, 'error_message', 'failure_reason', 'message', 'provider_message'),
    call?.aiSummary.callOutcome,
  );
  return value || '-';
};

function DetailSection({
  title,
  appTheme,
  children,
}: {
  title: string;
  appTheme: AppTheme;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.detailSection, { borderColor: appTheme.borderSoft }]}>
      <Typography variant="bodySmall" color={appTheme.text} style={styles.detailSectionTitle}>{title}</Typography>
      {children}
    </View>
  );
}

function DetailRow({
  label,
  value,
  appTheme,
}: {
  label: string;
  value: string;
  appTheme: AppTheme;
}) {
  return (
    <View style={[styles.detailRow, { borderColor: appTheme.borderSoft }]}>
      <Typography variant="caption" color={appTheme.disabled} style={styles.detailLabel}>
        {label}
      </Typography>
      <Typography variant="bodySmall" color={appTheme.text} style={styles.detailValue}>
        {value || '-'}
      </Typography>
    </View>
  );
}

export default function CallsScreen() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isCompactDialer = height < 760 || width < 390;
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const handleBottomTabScroll = useBottomTabScrollHandler(setIsBottomNavHidden);
  const dialFabProgress = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [selectedDialCountry, setSelectedDialCountry] = useState<DialCountryOption>(DEFAULT_DIAL_COUNTRY);
  const [isDialCountryPickerOpen, setIsDialCountryPickerOpen] = useState(false);
  const [dialContactName, setDialContactName] = useState('');
  const [dialContactSuggestion, setDialContactSuggestion] = useState<DialContactSuggestion | null>(null);
  const [isDialContactLookupLoading, setIsDialContactLookupLoading] = useState(false);
  const [dialContactNameEdited, setDialContactNameEdited] = useState(false);
  const [dialAutoFilledContactKey, setDialAutoFilledContactKey] = useState('');
  const [callGoals, setCallGoals] = useState<CallGoal[]>([]);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalType, setGoalType] = useState<CallGoalType>('get_meeting');
  const [goalTargetCalls, setGoalTargetCalls] = useState('10');
  const [goalNotes, setGoalNotes] = useState('');
  const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([]);
  const [voiceNumbers, setVoiceNumbers] = useState<VoiceNumber[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>();
  const [savedVoiceConfig, setSavedVoiceConfig] = useState<SavedVoiceCallConfig | null>(null);
  const [isVoiceConfigLoading, setIsVoiceConfigLoading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isManualRefreshActive, setIsManualRefreshActive] = useState(false);
  const [callFeedback, setCallFeedback] = useState<CallFeedback | null>(null);
  const [callFailureDialog, setCallFailureDialog] = useState<CallFailureDialog | null>(null);
  const [showContactNameRequired, setShowContactNameRequired] = useState(false);
  const [voiceConfigError, setVoiceConfigError] = useState<string | null>(null);
  // No per-call instruction override — always use saved AI Voice Calling config
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [isNumberPickerOpen, setIsNumberPickerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [selectedCallDetails, setSelectedCallDetails] = useState<RawCallDetails | null>(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<RawLeadDetails | null>(null);
  const [selectedContactCalls, setSelectedContactCalls] = useState<CallRecord[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isRecordingOpening, setIsRecordingOpening] = useState(false);
  const [recordingResolvedUrl, setRecordingResolvedUrl] = useState('');
  const [recordingPlaying, setRecordingPlaying] = useState(false);
  const [recordingPositionMs, setRecordingPositionMs] = useState(0);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const setCallDialerOpen = useOverlayStore((state) => state.setCallDialerOpen);
  const listRef = useRef<FlatList<CallRecord>>(null);
  const manualCallInFlightRef = useRef(false);
  const recordingSoundRef = useRef<Audio.Sound | null>(null);
  const {
    calls,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    initializeRealtime,
    fetchCalls,
    fetchNextCalls,
    prependCall,
    setCalls,
  } = useCallStore();

  const resetRecordingPlayback = useCallback(async () => {
    const sound = recordingSoundRef.current;
    recordingSoundRef.current = null;
    if (sound) {
      await sound.stopAsync().catch(() => undefined);
      await sound.unloadAsync().catch(() => undefined);
    }
    setRecordingResolvedUrl('');
    setRecordingPlaying(false);
    setRecordingPositionMs(0);
    setRecordingDurationMs(0);
    setRecordingError(null);
    setIsRecordingOpening(false);
  }, []);

  useEffect(() => {
    return () => {
      const sound = recordingSoundRef.current;
      recordingSoundRef.current = null;
      if (sound) {
        void sound.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    void resetRecordingPlayback();
  }, [resetRecordingPlayback, selectedCall?.id]);

  useEffect(() => {
    Animated.timing(dialFabProgress, {
      toValue: isBottomNavHidden ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [dialFabProgress, isBottomNavHidden]);

  const dialFabBottom = dialFabProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(insets.bottom + 74, 88), Math.max(insets.bottom + 14, 18)],
  });
  const dialFabRight = dialFabProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 10],
  });

  useEffect(() => {
    initializeRealtime();
    void fetchCalls();
  }, [fetchCalls, initializeRealtime]);

  const handleRefreshCalls = useCallback(async () => {
    if (isManualRefreshActive) {
      return;
    }

    setIsManualRefreshActive(true);
    try {
      await fetchCalls({ force: true, replace: true });
    } finally {
      setIsManualRefreshActive(false);
    }
  }, [fetchCalls, isManualRefreshActive]);

  useEffect(() => {
    setCallDialerOpen(isDialerOpen);
    return () => {
      setCallDialerOpen(false);
    };
  }, [isDialerOpen, setCallDialerOpen]);

  useEffect(() => {
    let mounted = true;

    safeStorage.getItem(CALL_GOALS_STORAGE_KEY)
      .then((stored) => {
        if (!mounted || !stored) {
          return;
        }

        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCallGoals(parsed);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;

    const loadVoiceConfig = async () => {
      setIsVoiceConfigLoading(true);
      setVoiceConfigError(null);
      let savedConfig: SavedVoiceCallConfig | null = null;

      try {
        savedConfig = await loadVoiceCallConfig();
        const loadedConfig = savedConfig;
        if (mounted && loadedConfig) {
          setSavedVoiceConfig(loadedConfig);
          setSelectedAgentId((current) => current ?? loadedConfig.agentId);
          setSelectedFromNumber((current) => current ?? loadedConfig.fromNumber);
        }
        const options = await fetchVoiceCallOptions();

        if (!mounted) {
          return;
        }

        const agents = options.agents;
        const numbers = options.numbers.map((number) => ({
          id: number.id,
          phone_number: number.phoneNumber,
          base_number: number.baseNumber,
          country_code: number.countryCode,
          provider: number.provider,
          assignedAgentId: number.assignedAgentId,
        }));

        const savedNumber = loadedConfig ? findVoiceNumber(numbers, loadedConfig.fromNumber) : undefined;
        const savedConfigIsListed = Boolean(
          loadedConfig
            && agents.some((agent) => agent.id === loadedConfig.agentId)
            && savedNumber,
        );
        const savedAgentId = savedNumber?.assignedAgentId || loadedConfig?.agentId;
        const fallbackAgentId = numbers.find((number) => number.assignedAgentId)?.assignedAgentId ?? agents[0]?.id;

        setVoiceAgents(agents);
        setVoiceNumbers(numbers);
        setSavedVoiceConfig(loadedConfig || null);
        setSelectedAgentId((current) => loadedConfig ? (savedAgentId || loadedConfig.agentId) : current ?? fallbackAgentId);
        setSelectedFromNumber((current) => loadedConfig ? (savedNumber?.phone_number || loadedConfig.fromNumber) : current ?? numbers[0]?.phone_number);
        // Dial instructions always come from saved config — no state needed here

        if (savedConfigIsListed && loadedConfig && savedAgentId) {
          const syncAgent = agents.find((agent) => agent.id === savedAgentId);
          if (syncAgent) {
            void syncVoiceAgentCallPrompt(syncAgent, loadedConfig.context)
              .then((syncedAgentPrompt) => {
                if (!mounted) {
                  return;
                }
                setVoiceAgents((currentAgents) => currentAgents.map((agent) => (
                  agent.id === syncAgent.id
                    ? { ...agent, ...syncedAgentPrompt }
                    : agent
                )));
                setVoiceConfigError(null);
              })
              .catch((syncError) => {
                if (!mounted) {
                  return;
                }
                if (!savedConfig) {
                  setVoiceConfigError(syncError instanceof Error ? syncError.message : 'Could not sync starter prompt.');
                }
              });
          }
        }
      } catch (error) {
        if (mounted) {
          setVoiceConfigError(savedConfig ? null : error instanceof Error ? error.message : 'Could not load voice agent configuration.');
        }
      } finally {
        if (mounted) {
          setIsVoiceConfigLoading(false);
        }
      }
    };

    void loadVoiceConfig();

    return () => {
      mounted = false;
    };
  }, []);


  const selectedVoiceAgent = useMemo(
    () => voiceAgents.find((agent) => agent.id === selectedAgentId) ?? voiceAgents[0],
    [selectedAgentId, voiceAgents],
  );

  const selectedVoiceNumber = useMemo(
    () => findVoiceNumber(voiceNumbers, selectedFromNumber) ?? voiceNumbers[0],
    [selectedFromNumber, voiceNumbers],
  );
  const normalizedDialNumber = useMemo(
    () => normalizeDialNumberForCountry(dialNumber, selectedDialCountry),
    [dialNumber, selectedDialCountry],
  );
  const hasSavedVoiceSetup = Boolean(savedVoiceConfig?.agentId && savedVoiceConfig?.fromNumber);
  const isDialCallDisabled = !isValidDialNumber(normalizedDialNumber)
    || isCalling
    || (isVoiceConfigLoading && !hasSavedVoiceSetup);

  useEffect(() => {
    setDialAutoFilledContactKey('');
  }, [normalizedDialNumber]);

  useEffect(() => {
    if (!isDialerOpen || normalizedDialNumber.replace(/\D/g, '').length < MIN_DIAL_PHONE_DIGITS) {
      setDialContactSuggestion(null);
      setIsDialContactLookupLoading(false);
      return;
    }

    const localMatch = findLocalDialContact(calls, normalizedDialNumber);
    if (localMatch) {
      setDialContactSuggestion(localMatch);
      setIsDialContactLookupLoading(false);
      const matchKey = `${normalizedDialNumber}:${localMatch.id}`;
      const canAutoFill = Boolean(
        (!dialContactNameEdited || !dialContactName.trim()) &&
        (dialAutoFilledContactKey !== matchKey || !dialContactName.trim()),
      );
      if (canAutoFill) {
        setDialContactName(localMatch.name);
        setDialContactNameEdited(false);
        setDialAutoFilledContactKey(matchKey);
        setShowContactNameRequired(false);
      }
      return;
    }

    let cancelled = false;
    setIsDialContactLookupLoading(true);
    void findExistingDialContact(normalizedDialNumber)
      .then((match) => {
        if (cancelled) {
          return;
        }
        setDialContactSuggestion(match);
        const matchKey = match ? `${normalizedDialNumber}:${match.id}` : '';
        const canAutoFill = Boolean(
          match &&
          (!dialContactNameEdited || !dialContactName.trim()) &&
          (dialAutoFilledContactKey !== matchKey || !dialContactName.trim()),
        );
        if (match && canAutoFill) {
          setDialContactName(match.name);
          setDialContactNameEdited(false);
          setDialAutoFilledContactKey(matchKey);
          setShowContactNameRequired(false);
        } else if (!match && !dialContactNameEdited) {
          setDialContactName('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDialContactLookupLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [calls, dialAutoFilledContactKey, dialContactName, dialContactNameEdited, isDialerOpen, normalizedDialNumber]);

  const filteredCalls = useMemo(() => calls.filter((call) => {
    const query = search.trim().toLowerCase();
    const displayName = call.name.toLowerCase();
    const matchesSearch = !query
      || displayName.includes(query)
      || call.name.toLowerCase().includes(query)
      || (call.phone ?? '').toLowerCase().includes(query);
    const matchesTab = activeTab === 'all' || (activeTab === 'missed' && call.type === 'missed');
    return matchesSearch && matchesTab;
  }), [activeTab, calls, search]);
  const showCallConnectionError = isConnectionUnavailableError(error);
  const displayedCalls = showCallConnectionError ? [] : filteredCalls;
  const isCallListLoading = isLoading || isRefreshing || isManualRefreshActive;
  const noConnectionCallsMinHeight = Math.max(340, height - insets.top - insets.bottom - 330);

  const persistGoals = useCallback((nextGoals: CallGoal[]) => {
    setCallGoals(nextGoals);
    void safeStorage.setItem(CALL_GOALS_STORAGE_KEY, JSON.stringify(nextGoals));
  }, []);

  const resetGoalForm = useCallback(() => {
    setGoalTitle('');
    setGoalType('get_meeting');
    setGoalTargetCalls('10');
    setGoalNotes('');
  }, []);

  const openGoalModal = useCallback(() => {
    resetGoalForm();
    setGoalModalOpen(true);
  }, [resetGoalForm]);

  const handleCreateGoal = useCallback(() => {
    const normalizedTarget = Math.max(1, Number.parseInt(goalTargetCalls, 10) || 1);
    const selectedGoalLabel = getGoalLabel(goalType);
    const title = goalTitle.trim() || selectedGoalLabel;

    const nextGoal: CallGoal = {
      id: `goal-${Date.now()}`,
      title,
      type: goalType,
      targetCalls: normalizedTarget,
      notes: goalNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    persistGoals([nextGoal, ...callGoals].slice(0, 6));
    setGoalModalOpen(false);
    resetGoalForm();
  }, [callGoals, goalNotes, goalTargetCalls, goalTitle, goalType, persistGoals, resetGoalForm]);



  const handleAction = (type: string) => {
    Alert.alert(type, `${type} feature coming soon!`);
  };

  const openDialer = useCallback((number?: string) => {
    if (number) {
      const normalized = normalizeDialInputForCountry(number, selectedDialCountry);
      setSelectedDialCountry(normalized.country);
      setDialNumber(normalized.localNumber);
    } else {
      setDialNumber('');
    }
    setDialContactName('');
    setDialContactSuggestion(null);
    setDialContactNameEdited(false);
    setDialAutoFilledContactKey('');
    setIsDialCountryPickerOpen(false);
    setShowContactNameRequired(false);
    setCallFeedback(null);
    void loadVoiceCallConfig().then((config) => {
      if (config) {
        const savedNumber = findVoiceNumber(voiceNumbers, config.fromNumber);
        setSavedVoiceConfig(config);
        setSelectedAgentId(config.agentId);
        setSelectedFromNumber(savedNumber?.phone_number || config.fromNumber);
      }
    });
    setIsDialerOpen(true);
  }, [selectedDialCountry, voiceNumbers]);

  const handleDialNumberChange = useCallback((value: string) => {
    const normalized = normalizeDialInputForCountry(value, selectedDialCountry);
    setSelectedDialCountry(normalized.country);
    setDialNumber(normalized.localNumber);
    setDialContactSuggestion(null);
    setDialAutoFilledContactKey('');
  }, [selectedDialCountry]);

  const appendDialDigit = useCallback((digit: string) => {
    setDialNumber((current) => sanitizeDialNumberInput(`${current}${digit}`).replace(/\D/g, ''));
  }, []);

  const deleteDialDigit = useCallback(() => {
    setDialNumber((current) => current.slice(0, -1));
  }, []);

  const handlePhoneFallback = useCallback(async (phoneNumber: string) => {
    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch {
      Alert.alert('Call unavailable', 'This device could not open the phone app.');
    }
  }, []);

  const handleManualCall = useCallback(async () => {
    if (manualCallInFlightRef.current) {
      return;
    }

    setCallFeedback(null);
    const contactName = dialContactName.trim();
    const normalizedNumber = normalizedDialNumber;

    if (!contactName) {
      setShowContactNameRequired(true);
      setCallFeedback({ type: 'error', text: 'Contact name is required before starting an agent call.' });
      return;
    }

    if (!normalizedNumber) {
      setCallFeedback({ type: 'error', text: 'Enter a valid phone number with 7 to 15 digits.' });
      Alert.alert('Invalid phone number', 'Enter a valid phone number with 7 to 15 digits. Country code is optional.');
      return;
    }

    const latestConfig = await loadVoiceCallConfig().catch(() => null);
    const latestConfigIsUsable = Boolean(latestConfig?.agentId && latestConfig?.fromNumber);
    const effectiveSavedConfig = latestConfigIsUsable ? latestConfig : savedVoiceConfig;
    const configuredFromNumber = effectiveSavedConfig?.fromNumber || selectedFromNumber;
    const configuredVoiceNumber = findVoiceNumber(voiceNumbers, configuredFromNumber);
    const normalizedFromNumber = configuredVoiceNumber?.phone_number || normalizeE164Like(configuredFromNumber);
    const configuredAgentId = configuredVoiceNumber?.assignedAgentId || effectiveSavedConfig?.agentId || selectedAgentId;
    // Always use the saved AI Voice Calling config from Settings — no per-call override
    const effectiveInstructions = effectiveSavedConfig?.context;
    const manualContactName = normalizeManualContactName(contactName, normalizedNumber);
    const existingContactMetadata = buildExistingContactMetadata(dialContactSuggestion);
    const configuredContext = buildAgentCallContext(effectiveInstructions, normalizedNumber, manualContactName);
    const configuredAgentName = voiceAgents.find((agent) => agent.id === configuredAgentId)?.name || effectiveSavedConfig?.agentName || selectedVoiceAgent?.name || 'Voice agent';
    const clientCallId = `lad-manual-${Date.now()}`;
    const startedAt = new Date().toISOString();

    if (latestConfigIsUsable && latestConfig) {
      setSavedVoiceConfig(latestConfig);
      setSelectedAgentId(configuredAgentId || latestConfig.agentId);
      setSelectedFromNumber(configuredVoiceNumber?.phone_number || latestConfig.fromNumber);
    }

    if (!configuredAgentId || !normalizedFromNumber) {
      setCallFeedback({
        type: 'error',
        text: voiceConfigError || 'Open Settings > AI Voice Calling, select one of the verified numbers, add content, and save it first.',
      });
      Alert.alert(
        'AI Agent unavailable',
        voiceConfigError || 'Open Settings > AI Voice Calling, select one of the verified numbers, add content, and save it first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Phone App', onPress: () => void handlePhoneFallback(normalizedNumber) },
        ],
      );
      return;
    }

    const configuredAgent = voiceAgents.find((agent) => agent.id === configuredAgentId) ?? {
      id: configuredAgentId,
      name: configuredAgentName,
    };
    if (!configuredAgent) {
      setCallFeedback({ type: 'error', text: 'Refresh Settings > AI Voice Calling, save the setup again, then retry the call.' });
      Alert.alert('Voice agent unavailable', 'Refresh Settings > AI Voice Calling, save the setup again, then retry the call.');
      return;
    }

    manualCallInFlightRef.current = true;
    setIsCalling(true);
    setCallFeedback({ type: 'info', text: `Calling ${normalizedNumber} with ${configuredAgentName}...` });

    try {
      if (dialContactSuggestion) {
        if (manualContactName !== dialContactSuggestion.name) {
          try {
            await updateExistingDialContactName(dialContactSuggestion, manualContactName);
          } catch (updateError) {
            const message = updateError instanceof Error
              ? updateError.message
              : 'Unable to update the existing contact name.';
            setCallFeedback({ type: 'error', text: message });
            Alert.alert('Contact update failed', message);
            return;
          }
        }
        const updatedContact = { ...dialContactSuggestion, name: manualContactName };
        setDialContactSuggestion(updatedContact);
        setCalls(renameCallsForDialContact(useCallStore.getState().calls, updatedContact, normalizedNumber, manualContactName));
      }

      // Best-effort: push the latest starter prompt to the agent. Never blocks the call.
      void syncVoiceAgentCallPrompt(configuredAgent, configuredContext)
        .then((syncedAgentPrompt) => {
          setVoiceAgents((currentAgents) => currentAgents.map((agent) => (
            agent.id === configuredAgent.id
              ? { ...agent, ...syncedAgentPrompt }
              : agent
          )));
        })
        .catch(() => undefined);

      const responseData = await makeCall({
        voiceAgentId: configuredAgentId,
        phoneNumber: normalizedNumber,
        context: configuredContext,
        fromNumber: normalizedFromNumber,
        fromNumberId: configuredVoiceNumber?.id,
        contactName: manualContactName,
        agentName: configuredAgentName,
        openingMessage: DEFAULT_OUTBOUND_STARTER_PROMPT,
        clientCallId,
        startedAt,
        metadata: {
          ...existingContactMetadata,
          idempotency_key: clientCallId,
          request_id: clientCallId,
          source_table: 'lad_stage.voice_call_logs',
          call_type: 'manual_dial',
          source: 'lad_mobile_dialer',
          contact_name: manualContactName,
          lead_name: manualContactName,
          manual_contact_name: manualContactName,
          name: manualContactName,
          full_name: manualContactName,
          customer_name: manualContactName,
          to_number: normalizedNumber,
          phone_number: normalizedNumber,
        },
      });

      // Use the real call log ID returned by the backend (not a fabricated one).
      // This allows the live-call poll to track and update this exact record once
      // the backend propagates it to the call list endpoint.
      const backendCallLogId = findCallLogIdInPayload(responseData) || `lad-dialing-${Date.now()}`;
      const hasContactName = Boolean(manualContactName) && manualContactName !== normalizedNumber;
      const displayName = hasContactName ? manualContactName : normalizedNumber;

      // Register an override so applyManualDialOverride shows the contact name and
      // real phone number when the backend record lands (the backend may store a
      // generic name or placeholder number until its async write completes).
      registerManualDialCallOverride(backendCallLogId, normalizedNumber, startedAt, hasContactName ? manualContactName : undefined);

      // Immediately prepend a "queued" entry using the real backend call log ID.
      // This gives instant visual feedback and — since its callStatus is live —
      // activates the 15 s live-call poll so status updates arrive automatically.
      const queuedCall: CallRecord = {
        id: backendCallLogId,
        name: displayName,
        phone: normalizedNumber,
        type: 'manual-dial',
        time: 'Just now',
        avatar: '',
        statusColor: '#7C3AED',
        duration: 0,
        transcript: '',
        engagement_score: 0,
        leadTemperature: 'warm',
        aiSummary: { customerIntent: '', callOutcome: '', discussionPoints: [], followUpSuggestion: '' },
        callStatus: 'queued',
        backendDetails: {
          id: backendCallLogId,
          call_log_id: backendCallLogId,
          to_number: normalizedNumber,
          from_number: normalizedFromNumber,
          local_dialed_number: normalizedNumber,
          lad_app_dialed_number: normalizedNumber,
          status: 'queued',
          local_started_at: startedAt,
          client_call_id: clientCallId,
          contact_name: hasContactName ? manualContactName : undefined,
          lead_name: hasContactName ? manualContactName : undefined,
          manual_contact_name: hasContactName ? manualContactName : undefined,
          ...existingContactMetadata,
          metadata: {
            ...existingContactMetadata,
            local_dialed_number: normalizedNumber,
            lad_app_dialed_number: normalizedNumber,
            client_call_id: clientCallId,
            call_type: 'manual_dial',
            source: 'lad_mobile_dialer',
            contact_name: hasContactName ? manualContactName : undefined,
            lead_name: hasContactName ? manualContactName : undefined,
            manual_contact_name: hasContactName ? manualContactName : undefined,
          },
        },
        agent: configuredAgent ? {
          id: configuredAgent.id,
          name: configuredAgent.name,
          language: 'English',
          accent: 'Default',
          gender: 'AI',
        } : undefined,
        fromNumber: normalizedFromNumber ? {
          id: configuredVoiceNumber?.id || normalizedFromNumber,
          label: normalizedFromNumber,
          phoneNumber: normalizedFromNumber,
        } : undefined,
      };
      prependCall(queuedCall);
      registerPendingManualDialCall(queuedCall);

      setCallFeedback({ type: 'success', text: `Call started for ${normalizedNumber}. Status will update as the agent connects.` });
      setDialNumber('');
      setDialContactName('');
      setDialContactSuggestion(null);
      setDialContactNameEdited(false);
      setDialAutoFilledContactKey('');
      setShowContactNameRequired(false);
      setIsDialerOpen(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      // Schedule backend refreshes: first at 4 s (backend propagation window),
      // then at 12 / 30 / 60 / 120 s for status progression tracking.
      scheduleCallHistoryRefresh(() => fetchCalls({ force: true }));
    } catch (error) {
      const message = getCallErrorMessage(error);
      setCallFeedback({ type: 'error', text: message });
      setCallFailureDialog({ message, phoneNumber: normalizedNumber });
    } finally {
      manualCallInFlightRef.current = false;
      setIsCalling(false);
    }
  }, [dialContactName, dialContactSuggestion, fetchCalls, handlePhoneFallback, normalizedDialNumber, savedVoiceConfig, selectedAgentId, selectedFromNumber, selectedVoiceAgent?.name, setCalls, voiceAgents, voiceConfigError, voiceNumbers]);

  const openCallDetails = useCallback((call: CallRecord) => {
    setSelectedCall(call);
    setSelectedCallDetails(call.backendDetails ?? null);
    setSelectedLeadDetails(null);
    setSelectedContactCalls([call]);
    setDetailsError(null);
    setIsDetailsLoading(true);

    const loadBackendDetails = async () => {
      let resolvedCall = call;
      let resolvedDetails = call.backendDetails && typeof call.backendDetails === 'object'
        ? call.backendDetails as RawCallDetails
        : null;

      const loadLeadDetails = async (callId: string) => {
        if (!callId || isOptimisticManualCallId(callId)) {
          return;
        }

        try {
          const leadPayload = await getCallLead(callId);
          const leadDetails = unwrapLeadDetails(leadPayload);
          if (leadDetails) {
            setSelectedLeadDetails(leadDetails);
            const leadName = getLeadDisplayName(leadDetails);
            const leadPhone = getDetailsPhone(leadDetails);
            setSelectedCall((current) => current && current.id === resolvedCall.id
              ? {
                  ...current,
                  name: leadName || current.name,
                  phone: current.phone || leadPhone,
                  backendDetails: {
                    ...getRawObject(current.backendDetails),
                    lead: leadDetails,
                  },
                }
              : current);
          }
        } catch {
          // Lead details are additive; keep the call record if LAD has no linked lead.
        }
      };

      const findMatchingBackendCall = async () => {
        const selectedPhone = call.phone || getDetailsPhone(resolvedDetails) || call.name;
        const searchedLogs = selectedPhone ? await searchCallLogsForPhone(selectedPhone) : [];
        const currentLogs = useCallStore.getState().calls
          .map((item) => item.backendDetails && typeof item.backendDetails === 'object' ? item.backendDetails : item)
          .filter(Boolean);
        const rawLogs = [...searchedLogs, ...currentLogs].filter((item, index, array) => {
          const record = item && typeof item === 'object' ? item as RawCallDetails : {};
          const id = String(record.call_log_id ?? record.id ?? record.call_id ?? `idx-${index}`);
          return array.findIndex((candidate, candidateIndex) => {
            const candidateRecord = candidate && typeof candidate === 'object' ? candidate as RawCallDetails : {};
            const candidateId = String(candidateRecord.call_log_id ?? candidateRecord.id ?? candidateRecord.call_id ?? `idx-${candidateIndex}`);
            return candidateId === id;
          }) === index;
        });
        const matches = rawLogs
          .map((item) => normalizeCallLog(item as never))
          .filter((item) => {
            return manualDialCandidateScore(call, resolvedDetails, item) < Number.MAX_SAFE_INTEGER;
          })
          .sort((a, b) => {
            return manualDialCandidateScore(call, resolvedDetails, a) - manualDialCandidateScore(call, resolvedDetails, b);
          });

        return matches.find((item) => !isOptimisticManualCallId(item.id) && isResolvedBackendCall(item))
          ?? matches.find((item) => !isOptimisticManualCallId(item.id))
          ?? null;
      };

      const updateFromPayload = (payload: unknown) => {
        const details = unwrapBackendCallDetails(payload);
        setSelectedCallDetails(details);
        resolvedDetails = details;

        try {
          const normalized = normalizeCallLog(details as never);
          if (normalized.id) {
            const nextCall: CallRecord = call.type === 'manual-dial'
              ? {
                  ...normalized,
                  id: normalized.id,
                  name: normalized.name && normalized.name !== 'Unknown lead' && !isPlaceholderPhone(normalized.name)
                    ? normalized.name
                    : call.name,
                  phone: call.phone || normalized.phone,
                  type: 'manual-dial',
                  backendDetails: details,
                }
              : { ...call, ...normalized, backendDetails: details };
            resolvedCall = nextCall;
            setSelectedCall((current) => current?.id === call.id ? nextCall : current);
          }
        } catch {
          // Keep the selected list record if the details payload is not a call-log shape.
        }
      };

      const loadRelatedCallHistory = async () => {
        const selectedPhoneKey = phoneKey(resolvedCall.phone || getDetailsPhone(resolvedDetails));
        const selectedLeadId = getDetailsLeadId(resolvedDetails);
        const response = await getCallLogs({ page: 1, limit: 100 });
        const relatedCalls = response.logs
          .map((item) => normalizeCallLog(item as never))
          .filter((item) => {
            const itemDetails = item.backendDetails && typeof item.backendDetails === 'object' ? item.backendDetails as RawCallDetails : null;
            if (item.id === resolvedCall.id) {
              return true;
            }
            const itemLeadId = getDetailsLeadId(itemDetails);
            if (selectedLeadId && itemLeadId && itemLeadId === selectedLeadId) {
              return true;
            }
            const itemPhoneKey = phoneKey(item.phone || getDetailsPhone(itemDetails));
            return Boolean(selectedPhoneKey && itemPhoneKey && selectedPhoneKey === itemPhoneKey && !isPlaceholderPhone(item.phone));
          })
          .map((item) => item.id === resolvedCall.id ? resolvedCall : item);

        const uniqueCalls = [resolvedCall, ...relatedCalls].filter((item, index, array) => (
          array.findIndex((candidate) => candidate.id === item.id) === index
        ));
        setSelectedContactCalls(uniqueCalls);
      };

      const selectedIsOptimistic = isOptimisticManualCallId(call.id);
      const selectedIsManualDial = call.type === 'manual-dial';

      if (!selectedIsOptimistic) {
        try {
          updateFromPayload(await getCallLog(call.id));
        } catch {
          // The detail endpoint can lag behind the list endpoint; use list matching below.
        }

        if (!selectedIsManualDial || isResolvedBackendCall(resolvedCall)) {
          await loadLeadDetails(resolvedCall.id);
          await loadRelatedCallHistory();
          return;
        }
      }

      const matchedBackendCall = selectedIsManualDial ? await findMatchingBackendCall() : null;
      if (matchedBackendCall) {
        const selectedPhone = getSelectedManualDialPhone(call, resolvedDetails);
        if (selectedPhone) {
          registerManualDialCallOverride(matchedBackendCall.id, selectedPhone);
        }
        clearPendingManualDialCall(call.id);
        resolvedCall = mergeManualDialBackendCall(matchedBackendCall, call, resolvedDetails);
        resolvedDetails = resolvedCall.backendDetails as RawCallDetails;
        setSelectedCall(resolvedCall);
        setSelectedCallDetails(resolvedDetails);
        setCalls([
          resolvedCall,
          ...useCallStore.getState().calls.filter((item) => item.id !== call.id && item.id !== resolvedCall.id),
        ]);
        await loadLeadDetails(resolvedCall.id);
        await loadRelatedCallHistory();
        return;
      }

      const backendCallId = findCallLogIdInPayload(call.backendDetails);
      if (!backendCallId) {
        await loadRelatedCallHistory().catch(() => undefined);
        setDetailsError(null);
        return;
      }

      const backendPayload = await getCallLog(backendCallId);
      const backendDetails = unwrapBackendCallDetails(backendPayload);
      const backendCall = {
        ...normalizeCallLog(backendDetails as never),
        phone: call.phone,
        type: 'manual-dial' as const,
        backendDetails,
      };
      resolvedCall = backendCall;
      resolvedDetails = backendDetails;
      setSelectedCall(backendCall);
      setCalls(useCallStore.getState().calls.map((item) => item.id === call.id ? backendCall : item));
      updateFromPayload(backendDetails);
      await loadLeadDetails(backendCall.id);
      await loadRelatedCallHistory();
    };

    loadBackendDetails()
      .catch((detailError) => {
        setDetailsError(detailError instanceof Error ? detailError.message : 'Could not load full call details.');
      }).finally(() => {
        setIsDetailsLoading(false);
      });
  }, [setCalls]);

  const updateRecordingPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setRecordingPlaying(false);
      if (status.error) {
        console.warn('Unable to play call audio.', status.error);
        setRecordingError('Unable to play audio.');
      }
      return;
    }

    setRecordingError(null);
    setRecordingDurationMs(status.durationMillis ?? 0);
    setRecordingPositionMs(status.positionMillis ?? 0);
    setRecordingPlaying(status.isPlaying);

    if (status.didJustFinish) {
      setRecordingPlaying(false);
      setRecordingPositionMs(0);
      void recordingSoundRef.current?.setPositionAsync(0).catch(() => undefined);
    }
  }, []);

  const resolveCallRecordingUrl = useCallback(async () => {
    const details = selectedCallDetails || getRawObject(selectedCall?.backendDetails);
    const callId = getCallIdForRecording(details, selectedCall);
    const directUrl = getRecordingUrlFromDetails(details);

    if (recordingResolvedUrl) {
      return recordingResolvedUrl;
    }

    if (directUrl) {
      setRecordingResolvedUrl(directUrl);
      return directUrl;
    }

    if (!callId) {
      throw new Error('The call recording is not available for this call yet.');
    }

    const signedPayload = await getRecordingSignedUrl({ callId });
    const signedRecord = getRawObject(signedPayload);
    const dataRecord = getRawObject(signedRecord.data);
    const signedUrl = String(
      signedRecord.signed_url ||
        signedRecord.recording_url ||
        signedRecord.call_recording_url ||
        signedRecord.url ||
        dataRecord.signed_url ||
        dataRecord.recording_url ||
        dataRecord.call_recording_url ||
        dataRecord.url ||
        '',
    );
    const audioUrl = buildAbsoluteApiUrl(signedUrl);
    if (!audioUrl) {
      throw new Error('Recording URL is empty.');
    }
    setRecordingResolvedUrl(audioUrl);
    return audioUrl;
  }, [recordingResolvedUrl, selectedCall, selectedCallDetails]);

  const handleOpenCallRecording = useCallback(async () => {
    if (isRecordingOpening) {
      return;
    }

    setIsRecordingOpening(true);
    setRecordingError(null);
    try {
      const existingSound = recordingSoundRef.current;
      if (existingSound) {
        const status = await existingSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await existingSound.pauseAsync();
            setRecordingPlaying(false);
          } else {
            await existingSound.playAsync();
            setRecordingPlaying(true);
          }
          return;
        }
        await existingSound.unloadAsync().catch(() => undefined);
        recordingSoundRef.current = null;
      }

      const audioUrl = await resolveCallRecordingUrl();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      );

      recordingSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(updateRecordingPlaybackStatus);
      updateRecordingPlaybackStatus(status);
    } catch (recordingError) {
      console.warn('Unable to play call audio.', recordingError);
      setRecordingError('Unable to play audio.');
      setRecordingPlaying(false);
    } finally {
      setIsRecordingOpening(false);
    }
  }, [isRecordingOpening, resolveCallRecordingUrl, updateRecordingPlaybackStatus]);

  const closeCallDetails = useCallback(() => {
    setSelectedCall(null);
    setSelectedCallDetails(null);
    setSelectedLeadDetails(null);
    setSelectedContactCalls([]);
    setDetailsError(null);
    setIsDetailsLoading(false);
    void resetRecordingPlayback();
  }, [resetRecordingPlayback]);

  const renderCall = useCallback(({ item }: { item: CallRecord }) => (
    <CallCard call={item} onPress={() => openCallDetails(item)} />
  ), [openCallDetails]);

  const renderListHeader = useCallback(() => (
    <>
      <View style={[styles.searchBar, { backgroundColor: appTheme.input, borderColor: appTheme.border, borderWidth: 1 }]}>
        <Search color={appTheme.disabled} size={20} />
        <TextInput
          placeholder="Search calls"
          placeholderTextColor={appTheme.disabled}
          style={[styles.searchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterBar}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            style={[styles.tab, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface }, activeTab === 'all' && { backgroundColor: appTheme.darkMode ? appTheme.labelBackgroundActive : appTheme.successSoft }]}
          >
            <Typography variant="bodySmall" style={[styles.tabText, { color: appTheme.muted }, activeTab === 'all' && styles.tabTextActive]}>All</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('missed')}
            style={[styles.tab, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface }, activeTab === 'missed' && { backgroundColor: appTheme.darkMode ? appTheme.labelBackgroundActive : appTheme.successSoft }]}
          >
            <Typography variant="bodySmall" style={[styles.tabText, { color: appTheme.muted }, activeTab === 'missed' && styles.tabTextActive]}>Missed</Typography>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('Contacts')}>
          <Plus color={appTheme.muted} size={18} />
          <Typography variant="caption" style={[styles.actionText, { color: appTheme.muted }]}>Contacts</Typography>
        </TouchableOpacity>
      </View>
    </>
  ), [activeTab, appTheme, search]);

  const selectedCallStatusMeta = getCallStatusDisplayMeta(
    pickBackendValue(selectedCallDetails, 'status', 'call_status') ?? selectedCall?.callStatus,
  );
  const selectedCallFailed = selectedCallStatusMeta.bucket === 'failed';
  const selectedCallStartedAt = pickBackendValue(selectedCallDetails, 'started_at', 'local_started_at', 'created_at');
  const selectedCallEndedAt = pickBackendValue(selectedCallDetails, 'ended_at', 'endedAt', 'completed_at');

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <View style={styles.titleArea}>
          <Typography variant="h1" color={appTheme.text}>Calls</Typography>
          <Typography variant="body" color={appTheme.muted}>You have {displayedCalls.length} tasks to focus on today</Typography>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.refreshCallsBtn,
              { backgroundColor: appTheme.surface, borderColor: appTheme.border },
              (isManualRefreshActive || isRefreshing) && { backgroundColor: appTheme.successSoft, borderColor: appTheme.primaryAccent },
            ]}
            onPress={() => void handleRefreshCalls()}
            disabled={isManualRefreshActive || isRefreshing}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Refresh call status"
          >
            {isManualRefreshActive || isRefreshing ? (
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
            ) : (
              <RefreshCw color={appTheme.text} size={20} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.createGoalBtn} onPress={openGoalModal}>
            <Plus color={Theme.colors.surface} size={18} />
            <Typography variant="bodySmall" style={styles.createGoalText}>Create Goal</Typography>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={displayedCalls}
          keyExtractor={(item) => item.id}
          renderItem={renderCall}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 172 }, showCallConnectionError && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          refreshing={isRefreshing || isManualRefreshActive}
          onRefresh={() => void handleRefreshCalls()}
          onEndReached={() => {
            if (!showCallConnectionError) {
              void fetchNextCalls();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={appTheme.primaryAccent} style={styles.listFooterLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.emptyList, showCallConnectionError && styles.connectionEmptyList]}>
              {isCallListLoading ? (
                <View style={{ width: '100%', gap: 16 }}>
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                </View>
              ) : showCallConnectionError ? (
                <NoConnectionState
                  title="Oops, calls could not load"
                  retryLabel="Retry"
                  onRetry={() => void handleRefreshCalls()}
                  isRetrying={isCallListLoading}
                  minHeight={noConnectionCallsMinHeight}
                />
              ) : (
                <Typography variant="body" color={error ? Theme.colors.error : appTheme.disabled} style={styles.emptyText}>
                  {getFriendlyError(error) || 'No calls found matching your criteria'}
                </Typography>
              )}
            </View>
          }
        />
      </View>

      <Animated.View style={[styles.fabWrap, { bottom: dialFabBottom, right: dialFabRight }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => openDialer()}
          activeOpacity={0.8}
        >
          <Image source={DIAL_PAD_ICON} style={styles.dialFabImage} resizeMode="contain" />
        </TouchableOpacity>
      </Animated.View>

      <Modal transparent visible={isDialerOpen} animationType="slide" onRequestClose={() => setIsDialerOpen(false)}>
        <View style={styles.dialSheetOverlay}>
          <TouchableOpacity style={styles.dialSheetBackdrop} activeOpacity={1} onPress={() => setIsDialerOpen(false)} />
          <View
            style={[
              styles.dialSheet,
              {
                backgroundColor: appTheme.surface,
                borderColor: appTheme.border,
                paddingBottom: Math.max(insets.bottom + 14, 24),
                maxHeight: Math.max(430, Math.min(height - insets.top - 12, isCompactDialer ? 690 : 760)),
              },
            ]}
          >
            <View style={[styles.dialSheetHandle, { backgroundColor: appTheme.border }]} />
            <View style={styles.dialSheetHeader}>
              <View style={styles.dialSheetTitleBlock}>
                <Typography variant="bodyLarge" color={appTheme.text} style={styles.dialSheetTitle}>Agent call</Typography>
                <Typography variant="caption" color={appTheme.muted}>Enter a number and start the saved AI agent call</Typography>
              </View>
              <TouchableOpacity
                style={[styles.closeDialerButton, { backgroundColor: appTheme.softSurface }]}
                onPress={() => setIsDialerOpen(false)}
                activeOpacity={0.7}
              >
                <X color={appTheme.muted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.dialSheetContent, isCompactDialer && styles.dialSheetContentCompact]}
            >
              <View style={styles.dialNumberPickerWrap}>
              <View style={[styles.dialSheetNumberRow, { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft }]}>
                <TouchableOpacity
                  style={[styles.countrySelector, { borderRightColor: appTheme.borderSoft }]}
                  activeOpacity={0.75}
                  onPress={() => setIsDialCountryPickerOpen((value) => !value)}
                >
                  <Image source={{ uri: selectedDialCountry.flagUri }} style={styles.countryFlagImage} resizeMode="cover" />
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.countryDialCode}>
                    {selectedDialCountry.dialCode}
                  </Typography>
                  <ChevronDown color={appTheme.muted} size={15} />
                </TouchableOpacity>
                <TextInput
                  value={dialNumber}
                  onChangeText={handleDialNumberChange}
                  placeholder="Enter phone number"
                  placeholderTextColor={appTheme.disabled}
                  keyboardType="phone-pad"
                  showSoftInputOnFocus={Platform.OS === 'web'}
                  onFocus={() => {
                    if (Platform.OS !== 'web') {
                      Keyboard.dismiss();
                    }
                  }}
                  maxLength={MAX_DIAL_PHONE_DIGITS}
                  style={[
                    styles.dialSheetNumberInput,
                    isCompactDialer && styles.dialSheetNumberInputCompact,
                    { color: appTheme.text },
                    WEB_INPUT_RESET,
                  ]}
                />
              </View>
              {isDialCountryPickerOpen ? (
                <View style={[styles.countryPickerMenu, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
                  {DIAL_COUNTRY_OPTIONS.map((country) => {
                    const active = country.iso === selectedDialCountry.iso && country.dialCode === selectedDialCountry.dialCode;
                    return (
                      <TouchableOpacity
                        key={`${country.iso}-${country.dialCode}`}
                        style={[
                          styles.countryPickerItem,
                          { borderBottomColor: appTheme.borderSoft },
                          active && { backgroundColor: appTheme.infoSoft },
                        ]}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedDialCountry(country);
                          setIsDialCountryPickerOpen(false);
                        }}
                      >
                        <Image source={{ uri: country.flagUri }} style={styles.countryFlagImage} resizeMode="cover" />
                        <Typography variant="bodySmall" color={active ? appTheme.primaryAccent : appTheme.text} style={styles.countryName}>
                          {country.label}
                        </Typography>
                        <Typography variant="bodySmall" color={active ? appTheme.primaryAccent : appTheme.muted} style={styles.countryCodeInMenu}>
                          {country.dialCode}
                        </Typography>
                        {active ? (
                          <Typography variant="bodySmall" color={appTheme.primaryAccent} style={styles.countryActiveMark}>✓</Typography>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              </View>

              <TextInput
                value={dialContactName}
                onChangeText={(value) => {
                  setDialContactName(value);
                  setDialContactNameEdited(true);
                  if (value.trim()) setShowContactNameRequired(false);
                }}
                placeholder="Contact Name"
                placeholderTextColor={showContactNameRequired ? Theme.colors.error : appTheme.disabled}
                autoCapitalize="words"
                style={[
                  styles.dialSheetContactInput,
                  {
                    backgroundColor: showContactNameRequired ? 'rgba(239, 68, 68, 0.06)' : appTheme.input,
                    borderColor: showContactNameRequired ? Theme.colors.error : appTheme.borderSoft,
                    color: appTheme.text,
                  },
                  WEB_INPUT_RESET,
                ]}
              />
              {showContactNameRequired ? (
                <Typography variant="caption" color={Theme.colors.error} style={styles.dialSheetRequiredText}>
                  Contact name is required.
                </Typography>
              ) : isDialContactLookupLoading ? (
                <Typography variant="caption" color={appTheme.muted} style={styles.dialSheetRequiredText}>
                  Checking existing contacts...
                </Typography>
              ) : dialContactSuggestion ? (
                <Typography variant="caption" color={appTheme.primaryAccent} style={styles.dialSheetRequiredText}>
                  Existing contact found. Editing this name updates the saved contact.
                </Typography>
              ) : null}

              <View style={[styles.phoneKeypadGrid, isCompactDialer && styles.phoneKeypadGridCompact]}>
                {DIAL_KEY_META.map((key) => {
                  const isBackspaceKey = key.digit === 'backspace';

                  return (
                    <TouchableOpacity
                      key={key.digit}
                      style={[styles.phoneKey, isCompactDialer && styles.phoneKeyCompact]}
                      onPress={isBackspaceKey ? deleteDialDigit : () => appendDialDigit(key.digit)}
                      onLongPress={
                        isBackspaceKey
                          ? () => setDialNumber('')
                          : key.digit === '0'
                            ? () => setDialNumber((current) => sanitizeDialNumberInput(`${current}0`).replace(/\D/g, ''))
                            : undefined
                      }
                      activeOpacity={0.68}
                    >
                      {isBackspaceKey ? (
                        <>
                          <Delete color={appTheme.text} size={isCompactDialer ? 27 : 31} strokeWidth={2.15} />
                          <Typography
                            variant="caption"
                            color={appTheme.disabled}
                            style={[styles.phoneKeyLetters, isCompactDialer && styles.phoneKeyLettersCompact]}
                          >
                            {' '}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography
                            variant="h1"
                            color={appTheme.text}
                            style={[styles.phoneKeyDigit, isCompactDialer && styles.phoneKeyDigitCompact]}
                          >
                            {key.digit}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={appTheme.disabled}
                            style={[styles.phoneKeyLetters, isCompactDialer && styles.phoneKeyLettersCompact]}
                          >
                            {key.letters || ' '}
                          </Typography>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.dialSheetAgentCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
                {isVoiceConfigLoading && !hasSavedVoiceSetup ? (
                  <View style={styles.voiceConfigInline}>
                    <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                    <Typography variant="caption" color={appTheme.muted}>Loading saved agent...</Typography>
                  </View>
                ) : (
                  <View style={styles.voiceConfigInline}>
                    <LadLogoMark size={18} color={appTheme.primaryAccent} />
                    <View style={styles.dialSheetAgentText}>
                      <Typography variant="overline" color={appTheme.muted}>AI Agent</Typography>
                      <Typography variant="bodySmall" style={[styles.voiceConfigValue, { color: appTheme.text }]} numberOfLines={1}>
                        {savedVoiceConfig?.agentName || selectedVoiceAgent?.name || 'No agent saved'}
                      </Typography>
                    </View>
                    <View style={styles.dialSheetFromText}>
                      <Typography variant="overline" color={appTheme.muted}>From</Typography>
                      <Typography variant="bodySmall" style={[styles.voiceConfigValue, { color: appTheme.text }]} numberOfLines={1}>
                        {savedVoiceConfig?.fromNumber || selectedVoiceNumber?.phone_number || 'No number'}
                      </Typography>
                    </View>
                  </View>
                )}
                {voiceConfigError ? (
                  <Typography variant="caption" color={Theme.colors.error} numberOfLines={2} style={styles.dialSheetConfigMessage}>{voiceConfigError}</Typography>
                ) : !isVoiceConfigLoading && !savedVoiceConfig ? (
                  <Typography variant="caption" color="#D97706" numberOfLines={2} style={styles.dialSheetConfigMessage}>
                    Save an AI Voice Calling setup in Profile before starting an agent call.
                  </Typography>
                ) : null}
              </View>

              <View style={styles.dialSheetActions}>
                <TouchableOpacity
                  style={[styles.dialSheetCallButton, isDialCallDisabled && styles.callNowButtonDisabled]}
                  onPress={handleManualCall}
                  activeOpacity={0.8}
                  disabled={isDialCallDisabled}
                >
                  {isCalling ? (
                    <ActivityIndicator color={Theme.colors.surface} size="small" />
                  ) : (
                    <Phone color={Theme.colors.surface} size={34} fill={Theme.colors.surface} />
                  )}
                </TouchableOpacity>
              </View>

              {callFeedback ? (
                <View
                  style={[
                    styles.callFeedback,
                    {
                      backgroundColor: callFeedback.type === 'error'
                        ? 'rgba(239, 68, 68, 0.10)'
                        : callFeedback.type === 'success'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : appTheme.softSurface,
                      borderColor: callFeedback.type === 'error'
                        ? 'rgba(239, 68, 68, 0.28)'
                        : callFeedback.type === 'success'
                          ? 'rgba(16, 185, 129, 0.28)'
                          : appTheme.borderSoft,
                    },
                  ]}
                >
                  <Typography
                    variant="caption"
                    color={callFeedback.type === 'error' ? Theme.colors.error : callFeedback.type === 'success' ? '#047857' : appTheme.muted}
                    numberOfLines={4}
                  >
                    {callFeedback.text}
                  </Typography>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(callFailureDialog)} animationType="fade" onRequestClose={() => setCallFailureDialog(null)}>
        <View style={styles.callFailureBackdrop}>
          <View style={[styles.callFailureCard, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
            <View style={styles.callFailureTopRow}>
              <View style={styles.callFailureIconShell}>
                <AlertTriangle color="#DC2626" size={22} strokeWidth={2.4} />
              </View>
              <TouchableOpacity
                style={[styles.callFailureClose, { backgroundColor: appTheme.softSurface }]}
                onPress={() => setCallFailureDialog(null)}
                activeOpacity={0.75}
              >
                <X color={appTheme.muted} size={18} />
              </TouchableOpacity>
            </View>
            <Typography variant="h3" color={appTheme.text} style={styles.callFailureTitle}>
              Agent call failed
            </Typography>
            <Typography variant="bodySmall" color={appTheme.muted} style={styles.callFailureMessage}>
              {callFailureDialog?.message}
            </Typography>
            <View style={[styles.callFailureHint, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
              <Typography variant="caption" color={appTheme.muted} style={styles.callFailureHintText}>
                You can adjust the calling number setup or place this call through the phone app.
              </Typography>
            </View>
            <View style={styles.callFailureActions}>
              <TouchableOpacity
                style={[styles.callFailureSecondaryButton, { borderColor: appTheme.borderSoft }]}
                onPress={() => setCallFailureDialog(null)}
                activeOpacity={0.8}
              >
                <Typography variant="bodySmall" color={appTheme.text} style={styles.callFailureSecondaryText}>
                  Cancel
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.callFailurePrimaryButton}
                onPress={() => {
                  const fallbackNumber = callFailureDialog?.phoneNumber;
                  setCallFailureDialog(null);
                  if (fallbackNumber) {
                    void handlePhoneFallback(fallbackNumber);
                  }
                }}
                activeOpacity={0.86}
              >
                <Phone color="#FFFFFF" size={16} fill="#FFFFFF" />
                <Typography variant="bodySmall" color="#FFFFFF" style={styles.callFailurePrimaryText}>
                  Phone app
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(selectedCall)} animationType="slide" onRequestClose={closeCallDetails}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailsModalCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTitleBlock}>
                <Typography variant="h3" color={appTheme.text} style={styles.detailsTitle} numberOfLines={1}>
                  Call details
                </Typography>
              </View>
              <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: appTheme.softSurface }]} onPress={closeCallDetails} activeOpacity={0.7}>
                <X color={appTheme.muted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
              {selectedCall ? (
                <>
                  <DetailSection title="Call Recording" appTheme={appTheme}>
                    {isDetailsLoading ? (
                      <View style={styles.detailsLoading}>
                        <ActivityIndicator color={appTheme.primaryAccent} />
                        <Typography variant="bodySmall" color={appTheme.muted}>Loading call recording...</Typography>
                      </View>
                    ) : detailsError ? (
                      <View style={[styles.recordingWarning, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#FFF1F2', borderColor: appTheme.darkMode ? '#7F3550' : '#FECDD3' }]} accessibilityRole="alert">
                        <AlertTriangle color={appTheme.darkMode ? '#FB8DA1' : Theme.colors.error} size={17} />
                        <Typography variant="bodySmall" color={appTheme.darkMode ? '#FB8DA1' : Theme.colors.error} style={styles.recordingErrorText}>Unable to load call recording.</Typography>
                      </View>
                    ) : selectedCallDetails ? (
                      (() => {
                        const audioUrl = getRecordingUrlFromDetails(selectedCallDetails);
                        const callId = getCallIdForRecording(selectedCallDetails, selectedCall);
                        if (!audioUrl && !callId) {
                          return <Typography variant="bodySmall" color={appTheme.muted}>No call recording available.</Typography>;
                        }
                        const progressPercent = recordingDurationMs > 0
                          ? Math.min(100, Math.max(0, (recordingPositionMs / recordingDurationMs) * 100))
                          : 0;
                        return (
                          <View style={styles.recordingRow}>
                            <Typography variant="caption" color={appTheme.muted} style={styles.recordingLabel}>Recording</Typography>
                            <View style={[styles.recordingPlayer, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
                              <TouchableOpacity
                                style={[styles.recordingPlayButton, { backgroundColor: appTheme.infoSoft }, isRecordingOpening && styles.recordingButtonDisabled]}
                                onPress={handleOpenCallRecording}
                                activeOpacity={0.75}
                                disabled={isRecordingOpening}
                              >
                                {isRecordingOpening ? (
                                  <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                                ) : recordingPlaying ? (
                                  <Pause color={appTheme.primaryAccent} size={18} fill={appTheme.primaryAccent} />
                                ) : (
                                  <Play color={appTheme.primaryAccent} size={18} fill={appTheme.primaryAccent} />
                                )}
                              </TouchableOpacity>
                              <View style={styles.recordingPlayerBody}>
                                <View style={styles.recordingPlayerTop}>
                                  <Typography variant="bodySmall" color={appTheme.text} style={styles.recordingButtonText}>Call recording</Typography>
                                  <Typography variant="caption" color={appTheme.muted}>MP3</Typography>
                                </View>
                                <View style={[styles.recordingProgressTrack, { backgroundColor: appTheme.borderSoft }]}>
                                  <View style={[styles.recordingProgressFill, { backgroundColor: appTheme.primaryAccent, width: `${progressPercent}%` }]} />
                                </View>
                                <View style={styles.recordingTimeRow}>
                                  <Typography variant="caption" color={appTheme.muted}>{formatRecordingTime(recordingPositionMs)}</Typography>
                                  <Typography variant="caption" color={appTheme.muted}>{recordingDurationMs ? formatRecordingTime(recordingDurationMs) : '--:--'}</Typography>
                                </View>
                              </View>
                            </View>
                            {recordingError ? (
                              <View style={[styles.recordingWarning, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#FFF1F2', borderColor: appTheme.darkMode ? '#7F3550' : '#FECDD3' }]} accessibilityRole="alert">
                                <AlertTriangle color={appTheme.darkMode ? '#FB8DA1' : Theme.colors.error} size={17} />
                                <Typography variant="bodySmall" color={appTheme.darkMode ? '#FB8DA1' : Theme.colors.error} style={styles.recordingErrorText}>{recordingError}</Typography>
                              </View>
                            ) : null}
                          </View>
                        );
                      })()
                    ) : (
                      <Typography variant="bodySmall" color={appTheme.muted}>No call recording returned yet.</Typography>
                    )}
                  </DetailSection>

                  <DetailSection title="User Details" appTheme={appTheme}>
                    <DetailRow label="Name" value={normalizeContactDisplayName(getLeadDisplayName(selectedLeadDetails) || selectedCall.name)} appTheme={appTheme} />
                    <DetailRow label="Number called" value={selectedCall.phone || getDetailsPhone(selectedLeadDetails) || '-'} appTheme={appTheme} />
                    {selectedLeadDetails ? (
                      <>
                        <DetailRow label="Email" value={formatDetailValue(pickBackendValue(selectedLeadDetails, 'email'))} appTheme={appTheme} />
                        <DetailRow label="Company" value={formatDetailValue(pickBackendValue(selectedLeadDetails, 'company_name', 'company'))} appTheme={appTheme} />
                        <DetailRow label="Title" value={formatDetailValue(pickBackendValue(selectedLeadDetails, 'title'))} appTheme={appTheme} />
                        <DetailRow label="Stage" value={formatDetailValue(pickBackendValue(selectedLeadDetails, 'stage', 'status'))} appTheme={appTheme} />
                      </>
                    ) : null}
                    <DetailRow label="Temperature" value={selectedCall.leadTemperature} appTheme={appTheme} />
                    <DetailRow label="Engagement score" value={String(selectedCall.engagement_score)} appTheme={appTheme} />
                  </DetailSection>

                  <DetailSection title="Agent Details" appTheme={appTheme}>
                    <DetailRow label="Call type" value={formatCallTypeLabel(selectedCall.type)} appTheme={appTheme} />
                    <DetailRow label="Status" value={formatCallStatusLabel(selectedCall.callStatus)} appTheme={appTheme} />
                    {selectedCallFailed ? (
                      <>
                        <DetailRow label="Result" value="Call failed" appTheme={appTheme} />
                        <DetailRow label="Message type" value="failed" appTheme={appTheme} />
                        <DetailRow label="Failure reason" value={getCallFailureDetail(selectedCallDetails, selectedCall)} appTheme={appTheme} />
                      </>
                    ) : null}
                    <DetailRow label="Duration" value={`${selectedCall.duration}s`} appTheme={appTheme} />
                    {selectedCallStartedAt ? (
                      <DetailRow label="Started at" value={formatBackendDate(selectedCallStartedAt)} appTheme={appTheme} />
                    ) : (
                      <DetailRow label="Time" value={selectedCall.time} appTheme={appTheme} />
                    )}
                    {selectedCallEndedAt ? <DetailRow label="Ended at" value={formatBackendDate(selectedCallEndedAt)} appTheme={appTheme} /> : null}
                    <DetailRow label="From number" value={getDisplayFromNumber(selectedCall, selectedCallDetails, voiceNumbers)} appTheme={appTheme} />
                    <DetailRow label="Agent" value={selectedCall.agent?.name || '-'} appTheme={appTheme} />
                  </DetailSection>

                  <DetailSection title="AI Summary" appTheme={appTheme}>
                    <DetailRow label="Intent" value={selectedCall.aiSummary.customerIntent} appTheme={appTheme} />
                    <DetailRow label="Outcome" value={selectedCall.aiSummary.callOutcome} appTheme={appTheme} />
                    <DetailRow label="Discussion" value={selectedCall.aiSummary.discussionPoints.join('\n')} appTheme={appTheme} />
                    <DetailRow label="Follow-up" value={selectedCall.aiSummary.followUpSuggestion} appTheme={appTheme} />
                    <DetailRow label="Transcript" value={selectedCall.transcript || 'Transcript is not available yet.'} appTheme={appTheme} />
                  </DetailSection>

                  <DetailSection title="Past History" appTheme={appTheme}>
                    {selectedContactCalls.length ? (
                      selectedContactCalls.map((historyCall) => (
                        <View key={historyCall.id} style={[styles.historyCallRow, { borderColor: appTheme.borderSoft }]}>
                          <View style={styles.historyCallTop}>
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.historyCallTitle} numberOfLines={1}>
                              {historyCall.phone || historyCall.name || 'No number'}
                            </Typography>
                            <Typography variant="caption" color={appTheme.disabled}>
                              {historyCall.time}
                            </Typography>
                          </View>
                          <Typography variant="caption" color={appTheme.muted}>
                            {formatCallTypeLabel(historyCall.type)} - {formatCallStatusLabel(historyCall.callStatus)} - {historyCall.duration}s
                          </Typography>
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
                            {historyCall.aiSummary.callOutcome || historyCall.transcript || 'Record pending'}
                          </Typography>
                        </View>
                      ))
                    ) : (
                      <Typography variant="bodySmall" color={appTheme.muted}>
                        Call history will appear here when the agent interaction is stored.
                      </Typography>
                    )}
                  </DetailSection>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={goalModalOpen} animationType="fade" onRequestClose={() => setGoalModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.goalModalCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <View style={styles.goalModalHeader}>
              <View style={styles.goalTitleBlock}>
                <Typography variant="h3" style={styles.goalModalTitle}>Create Call Goal</Typography>
                <Typography variant="caption" color={appTheme.muted}>
                  Set the outcome this calling session should optimize for.
                </Typography>
              </View>
              <TouchableOpacity style={[styles.goalModalCloseButton, { backgroundColor: appTheme.softSurface }]} onPress={() => setGoalModalOpen(false)} activeOpacity={0.7}>
                <X color={appTheme.muted} size={20} />
              </TouchableOpacity>
            </View>

            <Typography variant="caption" style={[styles.inputLabel, { color: appTheme.muted }]}>Goal name</Typography>
            <TextInput
              value={goalTitle}
              onChangeText={setGoalTitle}
              placeholder="e.g. Book discovery calls"
              placeholderTextColor={appTheme.disabled}
              style={[styles.goalInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
            />

            <Typography variant="caption" style={[styles.inputLabel, { color: appTheme.muted }]}>Goal type</Typography>
            <View style={styles.goalOptionsGrid}>
              {GOAL_OPTIONS.map((option) => {
                const selected = goalType === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.goalOption,
                      { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft },
                      selected && { backgroundColor: appTheme.infoSoft, borderColor: appTheme.primaryAccent },
                    ]}
                    onPress={() => setGoalType(option.id)}
                    activeOpacity={0.78}
                  >
                    <Typography variant="bodySmall" style={[styles.goalOptionTitle, { color: selected ? appTheme.primaryAccent : appTheme.text }]}>
                      {option.label}
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
                      {option.description}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Typography variant="caption" style={[styles.inputLabel, { color: appTheme.muted }]}>Target calls</Typography>
            <TextInput
              value={goalTargetCalls}
              onChangeText={setGoalTargetCalls}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor={appTheme.disabled}
              style={[styles.goalInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
            />

            <Typography variant="caption" style={[styles.inputLabel, { color: appTheme.muted }]}>Notes</Typography>
            <TextInput
              value={goalNotes}
              onChangeText={setGoalNotes}
              placeholder="Add call script, audience, or follow-up details"
              placeholderTextColor={appTheme.disabled}
              multiline
              style={[styles.goalInput, styles.goalNotesInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
            />

            <TouchableOpacity style={styles.saveGoalButton} onPress={handleCreateGoal} activeOpacity={0.82}>
              <Goal color={Theme.colors.surface} size={18} />
              <Typography variant="bodySmall" style={styles.saveGoalText}>Save Goal</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  titleArea: {
    flex: 1,
    minWidth: 180,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshCallsBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  createGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  createGoalText: {
    color: Theme.colors.surface,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  goalCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.small,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8ECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderText: {
    flex: 1,
  },
  goalCardTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  goalMiniButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
  },
  activeGoalBox: {
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
  },
  activeGoalTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  activeGoalTitleWrap: {
    flex: 1,
  },
  activeGoalTitle: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  activeGoalNotes: {
    marginTop: Theme.spacing.sm,
  },
  goalRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGoalButton: {
    marginTop: Theme.spacing.md,
    minHeight: 44,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  emptyGoalText: {
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  dialerPanel: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.small,
  },
  dialerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  dialerTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  closeDialerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  numberInput: {
    flex: 1,
    minHeight: 56,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    color: Theme.colors.text,
    fontSize: 22,
    fontWeight: '500',
  },
  deleteButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'center',
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 1.35,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
  },
  keypadText: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  voiceConfigBox: {
    marginTop: Theme.spacing.lg,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.md,
  },
  voiceConfigInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  voiceConfigLabel: {
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  voiceConfigValue: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  voiceConfigMeta: {
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  // ── Enhanced dial-pad styles ──
  dialerFieldLabel: {
    fontWeight: '600',
    marginBottom: Theme.spacing.xs,
  },
  dialerConfigCard: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  dialerSelectorRow: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialerPickerMenu: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
    ...Theme.shadows.small,
  },
  dialerPickerItem: {
    paddingVertical: 10,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  dialerInstructionsInput: {
    minHeight: 88,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  callNowButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
  },
  callNowButtonDisabled: {
    opacity: 0.55,
  },
  callNowText: {
    color: Theme.colors.surface,
    fontWeight: '600',
  },
  callFeedback: {
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: Theme.spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 24,
    height: 48,
    marginBottom: Theme.spacing.lg,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Theme.colors.text,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#DCFCE7',
  },
  tabText: {
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#15803D',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    alignItems: 'center',
    marginTop: 50,
  },
  connectionEmptyList: {
    marginTop: 0,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },
  listFooterLoader: {
    marginVertical: Theme.spacing.lg,
  },
  fabWrap: {
    position: 'absolute',
    zIndex: 42,
    elevation: 12,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  dialFabImage: {
    width: 29,
    height: 29,
    tintColor: Theme.colors.surface,
  },
  dialSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dialSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.48)',
  },
  dialSheet: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 22,
    ...Theme.shadows.large,
  },
  dialSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: Theme.spacing.md,
  },
  dialSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  dialSheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  dialSheetTitle: {
    fontWeight: '600',
  },
  dialSheetContent: {
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    gap: Theme.spacing.md,
  },
  dialSheetContentCompact: {
    gap: Theme.spacing.sm,
  },
  dialSheetNumberRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dialNumberPickerWrap: {
    position: 'relative',
    zIndex: 30,
    elevation: 30,
  },
  countrySelector: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    flexShrink: 0,
  },
  countryFlagImage: {
    width: 24,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  countryDialCode: {
    fontWeight: '600',
  },
  countryPickerMenu: {
    position: 'absolute',
    left: 0,
    top: 58,
    width: 320,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 50,
    ...Theme.shadows.small,
  },
  countryPickerItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  countryName: {
    flex: 1,
    fontWeight: '600',
  },
  countryCodeInMenu: {
    minWidth: 44,
    textAlign: 'right',
    fontWeight: '600',
  },
  countryActiveMark: {
    fontWeight: '800',
  },
  dialSheetNumberInput: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    textAlign: 'left',
  },
  dialSheetNumberInputCompact: {
    minHeight: 44,
    fontSize: 20,
    lineHeight: 24,
  },
  dialSheetContactInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    lineHeight: 20,
  },
  dialSheetRequiredText: {
    marginTop: -8,
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  dialSheetDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneKeypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    paddingHorizontal: 8,
  },
  phoneKeypadGridCompact: {
    rowGap: 6,
    paddingHorizontal: 2,
  },
  phoneKey: {
    width: '31%',
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  phoneKeyCompact: {
    minHeight: 50,
    borderRadius: 18,
  },
  phoneKeyDigit: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
  },
  phoneKeyDigitCompact: {
    fontSize: 30,
    lineHeight: 34,
  },
  phoneKeyLetters: {
    minHeight: 16,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  phoneKeyLettersCompact: {
    fontSize: 11,
    lineHeight: 13,
  },
  dialSheetAgentCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: Theme.spacing.md,
  },
  dialSheetAgentText: {
    flex: 1,
    minWidth: 0,
  },
  dialSheetFromText: {
    maxWidth: 132,
    alignItems: 'flex-end',
  },
  dialSheetConfigMessage: {
    marginTop: 6,
  },
  dialSheetActions: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialSheetCallButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#14C85A',
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    paddingHorizontal: Theme.spacing.lg,
    justifyContent: 'center',
  },
  callFailureBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  callFailureCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    ...Theme.shadows.large,
  },
  callFailureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  callFailureIconShell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callFailureClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callFailureTitle: {
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 28,
  },
  callFailureMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  callFailureHint: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  callFailureHintText: {
    lineHeight: 18,
    fontWeight: '500',
  },
  callFailureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  callFailureSecondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callFailurePrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callFailureSecondaryText: {
    fontWeight: '800',
  },
  callFailurePrimaryText: {
    fontWeight: '800',
  },
  goalModalCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 18,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    ...Theme.shadows.large,
  },
  goalModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  goalTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: Theme.spacing.sm,
  },
  goalModalTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  goalModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalCloseButton: {
    position: 'absolute',
    top: Theme.spacing.lg,
    right: Theme.spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    zIndex: 10,
  },
  detailsModalCard: {
    maxHeight: '88%',
    borderRadius: 18,
    padding: 0,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    overflow: 'hidden',
    ...Theme.shadows.large,
  },
  detailsHeader: {
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  detailsTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailsTitle: {
    fontWeight: '600',
  },
  detailsContent: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  detailSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  detailSectionTitle: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailRow: {
    borderTopWidth: 1,
    paddingTop: Theme.spacing.sm,
    gap: 3,
  },
  detailLabel: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailValue: {
    lineHeight: 20,
  },
  historyCallRow: {
    borderTopWidth: 1,
    paddingTop: Theme.spacing.sm,
    gap: 4,
  },
  historyCallTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  historyCallTitle: {
    flex: 1,
    fontWeight: '600',
  },
  transcriptText: {
    lineHeight: 20,
  },
  failedCallText: {
    fontWeight: '700',
  },
  recordingRow: {
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  recordingLabel: {
    fontWeight: '600',
    opacity: 0.7,
  },
  recordingPlayer: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  recordingPlayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recordingButtonDisabled: {
    opacity: 0.62,
  },
  recordingPlayerBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  recordingPlayerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  recordingButtonText: {
    fontWeight: '700',
  },
  recordingProgressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  recordingProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  recordingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  recordingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  recordingErrorText: {
    flex: 1,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailsLoading: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: Theme.spacing.xs,
  },
  goalInput: {
    minHeight: 46,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    color: Theme.colors.text,
    fontSize: 14,
    marginBottom: Theme.spacing.md,
  },
  goalNotesInput: {
    minHeight: 76,
    paddingTop: Theme.spacing.sm,
    textAlignVertical: 'top',
  },
  goalOptionsGrid: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  goalOption: {
    borderRadius: Theme.radius.md,
    borderWidth: 1.5,
    borderColor: Theme.colors.borderLight,
    backgroundColor: '#FFFFFF',
    padding: Theme.spacing.md,
  },
  goalOptionActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#E8ECFA',
  },
  goalOptionTitle: {
    color: Theme.colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  goalOptionTitleActive: {
    color: Theme.colors.primary,
  },
  saveGoalButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  saveGoalText: {
    color: Theme.colors.surface,
    fontWeight: '600',
  },
});




