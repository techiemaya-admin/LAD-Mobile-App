export type CallType = 'incoming' | 'outgoing' | 'missed' | 'manual-dial' | 'video';

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'ended'
  | 'failed'
  | 'no-answer'
  | 'dropped';

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface AIVoiceAgent {
  id: string;
  name: string;
  language: string;
  accent: string;
  gender: string;
}

export interface VerifiedNumber {
  id: string;
  label: string;
  phoneNumber: string;
}

export interface LeadContact {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  avatar?: string;
}

export interface CallSummary {
  customerIntent: string;
  callOutcome: string;
  discussionPoints: string[];
  followUpSuggestion: string;
}

export interface CallRecord {
  id: string;
  name: string;
  type: CallType;
  time: string;
  avatar: string;
  count?: number;
  statusColor?: string;
  phone?: string;
  duration: number;
  transcript: string;
  engagement_score: number;
  leadTemperature: LeadTemperature;
  aiSummary: CallSummary;
  callStatus: CallStatus;
  backendDetails?: Record<string, unknown>;
  agent?: AIVoiceAgent;
  fromNumber?: VerifiedNumber;
  instructions?: string;
}

export interface CallExecutionConfig {
  agent: AIVoiceAgent;
  fromNumber: VerifiedNumber;
  instructions: string;
}
