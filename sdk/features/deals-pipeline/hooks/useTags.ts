/**
 * Deals Pipeline Feature - useTags Hook
 *
 * React hooks for lead tags using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tag, CreateTagParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all tags for a lead
 */
export function useLeadTags(leadId: string | number | null, enabled: boolean = true) {
  return useQuery<Tag[]>({
    queryKey: ["deals-pipeline", "leads", leadId, "tags"],
    queryFn: () => api.getLeadTags(leadId!),
    staleTime: 30000,
    enabled: !!leadId && enabled,
  });
}

/**
 * Hook to add a tag to a lead
 */
export function useAddTagToLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateTagParams) =>
      api.addTagToLead(params.leadId, { name: params.name, color: params.color }),
    onSuccess: (_, variables) => {
      // Invalidate tags for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "tags"],
      });
    },
  });
}
