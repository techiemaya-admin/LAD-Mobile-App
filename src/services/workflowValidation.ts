import type { WorkflowStepDef } from '@/src/services/mobileAIAssistantService';

export interface WorkflowValidationIssue {
  stepId?: string;
  message: string;
}

const isActionStep = (step: WorkflowStepDef) => ![
  'lead_generation',
  'wait_for_condition',
  'condition',
  'media_generation',
  'linkedin_post',
  'linkedin_content',
  'post_approval',
].includes(step.type);

/**
 * Sequence validation shared by the mobile canvas and campaign launch.
 * These are the same hard ordering rules used by LAD Frontend 2: a LinkedIn
 * message must follow a connection request and a lead-driven flow must contain
 * at least one step that can actually act on a lead.
 */
export function validateWorkflowSequence(
  steps: WorkflowStepDef[],
  options: { allowPublisherOnly?: boolean } = {},
): WorkflowValidationIssue | null {
  let seenConnect = false;
  for (const step of steps) {
    if (step.type === 'linkedin_connect') seenConnect = true;
    if (step.type === 'linkedin_message' && !seenConnect) {
      return {
        stepId: step.id,
        message: "Add a 'Connection request' step before 'Message' — Message only sends once a connection is accepted.",
      };
    }
  }

  const publisherOnly = options.allowPublisherOnly
    && steps.some((step) => step.type === 'linkedin_post')
    && !steps.some(isActionStep);
  if (!steps.some(isActionStep) && !publisherOnly) {
    return { message: 'Add at least one outreach step.' };
  }
  return null;
}

export function validateWorkflowStep(step: WorkflowStepDef): WorkflowValidationIssue | null {
  if (step.type === 'lead_generation') {
    const limit = Number(step.leadLimit ?? 10);
    if (!Number.isFinite(limit) || limit < 1) {
      return { stepId: step.id, message: 'Leads per day must be at least 1.' };
    }
  }
  if (step.type === 'delay') {
    const days = Number(step.delayDays ?? 0);
    const hours = Number(step.delayHours ?? 0);
    if (!Number.isFinite(days) || days < 0) {
      return { stepId: step.id, message: 'Delay days cannot be negative.' };
    }
    if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
      return { stepId: step.id, message: 'Delay hours must be between 0 and 23.' };
    }
  }
  if (step.type === 'media_generation' && step.mediaUrl) {
    try {
      const parsed = new URL(step.mediaUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL');
    } catch {
      return { stepId: step.id, message: 'Enter a valid http(s) media URL.' };
    }
  }
  return null;
}

export function validateWorkflow(steps: WorkflowStepDef[]): WorkflowValidationIssue | null {
  const sequenceIssue = validateWorkflowSequence(steps, { allowPublisherOnly: true });
  if (sequenceIssue) return sequenceIssue;
  for (const step of steps) {
    const issue = validateWorkflowStep(step);
    if (issue) return issue;
  }
  return null;
}
