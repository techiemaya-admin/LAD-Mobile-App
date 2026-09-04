import { Platform } from 'react-native';
import { apiPost } from '@/src/api';
import { deriveConfig, stampSequence } from '@/src/services/workflowConfigSync';
import type { WorkflowTemplate } from '@/src/services/workflowAccelerators';
import { SOURCE_STEP_ID, templateNodeKey } from '@/src/services/workflowAccelerators';

export interface LeadTargeting {
  job_titles?: string[];
  industries?: string[];
  locations?: string[];
  keywords?: string[];
  profile_language?: string[];
  functions?: string[];
  seniority?: string[];
  company_headcount?: string[];
  company_names?: string[];
  decision_maker_nationality?: string[];
  decision_maker_experience_level?: string[];
  company_size?: string[];
  company_age?: string[];
  decision_maker_education?: string[];
  decision_maker_skills?: string[];
  posted_recently?: boolean;
  nationality_filter?: string[];
}

export interface MobileAssistantLead {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  company?: string;
  profileUrl?: string;
  profilePicture?: string;
  industry?: string;
  phone?: string;
  email?: string;
  score?: number;
  matchLevel?: 'strong' | 'moderate' | 'weak';
  reasoning?: string;
  locked?: boolean;
  raw?: Record<string, unknown>;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  options?: { label: string; value: string }[];
  leads?: MobileAssistantLead[];
  webSearchResult?: boolean;
  sources?: { title: string; url: string }[];
  roleCard?: { key: string; stage: 'intro' | 'question' | 'summary' | 'file'; qIdx?: number; nudge?: boolean; answers?: Record<string, string> };
}

export interface OutreachJourneyStep {
  channel: string;
  action: string;
  recommended: boolean;
  reason?: string;
}

/**
 * One node in the visual workflow builder — mirrors the web's WorkflowPreviewStep.
 * Also doubles as the canonical `SyncStep` shape consumed by
 * `workflowConfigSync.ts`'s deriveConfig/applyConfig — the per-step content
 * fields (message/subject/delay/condition) are what let a wizard edit and a
 * canvas edit reconcile onto the same array.
 */
export interface WorkflowStepDef {
  id: string;
  type: string;
  title: string;
  description?: string;
  channel: string;
  config?: Record<string, unknown>;
  message?: string;
  subject?: string;
  template?: string;
  script?: string;
  delayDays?: number;
  delayHours?: number;
  condition?: string;
  leadLimit?: number;
  /** AI Media fields match LAD Frontend 2's StepEditor payload exactly. */
  mediaPrompt?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaFilename?: string;
  mimeType?: string;
  /** Connected account selection for this step's channel (email sender id / WhatsApp account id / voice agent id). */
  accountId?: string;
  phoneNumber?: string;
  /**
   * Explicit position in the campaign sequence, matching the step's index in
   * `workflowSteps`. The Flow canvas and `buildCampaignPayload`'s
   * `order_index` map by THIS field — every function that builds or reorders
   * `workflowSteps` must call `stampSequence` before returning so a
   * user-picked order (e.g. voice, then LinkedIn, then WhatsApp) is never
   * silently reshuffled.
   */
  sequence?: number;
}

/** Platform catalogue for the workflow builder's "Add Step" picker (mirrors web). */
export const WORKFLOW_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', desc: 'Social outreach' },
  { id: 'email', label: 'Email', color: '#EA4335', desc: 'Direct mailing' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', desc: 'Instant messaging' },
  { id: 'voice', label: 'Voice', color: '#8B5CF6', desc: 'AI phone calls' },
  { id: 'media', label: 'AI Media', color: '#D946EF', desc: 'Generate brand media' },
] as const;

export const WORKFLOW_PLATFORM_ACTIONS: Record<string, { type: string; title: string; desc: string }[]> = {
  linkedin: [
    { type: 'linkedin_connect', title: 'Connect', desc: 'Send connection request' },
    { type: 'linkedin_message', title: 'Message', desc: 'Send follow-up message' },
    { type: 'linkedin_visit', title: 'Visit', desc: 'View LinkedIn profile' },
  ],
  email: [
    { type: 'email_send', title: 'Send Email', desc: 'Automated email' },
  ],
  whatsapp: [
    { type: 'whatsapp_send', title: 'WhatsApp', desc: 'Direct message' },
  ],
  voice: [
    { type: 'voice_agent_call', title: 'AI Call', desc: 'AI voice interaction' },
  ],
  media: [
    { type: 'media_generation', title: 'Generate Media', desc: 'Brand image/video for outreach' },
  ],
};

let workflowStepSeq = 0;
const workflowStepId = (type: string) => `${type}-${Date.now()}-${workflowStepSeq++}`;

const csvValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const getTemplateNodeChannel = (type: string, sourceKey?: string) => {
  if (type === 'lead_generation' && sourceKey?.startsWith('linkedin')) return 'linkedin';
  if (type.startsWith('linkedin') || type === 'condition' || type === 'followup_sequence') return 'linkedin';
  if (type.startsWith('email')) return 'email';
  if (type.startsWith('whatsapp')) return 'whatsapp';
  if (type === 'voice_agent_call') return 'voice';
  if (type === 'media_generation' || type === 'linkedin_post' || type === 'linkedin_content' || type === 'post_approval') return 'linkedin';
  if (type === 'data_enrich' || type === 'ai_parse' || type === 'export_results') return 'system';
  if (type === 'zoho_update') return 'crm';
  return 'system';
};

const cfgMessage = (cfg: Record<string, unknown>) =>
  String(cfg.message ?? cfg.body ?? cfg.whatsappMessage ?? cfg.whatsapp_message ?? '');

const cfgSubject = (cfg: Record<string, unknown>) => String(cfg.subject ?? '');

export const targetingFromAcceleratorSource = (sourceCfg: Record<string, unknown>): LeadTargeting | null => normalizeTargeting({
  job_titles: csvValues(sourceCfg.job_titles),
  industries: csvValues(sourceCfg.industries),
  locations: csvValues(sourceCfg.locations),
  keywords: csvValues(sourceCfg.keywords ?? sourceCfg.signal_query),
  company_names: csvValues(sourceCfg.company_names),
});

export const buildAcceleratorWorkflowSteps = (
  template: WorkflowTemplate,
  sourceCfgOverride: Record<string, unknown> = {},
  nodeCfgOverride: Record<string, Record<string, unknown>> = {},
): WorkflowStepDef[] => {
  const steps: WorkflowStepDef[] = [];
  if (template.source) {
    const config = { ...(template.source.cfg || {}), ...sourceCfgOverride };
    steps.push({
      id: SOURCE_STEP_ID,
      type: 'lead_generation',
      title: template.source.title || 'Contact source',
      description: template.source.description || '',
      channel: getTemplateNodeChannel('lead_generation', template.source.key),
      config,
      leadLimit: 25,
    });
  }

  template.nodes.forEach((node) => {
    const nodeKey = templateNodeKey(node);
    const config = { ...(node.cfg || {}), ...(nodeCfgOverride[nodeKey] || {}) };
    const delayDays = Number(config.delayDays ?? config.delay_days);
    const delayHours = Number(config.delayHours ?? config.delay_hours);
    const condition = String(config.condition ?? '');
    steps.push({
      id: node.macroId || workflowStepId(node.type),
      type: node.type,
      title: node.title,
      description: node.description,
      channel: getTemplateNodeChannel(node.type),
      config,
      message: cfgMessage(config),
      subject: cfgSubject(config),
      template: String(config.template ?? ''),
      script: String(config.script ?? ''),
      delayDays: Number.isFinite(delayDays) ? delayDays : undefined,
      delayHours: Number.isFinite(delayHours) ? delayHours : undefined,
      condition: condition || undefined,
      mediaPrompt: String(config.mediaPrompt ?? ''),
      mediaUrl: String(config.mediaUrl ?? ''),
      mediaType: String(config.mediaType ?? ''),
      mediaFilename: String(config.mediaFilename ?? ''),
      mimeType: String(config.mimeType ?? ''),
    });
  });

  return stampSequence(steps);
};

export const acceleratorChannelsFromSteps = (steps: WorkflowStepDef[]): string[] => {
  const channels = steps
    .filter((step) => !['lead_generation', 'condition', 'followup_sequence', 'data_enrich', 'ai_parse', 'export_results'].includes(step.type))
    .map((step) => {
      if (step.channel === 'voice_call') return 'voice';
      if (['linkedin', 'email', 'whatsapp', 'voice'].includes(step.channel)) return step.channel;
      if (step.type.startsWith('linkedin') || step.type === 'linkedin_post' || step.type === 'linkedin_content') return 'linkedin';
      if (step.type.startsWith('email')) return 'email';
      if (step.type.startsWith('whatsapp')) return 'whatsapp';
      if (step.type === 'voice_agent_call') return 'voice';
      return '';
    })
    .filter(Boolean);
  return Array.from(new Set(channels));
};

/**
 * Base workflow derived from the selected channels, IN THE ORDER GIVEN — a
 * channel earlier in `channels` renders earlier in the Flow diagram, and
 * 'linkedin' expands to its action sub-steps wherever it falls in that
 * order rather than always leading. Callers that want the old fixed
 * LinkedIn-first layout simply pass channels in that order themselves; this
 * function never reorders what it's given.
 */
