import { create } from 'zustand';
import {
  demoLeadIds,
  fetchAvailableAgents,
  fetchUserAvailableNumbers,
  resolvePhones,
  startAICallSession,
  startBulkAICallSession,
} from '@/src/services/voiceAgentWorkflowService';
import {
  AIVoiceAgent,
  CallExecutionConfig,
  CallRecord,
  LeadContact,
  VerifiedNumber,
} from '@/types/calls';

interface VoiceAgentState {
  agents: AIVoiceAgent[];
  numbers: VerifiedNumber[];
  selectedAgent: AIVoiceAgent | null;
  selectedNumber: VerifiedNumber | null;
  instructions: string;
  resolvedLeads: LeadContact[];
  callHistory: CallRecord[];
  isLoadingAgents: boolean;
  isLoadingNumbers: boolean;
  isExecuting: boolean;
  executionStatus: string;
  error: string | null;

  loadAgents: () => Promise<void>;
  loadNumbers: () => Promise<void>;
  setSelectedAgent: (agent: AIVoiceAgent | null) => void;
  setSelectedNumber: (number: VerifiedNumber | null) => void;
  setInstructions: (instructions: string) => void;
  setResolvedLeads: (leads: LeadContact[]) => void;
  importLeads: (leadIds?: string[]) => Promise<LeadContact[]>;
  startSingleCall: (contact: LeadContact, config?: CallExecutionConfig) => Promise<CallRecord>;
  startBulkCall: (contacts: LeadContact[], config?: CallExecutionConfig) => Promise<CallRecord[]>;
}

const getConfig = (state: VoiceAgentState, config?: CallExecutionConfig) => {
  if (config) {
    return config;
  }

  if (!state.selectedAgent || !state.selectedNumber) {
    throw new Error('Select an AI agent and verified number before calling.');
  }

  return {
    agent: state.selectedAgent,
    fromNumber: state.selectedNumber,
    instructions: state.instructions,
  };
};

export const useVoiceAgentStore = create<VoiceAgentState>((set, get) => ({
  agents: [],
  numbers: [],
  selectedAgent: null,
  selectedNumber: null,
  instructions: '',
  resolvedLeads: [],
  callHistory: [],
  isLoadingAgents: false,
  isLoadingNumbers: false,
  isExecuting: false,
  executionStatus: 'Ready',
  error: null,

  loadAgents: async () => {
    set({ isLoadingAgents: true, error: null });
    try {
      const agents = await fetchAvailableAgents();
      set((state) => ({
        agents,
        selectedAgent: state.selectedAgent ?? agents[0] ?? null,
        isLoadingAgents: false,
      }));
    } catch {
      set({ isLoadingAgents: false, error: 'Unable to load available AI agents.' });
    }
  },

  loadNumbers: async () => {
    set({ isLoadingNumbers: true, error: null });
    try {
      const numbers = await fetchUserAvailableNumbers();
      set((state) => ({
        numbers,
        selectedNumber: state.selectedNumber ?? numbers[0] ?? null,
        isLoadingNumbers: false,
      }));
    } catch {
      set({ isLoadingNumbers: false, error: 'Unable to load verified numbers.' });
    }
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSelectedNumber: (number) => set({ selectedNumber: number }),
  setInstructions: (instructions) => set({ instructions }),
  setResolvedLeads: (leads) => set({ resolvedLeads: leads }),

  importLeads: async (leadIds = demoLeadIds) => {
    set({ executionStatus: 'Resolving imported lead phone numbers', error: null });
    try {
      const leads = await resolvePhones(leadIds);
      set({
        resolvedLeads: leads,
        executionStatus: `${leads.length} leads ready for AI calling`,
      });
      return leads;
    } catch {
      set({ executionStatus: 'Lead import failed', error: 'Unable to resolve imported lead phone numbers.' });
      return [];
    }
  },

  startSingleCall: async (contact, config) => {
    set({ isExecuting: true, executionStatus: `Dialing ${contact.name}`, error: null });

    try {
      const callConfig = getConfig(get(), config);
      const call = await startAICallSession(contact, callConfig);
      set((state) => ({
        isExecuting: false,
        executionStatus: `AI call completed for ${contact.name}`,
        callHistory: [call, ...state.callHistory],
      }));
      return call;
    } catch (error) {
      set({
        isExecuting: false,
        executionStatus: 'AI call failed',
        error: error instanceof Error ? error.message : 'Unable to start AI call.',
      });
      throw error;
    }
  },

  startBulkCall: async (contacts, config) => {
    set({ isExecuting: true, executionStatus: `Starting bulk AI calling for ${contacts.length} leads`, error: null });

    try {
      const callConfig = getConfig(get(), config);
      const calls = await startBulkAICallSession(contacts, callConfig);
      set((state) => ({
        isExecuting: false,
        executionStatus: `${calls.length} AI calls completed`,
        callHistory: [...calls, ...state.callHistory],
      }));
      return calls;
    } catch (error) {
      set({
        isExecuting: false,
        executionStatus: 'Bulk AI calling failed',
        error: error instanceof Error ? error.message : 'Unable to start bulk AI calling.',
      });
      throw error;
    }
  },
}));
