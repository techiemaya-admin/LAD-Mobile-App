/**
 * Dashboard Hooks
 * React hooks for dashboard features
 */

import { useEffect, useState, useCallback } from 'react';
import { dashboardApiService } from './services/api';
import {
  LeadBooking,
  User,
  GetLeadBookingsParams,
  CreateLeadBookingParams,
  UpdateLeadBookingParams
} from './types';

// Hook: Get Lead Bookings
export function useLeadBookings(params?: GetLeadBookingsParams) {
  const [bookings, setBookings] = useState<LeadBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApiService.getLeadBookings(params);
      if (response.success && response.data) {
        setBookings(response.data);
      } else {
        // Silently handle API not available - return empty bookings
        setBookings([]);
      }
    } catch (err) {
      // Silently handle errors - don't block UI
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      setBookings([]);
      console.warn('Failed to fetch bookings:', errorObj.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
}

// Hook: Get Single Lead Booking
export function useLeadBooking(bookingId: string | null) {
  const [booking, setBooking] = useState<LeadBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const fetchBooking = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await dashboardApiService.getLeadBookingById(bookingId);
        if (response.success && response.data) {
          setBooking(response.data);
        } else {
          throw new Error(response.error || 'Failed to fetch booking');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  return { booking, loading, error };
}

// Hook: Create Lead Booking
export function useCreateLeadBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (data: CreateLeadBookingParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApiService.createLeadBooking(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create booking');
      }
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

// Hook: Update Lead Booking
export function useUpdateLeadBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (bookingId: string, data: UpdateLeadBookingParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApiService.updateLeadBooking(bookingId, data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update booking');
      }
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}

// Hook: Get Tenant Users (for owner role)
export function useTenantUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApiService.getTenantUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        // Silently handle API not available - return empty users
        setUsers([]);
      }
    } catch (err) {
      // Silently handle errors - don't block UI
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      setUsers([]);
      console.warn('Failed to fetch users:', errorObj.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}
