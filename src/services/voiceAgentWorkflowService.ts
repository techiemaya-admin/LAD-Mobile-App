import {
  getUserAvailableAgents,
  getUserAvailableNumbers,
  makeCall,
  resolvePhones as resolvePhonesApi,
  triggerBatchCall,
} from '@/src/services/voice-agent';
import {
  AIVoiceAgent,
  CallExecutionConfig,
  CallRecord,
  CallStatus,
  LeadContact,
} from '@/types/calls';
import {
  categorizeLead,
  getEngagementScore,
  getLeadTemperatureColor,
} from './leadCategorization';
import { normalizeVoiceNumbers } from './voiceCallConfig';

type RawRecord = Record<string, any>;

export const demoLeadIds: string[] = [];

const normalizeCallStatus = (value?: string): CallStatus => {
  if (
    value === 'queued' ||
    value === 'ringing' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'ended' ||
    value === 'failed' ||
    value === 'no-answer' ||
    value === 'dropped'
  ) {
    return value;
  }

  return 'queued';
};

const pickRecord = (value: unknown): RawRecord => {
  if (value && typeof value === 'object') {
    const record = value as RawRecord;
    return record.call ?? record.data ?? record.result ?? record;
  }

  return {};
};

export async function fetchAvailableAgents() {
  const agents = await getUserAvailableAgents();
  return agents.map((agent) => ({
    id: String(agent.agent_id ?? agent.id ?? agent.agent_name ?? agent.name ?? ''),
    name: String(agent.agent_name ?? agent.name ?? 'AI Agent'),
    language: String(agent.agent_language ?? agent.language ?? 'English'),
    accent: String(agent.accent ?? 'Neutral'),
    gender: String(agent.gender ?? 'Neutral'),
  })).filter((agent) => agent.id);
}

export async function fetchUserAvailableNumbers() {
  const numbers = await getUserAvailableNumbers();
  return normalizeVoiceNumbers(numbers).map((number) => ({
    id: number.id,
    label: number.label || number.provider || 'Verified Number',
    phoneNumber: number.phoneNumber,
  })).filter((number) => number.id && number.phoneNumber);
}

export async function resolvePhones(leadIds: string[]) {
  if (leadIds.length === 0) {
    return [];
  }

  const rows = await resolvePhonesApi(leadIds, 'employee');
  return rows.map((row, index) => ({
    id: String(row.requested_id ?? leadIds[index] ?? row.phone ?? `lead-${index}`),
    name: String(row.name ?? row.employee_name ?? row.company_name ?? `Lead ${index + 1}`),
    phone: row.phone,
    company: row.company_name,
  })).filter((lead) => lead.phone);
}

function buildSummary(_contact: LeadContact, _duration: number, status: CallStatus, _instructions: string, record: RawRecord) {
  const existingSummary = record.aiSummary ?? record.ai_summary ?? record.summary;
  if (existingSummary && typeof existingSummary === 'object') {
    return existingSummary;
  }

  const completed = status === 'completed' || status === 'ended';

  return {
    customerIntent: completed ? 'Captured by backend after transcript analysis.' : 'Not available yet.',
    callOutcome: completed ? 'Completed call awaiting backend summary.' : 'Call is pending or did not complete.',
    discussionPoints: [],
    followUpSuggestion: 'Review backend summary when call processing completes.',
  };
}

function buildTranscript(_contact: LeadContact, _agent: AIVoiceAgent, _instructions: string, _status: CallStatus, record: RawRecord) {
  const transcript = record.transcript ?? record.call_transcript ?? record.transcription;
  if (typeof transcript === 'string' && transcript.trim()) {
    return transcript;
  }

  return '';
}

function toCallRecord(contact: LeadContact, config: CallExecutionConfig, response: unknown, index = 0): CallRecord {
  const record = pickRecord(response);
  const duration = Number(record.duration ?? record.call_duration ?? record.duration_seconds ?? 0);
  const status = normalizeCallStatus(record.callStatus ?? record.call_status ?? record.status);
  const callStatus = status === 'queued' && duration >= 10 ? 'completed' : status;
  const leadTemperature = categorizeLead(duration, callStatus);
  const transcript = buildTranscript(contact, config.agent, config.instructions, callStatus, record);

  return {
    id: String(record.id ?? record.call_id ?? `ai-call-${contact.id}-${Date.now()}-${index}`),
    name: contact.name,
    phone: contact.phone,
    type: callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'dropped' ? 'missed' : 'outgoing',
    time: 'Just now',
    avatar: contact.avatar || '',
    statusColor: getLeadTemperatureColor(leadTemperature),
    duration,
    transcript,
    engagement_score: Number(record.engagement_score ?? record.engagementScore ?? getEngagementScore(duration, callStatus)),
    leadTemperature,
    aiSummary: buildSummary(contact, duration, callStatus, config.instructions, record),
    callStatus,
    agent: config.agent,
    fromNumber: config.fromNumber,
    instructions: config.instructions,
  };
}

export async function startAICallSession(contact: LeadContact, config: CallExecutionConfig) {
  if (!contact.phone) {
    throw new Error('Lead phone number is required to start a call.');
  }

  const response = await makeCall({
    voiceAgentId: config.agent.id,
    phoneNumber: contact.phone,
    fromNumber: config.fromNumber.phoneNumber,
    context: JSON.stringify({
      lead: contact,
      agent: config.agent,
      instructions: config.instructions,
    }),
  });

  return toCallRecord(contact, config, response);
}

export async function startBulkAICallSession(contacts: LeadContact[], config: CallExecutionConfig) {
  const dialableContacts = contacts.filter((contact) => contact.phone);
  const response = await triggerBatchCall({
    voice_id: config.agent.id,
    agent_id: config.agent.id,
    from_number: config.fromNumber.phoneNumber,
    added_context: config.instructions,
    entries: dialableContacts.map((contact) => ({
      to_number: contact.phone || '',
      lead_name: contact.name,
      added_context: config.instructions,
      lead_id: contact.id,
    })),
  });

  return dialableContacts.map((contact, index) => toCallRecord(contact, config, response, index));
}
