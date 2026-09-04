/**
 * Campaigns Feature - useLeadReveal Hooks
 * 
 * React hooks for revealing lead email and phone using TanStack Query mutations.
 * Framework-independent (no Next.js imports).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  revealLeadEmail,
  revealLeadPhone,
  revealLeadLinkedIn,
  campaignKeys 
} from '../api';

/**
 * Hook to reveal lead email
 */
export function useRevealLeadEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId, apolloPersonId }: {
      campaignId: string;
      leadId: string;
      apolloPersonId: string;
    }) => revealLeadEmail(campaignId, leadId, apolloPersonId),
    onSuccess: (_, { campaignId }) => {
      // Invalidate campaign leads to refresh with revealed email
      queryClient.invalidateQueries({ queryKey: campaignKeys.leads(campaignId) });
    },
  });
}

/**
 * Hook to reveal lead phone
 */
export function useRevealLeadPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId, apolloPersonId }: {
      campaignId: string;
      leadId: string;
      apolloPersonId: string;
    }) => revealLeadPhone(campaignId, leadId, apolloPersonId),
    onSuccess: (_, { campaignId }) => {
      // Invalidate campaign leads to refresh with revealed phone
      queryClient.invalidateQueries({ queryKey: campaignKeys.leads(campaignId) });
    },
  });
}

/**
 * Hook to reveal lead LinkedIn URL
 */
export function useRevealLeadLinkedIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, leadId }: {
      campaignId: string;
      leadId: string;
    }) => revealLeadLinkedIn(campaignId, leadId),
    onSuccess: (_, { campaignId }) => {
      // Invalidate campaign leads to refresh with revealed LinkedIn URL
      queryClient.invalidateQueries({ queryKey: campaignKeys.leads(campaignId) });
    },
  });
}