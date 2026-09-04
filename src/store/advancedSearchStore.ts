import { create } from 'zustand';
import { safeStorage } from '@/src/api';
import {
  AssistantChatMessage,
  LeadTargeting,
  MobileAssistantLead,
  WorkflowStepDef,
  acceleratorChannelsFromSteps,
  buildAcceleratorWorkflowSteps,
  buildConfirmationMessage,
  buildCampaignPayload,
  buildOutreachJourney,
  buildWorkflowSteps,
  createMobileAssistantCampaign,
  createWorkflowStep,
  detectSpecificPersonQuery,
  enrichInboundLeads,
  extractLinkedInIntent,
  isConfirmation,
  isGenericCompanySearchQuery,
  normalizeLead,
  normalizeTargeting,
  researchAccount,
  saveImportedLeads,
  savedLeadToMobileLead,
  searchGenericProspects,
  searchLinkedInAdvanced,
  searchLinkedInUnified,
  sendLeadChat,
  targetingFromAcceleratorSource,
  webResearch,
} from '@/src/services/mobileAIAssistantService';
import {
  WORKFLOW_TEMPLATES,
  splitWizardAnswers,
  templateSearchQuery,
  templateWizardInputs,
} from '@/src/services/workflowAccelerators';
import { applyConfig, stampSequence } from '@/src/services/workflowConfigSync';
import { validateWorkflow } from '@/src/services/workflowValidation';
import { getUserAvailableAgents } from '@/src/services/voice-agent/api';
import { getConnectedEmailAccounts } from '@/src/services/emailBroadcast.service';
import { getEmailIntegrations, getWhatsAppIntegrations } from '@/src/services/integration.service';

/** UI platform id ↔ DerivedConfig channel id — the wizard/canvas use 'voice', the sync config uses 'voice_call'. */
const toSyncChannel = (channel: string) => (channel === 'voice' ? 'voice_call' : channel);

const STORAGE_KEY = 'mobile-ai-assistant-storage';
const DEFAULT_LEAD_COUNT = 10;
const LEAD_CHAT_TIMEOUT_MS = 25000;
const ASSISTANT_SEARCH_TIMEOUT_MS = 240000;

interface PendingSearchConfirmation {
  intent: LeadTargeting;
  originalQuery: string;
}

/** A person-at-company query paused on "which location?" — the next user message answers it (mirrors web's pendingLocationRequest). */
interface PendingLocationRequest {
  intent: LeadTargeting;
  originalQuery: string;
}

interface AcceleratorWizardState {
  key: string;
  idx: number;
  answers: Record<string, string>;
}

interface MobileAIAssistantState {
  messages: AssistantChatMessage[];
  input: string;
  leads: MobileAssistantLead[];
  targeting: LeadTargeting | null;
  pendingSearchConfirmation: PendingSearchConfirmation | null;
  pendingLocationRequest: PendingLocationRequest | null;
  pendingIntent: string | null;
  conversationId: string;
  conversationSummary: string;
  recentSearches: string[];
  outreachJourney: ReturnType<typeof buildOutreachJourney>;
  outreachWorkflowStage: 'idle' | 'configuring' | 'launching' | 'launched';
  selectedOutreachChannels: string[];
  workflowSteps: WorkflowStepDef[];
  selectedLeadIds: string[];
  leadFeedback: Record<string, 'good' | 'bad'>;
  importedMode: boolean;
  campaignName: string;
  campaignDays: number;
  launchedCampaignId: string | null;
  /** -1 = closed. Drives the four-step CheckpointWizard. */
  cpStep: number;
  cpIcpThreshold: number;
  cpEnableAiPersonalization: boolean;
  cpEnableAiConnectionPersonalization: boolean;
  cpEnableAiFollowupPersonalization: boolean;
  cpEnableDailyWebPresence: boolean;
  cpEnableDailyPosts: boolean;
  cpAgentDealLoading: boolean;
  lastSearchQuery: string;
  lastTargeting: LeadTargeting | null;
  lastIcpDescription: string;
  lastSearchType: 'linkedin' | 'generic_prospect';
  lastModuleUsed: string;
  searchCursor: string | null;
  seenProspectIds: string[];
  totalResults: number;
  useSalesNav: boolean;
  acceleratorWizard: AcceleratorWizardState | null;
  acceleratorPreviewing: boolean;
  isBusy: boolean;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  setInput: (value: string) => void;
  toggleSalesNav: () => void;
  startAccelerator: (templateKey: string) => void;
  submitMessage: (message?: string) => Promise<void>;
  chooseOption: (value: string) => Promise<void>;
  refineTargeting: () => void;
  startOutreachWorkflow: () => void;
  toggleOutreachChannel: (channel: string) => void;
  toggleLeadSelection: (leadId: string) => void;
  selectAllLeads: () => void;
  clearLeadSelection: () => void;
  toggleLeadFeedback: (leadId: string, value: 'good' | 'bad') => void;
  updateLead: (leadId: string, patch: Partial<MobileAssistantLead>) => void;
  removeLead: (leadId: string) => void;
  addWorkflowStep: (
    platformId: string,
    action: { type: string; title: string; desc: string },
    insertion?: { relativeToId: string; position: 'before' | 'after' },
  ) => void;
  removeWorkflowStep: (stepId: string) => void;
  updateWorkflowStep: (stepId: string, patch: Partial<WorkflowStepDef>) => void;
  importLeads: (leads: MobileAssistantLead[], fileName?: string) => Promise<void>;
  launchOutreachCampaign: () => Promise<string | null>;
  loadMore: () => Promise<void>;
  resetConversation: () => void;

