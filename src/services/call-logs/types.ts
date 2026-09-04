export interface CallLogResponse {
  call_log_id: string;
  id?: string;
  tenant_id?: string;
  initiated_by_user_id?: string;
  lead_id?: string;
  to_country_code?: string;
  to_base_number?: string | number;
  from_number_id?: string | null;
  agent_id?: string | number | null;
  agent_name?: string;
  lead_first_name?: string;
  lead_last_name?: string;
  lead_name?: string;
  contact_name?: string;
  contact?: Record<string, unknown>;
  lead?: Record<string, unknown>;
  direction?: 'inbound' | 'outbound' | string;
  call_type?: 'inbound' | 'outbound' | 'manual' | 'manual_dial' | 'manual-dial' | string;
  type?: string;
  source?: string;
  trigger_source?: string;
  triggered_by?: string;
  phone?: string;
  to_number?: string;
  from_number?: string;
  status: string;
  call_status?: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  call_duration?: number;
  cost?: number;
  call_cost?: number;
  currency?: string;
  cost_breakdown?: unknown;
  batch_status?: string;
  batch_id?: string;
  campaign_id?: string | null;
  campaign_lead_id?: string | null;
  campaign_step_id?: string | null;
  created_at?: string;
  updated_at?: string;
  lead_category?: string;
  lead_tags?: string[];
  lead_score?: number;
  score?: number;
  category?: string;
  outcome?: string;
  call_outcome?: string;
  status_reason?: string;
  disposition?: string;
  signed_recording_url?: string;
  recording_url?: string;
  call_recording_url?: string;
  transcript?: string;
  call_transcript?: string;
  transcription?: string;
  transcripts?: unknown;
  metadata?: Record<string, unknown> | string | null;
  analysis?: {
    lead_score?: number;
    lead_category?: string;
    category?: string;
    disposition?: string;
    raw_analysis?: {
      lead_score?: number;
      lead_category?: string;
      category?: string;
      disposition?: string;
      lead_disposition?: string;
      lead_score_full?: {
        lead_score?: number;
        lead_category?: string;
      };
    };
  };
  [key: string]: unknown;
}

export interface CallLogsResponse {
  logs: CallLogResponse[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
    has_more?: boolean;
  };
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  has_more?: boolean;
}

export interface CallLead {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  company_domain?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  location?: string | null;
  status?: string | null;
  stage?: string | null;
  tags?: string[];
  notes?: string | null;
  last_contacted_at?: string | null;
  country_code?: string | null;
  base_number?: string | null;
  custom_fields?: Record<string, unknown>;
  raw_data?: unknown;
  [key: string]: unknown;
}

export interface CallLeadResponse {
  success?: boolean;
  data?: CallLead;
  lead?: CallLead;
  [key: string]: unknown;
}

export interface BatchResultItem {
  to_number?: string | null;
  status?: string | null;
  index?: number;
  lead_name?: string | null;
  context?: string | null;
  call_log_id?: string | null;
  room_name?: string | null;
  dispatch_id?: string | null;
  error?: string | null;
  batch_status?: string | null;
}

export interface BatchPayload {
  job_id: string;
  status: string;
  results: BatchResultItem[];
}

export interface BatchApiResponse {
  success: boolean;
  batch?: BatchPayload;
  result?: BatchPayload;
}

export interface CallLog {
  id: string;
  assistant: string;
  lead_id?: string;
  lead_name: string;
  type: string;
  status: string;
  startedAt: string;
  duration: number;
  cost: number;
  metadata?: Record<string, unknown> | string | null;
  outcome?: string;
  status_reason?: string;
  batch_status?: string;
  batch_id?: string;
  lead_category?: string;
  lead_score?: number;
  lead_tags?: string[];
  disposition?: string;
  signed_recording_url?: string;
  recording_url?: string;
  call_recording_url?: string;
}

export interface GetCallLogsParams {
  status?: string;
  agent_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  lead_category?: string;
  lead_tag?: string;
}

export interface EndCallParams {
  callId: string;
}

export interface RetryCallsParams {
  call_ids: string[];
}

export interface RecordingSignedUrlParams {
  callId: string;
}

export interface RecordingSignedUrlResponse {
  success: boolean;
  signed_url?: string;
  data?: {
    signed_url?: string;
  };
}

export interface CallLogsStats {
  total_calls: number;
  completed_calls: number;
  failed_calls: number;
  ongoing: number;
  queue: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
}

export interface CallLogsStreamHandle {
  close: () => void;
}
