import type { DashboardIconName } from '@/components/features/DashboardSection';
import { apiGet } from '@/src/api';
import { getCallLogs, getCallLogsStats, type CallLogResponse, type CallLogsStats } from '@/src/services/call-logs';
import { getActiveTenantId } from '@/src/api/storage';
import { getConversations, getConversationStats, type Conversation } from '@/src/services/conversationService';
import { getConnectedIntegrations } from '@/src/services/integration.service';
import {
  getAnalyticsOverview,
  getBillingOverview,
  getCampaigns,
  getTeamMembers,
  type CampaignItem,
} from '@/src/services/settingsHub';
import { getUserAvailableAgents, getUserAvailableNumbers } from '@/src/services/voice-agent';
import type { ConnectedIntegration } from '@/src/types/chat';

type ApiRecord = Record<string, unknown>;
type HomeChannel = 'linkedin' | 'whatsapp' | 'email' | 'instagram' | 'voice';

export type HomeDashboardCard = {
  label: string;
  icon: DashboardIconName;
  count: number;
};

export type HomeDashboardSectionVariant = {
  key: string;
  label: string;
  cards: HomeDashboardCard[];
};

export type HomeDashboardSection = {
  title: string;
  icon: DashboardIconName;
  channel: HomeChannel;
  accentColor: string;
  cards: HomeDashboardCard[];
  /** When present with >1 entry, the UI renders a switcher (e.g. WhatsApp Personal vs Business API). */
  variants?: HomeDashboardSectionVariant[];
};

export type HomeDashboardSummary = {
  activeChannels: number;
  totalConversations: number;
  unreadConversations: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  queuedCalls: number;
  teamMembers: number;
  walletBalance: number;
  bookingsToday: number;
  voiceAgents: number;
  voiceNumbers: number;
};

export type HomeDashboardActivity = {
  id: string;
  title: string;
  meta: string;
  channel: HomeChannel | 'campaign' | 'team' | 'billing';
  at?: string;
};

export type HomeDashboardData = {
  sections: HomeDashboardSection[];
  summary: HomeDashboardSummary;
  latestActivity: HomeDashboardActivity[];
  sourceErrors: string[];
  loadedAt: string;
};

const ACTIVE_CAMPAIGN_STATUSES = new Set(['active', 'running', 'in_progress', 'scheduled']);
const ANSWERED_CALL_STATUSES = ['answer', 'complete', 'completed', 'ended', 'success', 'connected'];
const MISSED_CALL_STATUSES = ['missed', 'no-answer', 'no_answer', 'failed', 'busy', 'cancelled'];
const QUEUED_CALL_STATUSES = ['queued', 'queue', 'ringing', 'in-progress', 'in_progress', 'initiated', 'processing'];

const asRecord = (value: unknown): ApiRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {}
);

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return '';
};

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const unwrapList = (payload: unknown): ApiRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as ApiRecord[];
  }

  const record = asRecord(payload);
  const keys = [
    'data',
    'items',
    'results',
    'bookings',
    'appointments',
    'events',
    'calls',
    'logs',
    'rows',
  ];

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

const safe = async <T,>(
  source: string,
  task: Promise<T>,
  fallback: T,
  sourceErrors: string[],
): Promise<T> => {
  try {
    return await task;
  } catch {
    sourceErrors.push(source);
    return fallback;
  }
};

const toDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isToday = (value: unknown) => {
  const date = toDate(value);
  if (!date) {
    return false;
  }

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
};

const getChannel = (value: unknown): HomeChannel | 'other' => {
  const channel = String(value ?? '').toLowerCase();
  if (channel.includes('linkedin')) {
    return 'linkedin';
  }
  if (channel.includes('instagram')) {
    return 'instagram';
  }
  if (channel.includes('gmail') || channel.includes('email') || channel.includes('mail')) {
    return 'email';
  }
  if (channel.includes('whatsapp') || channel.includes('waba') || channel.includes('personal')) {
    return 'whatsapp';
  }
  if (channel.includes('voice') || channel.includes('call')) {
    return 'voice';
  }
  return 'other';
};

const channelConversations = (conversations: Conversation[], channel: HomeChannel) =>
  conversations.filter((conversation) => getChannel(conversation.channel) === channel);

const unreadCount = (conversations: Conversation[]) =>
  conversations.reduce((sum, conversation) => sum + Math.max(0, Number(conversation.unreadCount ?? 0)), 0);

