// Deals Pipeline SDK Types
// Type definitions for leads, stages, and pipeline management

// ============================================================================
// LEAD TYPES
// ============================================================================

export interface Lead {
  id: string | number;
  name?: string | null;
  company_name: string;
  company?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  stage: string;
  status: string;
  priority?: string | null;
  source?: string | null;
  value?: number | null;
  amount?: number | null;
  probability?: number | null;
  assigned_to?: string | number | null;
  assigned_to_id?: string | number | null;
  assignee?: string | number | null;
  organization_id: string | number;
  created_at: string;
  updated_at: string;
  last_contacted?: string | null;
  next_followup?: string | null;
  notes?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  goals?: string[] | string | null;
  metadata?: Record<string, any>;
  is_deleted?: boolean;
  avatar?: string | null;
  // Additional fields
  deal_size?: number | null;
  expected_close_date?: string | null;
  expectedCloseDate?: string | null;
  close_date?: string | null;
  closeDate?: string | null;
  lead_score?: number | null;
  industry?: string | null;
  company_size?: string | null;
  website?: string | null;
  linkedin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  // Index signature for flexible field access
  [key: string]: any;
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  [key: string]: string | number | null | undefined;
}

export interface CreateLeadParams {
  company_name?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: string | null;
  status?: string | null;
  priority?: string | null;
  source?: string | null;
  value?: number | null;
  assigned_to?: string | number | null;
  notes?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  [key: string]: any;
}

export interface UpdateLeadParams {
  id?: string | number;
  company_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: string | null;
  status?: string | null;
  priority?: string | null;
  source?: string | null;
  value?: number | null;
  assigned_to?: string | number | null;
  notes?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  [key: string]: any;
}

export interface MoveLeadParams {
  leadId: string | number;
  stageKey: string;
}

export interface UpdateLeadStatusParams {
  leadId: string | number;
  status: string;
}

// ============================================================================
// STAGE TYPES
// ============================================================================

export interface Stage {
  id?: string | number;
  key: string;
  label: string;
  order?: number;
  display_order?: number;
  color?: string | null;
  probability?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface CreateStageParams {
  key?: string;
  label: string;
  order?: number;
  displayOrder?: number;
  color?: string;
  probability?: number;
}

export interface UpdateStageParams {
  key?: string;
  label?: string;
  order?: number;
  display_order?: number;
  color?: string;
  probability?: number;
  is_active?: boolean;
  [key: string]: any;
}

export interface ReorderStageItem {
  key: string;
  order: number;
}

export interface ReorderStagesParams {
  stageOrders: ReorderStageItem[];
}

export interface StagePositionParams {
  positionStageId: string | null;
  positionType: 'before' | 'after';
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

export interface PipelineData {
  leads: Lead[];
  stages: Stage[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  [key: string]: unknown;
}

export interface PaginatedLeads {
  leads: Lead[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PipelineStats {
  total_leads: number;
  total_value: number;
  leads_by_stage: Record<string, number>;
  value_by_stage: Record<string, number>;
  [key: string]: unknown;
}

// ============================================================================
// NOTE TYPES
// ============================================================================

export interface Note {
  id: string | number;
  lead_id: string | number;
  content: string;
  created_by?: string | number | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateNoteParams {
  leadId: string | number;
  content: string;
}

export interface UpdateNoteParams {
  leadId: string | number;
  noteId: string | number;
  content: string;
}

export interface DeleteNoteParams {
  leadId: string | number;
  noteId: string | number;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Comment {
  id: string | number;
  lead_id: string | number;
  content: string;
  created_by?: string | number | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateCommentParams {
  leadId: string | number;
  content: string;
}

export interface UpdateCommentParams {
  leadId: string | number;
  commentId: string | number;
  content: string;
}

export interface DeleteCommentParams {
  leadId: string | number;
  commentId: string | number;
}

// ============================================================================
// ATTACHMENT TYPES
// ============================================================================

export interface Attachment {
  id: string | number;
  lead_id: string | number;
  filename: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  created_by?: string | number | null;
  created_at: string;
}

export interface UploadAttachmentParams {
  leadId: string | number;
  file: File;
}

export interface DeleteAttachmentParams {
  leadId: string | number;
  attachmentId: string | number;
}

// ============================================================================
// TAG TYPES
// ============================================================================

export interface Tag {
  id: string | number;
  name: string;
  color?: string | null;
  created_at?: string;
}

export interface CreateTagParams {
  leadId: string | number;
  name: string;
  color?: string;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface Activity {
  id: string | number;
  lead_id: string | number;
  type: 'call' | 'email' | 'meeting' | 'note' | 'status_change' | 'stage_change';
  description: string;
  created_by?: string | number | null;
  created_at: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// REFERENCE DATA TYPES
// ============================================================================

export interface StatusOption {
  key: string;
  label: string;
  color?: string | null;
  order?: number;
  [key: string]: any;
}

export interface PriorityOption {
  key: string;
  label: string;
  color?: string | null;
  order?: number;
  [key: string]: any;
}

export interface SourceOption {
  key: string;
  label: string;
  order?: number;
  [key: string]: any;
}

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

export interface AssignLeadsParams {
  userId: string;
  leadIds: (string | number)[];
}
