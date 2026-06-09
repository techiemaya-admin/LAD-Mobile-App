export type VoiceAgentTargetType = "company" | "employee";

export interface UserAvailableNumber {
  id: string;
  phone_number: string;
  provider?: string;
  type?: string;
  status?: string;
  label?: string;
  assignedAgentId?: string;
}

export interface UserAvailableAgent {
  agent_id?: string;
  id?: string;
  agent_name?: string;
  name?: string;
  agent_language?: string;
  language?: string;
  accent?: string;
  gender?: string;
  provider?: string;
  description?: string;
  voice_sample_url?: string | null;
}

export interface ResolvePhonesRow {
  phone?: string;
  name?: string;
  employee_name?: string;
  company_name?: string;
  requested_id?: string;
  sales_summary?: string;
  company_sales_summary?: string;
  raw?: unknown;
  company?: {
    sales_summary?: string;
  };
  employee?: {
    company_sales_summary?: string;
  };
}

export type ResolvePhonesResponse = ResolvePhonesRow[];

export interface MakeCallRequest {
  voiceAgentId: string;
  phoneNumber: string;
  context?: string;
  fromNumber?: string;
}

export interface MakeCallResponse {
  success?: boolean;
  call_id?: string;
  id?: string;
  message?: string;
  [key: string]: unknown;
}

export interface BatchCallEntry {
  to_number: string;
  lead_name?: string;
  added_context?: string;
  lead_id?: string;
  knowledge_base_store_ids?: string[];
}

export interface TriggerBatchCallRequest {
  voice_id: string;
  agent_id: string;
  from_number: string;
  added_context?: string;
  entries: BatchCallEntry[];
  initiated_by?: string;
}

export interface TriggerBatchCallResponse {
  success?: boolean;
  job_id?: string;
  batch?: {
    job_id?: string;
  };
  result?: {
    job_id?: string;
  };
  [key: string]: unknown;
}

export interface UpdateSummaryRequest {
  type: VoiceAgentTargetType;
  company_data_id?: string;
  employee_data_id?: string;
  name?: string;
  summary?: string;
  sales_summary?: string;
  company_sales_summary?: string;
}

export interface UpdateSummaryResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}
