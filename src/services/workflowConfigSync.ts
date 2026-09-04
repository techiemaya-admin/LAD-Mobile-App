/**
 * Two-way sync between the guided campaign-config wizard (CheckpointWizard)
 * and the Flow tab's workflow canvas — mobile port of LAD-Frontend-2's
 * `configStepsSync.ts`.
 *
 * `workflowPreview` (an ordered SyncStep[]) is the SINGLE SOURCE OF TRUTH. The
 * wizard's structural selections — channels, LinkedIn actions, and the
 * trigger condition — are DERIVED from it (`deriveConfig`), and changing a
 * wizard toggle reconciles back into it (`applyConfig`). Editing/removing a
 * step on the canvas and changing a wizard toggle both mutate the same array,
 * so either surface reflects the other in real time.
 */

export interface SyncStep {
  id: string;
  type: string;
  title: string;
  description?: string;
  channel: string;
  message?: string;
  subject?: string;
  delayDays?: number;
  delayHours?: number;
  condition?: string;
  leadLimit?: number;
  accountId?: string;
  phoneNumber?: string;
  /**
   * Explicit position in the campaign sequence, stamped by
   * `buildStepsFromConfig`/`stampSequence` to match the step's array index.
   * The Flow canvas and the campaign payload map by THIS field rather than
   * re-deriving order from array position, so it must always be kept in
   * sync — see `stampSequence` below.
   */
  sequence?: number;
}

/**
 * Re-numbers each step's explicit `sequence` field to match its final array
 * position. Every function that builds or reorders a steps array must call
 * this before returning, so downstream consumers (Flow canvas, campaign
 * payload) can map by an explicit field instead of trusting array order to
 * never get silently reshuffled upstream.
 */
export function stampSequence<T extends { sequence?: number }>(steps: T[]): T[] {
  return steps.map((step, index) => (step.sequence === index ? step : { ...step, sequence: index }));
}

export interface DerivedConfig {
  actions: string[];
  nextChannels: string[];
  triggerCondition: string;
}

const LI_ACTION_BY_TYPE: Record<string, string> = {
  linkedin_visit: 'profile_view',
  linkedin_connect: 'connect',
  linkedin_message: 'message',
  linkedin_inmail: 'inmail',
};

const CHANNEL_BY_TYPE: Record<string, string> = {
  email_send: 'email',
  whatsapp_send: 'whatsapp',
  voice_agent_call: 'voice_call',
};

const TYPE_BY_CHANNEL: Record<string, string> = {
  email: 'email_send',
  whatsapp: 'whatsapp_send',
  voice_call: 'voice_agent_call',
};

const PRESERVED_TYPES = new Set([
  'media_generation',
  'followup_sequence',
  'data_enrich',
  'ai_parse',
  'export_results',
  'linkedin_post',
  'linkedin_content',
  'post_approval',
  'zoho_update',
]);

export const TRIGGER_CONDITION_LABELS: Record<string, string> = {
  connection_accepted: 'Wait for Connection Accepted',
  message_replied: 'Wait for Message Reply',
  profile_visited: 'Wait for Profile Visit',
  email_read: 'Wait for Email Read',
  email_replied: 'Wait for Email Reply',
  wa_read: 'Wait for WhatsApp Read',
  wa_replied: 'Wait for WhatsApp Reply',
  call_completed: 'Wait for Call Completed',
  call_answered: 'Wait for Call Answered',
};

/**
 * Read the current structural config back out of the canonical steps array.
 *
 * `nextChannels` preserves the ORDER channels actually appear in `steps` —
 * 'linkedin' is recorded at the position its first action step is
 * encountered during the scan, not forced to the front. This is what lets a
 * user-picked sequence like "voice, then LinkedIn, then WhatsApp" round-trip
 * through applyConfig/buildStepsFromConfig without being silently reordered.
 */
export function deriveConfig(steps: SyncStep[] | null | undefined): DerivedConfig {
  const actions: string[] = [];
  const nextChannels: string[] = [];
  let triggerCondition = '';
  let linkedinRecorded = false;
  for (const step of steps || []) {
    if (LI_ACTION_BY_TYPE[step.type]) {
      actions.push(LI_ACTION_BY_TYPE[step.type]);
      if (!linkedinRecorded) {
        nextChannels.push('linkedin');
        linkedinRecorded = true;
      }
    } else if (CHANNEL_BY_TYPE[step.type]) {
      nextChannels.push(CHANNEL_BY_TYPE[step.type]);
    } else if (step.type === 'wait_for_condition' || step.type === 'condition') {
      triggerCondition = step.condition || '';
    }
  }
  return { actions, nextChannels, triggerCondition };
}

