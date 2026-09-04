/**
 * Bookings Feature - API Layer
 * 
 * Core API functions for bookings and availability using centralized apiClient.
 * All HTTP calls are handled through apiClient (no direct fetch/axios).
 */
import { apiClient } from '../../shared/apiClient';

// Simple logger for SDK - avoids Next.js dependency
const logger = {
  debug: (...args: any[]) => console.debug('[Bookings-SDK]', ...args),
  info: (...args: any[]) => console.info('[Bookings-SDK]', ...args),
  warn: (...args: any[]) => console.warn('[Bookings-SDK]', ...args),
  error: (message: string, context?: any, error?: any) => console.error('[Bookings-SDK]', message, context, error),
};
const BOOKINGS_PATH = '/api/deals-pipeline/bookings';
const LEGACY_BOOKINGS_PATH = '/api/deals-pipeline/booking';
// ============================================================================
// TYPES
// ============================================================================
export interface BookingParams {
  leadId?: string | number;
  userId?: string | number;
  date?: string;
  startTime?: string;
  endTime?: string;
  tenantId?: string;
  studentId?: string;
  assignedUserId?: string;
  createdBy?: string;
  bookingType?: string;
  bookingSource?: string;
  timezone?: string;
}
export interface BookingResponse {
  id: string | number;
  leadId?: string | number;
  userId: string | number;
  userName?: string;
  userEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  start_time?: string;
  end_time?: string;
  created_at?: string;
}
export interface AvailabilityParams {
  userId: string | number;
  date: string;
  startTime?: string;
  endTime?: string;
}
export interface AvailabilityResponse {
  available: boolean;
  message?: string;
}
export interface BookingAvailabilitySlot {
  start: string;
  end: string;
  [key: string]: any;
}
export interface BookingAvailabilityResult {
  availableSlots: BookingAvailabilitySlot[];
  bookings: BookingAvailabilitySlot[];
  raw?: any;
}
export interface UnavailableSlotsResponse {
  available_slots?: Array<{
    startTime: string;
    endTime: string;
  }>;
  bookedSlots?: Array<{
    startTime: string;
    endTime: string;
    leadId?: string | number;
  }>;
  [key: string]: any;
}
// ============================================================================
// BOOKINGS
// ============================================================================
/**
 * Fetch bookings for a lead or user
 */
export async function fetchBookings(params: BookingParams): Promise<BookingResponse[]> {
  try {
    const queryParams: Record<string, string> = {};
    if (params.leadId) {
      queryParams.leadId = String(params.leadId);
      queryParams.lead_id = String(params.leadId);
    }
    if (params.date) {
      queryParams.date = params.date;
    }
    if (params.userId) {
      queryParams.userId = String(params.userId);
      queryParams.user_id = String(params.userId);
    }
    let response;
    try {
      response = await apiClient.get(BOOKINGS_PATH, { params: queryParams });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        response = await apiClient.get(LEGACY_BOOKINGS_PATH, { params: queryParams });
      } else {
        throw error;
      }
    }
    const bookings = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
    return bookings.filter((booking: any) => {
      const status = booking.status?.toLowerCase();
      return status !== 'cancelled' && status !== 'canceled';
    });
  } catch (error) {
    logger.error('fetchBookings failed', { params }, error);
    throw error;
  }
}
/**
 * Create a new booking
 */
export async function createBooking(bookingData: BookingParams): Promise<BookingResponse> {
  try {
    const payload = {
      leadId: bookingData.leadId,
      userId: bookingData.userId,
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      timezone: bookingData.timezone,
      ...(bookingData.tenantId && { tenantId: bookingData.tenantId }),
      ...(bookingData.studentId && { studentId: bookingData.studentId }),
      ...(bookingData.assignedUserId && { assignedUserId: bookingData.assignedUserId }),
      ...(bookingData.createdBy && { createdBy: bookingData.createdBy }),
      ...(bookingData.bookingType && { bookingType: bookingData.bookingType }),
      ...(bookingData.bookingSource && { bookingSource: bookingData.bookingSource }),
    };
    let response;
    try {
      response = await apiClient.post(BOOKINGS_PATH, payload);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        response = await apiClient.post(LEGACY_BOOKINGS_PATH, payload);
      } else {
        throw error;
      }
    }
    return response.data;
  } catch (error) {
    logger.error('createBooking failed', { bookingData }, error);
    throw error;
  }
}
/**
 * Delete/cancel a booking
 */
export async function deleteBooking(bookingId: string | number): Promise<void> {
  try {
    try {
      await apiClient.delete(`${BOOKINGS_PATH}/${bookingId}`);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        await apiClient.delete(`${LEGACY_BOOKINGS_PATH}/${bookingId}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('deleteBooking failed', { bookingId }, error);
    throw error;
  }
}
// ============================================================================
// AVAILABILITY
// ============================================================================
/**
 * Check availability for a user on a specific date
 */
export async function checkAvailability(params: AvailabilityParams): Promise<AvailabilityResponse> {
  try {
    const response = await apiClient.get('/api/deals-pipeline/availability', {
      params: {
        userId: params.userId,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
      }
    });
    return response.data;
  } catch (error) {
    logger.error('checkAvailability failed', { params }, error);
    throw error;
  }
}
/**
 * Get available slots for a user within a date range
 */
export async function getAvailableSlots(params: {
  userId: string | number;
  dayStart: string;
  dayEnd: string;
  slotMinutes: number;
  timezone?: string;
}): Promise<BookingAvailabilityResult> {
  try {
    const response = await apiClient.get(`${BOOKINGS_PATH}/availability`, {
      params: {
        userId: params.userId,
        dayStart: params.dayStart,
        dayEnd: params.dayEnd,
        slotMinutes: params.slotMinutes,
        timezone: params.timezone,
      }
    });
    return response.data;
  } catch (error) {
    logger.error('getAvailableSlots failed', { params }, error);
    throw error;
  }
}
/**
 * Get unavailable/booked slots for a user on a specific date
 */
export async function getUnavailableSlots(params: {
  userId: string | number;
  date: string;
}): Promise<UnavailableSlotsResponse> {
  try {
    const response = await apiClient.get('/api/deals-pipeline/availability', {
      params: {
        userId: params.userId,
        date: params.date,
      }
    });
    return response.data;
  } catch (error) {
    logger.error('getUnavailableSlots failed', { params }, error);
    throw error;
  }
}
// ============================================================================
// COUNSELLORS
// ============================================================================
/**
 * Fetch list of available counsellors
 */
export async function fetchCounsellors(): Promise<unknown[]> {
  try {
    const response = await apiClient.get('/api/deals-pipeline/counsellors');
    const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
    return data;
  } catch (error) {
    logger.error('fetchCounsellors failed', error);
    throw error;
  }
}
