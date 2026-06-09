import { apiPost } from '@/src/api';

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
}

export interface OutreachJourneyStep {
  channel: string;
  action: string;
  recommended: boolean;
  reason?: string;
}

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

export const buildConfirmationMessage = (intent: LeadTargeting) => {
  const lines = ['Here is what I understood:'];
  if (intent.job_titles?.length) lines.push(`Roles: ${intent.job_titles.join(', ')}`);
  if (intent.industries?.length) lines.push(`Industries: ${intent.industries.join(', ')}`);
  if (intent.company_names?.length) lines.push(`Companies: ${intent.company_names.join(', ')}`);
  if (intent.locations?.length) lines.push(`Locations: ${intent.locations.join(', ')}`);
  if (intent.keywords?.length) lines.push(`Keywords: ${intent.keywords.join(', ')}`);
  if (intent.decision_maker_nationality?.length) lines.push(`Nationality: ${intent.decision_maker_nationality.join(', ')}`);
  if (intent.company_size?.length) lines.push(`Company size: ${intent.company_size.join(', ')}`);
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

export const buildCampaignPayload = ({
  name,
  leads,
  targeting,
  channels,
  searchQuery,
  campaignDays = 30,
}: {
  name: string;
  leads: MobileAssistantLead[];
  targeting?: LeadTargeting | null;
  channels: string[];
  searchQuery: string;
  campaignDays?: number;
}) => {
  const selected = channels.length ? channels : ['linkedin', 'email'];
  let order = 0;
  const steps: Record<string, unknown>[] = [];
  const t = targeting || {};

  if (selected.includes('linkedin')) {
    steps.push({
      type: 'lead_generation',
      title: 'LinkedIn Lead Search',
      channel: 'linkedin',
      order_index: order++,
      config: {
        source: 'linkedin_search',
        leadGenerationFilters: {
          keywords: t.keywords?.join(' ') || searchQuery,
          industries: t.industries || [],
          locations: t.locations || [],
          job_titles: t.job_titles || [],
          profile_language: t.profile_language || [],
        },
        leadGenerationLimit: Math.max(10, leads.length || 10),
        icp_input: searchQuery,
        icp_threshold: 0,
      },
    });
    steps.push({ type: 'linkedin_visit', title: 'Visit LinkedIn Profile', channel: 'linkedin', order_index: order++, config: { delayDays: 0, delayHours: 0 } });
    steps.push({ type: 'linkedin_connect', title: 'Send LinkedIn Connection Request', channel: 'linkedin', order_index: order++, config: { message: '', delayDays: 0, delayHours: 2 } });
    steps.push({ type: 'linkedin_message', title: 'Send LinkedIn Follow-up Message', channel: 'linkedin', order_index: order++, config: { message: '', delayDays: 2, delayHours: 0 } });
  }

  if (selected.includes('email')) {
    steps.push({ type: 'email_send', title: 'Send Follow-up Email', channel: 'email', order_index: order++, config: { subject: '', body: '', delayDays: selected.includes('linkedin') ? 3 : 0, delayHours: 0 } });
  }

  if (selected.includes('whatsapp')) {
    steps.push({ type: 'whatsapp_send', title: 'Send WhatsApp Message', channel: 'whatsapp', order_index: order++, config: { whatsappMessage: '', delayDays: selected.includes('linkedin') ? 4 : 0, delayHours: 0 } });
  }

  if (selected.includes('voice')) {
    steps.push({ type: 'voice_agent_call', title: 'AI Voice Call', channel: 'voice', order_index: order++, config: { delayDays: selected.includes('linkedin') ? 5 : 0, delayHours: 0 } });
  }

  return {
    name: name || 'AI Growth Campaign',
    status: 'active',
    campaign_type: selected.includes('linkedin') ? 'linkedin_outreach' : 'direct_outreach',
    leads_per_day: Math.min(Math.max(leads.length || 10, 10), 50),
    campaign_start_date: new Date().toISOString(),
    campaign_end_date: new Date(Date.now() + campaignDays * 24 * 60 * 60 * 1000).toISOString(),
    initial_leads: leads.length ? leads.map(mapLeadForCampaign) : undefined,
    config: {
      data_source: 'mobile_ai_assistant',
      search_intent: targeting || null,
      search_query: searchQuery,
      campaign_days: campaignDays,
      next_channels: selected,
      trigger_condition: selected.length > 1 ? 'connection_accepted' : null,
      linkedin_actions: selected.includes('linkedin') ? ['profile_view', 'connect', 'message'] : [],
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
        icp_threshold: 0,
        linkedin_actions: selected.includes('linkedin') ? ['profile_view', 'connect', 'message'] : [],
        next_channels: selected,
        trigger_condition: selected.length > 1 ? 'connection_accepted' : null,
        campaign_days: campaignDays,
        campaign_name: name || 'AI Growth Campaign',
        enable_ai_personalization: true,
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