function makeStep(kind: string, existing?: SyncStep): SyncStep {
  if (existing) return existing;
  switch (kind) {
    case 'lead_generation':
      return { id: 'lead-gen', type: 'lead_generation', title: 'LinkedIn Lead Search', description: 'Find target leads on LinkedIn', channel: 'linkedin' };
    case 'linkedin_connect':
      return { id: 'connect', type: 'linkedin_connect', title: 'Send Connection Request', description: 'Auto-connect with leads on LinkedIn', channel: 'linkedin' };
    case 'linkedin_message':
      return { id: 'message', type: 'linkedin_message', title: 'Send Follow-up Message', description: 'Message after connection accepted', channel: 'linkedin' };
    case 'linkedin_visit':
      return { id: 'profile_view', type: 'linkedin_visit', title: 'View Profile', description: 'Visit their LinkedIn profile', channel: 'linkedin' };
    case 'wait_for_condition':
      return { id: 'condition', type: 'wait_for_condition', title: 'Wait for Condition', description: 'Trigger condition', channel: 'system' };
    case 'email_send':
      return { id: 'ch-email', type: 'email_send', title: 'Send Follow-up Email', description: 'Follow up via email', channel: 'email' };
    case 'whatsapp_send':
      return { id: 'ch-whatsapp', type: 'whatsapp_send', title: 'Send WhatsApp Message', description: 'Follow up via WhatsApp', channel: 'whatsapp' };
    case 'voice_agent_call':
      return { id: 'ch-voice_call', type: 'voice_agent_call', title: 'AI Voice Call', description: 'Follow up via voice call', channel: 'voice' };
    case 'media_generation':
      return { id: 'media-gen', type: 'media_generation', title: 'AI Media', description: 'Generate brand media to attach to outreach', channel: 'media' };
    default:
      return { id: `${kind}-${Math.random().toString(36).slice(2, 8)}`, type: kind, title: kind, channel: 'system' };
  }
}

/**
 * Rebuild the canonical steps array for a target structural config, preserving
 * every existing step's per-step content (message/delay/condition/id) by
 * matching on type.
 *
 * Order: lead_generation (if included) first, then each entry of
 * `cfg.nextChannels` IN THE ORDER GIVEN — 'linkedin' expands to its action
 * sub-steps (visit/connect/message) plus the trigger-condition step, other
 * channels expand to their single step. `cfg.nextChannels` is itself
 * order-preserving (built by `deriveConfig` from scan position, or passed
 * straight through from the wizard's own click order in the store), so a
 * user-picked sequence like "voice, then LinkedIn, then WhatsApp" is never
 * regrouped or sorted — it round-trips exactly. Each returned step carries an
 * explicit `sequence` field matching its final position (see `stampSequence`)
 * for consumers that map by that field instead of trusting array order.
 */
export function buildStepsFromConfig(
  cfg: DerivedConfig,
  existing: SyncStep[] = [],
  opts: { includeLeadSource?: boolean } = {},
): SyncStep[] {
  const byType = new Map<string, SyncStep>();
  for (const step of existing) if (!byType.has(step.type)) byType.set(step.type, step);
  const take = (type: string) => makeStep(type, byType.get(type));

  const liSelected = cfg.nextChannels.includes('linkedin');
  const out: SyncStep[] = [];

  if (opts.includeLeadSource !== false) {
    const leadGen = take('lead_generation');
    if (!liSelected) {
      leadGen.title = 'Find Leads';
      leadGen.description = 'Discover target leads via LinkedIn search';
    }
    out.push(leadGen);
  }

  const liActions = !liSelected ? [] : (cfg.actions.length > 0 ? cfg.actions : ['profile_view']);
  // The trigger condition gates the hand-off from the FIRST selected channel's
  // block to whatever comes after it, so it is inserted right after that
  // block wherever it actually lands — not hardcoded to always follow
  // LinkedIn.
  const firstChannel = cfg.nextChannels[0];

  cfg.nextChannels.forEach((channel) => {
    if (channel === 'linkedin') {
      if (liActions.includes('profile_view')) out.push(take('linkedin_visit'));
      if (liActions.includes('connect')) out.push(take('linkedin_connect'));
      if (liActions.includes('message')) out.push(take('linkedin_message'));
    } else {
      const type = TYPE_BY_CHANNEL[channel];
      if (type) out.push(take(type));
    }
    if (cfg.triggerCondition && channel === firstChannel && cfg.nextChannels.length > 1) {
      const cond = take('wait_for_condition');
      cond.condition = cfg.triggerCondition;
      cond.title = TRIGGER_CONDITION_LABELS[cfg.triggerCondition] || 'Wait for Condition';
      out.push(cond);
    }
  });

  existing.forEach((step, index) => {
    if (PRESERVED_TYPES.has(step.type)) out.splice(Math.min(index, out.length), 0, step);
  });

  return stampSequence(out);
}

/** Merge a partial structural change and rebuild the steps. */
export function applyConfig(
  steps: SyncStep[],
  patch: Partial<DerivedConfig>,
  opts: { includeLeadSource?: boolean } = {},
): SyncStep[] {
  const merged = { ...deriveConfig(steps), ...patch };
  return buildStepsFromConfig(merged, steps, opts);
}
