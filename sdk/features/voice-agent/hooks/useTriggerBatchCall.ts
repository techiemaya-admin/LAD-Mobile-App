import { useMutation } from "@tanstack/react-query";
import type { TriggerBatchCallRequest, TriggerBatchCallResponse } from "../types";
import * as api from "../api";

export function useTriggerBatchCall() {
  return useMutation<TriggerBatchCallResponse, Error, TriggerBatchCallRequest>({
    mutationFn: (payload) => api.triggerBatchCall(payload),
  });
}
