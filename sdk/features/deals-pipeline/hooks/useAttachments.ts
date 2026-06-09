/**
 * Deals Pipeline Feature - useAttachments Hook
 *
 * React hooks for lead attachments using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Attachment, UploadAttachmentParams, DeleteAttachmentParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all attachments for a lead
 */
export function useLeadAttachments(leadId: string | number | null, enabled: boolean = true) {
  return useQuery<Attachment[]>({
    queryKey: ["deals-pipeline", "leads", leadId, "attachments"],
    queryFn: () => api.getLeadAttachments(leadId!),
    staleTime: 30000,
    enabled: !!leadId && enabled,
  });
}

/**
 * Hook to upload an attachment for a lead
 */
export function useUploadLeadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UploadAttachmentParams) =>
      api.uploadLeadAttachment(params.leadId, params.file),
    onSuccess: (_, variables) => {
      // Invalidate attachments for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "attachments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "activities"],
      });
    },
  });
}

/**
 * Hook to delete an attachment
 */
export function useDeleteLeadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DeleteAttachmentParams) =>
      api.deleteLeadAttachment(params.leadId, params.attachmentId),
    onSuccess: (_, variables) => {
      // Invalidate attachments for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "attachments"],
      });
    },
  });
}
