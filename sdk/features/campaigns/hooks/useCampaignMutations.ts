/**
 * Campaigns Feature - useCampaignMutations Hook
 * 
 * React hooks for campaign CRUD operations using TanStack Query mutations.
 * Framework-independent (no Next.js imports).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  createCampaign, 
  updateCampaign, 
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  stopCampaign,
  campaignKeys 
} from '../api';
import type { Campaign, CreateCampaignRequest, UpdateCampaignRequest } from '../types';

/**
 * Hook to create a campaign with optimistic updates
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCampaign,
    onSuccess: (newCampaign) => {
      // Invalidate and refetch campaigns list
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      
      // Optimistically add the new campaign to all campaigns lists
      queryClient.setQueriesData(
        { queryKey: campaignKeys.lists() },
        (old: Campaign[] | undefined) => {
          if (!old) return [newCampaign];
          return [newCampaign, ...old];
        }
      );
    },
  });
}

/**
 * Hook to update a campaign with optimistic updates
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: UpdateCampaignRequest }) =>
      updateCampaign(campaignId, data),
    onSuccess: (updatedCampaign) => {
      // Update the specific campaign in cache
      queryClient.setQueryData(
        campaignKeys.detail(updatedCampaign.id),
        updatedCampaign
      );
      
      // Update campaigns list
      queryClient.setQueriesData(
        { queryKey: campaignKeys.lists() },
        (old: Campaign[] | undefined) => {
          if (!old) return old;
          return old.map((campaign) =>
            campaign.id === updatedCampaign.id ? updatedCampaign : campaign
          );
        }
      );
    },
  });
}

/**
 * Hook to delete a campaign with optimistic updates
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: (_, campaignId) => {
      // Remove from campaigns list
      queryClient.setQueriesData(
        { queryKey: campaignKeys.lists() },
        (old: Campaign[] | undefined) => {
          if (!old) return old;
          return old.filter((campaign) => campaign.id !== campaignId);
        }
      );
      
      // Remove the specific campaign from cache
      queryClient.removeQueries({ queryKey: campaignKeys.detail(campaignId) });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: campaignKeys.stats() });
    },
  });
}

/**
 * Hook to start a campaign
 */
export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startCampaign,
    onSuccess: (_, campaignId) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.stats() });
    },
  });
}

/**
 * Hook to pause a campaign
 */
export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pauseCampaign,
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.stats() });
    },
  });
}

/**
 * Hook to stop a campaign
 */
export function useStopCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopCampaign,
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.stats() });
    },
  });
}