export const buildWorkflowSteps = (channels: string[], includeLeadSource = true): WorkflowStepDef[] => {
  const selected = channels.filter(Boolean);
  if (!selected.length) return [];
  const steps: WorkflowStepDef[] = [];

  if (selected.includes('linkedin') && includeLeadSource) {
    steps.push({ id: workflowStepId('lead_generation'), type: 'lead_generation', title: 'Lead Search', description: 'LinkedIn lead source', channel: 'linkedin' });
  }

  selected.forEach((channel) => {
    if (channel === 'linkedin') {
      steps.push({ id: workflowStepId('linkedin_visit'), type: 'linkedin_visit', title: 'Visit', description: 'View LinkedIn profile', channel: 'linkedin' });
      steps.push({ id: workflowStepId('linkedin_connect'), type: 'linkedin_connect', title: 'Connect', description: 'Send connection request', channel: 'linkedin' });
      steps.push({ id: workflowStepId('linkedin_message'), type: 'linkedin_message', title: 'Message', description: 'Send follow-up message', channel: 'linkedin' });
    } else if (channel === 'email') {
      steps.push({ id: workflowStepId('email_send'), type: 'email_send', title: 'Send Email', description: 'Automated email', channel: 'email' });
    } else if (channel === 'whatsapp') {
      steps.push({ id: workflowStepId('whatsapp_send'), type: 'whatsapp_send', title: 'WhatsApp', description: 'Direct message', channel: 'whatsapp' });
    } else if (channel === 'voice') {
      steps.push({ id: workflowStepId('voice_agent_call'), type: 'voice_agent_call', title: 'AI Call', description: 'AI voice interaction', channel: 'voice' });
    }
  });

  return stampSequence(steps);
};

export const createWorkflowStep = (platformId: string, action: { type: string; title: string; desc: string }): WorkflowStepDef => ({
  id: workflowStepId(action.type),
  type: action.type,
  title: action.title,
  description: action.desc,
  channel: platformId,
  ...(action.type === 'lead_generation' ? { leadLimit: 10 } : {}),
  ...(action.type === 'delay' ? { delayDays: 0, delayHours: 1 } : {}),
});

export interface LeadChatResponse {
  response?: string;
  text?: string;
  message?: string;
  newSearch?: boolean;
  shouldSearch?: boolean;
  searchType?: 'generic_prospect' | 'linkedin' | string;
  updatedTargeting?: LeadTargeting;
  targeting?: LeadTargeting;
  pendingIntent?: string | null;
  options?: { label: string; value: string }[];
}

const unwrapData = <T>(payload: unknown, fallback: T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload as T) ?? fallback;
};

const toArr = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter((item) => item.trim());
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

export const normalizeTargeting = (intent: unknown): LeadTargeting | null => {
  if (!intent || typeof intent !== 'object') return null;
  const record = intent as Record<string, unknown>;
  const targeting: LeadTargeting = {
    job_titles: toArr(record.job_titles),
    industries: toArr(record.industries),
    locations: toArr(record.locations),
    keywords: toArr(record.keywords),
    profile_language: toArr(record.profile_language),
    functions: toArr(record.functions),
    seniority: toArr(record.seniority),
    company_headcount: toArr(record.company_headcount),
    company_names: toArr(record.company_names),
    decision_maker_nationality: toArr(record.decision_maker_nationality),
    decision_maker_experience_level: toArr(record.decision_maker_experience_level),
    company_size: toArr(record.company_size),
    company_age: toArr(record.company_age),
    decision_maker_education: toArr(record.decision_maker_education),
    decision_maker_skills: toArr(record.decision_maker_skills),
    posted_recently: record.posted_recently === true ? true : undefined,
    nationality_filter: toArr(record.nationality_filter),
  };

  const hasData = Object.entries(targeting).some(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  return hasData ? targeting : null;
};

const resolveProfileUrl = (item: Record<string, unknown>) => {
  const candidates = [item.profile_url, item.public_profile_url, item.linkedin_url]
    .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url));
  const standard = candidates.find((url) => url.includes('linkedin.com/in/'));
  if (standard) return standard;
  if (candidates[0]) return candidates[0];
  if (typeof item.public_identifier === 'string' && item.public_identifier) {
    return `https://www.linkedin.com/in/${item.public_identifier}`;
  }
  return '';
};

export const normalizeLead = (item: unknown, index: number): MobileAssistantLead => {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const profileUrl = resolveProfileUrl(record);
  const firstName = String(record.first_name ?? '');
  const lastName = String(record.last_name ?? '');
  const name = String(record.name ?? `${firstName} ${lastName}`.trim() ?? '').trim()
    || String(record.phone ?? record.email ?? (profileUrl ? 'LinkedIn User' : `Lead ${index + 1}`));

  return {
    id: String(record.id ?? record.provider_id ?? record.profile_url ?? `lead-${index}`),
    name,
    firstName,
    lastName,
    headline: String(record.headline ?? record.decision_maker_title ?? ''),
    location: String(record.location ?? ''),
    company: String(record.current_company ?? record.company ?? record.company_name ?? ''),
    profileUrl,
    profilePicture: String(record.profile_picture ?? record.avatar ?? ''),
    industry: String(record.industry ?? record.company_type ?? ''),
    phone: String(record.phone ?? record.company_phone ?? ''),
    email: String(record.email ?? ''),
    score: record.icp_score != null ? Number(record.icp_score) : undefined,
    matchLevel: record.match_level as MobileAssistantLead['matchLevel'] | undefined,
    reasoning: String(record.icp_reasoning ?? record.reasoning ?? ''),
    locked: Boolean(record.locked ?? index >= 5),
    raw: record,
  };
};

