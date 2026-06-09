import { create } from 'zustand';
import { safeStorage } from '@/src/api';
import {
  AssistantChatMessage,
  LeadTargeting,
  MobileAssistantLead,
  buildConfirmationMessage,
  buildCampaignPayload,
  buildOutreachJourney,
  createMobileAssistantCampaign,
  extractLinkedInIntent,
  isConfirmation,
  isGenericCompanySearchQuery,
  normalizeLead,
  normalizeTargeting,
  researchAccount,
  searchGenericProspects,
  searchLinkedInAdvanced,
  searchLinkedInUnified,
  sendLeadChat,
  webResearch,
} from '@/src/services/mobileAIAssistantService';

const STORAGE_KEY = 'mobile-ai-assistant-storage';
const DEFAULT_LEAD_COUNT = 10;
const LEAD_CHAT_TIMEOUT_MS = 25000;
const ASSISTANT_SEARCH_TIMEOUT_MS = 240000;

interface PendingSearchConfirmation {
  intent: LeadTargeting;
  originalQuery: string;
}

interface MobileAIAssistantState {
  messages: AssistantChatMessage[];
  input: string;
  leads: MobileAssistantLead[];
  targeting: LeadTargeting | null;
  pendingSearchConfirmation: PendingSearchConfirmation | null;
  pendingIntent: string | null;
  conversationId: string;
  conversationSummary: string;
  recentSearches: string[];
  outreachJourney: ReturnType<typeof buildOutreachJourney>;
  outreachWorkflowStage: 'idle' | 'configuring' | 'launching' | 'launched';
  selectedOutreachChannels: string[];
  campaignName: string;
  campaignDays: number;
  launchedCampaignId: string | null;
  lastSearchQuery: string;
  lastTargeting: LeadTargeting | null;
  lastIcpDescription: string;
  lastSearchType: 'linkedin' | 'generic_prospect';
  lastModuleUsed: string;
  searchCursor: string | null;
  seenProspectIds: string[];
  totalResults: number;
  isBusy: boolean;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  setInput: (value: string) => void;
  submitMessage: (message?: string) => Promise<void>;
  chooseOption: (value: string) => Promise<void>;
  refineTargeting: () => void;
  startOutreachWorkflow: () => void;
  toggleOutreachChannel: (channel: string) => void;
  launchOutreachCampaign: () => Promise<void>;
  loadMore: () => Promise<void>;
  resetConversation: () => void;
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialMessage = (): AssistantChatMessage => ({
  id: createId('assistant'),
  role: 'assistant',
  text: 'Tell me who you want to find. I can search LAD backend data, LinkedIn, company signals, web research, and prospect workflows from the same assistant pipeline used in LAD Frontend 2.',
  timestamp: Date.now(),
  options: [
    { label: 'Find clinic owners in Bangalore', value: 'Find clinic owners in Bangalore' },
    { label: 'Research a company', value: 'Get me detailed insights about TechieMaya' },
    { label: 'Hotels with pools in Dubai', value: 'Find decision makers at hotels with swimming pools in Dubai' },
  ],
});

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

export const useAdvancedSearchStore = create<MobileAIAssistantState>((set, get) => {
  const persist = async () => {
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
      campaignName: state.campaignName,
      campaignDays: state.campaignDays,
      launchedCampaignId: state.launchedCampaignId,
    }));
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
        useSalesNav: false,
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
        ? `Found ${leads.length} lead${leads.length === 1 ? '' : 's'} from LAD Frontend 2 assistant search. ${leads.filter((lead) => (lead.score ?? 0) >= 70).length} look like strong matches.`
        : 'I searched the LAD backend but did not find matching mobile-ready leads. Try broadening the role, industry, or location.',
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
          ? `Found ${leads.length} researched prospect${leads.length === 1 ? '' : 's'} with decision-maker data and scoring.`
          : 'I could not find researched prospects for that query. Try adding a location or a clearer company type.',
        leads,
      });
    } catch {
      const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction').catch(() => null);
      const intent = normalizeTargeting(intentData?.intent) || get().targeting;
      await runLinkedInSearch(text, intent, false);
    }
  };

  return {
    messages: [initialMessage()],
    input: '',
    leads: [],
    targeting: null,
    pendingSearchConfirmation: null,
    pendingIntent: null,
    conversationId: createId('mobile-session'),
    conversationSummary: '',
    recentSearches: [],
    outreachJourney: [],
    outreachWorkflowStage: 'idle',
    selectedOutreachChannels: [],
    campaignName: '',
    campaignDays: 30,
    launchedCampaignId: null,
    lastSearchQuery: '',
    lastTargeting: null,
    lastIcpDescription: '',
    lastSearchType: 'linkedin',
    lastModuleUsed: 'advanced_search',
    searchCursor: null,
    seenProspectIds: [],
    totalResults: 0,
    isBusy: false,
    isSearching: false,
    isLoadingMore: false,
    error: null,

    hydrate: async () => {
      try {
        const raw = await safeStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<MobileAIAssistantState>;
        set({
          messages: parsed.messages?.length ? parsed.messages : [initialMessage()],
          leads: parsed.leads ?? [],
          targeting: parsed.targeting ?? null,
          recentSearches: parsed.recentSearches ?? [],
        conversationId: parsed.conversationId ?? createId('mobile-session'),
        conversationSummary: parsed.conversationSummary ?? '',
        outreachWorkflowStage: parsed.outreachWorkflowStage ?? 'idle',
        selectedOutreachChannels: parsed.selectedOutreachChannels ?? [],
        campaignName: parsed.campaignName ?? '',
        campaignDays: parsed.campaignDays ?? 30,
        launchedCampaignId: parsed.launchedCampaignId ?? null,
      });
      } catch {
        set({ error: 'Unable to restore assistant history.' });
      }
    },

    setInput: (value) => set({ input: value }),

    submitMessage: async (message) => {
      const text = (message ?? get().input).trim();
      if (!text || get().isBusy || get().isSearching) return;

      set({ input: '', isBusy: true, error: null });
      addMessage({ role: 'user', text });

      try {
        const pending = get().pendingSearchConfirmation;
        if (pending && isConfirmation(text)) {
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
            set({ targeting: intent, pendingSearchConfirmation: { intent, originalQuery: text } });
            addMessage({
              role: 'assistant',
              text: buildConfirmationMessage(intent),
              options: [
                { label: 'Yes, search this', value: 'yes' },
                { label: 'Refine target', value: 'I want to change what I am looking for' },
              ],
            });
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
            set({ targeting: intent, pendingSearchConfirmation: { intent, originalQuery: text } });
            addMessage({
              role: 'assistant',
              text: buildConfirmationMessage(intent),
              options: [
                { label: 'Yes, search this', value: 'yes' },
                { label: 'Refine target', value: 'I want to change what I am looking for' },
              ],
            });
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
          set({
            targeting: updatedTargeting,
            pendingSearchConfirmation: { intent: updatedTargeting, originalQuery: text },
            pendingIntent: chat?.pendingIntent ?? null,
          });
          addMessage({
            role: 'assistant',
            text: buildConfirmationMessage(updatedTargeting),
            options: [
              { label: 'Yes, search this', value: 'yes' },
              { label: 'Refine target', value: 'I want to change what I am looking for' },
            ],
          });
          set({ isBusy: false });
          return;
        }

        if (shouldSearch) {
          const intentData = await timeoutAfter(extractLinkedInIntent(text), 30000, 'Intent extraction');
          const intent = normalizeTargeting(intentData.intent);
          if (intent) {
            set({ targeting: intent, pendingSearchConfirmation: { intent, originalQuery: text } });
            addMessage({
              role: 'assistant',
              text: buildConfirmationMessage(intent),
              options: [
                { label: 'Yes, search this', value: 'yes' },
                { label: 'Refine target', value: 'I want to change what I am looking for' },
              ],
            });
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
        text: `${summary ? `${summary}\n\n` : ''}Tell me what to change: role, industry, location, keywords, or company size. I will update the targeting and search again through the LAD backend.`,
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
        campaignName,
        campaignDays: state.campaignDays || 30,
        error: null,
      });
    },

    toggleOutreachChannel: (channel) => {
      const normalized = channelFromJourney(channel);
      set((state) => {
        const exists = state.selectedOutreachChannels.includes(normalized);
        const nextChannels = exists
          ? state.selectedOutreachChannels.filter((item) => item !== normalized)
          : [...state.selectedOutreachChannels, normalized];
        return { selectedOutreachChannels: nextChannels.length ? nextChannels : [normalized], outreachWorkflowStage: 'configuring' };
      });
    },

    launchOutreachCampaign: async () => {
      const state = get();
      if (state.outreachWorkflowStage === 'launching') return;
      if (!state.leads.length) {
        addMessage({ role: 'assistant', text: 'Search or import at least one lead before launching an outreach journey.' });
        return;
      }

      const channels = state.selectedOutreachChannels.length
        ? state.selectedOutreachChannels
        : defaultChannelsFor(state.leads);
      const nameTarget = state.lastTargeting?.industries?.[0] || state.lastSearchQuery || 'AI Growth';
      const campaignName = state.campaignName || `${nameTarget} Outreach`;

      set({ outreachWorkflowStage: 'launching', isBusy: true, error: null });
      try {
        const payload = buildCampaignPayload({
          name: campaignName,
          leads: state.leads,
          targeting: state.lastTargeting || state.targeting,
          channels,
          searchQuery: state.lastSearchQuery || state.conversationSummary || 'mobile ai assistant search',
          campaignDays: state.campaignDays || 30,
        });
        const result = await createMobileAssistantCampaign(payload);
        if (result?.success === false) {
          throw new Error(getCampaignError(result) || 'LAD backend did not create the outreach journey.');
        }
        const campaignId = getCampaignId(result);
        set({
          outreachWorkflowStage: 'launched',
          launchedCampaignId: campaignId || null,
          selectedOutreachChannels: channels,
          campaignName,
          isBusy: false,
        });
        addMessage({
          role: 'assistant',
          text: campaignId
            ? `Outreach journey created. Campaign ID: ${campaignId}. You can monitor it from Campaigns.`
            : 'Outreach journey created and accepted by the LAD backend. You can monitor it from Campaigns.',
          options: [
            { label: 'Refine leads', value: 'I want to change what I am looking for' },
            { label: 'Find more leads', value: state.lastSearchQuery || 'Find more leads' },
          ],
        });
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
          }),
          ASSISTANT_SEARCH_TIMEOUT_MS,
          'Lead search',
        );
        const leads = normalizeSearchResults(response.results || []);
        set((current) => ({
          leads: [...current.leads, ...leads],
          searchCursor: response.cursor,
          isLoadingMore: false,
        }));
      } catch (error) {
        set({
          isLoadingMore: false,
          error: isBackendTimeout(error) ? 'The backend took too long to load more leads. Try again in a moment.' : error instanceof Error ? error.message : 'Unable to load more leads.',
        });
      }
    },

    resetConversation: () => {
      const next = {
        messages: [initialMessage()],
        input: '',
        leads: [],
        targeting: null,
        pendingSearchConfirmation: null,
        pendingIntent: null,
        conversationId: createId('mobile-session'),
        conversationSummary: '',
        outreachJourney: [],
        outreachWorkflowStage: 'idle' as const,
        selectedOutreachChannels: [],
        campaignName: '',
        campaignDays: 30,
        launchedCampaignId: null,
        lastSearchQuery: '',
        lastTargeting: null,
        lastIcpDescription: '',
        lastSearchType: 'linkedin' as const,
        lastModuleUsed: 'advanced_search',
        searchCursor: null,
        seenProspectIds: [],
        totalResults: 0,
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