const activeConversationCount = (conversations: Conversation[]) =>
  conversations.filter((conversation) => {
    const state = String(conversation.conversationState ?? conversation.status ?? '').toLowerCase();
    return !state || !['closed', 'archived', 'resolved', 'deleted'].includes(state);
  }).length;

const conversationTodayCount = (conversations: Conversation[]) =>
  conversations.filter((conversation) => isToday(conversation.startedAt ?? conversation.lastMessageAt)).length;

const aiHandledCount = (conversations: Conversation[]) =>
  conversations.filter((conversation) => conversation.ownerType === 'AI').length;

const agentHandledCount = (conversations: Conversation[]) =>
  conversations.filter((conversation) => conversation.ownerType === 'human_agent').length;

// WhatsApp conversations arrive tagged with waBackendChannel: 'waba' (Business API)
// or 'personal'. Untagged conversations default to personal.
const whatsappByAccount = (conversations: Conversation[], account: 'personal' | 'waba') =>
  conversations.filter((conversation) => (conversation.waBackendChannel ?? 'personal') === account);

const buildWhatsAppCards = (conversations: Conversation[], stats?: any): HomeDashboardCard[] => {
  const rawStats = stats?.stats || stats?.summary || stats?.data?.stats || stats?.data?.summary || stats;

  const aiCount = pickNumber(
    rawStats?.ai_handled_chats,
    rawStats?.aiHandledChats,
    rawStats?.ai_handled,
    rawStats?.aiHandled,
    rawStats?.bot_handled,
    rawStats?.bot_handled_chats,
    rawStats?.ai,
    rawStats?.bot,
    aiHandledCount(conversations)
  );

  const humanCount = pickNumber(
    rawStats?.agent_handled_chats,
    rawStats?.agentHandledChats,
    rawStats?.agent_handled,
    rawStats?.agentHandled,
    rawStats?.human_handled,
    rawStats?.humanHandled,
    rawStats?.human_agent,
    rawStats?.humanAgent,
    rawStats?.human,
    rawStats?.agent,
    agentHandledCount(conversations)
  );

  return [
    { label: 'Total Chats', icon: 'Users2', count: conversations.length },
    { label: 'Unread', icon: 'MessageCircle', count: unreadCount(conversations) },
    { label: 'Active Chats', icon: 'MessageSquare', count: activeConversationCount(conversations) },
    { label: 'New Today', icon: 'Sparkles', count: conversationTodayCount(conversations) },
    { label: 'Agent Handled Chats', icon: 'Mic', count: aiCount },
    { label: 'Human Handled Chats', icon: 'Users', count: humanCount },
  ];
};

const isWhatsAppAccountConnected = (integrations: ConnectedIntegration[], label: string) =>
  integrations.some((integration) => integration.label === label && integration.connected);

const countCampaignsByChannel = (campaigns: CampaignItem[], channel: HomeChannel) =>
  campaigns.filter((campaign) => getChannel(campaign.type ?? campaign.name) === channel).length;

const activeCampaignsByChannel = (campaigns: CampaignItem[], channel: HomeChannel) =>
  campaigns.filter((campaign) => (
    getChannel(campaign.type ?? campaign.name) === channel
    && ACTIVE_CAMPAIGN_STATUSES.has(String(campaign.status).toLowerCase())
  )).length;

const getCallStatus = (call: CallLogResponse | ApiRecord) =>
  pickString(
    asRecord(call).status,
    asRecord(call).batch_status,
    asRecord(call).call_status,
    asRecord(call).result,
  ).toLowerCase();

const hasAnyStatus = (status: string, candidates: string[]) =>
  candidates.some((candidate) => status.includes(candidate));

const countCallsByStatus = (calls: (CallLogResponse | ApiRecord)[], statuses: string[]) =>
  calls.filter((call) => hasAnyStatus(getCallStatus(call), statuses)).length;

const getCallLogStats = async (): Promise<CallLogsStats | null> => {
  const tenantId = await getActiveTenantId();
  if (!tenantId) {
    return null;
  }

  return getCallLogsStats(tenantId);
};

const isBroadcastEmailContact = (conversation: Conversation) =>
  String(conversation.id ?? '').startsWith('email:') && !conversation.messageCount;

const isIntegrationConnected = (integrations: ConnectedIntegration[], channel: HomeChannel) => {
  if (channel === 'voice') {
    return true;
  }

  const matchesChannel = (integration: ConnectedIntegration) => {
    const haystack = `${integration.channel ?? ''} ${integration.label ?? ''}`.toLowerCase();

    if (channel === 'email') {
      return ['email', 'custom-email', 'gmail', 'google', 'outlook', 'microsoft', 'smtp'].some((token) => haystack.includes(token));
    }

    if (channel === 'whatsapp') {
      return ['whatsapp', 'wa business', 'waba', 'personal-wa', 'wapa'].some((token) => haystack.includes(token));
    }

    return haystack.includes(channel);
  };

  return integrations.some((integration) => integration.connected && matchesChannel(integration));
};