export const isConfirmation = (text: string) =>
  /^\s*(yes|yeah|yep|yup|ok|okay|sure|go|proceed|correct|right|confirm|search it|search|find them|do it|go ahead|looks (good|right|correct)|sounds good|perfect|absolutely|definitely)\s*[!.]*\s*$/i.test(text.trim());

export const isGenericCompanySearchQuery = (text: string) => {
  const lower = text.toLowerCase();
  const companyType = /\b(hotels?|clinics?|schools?|restaurants?|gyms?|salons?|companies|businesses|firms|agencies|stores|chains|brands|operators|venues|properties|facilities)\b/i.test(lower);
  const decisionMaker = /\b(decision[\s-]?maker|gm\b|general\s*manager|managing\s*director|md\b|ceo\b|owner\b|founder|director|head\s+of|vp\b|vice\s*president|operations\s*manager)\b/i.test(lower);
  const locationOrAttribute = /\b(in|near|around|with|having|based in)\b/i.test(lower);
  return companyType && (decisionMaker || locationOrAttribute);
};

// ── Specific-person detection (mirrors web's detectSpecificPersonQuery) ─────
// A confirmed query naming one person at a company must not go through broad
// search + ICP scoring (it can only return strangers who share the first
// name). It routes through the same import/save + enrichment pipeline as
// file-imported leads instead — the backend resolves the exact person's
// LinkedIn profile.
const PERSON_AUDIENCE_WORDS = /\b(founders?|co-?founders?|owners?|managers?|directors?|heads?|chiefs?|leads?|executives?|officers?|presidents?|professionals?|specialists?|consultants?|engineers?|developers?|designers?|marketers?|recruiters?|analysts?|advisors?|partners?|investors?|agents?|brokers?|people|teams?|companies|startups?|businesses|smes?|ceos?|c[tfmo]os?|cxos?|vps?)\b/i;

export interface SpecificPersonQuery {
  name: string;
  title: string;
  company: string;
  location: string;
}

