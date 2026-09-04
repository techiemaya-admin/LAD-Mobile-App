import { useQuery } from "@tanstack/react-query";
import type { UserAvailableNumber } from "../types";
import * as api from "../api";

export function useUserAvailableNumbers(enabled: boolean = true) {
  return useQuery<UserAvailableNumber[]>({
    queryKey: ["voice-agent", "user-available-numbers"],
    queryFn: () => api.getUserAvailableNumbers(),
    staleTime: 30000,
    enabled,
  });
}
