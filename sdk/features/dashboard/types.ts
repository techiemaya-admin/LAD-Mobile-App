/**
 * Dashboard Feature Types
 * Interfaces for users, bookings, calendar events, and call logs
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Booking {
  id: string;
  tenant_id: string;
  lead_id: string;
  assigned_user_id: string;
  booking_type: string;
  booking_source: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  call_result: string | null;
  retry_count: number;
  parent_booking_id: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  buffer_until: string;
  task_name: string | null;
  task_scheduled_at: string | null;
  task_status: string;
  executed_at: string | null;
  execution_attempts: number;
  last_execution_error: string | null;
  idempotency_key: string | null;
}

export interface CallLog {
  id: string;
  tenant_id: string;
  call_id: string;
  lead_id: string;
  agent_id: string;
  assigned_user_id: string;
  phone_number: string;
  call_type: string;
  direction: 'inbound' | 'outbound';
  status: string;
  start_time: string;
  end_time: string | null;
  duration: number;
  recording_url: string | null;
  transcript: string | null;
  call_notes: string | null;
  outcome: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface DashboardUsersResponse {
  users: User[];
}

export interface DashboardBookingsResponse {
  bookings: Booking[];
}

export interface DashboardCallsResponse {
  calls: CallLog[];
  total?: number;
  page?: number;
  limit?: number;
}

export type BookingType = 'auto_followup' | 'scheduled_call' | 'meeting' | 'ai_task';
export type BookingStatus = 'scheduled' | 'completed' | 'cancelled' | 'pending';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'completed' | 'failed' | 'no_answer' | 'busy' | 'cancelled' | 'in_progress';
