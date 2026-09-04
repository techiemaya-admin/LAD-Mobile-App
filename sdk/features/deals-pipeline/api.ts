// Deals Pipeline SDK API Layer
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPatch,
} from "../../shared/apiClient";
import { apiClient } from "../../shared/apiClient";
import { safeStorage } from "../../shared/storage";
import type {
  Lead,
  LeadFilters,
  CreateLeadParams,
  UpdateLeadParams,
  MoveLeadParams,
  UpdateLeadStatusParams,
  Stage,
  CreateStageParams,
  UpdateStageParams,
  ReorderStagesParams,
  PipelineData,
  PaginatedLeads,
  PipelineStats,
  Note,
  CreateNoteParams,
  UpdateNoteParams,
  DeleteNoteParams,
  Comment,
  CreateCommentParams,
  UpdateCommentParams,
  DeleteCommentParams,
  Attachment,
  UploadAttachmentParams,
  DeleteAttachmentParams,
  Tag,
  CreateTagParams,
  Activity,
  StatusOption,
  PriorityOption,
  SourceOption,
  AssignLeadsParams,
} from "./types";

// ============================================================================
// LEAD API FUNCTIONS
// ============================================================================

/**
 * Get all leads with optional filters
 */
export async function getLeads(filters?: LeadFilters): Promise<Lead[]> {
  const query = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.append(key, String(value));
      }
    });
  }
  const queryString = query.toString();
  const url = queryString
    ? `/api/deals-pipeline/leads?${queryString}`
    : "/api/deals-pipeline/leads";
  const response = await apiGet<Lead[]>(url);
  return response.data;
}

/**
 * Get leads with pagination
 */
export async function getPaginatedLeads(
  filters?: LeadFilters
): Promise<PaginatedLeads> {
  const query = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.append(key, String(value));
      }
    });
  }
  const queryString = query.toString();
  const url = queryString
    ? `/api/deals-pipeline/leads?${queryString}`
    : "/api/deals-pipeline/leads";
  const response = await apiGet<PaginatedLeads>(url);
  return response.data;
}

/**
 * Get a single lead by ID
 */
export async function getLeadById(id: string | number): Promise<Lead> {
  const response = await apiGet<Lead>(`/api/deals-pipeline/leads/${id}`);
  return response.data;
}

/**
 * Create a new lead
 */
export async function createLead(leadData: CreateLeadParams): Promise<Lead> {
  const response = await apiPost<Lead>("/api/deals-pipeline/leads", leadData);
  return response.data;
}

/**
 * Update an existing lead
 */
export async function updateLead(
  id: string | number,
  leadData: Omit<UpdateLeadParams, "id"> | Partial<Lead>
): Promise<Lead> {
  const response = await apiPut<Lead>(
    `/api/deals-pipeline/leads/${id}`,
    leadData
  );
  return response.data;
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string | number): Promise<void> {
  await apiDelete(`/api/deals-pipeline/leads/${id}`);
}

/**
 * Get leads with conversation data for assignment
 */
export async function getLeadsWithConversations(): Promise<Lead[]> {
  try {
    const response = await apiGet<Lead[]>(
      "/api/deals-pipeline/with-conversations"
    );
    return response.data;
  } catch (error) {
    // Fallback to basic leads if the specific endpoint is not available
    return getLeads();
  }
}

/**
 * Get leads by stage
 */
export async function getLeadsByStage(
  stageId: string | number
): Promise<Lead[]> {
  const response = await apiGet<Lead[]>(
    `/api/deals-pipeline/leads?stageId=${stageId}`
  );
  return response.data;
}

/**
 * Assign leads to a user
 */
export async function assignLeadsToUser(
  params: AssignLeadsParams
): Promise<unknown> {
  const response = await apiPut<unknown>("/api/deals-pipeline/assign-to-user", {
    userId: params.userId,
    leadIds: params.leadIds,
  });
  return response.data;
}

// ============================================================================
// STAGE API FUNCTIONS
// ============================================================================

/**
 * Get all pipeline stages
 */
export async function getStages(): Promise<Stage[]> {
  const response = await apiGet<Stage[]>("/api/deals-pipeline/stages");
  return response.data;
}

/**
 * Create a new stage
 */
export async function createStage(
  name: string,
  positionStageId: string | null = null,
  positionType: "before" | "after" = "after"
): Promise<Stage> {
  // Generate a key from the name
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 50); // Limit length

  const stageData: Partial<Stage> & { displayOrder?: number } = {
    key,
    label: name,
  };

  // Handle positioning if reference stage provided
  if (positionStageId) {
    const stages = await getStages();
    const referenceStage = stages.find(
      (s) => (s as { id?: string }).id === positionStageId || s.key === positionStageId
    );
    if (referenceStage) {
      const referenceOrder =
        referenceStage.order || referenceStage.display_order || 0;
      stageData.displayOrder =
        positionType === "before" ? referenceOrder : referenceOrder + 1;
    }
  } else {
    // Add at the end if no position specified
    const stages = await getStages();
    const maxOrder = Math.max(
      ...stages.map((s) => s.order || s.display_order || 0),
      0
    );
    stageData.displayOrder = maxOrder + 1;
  }

  const response = await apiPost<Stage>("/api/deals-pipeline/stages", stageData);
  return response.data;
}

