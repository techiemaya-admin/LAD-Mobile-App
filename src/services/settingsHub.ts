import { apiDelete, apiGet, apiPost, apiPut } from '@/src/api';

type ApiRecord = Record<string, unknown>;

export type CampaignStatus = 'draft' | 'running' | 'active' | 'paused' | 'completed' | 'stopped' | string;

export type CampaignItem = {
  id: string;
  name: string;
  status: CampaignStatus;
  type?: string;
  leadsCount: number;
  sentCount: number;
  deliveredCount: number;
  connectedCount: number;
  repliedCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CampaignStats = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  totalSent: number;
  totalDelivered: number;
  totalConnected: number;
  totalReplied: number;
  avgConnectionRate: number;
  avgReplyRate: number;
  connectionsToday: number;
  connectionsYesterday: number;
  dailyBreakdown: Array<{ date: string; count: number }>;
};

export type TeamMember = {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  status: string;
  avatar?: string;
  capabilities: string[];
  maskPhoneNumber: boolean;
  createdAt?: string;
};

export type BillingTransaction = {
  id: string;
  type: string;
  amount: number;
  balanceAfter?: number | null;
  description: string;
  createdAt?: string;
};

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
  description?: string;
};

export type BillingUsageFeature = {
  featureName: string;
  totalCredits: number;
  usageCount: number;
  percentage: number;
  icon: string;
};

export type BillingDailyUsage = {
  date: string;
  credits: number;
};

export type BillingUsageAnalytics = {
  totalCreditsUsed: number;
  topFeatures: BillingUsageFeature[];
  dailyUsage: BillingDailyUsage[];
  monthlyTrend: {
    currentMonth: number;
    lastMonth: number;
    percentageChange: number;
  };
};

export type BillingOverview = {
  currentBalance: number;
  availableBalance: number;
  reservedBalance: number;
  currency: string;
  status: string;
  planTier: string;
  monthlyUsage: number;
  totalSpent: number;
  transactions: BillingTransaction[];
  packages: CreditPackage[];
  usageAnalytics: BillingUsageAnalytics;
};

export type AnalyticsOverview = {
  campaignStats: CampaignStats;
  totalCalls: number;
  answeredCalls: number;
  callAnswerRate: number;
  creditsUsed30d: number;
  topFeatures: Array<{ featureName: string; credits: number; percentage: number }>;
};

export type SupportOverview = {
  email: string;
  backendStatus: 'online' | 'unavailable';
  statusLabel: string;
  responseTime: string;
};

export type SettingsHubData = {
  campaigns: {
    items: CampaignItem[];
    stats: CampaignStats;
  };
  analytics: AnalyticsOverview;
  team: {
    members: TeamMember[];
    activeCount: number;
  };
  billing: BillingOverview;
  support: SupportOverview;
};

export type SupportRequest = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const SUPPORT_EMAIL = 'support@techiemaya.com';
const DEFAULT_CREDITS_PER_DOLLAR = 1000 / 99;

const asRecord = (value: unknown): ApiRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {}
);

const pickOptionalNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const pickNumber = (...values: unknown[]) => pickOptionalNumber(...values) ?? 0;

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return '';
};

const pickBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return false;
};

const pickStringList = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const unwrapData = (payload: unknown): unknown => {
  const record = asRecord(payload);
  return record.data ?? payload;
};

const unwrapList = (payload: unknown): ApiRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as ApiRecord[];
  }

  const record = asRecord(payload);
  const keys = ['data', 'items', 'results', 'campaigns', 'users', 'members', 'logs', 'calls', 'transactions', 'packages', 'events'];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item) => item && typeof item === 'object') as ApiRecord[];
    }
    const nested = asRecord(value);
    for (const nestedKey of keys) {
      const nestedValue = nested[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue.filter((item) => item && typeof item === 'object') as ApiRecord[];
      }
    }
  }

  return [];
};

const unwrapRecordList = (payload: unknown): ApiRecord[] => {
  const list = unwrapList(payload);
  if (list.length) {
    return list;
  }

  const record = asRecord(payload);
  return Object.entries(record)
    .map(([key, value]) => {
      const nested = asRecord(value);
      return Object.keys(nested).length
        ? { featureKey: key, ...nested }
        : { featureKey: key, value };
    })
    .filter((item) => item.featureKey);
};

