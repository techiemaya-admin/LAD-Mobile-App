/**
 * Campaigns Feature - useCampaignAnalytics Hook
 *
 * React hook for fetching campaign analytics using TanStack Query.
 * Framework-independent (no Next.js imports).
 * Includes SSE for real-time stats updates.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaignAnalyticsOptions } from '../api';
import type { CampaignAnalytics } from '../types';
 
export interface UseCampaignAnalyticsReturn {
  data: CampaignAnalytics | undefined;
  analytics: CampaignAnalytics | undefined; // Alias for backward compatibility
  isLoading: boolean;
  loading: boolean; // Alias for backward compatibility
  error: Error | null;
  isError: boolean;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
}
 
/**
 * Hook to get campaign analytics with TanStack Query and SSE for real-time updates
 */
export function useCampaignAnalytics(campaignId: string): UseCampaignAnalyticsReturn {
  const queryClient = useQueryClient();
  const query = useQuery(getCampaignAnalyticsOptions(campaignId));
 
  // SSE connection for real-time stats updates
  useEffect(() => {
    if (!campaignId) return;
 
    const token = localStorage.getItem('token');
    if (!token) return;
 
    // Use NEXT_PUBLIC_BACKEND_URL (preferred) or NEXT_PUBLIC_API_URL (legacy fallback)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const apiUrl = backendUrl.endsWith('/api') ? backendUrl : `${backendUrl}/api`;
    const eventSource = new EventSource(
      `${apiUrl}/campaigns/${campaignId}/events?token=${encodeURIComponent(token)}`
    );
 
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
       
        // Update query cache with real-time stats
        if (data.type === 'INITIAL_STATS' || data.type === 'STATS_UPDATE') {
          queryClient.setQueryData(
            ['campaign-analytics', campaignId],
            (oldData: CampaignAnalytics | undefined) => {
              if (!oldData) return oldData;
             
              // Map SSE stats to analytics format
              return {
                ...oldData,
                overview: {
                  ...oldData.overview,
                  total_leads: data.stats?.leads_count ?? oldData.overview.total_leads ?? 0,
                  sent: data.stats?.sent_count ?? oldData.overview.sent ?? 0,
                  connected: data.stats?.connected_count ?? oldData.overview.connected ?? 0,
                  replied: data.stats?.replied_count ?? oldData.overview.replied ?? 0,
                  delivered: data.stats?.delivered_count ?? oldData.overview.delivered ?? 0,
                  opened: data.stats?.opened_count ?? oldData.overview.opened ?? 0,
                  clicked: data.stats?.clicked_count ?? oldData.overview.clicked ?? 0,
                },
              };
            }
          );
        }
      } catch (error) {
        console.error('SSE message parse error:', error);
      }
    };
 
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };
 
    return () => {
      eventSource.close();
    };
  }, [campaignId, queryClient]);
 
  return {
    data: query.data,
    analytics: query.data, // Backward compatibility alias
    isLoading: query.isLoading,
    loading: query.isLoading, // Backward compatibility alias
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
}
 
