import { useCallback } from 'react';
import { CallStatus } from '@/types/calls';
import {
  categorizeLead,
  getEngagementScore,
  getLeadTemperatureColor,
} from '@/services/leadCategorization';

export function useLeadCategorization() {
  const categorize = useCallback((duration: number, status: CallStatus) => {
    const leadTemperature = categorizeLead(duration, status);

    return {
      leadTemperature,
      engagement_score: getEngagementScore(duration, status),
      statusColor: getLeadTemperatureColor(leadTemperature),
    };
  }, []);

  return {
    categorizeLead: categorize,
    getLeadTemperatureColor,
  };
}
