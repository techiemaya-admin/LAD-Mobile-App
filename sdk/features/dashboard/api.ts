/**
 * Dashboard Feature API
 * HTTP calls for dashboard users, bookings, and call logs data
 */

import { User, Booking, CallLog, DashboardUsersResponse, DashboardBookingsResponse, DashboardCallsResponse } from './types';

const getBackendUrl = (): string => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || '';
};

/**
 * Get authorization token from cookies
 * Token is stored during login process
 */
const getAuthToken = (): string | null => {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split(';') : [];

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    const name = rawName?.trim();
    const value = rawValueParts.join('=');

    if (!name) continue;

    if (name === 'auth_token' || name === 'token') {
      return decodeURIComponent(value || '');
    }
  }

  return null;
};

/**
 * Build fetch options with authorization header
 */
const getFetchOptions = () => {
  const token = getAuthToken();
  return {
    credentials: 'include' as const,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

/**
 * Fetch all users for the dashboard
 */
export const fetchDashboardUsers = async (): Promise<User[]> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  const response = await fetch(`${backendUrl}/api/dashboard/users`, getFetchOptions());

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch dashboard users: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.users || [];
};

/**
 * Fetch bookings for owner (no user_id filter)
 */
export const fetchOwnerBookings = async (): Promise<Booking[]> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  const response = await fetch(`${backendUrl}/api/dashboard/bookings`, getFetchOptions());

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch owner bookings: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.bookings || [];
};

/**
 * Fetch bookings for a specific user
 * @param userId - The user ID to filter bookings by
 */
export const fetchUserBookings = async (userId: string): Promise<Booking[]> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  const response = await fetch(
    `${backendUrl}/api/dashboard/bookings?user_id=${userId}`,
    getFetchOptions()
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch user bookings: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.bookings || [];
};

/**
 * Fetch bookings - defaults to owner if no userId provided
 * @param userId - Optional user ID to filter by
 */
export const fetchBookings = async (userId?: string): Promise<Booking[]> => {
  if (!userId) {
    return fetchOwnerBookings();
  }
  return fetchUserBookings(userId);
};

/**
 * Fetch all call logs for the dashboard
 */
export const fetchDashboardCalls = async (): Promise<CallLog[]> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  const response = await fetch(`${backendUrl}/api/dashboard/calls`, getFetchOptions());

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch dashboard calls: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.calls || [];
};

/**
 * Fetch call logs for a specific user
 * @param userId - The user ID to filter call logs by
 */
export const fetchUserCalls = async (userId: string): Promise<CallLog[]> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  const response = await fetch(
    `${backendUrl}/api/dashboard/calls?user_id=${userId}`,
    getFetchOptions()
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch user call logs: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.calls || [];
};

/**
 * Fetch call logs with pagination
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 20)
 * @param userId - Optional user ID to filter by
 */
export const fetchCallsWithPagination = async (
  page: number = 1,
  limit: number = 20,
  userId?: string
): Promise<{ calls: CallLog[]; total: number; page: number; limit: number }> => {
  const backendUrl = getBackendUrl();
  
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(userId && { user_id: userId }),
  });

  const response = await fetch(
    `${backendUrl}/api/dashboard/calls?${params.toString()}`,
    getFetchOptions()
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch call logs: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    calls: Array.isArray(data) ? data : data.calls || [],
    total: data.total || 0,
    page: data.page || page,
    limit: data.limit || limit,
  };
};

/**
 * Fetch call logs - defaults to owner if no userId provided
 * @param userId - Optional user ID to filter by
 */
export const fetchCalls = async (userId?: string): Promise<CallLog[]> => {
  if (!userId) {
    return fetchDashboardCalls();
  }
  return fetchUserCalls(userId);
};
