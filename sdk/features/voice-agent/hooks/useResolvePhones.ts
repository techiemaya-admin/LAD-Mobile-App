import { useMutation } from "@tanstack/react-query";
import type { ResolvePhonesResponse, VoiceAgentTargetType } from "../types";
import * as api from "../api";

export function useResolvePhones() {
  return useMutation<ResolvePhonesResponse, Error, { ids: string[]; type: VoiceAgentTargetType }>({
    mutationFn: ({ ids, type }) => api.resolvePhones(ids, type),
  });
}
