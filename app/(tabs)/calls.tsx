import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, ChevronDown, Delete, Goal, Phone, Plus, Search, X } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { CallCard } from '@/components/features/CallCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { safeStorage } from '@/src/api';
import { getCallLead, getCallLog, getCallLogs, searchCallLogsForPhone } from '@/src/services/call-logs';
import { DEFAULT_OUTBOUND_STARTER_PROMPT, fetchVoiceCallOptions, loadVoiceCallConfig, phoneNumbersMatch, SavedVoiceCallConfig, syncVoiceAgentCallPrompt } from '@/src/services/voiceCallConfig';
import { makeCall } from '@/src/services/voice-agent';
import {
  clearPendingManualDialCall,
  normalizeCallLog,
  registerManualDialCallOverride,
  registerPendingManualDialCall,
  replacePendingManualDialCall,
  useCallStore,
} from '@/src/store/callStore';
import { useOverlayStore } from '@/src/store/overlayStore';
import { CallRecord } from '@/types/calls';
import { useAppTheme } from '@/src/theme/appTheme';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const CALL_GOALS_STORAGE_KEY = 'lad.callGoals.v1';
const DEFAULT_DIAL_CODE = '+91';
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

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

  const metadata = details.metadata && typeof details.metadata === 'object' ? details.metadata as RawCallDetails : {};
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
  const cleaned = normalizeE164Like(phone).replace(/[^0-9+]/g, '');
  if (!cleaned) {
    return '';
  }
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith(DEFAULT_DIAL_CODE.replace('+', ''))) {
    return `+${cleaned}`;
  }
  return `${DEFAULT_DIAL_CODE}${cleaned.replace(/^0+/, '')}`;
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

const buildAgentCallContext = (savedContext: string | undefined, phoneNumber: string) => {
  const trimmedContext = savedContext?.trim();
  const usefulContext = trimmedContext && !GENERIC_AGENT_CONTEXTS.has(trimmedContext.toLowerCase())
    ? trimmedContext
    : DEFAULT_AGENT_CALL_CONTEXT;

  return [
    `MANDATORY FIRST SPOKEN LINE: As soon as the call connects, immediately say: "${DEFAULT_OUTBOUND_STARTER_PROMPT}" Do not wait silently for the receiver to speak first.`,
    'After the first line, follow these call instructions:',
    usefulContext,
    'Dialed number: ' + phoneNumber + '.',
    'If the receiver is silent, ask once: "Can you hear me clearly?" Then continue politely.',
  ].join('\n\n');
};

const createOptimisticCallRecord = ({
  phoneNumber,
  agentName,
  fromNumber,
  instructions,
}: {
  phoneNumber: string;
  agentName: string;
  fromNumber: string;
  instructions: string;
}): CallRecord => {
  const id = 'manual-agent-call-' + Date.now();
  return {
    id,
    name: phoneNumber,
    phone: phoneNumber,
    type: 'manual-dial',
    time: 'Just now',
    avatar: '',
    statusColor: '#F59E0B',
    duration: 0,
    transcript: 'Voice agent call started. The full transcript will appear after the backend finishes processing.',
    engagement_score: 0,
    leadTemperature: 'warm',
    aiSummary: {
      customerIntent: 'Manual dial call started with the saved voice agent.',
      callOutcome: 'Call queued',
      discussionPoints: ['Voice agent call started from the dial pad.'],
      followUpSuggestion: 'Wait for the backend call log to update.',
    },
    callStatus: 'queued',
    agent: {
      id: 'saved-agent',
      name: agentName,
      language: 'English',
      accent: 'Default',
      gender: 'AI',
    },
    fromNumber: {
      id: fromNumber,
      label: fromNumber,
      phoneNumber: fromNumber,
    },
    instructions,
    backendDetails: {
      client_call_id: id,
      to_number: phoneNumber,
      local_dialed_number: phoneNumber,
      lad_app_dialed_number: phoneNumber,
      call_type: 'manual_dial',
      source: 'lad_mobile_app',
      local_started_at: new Date().toISOString(),
      metadata: {
        client_call_id: id,
        local_dialed_number: phoneNumber,
        lad_app_dialed_number: phoneNumber,
        to_number: phoneNumber,
        call_type: 'manual_dial',
        source: 'lad_mobile_app',
      },
    },
  };
};

