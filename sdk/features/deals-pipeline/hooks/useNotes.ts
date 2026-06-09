/**
 * Deals Pipeline Feature - useNotes Hook
 *
 * React hooks for lead notes using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note, CreateNoteParams, UpdateNoteParams, DeleteNoteParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all notes for a lead
 */
export function useLeadNotes(leadId: string | number | null, enabled: boolean = true) {
  return useQuery<Note[]>({
    queryKey: ["deals-pipeline", "leads", leadId, "notes"],
    queryFn: () => api.getLeadNotes(leadId!),
    staleTime: 30000,
    enabled: !!leadId && enabled,
  });
}

/**
 * Hook to add a note to a lead
 */
export function useAddLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateNoteParams) =>
      api.addLeadNote(params.leadId, params.content),
    onSuccess: (_, variables) => {
      // Invalidate notes for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "notes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "activities"],
      });
    },
  });
}

/**
 * Hook to update a note
 */
export function useUpdateLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateNoteParams) =>
      api.updateLeadNote(params.leadId, params.noteId, params.content),
    onSuccess: (_, variables) => {
      // Invalidate notes for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "notes"],
      });
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DeleteNoteParams) =>
      api.deleteLeadNote(params.leadId, params.noteId),
    onSuccess: (_, variables) => {
      // Invalidate notes for the specific lead
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "notes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["deals-pipeline", "leads", variables.leadId, "activities"],
      });
    },
  });
}
