import { useMutation } from "@tanstack/react-query";
import type { UpdateSummaryRequest, UpdateSummaryResponse } from "../types";
import * as api from "../api";

export function useUpdateSummary() {
  return useMutation<UpdateSummaryResponse, Error, UpdateSummaryRequest>({
    mutationFn: (payload) => api.updateSummary(payload),
  });
}
