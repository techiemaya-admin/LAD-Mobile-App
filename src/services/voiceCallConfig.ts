import { apiGet, apiPut, safeStorage } from '@/src/api';

export const VOICE_CALL_CONFIG_STORAGE_KEY = 'lad.voiceCallConfig.v1';

export const DEFAULT_OUTBOUND_STARTER_PROMPT = 'Hello, this is an AI assistant from TechieMaya. Am I speaking with you at a good time?';
export const VAPI_FIRST_MESSAGE_MODE = 'assistant-speaks-first';

export const DEFAULT_VOICE_CALL_CONTEXT = `You are placing an outbound call from LAD for TechieMaya. Start speaking immediately when the person answers. Open with: "${DEFAULT_OUTBOUND_STARTER_PROMPT}" Then explain the call purpose clearly, listen, and respond politely.`;

export type VoiceAgentOption = {
  id: string;
  name: string;
  language?: string;
  accent?: string;
  gender?: string;
  provider?: string;
  description?: string;
  voiceId?: string;
  voiceGender?: string;
  voiceLanguage?: string;
  agentInstructions?: string;
  systemInstructions?: string;
  outboundStarterPrompt?: string;
};

export type VoiceNumberOption = {
  id: string;
  phoneNumber: string;
  label: string;
  baseNumber?: string;
  countryCode?: string;
  provider?: string;
  assignedAgentId?: string;
};

export type SavedVoiceCallConfig = {
  agentId: string;
  agentName: string;
  fromNumber: string;
  fromNumberLabel?: string;
  context: string;
  savedAt: string;
};

export const unwrapApiList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) {
        return nested.data as T[];
      }
      if (Array.isArray(nested.items)) {
        return nested.items as T[];
      }
    }
    if (Array.isArray(record.items)) {
      return record.items as T[];
    }
    if (Array.isArray(record.results)) {
      return record.results as T[];
    }
  }

  return [];
};

const toDigits = (value: unknown) => String(value ?? '').replace(/[^\d]/g, '');
const isEmptyPhoneValue = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === '+' || normalized === '+null' || normalized === 'null' || normalized === 'undefined';
};