export function detectSpecificPersonQuery(t: LeadTargeting | null | undefined): SpecificPersonQuery | null {
  if (!t) return null;
  const kw = (t.keywords || []).join(' ').replace(/\s+/g, ' ').trim();
  const words = kw.split(' ').filter(Boolean);
  // A person name: 2–4 alphabetic words with no audience/role vocabulary.
  if (words.length < 2 || words.length > 4) return null;
  if (PERSON_AUDIENCE_WORDS.test(kw)) return null;
  // Web requires name-cased words, but mobile keyboards default to lowercase
  // ("find pagala chethan reddy at techiemaya") and the backend echoes the
  // typed casing back in keywords — so accept any-cased alphabetic words and
  // title-case the name below for resolution/display.
  if (!words.every((w) => /^[A-Za-z][A-Za-z'’.-]*$/.test(w))) return null;
  // Require a company anchor — that's what the person-resolution waterfall keys on.
  const company = (t.company_names && t.company_names[0]) || '';
  if (!company) return null;
  const name = words
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
  return {
    name,
    title: (t.job_titles && t.job_titles[0]) || '',
    company,
    location: (t.locations && t.locations[0]) || '',
  };
}

export const buildConfirmationMessage = (intent: LeadTargeting) => {
  const person = detectSpecificPersonQuery(intent);
  const lines = ['Here is what I understood:'];
  if (intent.job_titles?.length) lines.push(`**Roles:** ${intent.job_titles.join(', ')}`);
  if (intent.industries?.length) lines.push(`**Industries:** ${intent.industries.join(', ')}`);
  if (intent.company_names?.length) lines.push(`**Companies:** ${intent.company_names.join(', ')}`);
  if (intent.locations?.length) lines.push(`**Locations:** ${intent.locations.join(', ')}`);
  if (intent.keywords?.length) lines.push(`**${person ? 'Person' : 'Keywords'}:** ${person?.name ?? intent.keywords.join(', ')}`);
  if (intent.decision_maker_nationality?.length) lines.push(`**Nationality:** ${intent.decision_maker_nationality.join(', ')}`);
  if (intent.company_size?.length) lines.push(`**Company size:** ${intent.company_size.join(', ')}`);
  lines.push('', 'Does this look right? Tap Yes to search, or tell me what to change.');
  return lines.join('\n');
};

export const buildOutreachJourney = (leads: MobileAssistantLead[], targeting?: LeadTargeting | null): OutreachJourneyStep[] => {
  const hasEmail = leads.some((lead) => lead.email);
  const hasPhone = leads.some((lead) => lead.phone);
  const hasLinkedIn = leads.some((lead) => lead.profileUrl);
  const isGcc = (targeting?.locations || []).some((location) => /uae|dubai|saudi|qatar|kuwait|bahrain|oman|riyadh|abu dhabi/i.test(location));

  return [
    { channel: 'LinkedIn', action: hasLinkedIn ? 'Visit, connect, then message' : 'Find LinkedIn profiles first', recommended: true },
    { channel: 'Email', action: hasEmail ? 'Send personalized email sequence' : 'Enrich emails for qualified leads', recommended: true },
    { channel: 'WhatsApp', action: hasPhone || isGcc ? 'Warm follow-up after first touch' : 'Use for warm leads after enrichment', recommended: true },
    { channel: 'Voice', action: 'AI call for high-score non-responders', recommended: true },
  ];
};

const mapLeadForCampaign = (lead: MobileAssistantLead) => ({
  id: lead.id,
  name: lead.name,
  first_name: lead.firstName || '',
  last_name: lead.lastName || '',
  headline: lead.headline || '',
  title: lead.headline || '',
  location: lead.location || '',
  current_company: lead.company || '',
  company_name: lead.company || '',
  profile_url: lead.profileUrl || '',
  linkedin_url: lead.profileUrl || '',
  profile_picture: lead.profilePicture || '',
  photo_url: lead.profilePicture || '',
  industry: lead.industry || '',
  icp_score: lead.score ?? 0,
  match_level: lead.matchLevel || 'moderate',
  icp_reasoning: lead.reasoning || '',
  phone: lead.phone || '',
  email: lead.email || '',
  profile_summary: lead.reasoning || null,
  _source: 'mobile_ai_assistant',
});

/** Per-step backend config, populated from the step's own message/subject/delay/condition fields (set by the CheckpointWizard or the Flow canvas's step editor). */
const buildStepConfig = (step: WorkflowStepDef, targeting: LeadTargeting | null | undefined, searchQuery: string, leadCount: number): Record<string, unknown> => {
  const base = step.config || {};
  const t = targeting || {};
  switch (step.type) {
    case 'lead_generation':
      {
        const jobTitles = csvValues(base.job_titles).length ? csvValues(base.job_titles) : t.job_titles || [];
        const industries = csvValues(base.industries).length ? csvValues(base.industries) : t.industries || [];
        const locations = csvValues(base.locations).length ? csvValues(base.locations) : t.locations || [];
        const keywords = csvValues(base.keywords ?? base.signal_query).length
          ? csvValues(base.keywords ?? base.signal_query).join(' ')
          : t.keywords?.join(' ') || searchQuery;
      return {
        ...base,
        source: 'linkedin_search',
        leadGenerationFilters: {
          keywords,
          industries,
          locations,
          job_titles: jobTitles,
          profile_language: t.profile_language || [],
          decision_maker_titles: csvValues(base.decision_maker_titles),
          signal_query: String(base.signal_query ?? ''),
        },
        leadGenerationLimit: Math.max(1, leadCount || 1),
        icp_input: searchQuery,
        icp_threshold: step.leadLimit ?? 0,
      };
      }
    case 'linkedin_visit':
      return { ...base, delayDays: step.delayDays ?? 0, delayHours: step.delayHours ?? 0 };
    case 'linkedin_connect':
      return { ...base, message: step.message || String(base.message ?? ''), delayDays: step.delayDays ?? 0, delayHours: step.delayHours ?? 2 };
    case 'linkedin_message':
      return { ...base, message: step.message || String(base.message ?? ''), delayDays: step.delayDays ?? 2, delayHours: step.delayHours ?? 0 };
    case 'linkedin_inmail':
      return { ...base, subject: step.subject || String(base.subject ?? ''), message: step.message || String(base.message ?? ''), delayDays: step.delayDays ?? 0, delayHours: step.delayHours ?? 0 };
    case 'email_send':
      return {
        ...base,
        subject: step.subject || String(base.subject ?? ''),
        body: step.message || String(base.body ?? base.message ?? ''),
        senderAccountId: step.accountId || String(base.senderAccountId ?? base.from_email_account_id ?? ''),
        from_email_account_id: step.accountId || String(base.from_email_account_id ?? base.senderAccountId ?? ''),
        from_email: String(base.from_email ?? ''),
        email_provider: String(base.email_provider ?? base.provider ?? ''),
        template_id: base.template_id || undefined,
        delayDays: step.delayDays ?? 2,
        delayHours: step.delayHours ?? 0,
      };
    case 'whatsapp_send':
      return {
        ...base,
        whatsappMessage: step.message || String(base.whatsappMessage ?? base.message ?? ''),
        template: step.template || String(base.template ?? ''),
        accountId: step.accountId || String(base.accountId ?? base.whatsapp_account_id ?? ''),
        whatsapp_account_id: step.accountId || String(base.whatsapp_account_id ?? base.accountId ?? ''),
        whatsapp_template_id: base.whatsapp_template_id || base.template_id || undefined,
        delayDays: step.delayDays ?? 2,
        delayHours: step.delayHours ?? 0,
      };
    case 'voice_agent_call':
      return {
        ...base,
        agentId: step.accountId || '',
        phoneNumber: step.phoneNumber || '',
        script: step.script || String(base.script ?? ''),
        purpose: step.description || String(base.purpose ?? ''),
        delayDays: step.delayDays ?? 3,
        delayHours: step.delayHours ?? 0,
      };
    case 'wait_for_condition':
    case 'condition':
      return { ...base, condition: step.condition || String(base.condition ?? '') };
    case 'media_generation':
      return {
        ...base,
        mediaPrompt: step.mediaPrompt || String(base.mediaPrompt ?? ''),
        mediaUrl: step.mediaUrl || String(base.mediaUrl ?? ''),
        mediaType: step.mediaType || String(base.mediaType ?? ''),
        mediaFilename: step.mediaFilename || String(base.mediaFilename ?? ''),
        mimeType: step.mimeType || String(base.mimeType ?? ''),
      };
    case 'followup_sequence':
    case 'linkedin_post':
    case 'linkedin_content':
    case 'post_approval':
    case 'ai_parse':
    case 'data_enrich':
    case 'export_results':
    case 'zoho_update':
      return { ...base };
    default:
      return { ...base };
  }
};

/**
 * When the user hasn't explicitly picked a trigger condition (no
 * `wait_for_condition` step), the campaign still needs one whenever LinkedIn
 * hands off to a follow-up channel — otherwise the backend waits forever for
 * an event tied to an action the workflow never performs. Pick the condition
 * that matches the LAST LinkedIn action actually in the workflow, mirroring
 * web's explicit TRIGGER_OPTIONS_MAP choices instead of always assuming a
 * connection request went out.
 */
export const defaultTriggerConditionFor = (actions: string[]): string | null => {
  if (actions.includes('message')) return 'message_replied';
  if (actions.includes('connect')) return 'connection_accepted';
  if (actions.includes('profile_view')) return 'profile_visited';
  return null;
};

export const buildCampaignPayload = ({
  name,
  leads,
  targeting,
  workflowSteps,
  searchQuery,
  campaignDays = 30,
  campaignConfig,
  dataSource = 'linkedin_search',
  inboundLeadIds,
}: {
  name: string;
  leads: MobileAssistantLead[];
  targeting?: LeadTargeting | null;
  /** Canonical step array (also the Flow canvas's data source) — steps.length/order/content drive the whole payload. */
  workflowSteps: WorkflowStepDef[];
  searchQuery: string;
  campaignDays?: number;
  campaignConfig?: {
    icpThreshold?: number;
    enableAiPersonalization?: boolean;
    enableAiConnectionPersonalization?: boolean;
    enableAiFollowupPersonalization?: boolean;
    enableDailyWebPresence?: boolean;
    enableDailyPosts?: boolean;
  };
  /** Where the enrolled leads actually came from — mirrors web's persistedLeadSource tagging so the backend enrolls exactly the leads sent here instead of re-sourcing more via LinkedIn search. */
  dataSource?: 'linkedin_search' | 'csv_import' | 'direct_contact' | 'generic_prospect';
  /**
   * Real backend-persisted lead UUIDs for CSV-import/direct-contact leads (mirrors web's
   * `resolvedInboundLeadIds` in advanced-search-ai/page.tsx). When present, these leads are
   * linked via `inbound_lead_ids` instead of being re-embedded in `initial_leads` — the backend
   * can't cross-dedupe the two paths, so sending both would enrol each person twice and spawn an
   * orphan lead. Leave undefined/empty to fall back to `initial_leads` (LinkedIn-search leads
   * never have a persisted id yet, so they always take this path).
   */
  inboundLeadIds?: string[];
}) => {
  const { nextChannels, actions, triggerCondition } = deriveConfig(workflowSteps);
  const selected = nextChannels.length ? nextChannels : ['linkedin'];
  const resolvedTriggerCondition = triggerCondition || (selected.length > 1 ? defaultTriggerConditionFor(actions) : null);
  const t = targeting || {};
  const resolvedInboundLeadIds = inboundLeadIds && inboundLeadIds.length ? inboundLeadIds : undefined;
  // order_index prefers each step's own explicit `sequence` (stamped by
  // stampSequence whenever workflowSteps is built/reordered) so the backend
  // receives the exact user-picked order rather than trusting array
  // position alone — falls back to the array index for any step that
  // somehow arrives unstamped.
  const steps = workflowSteps.map((step, index) => ({
    type: step.type,
    title: step.title,
    channel: step.channel,
    order_index: step.sequence ?? index,
    config: buildStepConfig(step, targeting, searchQuery, leads.length),
  }));

  return {
    name: name || 'AI Growth Campaign',
    status: 'active',
    campaign_type: selected.includes('linkedin') ? 'linkedin_outreach' : 'direct_outreach',
    leads_per_day: Math.min(Math.max(leads.length || 1, 1), 50),
    campaign_start_date: new Date().toISOString(),
    campaign_end_date: new Date(Date.now() + campaignDays * 24 * 60 * 60 * 1000).toISOString(),
    // Do NOT send both paths for the same leads — see `inboundLeadIds` doc above.
    initial_leads: resolvedInboundLeadIds ? undefined : (leads.length ? leads.map(mapLeadForCampaign) : undefined),
    inbound_lead_ids: resolvedInboundLeadIds,
    config: {
      data_source: dataSource,
      search_intent: targeting || null,
      search_query: searchQuery,
      campaign_days: campaignDays,
      next_channels: selected,
      trigger_condition: resolvedTriggerCondition,
      linkedin_actions: actions.length ? actions : (selected.includes('linkedin') ? ['profile_view', 'connect', 'message'] : []),
      location: t.locations?.[0] || '',
      industries: t.industries || [],
      job_titles: t.job_titles || [],
      profile_language: t.profile_language || [],
      icp_input: searchQuery,
      search_filters: {
        keywords: t.keywords?.join(' ') || searchQuery,
        industries: t.industries || [],
        locations: t.locations || [],
        job_titles: t.job_titles || [],
        profile_language: t.profile_language || [],
      },
      checkpoint_selections: {
        icp_threshold: campaignConfig?.icpThreshold ?? 0,
        linkedin_actions: actions.length ? actions : (selected.includes('linkedin') ? ['profile_view', 'connect', 'message'] : []),
        next_channels: selected,
        trigger_condition: resolvedTriggerCondition,
        campaign_days: campaignDays,
        campaign_name: name || 'AI Growth Campaign',
        enable_ai_personalization: campaignConfig?.enableAiPersonalization ?? true,
        enable_ai_connection_personalization: campaignConfig?.enableAiConnectionPersonalization ?? true,
        enable_ai_followup_personalization: campaignConfig?.enableAiFollowupPersonalization ?? true,
        enable_daily_web_presence: campaignConfig?.enableDailyWebPresence ?? false,
        enable_daily_posts: campaignConfig?.enableDailyPosts ?? false,
        ai_tone: 'professional',
        ai_goal: 'get_meeting',
      },
    },
    steps,
  };
};

export async function sendLeadChat(body: Record<string, unknown>): Promise<LeadChatResponse | null> {
  const response = await apiPost<LeadChatResponse>('/api/ai-icp-assistant/lead-chat', body);
  return unwrapData<LeadChatResponse>(response.data, response.data);
}

export async function extractLinkedInIntent(query: string) {
  const response = await apiPost('/api/campaigns/linkedin/search/extract-intent', { query });
  return unwrapData<Record<string, unknown>>(response.data, response.data as Record<string, unknown>);
}

export async function searchLinkedInUnified(body: Record<string, unknown>) {
  const response = await apiPost('/api/campaigns/linkedin/search/unified', body);
  const data = unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : Array.isArray(data.leads) ? data.leads : [],
    total: Number(data.total ?? data.leads?.length ?? data.results?.length ?? 0),
    cursor: data.cursor ?? null,
    module_used: data.module_used ?? 'advanced_search',
  };
}

export async function searchLinkedInAdvanced(body: Record<string, unknown>) {
  const response = await apiPost('/api/campaigns/linkedin/search/advanced', body);
  const data = unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : Array.isArray(data.leads) ? data.leads : [],
    total: Number(data.total ?? data.results?.length ?? data.leads?.length ?? 0),
    cursor: data.cursor ?? null,
  };
}

export async function searchGenericProspects(body: Record<string, unknown>) {
  const response = await apiPost('/api/ai-icp-assistant/prospect-search', body);
  const data = unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : [],
    total: Number(data.total ?? data.results?.length ?? 0),
    hasMore: Boolean(data.hasMore),
  };
}

