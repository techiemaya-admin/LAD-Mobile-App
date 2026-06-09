/**
 * Deals Pipeline Feature - useStages Hook
 *
 * React hooks for stages using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Stage, UpdateStageParams, ReorderStagesParams } from "../types";
import * as api from "../api";

/**
 * Hook to fetch all pipeline stages
 */
export function useStages(enabled: boolean = true) {
  return useQuery<Stage[]>({
    queryKey: ["deals-pipeline", "stages"],
    queryFn: () => api.getStages(),
    staleTime: 5 * 60 * 1000, // 5 minutes - stages don't change often
    enabled: enabled,
  });
}

/**
 * Hook to create a new stage
 */
export function useCreateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      positionStageId,
      positionType,
    }: {
      name: string;
      positionStageId?: string | null;
      positionType?: "before" | "after";
    }) => api.createStage(name, positionStageId ?? null, positionType ?? "after"),
    onSuccess: () => {
      // Invalidate stages and pipeline data
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "stages"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to update a stage
 */
export function useUpdateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stageKey,
      updates,
    }: {
      stageKey: string;
      updates: UpdateStageParams | string;
    }) => api.updateStage(stageKey, updates),
    onSuccess: () => {
      // Invalidate stages and pipeline data
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "stages"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to delete a stage
 */
export function useDeleteStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stageKey: string) => api.deleteStage(stageKey),
    onSuccess: () => {
      // Invalidate stages and pipeline data
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "stages"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}

/**
 * Hook to reorder stages
 */
export function useReorderStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ReorderStagesParams) => api.reorderStages(params.stageOrders),
    onSuccess: () => {
      // Invalidate stages and pipeline data
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "stages"] });
      queryClient.invalidateQueries({ queryKey: ["deals-pipeline", "pipeline"] });
    },
  });
}