const scheduleCallHistoryRefresh = (fetchCalls: () => Promise<void>) => {
  // Do NOT fire immediately — the optimistic pending record is already in the list.
  // First real refresh at 12 s gives the backend time to create the call log,
  // subsequent refreshes keep the status up-to-date without wiping the pending entry.
  [12000, 30000, 60000, 120000, 180000, 300000, 600000, 900000].forEach((delay) => {
    setTimeout(() => {
      void fetchCalls();
    }, delay);
  });
};

const getCallErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to initiate the voice-agent call.';

  if (/PRODUCTION database config missing|DB_HOST|DB_DATABASE|DB_USER|DB_PASSWORD/i.test(message)) {
    return 'Voice agent calls are currently blocked by backend deployment configuration. The voice/backend service is missing required production DB_* environment variables; set them on the backend service, then retry the call.';
  }

  if (/402|payment|required|billing|credit|plan/i.test(message)) {
    return `${message} Check Billing & Plans, then retry with a verified backend calling number.`;
  }

  return message;
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
    return 'manual dial';
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
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'unknown lead' || normalized === 'manual dial' || isPlaceholderPhone(normalized);
};

const isManualDialBackendCandidate = (call: CallRecord, details?: RawCallDetails | null) => {
  if (call.type === 'manual-dial') {
    return true;
  }
  if (isPlaceholderPhone(call.phone || call.name)) {
    return true;
  }

  const metadata = details?.metadata && typeof details.metadata === 'object' ? details.metadata as RawCallDetails : {};
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
  const metadata = backendDetails.metadata && typeof backendDetails.metadata === 'object'
    ? backendDetails.metadata as RawCallDetails
    : {};

  return {
    ...backendCall,
    name: isGenericCallName(backendCall.name) && phone ? phone : backendCall.name,
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
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const handleBottomTabScroll = useBottomTabScrollHandler(setIsBottomNavHidden);
  const dialFabProgress = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
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
  const [callFeedback, setCallFeedback] = useState<CallFeedback | null>(null);
  const [voiceConfigError, setVoiceConfigError] = useState<string | null>(null);
  // No per-call instruction override — always use saved AI Voice Calling config
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [isNumberPickerOpen, setIsNumberPickerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [selectedCallDetails, setSelectedCallDetails] = useState<RawCallDetails | null>(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<RawLeadDetails | null>(null);
  const [selectedContactCalls, setSelectedContactCalls] = useState<CallRecord[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const setCallDialerOpen = useOverlayStore((state) => state.setCallDialerOpen);
  const listRef = useRef<FlatList<CallRecord>>(null);
  const {
    calls,
    isLoading,
    isLoadingMore,
    error,
    initializeRealtime,
    fetchCalls,
    fetchNextCalls,
    prependCall,
    setCalls,
  } = useCallStore();

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

      try {
        const savedConfig = await loadVoiceCallConfig();
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

        const savedNumber = savedConfig ? findVoiceNumber(numbers, savedConfig.fromNumber) : undefined;
        const savedConfigIsValid = Boolean(
          savedConfig
            && agents.some((agent) => agent.id === savedConfig.agentId)
            && savedNumber,
        );
        const savedAgentId = savedNumber?.assignedAgentId || savedConfig?.agentId;
        const fallbackAgentId = numbers.find((number) => number.assignedAgentId)?.assignedAgentId ?? agents[0]?.id;

        setVoiceAgents(agents);
        setVoiceNumbers(numbers);
        setSavedVoiceConfig(savedConfigIsValid ? savedConfig : null);
        setSelectedAgentId((current) => savedConfigIsValid ? savedAgentId : current ?? fallbackAgentId);
        setSelectedFromNumber((current) => savedConfigIsValid ? savedNumber?.phone_number : current ?? numbers[0]?.phone_number);
        // Dial instructions always come from saved config — no state needed here

        if (savedConfigIsValid && savedConfig && savedAgentId) {
          const syncAgent = agents.find((agent) => agent.id === savedAgentId);
          if (syncAgent) {
            void syncVoiceAgentCallPrompt(syncAgent, savedConfig.context)
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
                setVoiceConfigError(syncError instanceof Error ? syncError.message : 'Could not sync backend starter prompt.');
              });
          }
        }      } catch (error) {
        if (mounted) {
          setVoiceConfigError(error instanceof Error ? error.message : 'Could not load voice agent configuration.');
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
  const filteredCalls = useMemo(() => calls.filter((call) => {
    const query = search.trim().toLowerCase();
    const displayName = call.type === 'manual-dial' ? 'manual dial' : call.name.toLowerCase();
    const matchesSearch = !query
      || displayName.includes(query)
      || call.name.toLowerCase().includes(query)
      || (call.phone ?? '').toLowerCase().includes(query);
    const matchesTab = activeTab === 'all' || (activeTab === 'missed' && call.type === 'missed');
    return matchesSearch && matchesTab;
  }), [activeTab, calls, search]);

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
      setDialNumber(number);
    }
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
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, [voiceNumbers]);

  const appendDialDigit = useCallback((digit: string) => {
    setDialNumber((current) => `${current}${digit}`);
  }, []);

  const deleteDialDigit = useCallback(() => {
    setDialNumber((current) => current.slice(0, -1));
  }, []);

  const handlePhoneFallback = useCallback(async (phoneNumber: string) => {
    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch {
      Alert.alert('Call unavailable', 'This device could not open the phone dialer.');
    }
  }, []);

  const handleManualCall = useCallback(async () => {
    setCallFeedback(null);
    const normalizedNumber = normalizeDialNumber(dialNumber);

    if (!normalizedNumber) {
      setCallFeedback({ type: 'error', text: 'Enter a phone number before calling.' });
      Alert.alert('Dial number', 'Enter a phone number before calling.');
      return;
    }

    const latestConfig = await loadVoiceCallConfig().catch(() => null);
    const latestConfigIsValid = Boolean(
      latestConfig
        && voiceAgents.some((agent) => agent.id === latestConfig.agentId)
        && findVoiceNumber(voiceNumbers, latestConfig.fromNumber),
    );
    const effectiveSavedConfig = latestConfigIsValid ? latestConfig : savedVoiceConfig;
    const configuredFromNumber = effectiveSavedConfig?.fromNumber || selectedFromNumber;
    const configuredVoiceNumber = findVoiceNumber(voiceNumbers, configuredFromNumber);
    const normalizedFromNumber = configuredVoiceNumber?.phone_number || normalizeE164Like(configuredFromNumber);
    const configuredAgentId = configuredVoiceNumber?.assignedAgentId || effectiveSavedConfig?.agentId || selectedAgentId;
    // Always use the saved AI Voice Calling config from Settings — no per-call override
    const effectiveInstructions = effectiveSavedConfig?.context;
    const configuredContext = buildAgentCallContext(effectiveInstructions, normalizedNumber);
    const configuredAgentName = voiceAgents.find((agent) => agent.id === configuredAgentId)?.name || effectiveSavedConfig?.agentName || selectedVoiceAgent?.name || 'Voice agent';

    if (latestConfigIsValid && latestConfig) {
      setSavedVoiceConfig(latestConfig);
      setSelectedAgentId(configuredAgentId || latestConfig.agentId);
      setSelectedFromNumber(configuredVoiceNumber?.phone_number || latestConfig.fromNumber);
    }

    if (!configuredAgentId || !normalizedFromNumber || !configuredVoiceNumber) {
      setCallFeedback({
        type: 'error',
        text: voiceConfigError || 'Open Settings > AI Voice Calling, select one of the verified backend numbers, add content, and save it first.',
      });
      Alert.alert(
        'Voice call setup missing',
        voiceConfigError || 'Open Settings > AI Voice Calling, select one of the verified backend numbers, add content, and save it first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Phone App', onPress: () => void handlePhoneFallback(normalizedNumber) },
        ],
      );
      return;
    }

    const configuredAgent = voiceAgents.find((agent) => agent.id === configuredAgentId);
    if (!configuredAgent) {
      setCallFeedback({ type: 'error', text: 'Refresh Settings > AI Voice Calling, save the setup again, then retry the call.' });
      Alert.alert('Voice agent unavailable', 'Refresh Settings > AI Voice Calling, save the setup again, then retry the call.');
      return;
    }

    const optimisticCall = createOptimisticCallRecord({
      phoneNumber: normalizedNumber,
      agentName: configuredAgentName,
      fromNumber: normalizedFromNumber,
      instructions: configuredContext,
    });

    setIsCalling(true);
    setCallFeedback({ type: 'info', text: `Preparing ${configuredAgentName} to call ${normalizedNumber}...` });
    registerPendingManualDialCall(optimisticCall);
    prependCall(optimisticCall);

    try {
      const syncedAgentPrompt = await syncVoiceAgentCallPrompt(configuredAgent, configuredContext);
      setVoiceAgents((currentAgents) => currentAgents.map((agent) => (
        agent.id === configuredAgent.id
          ? { ...agent, ...syncedAgentPrompt }
          : agent
      )));

      setCallFeedback({ type: 'info', text: `Calling ${normalizedNumber} with ${configuredAgentName}...` });
      const callResponse = await makeCall({
        voiceAgentId: configuredAgentId,
        phoneNumber: normalizedNumber,
        context: configuredContext,
        fromNumber: normalizedFromNumber,
        openingMessage: DEFAULT_OUTBOUND_STARTER_PROMPT,
        clientCallId: optimisticCall.id,
      });
      const startResponseDetails = callResponse && typeof callResponse === 'object' ? callResponse as RawCallDetails : {};
      const responseBackedPendingCall: CallRecord = {
        ...optimisticCall,
        backendDetails: {
          ...getRawObject(optimisticCall.backendDetails),
          ...startResponseDetails,
          start_call_response: startResponseDetails,
          client_call_id: optimisticCall.id,
          to_number: normalizedNumber,
          local_dialed_number: normalizedNumber,
          lad_app_dialed_number: normalizedNumber,
          metadata: {
            ...getRawObject(getRawObject(optimisticCall.backendDetails).metadata),
            ...getRawObject(startResponseDetails.metadata),
            client_call_id: optimisticCall.id,
            to_number: normalizedNumber,
            local_dialed_number: normalizedNumber,
            lad_app_dialed_number: normalizedNumber,
          },
        },
      };
      replacePendingManualDialCall(optimisticCall.id, responseBackedPendingCall);
      setCalls(useCallStore.getState().calls.map((call) => (
        call.id === optimisticCall.id ? responseBackedPendingCall : call
      )));
      const backendCallId = findCallLogIdInPayload(callResponse);

      if (backendCallId) {
        const overrideStartedAt = new Date().toISOString();
        registerManualDialCallOverride(backendCallId, normalizedNumber, overrideStartedAt);
        try {
          const backendPayload = await getCallLog(backendCallId);
          const backendDetails = unwrapBackendCallDetails(backendPayload);
          const backendCall = normalizeCallLog(backendDetails as never);
          const exactCall: CallRecord = {
            ...backendCall,
            id: backendCall.id || backendCallId,
            name: backendCall.name && backendCall.name !== 'Unknown lead' ? backendCall.name : normalizedNumber,
            phone: normalizedNumber,
            type: 'manual-dial',
            backendDetails: {
              ...backendDetails,
              client_call_id: optimisticCall.id,
              local_dialed_number: normalizedNumber,
              lad_app_dialed_number: normalizedNumber,
              local_started_at: overrideStartedAt,
              metadata: {
                ...(backendDetails.metadata && typeof backendDetails.metadata === 'object' ? backendDetails.metadata : {}),
                client_call_id: optimisticCall.id,
                local_dialed_number: normalizedNumber,
                lad_app_dialed_number: normalizedNumber,
                to_number: normalizedNumber,
              },
            },
          };
          if (isResolvedBackendCall(exactCall)) {
            replacePendingManualDialCall(optimisticCall.id, exactCall);
            setCalls([exactCall, ...useCallStore.getState().calls.filter((call) => call.id !== optimisticCall.id && call.id !== exactCall.id)]);
          } else {
            const progressCall: CallRecord = {
              ...optimisticCall,
              time: exactCall.time || optimisticCall.time,
              callStatus:
                (exactCall.callStatus === 'failed' || exactCall.callStatus === 'no-answer' || exactCall.callStatus === 'dropped') &&
                exactCall.duration <= 1
                  ? optimisticCall.callStatus
                  : exactCall.callStatus,
              duration: Math.max(optimisticCall.duration, exactCall.duration),
              transcript: exactCall.transcript && exactCall.transcript !== 'Transcript is not available yet.'
                ? exactCall.transcript
                : optimisticCall.transcript,
              aiSummary: exactCall.aiSummary || optimisticCall.aiSummary,
              backendDetails: {
                ...getRawObject(optimisticCall.backendDetails),
                ...backendDetails,
                call_log_id: backendCallId,
                client_call_id: optimisticCall.id,
                to_number: normalizedNumber,
                local_dialed_number: normalizedNumber,
                lad_app_dialed_number: normalizedNumber,
                local_started_at: overrideStartedAt,
                backend_progress: backendDetails,
                metadata: {
                  ...(backendDetails.metadata && typeof backendDetails.metadata === 'object' ? backendDetails.metadata : {}),
                  client_call_id: optimisticCall.id,
                  local_dialed_number: normalizedNumber,
                  lad_app_dialed_number: normalizedNumber,
                  to_number: normalizedNumber,
                },
              },
            };
            replacePendingManualDialCall(optimisticCall.id, progressCall);
            setCalls(useCallStore.getState().calls.map((call) => (
              call.id === optimisticCall.id ? progressCall : call
            )));
          }
        } catch {
          const pendingBackendCall: CallRecord = {
            ...optimisticCall,
            phone: normalizedNumber,
            name: 'Manual dial',
            type: 'manual-dial',
            backendDetails: {
              ...(callResponse as RawCallDetails),
              call_log_id: backendCallId,
              client_call_id: optimisticCall.id,
              to_number: normalizedNumber,
              local_dialed_number: normalizedNumber,
              lad_app_dialed_number: normalizedNumber,
              local_started_at: overrideStartedAt,
              metadata: {
                client_call_id: optimisticCall.id,
                local_dialed_number: normalizedNumber,
                lad_app_dialed_number: normalizedNumber,
                to_number: normalizedNumber,
              },
            },
          };
          replacePendingManualDialCall(optimisticCall.id, pendingBackendCall);
          setCalls(useCallStore.getState().calls.map((call) => (
            call.id === optimisticCall.id ? pendingBackendCall : call
          )));
        }
      }
      setCallFeedback({ type: 'success', text: `Voice agent call started for ${normalizedNumber}. Scroll down to see status updates.` });
      setDialNumber('');
      setIsDialerOpen(false);
      // Scroll to top so the queued call record is visible immediately
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      scheduleCallHistoryRefresh(fetchCalls);
    } catch (error) {
      const message = getCallErrorMessage(error);
      clearPendingManualDialCall(optimisticCall.id);
      setCalls(useCallStore.getState().calls.filter((call) => call.id !== optimisticCall.id));
      setCallFeedback({ type: 'error', text: message });
      Alert.alert('Agent call failed', `${message}\n\nOpen phone dialer instead?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Phone App', onPress: () => void handlePhoneFallback(normalizedNumber) },
      ]);
    } finally {
      setIsCalling(false);
    }
  }, [dialNumber, fetchCalls, handlePhoneFallback, prependCall, savedVoiceConfig, selectedAgentId, selectedFromNumber, selectedVoiceAgent?.name, setCalls, voiceAgents, voiceConfigError, voiceNumbers]);

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
        const [response, searchedLogs] = await Promise.all([
          getCallLogs({ page: 1, limit: 1000 }),
          selectedPhone ? searchCallLogsForPhone(selectedPhone) : Promise.resolve([]),
        ]);
        const rawLogs = [...searchedLogs, ...(response.logs || [])].filter((item, index, array) => {
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
        setDetailsError(detailError instanceof Error ? detailError.message : 'Could not load full backend contact details.');
      }).finally(() => {
        setIsDetailsLoading(false);
      });
  }, [setCalls]);

  const closeCallDetails = useCallback(() => {
    setSelectedCall(null);
    setSelectedCallDetails(null);
    setSelectedLeadDetails(null);
    setDetailsError(null);
    setIsDetailsLoading(false);
  }, []);

  const renderCall = useCallback(({ item }: { item: CallRecord }) => (
    <CallCard call={item} onPress={() => openCallDetails(item)} />
  ), [openCallDetails]);

  const renderListHeader = useCallback(() => (
    <>
      {isDialerOpen && (
        <View style={[styles.dialerPanel, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          {/* ── Header ── */}
          <View style={styles.dialerHeader}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3" style={styles.dialerTitle}>Make a Call</Typography>
              <Typography variant="caption" color={appTheme.muted}>
                Configure and initiate your AI agent call
              </Typography>
            </View>
            <TouchableOpacity
              style={[styles.closeDialerButton, { backgroundColor: appTheme.softSurface }]}
              onPress={() => setIsDialerOpen(false)}
              activeOpacity={0.7}
            >
              <X color={appTheme.muted} size={20} />
            </TouchableOpacity>
          </View>

          {/* ── Phone number input ── */}
          <Typography variant="caption" style={[styles.dialerFieldLabel, { color: appTheme.muted }]}>Phone number</Typography>
          <View style={styles.numberRow}>
            <TextInput
              value={dialNumber}
              onChangeText={setDialNumber}
              placeholder="Enter phone number"
              placeholderTextColor={appTheme.disabled}
              keyboardType="phone-pad"
              style={[styles.numberInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
            />
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: appTheme.softSurface }]}
              onPress={deleteDialDigit}
              onLongPress={() => setDialNumber('')}
              activeOpacity={0.7}
            >
              <Delete color={appTheme.muted} size={22} />
            </TouchableOpacity>
          </View>

          {/* ── Keypad ── */}
          <View style={styles.keypadGrid}>
            {DIAL_KEYS.map((digit) => (
              <TouchableOpacity
                key={digit}
                style={[styles.keypadButton, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}
                onPress={() => appendDialDigit(digit)}
                activeOpacity={0.75}
              >
                <Typography variant="h3" style={[styles.keypadText, { color: appTheme.text }]}>{digit}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Voice agent configuration (read-only, from saved Settings) ── */}
          {isVoiceConfigLoading ? (
            <View style={[styles.voiceConfigBox, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
              <View style={styles.voiceConfigInline}>
                <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                <Typography variant="caption" color={appTheme.muted}>Loading saved configuration...</Typography>
              </View>
            </View>
          ) : (
            <View style={[styles.voiceConfigBox, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
              <View style={styles.voiceConfigInline}>
                <Bot color={appTheme.primaryAccent} size={16} />
                <View style={{ flex: 1, marginLeft: Theme.spacing.sm }}>
                  <Typography variant="overline" color={appTheme.muted}>AI Agent</Typography>
                  <Typography variant="bodySmall" style={[styles.voiceConfigValue, { color: appTheme.text }]} numberOfLines={1}>
                    {savedVoiceConfig?.agentName || selectedVoiceAgent?.name || 'No agent saved'}
                  </Typography>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Typography variant="overline" color={appTheme.muted}>From</Typography>
                  <Typography variant="bodySmall" style={[styles.voiceConfigValue, { color: appTheme.text }]} numberOfLines={1}>
                    {savedVoiceConfig?.fromNumber || selectedVoiceNumber?.phone_number || 'No number'}
                  </Typography>
                </View>
              </View>
              {(savedVoiceConfig?.context) ? (
                <Typography variant="caption" color={appTheme.muted} numberOfLines={2} style={{ marginTop: 4 }}>
                  Instructions: {savedVoiceConfig.context.slice(0, 80)}{savedVoiceConfig.context.length > 80 ? '…' : ''}
                </Typography>
              ) : null}
              {voiceConfigError ? (
                <Typography variant="caption" color={Theme.colors.error} numberOfLines={2} style={{ marginTop: 4 }}>{voiceConfigError}</Typography>
              ) : !savedVoiceConfig ? (
                <Typography variant="caption" color="#D97706" numberOfLines={2} style={{ marginTop: 4 }}>
                  No saved config. Go to Settings › AI Voice Calling to save your agent and number.
                </Typography>
              ) : null}
            </View>
          )}

          {/* ── Initiate Call button ── */}
          <TouchableOpacity
            style={[styles.callNowButton, (!dialNumber.trim() || isCalling || isVoiceConfigLoading) && styles.callNowButtonDisabled]}
            onPress={handleManualCall}
            activeOpacity={0.8}
            disabled={!dialNumber.trim() || isCalling || isVoiceConfigLoading}
          >
            {isCalling ? (
              <ActivityIndicator color={Theme.colors.surface} size="small" />
            ) : (
              <Phone color={Theme.colors.surface} size={20} fill={Theme.colors.surface} />
            )}
            <Typography variant="bodySmall" style={styles.callNowText}>{isCalling ? 'Starting agent call...' : 'Initiate Call'}</Typography>
          </TouchableOpacity>

          {/* ── Feedback banner ── */}
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
        </View>
      )}

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
            style={[styles.tab, { backgroundColor: appTheme.softSurface }, activeTab === 'all' && { backgroundColor: appTheme.successSoft }]}
          >
            <Typography variant="bodySmall" style={[styles.tabText, { color: appTheme.muted }, activeTab === 'all' && styles.tabTextActive]}>All</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('missed')}
            style={[styles.tab, { backgroundColor: appTheme.softSurface }, activeTab === 'missed' && { backgroundColor: appTheme.successSoft }]}
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
  ), [activeTab, appendDialDigit, appTheme, callFeedback, deleteDialDigit, dialNumber, handleManualCall, isCalling, isDialerOpen, isVoiceConfigLoading, savedVoiceConfig, search, selectedVoiceAgent?.name, selectedVoiceNumber?.phone_number, voiceConfigError]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: appTheme.background }]}>
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Typography variant="h1" color={appTheme.text}>Calls</Typography>
          <Typography variant="body" color={appTheme.muted}>You have {filteredCalls.length} tasks to focus on today</Typography>
        </View>
        <TouchableOpacity style={styles.createGoalBtn} onPress={openGoalModal}>
          <Plus color={Theme.colors.surface} size={18} />
          <Typography variant="bodySmall" style={styles.createGoalText}>Create Goal</Typography>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          renderItem={renderCall}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 172 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          refreshing={isLoading}
          onRefresh={() => void fetchCalls()}
          onEndReached={() => void fetchNextCalls()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={appTheme.primaryAccent} style={styles.listFooterLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              {isLoading ? (
                <ActivityIndicator color={appTheme.primaryAccent} />
              ) : (
                <Typography variant="body" color={error ? Theme.colors.error : appTheme.disabled}>
                  {error || 'No calls found matching your criteria'}
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
          <Phone color={Theme.colors.surface} size={24} fill={Theme.colors.surface} />
        </TouchableOpacity>
      </Animated.View>

      <Modal transparent visible={Boolean(selectedCall)} animationType="slide" onRequestClose={closeCallDetails}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailsModalCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTitleBlock}>
                <Typography variant="h3" color={appTheme.text} style={styles.detailsTitle} numberOfLines={1}>
                  {selectedCall?.name || 'Contact details'}
                </Typography>
                <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                  {selectedCall?.phone || 'No phone'} - {selectedCall?.callStatus?.replace('-', ' ') || 'call log'}
                </Typography>
              </View>
              <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: appTheme.softSurface }]} onPress={closeCallDetails} activeOpacity={0.7}>
                <X color={appTheme.muted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
              {selectedCall ? (
                <>
                  <DetailSection title="Contact" appTheme={appTheme}>
                    <DetailRow label="Name" value={getLeadDisplayName(selectedLeadDetails) || selectedCall.name} appTheme={appTheme} />
                    <DetailRow label="Number dialed" value={selectedCall.phone || getDetailsPhone(selectedLeadDetails) || '-'} appTheme={appTheme} />
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

                  <DetailSection title="Call" appTheme={appTheme}>
                    <DetailRow label="Call type" value={formatCallTypeLabel(selectedCall.type)} appTheme={appTheme} />
                    <DetailRow label="Status" value={selectedCall.callStatus.replace('-', ' ')} appTheme={appTheme} />
                    <DetailRow label="Duration" value={`${selectedCall.duration}s`} appTheme={appTheme} />
                    <DetailRow label="Time" value={selectedCall.time} appTheme={appTheme} />
                    <DetailRow label="From number" value={selectedCall.fromNumber?.phoneNumber || selectedCall.fromNumber?.label || '-'} appTheme={appTheme} />
                    <DetailRow label="Agent" value={selectedCall.agent?.name || '-'} appTheme={appTheme} />
                  </DetailSection>

                  <DetailSection title="Contact call history" appTheme={appTheme}>
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
                            {formatCallTypeLabel(historyCall.type)} - {historyCall.callStatus.replace('-', ' ')} - {historyCall.duration}s
                          </Typography>
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
                            {historyCall.aiSummary.callOutcome || historyCall.transcript || 'Backend record pending'}
                          </Typography>
                        </View>
                      ))
                    ) : (
                      <Typography variant="bodySmall" color={appTheme.muted}>
                        Backend call history will appear here when the agent interaction is stored.
                      </Typography>
                    )}
                  </DetailSection>

                  <DetailSection title="AI Summary" appTheme={appTheme}>
                    <DetailRow label="Intent" value={selectedCall.aiSummary.customerIntent} appTheme={appTheme} />
                    <DetailRow label="Outcome" value={selectedCall.aiSummary.callOutcome} appTheme={appTheme} />
                    <DetailRow label="Discussion" value={selectedCall.aiSummary.discussionPoints.join('\n')} appTheme={appTheme} />
                    <DetailRow label="Follow-up" value={selectedCall.aiSummary.followUpSuggestion} appTheme={appTheme} />
                  </DetailSection>

                  <DetailSection title="Transcript" appTheme={appTheme}>
                    <Typography variant="bodySmall" color={appTheme.muted} style={styles.transcriptText}>
                      {selectedCall.transcript || 'Transcript is not available yet.'}
                    </Typography>
                  </DetailSection>
                </>
              ) : null}

              <DetailSection title="Backend call record" appTheme={appTheme}>
                {isDetailsLoading ? (
                  <View style={styles.detailsLoading}>
                    <ActivityIndicator color={appTheme.primaryAccent} />
                    <Typography variant="bodySmall" color={appTheme.muted}>Loading call record from LAD Frontend 2 backend...</Typography>
                  </View>
                ) : detailsError ? (
                  <Typography variant="bodySmall" color={Theme.colors.error}>{detailsError}</Typography>
                ) : selectedCallDetails ? (
                  <>
                    <DetailRow
                      label="Call log ID"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'call_log_id', 'id', 'call_id'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Lead ID"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'lead_id', 'leadId'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Agent ID"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'agent_id', 'voice_id', 'assistant_id'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Direction"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'direction', 'call_type'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Started"
                      value={formatBackendDate(pickBackendValue(selectedCallDetails, 'started_at', 'created_at'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Updated"
                      value={formatBackendDate(pickBackendValue(selectedCallDetails, 'updated_at', 'ended_at'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Recording"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'recording_url', 'signed_recording_url', 'call_recording_url'))}
                      appTheme={appTheme}
                    />
                    <DetailRow
                      label="Cost"
                      value={formatDetailValue(pickBackendValue(selectedCallDetails, 'cost', 'call_cost'))}
                      appTheme={appTheme}
                    />
                  </>
                ) : (
                  <Typography variant="bodySmall" color={appTheme.muted}>No backend call record returned yet.</Typography>
                )}
              </DetailSection>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={goalModalOpen} animationType="fade" onRequestClose={() => setGoalModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.goalModalCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <View style={styles.goalModalHeader}>
              <View>
                <Typography variant="h3" style={styles.goalModalTitle}>Create Call Goal</Typography>
                <Typography variant="caption" color={appTheme.muted}>
                  Set the outcome this calling session should optimize for.
                </Typography>
              </View>
              <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: appTheme.softSurface }]} onPress={() => setGoalModalOpen(false)} activeOpacity={0.7}>
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
    </View>
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
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  titleArea: {
    flex: 1,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '800',
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
    fontWeight: '800',
    marginBottom: 2,
  },
  voiceConfigValue: {
    color: Theme.colors.text,
    fontWeight: '800',
  },
  voiceConfigMeta: {
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  // ── Enhanced dial-pad styles ──
  dialerFieldLabel: {
    fontWeight: '800',
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
    fontWeight: '800',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    paddingHorizontal: Theme.spacing.lg,
    justifyContent: 'center',
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
  goalModalTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
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
    fontWeight: '900',
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
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  detailRow: {
    borderTopWidth: 1,
    paddingTop: Theme.spacing.sm,
    gap: 3,
  },
  detailLabel: {
    fontWeight: '900',
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
    fontWeight: '800',
  },
  transcriptText: {
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
  },
});