const normalizeCampaign = (raw: ApiRecord, index: number): CampaignItem => ({
  id: pickString(raw.id, raw.campaign_id, raw.uuid, `campaign-${index}`),
  name: pickString(raw.name, raw.campaign_name, raw.title, 'Untitled campaign'),
  status: pickString(raw.status, raw.state, 'draft'),
  type: pickString(raw.campaign_type, raw.type, raw.channel) || undefined,
  leadsCount: pickNumber(raw.leads_count, raw.total_leads, raw.leadsCount),
  sentCount: pickNumber(raw.sent_count, raw.total_sent, raw.sent),
  deliveredCount: pickNumber(raw.delivered_count, raw.total_delivered, raw.delivered),
  connectedCount: pickNumber(raw.connected_count, raw.total_connected, raw.connected),
  repliedCount: pickNumber(raw.replied_count, raw.total_replied, raw.replied),
  openedCount: pickNumber(raw.opened_count, raw.opened),
  clickedCount: pickNumber(raw.clicked_count, raw.clicked),
  createdAt: pickString(raw.created_at, raw.createdAt) || undefined,
  updatedAt: pickString(raw.updated_at, raw.updatedAt) || undefined,
});

const buildCampaignStatsFromCampaigns = (campaigns: CampaignItem[]): CampaignStats => {
  const activeStatuses = new Set(['running', 'active', 'in_progress', 'scheduled']);
  const totalConnected = campaigns.reduce((sum, campaign) => sum + campaign.connectedCount, 0);
  const totalSent = campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0);
  const totalReplied = campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0);

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => activeStatuses.has(String(campaign.status).toLowerCase())).length,
    totalLeads: campaigns.reduce((sum, campaign) => sum + campaign.leadsCount, 0),
    totalSent,
    totalDelivered: campaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0),
    totalConnected,
    totalReplied,
    avgConnectionRate: totalSent ? Math.round((totalConnected / totalSent) * 1000) / 10 : 0,
    avgReplyRate: totalSent ? Math.round((totalReplied / totalSent) * 1000) / 10 : 0,
    connectionsToday: 0,
    connectionsYesterday: 0,
    dailyBreakdown: [],
  };
};

const normalizeCampaignStats = (payload: unknown, campaigns: CampaignItem[] = []): CampaignStats => {
  const data = asRecord(unwrapData(payload));
  const fallback = buildCampaignStatsFromCampaigns(campaigns);
  const breakdown = data.connections_daily_breakdown ?? data.connectionsDailyBreakdown;

  // Use live data from the backend stats API if available, falling back to locally calculated metrics if needed.
  // Note: activeCampaigns is calculated locally from live campaigns status as the backend stats API active count is incorrect.
  return {
    totalCampaigns: pickNumber(data.total_campaigns, data.totalCampaigns, fallback.totalCampaigns),
    activeCampaigns: fallback.activeCampaigns,
    totalLeads: pickNumber(data.total_leads, data.totalLeads, fallback.totalLeads),
    totalSent: pickNumber(data.total_sent, data.totalSent, fallback.totalSent),
    totalDelivered: pickNumber(data.total_delivered, data.totalDelivered, fallback.totalDelivered),
    totalConnected: pickNumber(data.total_connected, data.totalConnected, fallback.totalConnected),
    totalReplied: pickNumber(data.total_replied, data.totalReplied, fallback.totalReplied),
    avgConnectionRate: pickNumber(data.avg_connection_rate, data.avgConnectionRate, fallback.avgConnectionRate),
    avgReplyRate: pickNumber(data.avg_reply_rate, data.avgReplyRate, fallback.avgReplyRate),
    connectionsToday: pickNumber(data.connections_today, data.connectionsToday),
    connectionsYesterday: pickNumber(data.connections_yesterday, data.connectionsYesterday),
    dailyBreakdown: Array.isArray(breakdown)
      ? breakdown.map((item) => {
        const record = asRecord(item);
        return { date: pickString(record.date), count: pickNumber(record.count, record.sent) };
      }).filter((item) => item.date)
      : [],
  };
};