export async function webResearch(query: string) {
  const response = await apiPost('/api/campaigns/linkedin/web-search', { query, type: 'auto' });
  return unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
}

export async function researchAccount(query: string) {
  const response = await apiPost('/api/abm/research', { query });
  return unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
}

export async function createMobileAssistantCampaign(body: Record<string, unknown>) {
  const response = await apiPost('/api/campaigns', body);
  const raw = response.data as Record<string, any>;
  if (raw && typeof raw === 'object' && raw.success === false) {
    throw new Error(String(raw.error ?? raw.message ?? raw.reason ?? 'Unable to create outreach journey.'));
  }
  return raw && typeof raw === 'object'
    ? raw
    : unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
}

// ── Import-leads persistence + enrichment (mirrors LAD-Frontend-2's
// finishInboundImport in advanced-search-ai/page.tsx) ──────────────────────
//
// A file/contact import only ever produced a locally-parsed, non-persisted
// lead list on mobile — no backend id, no Google/LinkedIn enrichment — even
// though the follow-up chat message told the user profiles were "building in
// the background". These two calls are what actually does that on web; wire
// them in after the initial local parse so the AI Assistant ends up showing
// the same backend-corrected lead data as web instead of the raw upload.

export interface SavedImportLead {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  headline?: string;
  title?: string;
  target_title?: string;
  location?: string;
  linkedin_url?: string;
  profile_picture?: string;
}

