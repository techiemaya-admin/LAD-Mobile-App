import { CallStatus, LeadTemperature } from '@/types/calls';

const COMPLETED_STATUSES: CallStatus[] = ['completed', 'ended'];

export function categorizeLead(callDuration: number, callStatus: CallStatus): LeadTemperature {
  if (COMPLETED_STATUSES.includes(callStatus) && callDuration > 60) {
    return 'hot';
  }

  if (COMPLETED_STATUSES.includes(callStatus) && callDuration >= 10 && callDuration <= 60) {
    return 'warm';
  }

  return 'cold';
}

export function getLeadTemperatureColor(temperature: LeadTemperature) {
  switch (temperature) {
    case 'hot':
      return '#EF4444';
    case 'warm':
      return '#F59E0B';
    case 'cold':
      return '#3B82F6';
  }
}

export function getEngagementScore(callDuration: number, callStatus: CallStatus) {
  const durationScore = Math.min(Math.round((callDuration / 90) * 70), 70);
  const statusScore = callStatus === 'completed' || callStatus === 'ended' ? 30 : 0;

  return Math.max(5, Math.min(100, durationScore + statusScore));
}