const getBookings = async () => {
  const response = await apiGet<unknown>('/api/overview/bookings', { params: { limit: 25 } });
  return unwrapList(response.data);
};

const getBookingDate = (booking: ApiRecord) =>
  booking.start_time
  ?? booking.startTime
  ?? booking.scheduled_at
  ?? booking.scheduledAt
  ?? booking.date
  ?? booking.created_at
  ?? booking.createdAt;

const getLatestAt = (activity: HomeDashboardActivity) => toDate(activity.at)?.getTime() ?? 0;

const buildLatestActivity = (
  conversations: Conversation[],
  calls: (CallLogResponse | ApiRecord)[],
  campaigns: CampaignItem[],
): HomeDashboardActivity[] => {
  const conversationActivities = conversations.map<HomeDashboardActivity>((conversation) => {
    const channel = getChannel(conversation.channel);
    return {
      id: `conversation-${conversation.id}`,
      title: conversation.name || 'Conversation',
      meta: `${channel === 'other' ? 'chat' : channel} - ${conversation.lastMessage || 'No messages yet'}`,
      channel: channel === 'other' ? 'whatsapp' : channel,
      at: conversation.lastMessageAt,
    };
  });

  const callActivities = calls.map<HomeDashboardActivity>((call, index) => ({
    id: `call-${pickString(asRecord(call).call_log_id, asRecord(call).id, index)}`,
    title: pickString(
      asRecord(call).lead_name,
      `${pickString(asRecord(call).lead_first_name)} ${pickString(asRecord(call).lead_last_name)}`.trim(),
      'Voice call',
    ),
    meta: `Call ${pickString(asRecord(call).status, asRecord(call).batch_status, 'updated')}`,
    channel: 'voice',
    at: pickString(asRecord(call).started_at, asRecord(call).created_at, asRecord(call).createdAt),
  }));

  const campaignActivities = campaigns.map<HomeDashboardActivity>((campaign) => ({
    id: `campaign-${campaign.id}`,
    title: campaign.name,
    meta: `Campaign ${campaign.status}`,
    channel: 'campaign',
    at: campaign.updatedAt ?? campaign.createdAt,
  }));

  return [...conversationActivities, ...callActivities, ...campaignActivities]
    .filter((activity) => activity.title)
    .sort((a, b) => getLatestAt(b) - getLatestAt(a))
    .slice(0, 5);
};