export interface SaveImportedLeadsResult {
  leadIds: string[];
  leads: SavedImportLead[];
}

export async function saveImportedLeads(
  leads: MobileAssistantLead[],
  location?: string,
): Promise<SaveImportedLeadsResult> {
  const leadsForSave = leads.map((lead) => ({
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    linkedin_url: lead.profileUrl,
    title: lead.headline,
  }));
  const detectedChannels = {
    email: leads.some((lead) => Boolean(lead.email)),
    whatsapp: false,
    phone: leads.some((lead) => Boolean(lead.phone)),
    linkedin: leads.some((lead) => Boolean(lead.profileUrl)),
    website: false,
  };
  const response = await apiPost('/api/campaigns/leads/import/save', {
    leads: leadsForSave,
    location: location || undefined,
    detectedChannels,
  });
  const data = unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
  return {
    leadIds: Array.isArray(data.leadIds) ? data.leadIds : [],
    leads: Array.isArray(data.leads) ? data.leads : [],
  };
}

export interface EnrichedImportLead {
  leadId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
  email?: string;
  phone?: string;
  industry?: string;
  background_summary?: string;
  profile_picture?: string;
}

export async function enrichInboundLeads(
  leadIds: string[],
  icpProfile?: unknown,
): Promise<{ success: boolean; results: EnrichedImportLead[] }> {
  const response = await apiPost('/api/campaigns/leads/enrich-inbound', {
    leadIds,
    icpProfile: icpProfile ?? null,
  });
  const data = unwrapData<Record<string, any>>(response.data, response.data as Record<string, any>);
  return {
    success: Boolean(data.success),
    results: Array.isArray(data.results) ? data.results : [],
  };
}