/**
 * Update a stage
 */
export async function updateStage(
  stageKey: string,
  updates: UpdateStageParams | string
): Promise<Stage> {
  const updateData: Partial<Stage> =
    typeof updates === "string" ? { label: updates } : updates;
  const response = await apiPut<Stage>(
    `/api/deals-pipeline/stages/${stageKey}`,
    updateData
  );
  return response.data;
}

/**
 * Delete a stage
 */
export async function deleteStage(stageKey: string): Promise<void> {
  await apiDelete(`/api/deals-pipeline/stages/${stageKey}`);
}

/**
 * Reorder stages
 */
export async function reorderStages(
  stageOrders: ReorderStagesParams["stageOrders"]
): Promise<void> {
  await apiPut("/api/deals-pipeline/stages/reorder", { stageOrders });
}

// ============================================================================
// PIPELINE BOARD API FUNCTIONS
// ============================================================================

/**
 * Get complete pipeline board data (stages + leads)
 */
export async function getPipelineData(page: number = 1, limit: number = 50): Promise<PipelineData> {
  const response = await apiGet<PipelineData>("/api/deals-pipeline/pipeline/board", {
    params: { page, limit }
  });
  const data = response.data;

  // Normalize leads
  if (Array.isArray(data.leads)) {
    data.leads = data.leads.map((rawLead: any) => {
      const firstName = rawLead.first_name || rawLead.firstName || "";
      const lastName = rawLead.last_name || rawLead.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      let stage = rawLead.stage;
      if (typeof stage === "string") {
        stage = stage.toLowerCase();
      }
      return {
        ...rawLead,
        name: rawLead.name || fullName || undefined,
        stage,
      } as Lead;
    });
  }

  return data;
}

/**
 * Get pipeline overview/statistics
 */
export async function getPipelineStats(filters?: LeadFilters): Promise<PipelineStats> {
  const query = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.append(key, String(value));
      }
    });
  }
  const queryString = query.toString();
  const url = queryString
    ? `/api/deals-pipeline/pipeline/stats?${queryString}`
    : "/api/deals-pipeline/pipeline/stats";
    
  const response = await apiGet<any>(url);
  const data = response.data;

  // Normalize stats (handle both snake_case and camelCase from backend)
  return {
    total_leads: data.total_leads ?? data.totalLeads ?? 0,
    total_value: data.total_value ?? data.totalValue ?? 0,
    leads_by_stage: data.leads_by_stage ?? data.leadsByStage ?? {},
    value_by_stage: data.value_by_stage ?? data.valueByStage ?? {},
    ...data
  } as PipelineStats;
}

/**
 * Move lead to a different stage
 */
export async function moveLeadToStage(
  leadId: string | number,
  newStageKey: string
): Promise<Lead> {
  const response = await apiPut<Lead>(
    `/api/deals-pipeline/pipeline/leads/${leadId}/stage`,
    {
      stageKey: newStageKey,
      stage: newStageKey,
    }
  );
  return response.data;
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  leadId: string | number,
  status: string
): Promise<Lead> {
  try {
    const response = await apiPut<Lead>(
      `/api/deals-pipeline/pipeline/leads/${leadId}/status`,
      { status }
    );
    return response.data;
  } catch (error: any) {
    const message = String(
      error?.response?.data?.error || error?.response?.data?.message || ""
    );
    if (message.toLowerCase().includes("statuskey")) {
      const retry = await apiPut<Lead>(
        `/api/deals-pipeline/pipeline/leads/${leadId}/status`,
        { statusKey: status, status }
      );
      return retry.data;
    }
    throw error;
  }
}

// ============================================================================
// NOTE API FUNCTIONS
// ============================================================================

/**
 * Get all notes for a lead
 */
export async function getLeadNotes(leadId: string | number): Promise<Note[]> {
  const response = await apiGet<Note[]>(
    `/api/deals-pipeline/leads/${leadId}/notes`
  );
  return response.data;
}

/**
 * Add a note to a lead
 */
export async function addLeadNote(
  leadId: string | number,
  content: string
): Promise<Note> {
  const response = await apiPost<Note>(
    `/api/deals-pipeline/leads/${leadId}/notes`,
    { content }
  );
  return response.data;
}

/**
 * Update a note
 */
export async function updateLeadNote(
  leadId: string | number,
  noteId: string | number,
  content: string
): Promise<Note> {
  const response = await apiPut<Note>(
    `/api/deals-pipeline/leads/${leadId}/notes/${noteId}`,
    { content }
  );
  return response.data;
}

/**
 * Delete a note
 */
export async function deleteLeadNote(
  leadId: string | number,
  noteId: string | number
): Promise<void> {
  await apiDelete(`/api/deals-pipeline/leads/${leadId}/notes/${noteId}`);
}

