/**
 * Configure-manually checkpoint wizard - mobile port of LAD-Frontend-2's
 * CheckpointFormInline. The store's workflowSteps remain the source of truth,
 * so this form and the Flow canvas stay in sync.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Briefcase,
  ChevronDown,
  Check,
  Clock,
  Eye,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Newspaper,
  Pencil,
  Phone,
  Rocket,
  Save,
  Sparkles,
  UserPlus,
  X,
  Zap,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppTheme } from '@/src/theme/appTheme';
import { useAdvancedSearch } from '@/src/hooks/useAdvancedSearch';
import { apiGet, apiPost } from '@/src/api';
import { WORKFLOW_PLATFORMS, defaultTriggerConditionFor, type WorkflowStepDef } from '@/src/services/mobileAIAssistantService';
import { deriveConfig } from '@/src/services/workflowConfigSync';
import { getConnectedEmailAccounts, type ConnectedEmailAccount } from '@/src/services/emailBroadcast.service';
import { getEmailIntegrations, getLinkedInIntegrations, getWhatsAppIntegrations } from '@/src/services/integration.service';
import {
  DEFAULT_VOICE_CALL_CONTEXT,
  fetchVoiceCallOptions,
  type VoiceAgentOption,
  type VoiceNumberOption,
} from '@/src/services/voiceCallConfig';
import { getWhatsAppTemplates } from '@/src/services/chat.service';

const fromSyncChannel = (channel: string) => (channel === 'voice_call' ? 'voice' : channel);
const toTriggerChannel = (channel: string) => (channel === 'voice' ? 'voice_call' : channel);

const PLACEHOLDER_HINT = '{{first_name}} {{last_name}} {{company}} {{title}} {{web_insight}} {{recent_post}} {{article}} {{news}}';

type TemplateKind = 'connection' | 'followup';

type LinkedInTemplate = {
  id: string;
  name: string;
  connection_message?: string | null;
  followup_message?: string | null;
  content?: string | null;
  body?: string | null;
  message?: string | null;
  category?: string | null;
  metadata?: Record<string, any> | null;
};

type EmailTemplateOption = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

type WhatsAppAccountOption = {
  id: string;
  displayName: string;
  accountType: 'business_api' | 'personal_whatsapp';
  status: string;
  phoneNumber?: string;
};

type WhatsAppTemplateOption = {
  id: string;
  name: string;
  content: string;
  headerText: string;
  footerText: string;
  channelType: 'business_api' | 'personal_whatsapp';
  accountIds: string[];
  isDefault: boolean;
};

type PickerKind = 'emailAccount' | 'emailTemplate' | 'whatsappAccount';

const LI_ACTIONS = [
  {
    id: 'profile_view',
    label: 'Visit profile',
    desc: 'Visit their LinkedIn profile to warm up the connection',
    Icon: Eye,
  },
  {
    id: 'connect',
    label: 'Send connection request',
    desc: 'Send a personalised connection request',
    Icon: UserPlus,
  },
  {
    id: 'message',
    label: 'Send follow-up message',
    desc: 'Send a LinkedIn message after connection is accepted',
    Icon: MessageSquare,
  },
] as const;

const TRIGGER_OPTIONS_MAP: Record<string, { id: string; label: string; desc: string }[]> = {
  linkedin: [
    { id: 'connection_accepted', label: 'After connection accepted', desc: 'Trigger when the lead accepts your LinkedIn connection' },
    { id: 'message_replied', label: 'After responding to message', desc: 'Trigger when the lead replies to your LinkedIn message' },
    { id: 'profile_visited', label: 'After profile visit', desc: 'Trigger for all visited profiles with ICP score above your threshold' },
  ],
  email: [
    { id: 'email_read', label: 'After Email Read', desc: 'Trigger when the lead opens your email' },
    { id: 'email_replied', label: 'After Responded to Email', desc: 'Trigger when the lead replies to your email' },
    { id: 'no_dependency', label: 'No Step Dependency', desc: 'Trigger the next channel immediately without waiting' },
  ],
  whatsapp: [
    { id: 'wa_read', label: 'After Message Read', desc: 'Trigger when the lead reads your WhatsApp message' },
    { id: 'wa_replied', label: 'After Responded to WhatsApp', desc: 'Trigger when the lead replies to your WhatsApp message' },
    { id: 'no_dependency', label: 'No Step Dependency', desc: 'Trigger the next channel immediately without waiting' },
  ],
  voice_call: [
    { id: 'call_completed', label: 'After Call Completed', desc: 'Trigger after the AI voice call finishes' },
    { id: 'call_answered', label: 'After Call Answered', desc: 'Trigger only when the lead answers the call' },
    { id: 'no_dependency', label: 'No Step Dependency', desc: 'Trigger the next channel immediately without waiting' },
  ],
};

const DURATION_OPTIONS = [
  { days: 1, label: 'Once', workingDays: 0 },
  { days: 7, label: '7 days', workingDays: 5 },
  { days: 14, label: '14 days', workingDays: 10 },
  { days: 30, label: '30 days', workingDays: 21 },
  { days: 60, label: '60 days', workingDays: 42 },
];

interface CheckpointWizardProps {
  visible: boolean;
  onClose: () => void;
  presentation?: 'modal' | 'inline';
  style?: ViewStyle;
  onInputFocus?: () => void;
}

const asRecord = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {});

const pickString = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return found ? String(found) : '';
};

const pickIdentifier = (...values: unknown[]) => {
  const found = values.find((value) => (typeof value === 'string' && value.trim()) || typeof value === 'number');
  return found === undefined || found === null ? '' : String(found);
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const firstArray = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  const data = asRecord(record.data);
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
};

const extractEmailTemplateList = (payload: unknown): EmailTemplateOption[] =>
  firstArray(payload, ['data', 'templates', 'items', 'results'])
    .map((item, index) => {
      const row = asRecord(item);
      const metadata = asRecord(row.metadata);
      const rawBody = pickString(
        row.body,
        row.content,
        row.body_text,
        row.bodyText,
        row.plain_text,
        row.text,
        row.body_html,
        row.content_html,
        metadata.body,
        metadata.body_text,
        metadata.body_html,
      );
      const body = stripHtml(rawBody);
      if (!body && !pickString(row.subject, metadata.subject)) return null;
      return {
        id: String(row.id ?? row._id ?? row.name ?? `email-template-${index}`),
        name: String(row.name ?? row.title ?? row.template_name ?? `Template ${index + 1}`),
        subject: pickString(row.subject, metadata.subject),
        body,
        isDefault: Boolean(row.is_default ?? row.isDefault ?? metadata.is_default),
      };
    })
    .filter((item): item is EmailTemplateOption => Boolean(item));

const CONNECTED_WA_STATUSES = new Set(['connected', 'open', 'active', 'ready', 'READY', 'CONNECTED', 'authenticated', 'online']);

const normalizeWhatsAppAccounts = (payload: unknown, accountType: WhatsAppAccountOption['accountType']): WhatsAppAccountOption[] =>
  firstArray(payload, ['accounts', 'data', 'result', 'sessions'])
    .map<WhatsAppAccountOption | null>((item, index) => {
      const row = asRecord(item);
      const status = String(row.status ?? row.state ?? (accountType === 'business_api' ? 'active' : ''));
      const id = String(row.id ?? row.slug ?? row.account_id ?? row.phone_number_id ?? row.session_id ?? row.phone ?? `wa-account-${index}`);
      if (!id) return null;
      const account: WhatsAppAccountOption = {
        id,
        displayName: String(row.display_name ?? row.displayName ?? row.name ?? row.phone_number ?? row.phone ?? (accountType === 'business_api' ? `WhatsApp API ${index + 1}` : `Personal WhatsApp ${index + 1}`)),
        accountType,
        status,
      };
      if (row.phone_number ?? row.phone) {
        account.phoneNumber = String(row.phone_number ?? row.phone);
      }
      return account;
    })
    .filter((account): account is WhatsAppAccountOption => account !== null)
    .filter((account) => account.accountType === 'business_api' || CONNECTED_WA_STATUSES.has(account.status));

const normalizeWhatsAppTemplates = (
  payload: unknown,
  fallbackChannelType: WhatsAppTemplateOption['channelType'] = 'personal_whatsapp',
): WhatsAppTemplateOption[] =>
  firstArray(payload, ['data', 'templates', 'items', 'results'])
    .map((item, index) => {
      const row = asRecord(item);
      const metadata = asRecord(row.metadata);
      const content = pickString(row.content, row.body, row.message, row.text, row.body_text, metadata.content, metadata.body, metadata.body_text);
      if (!content) return null;
      const rawChannel = String(row.channel_type ?? row.channelType ?? metadata.channel_type ?? metadata.channelType ?? '').toLowerCase();
      const accountIds = [
        pickIdentifier(row.account_id, row.accountId, row.whatsapp_account_id, row.whatsappAccountId),
        pickIdentifier(row.waba_account_id, row.wabaAccountId, row.phone_number_id, row.phoneNumberId),
        pickIdentifier(metadata.account_id, metadata.accountId, metadata.whatsapp_account_id, metadata.whatsappAccountId),
        pickIdentifier(metadata.waba_account_id, metadata.wabaAccountId, metadata.phone_number_id, metadata.phoneNumberId),
      ].filter((value): value is string => Boolean(value));
      return {
        id: String(row.id ?? row._id ?? row.name ?? `whatsapp-template-${index}`),
        name: String(row.name ?? row.title ?? row.template_name ?? `Template ${index + 1}`),
        content,
        headerText: pickString(row.header_text, row.headerText, metadata.header_text, metadata.headerText),
        footerText: pickString(row.footer_text, row.footerText, metadata.footer_text, metadata.footerText),
        channelType: rawChannel ? (rawChannel.includes('business') || rawChannel.includes('waba') ? 'business_api' : 'personal_whatsapp') : fallbackChannelType,
        accountIds: Array.from(new Set(accountIds)),
        isDefault: Boolean(row.is_default ?? row.isDefault ?? metadata.is_default),
      } satisfies WhatsAppTemplateOption;
    })
    .filter((item): item is WhatsAppTemplateOption => Boolean(item));

const extractTemplateList = (payload: unknown): LinkedInTemplate[] => {
  const record = asRecord(payload);
  const nested = asRecord(record.data);
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(nested.templates)
        ? nested.templates
        : Array.isArray(nested.items)
          ? nested.items
          : Array.isArray(nested.results)
            ? nested.results
            : Array.isArray(record.templates)
              ? record.templates
              : Array.isArray(record.items)
                ? record.items
                : Array.isArray(record.results)
                  ? record.results
                  : [];

  const templates: LinkedInTemplate[] = [];
  raw.forEach((item, index) => {
    const row = asRecord(item);
    if (!Object.keys(row).length) return;
    templates.push({
      id: String(row.id ?? row._id ?? row.name ?? `linkedin-template-${index}`),
      name: String(row.name ?? row.title ?? row.template_name ?? `Template ${index + 1}`),
      connection_message: row.connection_message ?? row.connectionMessage ?? null,
      followup_message: row.followup_message ?? row.followupMessage ?? null,
      content: row.content ?? row.text ?? row.body ?? null,
      body: row.body ?? null,
      message: row.message ?? row.message_text ?? null,
      category: row.category ? String(row.category) : null,
      metadata: asRecord(row.metadata),
    });
  });
  return templates;
};

const templateTextFor = (template: LinkedInTemplate, kind: TemplateKind) => {
  const meta = asRecord(template.metadata);
  if (kind === 'connection') {
    return pickString(
      template.connection_message,
      meta.connection_message,
      meta.connectionMessage,
      template.content,
      template.message,
      template.body,
    );
  }
  return pickString(
    template.followup_message,
    meta.followup_message,
    meta.followupMessage,
    template.content,
    template.message,
    template.body,
  );
};

const templateCategoryFor = (template: LinkedInTemplate) => {
  const meta = asRecord(template.metadata);
  return String(template.category ?? meta.category ?? meta.type ?? '').toLowerCase();
};

const templateMatchesKind = (template: LinkedInTemplate, kind: TemplateKind) => {
  const category = templateCategoryFor(template);
  if (!category) return Boolean(templateTextFor(template, kind));
  if (kind === 'connection') {
    return category.includes('connection') || category.includes('connect') || category.includes('request');
  }
  return category.includes('follow') || category.includes('message');
};

const channelLabel = (channel: string) => {
  if (channel === 'voice') return 'Voice Call';
  if (channel === 'linkedin') return 'LinkedIn';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
};

const DEFAULT_CHANNEL_CONNECTIONS: Record<string, boolean> = {
  linkedin: true,
  email: false,
  whatsapp: false,
  voice: false,
};

const sameChannels = (first: string[], second: string[]) =>
  first.length === second.length && first.every((channel, index) => channel === second[index]);

const isUsableEmailAccount = (account: ConnectedEmailAccount) => {
  const status = String(account.status || '').toLowerCase();
  return Boolean(account.email) && (!status || status === 'active' || status === 'connected' || status === 'verified');
};

const loadEmailTemplates = async () => {
  const response = await apiGet<unknown>('/api/campaigns/email-templates', {
    params: { is_active: true },
  });
  return extractEmailTemplateList(response.data);
};

const loadWhatsAppAccounts = async () => {
  const [waba, personal] = await Promise.allSettled([
    apiGet<unknown>('/api/whatsapp-conversations/admin/whatsapp-accounts'),
    apiGet<unknown>('/api/personal-whatsapp/accounts'),
  ]);
  const accounts = [
    ...(waba.status === 'fulfilled' ? normalizeWhatsAppAccounts(waba.value.data, 'business_api') : []),
    ...(personal.status === 'fulfilled' ? normalizeWhatsAppAccounts(personal.value.data, 'personal_whatsapp') : []),
  ];
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = `${account.accountType}:${account.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const loadWhatsAppTemplates = async (account?: WhatsAppAccountOption) => {
  const fallbackChannelType = account?.accountType || 'personal_whatsapp';
  const [channelTemplates, scopedDbTemplates, allDbTemplates] = await Promise.allSettled([
    getWhatsAppTemplates(account?.accountType === 'personal_whatsapp' ? 'personal' : 'waba', account?.id),
    apiGet<unknown>('/api/campaigns/whatsapp-templates', {
      params: {
        is_active: true,
        ...(account
          ? {
              account_id: account.id,
              whatsapp_account_id: account.id,
              channel_type: account.accountType,
            }
          : {}),
      },
    }),
    apiGet<unknown>('/api/campaigns/whatsapp-templates', {
      params: { is_active: true },
    }),
  ]);

  const templates = [
    ...(channelTemplates.status === 'fulfilled' ? normalizeWhatsAppTemplates(channelTemplates.value, fallbackChannelType) : []),
    ...(scopedDbTemplates.status === 'fulfilled' ? normalizeWhatsAppTemplates(scopedDbTemplates.value.data, fallbackChannelType) : []),
    ...(allDbTemplates.status === 'fulfilled' ? normalizeWhatsAppTemplates(allDbTemplates.value.data, fallbackChannelType) : []),
  ];

  const selectedAccountIds = new Set([account?.id, account?.phoneNumber].filter((value): value is string => Boolean(value)));
  const scopedTemplates = account
    ? templates.filter((template) => {
        if (!template.accountIds.length) {
          return template.channelType === account.accountType;
        }
        return template.accountIds.some((id) => selectedAccountIds.has(id));
      })
    : templates;

  const seen = new Set<string>();
  return scopedTemplates.filter((template) => {
    const key = template.id || `${template.channelType}:${template.name}:${template.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function CheckpointWizard({ visible, onClose, presentation = 'modal', style, onInputFocus }: CheckpointWizardProps) {
  const assistant = useAdvancedSearch();
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [emailAccounts, setEmailAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [voiceAgents, setVoiceAgents] = useState<VoiceAgentOption[]>([]);
  const [voiceNumbers, setVoiceNumbers] = useState<VoiceNumberOption[]>([]);
  const [voiceOptionsLoaded, setVoiceOptionsLoaded] = useState(false);
  const [voiceOptionsLoading, setVoiceOptionsLoading] = useState(false);
  const [voiceConfigSaving, setVoiceConfigSaving] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [voicePickerAutoShown, setVoicePickerAutoShown] = useState(false);
  const [draftVoiceAgentId, setDraftVoiceAgentId] = useState('');
  const [draftVoiceNumberId, setDraftVoiceNumberId] = useState('');
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccountOption[]>([]);
  const [whatsappAccountsLoading, setWhatsappAccountsLoading] = useState(false);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [whatsappTemplatesLoading, setWhatsappTemplatesLoading] = useState(false);
  const [whatsappTemplatesLoadedFor, setWhatsappTemplatesLoadedFor] = useState('');
  const [selectedWhatsAppTemplateId, setSelectedWhatsAppTemplateId] = useState('');
  const [showWhatsAppTemplates, setShowWhatsAppTemplates] = useState(false);
  const [whatsappGenerating, setWhatsappGenerating] = useState(false);
  const [channelConnections, setChannelConnections] = useState<Record<string, boolean>>(DEFAULT_CHANNEL_CONNECTIONS);
  const [channelConnectionsLoaded, setChannelConnectionsLoaded] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateOption[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailTemplatesLoaded, setEmailTemplatesLoaded] = useState(false);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('');
  const [emailSaveTemplateMode, setEmailSaveTemplateMode] = useState(false);
  const [emailSaveTemplateName, setEmailSaveTemplateName] = useState('');
  const [emailTemplateSaving, setEmailTemplateSaving] = useState(false);
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [linkedinTemplates, setLinkedinTemplates] = useState<LinkedInTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [showConnTemplates, setShowConnTemplates] = useState(false);
  const [showFollowTemplates, setShowFollowTemplates] = useState(false);
  const [showConnAi, setShowConnAi] = useState(false);
  const [showFollowAi, setShowFollowAi] = useState(false);
  const [aiGeneratingKind, setAiGeneratingKind] = useState<TemplateKind | null>(null);
  const [aiGenerateError, setAiGenerateError] = useState('');
  const [aiValueProp, setAiValueProp] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiGoal, setAiGoal] = useState('get_meeting');

  const cfg = useMemo(() => deriveConfig(assistant.workflowSteps), [assistant.workflowSteps]);
  const selectedChannels = useMemo(() => cfg.nextChannels.map(fromSyncChannel), [cfg.nextChannels]);
  const effectiveSelectedChannels = useMemo(
    () => channelConnectionsLoaded
      ? selectedChannels.filter((channel) => Boolean(channelConnections[channel]))
      : selectedChannels,
    [selectedChannels, channelConnections, channelConnectionsLoaded],
  );
  // `effectiveSelectedChannels` already carries the user's actual pick order
  // — `cfg.nextChannels` (deriveConfig) preserves it, and `.filter()` for
  // connected-channel gating doesn't reorder. Sorting it by a fixed
  // LinkedIn>Email>WhatsApp>Voice priority here would show a sequence the
  // Flow canvas and the campaign backend no longer build (they render the
  // exact pick order), so this is a plain alias — kept to minimize the diff
  // across the many display sites below that read `sortedSelectedChannels`.
  const sortedSelectedChannels = effectiveSelectedChannels;
  const emailWorkflowStep = useMemo(
    () => assistant.workflowSteps.find((step) => step.type === 'email_send'),
    [assistant.workflowSteps],
  );
  const whatsappWorkflowStep = useMemo(
    () => assistant.workflowSteps.find((step) => step.type === 'whatsapp_send'),
    [assistant.workflowSteps],
  );

  const steps = useMemo(() => {
    const list: ('channels' | 'trigger' | 'duration' | 'name')[] = ['channels'];
    if (selectedChannels.length > 1) list.push('trigger');
    list.push('duration', 'name');
    return list;
  }, [selectedChannels.length]);

  const currentIndex = Math.max(0, Math.min(assistant.cpStep, steps.length - 1));
  const currentKey = steps[currentIndex] || 'channels';
  // The trigger step is inserted right after the FIRST channel in the user's
  // actual pick order (see buildStepsFromConfig in workflowConfigSync.ts), so
  // its option list (e.g. "Wait for Connection Accepted" vs "Wait for Call
  // Completed") must be keyed off that same first channel — not a fixed
  // LinkedIn>Email>WhatsApp>Voice priority, which would show options for a
  // channel that isn't actually where the trigger step lands.
  const primaryTriggerChannel = useMemo(
    () => toTriggerChannel(effectiveSelectedChannels[0] || 'linkedin'),
    [effectiveSelectedChannels],
  );
  const triggerOptions = useMemo(() => TRIGGER_OPTIONS_MAP[primaryTriggerChannel] || TRIGGER_OPTIONS_MAP.linkedin, [primaryTriggerChannel]);
  const selectedVoiceAgent = useMemo(
    () => voiceAgents.find((agent) => agent.id === draftVoiceAgentId)
      || voiceAgents[0],
    [draftVoiceAgentId, voiceAgents],
  );
  const selectedVoiceNumber = useMemo(
    () => voiceNumbers.find((number) => number.id === draftVoiceNumberId)
      || (selectedVoiceAgent ? voiceNumbers.find((number) => number.assignedAgentId === selectedVoiceAgent.id) : undefined)
      || voiceNumbers[0],
    [draftVoiceNumberId, selectedVoiceAgent, voiceNumbers],
  );
  const wizardTone = appTheme.darkMode
    ? {
        section: '#08122E',
        card: '#0E1A36',
        cardRaised: '#15284D',
        field: '#06102A',
        fieldRaised: '#101F3C',
        selected: '#2F6BFF',
        selectedSoft: '#183B76',
        border: '#294263',
        borderStrong: '#4B7DFF',
        text: '#F8FAFC',
        muted: '#B8C4D6',
        faint: '#8FA2BD',
        accent: '#78A7FF',
        violet: '#8B5CF6',
      }
    : {
        section: '#EFF6FF',
        card: '#FFFFFF',
        cardRaised: '#F8FAFC',
        field: '#FFFFFF',
        fieldRaised: '#F8FAFF',
        selected: '#3B82F6',
        selectedSoft: '#DBEAFE',
        border: '#BFDBFE',
        borderStrong: '#3B82F6',
        text: '#0F172A',
        muted: '#64748B',
        faint: '#94A3B8',
        accent: '#1E40AF',
        violet: '#7C3AED',
      };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setChannelConnectionsLoaded(false);
    setAccountsLoading(true);
    setWhatsappAccountsLoading(true);
    setVoiceOptionsLoading(true);

    const voiceOptionsWithTimeout = Promise.race([
      fetchVoiceCallOptions().catch(() => ({ agents: [], numbers: [] })),
      new Promise<{ agents: VoiceAgentOption[]; numbers: VoiceNumberOption[] }>((resolve) => {
        setTimeout(() => resolve({ agents: [], numbers: [] }), 8000);
      }),
    ]);

    Promise.all([
      getConnectedEmailAccounts().catch(() => []),
      getEmailIntegrations().catch(() => []),
      getWhatsAppIntegrations().catch(() => []),
      getLinkedInIntegrations().catch(() => []),
      voiceOptionsWithTimeout,
      loadWhatsAppAccounts().catch(() => []),
    ])
      .then(([accounts, emailIntegrations, whatsappIntegrations, linkedinIntegrations, voiceOptions, waAccounts]) => {
        if (cancelled) return;
        const emailConnected = accounts.some(isUsableEmailAccount) || emailIntegrations.some((item) => item.connected);
        const whatsappIsConnected = waAccounts.length > 0 || whatsappIntegrations.some((item) => item.connected);
        const linkedinConnected = linkedinIntegrations.length
          ? linkedinIntegrations.some((item) => item.connected || item.status === 'unknown')
          : true;
        const voiceConnected = voiceOptions.agents.length > 0;

        setEmailAccounts(accounts);
        setWhatsappConnected(whatsappIsConnected);
        setWhatsappAccounts(waAccounts);
        setVoiceAgents(voiceOptions.agents);
        setVoiceNumbers(voiceOptions.numbers);
        setChannelConnections({
          linkedin: linkedinConnected,
          email: emailConnected,
          whatsapp: whatsappIsConnected,
          voice: voiceConnected,
        });

        const firstAgent = voiceOptions.agents[0];
        const firstNumber = voiceOptions.numbers.find((number) => number.assignedAgentId === firstAgent?.id) || voiceOptions.numbers[0];
        const effectiveAgent = firstAgent
          || (firstNumber?.assignedAgentId ? voiceOptions.agents.find((agent) => agent.id === firstNumber.assignedAgentId) : undefined)
          || voiceOptions.agents[0];
        setDraftVoiceAgentId(effectiveAgent?.id || '');
        setDraftVoiceNumberId(firstNumber?.id || '');

        const voiceStep = assistant.workflowSteps.find((step) => step.type === 'voice_agent_call');
        if (voiceStep && voiceConnected && (effectiveAgent?.id || firstNumber?.phoneNumber)) {
          assistant.updateWorkflowStep(voiceStep.id, {
            accountId: effectiveAgent?.id || voiceStep.accountId,
            phoneNumber: firstNumber?.phoneNumber || voiceStep.phoneNumber,
            message: voiceStep.message || DEFAULT_VOICE_CALL_CONTEXT,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccountsLoaded(true);
          setAccountsLoading(false);
          setWhatsappAccountsLoading(false);
          setVoiceOptionsLoaded(true);
          setVoiceOptionsLoading(false);
          setChannelConnectionsLoaded(true);
        }
      });

    return () => { cancelled = true; };
  }, [visible]);

  // Drops any selected channel whose connection went away, WITHOUT touching
  // the order of the ones that remain. Filtering `selectedChannels` itself
  // (rather than iterating the fixed CHANNEL_PRIORITY list and intersecting)
  // is what preserves the user's actual pick order here — the old
  // CHANNEL_PRIORITY-driven version silently reset every selection back to
  // LinkedIn>Email>WhatsApp>Voice canonical order on each run, undoing a
  // pick like "voice, then LinkedIn, then WhatsApp" the moment this effect
  // fired.
  useEffect(() => {
    if (!visible || !channelConnectionsLoaded || !selectedChannels.length) return;
    const connectedSelected = selectedChannels.filter((channel) => Boolean(channelConnections[channel]));
    if (connectedSelected.length && !sameChannels(connectedSelected, selectedChannels)) {
      assistant.setWorkflowChannels(connectedSelected);
    }
  }, [visible, channelConnectionsLoaded, channelConnections, selectedChannels, assistant]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('email') || accountsLoaded || accountsLoading) return;
    setAccountsLoading(true);
    getConnectedEmailAccounts()
      .then(setEmailAccounts)
      .catch(() => setEmailAccounts([]))
      .finally(() => {
        setAccountsLoaded(true);
        setAccountsLoading(false);
      });
  }, [visible, effectiveSelectedChannels, accountsLoaded, accountsLoading]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('email') || emailTemplatesLoaded || emailTemplatesLoading) return;
    setEmailTemplatesLoaded(true);
    setEmailTemplatesLoading(true);
    loadEmailTemplates()
      .then(setEmailTemplates)
      .catch(() => setEmailTemplates([]))
      .finally(() => setEmailTemplatesLoading(false));
  }, [visible, effectiveSelectedChannels, emailTemplatesLoaded, emailTemplatesLoading]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('email') || !emailWorkflowStep || !emailAccounts.length) return;
    const config = asRecord(emailWorkflowStep.config);
    if (emailWorkflowStep.accountId || config.from_email) return;
    const account = emailAccounts.find(isUsableEmailAccount) || emailAccounts[0];
    if (!account) return;
    assistant.updateWorkflowStep(emailWorkflowStep.id, {
      accountId: account.id,
      config: {
        ...config,
        senderAccountId: account.id,
        from_email_account_id: account.id,
        from_email: account.email,
        email_provider: account.provider,
      },
    });
  }, [visible, effectiveSelectedChannels, emailWorkflowStep, emailAccounts, assistant]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('email') || !emailWorkflowStep || !emailTemplates.length) return;
    const config = asRecord(emailWorkflowStep.config);
    if (selectedEmailTemplateId || config.template_id || emailWorkflowStep.subject || emailWorkflowStep.message) return;
    const template = emailTemplates.find((item) => item.isDefault) || null;
    if (!template) return;
    setSelectedEmailTemplateId(template.id);
    assistant.updateWorkflowStep(emailWorkflowStep.id, {
      subject: template.subject,
      message: template.body,
      config: { ...config, template_id: template.id },
    });
  }, [visible, effectiveSelectedChannels, emailWorkflowStep, emailTemplates, selectedEmailTemplateId, assistant]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('voice') || voiceOptionsLoaded || voiceOptionsLoading) return;
    let cancelled = false;
    setVoiceOptionsLoading(true);

    const voiceOptionsWithTimeout = Promise.race([
      fetchVoiceCallOptions().catch(() => ({ agents: [], numbers: [] })),
      new Promise<{ agents: VoiceAgentOption[]; numbers: VoiceNumberOption[] }>((resolve) => {
        setTimeout(() => resolve({ agents: [], numbers: [] }), 8000);
      }),
    ]);

    voiceOptionsWithTimeout
      .then((options) => {
        if (cancelled) return;
        setVoiceAgents(options.agents);
        setVoiceNumbers(options.numbers);

        const firstAgent = options.agents[0];
        const firstNumber = options.numbers.find((number) => number.assignedAgentId === firstAgent?.id) || options.numbers[0];
        const effectiveAgent = firstAgent
          || (firstNumber?.assignedAgentId ? options.agents.find((agent) => agent.id === firstNumber.assignedAgentId) : undefined)
          || options.agents[0];

        setDraftVoiceAgentId(effectiveAgent?.id || '');
        setDraftVoiceNumberId(firstNumber?.id || '');

        const voiceStep = assistant.workflowSteps.find((step) => step.type === 'voice_agent_call');
        if (voiceStep && (effectiveAgent?.id || firstNumber?.phoneNumber)) {
          assistant.updateWorkflowStep(voiceStep.id, {
            accountId: effectiveAgent?.id || voiceStep.accountId,
            phoneNumber: firstNumber?.phoneNumber || voiceStep.phoneNumber,
            message: voiceStep.message || DEFAULT_VOICE_CALL_CONTEXT,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVoiceOptionsLoaded(true);
          setVoiceOptionsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [visible, effectiveSelectedChannels, voiceOptionsLoaded, voiceOptionsLoading, assistant]);

  useEffect(() => {
    if (!visible) {
      setVoicePickerAutoShown(false);
      return;
    }
    if (!effectiveSelectedChannels.includes('voice') || !voiceOptionsLoaded || voicePickerAutoShown) return;
    if (!selectedVoiceAgent || !selectedVoiceNumber) {
      setShowVoicePicker(true);
      setVoicePickerAutoShown(true);
    }
  }, [visible, effectiveSelectedChannels, voiceOptionsLoaded, voicePickerAutoShown, selectedVoiceAgent, selectedVoiceNumber]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('whatsapp')) return;
    if (!whatsappAccounts.length && !whatsappAccountsLoading) {
      setWhatsappAccountsLoading(true);
      loadWhatsAppAccounts()
        .then((accounts) => {
          setWhatsappAccounts(accounts);
          setWhatsappConnected(accounts.length > 0);
        })
        .catch(() => getWhatsAppIntegrations().then((list) => setWhatsappConnected(list.some((item) => item.connected))).catch(() => undefined))
        .finally(() => setWhatsappAccountsLoading(false));
      return;
    }
    getWhatsAppIntegrations().then((list) => setWhatsappConnected(whatsappAccounts.length > 0 || list.some((item) => item.connected))).catch(() => undefined);
  }, [visible, effectiveSelectedChannels, whatsappAccounts, whatsappAccountsLoading]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('whatsapp') || !whatsappWorkflowStep || !whatsappAccounts.length) return;
    const config = asRecord(whatsappWorkflowStep.config);
    if (whatsappWorkflowStep.accountId || config.whatsapp_account_id || config.accountId) return;
    const account = whatsappAccounts[0];
    assistant.updateWorkflowStep(whatsappWorkflowStep.id, {
      accountId: account.id,
      config: {
        ...config,
        accountId: account.id,
        whatsapp_account_id: account.id,
        whatsapp_account_type: account.accountType,
      },
    });
  }, [visible, effectiveSelectedChannels, whatsappWorkflowStep, whatsappAccounts, assistant]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('whatsapp') || !whatsappWorkflowStep || whatsappTemplatesLoading) return;
    const config = asRecord(whatsappWorkflowStep.config);
    const selectedAccount = whatsappAccounts.find((account) =>
      account.id === whatsappWorkflowStep.accountId || account.id === config.whatsapp_account_id || account.id === config.accountId
    ) || whatsappAccounts[0];
    const loadKey = selectedAccount ? `${selectedAccount.accountType}:${selectedAccount.id}` : 'all';
    if (whatsappTemplatesLoadedFor === loadKey) return;
    setWhatsappTemplatesLoadedFor(loadKey);
    setWhatsappTemplatesLoading(true);
    loadWhatsAppTemplates(selectedAccount)
      .then(setWhatsappTemplates)
      .catch(() => setWhatsappTemplates([]))
      .finally(() => setWhatsappTemplatesLoading(false));
  }, [visible, effectiveSelectedChannels, whatsappWorkflowStep, whatsappAccounts, whatsappTemplatesLoadedFor, whatsappTemplatesLoading]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('whatsapp') || !whatsappWorkflowStep || !whatsappTemplates.length) return;
    const config = asRecord(whatsappWorkflowStep.config);
    if (selectedWhatsAppTemplateId || config.whatsapp_template_id || whatsappWorkflowStep.message) return;
    const template = whatsappTemplates.find((item) => item.isDefault) || null;
    if (!template) return;
    const parts = [template.headerText, template.content, template.footerText].filter(Boolean);
    setSelectedWhatsAppTemplateId(template.id);
    assistant.updateWorkflowStep(whatsappWorkflowStep.id, {
      message: parts.join('\n\n'),
      config: { ...config, whatsapp_template_id: template.id },
    });
  }, [visible, effectiveSelectedChannels, whatsappWorkflowStep, whatsappTemplates, selectedWhatsAppTemplateId, assistant]);

  useEffect(() => {
    if (!visible || !effectiveSelectedChannels.includes('linkedin') || templatesLoaded) return;
    setTemplatesLoaded(true);
    setTemplatesLoading(true);
    apiGet<unknown>('/api/campaigns/linkedin-message-templates', { params: { is_active: true } })
      .catch(() => apiGet<unknown>('/api/campaigns/linkedin/message-templates', { params: { is_active: true } }))
      .then((response) => setLinkedinTemplates(extractTemplateList(response.data)))
      .catch(() => setLinkedinTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [visible, effectiveSelectedChannels, templatesLoaded]);

  useEffect(() => {
    if (!visible) {
      setShowConnTemplates(false);
      setShowFollowTemplates(false);
      setShowConnAi(false);
      setShowFollowAi(false);
      setShowWhatsAppTemplates(false);
      setActivePicker(null);
    }
  }, [visible]);

  // Default to the trigger that matches what the workflow will actually do —
  // e.g. only "Visit profile" is selected (no Connect step), so the default
  // must be "After profile visit", not "After connection accepted", which
  // would wait forever for an event this workflow never produces and stall
  // the campaign after the LinkedIn step.
  useEffect(() => {
    if (!visible || currentKey !== 'trigger' || !triggerOptions.length) return;
    if (!triggerOptions.some((option) => option.id === cfg.triggerCondition)) {
      const preferred = primaryTriggerChannel === 'linkedin' ? defaultTriggerConditionFor(cfg.actions) : null;
      const fallback = triggerOptions.some((option) => option.id === preferred) ? preferred! : triggerOptions[0].id;
      assistant.setWorkflowTriggerCondition(fallback);
    }
  }, [visible, currentKey, triggerOptions, cfg.triggerCondition, cfg.actions, primaryTriggerChannel, assistant]);

  if (!visible) return null;

  const findStep = (type: string) => assistant.workflowSteps.find((step) => step.type === type);
  const leadCount = assistant.selectedLeadIds.length || assistant.leads.length || 0;
  const noPersonalizationSource = !assistant.cpEnableDailyWebPresence && !assistant.cpEnableDailyPosts;

  const goBack = () => {
    if (currentIndex === 0) {
      onClose();
      return;
    }
    assistant.setCpStepDirect(currentIndex - 1);
  };

  const goNext = async () => {
    if (currentIndex >= steps.length - 1) {
      if (!assistant.campaignName.trim()) return;
      const campaignId = await assistant.launchOutreachCampaign();
      if (campaignId !== null) {
        assistant.resetConversation();
        onClose();
        router.replace('/(drawer)/campaigns' as never);
      }
      return;
    }
    assistant.setCpStepDirect(currentIndex + 1);
  };

  const openIntegrationsForChannel = () => {
    onClose();
    router.push('/(drawer)/integrations' as never);
  };

  const toggleChannel = (channel: string) => {
    if (channelConnectionsLoaded && !channelConnections[channel]) {
      openIntegrationsForChannel();
      return;
    }
    assistant.setWorkflowChannels((currentChannels) => {
      const next = currentChannels.includes(channel)
        ? currentChannels.filter((item) => item !== channel)
        : [...currentChannels, channel];
      return next.length ? next : ['linkedin'];
    });
  };

  const toggleLiAction = (action: string) => {
    const current = cfg.actions;
    const isOn = current.includes(action);
    if (!isOn) {
      const next = new Set([...current, action]);
      if (action === 'connect') next.add('profile_view');
      if (action === 'message') {
        next.add('profile_view');
        next.add('connect');
      }
      assistant.setWorkflowLinkedInActions(Array.from(next));
      return;
    }

    let remove = [action];
    if (action === 'profile_view') remove = ['profile_view', 'connect', 'message'];
    if (action === 'connect') remove = ['connect', 'message'];
    assistant.setWorkflowLinkedInActions(current.filter((item) => !remove.includes(item)));
  };

  const setLinkedInMessage = (kind: TemplateKind, message: string) => {
    const step = findStep(kind === 'connection' ? 'linkedin_connect' : 'linkedin_message');
    if (step) assistant.updateWorkflowStep(step.id, { message });
  };

  const suggestCampaignName = () => {
    const target = assistant.lastTargeting || assistant.targeting;
    const industry = target?.industries?.[0] || '';
    const location = target?.locations?.[0] || '';
    const query = assistant.lastSearchQuery.replace(/\s+/g, ' ').trim();
    const quarter = Math.floor(new Date().getMonth() / 3) + 1;
    const base = [industry, location].filter(Boolean).join(' ');
    assistant.setCampaignName(base ? `${base} Outreach Strategy` : query ? `${query} Outreach` : `Q${quarter} Outreach Strategy`);
  };

  const toggleAllPersonalization = () => {
    const anyOn = assistant.cpEnableDailyWebPresence || assistant.cpEnableDailyPosts || assistant.cpEnableAiPersonalization;
    const next = !anyOn;
    assistant.setCpPersonalization({
      cpEnableDailyWebPresence: next,
      cpEnableDailyPosts: next,
      cpEnableAiPersonalization: next,
      cpEnableAiConnectionPersonalization: next,
      cpEnableAiFollowupPersonalization: next,
    });
  };

  const buildAudienceDescription = () => {
    const target = assistant.lastTargeting || assistant.targeting;
    const jobDesc = target?.job_titles?.length ? target.job_titles.join(' / ') : 'professionals';
    const indDesc = target?.industries?.length ? ` in the ${target.industries[0]} industry` : '';
    const locDesc = target?.locations?.length ? ` in ${target.locations[0]}` : '';
    return `${jobDesc}${indDesc}${locDesc}`;
  };

  const extractGeneratedText = (payload: unknown) => {
    const data = asRecord(payload);
    const nested = asRecord(data.data);
    return pickString(data.response, nested.response, data.text, nested.text, data.message, nested.message);
  };

  const requestDraft = async (prompt: string) => {
    const response = await apiPost<Record<string, any>>('/api/ai-icp-assistant/lead-chat', {
      message: prompt,
      history: [],
      currentTargeting: assistant.lastTargeting || assistant.targeting || {},
      conversationId: `${assistant.conversationId}-draft`,
      conversationSummary: assistant.conversationSummary,
      mobile: true,
    });
    return extractGeneratedText(response.data);
  };

  const providerLabel = (provider?: string) => {
    if (provider === 'google') return 'Gmail';
    if (provider === 'microsoft') return 'Outlook';
    if (provider === 'custom_smtp') return 'SMTP';
    return 'Email';
  };

  const emailAccountForStep = (step: WorkflowStepDef) => {
    const config = asRecord(step.config);
    return emailAccounts.find((account) => account.id === step.accountId || account.email === config.from_email)
      || emailAccounts.find(isUsableEmailAccount)
      || null;
  };

  const whatsappAccountForStep = (step: WorkflowStepDef) => {
    const config = asRecord(step.config);
    return whatsappAccounts.find((account) => account.id === step.accountId || account.id === config.whatsapp_account_id || account.id === config.accountId)
      || whatsappAccounts[0]
      || null;
  };

  const updateEmailAccount = (step: WorkflowStepDef, account: ConnectedEmailAccount) => {
    const config = asRecord(step.config);
    assistant.updateWorkflowStep(step.id, {
      accountId: account.id,
      config: {
        ...config,
        senderAccountId: account.id,
        from_email_account_id: account.id,
        from_email: account.email,
        email_provider: account.provider,
      },
    });
    setActivePicker(null);
  };

  const applyEmailTemplate = (step: WorkflowStepDef, template: EmailTemplateOption) => {
    const config = asRecord(step.config);
    setSelectedEmailTemplateId(template.id);
    assistant.updateWorkflowStep(step.id, {
      subject: template.subject,
      message: template.body,
      config: { ...config, template_id: template.id },
    });
    setActivePicker(null);
  };

  const saveEmailTemplate = async (step: WorkflowStepDef) => {
    if (!emailSaveTemplateName.trim() || !step.subject?.trim() || !step.message?.trim()) return;
    setEmailTemplateSaving(true);
    try {
      const response = await apiPost<unknown>('/api/campaigns/email-templates', {
        name: emailSaveTemplateName.trim(),
        subject: step.subject,
        body: step.message,
        category: 'email_send',
        is_active: true,
      });
      const data = asRecord(response.data);
      const savedRecord = Object.keys(asRecord(data.data)).length ? asRecord(data.data) : data;
      const saved = extractEmailTemplateList([savedRecord])[0] || {
        id: String(savedRecord.id ?? `email-template-${Date.now()}`),
        name: emailSaveTemplateName.trim(),
        subject: step.subject || '',
        body: step.message || '',
        isDefault: false,
      };
      setEmailTemplates((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setSelectedEmailTemplateId(saved.id);
      assistant.updateWorkflowStep(step.id, {
        config: { ...asRecord(step.config), template_id: saved.id },
      });
      setEmailSaveTemplateName('');
      setEmailSaveTemplateMode(false);
    } catch {
      // Keep the editor open so the user can retry after connectivity recovers.
    } finally {
      setEmailTemplateSaving(false);
    }
  };

  const generateEmailDraft = async (step: WorkflowStepDef) => {
    if (emailGenerating) return;
    setEmailGenerating(true);
    try {
      const audience = buildAudienceDescription();
      const subjectPrompt = [
        'System Settings:',
        '- Output raw string data only.',
        '- Output the subject line only, max 80 characters.',
        '',
        `Task: Write a compelling outreach email subject line for ${audience}.`,
      ].join('\n');
      const bodyPrompt = [
        'System Settings:',
        '- Output raw string data only.',
        '- Output the email body only.',
        '',
        `Task: Write a concise professional outreach email for ${audience}.`,
        'Start with "Hi {{first_name}},". Use placeholders {{first_name}}, {{company}}, and {{title}}. End with a soft call-to-action.',
      ].join('\n');
      const [subject, body] = await Promise.all([
        requestDraft(subjectPrompt).catch(() => ''),
        requestDraft(bodyPrompt).catch(() => ''),
      ]);
      assistant.updateWorkflowStep(step.id, {
        subject: subject || 'Quick question for {{first_name}}',
        message: body || 'Hi {{first_name}},\n\nI came across your profile at {{company}} and wanted to reach out.\n\nWould you be open to a quick conversation?\n\nBest,',
        config: { ...asRecord(step.config), template_id: undefined },
      });
      setSelectedEmailTemplateId('');
    } finally {
      setEmailGenerating(false);
    }
  };

  const updateWhatsAppAccount = (step: WorkflowStepDef, account: WhatsAppAccountOption) => {
    const config = asRecord(step.config);
    assistant.updateWorkflowStep(step.id, {
      accountId: account.id,
      config: {
        ...config,
        accountId: account.id,
        whatsapp_account_id: account.id,
        whatsapp_account_type: account.accountType,
      },
    });
    setSelectedWhatsAppTemplateId('');
    setWhatsappTemplates([]);
    setWhatsappTemplatesLoadedFor('');
    setActivePicker(null);
  };

  const applyWhatsAppTemplate = (step: WorkflowStepDef, template: WhatsAppTemplateOption) => {
    const parts = [template.headerText, template.content, template.footerText].filter(Boolean);
    setSelectedWhatsAppTemplateId(template.id);
    assistant.updateWorkflowStep(step.id, {
      message: parts.join('\n\n'),
      config: { ...asRecord(step.config), whatsapp_template_id: template.id },
    });
    setShowWhatsAppTemplates(false);
  };

  const generateWhatsAppDraft = async (step: WorkflowStepDef) => {
    if (whatsappGenerating) return;
    setWhatsappGenerating(true);
    try {
      const audience = buildAudienceDescription();
      const sampleLead = assistant.leads[0];
      const nameHint = sampleLead?.firstName || sampleLead?.name ? ` to ${sampleLead.firstName || sampleLead.name}` : '';
      const prompt = [
        'System Settings:',
        '- Output raw string data only.',
        '- Output the WhatsApp message only.',
        '',
        `Task: Write a friendly WhatsApp outreach message${nameHint} for ${audience}.`,
        'Start with "Hi {{first_name}},". Use placeholders {{first_name}}, {{company}}, and {{title}}. Keep it under 300 characters.',
      ].join('\n');
      const message = await requestDraft(prompt).catch(() => '');
      assistant.updateWorkflowStep(step.id, {
        message: message || 'Hi {{first_name}}, I noticed your work at {{company}} and wanted to connect. Would a quick chat be useful?',
        config: { ...asRecord(step.config), whatsapp_template_id: undefined },
      });
      setSelectedWhatsAppTemplateId('');
    } finally {
      setWhatsappGenerating(false);
    }
  };

  const updateStepDelay = (step: WorkflowStepDef, key: 'delayDays' | 'delayHours', value: string) => {
    const next = Number(value.replace(/[^0-9]/g, ''));
    const bounded = key === 'delayHours' ? Math.max(0, Math.min(23, Number.isFinite(next) ? next : 0)) : Math.max(0, Math.min(365, Number.isFinite(next) ? next : 0));
    assistant.updateWorkflowStep(step.id, { [key]: bounded });
  };

  const renderFieldLabel = (label: string, required = false) => (
    <View style={styles.fieldLabelRow}>
      <Typography variant="caption" color={wizardTone.text} style={styles.fieldLabel}>{label}</Typography>
      {required ? <Typography variant="caption" color="#EF4444" style={styles.requiredMark}>*</Typography> : null}
    </View>
  );

  const renderSelectControl = ({
    label,
    value,
    placeholder,
    onPress,
    required,
    loading,
    leftIcon,
    accent = wizardTone.accent,
    disabled = false,
  }: {
    label: string;
    value?: string;
    placeholder: string;
    onPress: () => void;
    required?: boolean;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    accent?: string;
    disabled?: boolean;
  }) => (
    <View style={styles.formGroup}>
      {renderFieldLabel(label, required)}
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={disabled || loading}
        onPress={onPress}
        style={[styles.selectControl, { backgroundColor: wizardTone.field, borderColor: wizardTone.border, opacity: disabled ? 0.6 : 1 }]}
      >
        {leftIcon ? <View style={styles.selectIconWrap}>{leftIcon}</View> : null}
        <Typography
          variant="bodySmall"
          color={value ? wizardTone.text : wizardTone.faint}
          style={styles.selectValue}
          numberOfLines={1}
        >
          {loading ? 'Loading...' : value || placeholder}
        </Typography>
        {loading ? <ActivityIndicator color={accent} size="small" /> : <ChevronDown color={wizardTone.faint} size={16} />}
      </TouchableOpacity>
    </View>
  );

  const renderPickerModal = () => {
    if (!activePicker) return null;
    const emailStep = emailWorkflowStep;
    const whatsappStep = whatsappWorkflowStep;
    const title = activePicker === 'emailAccount'
      ? 'Send From'
      : activePicker === 'emailTemplate'
        ? 'Use Saved Template'
        : 'WhatsApp Account';
    const subtitle = activePicker === 'emailTemplate'
      ? 'Choose a saved campaign template'
      : 'Choose the connected sender for this step';

    const rows = activePicker === 'emailAccount'
      ? emailAccounts
      : activePicker === 'emailTemplate'
        ? emailTemplates
        : whatsappAccounts;
    const emptyText = activePicker === 'emailAccount'
      ? 'No email account connected yet.'
      : activePicker === 'emailTemplate'
        ? 'No saved email templates found.'
        : 'No WhatsApp account connected yet.';

    return (
      <Modal visible animationType="fade" transparent onRequestClose={() => setActivePicker(null)}>
        <View style={styles.popupOverlay}>
          <View style={[styles.pickerPopup, { backgroundColor: wizardTone.card, borderColor: wizardTone.border }]}>
            <View style={[styles.voicePopupHeader, { borderBottomColor: wizardTone.border }]}>
              <View>
                <Typography variant="body" color={wizardTone.text} style={styles.headerTitle}>{title}</Typography>
                <Typography variant="caption" color={wizardTone.muted}>{subtitle}</Typography>
              </View>
              <TouchableOpacity onPress={() => setActivePicker(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={wizardTone.muted} size={19} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.voicePopupScroll} contentContainerStyle={styles.pickerList} showsVerticalScrollIndicator={false}>
              {rows.length ? rows.map((row) => {
                if (activePicker === 'emailAccount') {
                  const account = row as ConnectedEmailAccount;
                  const active = Boolean(emailStep && (emailStep.accountId === account.id || asRecord(emailStep.config).from_email === account.email));
                  return (
                    <TouchableOpacity
                      key={account.id || account.email}
                      activeOpacity={0.78}
                      onPress={() => emailStep && updateEmailAccount(emailStep, account)}
                      style={[styles.pickerOption, { borderColor: active ? wizardTone.borderStrong : wizardTone.border, backgroundColor: active ? (appTheme.darkMode ? '#173B76' : '#EEF2FF') : wizardTone.field }]}
                    >
                      <Mail color={active ? wizardTone.accent : wizardTone.muted} size={16} />
                      <View style={styles.pickerOptionCopy}>
                        <Typography variant="bodySmall" color={wizardTone.text} style={styles.pickerOptionTitle} numberOfLines={1}>
                          {providerLabel(account.provider)} - {account.email}
                        </Typography>
                        {account.displayName ? <Typography variant="caption" color={wizardTone.muted} numberOfLines={1}>{account.displayName}</Typography> : null}
                      </View>
                      {active ? <Check color={wizardTone.accent} size={16} /> : null}
                    </TouchableOpacity>
                  );
                }
                if (activePicker === 'emailTemplate') {
                  const template = row as EmailTemplateOption;
                  const active = selectedEmailTemplateId === template.id || asRecord(emailStep?.config).template_id === template.id;
                  return (
                    <TouchableOpacity
                      key={template.id}
                      activeOpacity={0.78}
                      onPress={() => emailStep && applyEmailTemplate(emailStep, template)}
                      style={[styles.pickerOption, { borderColor: active ? wizardTone.borderStrong : wizardTone.border, backgroundColor: active ? (appTheme.darkMode ? '#173B76' : '#EEF2FF') : wizardTone.field }]}
                    >
                      <FileText color={active ? wizardTone.accent : wizardTone.muted} size={16} />
                      <View style={styles.pickerOptionCopy}>
                        <Typography variant="bodySmall" color={wizardTone.text} style={styles.pickerOptionTitle} numberOfLines={1}>{template.name}</Typography>
                        <Typography variant="caption" color={wizardTone.muted} numberOfLines={1}>{template.subject || template.body}</Typography>
                      </View>
                      {active ? <Check color={wizardTone.accent} size={16} /> : null}
                    </TouchableOpacity>
                  );
                }
                const account = row as WhatsAppAccountOption;
                const active = Boolean(whatsappStep && (whatsappStep.accountId === account.id || asRecord(whatsappStep.config).whatsapp_account_id === account.id));
                return (
                  <TouchableOpacity
                    key={`${account.accountType}-${account.id}`}
                    activeOpacity={0.78}
                    onPress={() => whatsappStep && updateWhatsAppAccount(whatsappStep, account)}
                    style={[styles.pickerOption, { borderColor: active ? '#22C55E' : wizardTone.border, backgroundColor: active ? (appTheme.darkMode ? '#064E3B' : '#ECFDF5') : wizardTone.field }]}
                  >
                    <MessageSquare color={active ? '#16A34A' : wizardTone.muted} size={16} />
                    <View style={styles.pickerOptionCopy}>
                      <Typography variant="bodySmall" color={wizardTone.text} style={styles.pickerOptionTitle} numberOfLines={1}>{account.displayName}</Typography>
                      <Typography variant="caption" color={wizardTone.muted} numberOfLines={1}>
                        {account.accountType === 'business_api' ? 'Business API' : 'Personal'}
                      </Typography>
                    </View>
                    {active ? <Check color="#16A34A" size={16} /> : null}
                  </TouchableOpacity>
                );
              }) : (
                <View style={styles.templateEmptyRow}>
                  <FileText color={wizardTone.faint} size={15} />
                  <Typography variant="caption" color={wizardTone.muted}>{emptyText}</Typography>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDelaySettings = (step: WorkflowStepDef) => (
    <GlassCard style={[styles.delayCard, { backgroundColor: wizardTone.cardRaised, borderColor: wizardTone.border }]}>
      <View style={styles.settingsTitleRow}>
        <Clock color={wizardTone.accent} size={14} />
        <Typography variant="caption" color={wizardTone.text} style={styles.settingsTitle}>Delay before next step (Optional)</Typography>
      </View>
      <View style={styles.delayGrid}>
        <View style={styles.delayField}>
          {renderFieldLabel('Days')}
          <TextInput
            value={String(step.delayDays ?? 0)}
            onChangeText={(text) => updateStepDelay(step, 'delayDays', text)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={wizardTone.faint}
            style={[styles.textInput, styles.delayInput, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
          />
        </View>
        <View style={styles.delayField}>
          {renderFieldLabel('Hours')}
          <TextInput
            value={String(step.delayHours ?? 0)}
            onChangeText={(text) => updateStepDelay(step, 'delayHours', text)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={wizardTone.faint}
            style={[styles.textInput, styles.delayInput, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
          />
        </View>
      </View>
    </GlassCard>
  );

  const renderEmailSettings = (step: WorkflowStepDef) => {
    const account = emailAccountForStep(step);
    const selectedTemplate = emailTemplates.find((template) => template.id === selectedEmailTemplateId || template.id === asRecord(step.config).template_id);
    return (
      <GlassCard style={[styles.emailSettingsCard, { backgroundColor: wizardTone.cardRaised, borderColor: wizardTone.border }]}>
        <View style={styles.settingsHeaderRow}>
          <View style={styles.settingsTitleRow}>
            <Mail color={wizardTone.accent} size={14} />
            <Typography variant="caption" color={wizardTone.accent} style={styles.settingsTitle}>Email Settings</Typography>
          </View>
          <TouchableOpacity
            activeOpacity={0.78}
            disabled={emailGenerating}
            onPress={() => void generateEmailDraft(step)}
            style={styles.aiGenerateLink}
          >
            {emailGenerating ? <ActivityIndicator color={wizardTone.accent} size="small" /> : <Sparkles color={wizardTone.accent} size={13} />}
            <Typography variant="caption" color={emailGenerating ? wizardTone.faint : wizardTone.accent} style={styles.aiGenerateText}>
              {emailGenerating ? 'Generating...' : 'AI Generate'}
            </Typography>
          </TouchableOpacity>
        </View>

        {renderSelectControl({
          label: 'Send From',
          required: true,
          value: account ? `${providerLabel(account.provider)} - ${account.email}` : '',
          placeholder: 'Select sender account',
          onPress: () => setActivePicker('emailAccount'),
          loading: accountsLoading,
          leftIcon: <Mail color={wizardTone.faint} size={13} />,
        })}

        {!accountsLoading && !emailAccounts.length ? (
          <View style={[styles.warningBox, { backgroundColor: appTheme.darkMode ? '#451A03' : '#FFF7ED', borderColor: '#FDBA74' }]}>
            <Typography variant="caption" color={appTheme.darkMode ? '#FDBA74' : '#C2410C'}>No email account connected. Connect Gmail or Outlook from Integrations.</Typography>
          </View>
        ) : null}

        {renderSelectControl({
          label: 'Use Saved Template',
          value: selectedTemplate?.name || '',
          placeholder: 'Select a template',
          onPress: () => setActivePicker('emailTemplate'),
          loading: emailTemplatesLoading,
          leftIcon: <FileText color={wizardTone.faint} size={13} />,
        })}

        <View style={styles.formGroup}>
          {renderFieldLabel('Subject', true)}
          <TextInput
            value={step.subject || ''}
            onChangeText={(text) => assistant.updateWorkflowStep(step.id, { subject: text })}
            placeholder="e.g. Quick question for {{first_name}}"
            placeholderTextColor={wizardTone.faint}
            style={[styles.textInput, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
          />
        </View>

        <View style={styles.formGroup}>
          {renderFieldLabel('Email Body', true)}
          <TextInput
            value={step.message || ''}
            onChangeText={(text) => assistant.updateWorkflowStep(step.id, { message: text })}
            placeholder={'Hi {{first_name}},\n\nI came across your profile at {{company}} and wanted to reach out...\n\nBest,\n[Your name]'}
            placeholderTextColor={wizardTone.faint}
            multiline
            style={[styles.emailTextArea, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
          />
          <Typography variant="caption" color={wizardTone.faint} style={styles.placeholderText}>
            Placeholders: {'{{first_name}}'} {'{{last_name}}'} {'{{company}}'} {'{{title}}'} {'{{industry}}'}
          </Typography>
        </View>

        {!emailSaveTemplateMode ? (
          <TouchableOpacity activeOpacity={0.78} onPress={() => setEmailSaveTemplateMode(true)} style={[styles.saveTemplateDashed, { borderColor: wizardTone.border }]}>
            <Typography variant="caption" color={wizardTone.muted} style={styles.templateCreateText}>+ Save as template</Typography>
          </TouchableOpacity>
        ) : (
          <View style={styles.saveTemplateForm}>
            <TextInput
              value={emailSaveTemplateName}
              onChangeText={setEmailSaveTemplateName}
              placeholder="Template name..."
              placeholderTextColor={wizardTone.faint}
              style={[styles.compactInput, styles.saveTemplateNameInput, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
            />
            <View style={styles.saveTemplateButtons}>
              <TouchableOpacity
                activeOpacity={0.78}
                disabled={emailTemplateSaving}
                onPress={() => void saveEmailTemplate(step)}
                style={[styles.templatePrimaryBtn, emailTemplateSaving && styles.disabled]}
              >
                {emailTemplateSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Typography variant="caption" color="#FFFFFF" style={styles.templateUseText}>Save</Typography>}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => {
                  setEmailSaveTemplateMode(false);
                  setEmailSaveTemplateName('');
                }}
                style={[styles.templateSecondaryBtn, { backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
              >
                <Typography variant="caption" color={wizardTone.muted} style={styles.templateUseText}>Cancel</Typography>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </GlassCard>
    );
  };

  const renderWhatsAppSettings = (step: WorkflowStepDef) => {
    const account = whatsappAccountForStep(step);
    const selectedTemplate = whatsappTemplates.find((template) => template.id === selectedWhatsAppTemplateId || template.id === asRecord(step.config).whatsapp_template_id);
    return (
      <GlassCard style={[styles.whatsappSettingsCard, { backgroundColor: appTheme.darkMode ? '#062519' : '#F0FDF4', borderColor: appTheme.darkMode ? '#166534' : '#BBF7D0' }]}>
        <View style={styles.settingsHeaderRow}>
          <View style={styles.settingsTitleRow}>
            <MessageSquare color={appTheme.darkMode ? '#34D399' : '#166534'} size={14} />
            <Typography variant="caption" color={appTheme.darkMode ? '#34D399' : '#166534'} style={styles.settingsTitle}>WhatsApp Settings</Typography>
          </View>
          <TouchableOpacity
            activeOpacity={0.78}
            disabled={whatsappGenerating}
            onPress={() => void generateWhatsAppDraft(step)}
            style={styles.aiGenerateLink}
          >
            {whatsappGenerating ? <ActivityIndicator color="#166534" size="small" /> : <Sparkles color={appTheme.darkMode ? '#34D399' : '#166534'} size={13} />}
            <Typography variant="caption" color={whatsappGenerating ? wizardTone.faint : (appTheme.darkMode ? '#34D399' : '#166534')} style={styles.aiGenerateText}>
              {whatsappGenerating ? 'Generating...' : 'AI Generate'}
            </Typography>
          </TouchableOpacity>
        </View>

        {renderSelectControl({
          label: 'Send From',
          required: true,
          value: account ? account.displayName : '',
          placeholder: 'Select WhatsApp account',
          onPress: () => setActivePicker('whatsappAccount'),
          loading: whatsappAccountsLoading,
          leftIcon: <MessageSquare color={appTheme.darkMode ? '#34D399' : '#166534'} size={13} />,
          accent: appTheme.darkMode ? '#34D399' : '#166534',
        })}

        {!whatsappAccountsLoading && !whatsappConnected ? (
          <View style={[styles.warningBox, { backgroundColor: appTheme.darkMode ? '#451A03' : '#FFFBEB', borderColor: '#FCD34D' }]}>
            <Typography variant="caption" color={appTheme.darkMode ? '#FBBF24' : '#B45309'}>No WhatsApp account connected. Connect an account from Integrations.</Typography>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <View style={styles.templateHeaderRow}>
            {renderFieldLabel('Message Template')}
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                if (!showWhatsAppTemplates) {
                  setWhatsappTemplatesLoadedFor('');
                }
                setShowWhatsAppTemplates((value) => !value);
              }}
              style={styles.templateBrowseBtn}
            >
              <FileText color={appTheme.darkMode ? '#34D399' : '#166534'} size={12} />
              <Typography variant="caption" color={appTheme.darkMode ? '#34D399' : '#166534'} style={styles.templateBrowseText}>
                {showWhatsAppTemplates ? 'Close' : 'Browse templates'}
              </Typography>
            </TouchableOpacity>
          </View>

          {selectedTemplate && !showWhatsAppTemplates ? (
            <View style={[styles.selectedWaTemplateBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#DCFCE7', borderColor: appTheme.darkMode ? appTheme.labelBorder : '#86EFAC' }]}>
              <Typography variant="caption" color={appTheme.darkMode ? '#BBF7D0' : '#166534'} style={styles.selectedWaTemplateName} numberOfLines={1}>
                {selectedTemplate.name}
              </Typography>
              <View style={[styles.channelTypeBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : selectedTemplate.channelType === 'business_api' ? '#DBEAFE' : '#F0FDF4', borderColor: appTheme.darkMode ? appTheme.labelBorder : selectedTemplate.channelType === 'business_api' ? '#93C5FD' : '#86EFAC' }]}>
                <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : selectedTemplate.channelType === 'business_api' ? '#1D4ED8' : '#166534'} style={styles.channelTypeText}>
                  {selectedTemplate.channelType === 'business_api' ? 'WABA' : 'Personal'}
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedWhatsAppTemplateId('');
                  assistant.updateWorkflowStep(step.id, { message: '', config: { ...asRecord(step.config), whatsapp_template_id: undefined } });
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={wizardTone.faint} size={13} />
              </TouchableOpacity>
            </View>
          ) : null}

          {showWhatsAppTemplates ? (
            <View style={[styles.waTemplatePanel, { backgroundColor: wizardTone.field, borderColor: appTheme.darkMode ? '#166534' : '#BBF7D0' }]}>
              {whatsappTemplatesLoading ? (
                <View style={styles.templateEmptyRow}>
                  <ActivityIndicator color={appTheme.darkMode ? '#34D399' : '#166534'} size="small" />
                  <Typography variant="caption" color={wizardTone.muted}>Loading templates...</Typography>
                </View>
              ) : whatsappTemplates.length ? (
                whatsappTemplates.map((template) => {
                  const active = selectedWhatsAppTemplateId === template.id || asRecord(step.config).whatsapp_template_id === template.id;
                  return (
                    <TouchableOpacity
                      key={template.id}
                      activeOpacity={0.78}
                      onPress={() => applyWhatsAppTemplate(step, template)}
                      style={[styles.waTemplateRow, { backgroundColor: active ? (appTheme.darkMode ? '#064E3B' : '#DCFCE7') : 'transparent', borderBottomColor: appTheme.darkMode ? '#0F3A2A' : '#DCFCE7' }]}
                    >
                      <View style={styles.templateRowCopy}>
                        <View style={styles.templateNameLine}>
                          <Typography variant="caption" color={appTheme.darkMode ? '#BBF7D0' : '#166534'} style={styles.templateName} numberOfLines={1}>
                            {template.name}
                          </Typography>
                          {template.isDefault ? (
                            <View style={[styles.defaultBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#FEF3C7', borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
                              <Typography variant="caption" color={appTheme.darkMode ? '#FCD34D' : '#92400E'} style={styles.defaultBadgeText}>Default</Typography>
                            </View>
                          ) : null}
                        </View>
                        {template.headerText ? <Typography variant="caption" color={wizardTone.faint} numberOfLines={1}>Header: {template.headerText}</Typography> : null}
                        <Typography variant="caption" color={wizardTone.muted} numberOfLines={1}>{template.content}</Typography>
                        {template.footerText ? <Typography variant="caption" color={wizardTone.faint} numberOfLines={1}>Footer: {template.footerText}</Typography> : null}
                      </View>
                      <View style={[styles.templateUseBtn, { backgroundColor: appTheme.darkMode ? '#15803D' : '#166534' }]}>
                        <Typography variant="caption" color="#FFFFFF" style={styles.templateUseText}>Use</Typography>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.templateEmptyRow}>
                  <FileText color={wizardTone.faint} size={15} />
                  <Typography variant="caption" color={wizardTone.muted}>No saved WhatsApp templates found.</Typography>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <TextInput
          value={step.message || ''}
          onChangeText={(text) => assistant.updateWorkflowStep(step.id, { message: text })}
          placeholder="WhatsApp message"
          placeholderTextColor={wizardTone.faint}
          multiline
          style={[styles.whatsappTextArea, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
        />
      </GlassCard>
    );
  };

  const generateLinkedInDraft = async (kind: TemplateKind) => {
    if (aiGeneratingKind) return;
    setAiGenerateError('');
    setAiGeneratingKind(kind);
    try {
      const sampleLead = assistant.leads[0];
      const raw = asRecord(sampleLead?.raw);
      const response = await apiPost<Record<string, any>>('/api/campaigns/generate-message', {
        type: kind === 'connection' ? 'connection_request' : 'linkedin_followup',
        targeting: assistant.lastTargeting || assistant.targeting || {},
        context: {
          value_prop: aiValueProp.trim(),
          tone: aiTone,
          goal: aiGoal,
          sample_linkedin_url: sampleLead?.profileUrl || raw.linkedin_url || raw.employee_linkedin_url || null,
        },
      });
      const data = asRecord(response.data);
      const nested = asRecord(data.data);
      const generated = pickString(data.message, nested.message, data.response, nested.response, data.text, nested.text);
      if (!generated) throw new Error('No generated message returned.');
      setLinkedInMessage(kind, generated);
      if (kind === 'connection') setShowConnAi(false);
      else setShowFollowAi(false);
    } catch (error) {
      const valueProp = aiValueProp.trim() || 'helping teams create more qualified sales conversations';
      const toneLead = aiTone === 'direct' ? 'Quick note' : aiTone === 'casual' ? 'Hi {{first_name}}, hope you are doing well' : 'Hi {{first_name}}';
      const goalLine = aiGoal === 'share_resource'
        ? 'I can share a short resource if it is useful.'
        : aiGoal === 'explore_collab'
          ? 'It would be good to explore whether there is a fit.'
          : 'Open to a quick conversation?';
      const fallback = kind === 'connection'
        ? `${toneLead}, I noticed your work at {{company}} and thought it would be valuable to connect around ${valueProp}.`
        : `${toneLead}, great connecting. I wanted to reach out about ${valueProp} for companies like {{company}}. ${goalLine}`;
      setLinkedInMessage(kind, fallback);
      setAiGenerateError(error instanceof Error ? error.message : 'Used a fallback draft.');
    } finally {
      setAiGeneratingKind(null);
    }
  };

  const renderNumberBadge = (index: number, selected: boolean) => (
    <View
      style={[
        styles.numberBadge,
        {
          borderColor: appTheme.darkMode ? appTheme.labelBorder : selected ? '#0B1957' : '#CBD5E1',
          backgroundColor: appTheme.darkMode
            ? selected ? appTheme.labelBackgroundActive : appTheme.labelBackground
            : selected ? '#0B1957' : '#FFFFFF',
        },
      ]}
    >
      {selected ? (
        <Check color="#FFFFFF" size={14} strokeWidth={3} />
      ) : (
          <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : '#64748B'} style={styles.numberBadgeText}>{index + 1}</Typography>
      )}
    </View>
  );

  const renderSwitch = (checked: boolean, onPress: () => void, accent: 'indigo' | 'violet' = 'indigo', disabled = false) => {
    const onColor = accent === 'violet' ? '#7C3AED' : '#4338CA';
    const offColor = appTheme.darkMode ? '#253956' : '#CBD5E1';
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={disabled}
        onPress={onPress}
        style={[styles.switchTrack, { backgroundColor: checked ? onColor : offColor, opacity: disabled ? 0.55 : 1 }]}
      >
        <View style={[styles.switchThumb, checked && styles.switchThumbOn]} />
      </TouchableOpacity>
    );
  };

  const renderMiniAction = (label: string, active: boolean, onPress: () => void, accent = '#0B1957') => (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={[
        styles.messageToolBtn,
        {
          backgroundColor: active ? (appTheme.darkMode ? '#132A56' : '#E8ECFA') : 'transparent',
          borderColor: active ? (appTheme.darkMode ? '#365E9D' : '#C2D6EB') : 'transparent',
        },
      ]}
    >
      <Typography variant="caption" color={appTheme.darkMode ? '#DCE7FF' : accent} style={styles.messageToolText}>{label}</Typography>
    </TouchableOpacity>
  );

  const renderTemplatesPanel = (kind: TemplateKind) => {
    const available = linkedinTemplates.filter((template) => templateMatchesKind(template, kind));
    return (
      <View style={[styles.templatePanel, { backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}>
        {templatesLoading ? (
          <View style={styles.templateEmptyRow}>
            <ActivityIndicator color={wizardTone.accent} size="small" />
            <Typography variant="caption" color={wizardTone.muted}>Loading templates...</Typography>
          </View>
        ) : available.length ? (
          available.slice(0, 6).map((template) => (
            <TouchableOpacity
              key={`${kind}-${template.id}`}
              activeOpacity={0.78}
              onPress={() => {
                setLinkedInMessage(kind, templateTextFor(template, kind));
                if (kind === 'connection') setShowConnTemplates(false);
                else setShowFollowTemplates(false);
              }}
              style={[styles.templateRow, { borderBottomColor: appTheme.darkMode ? '#1A2E50' : '#EFF6FF' }]}
            >
              <View style={styles.templateRowCopy}>
                <Typography variant="caption" color={wizardTone.accent} style={styles.templateName}>{template.name}</Typography>
                <Typography variant="caption" color={wizardTone.muted} numberOfLines={1}>{templateTextFor(template, kind)}</Typography>
              </View>
              <View style={styles.templateUseBtn}>
                <Typography variant="caption" color="#FFFFFF" style={styles.templateUseText}>Use</Typography>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.templateEmptyRow}>
            <FileText color={wizardTone.faint} size={15} />
            <Typography variant="caption" color={wizardTone.muted}>No saved templates from DB.</Typography>
          </View>
        )}
        <View style={[styles.templateCreateBtn, { borderTopColor: wizardTone.border }]}>
          <Typography variant="caption" color={wizardTone.accent} style={styles.templateCreateText}>+ Create New Template</Typography>
        </View>
      </View>
    );
  };

  const renderAiGeneratePanel = (kind: TemplateKind) => (
    <View style={[styles.aiGeneratePanel, { backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}>
      <TextInput
        value={aiValueProp}
        onChangeText={setAiValueProp}
        placeholder="What should LAD emphasize?"
        placeholderTextColor={wizardTone.faint}
        style={[styles.compactInput, { color: wizardTone.text, backgroundColor: wizardTone.fieldRaised, borderColor: wizardTone.border }]}
      />
      <View style={styles.segmentRow}>
        {[
          { id: 'professional', label: 'Professional' },
          { id: 'casual', label: 'Casual' },
          { id: 'direct', label: 'Direct' },
        ].map((item) => {
          const selected = aiTone === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.78}
              onPress={() => setAiTone(item.id)}
              style={[
                styles.segmentChip,
                {
                  backgroundColor: appTheme.darkMode
                    ? selected ? appTheme.labelBackgroundActive : appTheme.labelBackground
                    : selected ? '#E8ECFA' : wizardTone.card,
                  borderColor: appTheme.darkMode ? appTheme.labelBorder : selected ? wizardTone.borderStrong : wizardTone.border,
                },
              ]}
            >
              <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : selected ? '#0B1957' : wizardTone.muted} style={styles.segmentText}>{item.label}</Typography>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.segmentRow}>
        {[
          { id: 'get_meeting', label: 'Get meeting' },
          { id: 'share_resource', label: 'Share resource' },
          { id: 'explore_collab', label: 'Explore fit' },
        ].map((item) => {
          const selected = aiGoal === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.78}
              onPress={() => setAiGoal(item.id)}
              style={[
                styles.segmentChip,
                {
                  backgroundColor: appTheme.darkMode
                    ? selected ? appTheme.labelBackgroundActive : appTheme.labelBackground
                    : selected ? '#E8ECFA' : wizardTone.card,
                  borderColor: appTheme.darkMode ? appTheme.labelBorder : selected ? wizardTone.borderStrong : wizardTone.border,
                },
              ]}
            >
              <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : selected ? '#0B1957' : wizardTone.muted} style={styles.segmentText}>{item.label}</Typography>
            </TouchableOpacity>
          );
        })}
      </View>
      {aiGenerateError ? (
        <Typography variant="caption" color="#FBBF24" style={styles.aiGenerateError}>{aiGenerateError}</Typography>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={Boolean(aiGeneratingKind)}
        onPress={() => void generateLinkedInDraft(kind)}
        style={[styles.generateDraftBtn, aiGeneratingKind && styles.disabled]}
      >
        {aiGeneratingKind === kind ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Sparkles color="#FFFFFF" size={14} />}
        <Typography variant="caption" color="#FFFFFF" style={styles.generateDraftText}>
          {aiGeneratingKind === kind ? 'Generating...' : 'Generate Draft'}
        </Typography>
      </TouchableOpacity>
    </View>
  );

  const renderLinkedInMessageEditor = (kind: TemplateKind) => {
    const step = findStep(kind === 'connection' ? 'linkedin_connect' : 'linkedin_message');
    if (!step) return null;
    const value = step.message || '';
    const isConnection = kind === 'connection';
    const templatesOpen = isConnection ? showConnTemplates : showFollowTemplates;
    const aiOpen = isConnection ? showConnAi : showFollowAi;
    return (
      <View style={[styles.messageEditor, { backgroundColor: wizardTone.section, borderColor: wizardTone.borderStrong }]}>
        <View style={styles.messageEditorHeader}>
          <Typography variant="caption" color={wizardTone.text} style={styles.messageEditorLabel}>
            {isConnection ? 'Connection Message' : 'Follow-up Message'}
          </Typography>
          <View style={styles.messageTools}>
            {renderMiniAction('Templates', templatesOpen, () => {
              if (isConnection) {
                setShowConnTemplates((value) => !value);
                setShowFollowTemplates(false);
              } else {
                setShowFollowTemplates((value) => !value);
                setShowConnTemplates(false);
              }
            }, '#1E40AF')}
            {renderMiniAction('AI Generate', aiOpen, () => {
              if (isConnection) {
                setShowConnAi((value) => !value);
                setShowFollowAi(false);
              } else {
                setShowFollowAi((value) => !value);
                setShowConnAi(false);
              }
            })}
          </View>
        </View>
        {templatesOpen ? renderTemplatesPanel(kind) : null}
        <TextInput
          value={value}
          onChangeText={(text) => setLinkedInMessage(kind, text)}
          placeholder={isConnection
            ? 'Hi {{first_name}}, I noticed your work at {{company}} and would love to connect...'
            : 'Hi {{first_name}}, great connecting! I wanted to reach out about how we help companies like {{company}}...'}
          placeholderTextColor={wizardTone.faint}
          multiline
          maxLength={isConnection ? 300 : undefined}
          style={[styles.messageTextArea, { color: wizardTone.text, backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}
        />
        <View style={styles.placeholderRow}>
          <Typography variant="caption" color={wizardTone.faint} style={styles.placeholderText}>
            Placeholders: {PLACEHOLDER_HINT}
          </Typography>
          {isConnection ? (
            <Typography variant="caption" color={wizardTone.faint} style={styles.charCount}>{value.length}/300</Typography>
          ) : null}
        </View>
        <Typography variant="caption" color={appTheme.darkMode ? '#CFE1FF' : '#0B1957'} style={styles.aiAtSendText}>AI-personalised at send time</Typography>
        {aiOpen ? renderAiGeneratePanel(kind) : null}
      </View>
    );
  };

  const renderLinkedInAction = (action: typeof LI_ACTIONS[number], index: number) => {
    const selected = cfg.actions.includes(action.id);
    const Icon = action.Icon;
    const expandable = action.id === 'connect' || action.id === 'message';
    return (
      <View key={action.id} style={styles.liActionStack}>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => toggleLiAction(action.id)}
          style={[
            styles.liActionRow,
            {
              borderColor: selected ? wizardTone.borderStrong : wizardTone.border,
              backgroundColor: selected ? (appTheme.darkMode ? '#173B76' : '#DBEAFE') : wizardTone.card,
              borderBottomLeftRadius: selected && expandable ? 0 : 10,
              borderBottomRightRadius: selected && expandable ? 0 : 10,
            },
          ]}
        >
          <View style={[styles.liCheckbox, { borderColor: selected ? wizardTone.borderStrong : wizardTone.border, backgroundColor: selected ? (appTheme.darkMode ? '#0B2D6B' : '#3B82F6') : 'transparent' }]}>
            {selected ? <Check color="#FFFFFF" size={12} strokeWidth={3} /> : null}
          </View>
          <View style={[styles.liActionIcon, { backgroundColor: appTheme.darkMode ? '#102A58' : '#DBEAFE' }]}>
            <Icon color={wizardTone.accent} size={15} />
          </View>
          <View style={styles.liActionCopy}>
            <Typography variant="bodySmall" color={wizardTone.text} style={styles.liActionTitle}>{action.label}</Typography>
            <Typography variant="caption" color={selected && appTheme.darkMode ? '#D4E4FF' : wizardTone.muted} style={styles.liActionDesc}>{action.desc}</Typography>
          </View>
        </TouchableOpacity>
        {selected && action.id === 'connect' ? renderLinkedInMessageEditor('connection') : null}
        {selected && action.id === 'message' ? renderLinkedInMessageEditor('followup') : null}
      </View>
    );
  };

  const renderPersonalizationRow = ({
    icon,
    title,
    desc,
    checked,
    onToggle,
    accent = 'indigo',
    disabled = false,
  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    checked: boolean;
    onToggle: () => void;
    accent?: 'indigo' | 'violet';
    disabled?: boolean;
  }) => {
    const active = checked && !disabled;
    const tint = appTheme.darkMode
      ? active ? (accent === 'violet' ? '#23184A' : '#122C5A') : wizardTone.card
      : accent === 'violet' ? '#F5F3FF' : '#EEF2FF';
    const chip = appTheme.darkMode
      ? active ? (accent === 'violet' ? '#39237A' : '#173B76') : '#101F3C'
      : accent === 'violet' ? '#EDE9FE' : '#E0E7FF';
    const border = appTheme.darkMode
      ? active ? (accent === 'violet' ? '#7C3AED' : '#4B7DFF') : wizardTone.border
      : accent === 'violet' ? '#DDD6FE' : '#C7D2FE';
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={disabled}
        onPress={onToggle}
        style={[
          styles.aiPersoRow,
          {
            backgroundColor: active ? tint : wizardTone.card,
            borderColor: active ? border : wizardTone.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <View style={[styles.aiPersoIcon, { backgroundColor: active ? chip : wizardTone.fieldRaised }]}>{icon}</View>
        <View style={styles.aiPersoCopy}>
          <Typography variant="bodySmall" color={wizardTone.text} style={styles.aiPersoTitle}>{title}</Typography>
          <Typography variant="caption" color={wizardTone.muted} style={styles.aiPersoDesc}>{desc}</Typography>
        </View>
        {renderSwitch(checked, onToggle, accent, disabled)}
      </TouchableOpacity>
    );
  };

  const renderAiDailyPersonalisation = () => {
    const anyOn = assistant.cpEnableDailyWebPresence || assistant.cpEnableDailyPosts || assistant.cpEnableAiPersonalization;
    return (
      <View style={styles.aiPersoWrap}>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={toggleAllPersonalization}
          style={[
            styles.aiPersoHeader,
            {
              backgroundColor: appTheme.darkMode ? (anyOn ? '#121D3A' : wizardTone.card) : anyOn ? '#F2F3FF' : '#F8FAFC',
              borderColor: appTheme.darkMode ? (anyOn ? '#3E5D9A' : wizardTone.border) : anyOn ? '#C7D2FE' : '#E5E7EB',
              borderBottomLeftRadius: anyOn ? 0 : 14,
              borderBottomRightRadius: anyOn ? 0 : 14,
            },
          ]}
        >
          <View style={[styles.aiPersoLogo, { backgroundColor: anyOn ? '#5B21B6' : '#EEF2FF' }]}>
            <Sparkles color={anyOn ? '#FFFFFF' : '#4338CA'} size={18} />
          </View>
          <View style={styles.aiPersoCopy}>
            <Typography variant="bodySmall" color={appTheme.darkMode ? '#C7D2FE' : '#4338CA'} style={styles.aiPersoHeaderTitle}>AI Daily Personalisation</Typography>
            <Typography variant="caption" color={wizardTone.muted}>Unique messages per lead, powered by live data</Typography>
          </View>
          {renderSwitch(anyOn, toggleAllPersonalization, 'indigo')}
        </TouchableOpacity>

        {anyOn ? (
          <View style={[styles.aiPersoBody, { backgroundColor: wizardTone.section, borderColor: appTheme.darkMode ? '#3E5D9A' : '#C7D2FE' }]}>
            <View style={styles.aiPersoGroup}>
              <Typography variant="overline" color={appTheme.darkMode ? '#8CB7FF' : '#4338CA'} style={styles.aiPersoGroupTitle}>Live data sources</Typography>
              {renderPersonalizationRow({
                icon: <Globe color={appTheme.darkMode ? '#C7D2FE' : '#4338CA'} size={16} />,
                title: 'Refresh web presence daily',
                desc: 'Re-runs Google search for articles, news & social profiles per lead',
                checked: assistant.cpEnableDailyWebPresence,
                onToggle: () => assistant.setCpPersonalization({ cpEnableDailyWebPresence: !assistant.cpEnableDailyWebPresence }),
              })}
              {renderPersonalizationRow({
                icon: <Newspaper color={appTheme.darkMode ? '#C7D2FE' : '#4338CA'} size={16} />,
                title: 'Fetch live LinkedIn posts',
                desc: "Pulls the lead's recent LinkedIn posts before each send",
                checked: assistant.cpEnableDailyPosts,
                onToggle: () => assistant.setCpPersonalization({ cpEnableDailyPosts: !assistant.cpEnableDailyPosts }),
              })}
            </View>

            <View style={styles.aiPersoGroup}>
              <Typography variant="overline" color={appTheme.darkMode ? '#C4B5FD' : '#7C3AED'} style={styles.aiPersoGroupTitle}>AI message generation</Typography>
              {renderPersonalizationRow({
                icon: <Sparkles color={appTheme.darkMode ? '#DDD6FE' : '#7C3AED'} size={16} />,
                title: 'AI-generate unique message per lead',
                desc: noPersonalizationSource ? 'Enable a live data source above first' : 'AI writes a personalised connect + follow-up from live web & post data',
                checked: assistant.cpEnableAiPersonalization,
                disabled: noPersonalizationSource,
                accent: 'violet',
                onToggle: () => assistant.setCpPersonalization({ cpEnableAiPersonalization: !assistant.cpEnableAiPersonalization }),
              })}

              {assistant.cpEnableAiPersonalization && !noPersonalizationSource ? (
                <>
                  <View style={[styles.uniqueMessageNote, { backgroundColor: appTheme.darkMode ? '#1E1640' : '#FAF5FF', borderColor: appTheme.darkMode ? '#53389E' : '#E9D5FF' }]}>
                    <Check color="#7C3AED" size={15} />
                    <Typography variant="caption" color={appTheme.darkMode ? '#DDD6FE' : '#6D28D9'} style={styles.uniqueMessageText}>
                      Each lead gets a unique AI-generated message from their live web presence and LinkedIn posts. Your static template is the fallback.
                    </Typography>
                  </View>
                  <View style={[styles.whichMessagesWrap, { borderLeftColor: appTheme.darkMode ? '#53389E' : '#DDD6FE' }]}>
                    <Typography variant="overline" color={appTheme.darkMode ? '#C4B5FD' : '#7C3AED'} style={styles.aiPersoGroupTitle}>Which messages?</Typography>
                    {renderPersonalizationRow({
                      icon: <UserPlus color={appTheme.darkMode ? '#DDD6FE' : '#7C3AED'} size={16} />,
                      title: 'Connection request',
                      desc: 'Personalised connect note per lead',
                      checked: assistant.cpEnableAiConnectionPersonalization,
                      accent: 'violet',
                      onToggle: () => assistant.setCpPersonalization({ cpEnableAiConnectionPersonalization: !assistant.cpEnableAiConnectionPersonalization }),
                    })}
                    {renderPersonalizationRow({
                      icon: <MessageSquare color={appTheme.darkMode ? '#DDD6FE' : '#7C3AED'} size={16} />,
                      title: 'Follow-up message',
                      desc: 'Personalised follow-up per lead',
                      checked: assistant.cpEnableAiFollowupPersonalization,
                      accent: 'violet',
                      onToggle: () => assistant.setCpPersonalization({ cpEnableAiFollowupPersonalization: !assistant.cpEnableAiFollowupPersonalization }),
                    })}
                    <Typography variant="caption" color={wizardTone.faint} style={styles.uncheckedHint}>Unchecked messages use your static template.</Typography>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const voiceAgentLabel = (agent?: VoiceAgentOption) => {
    if (!agent) return voiceOptionsLoading ? 'Loading available agents...' : 'Select AI agent';
    return `${agent.name}${agent.language ? ` (${agent.language})` : ''}`;
  };

  const voiceNumberLabel = (number?: VoiceNumberOption) => {
    if (number) {
      const suffix = number.label && number.label !== number.phoneNumber ? ` - ${number.label}` : '';
      return `${number.phoneNumber}${suffix}`;
    }
    return voiceOptionsLoading ? 'Loading available numbers...' : 'Select from number';
  };

  const handleSaveVoiceSelection = async () => {
    const agent = voiceAgents.find((item) => item.id === draftVoiceAgentId) || selectedVoiceAgent;
    const number = voiceNumbers.find((item) => item.id === draftVoiceNumberId) || selectedVoiceNumber;
    if (!agent || !number) return;

    setVoiceConfigSaving(true);
    try {
      setDraftVoiceAgentId(agent.id);
      setDraftVoiceNumberId(number.id);
      const voiceStep = findStep('voice_agent_call');
      if (voiceStep) {
        assistant.updateWorkflowStep(voiceStep.id, {
          accountId: agent.id,
          phoneNumber: number.phoneNumber,
          message: voiceStep.message || DEFAULT_VOICE_CALL_CONTEXT,
        });
      }
      setShowVoicePicker(false);
    } finally {
      setVoiceConfigSaving(false);
    }
  };

  const renderVoicePickerModal = () => (
    <Modal visible={showVoicePicker} animationType="fade" transparent onRequestClose={() => setShowVoicePicker(false)}>
      <View style={styles.popupOverlay}>
        <View style={[styles.voicePopup, { backgroundColor: wizardTone.card, borderColor: wizardTone.border }]}>
          <View style={[styles.voicePopupHeader, { borderBottomColor: wizardTone.border }]}>
            <View>
              <Typography variant="body" color={wizardTone.text} style={styles.headerTitle}>Voice Call Settings</Typography>
              <Typography variant="caption" color={wizardTone.muted}>Select the agent and from number for this campaign</Typography>
            </View>
            <TouchableOpacity onPress={() => setShowVoicePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={wizardTone.muted} size={19} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.voicePopupScroll} contentContainerStyle={styles.voicePopupBody} showsVerticalScrollIndicator={false}>
            <View style={styles.voicePickerGroup}>
              <Typography variant="caption" color={wizardTone.accent} style={styles.voicePickerLabel}>AI Agent</Typography>
              {voiceAgents.length ? voiceAgents.map((agent) => {
                const active = draftVoiceAgentId === agent.id;
                return (
                  <TouchableOpacity
                    key={agent.id}
                    activeOpacity={0.78}
                    onPress={() => {
                      setDraftVoiceAgentId(agent.id);
                      const linkedNumber = voiceNumbers.find((number) => number.assignedAgentId === agent.id);
                      if (linkedNumber) setDraftVoiceNumberId(linkedNumber.id);
                    }}
                    style={[styles.voicePickerOption, { borderColor: active ? wizardTone.borderStrong : wizardTone.border, backgroundColor: active ? (appTheme.darkMode ? '#173B76' : '#EEF2FF') : wizardTone.field }]}
                  >
                    <Bot color={active ? (appTheme.darkMode ? '#FFFFFF' : '#0B1957') : wizardTone.muted} size={16} />
                    <Typography variant="bodySmall" color={wizardTone.text} style={styles.voicePickerOptionText} numberOfLines={1}>
                      {voiceAgentLabel(agent)}
                    </Typography>
                    {active ? <Check color={appTheme.darkMode ? '#FFFFFF' : '#0B1957'} size={16} /> : null}
                  </TouchableOpacity>
                );
              }) : (
                <Typography variant="caption" color={wizardTone.muted}>No voice agents found. Add one in AI Voice Settings, then come back here.</Typography>
              )}
            </View>

            <View style={styles.voicePickerGroup}>
              <Typography variant="caption" color={wizardTone.accent} style={styles.voicePickerLabel}>From Number</Typography>
              {voiceNumbers.length ? voiceNumbers.map((number) => {
                const active = draftVoiceNumberId === number.id;
                return (
                  <TouchableOpacity
                    key={number.id}
                    activeOpacity={0.78}
                    onPress={() => {
                      setDraftVoiceNumberId(number.id);
                      if (number.assignedAgentId) setDraftVoiceAgentId(number.assignedAgentId);
                    }}
                    style={[styles.voicePickerOption, { borderColor: active ? wizardTone.borderStrong : wizardTone.border, backgroundColor: active ? (appTheme.darkMode ? '#173B76' : '#EEF2FF') : wizardTone.field }]}
                  >
                    <Phone color={active ? (appTheme.darkMode ? '#FFFFFF' : '#0B1957') : wizardTone.muted} size={16} />
                    <Typography variant="bodySmall" color={wizardTone.text} style={styles.voicePickerOptionText} numberOfLines={1}>
                      {voiceNumberLabel(number)}
                    </Typography>
                    {active ? <Check color={appTheme.darkMode ? '#FFFFFF' : '#0B1957'} size={16} /> : null}
                  </TouchableOpacity>
                );
              }) : (
                <Typography variant="caption" color={wizardTone.muted}>No verified calling numbers found. Add a number in AI Voice Settings, then come back here.</Typography>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.82}
            disabled={voiceConfigSaving || !selectedVoiceAgent || !selectedVoiceNumber}
            onPress={() => void handleSaveVoiceSelection()}
            style={[styles.voicePopupSaveBtn, (voiceConfigSaving || !selectedVoiceAgent || !selectedVoiceNumber) && styles.footerDisabled]}
          >
            {voiceConfigSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Save color="#FFFFFF" size={15} />}
            <Typography variant="bodySmall" color="#FFFFFF" style={styles.footerNextText}>Save</Typography>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderVoiceSettings = () => (
    <GlassCard style={[styles.voiceSettingsCard, { backgroundColor: wizardTone.cardRaised, borderColor: wizardTone.border }]}>
      <View style={styles.voiceSettingsHeader}>
        <View style={styles.settingsTitleRow}>
          <Phone color={wizardTone.accent} size={15} />
          <Typography variant="caption" color={wizardTone.text} style={styles.settingsTitle}>Voice Call Settings</Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => setShowVoicePicker(true)}
          style={[styles.voiceEditBtn, { backgroundColor: wizardTone.field, borderColor: wizardTone.borderStrong }]}
        >
          {voiceOptionsLoading ? <ActivityIndicator color={wizardTone.accent} size="small" /> : <Pencil color={wizardTone.accent} size={15} />}
        </TouchableOpacity>
      </View>

      <View style={styles.voiceSavedRows}>
        <View style={styles.voiceSavedGroup}>
          <Typography variant="caption" color={wizardTone.accent} style={styles.voiceSavedLabel}>AI Agent</Typography>
          <TouchableOpacity activeOpacity={0.78} onPress={() => setShowVoicePicker(true)} style={[styles.voiceSavedValueBox, { backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}>
            <Bot color={wizardTone.muted} size={16} />
            <Typography variant="bodySmall" color={wizardTone.text} style={styles.voiceSavedValue} numberOfLines={1}>
              {voiceAgentLabel(selectedVoiceAgent)}
            </Typography>
            {!voiceOptionsLoading ? <Typography variant="caption" color={wizardTone.accent} style={styles.voiceSelectText}>{selectedVoiceAgent ? 'Change' : 'Select'}</Typography> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.voiceSavedGroup}>
          <Typography variant="caption" color={wizardTone.accent} style={styles.voiceSavedLabel}>From Number</Typography>
          <TouchableOpacity activeOpacity={0.78} onPress={() => setShowVoicePicker(true)} style={[styles.voiceSavedValueBox, { backgroundColor: wizardTone.field, borderColor: wizardTone.border }]}>
            <Phone color={wizardTone.muted} size={16} />
            <Typography variant="bodySmall" color={wizardTone.text} style={styles.voiceSavedValue} numberOfLines={1}>
              {voiceNumberLabel(selectedVoiceNumber)}
            </Typography>
            {!voiceOptionsLoading ? <Typography variant="caption" color={wizardTone.accent} style={styles.voiceSelectText}>{selectedVoiceNumber ? 'Change' : 'Select'}</Typography> : null}
          </TouchableOpacity>
        </View>
      </View>

      {renderVoicePickerModal()}
    </GlassCard>
  );

  const renderChannelsStep = () => {
    const emailStep = findStep('email_send');
    const whatsappStep = findStep('whatsapp_send');
    const voiceStep = findStep('voice_agent_call');
    const manualChannels = WORKFLOW_PLATFORMS.filter((platform) => platform.id !== 'media').map((platform, index) => {
      const Icon = platform.id === 'linkedin' ? Briefcase : platform.id === 'email' ? Mail : platform.id === 'whatsapp' ? MessageSquare : Phone;
      return {
        ...platform,
        index,
        Icon,
        desc: platform.id === 'linkedin'
          ? 'Additional LinkedIn touchpoints'
          : platform.id === 'email'
            ? 'Send a follow-up email to the lead'
            : platform.id === 'whatsapp'
              ? 'Send a WhatsApp message'
              : 'Trigger an AI voice call',
      };
    });
    const currentManualChannel = sortedSelectedChannels[0] || 'linkedin';
    const currentManualLabel = channelLabel(currentManualChannel);
    const selectedManualCount = Math.max(sortedSelectedChannels.length, 1);
    const progressWidth = `${Math.max(12, Math.min(100, (1 / selectedManualCount) * 100))}%`;

    return (
      <View style={styles.stepBody}>
        {renderActionHeader()}
        <Typography variant="body" color={appTheme.text} style={styles.stepTitle}>Configure your campaign channels</Typography>

        <View style={[styles.channelChoicePanel, { backgroundColor: appTheme.darkMode ? '#050D25' : '#F8FAFC', borderColor: wizardTone.border }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void assistant.letAgentDeal()}
            disabled={assistant.cpAgentDealLoading}
            style={[styles.inlineAgentDealCard, assistant.cpAgentDealLoading && styles.disabled]}
          >
            {assistant.cpAgentDealLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Zap color="#FF8A3D" size={20} />}
            <View style={styles.inlineAgentDealCopy}>
              <Typography variant="body" color="#FFFFFF" style={styles.inlineAgentDealTitle}>
                {assistant.cpAgentDealLoading ? 'Building your campaign...' : 'Let Agent Deal'}
              </Typography>
              <Typography variant="caption" color="#E6EDFF" style={styles.inlineAgentDealDesc}>
                Auto-build the full sequence across your connected channels, with recommended delays
              </Typography>
            </View>
            {!assistant.cpAgentDealLoading ? <ArrowRight color="#FFFFFF" size={18} /> : null}
          </TouchableOpacity>

          <Typography variant="caption" color={wizardTone.faint} style={styles.manualDivider}>- or configure manually -</Typography>

          <View style={[styles.channelProgressCard, { backgroundColor: wizardTone.card, borderColor: appTheme.darkMode ? '#F8FAFC' : wizardTone.borderStrong }]}>
            <View style={styles.channelProgressHeader}>
              <View style={styles.settingsTitleRow}>
                <Briefcase color={wizardTone.accent} size={15} />
                <Typography variant="bodySmall" color={wizardTone.text} style={styles.channelProgressTitle}>Configure {currentManualLabel}</Typography>
              </View>
              <View style={[styles.channelStepBadge, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : wizardTone.field, borderColor: appTheme.darkMode ? appTheme.labelBorder : wizardTone.border }]}>
                <Typography variant="caption" color={wizardTone.muted} style={styles.channelStepBadgeText}>Step 1 of {selectedManualCount}</Typography>
              </View>
            </View>
            <View style={[styles.channelProgressTrack, { backgroundColor: appTheme.darkMode ? '#1E2F50' : '#E5E7EB' }]}>
              <View style={[styles.channelProgressFill, { width: progressWidth as ViewStyle['width'], backgroundColor: wizardTone.selected }]} />
            </View>
          </View>

          <View style={styles.channelTileList}>
            {manualChannels.map((platform) => {
              const connected = Boolean(channelConnections[platform.id]);
              const selected = effectiveSelectedChannels.includes(platform.id);
              const Icon = platform.Icon;
              const tileBackground = selected
                ? wizardTone.selected
                : appTheme.darkMode ? '#020A25' : '#FFFFFF';
              const tileBorder = selected
                ? wizardTone.borderStrong
                : appTheme.darkMode ? '#1D3151' : '#D5DEEA';
              const inactiveTitleColor = appTheme.darkMode ? '#E5EDF8' : '#0F172A';
              const inactiveDescColor = appTheme.darkMode ? '#B8C4D6' : '#64748B';
              return (
                <TouchableOpacity
                  key={platform.id}
                  activeOpacity={0.8}
                  onPress={() => toggleChannel(platform.id)}
                  style={[
                    styles.channelTile,
                    {
                      backgroundColor: tileBackground,
                      borderColor: tileBorder,
                      opacity: channelConnectionsLoaded || selected || platform.id === 'linkedin' ? 1 : 0.72,
                    },
                  ]}
                >
                  <View style={[styles.channelTileCheck, { backgroundColor: selected ? '#0B2D6B' : wizardTone.field, borderColor: selected ? '#0B2D6B' : wizardTone.border }]}>
                    {selected ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : (
                      <Typography variant="caption" color={wizardTone.muted} style={styles.channelTileNumber}>{platform.index + 1}</Typography>
                    )}
                  </View>
                  <Icon color={selected ? '#FFFFFF' : connected ? wizardTone.accent : wizardTone.faint} size={18} />
                  <View style={styles.channelTileCopy}>
                    <Typography variant="bodySmall" color={selected ? '#FFFFFF' : inactiveTitleColor} style={styles.channelTileTitle}>{platform.label}</Typography>
                    <Typography variant="caption" color={selected ? '#DCE7FF' : inactiveDescColor} style={styles.channelTileDesc}>{platform.desc}</Typography>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {effectiveSelectedChannels.includes('linkedin') ? (
          <GlassCard style={[styles.linkedinCard, { backgroundColor: wizardTone.section, borderColor: wizardTone.border }]}>
            <View style={styles.settingsTitleRow}>
              <Briefcase color={wizardTone.accent} size={14} />
              <Typography variant="caption" color={wizardTone.accent} style={styles.settingsTitle}>LinkedIn Activity Settings</Typography>
            </View>
            <Typography variant="caption" color={wizardTone.muted}>Select LinkedIn actions (multi-select):</Typography>
            <View style={styles.liActionsList}>{LI_ACTIONS.map(renderLinkedInAction)}</View>
            {renderAiDailyPersonalisation()}
          </GlassCard>
        ) : null}

        {effectiveSelectedChannels.includes('email') && emailStep ? (
          <>
            {renderEmailSettings(emailStep)}
            {sortedSelectedChannels.indexOf('email') > -1 && sortedSelectedChannels.indexOf('email') < sortedSelectedChannels.length - 1
              ? renderDelaySettings(emailStep)
              : null}
          </>
        ) : null}

        {effectiveSelectedChannels.includes('whatsapp') && whatsappStep ? (
          <>
            {renderWhatsAppSettings(whatsappStep)}
            {sortedSelectedChannels.indexOf('whatsapp') > -1 && sortedSelectedChannels.indexOf('whatsapp') < sortedSelectedChannels.length - 1
              ? renderDelaySettings(whatsappStep)
              : null}
          </>
        ) : null}

        {effectiveSelectedChannels.includes('voice') && voiceStep ? renderVoiceSettings() : null}
        {renderPickerModal()}
      </View>
    );
  };

  const renderActionHeader = () => (
    <View style={styles.actionHeader}>
      <View style={styles.actionHeaderLeft}>
        <Typography variant="overline" color={appTheme.darkMode ? '#B8C7FF' : '#0B1957'} style={styles.actionHeaderText}>LAD IN ACTION</Typography>
        <View style={styles.actionHeaderDot} />
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X color="#94A3B8" size={18} />
      </TouchableOpacity>
    </View>
  );

  const renderTriggerStep = () => (
    <View style={styles.stepBody}>
      {renderActionHeader()}
      <Typography variant="body" color={appTheme.text} style={styles.stepTitle}>When should the next channel step trigger?</Typography>
      <GlassCard style={[styles.questionCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        <View style={styles.sequenceRow}>
          {sortedSelectedChannels.map((channel, index) => (
            <React.Fragment key={channel}>
              <View style={[styles.sequenceChip, appTheme.darkMode && { backgroundColor: appTheme.labelBackground, borderColor: appTheme.labelBorder, borderWidth: 1 }]}>
                <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : '#0B1957'} style={styles.sequenceText}>{channelLabel(channel)}</Typography>
              </View>
              {index < sortedSelectedChannels.length - 1 ? (
                <Typography variant="caption" color="#94A3B8" style={styles.sequenceArrow}>{'->'}</Typography>
              ) : null}
            </React.Fragment>
          ))}
        </View>
        {triggerOptions.map((option, index) => {
          const selected = cfg.triggerCondition === option.id;
          const optionBackground = appTheme.darkMode
            ? selected ? '#2F6BFF' : '#020A25'
            : selected ? '#EEF2FF' : '#FFFFFF';
          const optionBorder = appTheme.darkMode
            ? selected ? '#6FA0FF' : '#253956'
            : selected ? '#0B1957' : '#E5E7EB';
          const titleColor = appTheme.darkMode ? '#FFFFFF' : '#0F172A';
          const descColor = appTheme.darkMode ? (selected ? '#DCE7FF' : '#B8C4D6') : '#64748B';
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.78}
              onPress={() => assistant.setWorkflowTriggerCondition(option.id)}
              style={[styles.numberedOption, { borderColor: optionBorder, backgroundColor: optionBackground }]}
            >
              {renderNumberBadge(index, selected)}
              <View style={styles.numberedCopy}>
                <Typography variant="bodySmall" color={titleColor} style={styles.numberedTitle}>{option.label}</Typography>
                <Typography variant="caption" color={descColor} style={styles.numberedDesc}>{option.desc}</Typography>
              </View>
            </TouchableOpacity>
          );
        })}
      </GlassCard>
    </View>
  );

  const renderDurationStep = () => (
    <View style={styles.stepBody}>
      {renderActionHeader()}
      <Typography variant="body" color={appTheme.text} style={styles.stepTitle}>How many days should this campaign run?</Typography>
      <GlassCard style={[styles.questionCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        {DURATION_OPTIONS.map((option, index) => {
          const selected = assistant.campaignDays === option.days;
          const optionBackground = appTheme.darkMode
            ? selected ? '#2F6BFF' : '#020A25'
            : selected ? '#EEF2FF' : '#FFFFFF';
          const optionBorder = appTheme.darkMode
            ? selected ? '#6FA0FF' : '#D5DEEA'
            : selected ? '#0B1957' : '#CBD5E1';
          const titleColor = appTheme.darkMode ? '#FFFFFF' : '#0F172A';
          const descColor = appTheme.darkMode ? (selected ? '#DCE7FF' : '#B8C4D6') : '#64748B';
          return (
            <TouchableOpacity
              key={option.days}
              activeOpacity={0.78}
              onPress={() => assistant.setCampaignDays(option.days)}
              style={[styles.numberedOption, { borderColor: optionBorder, backgroundColor: optionBackground }]}
            >
              {renderNumberBadge(index, selected)}
              <View style={styles.numberedCopy}>
                <Typography variant="bodySmall" color={titleColor} style={styles.numberedTitle}>{option.label}</Typography>
                <Typography variant="caption" color={descColor} style={styles.numberedDesc}>
                  {option.days === 1
                    ? `One-time send to your ${leadCount} selected leads - no drip schedule`
                    : `Reaches your ${leadCount} selected leads over ${option.workingDays} working days`}
                </Typography>
              </View>
            </TouchableOpacity>
          );
        })}
        <TextInput
          value={assistant.campaignDays ? String(assistant.campaignDays) : ''}
          onChangeText={(text) => {
            const value = Number(text.replace(/[^0-9]/g, ''));
            assistant.setCampaignDays(Number.isFinite(value) ? value : 0);
          }}
          keyboardType="number-pad"
          placeholder="Or enter custom days..."
          placeholderTextColor="#94A3B8"
          style={[
            styles.customDaysInput,
            {
              color: appTheme.darkMode ? '#FFFFFF' : '#0F172A',
              borderColor: appTheme.darkMode ? '#253956' : '#E0EAF5',
              backgroundColor: appTheme.darkMode ? '#020A25' : '#FFFFFF',
            },
          ]}
        />
      </GlassCard>
    </View>
  );

  const nameCardBackground = appTheme.darkMode ? '#0A1538' : appTheme.surface;
  const nameControlBackground = appTheme.darkMode ? appTheme.background : '#FFFFFF';
  const nameControlBorder = appTheme.darkMode ? 'rgba(125, 164, 235, 0.34)' : '#E0EAF5';
  const suggestBackground = appTheme.darkMode ? '#102A62' : '#FFFFFF';
  const suggestForeground = appTheme.darkMode ? '#8CB4FF' : '#0B1957';

  const renderNameStep = () => (
    <View style={styles.stepBody}>
      {renderActionHeader()}
      <Typography variant="body" color={appTheme.text} style={styles.stepTitle}>Give your campaign a name</Typography>
      <GlassCard style={[styles.questionCard, { backgroundColor: nameCardBackground, borderColor: nameControlBorder }]}>
        <View style={styles.nameRow}>
          <TextInput
            value={assistant.campaignName}
            onChangeText={assistant.setCampaignName}
            onFocus={onInputFocus}
            placeholder="e.g. Q3 Outreach Strategy"
            placeholderTextColor={appTheme.disabled}
            style={[
              styles.nameInput,
              {
                color: appTheme.text,
                borderColor: nameControlBorder,
                backgroundColor: nameControlBackground,
              },
            ]}
          />
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={suggestCampaignName}
            style={[
              styles.suggestBtn,
              { backgroundColor: suggestBackground, borderColor: appTheme.darkMode ? appTheme.primaryAccent : '#0B1957' },
            ]}
          >
            <Sparkles color={suggestForeground} size={14} />
            <Typography variant="caption" color={suggestForeground} style={styles.suggestText}>Suggest</Typography>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );

  const isLaunching = assistant.outreachWorkflowStage === 'launching';
  const isLastStep = currentIndex >= steps.length - 1;
  const launchDisabled = isLaunching || (isLastStep && !assistant.campaignName.trim());
  const footerActionBackground = launchDisabled
    ? appTheme.darkMode ? '#162448' : '#E5E7EB'
    : appTheme.darkMode ? '#1647A5' : '#0B1957';
  const footerActionForeground = launchDisabled
    ? appTheme.darkMode ? '#7890BE' : '#94A3B8'
    : '#FFFFFF';
  const wizardBody = (
    <>
      {currentKey === 'channels' ? renderChannelsStep() : null}
      {currentKey === 'trigger' ? renderTriggerStep() : null}
      {currentKey === 'duration' ? renderDurationStep() : null}
      {currentKey === 'name' ? renderNameStep() : null}
    </>
  );

  const sheetContent = (
        <View
          style={[
            presentation === 'inline' ? styles.inlineSheet : styles.sheet,
            {
              backgroundColor: appTheme.surface,
              borderColor: appTheme.border,
              marginTop: presentation === 'modal' ? Math.max(insets.top, 20) : 0,
              marginBottom: presentation === 'modal' ? Math.max(insets.bottom, 20) : 0,
            },
            style,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: appTheme.borderSoft }]}>
            <View style={styles.headerCopy}>
              <Typography variant="body" color={appTheme.text} style={styles.headerTitle}>Configure your campaign</Typography>
              <Typography variant="caption" color={appTheme.muted}>Step {currentIndex + 1} of {steps.length}</Typography>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={appTheme.muted} size={20} />
            </TouchableOpacity>
          </View>

          {presentation === 'inline' ? (
            <View style={[styles.bodyContent, styles.inlineBodyContent]}>{wizardBody}</View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
              {wizardBody}
            </ScrollView>
          )}

          <View style={[styles.footer, { backgroundColor: appTheme.surface, borderTopColor: appTheme.borderSoft }]}>
            <Typography variant="caption" color={appTheme.disabled} style={styles.footerStep}>{currentIndex + 1}/{steps.length}</Typography>
            <View style={styles.footerButtons}>
              <TouchableOpacity
                activeOpacity={0.78}
                style={[styles.footerBackBtn, { backgroundColor: appTheme.darkMode ? '#102A62' : '#FFFFFF', borderColor: appTheme.darkMode ? appTheme.primaryAccent : appTheme.border }]}
                onPress={goBack}
              >
                <ArrowLeft color={appTheme.darkMode ? '#DCE8FF' : '#0B1957'} size={17} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => void goNext()}
                disabled={launchDisabled}
                style={[styles.footerNextBtn, !isLastStep && styles.footerNextIconOnly, { backgroundColor: footerActionBackground }]}
              >
                {isLaunching ? <ActivityIndicator color={footerActionForeground} size="small" /> : (
                  isLastStep ? (
                    <>
                      <Typography variant="bodySmall" color={footerActionForeground} style={styles.footerNextText}>Launch Campaign</Typography>
                      <Rocket color={footerActionForeground} size={15} />
                    </>
                  ) : (
                    <ArrowRight color={footerActionForeground} size={18} />
                  )
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
  );

  if (presentation === 'inline') {
    return sheetContent;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      {/* behavior="padding" on BOTH platforms: Android edge-to-edge (forced by
          Expo SDK 54) disables adjustResize, so without this the campaign-name
          input hides behind the keyboard on device builds. */}
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        {sheetContent}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    flex: 1,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  inlineSheet: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerCopy: {
    gap: 2,
  },
  headerTitle: {
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Theme.spacing.lg,
    gap: 12,
  },
  inlineBodyContent: {
    flexGrow: 0,
  },
  stepBody: {
    gap: 12,
  },
  stepTitle: {
    fontWeight: '800',
    marginBottom: 2,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionHeaderText: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  actionHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  agentDealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#312E81',
    shadowColor: '#0B1957',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  agentDealText: {
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  channelPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  channelPillText: {
    fontWeight: '800',
  },
  channelChoicePanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  inlineAgentDealCard: {
    minHeight: 106,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#312E81',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    ...Theme.shadows.medium,
  },
  inlineAgentDealCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  inlineAgentDealTitle: {
    fontWeight: '900',
  },
  inlineAgentDealDesc: {
    lineHeight: 18,
    fontWeight: '600',
  },
  manualDivider: {
    textAlign: 'center',
    fontWeight: '700',
  },
  channelProgressCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  channelProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  channelProgressTitle: {
    fontWeight: '900',
  },
  channelStepBadge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  channelStepBadgeText: {
    fontWeight: '800',
  },
  channelProgressTrack: {
    height: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  channelProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  channelTileList: {
    gap: 8,
  },
  channelTile: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelTileCheck: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTileNumber: {
    fontWeight: '900',
  },
  channelTileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  channelTileTitle: {
    fontWeight: '900',
  },
  channelTileDesc: {
    lineHeight: 17,
  },
  linkedinCard: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  settingsTitle: {
    fontWeight: '800',
  },
  liActionsList: {
    gap: 8,
  },
  liActionStack: {
    gap: 0,
  },
  liActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  liActionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
  },
  liActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  liActionTitle: {
    fontWeight: '800',
  },
  liActionDesc: {
    marginTop: 1,
    lineHeight: 16,
  },
  messageEditor: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#3B82F6',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#F0F6FF',
    padding: 12,
    gap: 8,
  },
  messageEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  messageEditorLabel: {
    fontWeight: '800',
  },
  messageTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageToolBtn: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  messageToolText: {
    fontWeight: '800',
  },
  templatePanel: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF6FF',
  },
  templateRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  templateName: {
    fontWeight: '800',
    marginBottom: 2,
  },
  templateUseBtn: {
    backgroundColor: '#1E40AF',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  templateUseText: {
    fontWeight: '800',
  },
  templateEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
  },
  templateCreateBtn: {
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  templateCreateText: {
    fontWeight: '800',
  },
  messageTextArea: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  placeholderText: {
    flex: 1,
    lineHeight: 15,
  },
  charCount: {
    fontWeight: '800',
  },
  aiAtSendText: {
    fontWeight: '700',
    marginTop: -4,
  },
  aiGeneratePanel: {
    borderWidth: 1,
    borderColor: '#C2D6EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    padding: 10,
    gap: 8,
  },
  compactInput: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#FAFBFF',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segmentChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  segmentChipSelected: {
    borderColor: '#0B1957',
    backgroundColor: '#E8ECFA',
  },
  segmentText: {
    fontWeight: '700',
  },
  generateDraftBtn: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#0B1957',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  generateDraftText: {
    fontWeight: '800',
  },
  aiGenerateError: {
    lineHeight: 16,
  },
  aiPersoWrap: {
    marginTop: 6,
  },
  aiPersoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  aiPersoLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPersoCopy: {
    flex: 1,
    minWidth: 0,
  },
  aiPersoHeaderTitle: {
    fontWeight: '900',
  },
  aiPersoBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#C7D2FE',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#FCFCFF',
    padding: 13,
    gap: 16,
  },
  aiPersoGroup: {
    gap: 8,
  },
  aiPersoGroupTitle: {
    fontWeight: '900',
    letterSpacing: 0,
  },
  aiPersoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiPersoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPersoTitle: {
    fontWeight: '800',
  },
  aiPersoDesc: {
    lineHeight: 15,
    marginTop: 1,
  },
  switchTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 1,
  },
  switchThumbOn: {
    transform: [{ translateX: 16 }],
  },
  uniqueMessageNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    backgroundColor: '#FAF5FF',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  uniqueMessageText: {
    flex: 1,
    lineHeight: 17,
  },
  whichMessagesWrap: {
    marginLeft: 8,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#DDD6FE',
    gap: 8,
  },
  uncheckedHint: {
    paddingLeft: 2,
  },
  emailSettingsCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 10,
  },
  whatsappSettingsCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    padding: 14,
    gap: 10,
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  aiGenerateLink: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  aiGenerateText: {
    fontWeight: '900',
  },
  formGroup: {
    gap: 5,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fieldLabel: {
    fontWeight: '800',
  },
  requiredMark: {
    fontWeight: '900',
  },
  selectControl: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectIconWrap: {
    width: 16,
    alignItems: 'center',
  },
  selectValue: {
    flex: 1,
    minWidth: 0,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emailTextArea: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 138,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  whatsappTextArea: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  saveTemplateDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveTemplateForm: {
    gap: 8,
  },
  saveTemplateNameInput: {
    minHeight: 38,
  },
  saveTemplateButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  templatePrimaryBtn: {
    minHeight: 36,
    minWidth: 70,
    borderRadius: 8,
    backgroundColor: '#0B1957',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  templateSecondaryBtn: {
    minHeight: 36,
    minWidth: 78,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  templateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  templateBrowseBtn: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  templateBrowseText: {
    fontWeight: '900',
  },
  selectedWaTemplateBadge: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  selectedWaTemplateName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '900',
  },
  channelTypeBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  channelTypeText: {
    fontWeight: '900',
    fontSize: 10,
  },
  waTemplatePanel: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  waTemplateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  templateNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  defaultBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  defaultBadgeText: {
    fontWeight: '900',
    fontSize: 9,
  },
  delayCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 10,
  },
  delayGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  delayField: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  delayInput: {
    minHeight: 38,
    paddingVertical: 8,
  },
  pickerPopup: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '74%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerList: {
    padding: 14,
    gap: 8,
  },
  pickerOption: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  pickerOptionTitle: {
    fontWeight: '800',
  },
  channelSettingsCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  accountChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 170,
  },
  voiceSettingsCard: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  voiceSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  voiceEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceSavedRows: {
    gap: 10,
  },
  voiceSavedGroup: {
    gap: 6,
  },
  voiceSavedLabel: {
    fontWeight: '800',
  },
  voiceSavedValueBox: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceSavedValue: {
    flex: 1,
    minWidth: 0,
  },
  voiceSelectText: {
    fontWeight: '900',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  voicePopup: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '82%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  voicePopupHeader: {
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  voicePopupScroll: {
    flexGrow: 0,
  },
  voicePopupBody: {
    padding: 16,
    gap: 16,
  },
  voicePickerGroup: {
    gap: 8,
  },
  voicePickerLabel: {
    fontWeight: '900',
  },
  voicePickerOption: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voicePickerOptionText: {
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
  },
  voicePopupSaveBtn: {
    minHeight: 46,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: '#0B1957',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  questionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  sequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  sequenceChip: {
    backgroundColor: '#E8ECFA',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  sequenceChipDark: {
    backgroundColor: '#E8EEFF',
  },
  sequenceText: {
    fontWeight: '800',
  },
  sequenceArrow: {
    fontWeight: '800',
  },
  numberedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    fontWeight: '900',
  },
  numberedCopy: {
    flex: 1,
    minWidth: 0,
  },
  numberedTitle: {
    fontWeight: '900',
  },
  numberedDesc: {
    marginTop: 3,
    lineHeight: 16,
  },
  customDaysInput: {
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#E0EAF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: '#FAFBFF',
  },
  suggestBtn: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: '#0B1957',
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#FFFFFF',
  },
  suggestText: {
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: Theme.spacing.md,
    borderTopWidth: 1,
  },
  footerStep: {
    minWidth: 44,
    fontWeight: '900',
  },
  footerButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  footerBackBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  footerNextBtn: {
    minHeight: 42,
    minWidth: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 18,
  },
  footerNextIconOnly: {
    width: 42,
    minWidth: 42,
    paddingHorizontal: 0,
  },
  footerNextText: {
    fontWeight: '900',
  },
  footerDisabled: {
    backgroundColor: '#E5E7EB',
  },
  disabled: {
    opacity: 0.6,
  },
});
