/**
 * Bookings Feature - Hooks
 * 
 * React hooks for bookings API operations with automatic loading, error, and caching logic.
 */
import { useState, useEffect } from 'react';
import * as bookingsApi from './api';
import { logger } from '@/lib/logger';
interface UseBookingsState {
  bookings: bookingsApi.BookingResponse[];
  loading: boolean;
  error: Error | null;
}
/**
 * Hook for fetching bookings
 */
export function useBookings(params: bookingsApi.BookingParams) {
  const [state, setState] = useState<UseBookingsState>({
    bookings: [],
    loading: true,
    error: null
  });
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const bookings = await bookingsApi.fetchBookings(params);
        if (isMounted) {
          setState({ bookings, loading: false, error: null });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('useBookings failed', error);
        if (isMounted) {
          setState({ bookings: [], loading: false, error: err });
        }
      }
    };
    if (params.leadId || params.userId) {
      load();
    }
    return () => { isMounted = false; };
  }, [params.leadId, params.userId, params.date]);
  return state;
}
/**
 * Hook for fetching available slots
 */
export function useAvailableSlots(params: {
  userId: string | number;
  dayStart: string;
  dayEnd: string;
  slotMinutes: number;
  timezone?: string;
} | null) {
  const [slots, setSlots] = useState<bookingsApi.BookingAvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<bookingsApi.BookingAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!params) return;
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await bookingsApi.getAvailableSlots(params);
        if (isMounted) {
          setSlots(result.availableSlots || []);
          setBookings(result.bookings || []);
          setLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('useAvailableSlots failed', err);
        if (isMounted) {
          setSlots([]);
          setBookings([]);
          setLoading(false);
          setError(error);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [params?.userId, params?.dayStart, params?.dayEnd]);
  return { slots, bookings, loading, error };
}
/**
 * Hook for fetching unavailable/booked slots
 */
export function useUnavailableSlots(params: {
  userId: string | number;
  date: string;
} | null) {
  const [data, setData] = useState<bookingsApi.UnavailableSlotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!params) return;
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await bookingsApi.getUnavailableSlots(params);
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('useUnavailableSlots failed', err);
        if (isMounted) {
          setData(null);
          setLoading(false);
          setError(error);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [params?.userId, params?.date]);
  return { data, loading, error };
}
/**
 * Hook for fetching counsellors
 */
export function useCounsellors() {
  const [counsellors, setCounsellors] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await bookingsApi.fetchCounsellors();
        if (isMounted) {
          setCounsellors(data);
          setLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('useCounsellors failed', err);
        if (isMounted) {
          setCounsellors([]);
          setLoading(false);
          setError(error);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);
  return { counsellors, loading, error };
}