const normalizeTeamMember = (raw: ApiRecord, index: number): TeamMember => {
  const firstName = pickString(raw.first_name, raw.firstName);
  const lastName = pickString(raw.last_name, raw.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const metadata = asRecord(raw.metadata);

  return {
    id: pickString(raw.id, raw.user_id, raw.uuid, `member-${index}`),
    name: pickString(raw.name, raw.full_name, fullName, raw.email, 'Team member'),
    email: pickString(raw.email, raw.user_email) || undefined,
    phoneNumber: pickString(raw.phoneNumber, raw.phone_number, raw.phone, raw.mobile, raw.mobile_number) || undefined,
    role: pickString(raw.role, raw.user_role, raw.permission, raw.type, 'Member'),
    status: pickString(raw.status, raw.state, raw.is_active === false ? 'inactive' : 'active'),
    avatar: pickString(raw.avatar, raw.avatar_url, raw.photo_url) || undefined,
    capabilities: pickStringList(raw.capabilities, raw.permissions, raw.page_permissions, metadata.capabilities, metadata.permissions),
    maskPhoneNumber: pickBoolean(raw.maskPhoneNumber, raw.mask_phone_number, metadata.maskPhoneNumber, metadata.mask_phone_number),
    createdAt: pickString(raw.created_at, raw.createdAt) || undefined,
  };
};

const getNormalizedTransactionType = (raw: ApiRecord, rawAmount: number): 'credit' | 'debit' => {
  const rawType = pickString(raw.transaction_type, raw.transactionType, raw.type).toLowerCase();
  if (['topup', 'credit', 'refund'].includes(rawType)) {
    return 'credit';
  }
  if (['debit', 'charge', 'usage', 'deduction'].includes(rawType)) {
    return 'debit';
  }
  return rawAmount < 0 ? 'debit' : 'credit';
};

const normalizeBillingTransaction = (
  raw: ApiRecord,
  index: number,
  creditsPerDollar = DEFAULT_CREDITS_PER_DOLLAR,
): BillingTransaction => {
  const rawAmount = pickOptionalNumber(raw.amount, raw.amount_usd, raw.usd, raw.totalCost, raw.total_cost) ?? 0;
  const rawCurrency = pickString(raw.currency).toLowerCase();
  const type = getNormalizedTransactionType(raw, rawAmount);
  const backendCreditAmount = pickOptionalNumber(
    raw.credits_amount,
    raw.creditsAmount,
    raw.credit_amount,
    raw.credits,
    raw.totalCredits,
    raw.total_credits,
  );
  const amountInCredits = Math.abs(backendCreditAmount ?? (
    rawCurrency === 'credits' ? Math.abs(rawAmount) : Math.abs(rawAmount) * creditsPerDollar
  ));
  const rawCreditBalanceAfter = pickOptionalNumber(raw.credits_balance_after, raw.creditsBalanceAfter);
  const rawBalanceAfter = pickOptionalNumber(raw.balance_after, raw.balanceAfter);
  const balanceAfter = rawCreditBalanceAfter ?? (
    rawBalanceAfter !== null ? rawBalanceAfter * creditsPerDollar : null
  );

  return {
    id: pickString(raw.id, raw.transaction_id, raw.transactionId, `transaction-${index}`),
    type,
    amount: type === 'debit' ? -amountInCredits : amountInCredits,
    balanceAfter,
    description: pickString(raw.description, raw.reference_type, raw.referenceType, raw.featureKey, raw.feature_key, 'Usage event'),
    createdAt: pickString(raw.created_at, raw.createdAt, raw.chargedAt) || undefined,
  };
};

const normalizeCreditPackage = (raw: ApiRecord, index: number): CreditPackage => ({
  id: pickString(raw.id, raw.packageId, `package-${index}`),
  name: pickString(raw.name, raw.title, `${pickNumber(raw.credits)} credits`),
  credits: pickNumber(raw.credits, raw.credit_amount, raw.amount),
  price: pickNumber(raw.price, raw.amount_usd, raw.usd, raw.cost),
  popular: Boolean(raw.popular || raw.is_popular),
  description: pickString(raw.description, raw.subtitle) || undefined,
});

export const emptyBillingUsageAnalytics = (): BillingUsageAnalytics => ({
  totalCreditsUsed: 0,
  topFeatures: [],
  dailyUsage: [],
  monthlyTrend: {
    currentMonth: 0,
    lastMonth: 0,
    percentageChange: 0,
  },
});

const normalizeBillingUsageAnalytics = (payload: unknown): BillingUsageAnalytics => {
  const root = asRecord(unwrapData(payload));
  const data = asRecord(root.analytics ?? root.usageAnalytics ?? root.usage_analytics ?? root);
  const trend = asRecord(data.monthlyTrend ?? data.monthly_trend);
  const topFeaturesSource = data.topFeatures
    ?? data.top_features
    ?? data.usageByFeature
    ?? data.usage_by_feature
    ?? data.byFeature
    ?? data.by_feature
    ?? data.features;
  const dailyUsageSource = data.dailyUsage
    ?? data.daily_usage
    ?? data.byDay
    ?? data.by_day
    ?? data.daily;
  const topFeatures = unwrapRecordList(topFeaturesSource).map((item) => ({
    featureName: pickString(item.featureName, item.feature_name, item.name, item.featureKey, item.feature_key, 'Usage'),
    totalCredits: pickNumber(item.totalCredits, item.total_credits, item.totalCost, item.total_cost, item.credits, item.cost, item.value),
    usageCount: pickNumber(item.usageCount, item.usage_count, item.count, item.eventCount, item.event_count, item.events, item.totalEvents, item.total_events),
    percentage: pickNumber(item.percentage, item.percent),
    icon: pickString(item.icon, item.featureIcon, item.feature_icon, 'bar-chart'),
  }));

  const totalCreditsUsed = pickNumber(
    data.totalCreditsUsed,
    data.total_credits_used,
    data.totalCost,
    data.total_cost,
    topFeatures.reduce((sum, item) => sum + item.totalCredits, 0),
  );

  return {
    totalCreditsUsed,
    topFeatures,
    dailyUsage: unwrapRecordList(dailyUsageSource).map((item) => ({
      date: pickString(item.date, item.day, item.created_at, item.featureKey),
      credits: pickNumber(item.credits, item.totalCredits, item.total_credits, item.totalCost, item.total_cost, item.cost, item.value),
    })).filter((item) => item.date),
    monthlyTrend: {
      currentMonth: pickNumber(trend.currentMonth, trend.current_month),
      lastMonth: pickNumber(trend.lastMonth, trend.last_month),
      percentageChange: pickNumber(trend.percentageChange, trend.percentage_change),
    },
  };
};

const normalizeBillingOverview = (
  walletPayload: unknown,
  transactionsPayload: unknown,
  packagesPayload: unknown,
  usagePayload: unknown,
): BillingOverview => {
  const walletRoot = asRecord(walletPayload);
  const walletData = asRecord(unwrapData(walletPayload));
  const wallet = asRecord(walletData.wallet ?? walletRoot.wallet ?? walletData);
  const usage = normalizeBillingUsageAnalytics(usagePayload);
  const transactionsRoot = asRecord(transactionsPayload);
  const transactionsData = asRecord(unwrapData(transactionsPayload));
  const creditsPerDollar = pickNumber(
    transactionsData.creditsPerDollar,
    transactionsData.credits_per_dollar,
    transactionsRoot.creditsPerDollar,
    transactionsRoot.credits_per_dollar,
    walletRoot.creditsPerDollar,
    walletRoot.credits_per_dollar,
    DEFAULT_CREDITS_PER_DOLLAR,
  );

  return {
    currentBalance: pickNumber(wallet.currentBalance, wallet.current_balance, wallet.balance, wallet.credits, walletRoot.credits),
    availableBalance: pickNumber(wallet.availableBalance, wallet.available_balance, wallet.balance, walletRoot.balance, walletRoot.credits),
    reservedBalance: pickNumber(wallet.reservedBalance, wallet.reserved_balance),
    currency: pickString(wallet.currency, walletRoot.currency, 'credits'),
    status: pickString(wallet.status, walletRoot.status, 'active'),
    planTier: pickString(wallet.planTier, wallet.plan_tier, walletData.planTier, walletData.plan_tier, transactionsData.planTier, transactionsData.plan_tier, transactionsRoot.planTier, walletRoot.planTier, 'starter'),
    monthlyUsage: pickNumber(walletData.monthlyUsage, walletData.monthly_usage, walletRoot.monthlyUsage, walletRoot.monthly_usage, usage.totalCreditsUsed),
    totalSpent: pickNumber(walletData.totalSpent, walletData.total_spent, walletRoot.totalSpent, walletRoot.total_spent),
    transactions: unwrapList(transactionsPayload).map((item, index) => normalizeBillingTransaction(item, index, creditsPerDollar)),
    packages: unwrapList(packagesPayload).map(normalizeCreditPackage).slice(0, 4),
    usageAnalytics: usage,
  };
};

const normalizeCallsOverview = (payload: unknown) => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const logs = unwrapList(data.logs ?? data.calls ?? data);
  const summary = unwrapList(data.summary);
  const totalFromSummary = summary.reduce((sum, item) => sum + pickNumber(item.count, item.total, item.calls), 0);
  const totalCalls = logs.length || totalFromSummary;
  const answeredCalls = logs.filter((item) => {
    const status = pickString(item.status, item.call_status, item.result).toLowerCase();
    return status.includes('answer') || status.includes('complete') || status.includes('ended') || status.includes('success');
  }).length;

  return {
    totalCalls,
    answeredCalls,
    callAnswerRate: totalCalls ? Math.round((answeredCalls / totalCalls) * 1000) / 10 : 0,
  };
};

