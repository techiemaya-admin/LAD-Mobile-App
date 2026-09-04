/**
 * Bookings Feature - Types
 */
export interface Booking {
  id: string | number;
  leadId?: string | number;
  userId: string | number;
  userName?: string;
  userEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
}
export interface AvailabilitySlot {
  start: string;
  end: string;
}
export interface BookedSlot extends AvailabilitySlot {
  leadId?: string | number;
}
export interface Counsellor {
  id: string | number;
  name: string;
  email?: string;
  [key: string]: any;
}