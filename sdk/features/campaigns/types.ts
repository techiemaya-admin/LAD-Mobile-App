/**
 * Campaigns Feature - TypeScript Types
 * 
 * All type definitions for the campaigns feature.
 * These types are shared between SDK and web layers.
 */
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'stopped';
export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  campaign_type?: string;
  leads_count: number;
  sent_count: number;
  delivered_count: number;
  connected_count: number;
  replied_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  total_credits_deducted?: number;
  last_credit_update?: string | null;
  steps?: Array<{ type: string; [key: string]: any }>;
}
export interface CampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  total_leads: number;
  total_sent: number;
  total_delivered: number;
  total_connected: number;
  total_replied: number;
  avg_connection_rate: number;
  avg_reply_rate: number;
  instagram_connection_rate?: number;
  whatsapp_connection_rate?: number;
  voice_agent_connection_rate?: number;
}
export interface CampaignFilters {
  search?: string;
  status?: CampaignStatus | 'all';
}
export interface CreateCampaignRequest {
  name: string;
  status?: CampaignStatus;
  steps?: Array<{ type: string; [key: string]: any }>;
}
export interface UpdateCampaignRequest {
  name?: string;
  status?: CampaignStatus;
  steps?: Array<{ type: string; [key: string]: any }>;
}
export interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  };
  overview: {
    total_leads: number;
    active_leads: number;
    completed_leads: number;
    stopped_leads: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    connected: number;
    replied: number;
  };
  metrics: {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    connection_rate: number;
    reply_rate: number;
    // Step-specific metrics
    leads_generated?: number;
    connection_requests_sent?: number;
    connection_requests_accepted?: number;
    linkedin_messages_sent?: number;
    linkedin_messages_replied?: number;
    voice_calls_made?: number;
    voice_calls_answered?: number;
    emails_sent?: number;
    emails_opened?: number;
    whatsapp_messages_sent?: number;
    whatsapp_messages_replied?: number;
    errors?: number;
  };
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    connected: number;
    replied: number;
  }>;
  step_analytics?: Array<{
    id: string;
    type: string;
    title: string;
    order: number;
    total_executions: number;
    sent: number;
    delivered: number;
    connected: number;
    replied: number;
    errors: number;
  }>;
}
export interface CampaignLead {
  id: string;
  campaign_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  enriched_email?: string | null;
  enriched_linkedin_url?: string | null;
  photo_url?: string;
  status: string;
  connected: boolean;
  replied: boolean;
  is_inbound?: boolean;
  lead_data?: any;
  profile_summary?: string;
  created_at: string;
  updated_at: string;
}