const normalizeUsageOverview = (payload: unknown) => {
  const usage = normalizeBillingUsageAnalytics(payload);

  return {
    creditsUsed30d: usage.totalCreditsUsed,
    topFeatures: usage.topFeatures.map((item) => ({
      featureName: item.featureName,
      credits: item.totalCredits,
      percentage: item.percentage,
    })).slice(0, 4),
  };
};

const safe = async <T,>(task: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await task;
  } catch {
    return fallback;
  }
};

export async function getCampaigns(): Promise<CampaignItem[]> {
  const response = await apiGet<unknown>('/api/campaigns');
  return unwrapList(response.data).map(normalizeCampaign);
}

export async function getCampaignStats(campaigns: CampaignItem[] = []): Promise<CampaignStats> {
  const response = await apiGet<unknown>('/api/campaigns/stats');
  return normalizeCampaignStats(response.data, campaigns);
}

export async function updateCampaignLifecycle(campaignId: string, action: 'start' | 'pause' | 'resume' | 'stop') {
  await apiPost(`/api/campaigns/${encodeURIComponent(campaignId)}/${action}`, {});
}

export async function deleteCampaign(campaignId: string) {
  await apiDelete(`/api/campaigns/${encodeURIComponent(campaignId)}`);
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await apiGet<unknown>('/api/users')
    .catch(() => apiGet<unknown>('/api/overview/users'));
  return unwrapList(response.data).map(normalizeTeamMember);
}