  // ── Configure-manually wizard (bidirectionally synced with the Flow canvas
  // via workflowConfigSync's deriveConfig/applyConfig) ──────────────────────
  openCheckpointWizard: (step?: number) => void;
  openManualConfigWizard: () => void;
  closeCheckpointWizard: () => void;
  setCpStepDirect: (step: number) => void;
  setCpIcpThreshold: (value: number) => void;
  setWorkflowChannels: (channels: string[] | ((current: string[]) => string[])) => void;
  setWorkflowLinkedInActions: (actions: string[]) => void;
  setWorkflowTriggerCondition: (condition: string) => void;
  setCpPersonalization: (flags: Partial<Pick<MobileAIAssistantState, 'cpEnableAiPersonalization' | 'cpEnableAiConnectionPersonalization' | 'cpEnableAiFollowupPersonalization' | 'cpEnableDailyWebPresence' | 'cpEnableDailyPosts'>>) => void;
  letAgentDeal: () => Promise<void>;
  setCampaignName: (name: string) => void;
  setCampaignDays: (days: number) => void;
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const summarizeHistory = (messages: AssistantChatMessage[]) =>
  messages
    .slice(-8)
    .map((message) => ({ role: message.role === 'assistant' ? 'ai' : 'user', text: message.text }))
    .filter((message) => message.text);

const getAssistantText = (response: Record<string, any> | null | undefined, fallback: string) =>
  String(response?.response ?? response?.text ?? response?.message ?? fallback);

const timeoutAfter = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out. Trying the faster search path.`)), timeoutMs);
    }),
  ]);

const isBackendTimeout = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /timed out|aborted|aborterror|operation was aborted/i.test(message);
};

const isResearchQuery = (text: string) =>
  /\b(get me|tell me|give me|show me|research|look up|details about|info about|information about|overview of|summary of)\b/i.test(text)
  && /\b(company|startup|firm|corp|brand|business|person|people|lead)\b/i.test(text);

const isAbmQuery = (text: string) =>
  /\b(account[\s-]?based|abm|detailed insights?|company intelligence|company analysis|research the company|target company)\b/i.test(text);

const compactResearchText = (data: Record<string, any>, fallbackQuery: string) => {
  const result = data.data ?? data.result ?? data;
  if (!result || typeof result !== 'object') return `I could not find enough research for ${fallbackQuery}.`;

  const company = result.company_name || result.full_name || result.name || fallbackQuery;
  const parts = [`${company}`];
  if (result.company_overview) parts.push(result.company_overview);
  if (result.description) parts.push(result.description);
  if (result.industry) parts.push(`Industry: ${result.industry}`);
  if (result.headquarters) parts.push(`HQ: ${result.headquarters}`);
  if (result.company_size_range || result.company_size) parts.push(`Size: ${result.company_size_range || result.company_size}`);
  if (result.website) parts.push(`Website: ${result.website}`);
  if (result.linkedin_url) parts.push(`LinkedIn: ${result.linkedin_url}`);
  const dms = Array.isArray(result.key_decision_makers) ? result.key_decision_makers.slice(0, 4) : [];
  if (dms.length) {
    parts.push(`Decision makers: ${dms.map((dm: any) => `${dm.name || 'Unknown'}${dm.title ? `, ${dm.title}` : ''}`).join('; ')}`);
  }
  return parts.filter(Boolean).join('\n\n');
};

const shouldUseGenericProspectSearch = (text: string) => {
  if (!isGenericCompanySearchQuery(text)) return false;
  return /\b(hotels?|companies|businesses|firms|agencies|stores?|chains?|brands?|venues?|properties|facilities)\b/i.test(text);
};

const isLeadSearchPrompt = (text: string) =>
  /\b(find|get|show|search|source|give|need|looking for|leads?|prospects?|people|decision makers?|owners?|founders?|ceos?|directors?|managers?|heads?|vp|sales navigator|linkedin)\b/i.test(text)
  && !isResearchQuery(text);

const normalizeSearchResults = (results: unknown[]) => results.map(normalizeLead);

const channelFromJourney = (channel: string) => {
  const normalized = channel.toLowerCase();
  if (normalized.includes('whatsapp')) return 'whatsapp';
  if (normalized.includes('voice')) return 'voice';
  if (normalized.includes('email')) return 'email';
  return 'linkedin';
};

const defaultChannelsFor = (_leads: MobileAssistantLead[]) => {
  return ['linkedin', 'email', 'whatsapp', 'voice'];
};

const getCampaignId = (payload: Record<string, any>) => {
  const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, any> : null;
  const result = payload.result && typeof payload.result === 'object' ? payload.result as Record<string, any> : null;
  const campaign = payload.campaign && typeof payload.campaign === 'object' ? payload.campaign as Record<string, any> : null;
  const nestedCampaign = data?.campaign && typeof data.campaign === 'object' ? data.campaign as Record<string, any> : null;
  const record = nestedCampaign || campaign || data || result || payload;
  return String(
    record.id
    ?? record.campaign_id
    ?? record.campaignId
    ?? payload.campaign_id
    ?? payload.campaignId
    ?? '',
  );
};

const getCampaignError = (payload: Record<string, any>) =>
  String(
    payload.error
    ?? payload.message
    ?? payload.reason
    ?? payload.data?.error
    ?? payload.data?.message
    ?? payload.result?.error
    ?? '',
  ).trim();

const findAcceleratorTemplate = (key: string) => WORKFLOW_TEMPLATES.find((template) => template.key === key);

const isYesAnswer = (text: string) =>
  /^(y|yes|yeah|yep|sure|ok(ay)?|please|write|edit|customi[sz]e)/i.test(text.trim());

const isSkipAnswer = (text: string) => /^(skip|no|none|-)$/i.test(text.trim());

const effectiveAcceleratorSourceConfig = (templateKey: string, answers: Record<string, string>) => {
  const template = findAcceleratorTemplate(templateKey);
  if (!template) return {};
  const { sourceCfg } = splitWizardAnswers(template, answers);
  return { ...(template.source?.cfg || {}), ...sourceCfg };
};

export const useAdvancedSearchStore = create<MobileAIAssistantState>((set, get) => {
  let hasHydrated = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const writeSnapshot = async () => {
    const state = get();
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages: state.messages.slice(-50),
      leads: state.leads,
      targeting: state.targeting,
      recentSearches: state.recentSearches,
      conversationId: state.conversationId,
      conversationSummary: state.conversationSummary,
      outreachWorkflowStage: state.outreachWorkflowStage,
      selectedOutreachChannels: state.selectedOutreachChannels,
      workflowSteps: state.workflowSteps,
      selectedLeadIds: state.selectedLeadIds,
      leadFeedback: state.leadFeedback,
      importedMode: state.importedMode,
      campaignName: state.campaignName,
      campaignDays: state.campaignDays,
      launchedCampaignId: state.launchedCampaignId,
      cpIcpThreshold: state.cpIcpThreshold,
      cpEnableAiPersonalization: state.cpEnableAiPersonalization,
      cpEnableAiConnectionPersonalization: state.cpEnableAiConnectionPersonalization,
      cpEnableAiFollowupPersonalization: state.cpEnableAiFollowupPersonalization,
      cpEnableDailyWebPresence: state.cpEnableDailyWebPresence,
      cpEnableDailyPosts: state.cpEnableDailyPosts,
      acceleratorWizard: state.acceleratorWizard,
    }));
  };

  // Debounced so rapid taps (e.g. selecting/deselecting several leads or
  // campaign channels in a row) collapse into a single JSON.stringify + write
  // instead of one per tap, which was a source of Android jank.
  const persist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void writeSnapshot();
    }, 400);
  };

  const addMessage = (message: Omit<AssistantChatMessage, 'id' | 'timestamp'>) => {
    const nextMessage: AssistantChatMessage = {
      id: createId(message.role),
      timestamp: Date.now(),
      ...message,
    };
    set((state) => ({ messages: [...state.messages, nextMessage] }));
    void persist();
    return nextMessage;
  };

  const CONFIRM_SEARCH_OPTIONS = [
    { label: 'Yes, search this', value: 'yes' },
    { label: 'Refine target', value: 'I want to change what I am looking for' },
  ];

  // Shows the "does this look right?" preview for extracted targeting — but a
  // named person at a company with no location first pauses on the location
  // gate (mirrors web's ABM location gate), so we never hallucinate a location
  // or silently search worldwide.
  const promptSearchConfirmation = (intent: LeadTargeting, originalQuery: string) => {
    const person = detectSpecificPersonQuery(intent);
    if (person && !(intent.locations || []).length) {
      set({
        targeting: intent,
        pendingLocationRequest: { intent, originalQuery },
        pendingSearchConfirmation: null,
      });
      addMessage({
        role: 'assistant',
        text: `📍 I found **${person.name}**${person.company ? ` at **${person.company}**` : ''}. Which location should I search in?\n\n(e.g., Dubai, London, New York — or type **global** to search worldwide)`,
        options: [
          { label: '🌍 Global (worldwide)', value: 'global' },
          { label: '🇦🇪 Dubai / UAE', value: 'Dubai, UAE' },
          { label: '🇬🇧 London / UK', value: 'London, UK' },
          { label: '🇺🇸 United States', value: 'United States' },
        ],
      });
      return;
    }
    set({ targeting: intent, pendingSearchConfirmation: { intent, originalQuery } });
    addMessage({
      role: 'assistant',
      text: buildConfirmationMessage(intent),
      options: CONFIRM_SEARCH_OPTIONS,
    });
  };

  // Persist imported/parsed leads to the backend leads table and run the same
  // Google/LinkedIn enrichment pass web does (mirrors finishInboundImport in
  // advanced-search-ai/page.tsx). Corrects the local rows with the backend's
  // canonical + enriched data — real UUIDs, discovered LinkedIn URLs, job
  // titles and AI research summaries — once each call lands.
  const persistAndEnrichImportedLeads = async (imported: MobileAssistantLead[], location?: string) => {
    const saveResult = await saveImportedLeads(imported, location);
    if (!saveResult.leadIds.length) return;

    let leads = get().leads;
    if (saveResult.leads.length) {
      // The backend's saved rows carry the real UUIDs (and any discovered
      // names/profiles), but they can be sparse — echoing back less than the
      // sheet provided. Merge them over the locally-parsed rows
      // (index-aligned, same order they were sent) instead of replacing, so a
      // fully-populated sheet never degrades to name-only cards. Backend
      // values win where present; savedLeadToMobileLead also never carries
      // email/phone, which only exist on the local rows.
      const localLeads = imported;
      leads = saveResult.leads.map((savedLead, index) => {
        const rebuilt = savedLeadToMobileLead(savedLead, index);
        const local = saveResult.leads.length === localLeads.length ? localLeads[index] : undefined;
        if (!local) return rebuilt;
        const backendHasName = Boolean(rebuilt.firstName || rebuilt.lastName);
        return {
          ...rebuilt,
          name: backendHasName ? rebuilt.name : (local.name || rebuilt.name),
          firstName: rebuilt.firstName || local.firstName,
          lastName: rebuilt.lastName || local.lastName,
          headline: rebuilt.headline || local.headline,
          company: rebuilt.company || local.company,
          location: rebuilt.location || local.location,
          profileUrl: rebuilt.profileUrl || local.profileUrl,
          profilePicture: rebuilt.profilePicture || local.profilePicture,
          industry: local.industry,
          email: local.email,
          phone: local.phone,
          raw: { ...(local.raw || {}), ...(rebuilt.raw || {}) },
        };
      });
      set({ leads, selectedLeadIds: leads.map((lead) => lead.id) });
      void persist();
    } else {
      // No canonical rows came back — at least carry over the real backend
      // ids (index-aligned) so campaign launch can link to the leads table.
      leads = leads.map((lead, index) => ({ ...lead, id: saveResult.leadIds[index] || lead.id }));
      set({ leads, selectedLeadIds: leads.map((lead) => lead.id) });
      void persist();
    }

    const enrichResult = await enrichInboundLeads(saveResult.leadIds);
    if (!enrichResult.success || !enrichResult.results.length) return;

    const fannedOut = enrichResult.results.length > leads.length;
    if (fannedOut) {
      const rebuilt = enrichResult.results.map((result, index) => {
        const lead = savedLeadToMobileLead({
          id: result.leadId,
          name: result.name,
          firstName: result.firstName,
          lastName: result.lastName,
          company: result.company,
          title: result.job_title,
          linkedin_url: result.linkedin_url,
          profile_picture: result.profile_picture,
        }, index);
        return {
          ...lead,
          email: result.email || '',
          phone: result.phone || '',
          industry: result.industry || '',
          raw: result.background_summary
            ? { ...(lead.raw || {}), background_summary: result.background_summary }
            : lead.raw,
        };
      });
      set({ leads: rebuilt, selectedLeadIds: rebuilt.map((lead) => lead.id) });
    } else {
      // 1:1 imports — merge the enrichment into each row (keeps any
      // email/phone/name the source file provided).
      const resultByLeadId = new Map(enrichResult.results.map((result) => [result.leadId, result]));
      set((state) => ({
        leads: state.leads.map((lead) => {
          const enriched = resultByLeadId.get(lead.id);
          if (!enriched) return lead;
          return {
            ...lead,
            name: lead.name && lead.name !== 'Imported lead' ? lead.name : (enriched.name || lead.name),
            firstName: lead.firstName || enriched.firstName || '',
            lastName: lead.lastName || enriched.lastName || '',
            company: lead.company || enriched.company || '',
            headline: enriched.job_title || lead.headline,
            profileUrl: lead.profileUrl || enriched.linkedin_url || '',
            email: lead.email || enriched.email || '',
            phone: lead.phone || enriched.phone || '',
            industry: lead.industry || enriched.industry || '',
            profilePicture: lead.profilePicture || enriched.profile_picture || '',
            raw: enriched.background_summary
              ? { ...(lead.raw || {}), background_summary: enriched.background_summary }
              : lead.raw,
          };
        }),
      }));
    }
    void persist();
  };

  // Routes a confirmed "Name at Company" query through the inbound-import
  // pipeline instead of broad search: the backend resolves the exact person's
  // LinkedIn profile and researches them, then the Imported Leads panel shows
  // the resolved card (mirrors web's SPECIFIC-PERSON GATE).
  const importSpecificPerson = async (person: { name: string; title: string; company: string; location: string }) => {
    addMessage({
      role: 'assistant',
      text: `🎯 Got it — **${person.name}**${person.company ? ` at **${person.company}**` : ''} is a specific person, so I'll skip the broad search and find their LinkedIn profile directly.`,
    });

    const [firstName, ...restName] = person.name.split(/\s+/);
    const personLead: MobileAssistantLead = {
      id: `person-${Date.now()}`,
      name: person.name,
      firstName: firstName || person.name,
      lastName: restName.join(' '),
      // Raw title only — this row is persisted via saveImportedLeads, which
      // sends `headline` as the lead's title for backend person-resolution.
      headline: person.title,
      location: person.location,
      company: person.company,
      profileUrl: '',
      locked: false,
    };

    set({
      leads: [personLead],
      importedMode: true,
      selectedLeadIds: [personLead.id],
      leadFeedback: {},
      outreachJourney: buildOutreachJourney([personLead], null),
      workflowSteps: [],
      selectedOutreachChannels: [],
      outreachWorkflowStage: 'idle',
      totalResults: 1,
      lastModuleUsed: 'imported_leads',
      pendingSearchConfirmation: null,
      pendingLocationRequest: null,
      pendingIntent: null,
      isSearching: true,
      error: null,
    });
    void persist();

    try {
      await persistAndEnrichImportedLeads([personLead], person.location || undefined);
      const resolved = get().leads[0];
      addMessage({
        role: 'assistant',
        text: resolved?.profileUrl
          ? `✅ Found **${resolved.name}**'s LinkedIn profile. They're in your **Imported Leads** panel with an AI research summary — select them and launch your outreach journey when ready.`
          : `I've added **${person.name}** to your **Imported Leads**, but could not confirm their LinkedIn profile yet. You can edit the lead to add it, or launch the campaign as-is.`,
        options: [{ label: 'Create Outreach Journey', value: '__create_outreach_journey__' }],
      });
    } catch (personImportError) {
      console.warn('[AI Assistant] Person import failed:', personImportError);
      addMessage({
        role: 'assistant',
        text: `I saved **${person.name}** to your Imported Leads, but the background research did not finish. You can retry, or edit the lead manually.`,
      });
    } finally {
      set({ isSearching: false });
      void persist();
    }
  };

  const runLinkedInSearch = async (text: string, intent?: LeadTargeting | null, confirmed = false) => {
    const state = get();
    const searchQuery = confirmed && state.pendingSearchConfirmation?.originalQuery
      ? state.pendingSearchConfirmation.originalQuery
      : text;
    const activeIntent = intent ?? state.targeting;
    const icpDescription = searchQuery;

    set({ isSearching: true, error: null });
    const response = await timeoutAfter(
      searchLinkedInUnified({
        query: searchQuery,
        count: DEFAULT_LEAD_COUNT,
        targeting: activeIntent || undefined,
        icp_description: icpDescription,
        useSalesNav: get().useSalesNav,
      }),
      ASSISTANT_SEARCH_TIMEOUT_MS,
      'Lead search',
    );

    const leads = normalizeSearchResults(response.results || []);
    const responseRecord = response as Record<string, any>;
    const nextTargeting = normalizeTargeting(responseRecord.intent) || activeIntent || null;
    const journey = buildOutreachJourney(leads, nextTargeting);
    set((current) => ({
      leads,
      targeting: nextTargeting,
      outreachJourney: journey,
      workflowSteps: current.selectedOutreachChannels.length ? buildWorkflowSteps(current.selectedOutreachChannels, true) : [],
      selectedLeadIds: leads.map((lead) => lead.id),
      importedMode: false,
      lastSearchQuery: searchQuery,
      lastTargeting: nextTargeting,
      lastIcpDescription: icpDescription,
      lastSearchType: 'linkedin',
      lastModuleUsed: String(response.module_used ?? 'advanced_search'),
      searchCursor: response.cursor,
      totalResults: response.total || leads.length,
      pendingSearchConfirmation: null,
      isSearching: false,
      recentSearches: [searchQuery, ...current.recentSearches.filter((item) => item.toLowerCase() !== searchQuery.toLowerCase())].slice(0, 8),
    }));

    addMessage({
      role: 'assistant',
      text: leads.length
        ? `✅ Found ${leads.length} lead${leads.length === 1 ? '' : 's'}. ${leads.filter((lead) => (lead.score ?? 0) >= 70).length} look like strong matches. Your leads are shown in the Leads panel — you can refine or start connecting.`
        : 'I searched but did not find matching leads. Try broadening the role, industry, or location.',
      leads,
    });
  };

  const runGenericProspectSearch = async (text: string) => {
    set({ isSearching: true, error: null });
    try {
      const response = await timeoutAfter(
        searchGenericProspects({
          query: text,
          sessionId: `mobile-gps-${Date.now()}`,
          seenIds: [],
          batchSize: DEFAULT_LEAD_COUNT,
        }),
        ASSISTANT_SEARCH_TIMEOUT_MS,
        'Prospect search',
      );
      const leads = normalizeSearchResults(response.results || []);
      const journey = buildOutreachJourney(leads, get().targeting);
      set((state) => ({
        leads,
        outreachJourney: journey,
        workflowSteps: state.selectedOutreachChannels.length ? buildWorkflowSteps(state.selectedOutreachChannels, true) : [],
        selectedLeadIds: leads.map((lead) => lead.id),
        importedMode: false,
        lastSearchQuery: text,
        lastSearchType: 'generic_prospect',
        seenProspectIds: leads.map((lead) => lead.profileUrl || lead.id),
        totalResults: response.total || leads.length,
        searchCursor: null,
        isSearching: false,
        recentSearches: [text, ...state.recentSearches.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, 8),
      }));
      addMessage({
        role: 'assistant',
        text: leads.length
          ? `✅ Found ${leads.length} researched prospect${leads.length === 1 ? '' : 's'} with decision-maker data and scoring. Your leads are shown in the Leads panel — you can refine or start connecting.`
          : 'I could not find researched prospects for that query. Try adding a location or a clearer company type.',
        leads,
      });
    } catch {
      const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction').catch(() => null);
      const intent = normalizeTargeting(intentData?.intent) || get().targeting;
      await runLinkedInSearch(text, intent, false);
    }
  };

  const applyAcceleratorToWorkflow = (templateKey: string, answers: Record<string, string>) => {
    const template = findAcceleratorTemplate(templateKey);
    if (!template) return null;
    const { sourceCfg, nodeCfg } = splitWizardAnswers(template, answers);
    const sourceConfig = { ...(template.source?.cfg || {}), ...sourceCfg };
    const workflowSteps = buildAcceleratorWorkflowSteps(template, sourceCfg, nodeCfg);
    const channels = acceleratorChannelsFromSteps(workflowSteps);
    const targeting = targetingFromAcceleratorSource(sourceConfig) || get().targeting;
    const searchQuery = templateSearchQuery(template, sourceCfg) || template.name;

    set((state) => ({
      workflowSteps,
      selectedOutreachChannels: channels.length ? channels : ['linkedin'],
      outreachWorkflowStage: 'configuring',
      campaignName: state.campaignName || template.name,
      campaignDays: state.campaignDays || 30,
      targeting,
      lastTargeting: targeting,
      lastSearchQuery: searchQuery,
      lastIcpDescription: searchQuery,
      pendingSearchConfirmation: null,
      pendingLocationRequest: null,
      pendingIntent: null,
      cpStep: -1,
      error: null,
    }));
    void persist();
    return { template, workflowSteps, searchQuery, targeting };
  };

  const previewAccelerator = async () => {
    const wizard = get().acceleratorWizard;
    if (!wizard || get().acceleratorPreviewing) return;
    const template = findAcceleratorTemplate(wizard.key);
    if (!template) return;
    const { sourceCfg } = splitWizardAnswers(template, wizard.answers);
    const query = templateSearchQuery(template, sourceCfg);
    if (!query) {
      addMessage({ role: 'assistant', text: 'This Accelerator does not run a LinkedIn audience search, so there is nothing to preview yet.' });
      return;
    }

    const sourceConfig = effectiveAcceleratorSourceConfig(template.key, wizard.answers);
    const previewTargeting = targetingFromAcceleratorSource(sourceConfig);
    set({ acceleratorPreviewing: true, isSearching: true, error: null });
    addMessage({ role: 'assistant', text: `Previewing who this Accelerator would reach: **${query}**` });
    try {
      const response = await timeoutAfter(
        searchLinkedInUnified({
          query,
          count: DEFAULT_LEAD_COUNT,
          targeting: previewTargeting || undefined,
          icp_description: query,
          useSalesNav: get().useSalesNav,
          icp_min_score: 0,
        }),
        ASSISTANT_SEARCH_TIMEOUT_MS,
        'Accelerator preview',
      );
      const leads = normalizeSearchResults(response.results || []);
      set((state) => ({
        leads,
        selectedLeadIds: leads.map((lead) => lead.id),
        leadFeedback: {},
        importedMode: false,
        lastSearchQuery: query,
        lastTargeting: previewTargeting || state.targeting,
        targeting: previewTargeting || state.targeting,
        lastIcpDescription: query,
        lastSearchType: 'linkedin',
        lastModuleUsed: String(response.module_used ?? 'advanced_search'),
        searchCursor: response.cursor,
        totalResults: response.total || leads.length,
        recentSearches: [query, ...state.recentSearches.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8),
      }));
      addMessage({
        role: 'assistant',
        text: leads.length
          ? `Found **${response.total || leads.length}** matching profiles. Open Leads to inspect them, then activate the Accelerator when you are ready.`
          : 'No profiles came back for that targeting. Widen the titles or location, or cancel and pick the Accelerator again.',
        leads: leads.slice(0, 3),
      });
    } catch {
      addMessage({ role: 'assistant', text: 'The preview search failed. You can still activate the Accelerator; it runs from the configured workflow when launched.' });
    } finally {
      set({ acceleratorPreviewing: false, isSearching: false });
      addMessage({ role: 'assistant', text: '', roleCard: { key: wizard.key, stage: 'summary', answers: { ...wizard.answers } } });
    }
  };

  return {
    messages: [],
    input: '',
    leads: [],
    targeting: null,
    pendingSearchConfirmation: null,
    pendingLocationRequest: null,
    pendingIntent: null,
    conversationId: createId('mobile-session'),
    conversationSummary: '',
    recentSearches: [],
    outreachJourney: [],
    outreachWorkflowStage: 'idle',
    selectedOutreachChannels: [],
    workflowSteps: [],
    selectedLeadIds: [],
    leadFeedback: {},
    importedMode: false,
    campaignName: '',
    campaignDays: 30,
    launchedCampaignId: null,
    cpStep: -1,
    cpIcpThreshold: 0,
    cpEnableAiPersonalization: true,
    cpEnableAiConnectionPersonalization: true,
    cpEnableAiFollowupPersonalization: true,
    cpEnableDailyWebPresence: false,
    cpEnableDailyPosts: false,
    cpAgentDealLoading: false,
    lastSearchQuery: '',
    lastTargeting: null,
    lastIcpDescription: '',
    lastSearchType: 'linkedin',
    lastModuleUsed: 'advanced_search',
    searchCursor: null,
    seenProspectIds: [],
    totalResults: 0,
    useSalesNav: false,
    acceleratorWizard: null,
    acceleratorPreviewing: false,
    isBusy: false,
    isSearching: false,
    isLoadingMore: false,
    error: null,

    hydrate: async () => {
      if (hasHydrated) return;
      hasHydrated = true;
      try {
        const raw = await safeStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<MobileAIAssistantState>;
        set({
          messages: parsed.messages?.length ? parsed.messages : [],
          leads: parsed.leads ?? [],
          targeting: parsed.targeting ?? null,
          recentSearches: parsed.recentSearches ?? [],
        conversationId: parsed.conversationId ?? createId('mobile-session'),
        conversationSummary: parsed.conversationSummary ?? '',
        // 'launching' is a transient in-flight status — if the app was closed or
        // crashed mid-launch, it would otherwise rehydrate forever with no request
        // actually in flight to resolve it, leaving Launch/Configure-manually stuck
        // showing a spinner with no way to recover.
        outreachWorkflowStage: parsed.outreachWorkflowStage === 'launching'
          ? 'configuring'
          : (parsed.outreachWorkflowStage ?? 'idle'),
        selectedOutreachChannels: parsed.selectedOutreachChannels ?? [],
        workflowSteps: parsed.workflowSteps ?? [],
        selectedLeadIds: parsed.selectedLeadIds ?? [],
        leadFeedback: parsed.leadFeedback ?? {},
        importedMode: parsed.importedMode ?? false,
        campaignName: parsed.campaignName ?? '',
        campaignDays: parsed.campaignDays ?? 30,
        launchedCampaignId: parsed.launchedCampaignId ?? null,
        cpIcpThreshold: parsed.cpIcpThreshold ?? 0,
        cpEnableAiPersonalization: parsed.cpEnableAiPersonalization ?? true,
        cpEnableAiConnectionPersonalization: parsed.cpEnableAiConnectionPersonalization ?? true,
        cpEnableAiFollowupPersonalization: parsed.cpEnableAiFollowupPersonalization ?? true,
        cpEnableDailyWebPresence: parsed.cpEnableDailyWebPresence ?? false,
        cpEnableDailyPosts: parsed.cpEnableDailyPosts ?? false,
        acceleratorWizard: parsed.acceleratorWizard ?? null,
      });
      } catch {
        set({ error: 'Unable to restore assistant history.' });
      }
    },

    setInput: (value) => set({ input: value }),
    toggleSalesNav: () => set((state) => ({ useSalesNav: !state.useSalesNav })),

    startAccelerator: (templateKey) => {
      const template = findAcceleratorTemplate(templateKey);
      if (!template) return;

      const inputs = templateWizardInputs(template);
      const nextWizard = { key: template.key, idx: inputs.length ? 0 : inputs.length, answers: {} };
      const timestamp = Date.now();
      const messages: AssistantChatMessage[] = [
        {
          id: createId('user'),
          role: 'user',
          text: `Role: ${template.name}`,
          timestamp,
        },
        {
          id: createId('assistant'),
          role: 'assistant',
          text: '',
          timestamp: timestamp + 1,
          roleCard: template.requiresFile
            ? { key: template.key, stage: 'file' }
            : inputs.length
              ? { key: template.key, stage: 'intro', qIdx: 0 }
              : { key: template.key, stage: 'summary', answers: {} },
        },
      ];

      set({
        messages,
        input: '',
        leads: [],
        targeting: null,
        pendingSearchConfirmation: null,
        pendingLocationRequest: null,
        pendingIntent: null,
        conversationId: createId('mobile-session'),
        conversationSummary: '',
        recentSearches: [],
        outreachJourney: [],
        outreachWorkflowStage: 'idle',
        selectedOutreachChannels: [],
        workflowSteps: [],
        selectedLeadIds: [],
        leadFeedback: {},
        importedMode: false,
        campaignName: template.name,
        campaignDays: 30,
        launchedCampaignId: null,
        cpStep: -1,
        cpAgentDealLoading: false,
        lastSearchQuery: '',
        lastTargeting: null,
        lastIcpDescription: '',
        lastSearchType: 'linkedin',
        lastModuleUsed: 'advanced_search',
        searchCursor: null,
        seenProspectIds: [],
        totalResults: 0,
        acceleratorWizard: template.requiresFile ? null : nextWizard,
        acceleratorPreviewing: false,
        isBusy: false,
        isSearching: false,
        isLoadingMore: false,
        error: null,
      });
      void persist();
    },

    submitMessage: async (message) => {
      const text = (message ?? get().input).trim();
      if (!text || get().isBusy || get().isSearching) return;

      const activeAccelerator = get().acceleratorWizard;
      if (activeAccelerator) {
        set({ input: '', error: null });
        const template = findAcceleratorTemplate(activeAccelerator.key);
        if (!template) {
          set({ acceleratorWizard: null });
          return;
        }

        const inputs = templateWizardInputs(template);
        const input = inputs[activeAccelerator.idx];
        addMessage({ role: 'user', text });

        if (!input) {
          addMessage({ role: 'assistant', text: '', roleCard: { key: template.key, stage: 'summary', answers: activeAccelerator.answers } });
          return;
        }

        if (input.target === 'gate') {
          const nextIndex = isYesAnswer(text) ? activeAccelerator.idx + 1 : inputs.length;
          const nextWizard = { ...activeAccelerator, idx: nextIndex };
          set({ acceleratorWizard: nextWizard });
          addMessage({
            role: 'assistant',
            text: '',
            roleCard: nextIndex < inputs.length
              ? { key: template.key, stage: 'question', qIdx: nextIndex }
              : { key: template.key, stage: 'summary', answers: activeAccelerator.answers },
          });
          return;
        }

        const skipped = Boolean(input.optional && isSkipAnswer(text));
        const value = skipped ? '' : text;
        if (!value && !input.optional) {
          set({ acceleratorWizard: activeAccelerator });
          addMessage({ role: 'assistant', text: '', roleCard: { key: template.key, stage: 'question', qIdx: activeAccelerator.idx, nudge: true } });
          return;
        }

        const answers = value
          ? { ...activeAccelerator.answers, [input.key]: value }
          : { ...activeAccelerator.answers };
        const nextIndex = activeAccelerator.idx + 1;
        const nextWizard = { key: template.key, idx: nextIndex, answers };
        set({ acceleratorWizard: nextWizard });
        addMessage({
          role: 'assistant',
          text: '',
          roleCard: nextIndex < inputs.length
            ? { key: template.key, stage: 'question', qIdx: nextIndex }
            : { key: template.key, stage: 'summary', answers },
        });
        return;
      }

      set({ input: '', isBusy: true, error: null });
      addMessage({ role: 'user', text });

      try {
        // ── Location-gate reply ── a person-at-company query paused on
        // "which location?"; this message answers it, then shows the normal
        // search confirmation with the resolved location.
        const pendingLocation = get().pendingLocationRequest;
        if (pendingLocation) {
          const locationReply = text.trim();
          const isGlobal = /^(global|worldwide|everywhere|anywhere)$/i.test(locationReply);
          const mergedIntent: LeadTargeting = {
            ...pendingLocation.intent,
            locations: isGlobal ? [] : [locationReply],
          };
          set({
            pendingLocationRequest: null,
            targeting: mergedIntent,
            pendingSearchConfirmation: { intent: mergedIntent, originalQuery: pendingLocation.originalQuery },
            isBusy: false,
          });
          addMessage({
            role: 'assistant',
            text: buildConfirmationMessage(mergedIntent),
            options: CONFIRM_SEARCH_OPTIONS,
          });
          return;
        }

        const pending = get().pendingSearchConfirmation;
        if (pending && isConfirmation(text)) {
          // ── Specific-person gate ── a confirmed one-person query skips the
          // broad search entirely and resolves that person's profile directly.
          const person = detectSpecificPersonQuery(pending.intent);
          if (person) {
            set({ pendingSearchConfirmation: null });
            await importSpecificPerson(person);
            set({ isBusy: false });
            return;
          }
          await runLinkedInSearch(pending.originalQuery, pending.intent, true);
          set({ isBusy: false });
          return;
        }

        if (isAbmQuery(text)) {
          const data = await researchAccount(text);
          addMessage({ role: 'assistant', text: compactResearchText(data, text), webSearchResult: true });
          set({ isBusy: false });
          return;
        }

        if (isResearchQuery(text)) {
          const data = await webResearch(text);
          addMessage({ role: 'assistant', text: compactResearchText(data, text), webSearchResult: true });
          set({ isBusy: false });
          return;
        }

        if (shouldUseGenericProspectSearch(text)) {
          await runGenericProspectSearch(text);
          set({ isBusy: false });
          return;
        }

        if (isLeadSearchPrompt(text)) {
          const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction').catch(() => null);
          const intent = normalizeTargeting(intentData?.intent);
          if (intent) {
            promptSearchConfirmation(intent, text);
          } else {
            await runLinkedInSearch(text, get().targeting, false);
          }
          set({ isBusy: false });
          return;
        }

        let chat = null;
        try {
          chat = await timeoutAfter(
            sendLeadChat({
              message: text,
              history: summarizeHistory(get().messages),
              currentTargeting: get().targeting,
              pendingIntent: get().pendingIntent,
              conversationId: get().conversationId,
              conversationSummary: get().conversationSummary,
              mobile: true,
            }),
            LEAD_CHAT_TIMEOUT_MS,
            'Lead chat',
          );
        } catch (chatError) {
          if (!isBackendTimeout(chatError)) {
            throw chatError;
          }

          const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction').catch(() => null);
          const intent = normalizeTargeting(intentData?.intent);
          if (intent) {
            promptSearchConfirmation(intent, text);
            set({ isBusy: false });
            return;
          }

          await runLinkedInSearch(text, get().targeting, false);
          set({ isBusy: false });
          return;
        }

        const updatedTargeting = normalizeTargeting(chat?.updatedTargeting ?? chat?.targeting) || get().targeting;
        const shouldSearch = Boolean(chat?.newSearch || chat?.shouldSearch);
        const assistantText = getAssistantText(chat, shouldSearch ? 'I found search intent in your request.' : 'I can help with that.');

        if (updatedTargeting && shouldSearch) {
          set({ pendingIntent: chat?.pendingIntent ?? null });
          promptSearchConfirmation(updatedTargeting, text);
          set({ isBusy: false });
          return;
        }

        if (shouldSearch) {
          const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction');
          const intent = normalizeTargeting(intentData.intent);
          if (intent) {
            promptSearchConfirmation(intent, text);
          } else {
            await runLinkedInSearch(text, updatedTargeting, false);
          }
          set({ isBusy: false });
          return;
        }

        addMessage({ role: 'assistant', text: assistantText, options: chat?.options });
        set({ targeting: updatedTargeting, pendingIntent: chat?.pendingIntent ?? null, isBusy: false });
      } catch (error) {
        const timedOut = isBackendTimeout(error);
        set({
          isBusy: false,
          isSearching: false,
          error: timedOut ? null : error instanceof Error ? error.message : 'Assistant request failed.',
        });
        addMessage({
          role: 'assistant',
          text: timedOut
            ? 'That search is taking longer than expected. Try a broader role, industry, or location, then tap Yes to search again.'
            : 'I could not complete that request. Please try again or make the target more specific.',
          options: timedOut
            ? [
                { label: 'Refine target', value: 'I want to change what I am looking for' },
                { label: 'Try again', value: text },
              ]
            : undefined,
        });
      }
    },

    chooseOption: async (value) => {
      if (value === '__role_gate_yes__' || value === '__role_gate_no__') {
        await get().submitMessage(value === '__role_gate_yes__' ? 'yes' : 'skip');
        return;
      }

      // Accelerator quick replies are exact shortcuts for typed answers. Keep
      // them on submitMessage's existing validation/advance path so button and
      // keyboard input can never produce different wizard state.
      if (value.startsWith('__role_answer__:')) {
        await get().submitMessage(value.slice('__role_answer__:'.length));
        return;
      }

      if (value === '__role_cancel__') {
        set({ acceleratorWizard: null, acceleratorPreviewing: false });
        addMessage({ role: 'assistant', text: 'No problem. Accelerator setup cancelled. Pick another from the **Accelerators** menu any time.' });
        return;
      }

      if (value === '__role_preview__') {
        await previewAccelerator();
        return;
      }

      if (value.startsWith('__role_builder__:')) {
        const templateKey = value.slice('__role_builder__:'.length);
        const result = applyAcceleratorToWorkflow(templateKey, {});
        set({ acceleratorWizard: null });
        addMessage({
          role: 'assistant',
          text: result
            ? `Opened **${result.template.name}** in Flow. Review the source and steps, then launch when ready.`
            : 'I could not open that Accelerator. Please pick it again.',
        });
        return;
      }

      if (value === '__role_launch__' || value === '__role_review__') {
        const wizard = get().acceleratorWizard;
        if (!wizard) return;
        const result = applyAcceleratorToWorkflow(wizard.key, wizard.answers);
        set({ acceleratorWizard: null });
        if (!result) {
          addMessage({ role: 'assistant', text: 'I could not prepare that Accelerator. Please pick it again.' });
          return;
        }
        addMessage({
          role: 'assistant',
          text: value === '__role_launch__'
            ? `Building and launching **${result.template.name}** with the configured workflow.`
            : `Opened **${result.template.name}** in Flow with your answers applied. Review each step and launch when ready.`,
        });
        if (value === '__role_launch__') {
          await get().launchOutreachCampaign();
        }
        return;
      }

      if (value === '__start_campaign__' || value === '__create_outreach_journey__') {
        await get().launchOutreachCampaign();
        return;
      }

      if (value === '__launch_campaign__') {
        await get().launchOutreachCampaign();
        return;
      }

      if (value.startsWith('__toggle_channel__:')) {
        get().toggleOutreachChannel(value.replace('__toggle_channel__:', ''));
        return;
      }

      await get().submitMessage(value);
    },

    refineTargeting: () => {
      const state = get();
      const target = state.lastTargeting || state.targeting;
      const summary = target ? buildConfirmationMessage(target).replace('Does this look right? Tap Yes to search, or tell me what to change.', '').trim() : '';
      set({
        pendingSearchConfirmation: target && state.lastSearchQuery
          ? { intent: target, originalQuery: state.lastSearchQuery }
          : state.pendingSearchConfirmation,
        error: null,
      });
      addMessage({
        role: 'assistant',
        text: `${summary ? `${summary}\n\n` : ''}Tell me what to change: role, industry, location, keywords, or company size. I will update the targeting and search again.`,
        options: [
          { label: 'Broaden search', value: `Find more leads like ${state.lastSearchQuery || 'this search'} with broader filters` },
          { label: 'Change location', value: `${state.lastSearchQuery || 'Find similar leads'} in Dubai` },
          { label: 'Change roles', value: `${state.lastSearchQuery || 'Find similar leads'} for CEOs and founders` },
        ],
      });
    },

    startOutreachWorkflow: () => {
      const state = get();
      const channels = state.selectedOutreachChannels.length
        ? state.selectedOutreachChannels
        : defaultChannelsFor(state.leads);
      const nameTarget = state.lastTargeting?.industries?.[0] || state.lastSearchQuery || 'AI Growth';
      const campaignName = state.campaignName || `${nameTarget} Outreach`;
      set({
        outreachWorkflowStage: 'configuring',
        selectedOutreachChannels: channels,
        workflowSteps: state.workflowSteps.length
          ? state.workflowSteps
          : applyConfig(state.workflowSteps, { nextChannels: channels.map(toSyncChannel) }, { includeLeadSource: !state.importedMode }),
        campaignName,
        campaignDays: state.campaignDays || 30,
        error: null,
      });
    },

    // Preserves the exact order channels are toggled in — including LinkedIn,
    // which is no longer pinned first: appending it last renders it last in
    // the Flow diagram, same as any other channel. See buildStepsFromConfig
    // in workflowConfigSync.ts for how this order is carried through.
    toggleOutreachChannel: (channel) => {
      const normalized = channelFromJourney(channel);
      set((state) => {
        const exists = state.selectedOutreachChannels.includes(normalized);
        const nextChannels = exists
          ? state.selectedOutreachChannels.filter((item) => item !== normalized)
          : [...state.selectedOutreachChannels, normalized];
        const channels = nextChannels.length ? nextChannels : [normalized];
        return {
          selectedOutreachChannels: channels,
          workflowSteps: applyConfig(state.workflowSteps, { nextChannels: channels.map(toSyncChannel) }, { includeLeadSource: !state.importedMode }),
          outreachWorkflowStage: 'configuring',
        };
      });
    },

    toggleLeadSelection: (leadId) => {
      set((state) => ({
        selectedLeadIds: state.selectedLeadIds.includes(leadId)
          ? state.selectedLeadIds.filter((id) => id !== leadId)
          : [...state.selectedLeadIds, leadId],
      }));
      void persist();
    },

    selectAllLeads: () => {
      set((state) => ({ selectedLeadIds: state.leads.map((lead) => lead.id) }));
      void persist();
    },

    clearLeadSelection: () => {
      set({ selectedLeadIds: [] });
      void persist();
    },

    toggleLeadFeedback: (leadId, value) => {
      set((state) => {
        const next = { ...state.leadFeedback };
        if (next[leadId] === value) delete next[leadId]; else next[leadId] = value;
        return { leadFeedback: next };
      });
    },

    updateLead: (leadId, patch) => {
      set((state) => ({
        leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)),
      }));
      void persist();
    },

    removeLead: (leadId) => {
      set((state) => {
        const leadFeedback = { ...state.leadFeedback };
        delete leadFeedback[leadId];
        return {
          leads: state.leads.filter((lead) => lead.id !== leadId),
          selectedLeadIds: state.selectedLeadIds.filter((id) => id !== leadId),
          leadFeedback,
        };
      });
      void persist();
    },

    addWorkflowStep: (platformId, action, insertion) => {
      set((state) => {
        const isDeliveryChannel = ['linkedin', 'email', 'whatsapp', 'voice'].includes(platformId);
        const channels = !isDeliveryChannel || state.selectedOutreachChannels.includes(platformId)
          ? state.selectedOutreachChannels
          : [...state.selectedOutreachChannels, platformId];
        const workflowSteps = [...state.workflowSteps];
        const relativeIndex = insertion
          ? workflowSteps.findIndex((step) => step.id === insertion.relativeToId)
          : -1;
        const insertIndex = relativeIndex < 0
          ? workflowSteps.length
          : relativeIndex + (insertion?.position === 'after' ? 1 : 0);
        workflowSteps.splice(insertIndex, 0, createWorkflowStep(platformId, action));
        return {
          // Manual canvas insertion places the new step exactly where the
          // user dropped it (before/after a chosen node, or at the end) —
          // stampSequence renumbers every step's explicit `sequence` field
          // to match so the campaign payload's order_index stays correct.
          workflowSteps: stampSequence(workflowSteps),
          selectedOutreachChannels: channels,
          outreachWorkflowStage: 'configuring' as const,
          launchedCampaignId: null,
          error: null,
        };
      });
      void persist();
    },

    removeWorkflowStep: (stepId) => {
      set((state) => {
        const workflowSteps = state.workflowSteps.filter((step) => step.id !== stepId);
        const remainingChannels = acceleratorChannelsFromSteps(workflowSteps);
        return {
          workflowSteps: stampSequence(workflowSteps),
          selectedOutreachChannels: remainingChannels,
          outreachWorkflowStage: 'configuring' as const,
          launchedCampaignId: null,
          error: null,
        };
      });
      void persist();
    },

    updateWorkflowStep: (stepId, patch) => {
      set((state) => {
        const workflowSteps = state.workflowSteps.map((step) => (step.id === stepId ? { ...step, ...patch } : step));
        return {
          workflowSteps,
          selectedOutreachChannels: acceleratorChannelsFromSteps(workflowSteps),
          outreachWorkflowStage: 'configuring' as const,
          launchedCampaignId: null,
          error: null,
        };
      });
      void persist();
    },

    // ── Configure-manually wizard ──────────────────────────────────────────
    openCheckpointWizard: (step = 0) => {
      const state = get();
      if (!state.workflowSteps.length) {
        const channels = state.selectedOutreachChannels.length ? state.selectedOutreachChannels : defaultChannelsFor(state.leads);
        set({
          workflowSteps: applyConfig(state.workflowSteps, { nextChannels: channels.map(toSyncChannel) }, { includeLeadSource: !state.importedMode }),
          selectedOutreachChannels: channels,
        });
      }
      set({ cpStep: Math.max(0, step), outreachWorkflowStage: 'configuring' });
    },

    // "Configure manually" must open a blank slate — unlike openCheckpointWizard
    // above (shared with "Let Agent Deal", which intentionally seeds all
    // connected channels as a starting point), this always resets to just the
    // lead-source step so no channel comes pre-selected, and clears any config
    // left over from a previous Let-Agent-Deal run. Mirrors web's blank-seed
    // effect (advanced-search-ai/page.tsx: applyConfig([], {}, ...)).
    openManualConfigWizard: () => {
      const state = get();
      const blankSteps = state.importedMode
        ? []
        : [createWorkflowStep('linkedin', { type: 'lead_generation', title: 'Lead Search', desc: 'LinkedIn lead source' })];
      set({
        workflowSteps: blankSteps,
        selectedOutreachChannels: [],
        cpStep: 0,
        outreachWorkflowStage: 'configuring',
      });
    },

    closeCheckpointWizard: () => set({ cpStep: -1 }),

    setCpStepDirect: (step) => set({ cpStep: step }),

    setCpIcpThreshold: (value) => set({ cpIcpThreshold: value }),

    setWorkflowChannels: (channelsOrUpdater) => {
      set((state) => {
        const requestedChannels = typeof channelsOrUpdater === 'function'
          ? channelsOrUpdater(state.selectedOutreachChannels)
          : channelsOrUpdater;
        const channels = Array.from(new Set(requestedChannels.map(channelFromJourney)));
        const nextChannels = channels.length ? channels : ['linkedin'];
        const syncChannels = nextChannels.map(toSyncChannel);
        const workflowSteps = applyConfig(
          state.workflowSteps,
          {
            nextChannels: syncChannels,
            // A trigger coordinates two or more channels. Clear a previously
            // selected trigger when the workflow is reduced to LinkedIn only so
            // the hidden wizard step cannot remain in the campaign payload.
            ...(syncChannels.length <= 1 ? { triggerCondition: '' } : {}),
          },
          { includeLeadSource: !state.importedMode },
        );
        return {
          workflowSteps,
          selectedOutreachChannels: nextChannels,
        };
      });
      void persist();
    },

    setWorkflowLinkedInActions: (actionList) => {
      set((state) => ({
        workflowSteps: applyConfig(state.workflowSteps, { actions: actionList }, { includeLeadSource: !state.importedMode }),
      }));
      void persist();
    },

    setWorkflowTriggerCondition: (condition) => {
      set((state) => ({
        workflowSteps: applyConfig(state.workflowSteps, { triggerCondition: condition }, { includeLeadSource: !state.importedMode }),
      }));
      void persist();
    },

    setCpPersonalization: (flags) => {
      set(flags);
      void persist();
    },
    setCampaignName: (name) => {
      set({ campaignName: name });
      void persist();
    },
    setCampaignDays: (days) => {
      set({ campaignDays: days });
      void persist();
    },

    letAgentDeal: async () => {
      set({ cpAgentDealLoading: true, cpStep: 0, outreachWorkflowStage: 'configuring' });
      const state = get();
      const channels: string[] = ['linkedin'];
      try {
        const [agents, emailAccounts, emailIntegrations, whatsappIntegrations] = await Promise.all([
          getUserAvailableAgents().catch(() => []),
          getConnectedEmailAccounts().catch(() => []),
          getEmailIntegrations().catch(() => []),
          getWhatsAppIntegrations().catch(() => []),
        ]);
        if (emailAccounts.length || emailIntegrations.some((integration) => integration.connected)) channels.push('email');
        if (whatsappIntegrations.some((integration) => integration.connected)) channels.push('whatsapp');
        if (agents.length) channels.push('voice');
      } catch {
        // Connected-channel detection is best-effort — LinkedIn alone is a safe default.
      }

      const syncChannels = channels.map(toSyncChannel);
      const includeLeadSource = !state.importedMode;
      let workflowSteps = applyConfig(state.workflowSteps, { nextChannels: syncChannels, actions: ['profile_view', 'connect', 'message'] }, { includeLeadSource });
      if (channels.length > 1) {
        workflowSteps = applyConfig(workflowSteps, { triggerCondition: 'connection_accepted' }, { includeLeadSource });
      }
      workflowSteps = workflowSteps.map((step) => {
        if (step.type === 'linkedin_visit' || step.type === 'linkedin_connect' || step.type === 'linkedin_message') {
          return { ...step, delayDays: 0, delayHours: 0 };
        }
        if (step.type === 'email_send' || step.type === 'whatsapp_send') {
          return { ...step, delayDays: 2, delayHours: 0 };
        }
        if (step.type === 'voice_agent_call') {
          return { ...step, delayDays: 3, delayHours: 0 };
        }
        return step;
      });

      set({
        workflowSteps,
        selectedOutreachChannels: channels,
        cpEnableAiPersonalization: true,
        cpEnableAiConnectionPersonalization: true,
        cpEnableAiFollowupPersonalization: true,
        cpEnableDailyWebPresence: true,
        cpEnableDailyPosts: true,
        cpAgentDealLoading: false,
        cpStep: 0,
        outreachWorkflowStage: 'configuring',
      });
      void persist();
    },

    importLeads: async (imported, fileName) => {
      if (!imported.length) {
        addMessage({
          role: 'assistant',
          text: `I could not find any leads in ${fileName || 'that file'}. Spreadsheets need name, email, phone, or LinkedIn columns; images need clearly readable contact details (like a business card or contact list).`,
        });
        return;
      }
      const linkedinCount = imported.filter((lead) => Boolean(lead.profileUrl)).length;
      const emailCount = imported.filter((lead) => Boolean(lead.email)).length;
      const phoneCount = imported.filter((lead) => Boolean(lead.phone)).length;
      const detectedLines = [
        linkedinCount ? `- LinkedIn: ${linkedinCount} profile${linkedinCount === 1 ? '' : 's'}` : '',
        emailCount ? `- Email: ${emailCount} address${emailCount === 1 ? '' : 'es'}` : '',
        phoneCount ? `- Phone: ${phoneCount} number${phoneCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      const importedAt = Date.now();
      const importMessages: AssistantChatMessage[] = [
        {
          id: createId('user'),
          role: 'user',
          text: `Uploaded: ${fileName || 'leads.csv'}`,
          timestamp: importedAt,
        },
        {
          id: createId('assistant'),
          role: 'assistant',
          text: [
            `**${imported.length} lead${imported.length === 1 ? '' : 's'} successfully imported.**`,
            '',
            '**Contact data detected:**',
            '',
            detectedLines.length ? detectedLines.join('\n') : '- Basic contact rows',
            '',
            'Building profiles in the background - searching Google and LinkedIn for additional context on each lead.',
            '',
            'When ready, click **Create Outreach Journey** below to configure your campaign.',
          ].join('\n'),
          timestamp: importedAt + 1,
        },
      ];
      set(() => {
        // A fresh import always replaces whatever leads/flow state is already
        // present — it represents starting a new campaign from this file, not
        // appending to a prior search or import (see plan: fresh-start fix).
        const leads = imported;
        return {
          messages: importMessages,
          input: '',
          leads,
          importedMode: true,
          selectedLeadIds: leads.map((lead) => lead.id),
          leadFeedback: {},
          outreachJourney: buildOutreachJourney(leads, null),
          workflowSteps: [],
          outreachWorkflowStage: 'idle' as const,
          selectedOutreachChannels: [],
          totalResults: leads.length,
          lastModuleUsed: 'imported_leads',
          pendingSearchConfirmation: null,
          pendingLocationRequest: null,
          pendingIntent: null,
          cpStep: -1,
          cpAgentDealLoading: false,
          error: null,
        };
      });
      void persist();

      // Persist + enrich on the backend (mirrors web's finishInboundImport) —
      // the chat message above already promises this happens "in the
      // background", so quietly correct the local/parsed data with the
      // backend's canonical + enriched version once it lands. Never lets a
      // network failure break the (already-successful) import. Passes the
      // sheet's own location (if any column carried one) so role-based rows
      // search the right region.
      try {
        const sheetLocation = imported.find((lead) => lead.location && lead.location.trim())?.location?.trim();
        await persistAndEnrichImportedLeads(imported, sheetLocation);
      } catch (importSyncError) {
        console.warn('[AI Assistant] Import save/enrich failed:', importSyncError);
      }
    },

    launchOutreachCampaign: async () => {
      const state = get();
      if (state.outreachWorkflowStage === 'launching') return null;
      const canLaunchFromWorkflowSource = state.workflowSteps.some((step) => step.type === 'lead_generation');
      const canLaunchPublisherWorkflow = state.workflowSteps.some((step) => ['linkedin_post', 'linkedin_content', 'post_approval'].includes(step.type));
      if (!state.leads.length && !canLaunchFromWorkflowSource && !canLaunchPublisherWorkflow) {
        addMessage({ role: 'assistant', text: 'Search or import at least one lead before launching an outreach journey.' });
        return null;
      }

      const channels = state.workflowSteps.length
        ? acceleratorChannelsFromSteps(state.workflowSteps)
        : state.selectedOutreachChannels.length
          ? state.selectedOutreachChannels
          : defaultChannelsFor(state.leads);
      const workflowSteps = state.workflowSteps.length
        ? state.workflowSteps
        : applyConfig([], { nextChannels: channels.map(toSyncChannel) }, { includeLeadSource: !state.importedMode });
      const workflowIssue = validateWorkflow(workflowSteps);
      if (workflowIssue) {
        set({ error: workflowIssue.message, outreachWorkflowStage: 'configuring' });
        addMessage({ role: 'assistant', text: workflowIssue.message });
        return null;
      }
      const nameTarget = state.lastTargeting?.industries?.[0] || state.lastSearchQuery || 'AI Growth';
      const campaignName = state.campaignName || `${nameTarget} Outreach`;
      if (state.leads.length && !state.selectedLeadIds.length) {
        const selectionMessage = 'Select at least one lead before launching this campaign.';
        set({ error: selectionMessage, outreachWorkflowStage: 'configuring' });
        addMessage({ role: 'assistant', text: selectionMessage });
        return null;
      }
      const selectedLeadIds = new Set(state.selectedLeadIds);
      const enrolledLeads = state.leads.filter((lead) => selectedLeadIds.has(lead.id));
      // Mirrors web's persistedLeadSource tagging: tell the backend exactly
      // where these leads came from so it enrolls only `initial_leads`
      // instead of re-sourcing more via a fresh LinkedIn search.
      const dataSource = !state.importedMode
        ? (state.lastSearchType === 'generic_prospect' ? 'generic_prospect' : 'linkedin_search')
        : (enrolledLeads.some((lead) => lead.profileUrl) ? 'csv_import' : 'direct_contact');
      // persistAndEnrichImportedLeads overwrites each lead's local temp id
      // ("lead-…"/"person-…") with the real backend UUID once import save
      // succeeds. Only those real ids can be linked via inbound_lead_ids —
      // mirrors web's resolvedInboundLeadIds (advanced-search-ai/page.tsx).
      // Fail-open: if none persisted (save failed / still in flight), this is
      // empty and buildCampaignPayload falls back to embedding the leads via
      // initial_leads so nothing is lost.
      const inboundLeadIds = dataSource === 'csv_import' || dataSource === 'direct_contact'
        ? enrolledLeads
          .map((lead) => lead.id)
          .filter((id) => !id.startsWith('lead-') && !id.startsWith('person-'))
        : undefined;

      set({ outreachWorkflowStage: 'launching', isBusy: true, error: null });
      try {
        const payload = buildCampaignPayload({
          name: campaignName,
          leads: enrolledLeads,
          targeting: state.lastTargeting || state.targeting,
          workflowSteps,
          searchQuery: state.lastSearchQuery || state.conversationSummary || 'mobile ai assistant search',
          campaignDays: state.campaignDays || 30,
          dataSource,
          inboundLeadIds,
          campaignConfig: {
            icpThreshold: state.cpIcpThreshold,
            enableAiPersonalization: state.cpEnableAiPersonalization,
            enableAiConnectionPersonalization: state.cpEnableAiConnectionPersonalization,
            enableAiFollowupPersonalization: state.cpEnableAiFollowupPersonalization,
            enableDailyWebPresence: state.cpEnableDailyWebPresence,
            enableDailyPosts: state.cpEnableDailyPosts,
          },
        });
        const result = await createMobileAssistantCampaign(payload);
        if (result?.success === false) {
          throw new Error(getCampaignError(result) || 'LAD could not create the outreach journey.');
        }
        const campaignId = getCampaignId(result);
        set({
          outreachWorkflowStage: 'launched',
          launchedCampaignId: campaignId || null,
          selectedOutreachChannels: channels,
          campaignName,
          isBusy: false,
          cpStep: -1,
        });
        addMessage({
          role: 'assistant',
          text: campaignId
            ? `Outreach journey created. Campaign ID: ${campaignId}. You can monitor it from Campaigns.`
            : 'Outreach journey created. You can monitor it from Campaigns.',
          options: [
            { label: 'Refine leads', value: 'I want to change what I am looking for' },
            { label: 'Find more leads', value: state.lastSearchQuery || 'Find more leads' },
          ],
        });
        return campaignId || '';
      } catch (error) {
        set({
          outreachWorkflowStage: 'configuring',
          isBusy: false,
          error: error instanceof Error ? error.message : 'Unable to create outreach journey.',
        });
        addMessage({
          role: 'assistant',
          text: error instanceof Error
            ? `I could not create the outreach journey. ${error.message}`
            : 'I could not create the outreach journey. Check campaign permissions and try again.',
        });
        return null;
      }
    },

    loadMore: async () => {
      const state = get();
      if (!state.lastSearchQuery || state.isLoadingMore || state.isSearching) return;

      set({ isLoadingMore: true, error: null });
      try {
        if (state.lastSearchType === 'generic_prospect') {
          const response = await timeoutAfter(
            searchGenericProspects({
              query: state.lastSearchQuery,
              sessionId: state.conversationId,
              seenIds: state.seenProspectIds,
              batchSize: DEFAULT_LEAD_COUNT,
            }),
            ASSISTANT_SEARCH_TIMEOUT_MS,
            'Prospect search',
          );
          const leads = normalizeSearchResults(response.results || []);
          set((current) => ({
            leads: [...current.leads, ...leads],
            selectedLeadIds: [...current.selectedLeadIds, ...leads.map((lead) => lead.id)],
            seenProspectIds: [...current.seenProspectIds, ...leads.map((lead) => lead.profileUrl || lead.id)],
            isLoadingMore: false,
          }));
          return;
        }

        const response = await timeoutAfter(
          searchLinkedInAdvanced({
            query: state.lastSearchQuery,
            count: DEFAULT_LEAD_COUNT,
            targeting: state.lastTargeting || undefined,
            icp_description: state.lastIcpDescription || state.lastSearchQuery,
            filters: { cursor: state.searchCursor },
            useSalesNav: state.useSalesNav,
          }),
          ASSISTANT_SEARCH_TIMEOUT_MS,
          'Lead search',
        );
        const leads = normalizeSearchResults(response.results || []);
        set((current) => ({
          leads: [...current.leads, ...leads],
          selectedLeadIds: [...current.selectedLeadIds, ...leads.map((lead) => lead.id)],
          searchCursor: response.cursor,
          isLoadingMore: false,
        }));
      } catch (error) {
        set({
          isLoadingMore: false,
          error: isBackendTimeout(error) ? 'The search took too long to load more leads. Try again in a moment.' : error instanceof Error ? error.message : 'Unable to load more leads.',
        });
      }
    },

    resetConversation: () => {
      const next = {
        messages: [],
        input: '',
        leads: [],
        targeting: null,
        pendingSearchConfirmation: null,
        pendingLocationRequest: null,
        pendingIntent: null,
        conversationId: createId('mobile-session'),
        conversationSummary: '',
        outreachJourney: [],
        outreachWorkflowStage: 'idle' as const,
        selectedOutreachChannels: [],
        workflowSteps: [],
        selectedLeadIds: [],
        leadFeedback: {},
        importedMode: false,
        campaignName: '',
        campaignDays: 30,
        launchedCampaignId: null,
        cpStep: -1,
        cpIcpThreshold: 0,
        cpEnableAiPersonalization: true,
        cpEnableAiConnectionPersonalization: true,
        cpEnableAiFollowupPersonalization: true,
        cpEnableDailyWebPresence: false,
        cpEnableDailyPosts: false,
        cpAgentDealLoading: false,
        lastSearchQuery: '',
        lastTargeting: null,
        lastIcpDescription: '',
        lastSearchType: 'linkedin' as const,
        lastModuleUsed: 'advanced_search',
        searchCursor: null,
        seenProspectIds: [],
        totalResults: 0,
        useSalesNav: false,
        acceleratorWizard: null,
        acceleratorPreviewing: false,
        isBusy: false,
        isSearching: false,
        isLoadingMore: false,
        error: null,
      };
      set(next);
      void safeStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
  };
});

void useAdvancedSearchStore.getState().hydrate();
