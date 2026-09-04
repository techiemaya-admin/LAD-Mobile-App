import { useQuery } from "@tanstack/react-query";
import type { UserAvailableAgent } from "../types";
import * as api from "../api";

export function useAvailableAgents(enabled: boolean = true) {
  return useQuery<UserAvailableAgent[]>({
    queryKey: ["voice-agent", "user-available-agents"],
    queryFn: () => api.getUserAvailableAgents(),
    staleTime: 30000,
    enabled,
  });
}
