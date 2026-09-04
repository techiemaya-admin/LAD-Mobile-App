/**
 * Campaign live-activity step progression — mirrors LAD-Frontend-2's
 * LiveActivityTable.tsx (buildWorkflowSteps / groupedLeads fold /
 * calculateCurrentStep). Pure data transforms, no network calls — feeds the
 * mobile "Campaign Accelerator" stepper on app/campaigns/[id].tsx.
 *
 * This is what makes the stepper actually resolve past "Wait for Profile
 * Visit": each lead's step position is re-derived from the campaign's raw
 * activity feed on every poll, not tracked as separate persisted state.
 */
import type { CampaignActivityRow } from './settingsHub';

export interface WorkflowStepDisplay {
  /** 1-based — matches calculateCurrentStep's step-id convention. */
  id: number;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

/** Step types that are pure flow-control / source nodes, never shown as a milestone. */
const SKIP_STEP_TYPES = new Set(['delay', 'lead_generation', 'start', 'end']);

const STEP_TYPE_LABEL: Record<string, string> = {
  lead_generation: 'Lead Gen',
  linkedin_visit: 'Visit',
  linkedin_connect: 'Connect',
  linkedin_message: 'Message',
  linkedin_follow: 'Follow',
  wait_for_condition: 'Accepted',
  delay: 'Delay',
  voice_agent_call: 'Voice Call',
  voice_call: 'Voice Call',
  call: 'Call',
  email_send: 'Email',
  email: 'Email',
  whatsapp_send: 'WhatsApp',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const asConfig = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
};

export function buildDisplaySteps(
  rawSteps: { type: string; title?: string; order?: number; config?: unknown }[],
): WorkflowStepDisplay[] {
  return rawSteps
    .filter((step) => {
      const type = (step.type || '').toLowerCase();
      if (!type || SKIP_STEP_TYPES.has(type)) return false;
      // Skip the internal PROFILE_VISITED gate — it fires immediately after
      // linkedin_visit and would otherwise show as a confusing duplicate step.
      if (type === 'wait_for_condition' && asConfig(step.config).action_type === 'PROFILE_VISITED') {
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((step, index) => {
      const type = step.type.toLowerCase();
      return {
        id: index + 1,
        type,
        config: asConfig(step.config),
        label: step.title || STEP_TYPE_LABEL[type] || titleCase(type),
      };
    });
}

export interface GroupedLeadStatus {
  leadId: string;
  leadName: string;
  leadLinkedin?: string;
  leadPhone?: string;
  platform: string;
  latestTimestamp: string;
  latestStatus?: string;
  latestMessage?: string;
  profileVisited: boolean;
  connectionStatus: 'NOT_SENT' | 'SENT' | 'FAILED' | 'PAUSED' | 'WITHDRAWN';
  connectionAccepted: boolean;
  contacted: boolean;
  contactedStatus?: 'SENT' | 'FAILED';
  callMade: boolean;
  whatsappSent: boolean;
  leadReplied: boolean;
  errorMessage?: string;
}

/** Folds a campaign's raw activity feed into one status row per lead. */
export function groupActivitiesByLead(activities: CampaignActivityRow[]): GroupedLeadStatus[] {
  const leadMap = new Map<string, GroupedLeadStatus>();

  for (const activity of activities) {
    const leadId = activity.lead_id || activity.id;
    if (!leadId) continue;

    let lead = leadMap.get(leadId);
    if (!lead) {
      lead = {
        leadId,
        leadName: activity.lead_name || 'Unknown Lead',
        leadLinkedin: activity.lead_linkedin,
        leadPhone: activity.lead_phone,
        platform: activity.platform || 'linkedin',
        latestTimestamp: activity.created_at,
        profileVisited: false,
        connectionStatus: 'NOT_SENT',
        connectionAccepted: false,
        contacted: false,
        callMade: false,
        whatsappSent: false,
        leadReplied: false,
      };
      leadMap.set(leadId, lead);
    }

    if (activity.platform && !lead.platform) lead.platform = activity.platform;
    if (new Date(activity.created_at) > new Date(lead.latestTimestamp)) {
      lead.latestTimestamp = activity.created_at;
      lead.latestStatus = activity.status;
      lead.latestMessage = activity.message_content || activity.error_message;
    }

    const actionType = (activity.action_type || '').toUpperCase();
    const status = (activity.status || '').toLowerCase();
    const isOk = status === 'success' || status === 'sent' || status === 'delivered';
    const errorMsg = activity.error_message || '';

    if (actionType.includes('PROFILE') && actionType.includes('VISIT') && isOk) {
      lead.profileVisited = true;
    }

    if (actionType.includes('CONNECTION') && actionType.includes('WITHDRAW')) {
      lead.connectionStatus = 'WITHDRAWN';
    } else if (actionType.includes('CONNECTION')) {
      const isRateLimit = /limit|rate/i.test(errorMsg);
      if (isRateLimit) {
        lead.connectionStatus = 'PAUSED';
        lead.errorMessage = errorMsg;
      } else if (status === 'failed' || status === 'error') {
        lead.connectionStatus = 'FAILED';
        lead.errorMessage = errorMsg;
      } else if (isOk) {
        lead.profileVisited = true;
        lead.connectionStatus = 'SENT';
      }
      if (actionType.includes('ACCEPT')) {
        lead.connectionAccepted = true;
      }
    }

    if (actionType.includes('CONTACT') || actionType.includes('MESSAGE_SENT')) {
      if (isOk) {
        lead.contacted = true;
        lead.contactedStatus = 'SENT';
      } else if (status === 'failed' || status === 'error') {
        lead.contactedStatus = 'FAILED';
        lead.errorMessage = errorMsg;
      }
    }

    if (
      (actionType.includes('VOICE_CALL') || actionType.includes('CALL_MADE') || actionType.includes('CALL_INITIATED') || actionType === 'CALL')
      && isOk
    ) {
      lead.callMade = true;
    }

    if (actionType.includes('WHATSAPP') && (isOk || status === 'completed')) {
      lead.whatsappSent = true;
    }

    if (actionType.includes('REPLY')) {
      lead.leadReplied = true;
      lead.connectionAccepted = true;
      lead.contacted = true;
    }
  }

  return Array.from(leadMap.values());
}

const STEP_DONE: Record<string, (lead: GroupedLeadStatus) => boolean> = {
  linkedin_visit: (lead) => lead.profileVisited,
  linkedin_connect: (lead) => lead.connectionStatus === 'SENT',
  linkedin_message: (lead) => lead.contacted,
  voice_agent_call: (lead) => lead.callMade,
  voice_call: (lead) => lead.callMade,
  call: (lead) => lead.callMade,
  email_send: (lead) => lead.contacted,
  email: (lead) => lead.contacted,
  whatsapp_send: (lead) => lead.whatsappSent,
  whatsapp: (lead) => lead.whatsappSent,
  sms: (lead) => lead.contacted,
  reply: (lead) => lead.leadReplied,
};

/** Returns the 1-based id of the ACTIVE step for a lead, or steps.length + 1 when all are done. */
export function calculateCurrentStep(lead: GroupedLeadStatus, steps: WorkflowStepDisplay[]): number {
  if (!steps.length) return 1;

  let lastDoneIdx = -1;
  steps.forEach((step, idx) => {
    let isDone: boolean;
    if (step.type === 'wait_for_condition') {
      const actionType = String(step.config.action_type || 'CONNECTION_ACCEPTED');
      if (actionType === 'PROFILE_VISITED') isDone = lead.profileVisited;
      else if (actionType === 'CONNECTION_ACCEPTED') isDone = lead.connectionAccepted;
      else if (actionType === 'REPLY_RECEIVED') isDone = lead.leadReplied;
      else isDone = lead.connectionAccepted;
    } else {
      isDone = STEP_DONE[step.type]?.(lead) ?? false;
    }
    if (isDone) lastDoneIdx = idx;
  });

  const activeIdx = lastDoneIdx + 1;
  if (activeIdx >= steps.length) return steps.length + 1;
  return steps[activeIdx].id;
}