export async function updateTeamMemberPhoneMask(userId: string, maskPhoneNumber: boolean) {
  const response = await apiPut<unknown>(`/api/users/${encodeURIComponent(userId)}/mask-phone`, {
    maskPhoneNumber,
  });

  return normalizeTeamMember(asRecord(unwrapData(response.data)), 0);
}

export async function deleteTeamMember(userId: string) {
  await apiDelete(`/api/users/${encodeURIComponent(userId)}`);
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const [wallet, transactions, packages, usage] = await Promise.all([
    safe(apiGet<unknown>('/api/billing/wallet').then((response) => response.data), {}),
    safe(apiGet<unknown>('/api/billing/transactions', { params: { limit: 20 } }).then((response) => response.data), {}),
    safe(apiGet<unknown>('/api/wallet/packages').then((response) => response.data), {}),
    safe(apiGet<unknown>('/api/wallet/usage/analytics', { params: { timeRange: '30d' } }).then((response) => response.data), {}),
  ]);

  return normalizeBillingOverview(wallet, transactions, packages, usage);
}

export async function getWalletUsageAnalytics(timeRange: '7d' | '30d' | '90d' = '30d'): Promise<BillingUsageAnalytics> {
  const response = await apiGet<unknown>('/api/wallet/usage/analytics', { params: { timeRange } });
  return normalizeBillingUsageAnalytics(response.data);
}

