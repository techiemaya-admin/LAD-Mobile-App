import { useCallback } from 'react';
import { CallExecutionConfig, LeadContact } from '@/types/calls';
import { useVoiceAgentStore } from '@/src/store/voiceAgentStore';

export function useCallExecution() {
  const isExecuting = useVoiceAgentStore((state) => state.isExecuting);
  const executionStatus = useVoiceAgentStore((state) => state.executionStatus);
  const resolvedLeads = useVoiceAgentStore((state) => state.resolvedLeads);
  const setResolvedLeads = useVoiceAgentStore((state) => state.setResolvedLeads);
  const importLeadsAction = useVoiceAgentStore((state) => state.importLeads);
  const startSingleCallAction = useVoiceAgentStore((state) => state.startSingleCall);
  const startBulkCallAction = useVoiceAgentStore((state) => state.startBulkCall);

  const importLeads = useCallback(async () => {
    return importLeadsAction();
  }, [importLeadsAction]);

  const startSingleCall = useCallback(async (contact: LeadContact, config: CallExecutionConfig) => {
    return startSingleCallAction(contact, config);
  }, [startSingleCallAction]);

  const startBulkCall = useCallback(async (contacts: LeadContact[], config: CallExecutionConfig) => {
    return startBulkCallAction(contacts, config);
  }, [startBulkCallAction]);

  return {
    isExecuting,
    executionStatus,
    resolvedLeads,
    setResolvedLeads,
    importLeads,
    startSingleCall,
    startBulkCall,
  };
}
