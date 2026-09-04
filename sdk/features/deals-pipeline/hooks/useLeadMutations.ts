/**
 * Deals Pipeline Feature - useLeadMutations Hook
 *
 * React hooks for lead CRUD operations using TanStack Query mutations.
 * Framework-independent (no Next.js imports).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Lead,
  CreateLeadParams,
  UpdateLeadParams,
  MoveLeadParams,
  UpdateLeadStatusParams,
  AssignLeadsParams,
} from "../types";
import * as api from "../api";

/**
 * Hook to create a new lead
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateLeadParams) => api.createLead(params),
    onSuccess: () => {
      // Invalidate leads queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to update an existing lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateLeadParams) =>
      api.updateLead(params.id, params),
    onSuccess: (_, variables) => {
      // Invalidate specific lead and lists
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to delete a lead
 */
export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.deleteLead(id),
    onSuccess: () => {
      // Invalidate all leads queries
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to move a lead to a different stage
 */
export function useMoveLeadToStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: MoveLeadParams) =>
      api.moveLeadToStage(params.leadId, params.stageKey),
    onSuccess: (_, variables) => {
      // Invalidate specific lead and pipeline data
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId],
      });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to update lead status
 */
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateLeadStatusParams) =>
      api.updateLeadStatus(params.leadId, params.status),
    onSuccess: (_, variables) => {
      // Invalidate specific lead and lists
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId],
      });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to assign leads to a user
 */
export function useAssignLeadsToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AssignLeadsParams) => api.assignLeadsToUser(params),
    onSuccess: () => {
      // Invalidate leads queries to refresh assignments
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}
