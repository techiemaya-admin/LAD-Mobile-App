/**
 * Dashboard Feature Hooks
 * React Query hooks for dashboard data
 */

import { useQuery } from '@tanstack/react-query';
import { 
  fetchDashboardUsers, 
  fetchBookings, 
  fetchOwnerBookings, 
  fetchUserBookings,
  fetchCalls,
  fetchDashboardCalls,
  fetchUserCalls,
  fetchCallsWithPagination,
} from './api';
import { User, Booking, CallLog } from './types';

const QUERY_KEYS = {
  dashboard: ['dashboard'],
  users: ['dashboard', 'users'],
  bookings: ['dashboard', 'bookings'],
  userBookings: (userId: string) => ['dashboard', 'bookings', userId],
  ownerBookings: () => ['dashboard', 'bookings', 'owner'],
  calls: ['dashboard', 'calls'],
  userCalls: (userId: string) => ['dashboard', 'calls', userId],
  ownerCalls: () => ['dashboard', 'calls', 'owner'],
  callsWithPagination: (page: number, limit: number, userId?: string) => ['dashboard', 'calls', 'paginated', page, limit, userId],
} as const;

/**
 * Hook to fetch all dashboard users
 */
export const useDashboardUsers = () => {
  return useQuery<User[], Error>({
    queryKey: QUERY_KEYS.users,
    queryFn: fetchDashboardUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: true,
  });
};

/**
 * Hook to fetch bookings for owner
 */
export const useOwnerBookings = (enabled: boolean = true) => {
  return useQuery<Booking[], Error>({
    queryKey: QUERY_KEYS.ownerBookings(),
    queryFn: fetchOwnerBookings,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    enabled,
  });
};

/**
 * Hook to fetch bookings for a specific user
 * @param userId - The user ID to filter bookings by
 */
export const useUserBookings = (userId: string, enabled: boolean = true) => {
  return useQuery<Booking[], Error>({
    queryKey: QUERY_KEYS.userBookings(userId),
    queryFn: () => fetchUserBookings(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    enabled: !!userId && enabled,
  });
};

/**
 * Hook to fetch bookings - automatically selects owner or user bookings
 * @param userId - Optional user ID. If provided, fetches user bookings; otherwise fetches owner bookings
 */
export const useBookings = (userId?: string, enabled: boolean = true) => {
  const isUserBooking = !!userId;
  
  const userBookingsQuery = useUserBookings(userId || '', isUserBooking && enabled);
  const ownerBookingsQuery = useOwnerBookings(!isUserBooking && enabled);

  if (isUserBooking) {
    return userBookingsQuery;
  }

  return ownerBookingsQuery;
};

/**
 * Hook to fetch all dashboard call logs
 */
export const useDashboardCalls = (enabled: boolean = true) => {
  return useQuery<CallLog[], Error>({
    queryKey: QUERY_KEYS.ownerCalls(),
    queryFn: fetchDashboardCalls,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    enabled,
  });
};

/**
 * Hook to fetch call logs for a specific user
 * @param userId - The user ID to filter call logs by
 */
export const useUserCalls = (userId: string, enabled: boolean = true) => {
  return useQuery<CallLog[], Error>({
    queryKey: QUERY_KEYS.userCalls(userId),
    queryFn: () => fetchUserCalls(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    enabled: !!userId && enabled,
  });
};

/**
 * Hook to fetch call logs with pagination
 * @param page - Page number
 * @param limit - Items per page
 * @param userId - Optional user ID to filter by
 */
export const useCallsWithPagination = (
  page: number = 1,
  limit: number = 20,
  userId?: string,
  enabled: boolean = true
) => {
  return useQuery<{ calls: CallLog[]; total: number; page: number; limit: number }, Error>({
    queryKey: QUERY_KEYS.callsWithPagination(page, limit, userId),
    queryFn: () => fetchCallsWithPagination(page, limit, userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    enabled,
  });
};

/**
 * Hook to fetch call logs - automatically selects owner or user calls
 * @param userId - Optional user ID. If provided, fetches user calls; otherwise fetches owner calls
 */
export const useCalls = (userId?: string, enabled: boolean = true) => {
  const isUserCall = !!userId;
  
  const userCallsQuery = useUserCalls(userId || '', isUserCall && enabled);
  const ownerCallsQuery = useDashboardCalls(!isUserCall && enabled);

  if (isUserCall) {
    return userCallsQuery;
  }

  return ownerCallsQuery;
};
