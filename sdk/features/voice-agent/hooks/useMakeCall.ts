import { useMutation } from "@tanstack/react-query";
import type { MakeCallRequest, MakeCallResponse } from "../types";
import * as api from "../api";

export function useMakeCall() {
  return useMutation<MakeCallResponse, Error, MakeCallRequest>({
    mutationFn: (payload) => api.makeCall(payload),
  });
}