// ============================================================================
// COMMENT API FUNCTIONS
// ============================================================================

/**
 * Get all comments for a lead
 */
export async function getLeadComments(leadId: string | number): Promise<Comment[]> {
  const response = await apiGet<Comment[]>(
    `/api/deals-pipeline/leads/${leadId}/comments`
  );
  return response.data;
}

/**
 * Add a comment to a lead
 */
export async function addLeadComment(
  leadId: string | number,
  content: string
): Promise<Comment> {
  const response = await apiPost<Comment>(
    `/api/deals-pipeline/leads/${leadId}/comments`,
    { content }
  );
  return response.data;
}

/**
 * Update a comment
 */
export async function updateLeadComment(
  leadId: string | number,
  commentId: string | number,
  content: string
): Promise<Comment> {
  const response = await apiPut<Comment>(
    `/api/deals-pipeline/leads/${leadId}/comments/${commentId}`,
    { content }
  );
  return response.data;
}

/**
 * Delete a comment
 */
export async function deleteLeadComment(
  leadId: string | number,
  commentId: string | number
): Promise<void> {
  await apiDelete(`/api/deals-pipeline/leads/${leadId}/comments/${commentId}`);
}

// ============================================================================
// ATTACHMENT API FUNCTIONS
// ============================================================================

/**
 * Get all attachments for a lead
 */
export async function getLeadAttachments(
  leadId: string | number
): Promise<Attachment[]> {
  const response = await apiGet<Attachment[]>(
    `/api/deals-pipeline/leads/${leadId}/attachments`
  );
  return response.data;
}

/**
 * Upload an attachment for a lead
 */
export async function uploadLeadAttachment(
  leadId: string | number,
  file: File
): Promise<Attachment> {
  // For file uploads, we need FormData.
  // Use apiClient baseURL + auth token to keep behavior consistent with other SDK calls.
  const formData = new FormData();
  formData.append("file", file);

  const token = typeof window !== "undefined" ? safeStorage.getItem("token") : null;

  const url = new URL(
    `/api/deals-pipeline/leads/${leadId}/attachments`,
    apiClient.getBaseURL()
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete an attachment
 */
export async function deleteLeadAttachment(
  leadId: string | number,
  attachmentId: string | number
): Promise<void> {
  await apiDelete(
    `/api/deals-pipeline/leads/${leadId}/attachments/${attachmentId}`
  );
}

// ============================================================================
// TAG API FUNCTIONS
// ============================================================================

/**
 * Get all tags for a lead
 */
export async function getLeadTags(leadId: string | number): Promise<Tag[]> {
  const response = await apiGet<Tag[]>(
    `/api/deals-pipeline/leads/${leadId}/tags`
  );
  return response.data;
}

/**
 * Add a tag to a lead
 */
export async function addTagToLead(
  leadId: string | number,
  tagData: { name: string; color?: string }
): Promise<Tag> {
  const response = await apiPost<Tag>(
    `/api/deals-pipeline/leads/${leadId}/tags`,
    tagData
  );
  return response.data;
}

// ============================================================================
// ACTIVITY API FUNCTIONS
// ============================================================================

/**
 * Get activity for a lead
 */
export async function getLeadActivities(
  leadId: string | number
): Promise<Activity[]> {
  const response = await apiGet<Activity[]>(
    `/api/deals-pipeline/leads/${leadId}/activities`
  );
  return response.data;
}

// ============================================================================
// REFERENCE DATA API FUNCTIONS
// ============================================================================

/**
 * Get all statuses for dropdowns
 */
export async function getStatuses(): Promise<StatusOption[]> {
  const response = await apiGet<StatusOption[]>(
    "/api/deals-pipeline/reference/statuses"
  );
  return response.data;
}

/**
 * Get all sources for dropdowns
 */
export async function getSources(): Promise<SourceOption[]> {
  const response = await apiGet<SourceOption[]>(
    "/api/deals-pipeline/reference/sources"
  );
  return response.data;
}

/**
 * Get all priorities for dropdowns
 */
export async function getPriorities(): Promise<PriorityOption[]> {
  const response = await apiGet<PriorityOption[]>(
    "/api/deals-pipeline/reference/priorities"
  );
  return response.data;
}

// ============================================================================
// BACKWARD-COMPATIBLE ALIASES (web/services -> sdk migration)
// ============================================================================

// Pipeline board
export const fetchPipelineData = getPipelineData;
export const fetchPipelineOverview = getPipelineStats;
export const fetchDealsPipelineBoard = getPipelineData;
export const fetchPipelineBoard = getPipelineData;

// Leads
export const fetchLeads = getLeads;
export const updateLeadStage = moveLeadToStage;

// Stages
export const fetchStages = getStages;
export const addStage = createStage;

// Reference data
export const fetchStatuses = getStatuses;
export const fetchSources = getSources;
export const fetchPriorities = getPriorities;
