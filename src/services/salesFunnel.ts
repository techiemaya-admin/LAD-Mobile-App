import { apiGet } from '@/src/api';

/**
 * Sales funnel (cross-channel lead journey) — mirrors LAD-Frontend-2's
 * CombinedFunnelWidget data flow: GET /api/campaigns/lead-journey?from=&to=
 * returns per-stage counts plus the lead lists for drill-down.
 */

export type FunnelStageKey = 'sent' | 'accepted' | 'responded' | 'sah';

export type FunnelLead = {
  lead_id: string;
  name: string;
  company_name: string | null;
  industry: string | null;
  linkedin_url: string | null;
  campaign_name: string | null;
  next_followup_at: string | null;
};

export type SalesFunnelData = {
  counts: Record<FunnelStageKey, number>;
  lists: Record<FunnelStageKey, FunnelLead[]>;
};

export type FunnelPeriodKey = 'week' | 'month' | 'quarter' | 'year';

export const FUNNEL_PERIODS: { key: FunnelPeriodKey; label: string; days: number }[] = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'quarter', label: 'Quarter', days: 90 },
  { key: 'year', label: 'Year', days: 365 },
];

export const FUNNEL_STAGES: { key: FunnelStageKey; label: string; color: string }[] = [
  { key: 'sent', label: 'New Leads', color: '#0F6E56' },
  { key: 'accepted', label: 'Accepted', color: '#1D9E75' },
  { key: 'responded', label: 'Responded', color: '#5DCAA5' },
  { key: 'sah', label: 'Meeting Booked', color: '#639922' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const toLeadList = (value: unknown): FunnelLead[] =>
  Array.isArray(value)
    ? value.filter((item): item is FunnelLead => Boolean(item) && typeof item === 'object')
    : [];

export async function fetchSalesFunnel(period: FunnelPeriodKey): Promise<SalesFunnelData> {
  const days = FUNNEL_PERIODS.find((p) => p.key === period)?.days ?? 7;
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);

  const response = await apiGet<any>('/api/campaigns/lead-journey', {
    params: { from: from.toISOString(), to: to.toISOString() },
  });
  const json = response.data ?? {};
  if (json?.success === false) {
    throw new Error(json?.error || 'Failed to load funnel');
  }

  const counts = json?.counts ?? {};
  return {
    counts: {
      sent: Number(counts.sent) || 0,
      accepted: Number(counts.accepted) || 0,
      responded: Number(counts.responded) || 0,
      sah: Number(counts.sah) || 0,
    },
    lists: {
      sent: toLeadList(json?.sent),
      accepted: toLeadList(json?.accepted),
      responded: toLeadList(json?.responded),
      sah: toLeadList(json?.sah),
    },
  };
}