/** Splits a combined `name` into first/last when the source only carries one field. */
const readLeadName = (raw: { name?: string; firstName?: string; lastName?: string; first_name?: string; last_name?: string }) => {
  let firstName = String(raw.firstName ?? raw.first_name ?? '').trim();
  let lastName = String(raw.lastName ?? raw.last_name ?? '').trim();
  const name = String(raw.name ?? `${firstName} ${lastName}`).trim();
  if (!firstName && !lastName && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  return { firstName, lastName, name };
};

// ── Image / PDF lead extraction ─────────────────────────────────────────────
// Mirrors web's handleInboundFile image branch: the backend
// (POST /api/campaigns/leads/import, multipart) runs AI vision extraction on
// business cards / screenshots / PDFs and returns structured leads.

export interface PickedLeadFile {
  uri: string;
  name: string;
  mimeType?: string;
  /** Present on web DocumentPicker results — used directly to avoid a blob round-trip. */
  file?: Blob | null;
}

export async function extractLeadsFromFileUpload(picked: PickedLeadFile): Promise<MobileAssistantLead[]> {
  const form = new FormData();
  const fileName = picked.name || `upload-${Date.now()}`;
  if (Platform.OS === 'web') {
    const blob = picked.file ?? await (await fetch(picked.uri)).blob();
    form.append('file', blob, fileName);
  } else {
    form.append('file', {
      uri: picked.uri,
      name: fileName,
      type: picked.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }

  const response = await apiPost('/api/campaigns/leads/import', form);
  const payload = response.data as Record<string, any>;
  if (payload && payload.success === false) {
    throw new Error(String(payload.error ?? payload.message ?? 'Could not extract leads from that file.'));
  }
  const data = payload?.data && typeof payload.data === 'object' ? payload.data as Record<string, any> : payload;
  const rawLeads: unknown[] = Array.isArray(data?.leads) ? data.leads : [];
  const stamp = Date.now();

  return rawLeads.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const firstName = String(record.first_name ?? record.firstName ?? '').trim();
    const lastName = String(record.last_name ?? record.lastName ?? '').trim();
    const name = String(record.name ?? `${firstName} ${lastName}`).trim();
    const email = String(record.email ?? '').trim();
    const phone = String(record.phone ?? record.whatsapp ?? '').trim();
    const profileUrl = String(record.linkedin_url ?? record.profile_url ?? '').trim();
    return {
      id: `import-${stamp}-${index}`,
      name: name || email || phone || 'Imported lead',
      firstName: firstName || name.split(' ')[0] || '',
      lastName: lastName || name.split(' ').slice(1).join(' ') || '',
      headline: String(record.title ?? record.job_title ?? '').trim(),
      location: String(record.location ?? '').trim(),
      company: String(record.company ?? record.company_name ?? '').trim(),
      profileUrl,
      industry: String(record.industry ?? '').trim(),
      phone,
      email,
      locked: false,
      raw: record,
    } satisfies MobileAssistantLead;
  }).filter((lead) => lead.name !== 'Imported lead' || lead.email || lead.phone || lead.profileUrl);
}

/** File types the assistant's lead upload accepts beyond spreadsheets — routed to backend AI extraction. */
export const isVisionExtractionFile = (name: string, mimeType?: string | null) =>
  Boolean(mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf'))
  || /\.(png|jpe?g|webp|heic|heif|pdf)$/i.test(name || '');

/** Maps a backend-saved/enriched lead record onto the mobile lead shape (mirrors web's rebuiltPanel). */
export const savedLeadToMobileLead = (raw: SavedImportLead, index: number): MobileAssistantLead => {
  const { firstName, lastName, name } = readLeadName(raw);
  const headline = raw.headline || raw.title || raw.target_title || '';
  const company = raw.company || '';
  return {
    id: raw.id || `import-${Date.now()}-${index}`,
    name: name || (company ? `at ${company}` : '') || 'Imported lead',
    firstName,
    lastName,
    headline,
    location: raw.location || '',
    company,
    profileUrl: raw.linkedin_url || '',
    profilePicture: raw.profile_picture || '',
    locked: false,
    raw: raw as unknown as Record<string, unknown>,
  };
};
