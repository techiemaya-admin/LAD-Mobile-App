/**
 * Call Logs Feature - useRecordingSignedUrl Hook
 * 
 * React hook for fetching signed recording URLs using TanStack Query.
 * Framework-independent (no Next.js imports).
 */
import { useQuery } from "@tanstack/react-query";
import type { RecordingSignedUrlResponse } from "../types";
import * as api from "../api";

/**
 * Hook to fetch signed recording URL for a call
 */
export function useRecordingSignedUrl(callId: string | null | undefined) {
  return useQuery({
    queryKey: ["recording-signed-url", callId],
    queryFn: () => api.getRecordingSignedUrl({ callId: callId! }),
    enabled: !!callId,
    staleTime: 300000, // 5 minutes - signed URLs typically have longer expiry
  });
}
