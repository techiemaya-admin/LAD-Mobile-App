/**
 * Deals Pipeline Feature - useComments Hook
 *
 * React hooks for lead comments using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Comment, CreateCommentParams, UpdateCommentParams, DeleteCommentParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all comments for a lead
 */
export function useLeadComments(leadId: string | number | null, enabled: boolean = true) {
  return useQuery<Comment[]>({
    queryKey: ["deals-pipeline", "leads", leadId, "comments"],
    queryFn: () => api.getLeadComments(leadId!),
    staleTime: 30000,
    enabled: !!leadId && enabled,
  });
}

/**
 * Hook to add a comment to a lead
 */
export function useAddLeadComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateCommentParams) =>
      api.addLeadComment(params.leadId, params.content),
    onSuccess: (_, variables) => {
      // Invalidate comments for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "activities"],
      });
    },
  });
}

/**
 * Hook to update a comment
 */
export function useUpdateLeadComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateCommentParams) =>
      api.updateLeadComment(params.leadId, params.commentId, params.content),
    onSuccess: (_, variables) => {
      // Invalidate comments for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "comments"],
      });
    },
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteLeadComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DeleteCommentParams) =>
      api.deleteLeadComment(params.leadId, params.commentId),
    onSuccess: (_, variables) => {
      // Invalidate comments for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "activities"],
      });
    },
  });
}