export async function getAnalyticsOverview(campaigns: CampaignItem[] = []): Promise<AnalyticsOverview> {
  const [campaignStats, calls, usage] = await Promise.all([
    safe(getCampaignStats(campaigns), buildCampaignStatsFromCampaigns(campaigns)),
    safe(apiGet<unknown>('/api/overview/calls').then((response) => normalizeCallsOverview(response.data)), {
      totalCalls: 0,
      answeredCalls: 0,
      callAnswerRate: 0,
    }),
    safe(apiGet<unknown>('/api/wallet/usage/analytics', { params: { timeRange: '30d' } }).then((response) => normalizeUsageOverview(response.data)), {
      creditsUsed30d: 0,
      topFeatures: [],
    }),
  ]);

  return {
    campaignStats,
    totalCalls: calls.totalCalls,
    answeredCalls: calls.answeredCalls,
    callAnswerRate: calls.callAnswerRate,
    creditsUsed30d: usage.creditsUsed30d,
    topFeatures: usage.topFeatures,
  };
}

export async function getSupportOverview(): Promise<SupportOverview> {
  const health = await safe(
    apiGet<unknown>('/api/health').then(() => true),
    false,
  );

  return {
    email: SUPPORT_EMAIL,
    backendStatus: health ? 'online' : 'unavailable',
    statusLabel: health ? 'Backend online' : 'Support form available',
    responseTime: 'Typical reply: 1 business day',
  };
}

export async function fetchSettingsHubData(): Promise<SettingsHubData> {
  const campaigns = await safe(getCampaigns(), []);
  const fallbackSupport: SupportOverview = {
    email: SUPPORT_EMAIL,
    backendStatus: 'unavailable',
    statusLabel: 'Support form available',
    responseTime: 'Typical reply: 1 business day',
  };
  const [stats, analytics, teamMembers, billing, support] = await Promise.all([
    safe(getCampaignStats(campaigns), buildCampaignStatsFromCampaigns(campaigns)),
    safe(getAnalyticsOverview(campaigns), {
      campaignStats: buildCampaignStatsFromCampaigns(campaigns),
      totalCalls: 0,
      answeredCalls: 0,
      callAnswerRate: 0,
      creditsUsed30d: 0,
      topFeatures: [],
    }),
    safe(getTeamMembers(), []),
    safe(getBillingOverview(), {
      currentBalance: 0,
      availableBalance: 0,
      reservedBalance: 0,
      currency: 'credits',
      status: 'unknown',
      planTier: 'starter',
      monthlyUsage: 0,
      totalSpent: 0,
      transactions: [],
      packages: [],
      usageAnalytics: emptyBillingUsageAnalytics(),
    }),
    safe(getSupportOverview(), fallbackSupport),
  ]);

  return {
    campaigns: {
      items: campaigns,
      stats,
    },
    analytics,
    team: {
      members: teamMembers,
      activeCount: teamMembers.filter((member) => member.status.toLowerCase() !== 'inactive').length,
    },
    billing,
    support,
  };
}

export async function submitSupportRequest(request: SupportRequest) {
  const response = await apiPost('/api/contact', {
    ...request,
    source: 'lad-app',
  });

  return response.data;
}

export async function createRechargeSession(packageId: string) {
  const response = await apiPost<{ sessionUrl?: string; url?: string }>('/api/wallet/recharge', {
    packageId,
    successUrl: 'https://techiemaya.com/wallet/success',
    cancelUrl: 'https://techiemaya.com/wallet/cancel',
  });

  return response.data.sessionUrl || response.data.url || '';
}

export async function createStripeCheckoutSession(params: {
  amount: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const response = await apiPost<{ url?: string; sessionUrl?: string; sessionId?: string }>('/api/stripe/create-credits-checkout', params);
  return {
    url: response.data.url || response.data.sessionUrl || '',
    sessionId: response.data.sessionId || '',
  };
}