export const normalizeE164Like = (phone: unknown) => String(phone ?? '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[^\d+]/g, '')
  .replace(/^\+{2,}/, '+');

export const phoneSignature = (phone: unknown) => toDigits(phone).replace(/^0+/, '');
export const phoneNumbersMatch = (first: unknown, second: unknown) => {
  const firstSignature = phoneSignature(first);
  const secondSignature = phoneSignature(second);

  if (!firstSignature || !secondSignature) {
    return false;
  }

  return firstSignature === secondSignature
    || (firstSignature.length >= 7 && secondSignature.endsWith(firstSignature))
    || (secondSignature.length >= 7 && firstSignature.endsWith(secondSignature));
};

const normalizeCountryCode = (countryCode: unknown) => {
  const digits = toDigits(countryCode);
  return digits ? `+${digits}` : '';
};

const normalizeVoicePhoneNumber = (number: Record<string, unknown>) => {
  const countryCode = normalizeCountryCode(number.country_code ?? number.countryCode ?? number.dial_code ?? number.dialCode);
  const baseNumber = toDigits(number.base_number ?? number.baseNumber ?? number.local_number ?? number.localNumber);
  const directCandidates = [
    number.e164,
    number.e164_number,
    number.e164Number,
    number.full_number,
    number.fullNumber,
    number.formatted_number,
    number.formattedNumber,
    number.phone_number,
    number.phoneNumber,
    number.number,
    number.value,
  ];

  const directE164 = directCandidates
    .map((candidate) => normalizeE164Like(candidate))
    .find((candidate) => candidate.startsWith('+') && phoneSignature(candidate).length >= 8 && !isEmptyPhoneValue(candidate));

  if (directE164) {
    return directE164;
  }

  const rawLocalDigits = baseNumber || directCandidates.map(toDigits).find((candidate) => candidate.length >= 8) || '';

  if (countryCode && rawLocalDigits) {
    const countryDigits = toDigits(countryCode);
    const localNumber = rawLocalDigits.startsWith(countryDigits) && rawLocalDigits.length > countryDigits.length + 4
      ? rawLocalDigits.slice(countryDigits.length)
      : rawLocalDigits;
    return `+${countryDigits}${localNumber.replace(/^0+/, '')}`;
  }

  const rawDigits = rawLocalDigits || directCandidates.map(toDigits).find((candidate) => candidate.length >= 8);
  return rawDigits ? `+${rawDigits}` : '';
};

export const normalizeVoiceAgents = (payload: unknown): VoiceAgentOption[] => unwrapApiList<Record<string, unknown>>(payload)
  .map((agent) => ({
    id: String(agent.agent_id ?? agent.id ?? agent._id ?? ''),
    name: String(agent.agent_name ?? agent.name ?? agent.title ?? 'Voice Agent'),
    language: agent.agent_language ? String(agent.agent_language) : agent.language ? String(agent.language) : undefined,
    accent: agent.accent ? String(agent.accent) : undefined,
    gender: agent.gender ? String(agent.gender) : agent.voice_gender ? String(agent.voice_gender) : undefined,
    provider: agent.provider ? String(agent.provider) : undefined,
    description: agent.description ? String(agent.description) : undefined,
    voiceId: agent.voice_id ? String(agent.voice_id) : agent.voiceId ? String(agent.voiceId) : undefined,
    voiceGender: agent.voice_gender ? String(agent.voice_gender) : agent.voiceGender ? String(agent.voiceGender) : agent.gender ? String(agent.gender) : undefined,
    voiceLanguage: agent.agent_language ? String(agent.agent_language) : agent.voiceLanguage ? String(agent.voiceLanguage) : agent.language ? String(agent.language) : undefined,
    agentInstructions: agent.agent_instructions ? String(agent.agent_instructions) : agent.agentInstructions ? String(agent.agentInstructions) : undefined,
    systemInstructions: agent.system_instructions ? String(agent.system_instructions) : agent.systemInstructions ? String(agent.systemInstructions) : undefined,
    outboundStarterPrompt: agent.outbound_starter_prompt ? String(agent.outbound_starter_prompt) : agent.outboundStarterPrompt ? String(agent.outboundStarterPrompt) : undefined,
  }))
  .filter((agent) => agent.id);

export const normalizeVoiceNumbers = (payload: unknown): VoiceNumberOption[] => unwrapApiList<Record<string, unknown>>(payload)
  .map((number) => {
    const phoneNumber = normalizeVoicePhoneNumber(number);
    const baseNumber = number.base_number ? String(number.base_number) : number.baseNumber ? String(number.baseNumber) : undefined;
    const countryCode = number.country_code ? String(number.country_code) : number.countryCode ? String(number.countryCode) : undefined;
    const label = String(number.label ?? number.name ?? baseNumber ?? phoneNumber ?? 'Calling number');

    return {
      id: String(number.id ?? number.e164 ?? number.full_number ?? number.fullNumber ?? number.phone_number ?? number.phoneNumber ?? number.number ?? phoneNumber),
      phoneNumber,
      label,
      baseNumber,
      countryCode,
      provider: number.provider ? String(number.provider) : undefined,
      assignedAgentId: number.assignedAgentId ? String(number.assignedAgentId) : number.assigned_agent_id ? String(number.assigned_agent_id) : undefined,
    };
  })
  .filter((number) => number.id && number.phoneNumber);

const mergeAgentWithSettings = (agent: VoiceAgentOption, settingsAgent?: VoiceAgentOption): VoiceAgentOption => {
  if (!settingsAgent) {
    return agent;
  }

  return {
    id: agent.id,
    name: agent.name || settingsAgent.name,
    language: agent.language || settingsAgent.language,
    accent: agent.accent || settingsAgent.accent,
    gender: agent.gender || settingsAgent.gender,
    provider: agent.provider || settingsAgent.provider,
    description: agent.description || settingsAgent.description,
    voiceId: agent.voiceId || settingsAgent.voiceId,
    voiceGender: agent.voiceGender || settingsAgent.voiceGender,
    voiceLanguage: agent.voiceLanguage || settingsAgent.voiceLanguage,
    agentInstructions: agent.agentInstructions || settingsAgent.agentInstructions,
    systemInstructions: agent.systemInstructions || settingsAgent.systemInstructions,
    outboundStarterPrompt: agent.outboundStarterPrompt || settingsAgent.outboundStarterPrompt,
  };
};

export const fetchVoiceCallOptions = async () => {
  const [agentsResponse, settingsAgentsResponse, numbersResponse] = await Promise.all([
    apiGet<unknown>('/api/voice-agent/user/available-agents'),
    apiGet<unknown>('/api/voice-agent/settings/agents').catch(() => null),
    apiGet<unknown>('/api/voice-agent/user/available-numbers').catch(() => apiGet<unknown>('/api/voice-agent/available-numbers')),
  ]);

  const settingsAgents = settingsAgentsResponse ? normalizeVoiceAgents(settingsAgentsResponse.data) : [];
  const settingsById = new Map(settingsAgents.map((agent) => [agent.id, agent]));
  const agents = normalizeVoiceAgents(agentsResponse.data).map((agent) => mergeAgentWithSettings(agent, settingsById.get(agent.id)));

  return {
    agents,
    numbers: normalizeVoiceNumbers(numbersResponse.data),
  };
};

export const buildSyncedVoiceAgentPrompt = (context: string) => {
  const trimmedContext = context.trim() || DEFAULT_VOICE_CALL_CONTEXT;

  return [
    `MANDATORY OUTBOUND START: Speak first immediately when the receiver answers. First say exactly: "${DEFAULT_OUTBOUND_STARTER_PROMPT}"`,
    'Do not wait silently for the receiver to speak first.',
    trimmedContext,
    'If the receiver is silent, ask once: "Can you hear me clearly?" Then continue politely.',
  ].join('\n\n');
};

export const syncVoiceAgentCallPrompt = async (agent: VoiceAgentOption, context: string) => {
  const syncedPrompt = buildSyncedVoiceAgentPrompt(context);
  const assistantOverrides = {
    firstMessage: DEFAULT_OUTBOUND_STARTER_PROMPT,
    firstMessageMode: VAPI_FIRST_MESSAGE_MODE,
    variableValues: {
      first_message: DEFAULT_OUTBOUND_STARTER_PROMPT,
      call_context: syncedPrompt,
    },
    model: {
      messages: [
        {
          role: 'system',
          content: syncedPrompt,
        },
      ],
    },
  };
  const body = {
    agent_name: agent.name || 'Voice Agent',
    voice_gender: agent.voiceGender || agent.gender || 'neutral',
    agent_language: agent.voiceLanguage || agent.language || 'en-US',
    ...(agent.voiceId ? { voice_id: agent.voiceId } : {}),
    agent_instructions: syncedPrompt,
    system_instructions: syncedPrompt,
    outbound_starter_prompt: DEFAULT_OUTBOUND_STARTER_PROMPT,
    firstMessage: DEFAULT_OUTBOUND_STARTER_PROMPT,
    firstMessageMode: VAPI_FIRST_MESSAGE_MODE,
    first_message: DEFAULT_OUTBOUND_STARTER_PROMPT,
    first_message_mode: VAPI_FIRST_MESSAGE_MODE,
    assistantOverrides,
    assistant_overrides: assistantOverrides,
    assistant: {
      firstMessage: DEFAULT_OUTBOUND_STARTER_PROMPT,
      firstMessageMode: VAPI_FIRST_MESSAGE_MODE,
    },
  };

  await apiPut(`/api/voice-agent/settings/agents/${encodeURIComponent(agent.id)}`, body);

  return {
    agentInstructions: syncedPrompt,
    systemInstructions: syncedPrompt,
    outboundStarterPrompt: DEFAULT_OUTBOUND_STARTER_PROMPT,
  };
};

export const loadVoiceCallConfig = async (): Promise<SavedVoiceCallConfig | null> => {
  const raw = await safeStorage.getItem(VOICE_CALL_CONFIG_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SavedVoiceCallConfig>;
    if (!parsed.agentId || !parsed.fromNumber) {
      return null;
    }

    return {
      agentId: String(parsed.agentId),
      agentName: String(parsed.agentName || 'Voice Agent'),
      fromNumber: normalizeE164Like(parsed.fromNumber),
      fromNumberLabel: parsed.fromNumberLabel ? String(parsed.fromNumberLabel) : undefined,
      context: String(parsed.context || DEFAULT_VOICE_CALL_CONTEXT),
      savedAt: String(parsed.savedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
};

export const isSavedVoiceConfigAvailable = (
  config: SavedVoiceCallConfig | null,
  agents: VoiceAgentOption[],
  numbers: VoiceNumberOption[],
) => {
  if (!config) {
    return false;
  }

  return agents.some((agent) => agent.id === config.agentId)
    && numbers.some((number) => phoneNumbersMatch(number.phoneNumber, config.fromNumber));
};

export const saveVoiceCallConfig = async (config: SavedVoiceCallConfig) => {
  await safeStorage.setItem(VOICE_CALL_CONFIG_STORAGE_KEY, JSON.stringify({
    ...config,
    fromNumber: normalizeE164Like(config.fromNumber),
  }));
};