export async function fetchHomeDashboardData(): Promise<HomeDashboardData> {
  const sourceErrors: string[] = [];
  const campaigns = await safe('campaigns', getCampaigns(), [], sourceErrors);

  const [
    analytics,
    billing,
    teamMembers,
    conversations,
    conversationStats,
    callLogsResponse,
    callStats,
    integrationsSummary,
    bookings,
    voiceAgents,
    voiceNumbers,
  ] = await Promise.all([
    safe('analytics', getAnalyticsOverview(campaigns), {
      campaignStats: {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((campaign) => ACTIVE_CAMPAIGN_STATUSES.has(String(campaign.status).toLowerCase())).length,
        totalLeads: campaigns.reduce((sum, campaign) => sum + campaign.leadsCount, 0),
        totalSent: campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0),
        totalDelivered: campaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0),
        totalConnected: campaigns.reduce((sum, campaign) => sum + campaign.connectedCount, 0),
        totalReplied: campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0),
        avgConnectionRate: 0,
        avgReplyRate: 0,
        connectionsToday: 0,
        connectionsYesterday: 0,
        dailyBreakdown: [],
      },
      totalCalls: 0,
      answeredCalls: 0,
      callAnswerRate: 0,
      creditsUsed30d: 0,
      topFeatures: [],
    }, sourceErrors),
    safe('billing', getBillingOverview(), {
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
      usageAnalytics: {
        totalCreditsUsed: 0,
        topFeatures: [],
        dailyUsage: [],
        monthlyTrend: {
          currentMonth: 0,
          lastMonth: 0,
          percentageChange: 0,
        },
      },
    }, sourceErrors),
    safe('team', getTeamMembers(), [], sourceErrors),
    safe('conversations', getConversations({ limit: 100 }), [], sourceErrors),
    safe('conversation stats', getConversationStats({ limit: 1 }), null, sourceErrors),
    safe('call logs', getCallLogs({ page: 1, limit: 100 }), { logs: [] }, sourceErrors),
    safe('call stats', getCallLogStats(), null, sourceErrors),
    safe('integrations', getConnectedIntegrations(), { integrations: [] }, sourceErrors),
    safe('bookings', getBookings(), [], sourceErrors),
    safe('voice agents', getUserAvailableAgents(), [], sourceErrors),
    safe('voice numbers', getUserAvailableNumbers(), [], sourceErrors),
  ]);

  const calls = Array.isArray(callLogsResponse.logs) ? callLogsResponse.logs : unwrapList(callLogsResponse);
  const liveConversations = conversations.filter((conversation) => !isBroadcastEmailContact(conversation));
  const whatsapp = channelConversations(liveConversations, 'whatsapp');
  const email = channelConversations(liveConversations, 'email');
  const instagram = channelConversations(liveConversations, 'instagram');
  const bookingsToday = bookings.filter((booking) => isToday(getBookingDate(booking))).length;
  const answeredFromLogs = countCallsByStatus(calls, ANSWERED_CALL_STATUSES);
  const totalCallsFromLogs = pickNumber(callLogsResponse.pagination?.total, callLogsResponse.total, calls.length);

  const rawStats = (callLogsResponse as any).stats || (callLogsResponse as any).summary || (callStats as any)?.stats || (callStats as any)?.data || callStats;
  const totalStats = pickNumber(rawStats?.totalCalls, rawStats?.total_calls);
  const completedStats = pickNumber(rawStats?.completedCalls, rawStats?.completed_calls);
  const failedStats = pickNumber(rawStats?.failedCalls, rawStats?.failed_calls);
  const queueStats = pickNumber(rawStats?.queue, rawStats?.queued);
  const ongoingStats = pickNumber(rawStats?.ongoing, rawStats?.active);
  const hotLeadsStats = pickNumber(rawStats?.hotLeads, rawStats?.hot_leads);

  const useCallStats = totalStats > 0 || completedStats > 0;

  const totalCalls = useCallStats ? totalStats : totalCallsFromLogs;
  const answeredCalls = useCallStats ? completedStats : answeredFromLogs;
  const missedCalls = useCallStats ? failedStats : countCallsByStatus(calls, MISSED_CALL_STATUSES);
  const queuedCalls = useCallStats ? queueStats + ongoingStats : countCallsByStatus(calls, QUEUED_CALL_STATUSES);
  const ongoingCalls = useCallStats ? ongoingStats : countCallsByStatus(calls, QUEUED_CALL_STATUSES);
  const hotLeads = useCallStats ? hotLeadsStats : 0;
  const activeCampaigns = analytics.campaignStats.activeCampaigns;
  const campaignStats = analytics.campaignStats;
  const linkedinRateLimits = campaignStats.linkedinRateLimits;
  const linkedinDailyLimit = pickNumber(linkedinRateLimits?.daily?.total, linkedinRateLimits?.daily?.max);
  const linkedinWeeklyLimit = pickNumber(linkedinRateLimits?.weekly?.total, linkedinRateLimits?.weekly?.max);
  const linkedinWeeklyUsed = pickNumber(linkedinRateLimits?.usage?.sentLast7Days);

  // Split WhatsApp conversations by backend account (Business API vs Personal)
  // and detect which accounts are actually connected so the dashboard can offer
  // a switcher when the user runs both.
  const integrations = Array.isArray(integrationsSummary.integrations) ? integrationsSummary.integrations : [];
  const whatsappPersonal = whatsappByAccount(whatsapp, 'personal');
  const whatsappBusiness = whatsappByAccount(whatsapp, 'waba');
  const personalWaConnected = isWhatsAppAccountConnected(integrations, 'WhatsApp Personal');
  const businessWaConnected = isWhatsAppAccountConnected(integrations, 'WhatsApp API Agent');

  const whatsappVariants: HomeDashboardSectionVariant[] = [];
  if (personalWaConnected) {
    whatsappVariants.push({ key: 'personal', label: 'Personal', cards: buildWhatsAppCards(whatsappPersonal, conversationStats) });
  }
  if (businessWaConnected) {
    whatsappVariants.push({ key: 'business', label: 'Business API', cards: buildWhatsAppCards(whatsappBusiness, conversationStats) });
  }

  const sections: HomeDashboardSection[] = [
    {
      title: 'LinkedIn Integration Hub',
      icon: 'Users',
      channel: 'linkedin',
      accentColor: '#0077B5',
      cards: [
        { label: 'Generate Leads', icon: 'Users2', count: campaignStats.totalLeads },
        { label: 'Connection Requests Sent', icon: 'Send', count: campaignStats.totalSent },
        { label: 'Connections Accepted', icon: 'UserPlus', count: campaignStats.totalConnected },
        { label: 'LinkedIn Replies', icon: 'MessageCircle', count: campaignStats.totalReplied },
        { label: 'Daily Limit', icon: 'ListOrdered', count: linkedinDailyLimit },
        { label: linkedinWeeklyUsed > 0 ? 'Weekly Used' : 'Weekly Limit', icon: 'Clock', count: linkedinWeeklyUsed || linkedinWeeklyLimit },
      ],
    },
    {
      title: 'WhatsApp Communication Hub',
      icon: 'MessageSquare',
      channel: 'whatsapp',
      accentColor: '#25D366',
      // When both Personal and Business API accounts are connected, `variants`
      // drives an in-section switcher; otherwise `cards` shows the single account.
      cards: whatsappVariants[0]?.cards ?? [],
      variants: whatsappVariants.length > 1 ? whatsappVariants : undefined,
    },
    {
      title: 'Instagram DM Hub',
      icon: 'MessageCircle',
      channel: 'instagram',
      accentColor: '#E1306C',
      cards: [
        { label: 'New DMs', icon: 'MessageCircle', count: conversationTodayCount(instagram) },
        { label: 'Unread DMs', icon: 'LogIn', count: unreadCount(instagram) },
        { label: 'Lead Replies', icon: 'Send', count: activeConversationCount(instagram) },
        { label: 'Campaign Touches', icon: 'Sparkles', count: countCampaignsByChannel(campaigns, 'instagram') },
        { label: 'Follow-ups', icon: 'RefreshCcw', count: activeCampaignsByChannel(campaigns, 'instagram') },
        { label: 'Active Threads', icon: 'Users2', count: instagram.length },
      ],
    },
    {
      title: 'Email Management Hub',
      icon: 'Mail',
      channel: 'email',
      accentColor: '#2563EB',
      cards: [
        { label: 'Weekly Newsletters', icon: 'Send', count: activeCampaignsByChannel(campaigns, 'email') },
        { label: 'Inbound Leads', icon: 'LogIn', count: email.length },
        { label: 'Security Alerts', icon: 'ShieldAlert', count: 0 },
        { label: 'Subscription Renewals', icon: 'RefreshCcw', count: bookingsToday },
        { label: 'Partner Proposals', icon: 'FileSignature', count: unreadCount(email) },
        { label: 'Team Syncs', icon: 'Users2', count: teamMembers.length },
      ],
    },
    {
      title: 'AI Voice Agent Hub',
      icon: 'Mic',
      channel: 'voice',
      accentColor: '#0B1957',
      cards: [
        { label: 'Total Calls', icon: 'History', count: totalCalls },
        { label: 'Completed', icon: 'FileAudio', count: answeredCalls },
        { label: 'Failed / Missed', icon: 'PhoneMissed', count: missedCalls },
        { label: 'Ongoing', icon: 'Clock', count: ongoingCalls },
        { label: 'In Queue', icon: 'ListOrdered', count: queuedCalls },
        { label: 'Hot Leads', icon: 'Star', count: hotLeads },
      ],
    },
  ];

  const visibleSections = sections.filter((section) => {
    if (section.channel === 'voice') {
      return true;
    }

    if (section.channel === 'whatsapp') {
      return whatsappVariants.length > 0;
    }

    return isIntegrationConnected(integrations, section.channel);
  });
  const channelsWithData = visibleSections.filter((section) => (
    section.cards.some((card) => card.count > 0)
  )).length;

  return {
    sections: visibleSections,
    summary: {
      activeChannels: channelsWithData || visibleSections.length,
      totalConversations: liveConversations.length,
      unreadConversations: unreadCount(liveConversations),
      totalCampaigns: analytics.campaignStats.totalCampaigns,
      activeCampaigns,
      totalCalls,
      answeredCalls,
      missedCalls,
      queuedCalls,
      teamMembers: teamMembers.length,
      walletBalance: billing.availableBalance || billing.currentBalance || 0,
      bookingsToday,
      voiceAgents: voiceAgents.length,
      voiceNumbers: voiceNumbers.length,
    },
    latestActivity: buildLatestActivity(liveConversations, calls, campaigns),
    sourceErrors: Array.from(new Set(sourceErrors)),
    loadedAt: new Date().toISOString(),
  };
}
