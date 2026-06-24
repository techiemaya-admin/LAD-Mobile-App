import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  BackHandler,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Keyboard,
} from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  CreditCard,
  Download,
  Globe,
  Heart,
  FileText,
  Image as ImageIcon,
  Info,
  Link2,
  List as ListIcon,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MinusCircle,
  MoreVertical,
  Music,
  Paperclip,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldOff,
  Smile,
  Star,
  Tag,
  Target,
  ThumbsDown,
  Trash2,
  Upload,
  UserRound,
  Users,
  Video,
  VolumeX,
  X,
  Mic,
  PlayCircle,
  PauseCircle,
  StopCircle,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { setBottomTabHidden, useBottomTabScrollHandler, forceBottomTabHidden } from '@/components/ui/BottomTabSelector';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { SkeletonConversationRow, SkeletonMessageBlock } from '@/components/ui/SkeletonLoader';
import { LadLogoMark } from '@/components/ui/LadLogoMark';
import { ChatChannel, ChatMessage, Conversation, useChatStore } from '@/src/store/chatStore';
import { RESOLVED_API_URL, apiDelete, apiPatch, apiPost, buildApiUrl, getAuthToken, safeStorage } from '@/src/api';
import useAuthStore from '@/src/store/authStore';
import {
  assignConversationHandler,
  assignConversationToTeamMember,
  createConversationNote,
  deleteConversationNote,
  getConversationAssignment,
  getConversationNotes,
  getConversationTeamWorkload,
  getMindBodyPaymentLink,
  sendMindBodyPaymentLinkMessage,
  unassignConversationFromTeamMember,
  updateConversationNote,
  verifyMindBodyPayment,
  type ConversationAssignmentHistory,
  type ConversationNote,
  type ConversationTeamMember,
  type MindBodyPaymentLink,
  type MindBodyPaymentVerification,
} from '@/src/services/conversationService';
import { useAppTheme } from '@/src/theme/appTheme';
import Reanimated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Audio } from 'expo-av';

const CHAT_LIGHT_BACKGROUND_IMAGE = require('../../../assets/images/whatsappbg-tiled.jpeg');
const CHAT_DARK_BACKGROUND_IMAGE = require('../../../assets/images/chat-dark-bg.jpeg');
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

type ChannelFilterId = 'all' | 'unread' | ChatChannel | 'personal' | 'waba';
const CHANNELS: { id: ChannelFilterId; label: string; color: string }[] = [
  { id: 'all', label: 'All', color: Theme.colors.primary },
  { id: 'unread', label: 'Unread', color: '#15803D' },
  { id: 'personal', label: 'Personal WA', color: '#25D366' },
  { id: 'waba', label: 'WA Business', color: '#128C7E' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'email', label: 'Email', color: Theme.colors.primary },
];

const ATTACHMENT_ACTIONS: {
  id: AttachmentAction;
  label: string;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  color: string;
}[] = [
  { id: 'photos', label: 'Photos & Video', icon: ImageIcon, color: '#A83CF0' },
  { id: 'camera', label: 'Camera', icon: Camera, color: '#F2338A' },
  { id: 'document', label: 'Document', icon: FileText, color: '#2F83FF' },
  { id: 'audio', label: 'Audio', icon: Music, color: '#FF6908' },
  { id: 'location', label: 'Location', icon: MapPin, color: '#05C866' },
  { id: 'contact', label: 'Contact', icon: Phone, color: '#14B8A6' },
  { id: 'poll', label: 'Poll', icon: BarChart3, color: '#4F7CFF' },
  { id: 'template', label: 'Template', icon: FileText, color: '#0A66C2' },
  { id: 'event', label: 'Event', icon: Calendar, color: '#6655F6' },
];

const getChannelIcon = (channel: ChatChannel) => {
  switch (channel) {
    case 'whatsapp':
      return MessageCircle;
    case 'linkedin':
      return Users;
    case 'email':
    case 'gmail':
      return Mail;
    default:
      return MessageSquare;
  }
};

const getChannelBadgeSurface = (channel: ChatChannel) => {
  switch (channel) {
    case 'whatsapp':
      return '#E9FBEF';
    case 'linkedin':
      return '#E8F2FF';
    case 'gmail':
    case 'email':
      return '#FFF1F0';
    default:
      return '#F1F5F9';
  }
};

const getChannelColor = (channel: ChatChannel) => {
  switch (channel) {
    case 'whatsapp':
      return '#25D366';
    case 'linkedin':
      return '#0077B5';
    case 'email':
    case 'gmail':
      return Theme.colors.primary;
    case 'instagram':
      return '#E1306C';
    default:
      return Theme.colors.textSecondary;
  }
};

type ChatTemplate = {
  id: string;
  name: string;
  body: string;
  category?: string;
  channel: ChatChannel;
  language?: string;
};

const FALLBACK_TEMPLATES: Record<string, ChatTemplate[]> = {
  whatsapp: [
    {
      id: 'whatsapp-followup',
      name: 'WhatsApp Follow-up',
      body: 'Hi {{name}}, following up on our conversation. Please let me know a good time to connect.',
      category: 'Follow-up',
      channel: 'whatsapp',
      language: 'en',
    },
    {
      id: 'whatsapp-support',
      name: 'Support Reply',
      body: 'Hi {{name}}, thanks for reaching out. I am checking this and will update you shortly.',
      category: 'Support',
      channel: 'whatsapp',
      language: 'en',
    },
  ],
  linkedin: [
    {
      id: 'linkedin-intro',
      name: 'LinkedIn Intro',
      body: 'Hi {{first_name}}, thanks for connecting. I noticed your work at {{company}} and would love to exchange ideas.',
      category: 'Intro',
      channel: 'linkedin',
      language: 'en',
    },
  ],
  email: [
    {
      id: 'email-followup',
      name: 'Email Follow-up',
      body: 'Hi {{name}},\n\nFollowing up on my previous message. Please let me know if this is still relevant for your team.\n\nBest regards,',
      category: 'Follow-up',
      channel: 'email',
      language: 'en',
    },
  ],
  instagram: [
    {
      id: 'instagram-quick-reply',
      name: 'Instagram Quick Reply',
      body: 'Hi {{name}}, thanks for your message. I will share the details with you shortly.',
      category: 'DM',
      channel: 'instagram',
      language: 'en',
    },
  ],
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const getTemplateEndpoint = (channel: ChatChannel) => {
  if (channel === 'whatsapp') {
    return '/api/whatsapp-conversations/conversations/templates?channel=waba';
  }

  if (channel === 'linkedin') {
    return '/api/campaigns/linkedin-message-templates';
  }

  if (channel === 'email' || channel === 'gmail') {
    return '/api/campaigns/email-templates';
  }

  return null;
};

const normalizeTemplate = (item: Record<string, any>, channel: ChatChannel, index: number): ChatTemplate | null => {
  const rawBody =
    item.message_text ??
    item.followup_message ??
    item.connection_message ??
    item.body ??
    item.content ??
    item.html_content ??
    item.plain_text ??
    item.description ??
    '';
  const body = stripHtml(String(rawBody));

  if (!body) {
    return null;
  }

  return {
    id: String(item.id ?? item._id ?? item.name ?? `${channel}-template-${index}`),
    name: String(item.name ?? item.title ?? item.template_name ?? `Template ${index + 1}`),
    body,
    category: item.category ? String(item.category) : item.metadata?.channel_type ? String(item.metadata.channel_type) : undefined,
    channel,
    language: item.language ?? item.language_code ?? item.metadata?.language_code ? String(item.language ?? item.language_code ?? item.metadata?.language_code) : undefined,
  };
};

const getFallbackTemplates = (channel: ChatChannel) => {
  if (channel === 'gmail') {
    return FALLBACK_TEMPLATES.email;
  }

  return FALLBACK_TEMPLATES[channel] ?? [];
};
const WhatsAppIcon = ({ size = 14, color = '#25D366' }: { size?: number; color?: string }) => (
  <FontAwesome5 name="whatsapp" size={size} color={color} />
);

const ChannelGlyph = ({ channel, size = 14, color }: { channel: ChatChannel; size?: number; color?: string }) => {
  if (channel === 'whatsapp') {
    return <WhatsAppIcon size={size} color={color ?? '#25D366'} />;
  }

  if (channel === 'linkedin') {
    return <FontAwesome5 name="linkedin-in" size={size} color={color ?? '#0077B5'} />;
  }

  if (channel === 'gmail') {
    return <FontAwesome5 name="google" size={size} color={color ?? '#EA4335'} />;
  }

  if (channel === 'instagram') {
    return <FontAwesome5 name="instagram" size={size} color={color ?? '#E1306C'} />;
  }

  const Icon = getChannelIcon(channel);
  return <Icon color={color ?? getChannelColor(channel)} size={size} />;
};

const AIAgentIcon = ({
  color = Theme.colors.primary,
  size = 22,
  backgroundColor,
}: {
  color?: string;
  size?: number;
  backgroundColor?: string;
}) => (
  <View style={[styles.aiAgentIcon, backgroundColor ? { backgroundColor } : null]}>
    <LadLogoMark color={color} size={size} />
  </View>
);

type ChatCreateActionId = 'new_chat' | 'import_leads' | 'broadcast';

const CHAT_CREATE_ACTIONS: {
  id: ChatCreateActionId;
  label: string;
  description: string;
  accent: string;
  icon: typeof MessageSquare;
}[] = [
  {
    id: 'new_chat',
    label: 'New chat',
    description: 'Search synced backend contacts',
    accent: '#10B981',
    icon: MessageSquare,
  },
  {
    id: 'import_leads',
    label: 'Import leads',
    description: 'CSV, Excel, images, PDFs',
    accent: '#22C55E',
    icon: Upload,
  },
  {
    id: 'broadcast',
    label: 'New broadcast',
    description: 'Select contacts for outreach',
    accent: '#F59E0B',
    icon: Send,
  },
];

const isEmailChannel = (channel: ChatChannel) => channel === 'email' || channel === 'gmail';
const isLinkedInChannel = (channel: ChatChannel) => channel === 'linkedin';
const isWhatsAppChannel = (channel: ChatChannel) => channel === 'whatsapp';
const isInstagramChannel = (channel: ChatChannel) => channel === 'instagram';
const getChannelLabel = (channel: ChatChannel) => {
  if (channel === 'gmail' || channel === 'email') {
    return 'Email';
  }

  if (channel === 'whatsapp') {
    return 'WhatsApp';
  }

  if (channel === 'linkedin') {
    return 'LinkedIn';
  }

  if (channel === 'instagram') {
    return 'Instagram';
  }

  return 'Live conversation';
};

const getConversationSearchLabel = (conversation: Conversation) =>
  [
    conversation.name,
    conversation.phone,
    conversation.email,
    conversation.company,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const sortNewestConversations = (items: Conversation[]) =>
  [...items].sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));

const WHATSAPP_CONTACT_CHANNEL = 'personal';

const withWhatsAppContactChannel = (path: string) =>
  `${path}${path.includes('?') ? '&' : '?'}channel=${WHATSAPP_CONTACT_CHANNEL}`;

const getActionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const postJsonToBackend = async (path: string, body: Record<string, unknown>) => {
  const token = await getAuthToken();
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || (payload && typeof payload === 'object' && 'success' in payload && !payload.success)) {
    const message =
      payload && typeof payload === 'object' && ('error' in payload || 'message' in payload)
        ? String((payload as { error?: unknown; message?: unknown }).error || (payload as { message?: unknown }).message)
        : `Backend request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
};

const patchWhatsAppConversationAction = async (
  conversationId: string,
  action: 'favorite' | 'pin' | 'lock' | 'status',
  body?: Record<string, unknown>,
) => {
  const path = withWhatsAppContactChannel(
    `/api/whatsapp-conversations/conversations/${encodeURIComponent(conversationId)}/${action}`,
  );
  return apiPatch(path, body);
};

const deleteWhatsAppConversationFromBackend = async (conversationId: string) =>
  apiDelete(withWhatsAppContactChannel(`/api/whatsapp-conversations/conversations/${encodeURIComponent(conversationId)}`));

const getChannelSurface = (channel: ChatChannel) => {
  switch (channel) {
    case 'whatsapp':
      return {
        screen: '#ECE5DD',
        incoming: '#FFFFFF',
        outgoing: '#D9FDD3',
        outgoingText: '#111827',
        border: '#CFE8C8',
        composer: '#F0F2F5',
      };
    case 'linkedin':
      return {
        screen: '#F3F6F8',
        incoming: '#FFFFFF',
        outgoing: '#0A66C2',
        outgoingText: '#FFFFFF',
        border: '#D8E4EF',
        composer: '#FFFFFF',
      };
    case 'email':
    case 'gmail':
      return {
        screen: '#F8FAFC',
        incoming: '#FFFFFF',
        outgoing: '#E8F0FE',
        outgoingText: Theme.colors.text,
        border: '#D9E2EF',
        composer: '#FFFFFF',
      };
    default:
      return {
        screen: Theme.colors.background,
        incoming: Theme.colors.surface,
        outgoing: Theme.colors.primary,
        outgoingText: Theme.colors.surface,
        border: Theme.colors.border,
        composer: Theme.colors.surface,
      };
  }
};

const formatTime = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatDateChip = (value?: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDateKey = (value?: string) => {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toDateString();
};

const parseStoredIdSet = (value: string | null) => {
  if (!value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
};

const saveIdSet = (key: string, values: Set<string>) => {
  void safeStorage.setItem(key, JSON.stringify(Array.from(values)));
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

type ChatMediaKind = 'media' | 'doc' | 'link';
type ChatMediaItem = {
  id: string;
  kind: ChatMediaKind;
  url: string;
  title: string;
  createdAt: string;
  messageId: string;
  mediaType?: string;
  caption?: string;
};

type WhatsAppBusinessProfile = {
  company_name?: string | null;
  industry?: string | null;
  designation?: string | null;
  services_offered?: string | null;
  ideal_customer_profile?: string | null;
  email?: string | null;
  website_url?: string | null;
  website_about?: string | null;
  website_clients?: string | null;
  website_services?: string | null;
  icp_top_clients?: string | null;
  icp_decision_maker?: string | null;
  icp_ideal_referrals?: string | null;
  icp_extra?: string | null;
  kpi_members_met?: number | null;
  kpi_referrals_given?: number | null;
  kpi_referrals_received?: number | null;
  kpi_one_to_ones?: number | null;
  kpi_visitors_invited?: number | null;
};

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+/gi;

const sanitizeUrl = (value: string) => value.replace(/[),.]+$/g, '');

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getBackendMediaUrl = (mediaId: string) =>
  mediaId.startsWith('http')
    ? mediaId
    : buildApiUrl(`/api/whatsapp-conversations/conversations/media/${mediaId}`, RESOLVED_API_URL);

const isVideoMediaItem = (item: ChatMediaItem) =>
  item.mediaType === 'video' || item.mediaType?.startsWith('video/');

const normalizeBusinessProfile = (payload: unknown): WhatsAppBusinessProfile | null => {
  if (!isPlainRecord(payload)) {
    return null;
  }

  const record = isPlainRecord(payload.data)
    ? payload.data
    : isPlainRecord(payload.profile)
      ? payload.profile
      : payload;
  const hasProfileValue = Object.values(record).some((value) => value !== null && value !== undefined && String(value).trim() !== '');

  return hasProfileValue ? record as WhatsAppBusinessProfile : null;
};

const fetchWhatsAppBusinessProfile = async (conversationId: string) => {
  const token = await getAuthToken();
  const response = await fetch(
    buildApiUrl(`/api/whatsapp-conversations/conversations/${encodeURIComponent(conversationId)}/business-profile?channel=personal`, RESOLVED_API_URL),
    {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Business profile request failed (${response.status})`);
  }

  return normalizeBusinessProfile(await response.json());
};

const ensureUrlProtocol = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

const getMediaItemsFromMessages = (messages: ChatMessage[]) => {
  const seen = new Set<string>();
  const pushUnique = (items: ChatMediaItem[], item: ChatMediaItem) => {
    const key = `${item.kind}:${item.url || item.id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push(item);
  };

  const items: ChatMediaItem[] = [];

  messages.forEach((message) => {
    message.attachments?.forEach((attachment, index) => {
      const kind: ChatMediaKind = attachment.type === 'image' || attachment.type === 'video' ? 'media' : 'doc';
      pushUnique(items, {
        id: `${message.id}-attachment-${attachment.id || index}`,
        kind,
        url: attachment.url,
        title: attachment.name || (kind === 'media' ? 'Media' : 'Document'),
        createdAt: message.createdAt,
        messageId: message.id,
        mediaType: attachment.type,
        caption: message.mediaCaption || message.content,
      });
    });

    if (message.mediaId) {
      const mediaType = message.mediaType || message.mediaMimeType || 'document';
      const isMedia = mediaType === 'image' || mediaType === 'video' || mediaType.startsWith('image/') || mediaType.startsWith('video/');
      pushUnique(items, {
        id: `${message.id}-media-${message.mediaId}`,
        kind: isMedia ? 'media' : 'doc',
        url: getBackendMediaUrl(message.mediaId),
        title: message.mediaFilename || message.mediaCaption || (isMedia ? 'Media' : 'Document'),
        createdAt: message.createdAt,
        messageId: message.id,
        mediaType,
        caption: message.mediaCaption || (message.content === message.mediaId ? undefined : message.content),
      });
    }

    const links = message.content.match(URL_PATTERN) ?? [];
    links.forEach((rawLink, index) => {
      const url = sanitizeUrl(rawLink);
      if (message.mediaId && url === message.mediaId) {
        return;
      }

      pushUnique(items, {
        id: `${message.id}-link-${index}`,
        kind: 'link',
        url,
        title: url.replace(/^https?:\/\//i, ''),
        createdAt: message.createdAt,
        messageId: message.id,
      });
    });
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

const MessageStatusIcon = ({ message }: { message: ChatMessage }) => {
  const appTheme = useAppTheme();

  if (message.sender !== 'agent') {
    return null;
  }

  if (message.status === 'read' || message.status === 'delivered') {
    return <CheckCheck color={message.status === 'read' ? Theme.colors.info : appTheme.disabled} size={14} />;
  }

  if (message.status === 'sent' || message.status === 'sending') {
    return <Check color={appTheme.disabled} size={14} />;
  }

  return (
    <Typography variant="caption" color={Theme.colors.error}>
      Failed
    </Typography>
  );
};

const ConversationRow = memo(({
  conversation,
  isActive,
  onPress,
}: {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();
  const baseChannelColor = getChannelColor(conversation.channel);
  const waBackendChannel = conversation.channel === 'whatsapp' ? conversation.waBackendChannel : undefined;
  const channelColor = waBackendChannel === 'waba' ? '#128C7E' : baseChannelColor;
  const channelLabel = waBackendChannel === 'personal'
    ? 'Personal WA'
    : waBackendChannel === 'waba'
      ? 'WA Business'
      : getChannelLabel(conversation.channel);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.conversationRow,
        {
          backgroundColor: appTheme.surface,
          borderColor: isActive ? appTheme.primaryAccent : appTheme.borderSoft,
          shadowColor: appTheme.darkMode ? '#000000' : '#0B1957',
        },
        isActive && [styles.conversationRowActive, { backgroundColor: appTheme.infoSoft }],
      ]}
    >
      <View style={[styles.conversationAccent, { backgroundColor: channelColor }]} />
      <View style={styles.avatarWrap}>
        <Avatar src={conversation.avatar} fallback={getInitials(conversation.name)} size="md" />
        <View style={[styles.channelDot, { backgroundColor: getChannelBadgeSurface(conversation.channel) }]}>
          <ChannelGlyph channel={conversation.channel} color={channelColor} size={10} />
        </View>
        {conversation.online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.conversationBody}>
        <View style={styles.conversationTopLine}>
          <Typography variant="h4" numberOfLines={1} style={[styles.conversationName, { color: appTheme.text }]}>
            {conversation.name}
          </Typography>
          <View style={[styles.timePill, { backgroundColor: appTheme.softSurface }]}>
            <Typography variant="caption" color={appTheme.muted} style={styles.timeText}>
              {formatTime(conversation.lastMessageAt)}
            </Typography>
          </View>
        </View>

        <View style={styles.conversationBottomLine}>
          <Typography variant="bodySmall" numberOfLines={1} style={[styles.previewText, { color: appTheme.muted }]}>
            {conversation.lastMessage}
          </Typography>
          {conversation.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Typography variant="caption" color={Theme.colors.surface} style={styles.unreadText}>
                {conversation.unreadCount}
              </Typography>
            </View>
          )}
        </View>

        <View style={styles.conversationMetaLine}>
          <View style={[styles.channelPill, { backgroundColor: `${channelColor}16`, borderColor: `${channelColor}32` }]}>
            <ChannelGlyph channel={conversation.channel} color={channelColor} size={10} />
            <Typography variant="caption" style={[styles.channelPillText, { color: channelColor }]} numberOfLines={1}>
              {channelLabel}
            </Typography>
          </View>
          {conversation.company ? (
            <Typography variant="caption" color={appTheme.disabled} numberOfLines={1} style={styles.companyText}>
              {conversation.company}
            </Typography>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

ConversationRow.displayName = 'ConversationRow';
const MessageBubble = memo(({
  message,
  channel,
  contactName,
  contactAvatar,
  authToken,
  onPlayAudio,
  isCurrentlyPlaying,
}: {
  message: ChatMessage;
  channel: ChatChannel;
  contactName: string;
  contactAvatar?: string;
  authToken?: string | null;
  onPlayAudio?: (id: string, url: string) => void;
  isCurrentlyPlaying?: boolean;
}) => {
  const appTheme = useAppTheme();
  const isAgent = message.sender === 'agent';
  const basePalette = getChannelSurface(channel);
  const isEmail = isEmailChannel(channel);
  const isLinkedIn = isLinkedInChannel(channel);
  const palette = appTheme.darkMode
    ? {
        ...basePalette,
        incoming: appTheme.surface,
        outgoing: channel === 'whatsapp' ? '#14532D' : isLinkedIn ? '#0A66C2' : appTheme.softSurface,
        outgoingText: '#F8FAFC',
        border: appTheme.border,
      }
    : basePalette;
  const leadTextColor = appTheme.darkMode ? '#F8FAFC' : appTheme.text;
  const leadInitials = getInitials(message.senderName || contactName || 'L');
  const agentInitials = 'A';
  const emailMetaLabel = isAgent ? `To: ${contactName || 'Recipient'}` : `From: ${message.senderName || contactName || 'Sender'}`;

  // Detect special message types
  const isLocationMessage = message.content?.startsWith('Location shared');
  const locationLines = isLocationMessage ? message.content.split('\n') : [];
  const locationName = locationLines[1] || 'Location';
  const locationLink = locationLines[2] || '';

  // Check if content is just the media identifier
  const isContentMediaRef = message.mediaId && (
    message.content === message.mediaId ||
    message.content.includes(message.mediaId) ||
    (message.content.startsWith('http') && message.content === message.mediaId)
  );

  const displayCaption = message.mediaCaption || (!isContentMediaRef ? message.content : '');

  // Split attachments by type
  const imageAttachments = message.attachments?.filter((a) => a.type === 'image' || a.type === 'video') ?? [];
  const docAttachments = message.attachments?.filter((a) => a.type === 'document') ?? [];

  // Media info from direct backend response format
  const hasMediaId = !!message.mediaId;
  const isImageMedia = hasMediaId && (message.mediaType === 'image' || (message.mediaMimeType?.startsWith('image/') ?? false));
  const isVideoMedia = hasMediaId && (message.mediaType === 'video' || (message.mediaMimeType?.startsWith('video/') ?? false));
  const isAudioMedia = hasMediaId && (message.mediaType === 'audio' || (message.mediaMimeType?.startsWith('audio/') ?? false));
  const isDocumentMedia = hasMediaId && !isImageMedia && !isVideoMedia && !isAudioMedia;
  const mediaUrl = hasMediaId ? (
    message.mediaId!.startsWith('http')
      ? message.mediaId!
      : buildApiUrl(`/api/whatsapp-conversations/conversations/media/${message.mediaId}`)
  ) : null;

  const hasOnlyMedia = (imageAttachments.length > 0 || isImageMedia || isVideoMedia) && !displayCaption && docAttachments.length === 0 && !isDocumentMedia;

  return (
    <View
      style={[
        styles.messageRow,
        isAgent ? styles.messageRowAgent : styles.messageRowLead,
        isEmail && styles.emailMessageRow,
        isLinkedIn && styles.linkedinMessageRow,
      ]}
    >
      {!isAgent && !isEmail && (
        <Avatar
          src={contactAvatar}
          fallback={leadInitials || '?'}
          size={28}
          style={isLinkedIn ? { ...styles.messageAvatarImg, ...styles.linkedinAvatar } : styles.messageAvatarImg}
          authToken={authToken}
        />
      )}
      <View
        style={[
          styles.messageBubble,
          isEmail && styles.emailBubble,
          isLinkedIn && styles.linkedinBubble,
          isAgent ? styles.messageBubbleAgent : styles.messageBubbleLead,
          isEmail && (isAgent ? styles.emailBubbleSent : styles.emailBubbleReceived),
          isLinkedIn && (isAgent ? styles.linkedinBubbleSent : styles.linkedinBubbleReceived),
          hasOnlyMedia && styles.mediaBubble,
          {
            backgroundColor: isAgent ? palette.outgoing : palette.incoming,
            borderColor: palette.border,
          },
        ]}
      >
        {isEmail && (
          <View style={styles.emailCardHeader}>
            <View style={styles.emailSenderAvatar}>
              <Typography variant="caption" color="#B42318" style={styles.messageAvatarText}>
                {isAgent ? agentInitials : (leadInitials || 'M')}
              </Typography>
            </View>
            <View style={styles.emailHeaderText}>
              <Typography variant="bodySmall" color={appTheme.text} style={styles.emailSubject} numberOfLines={1}>
                {isAgent ? 'Sent reply' : 'Incoming email'}
              </Typography>
              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                {emailMetaLabel}
              </Typography>
            </View>
          </View>
        )}
        {isLinkedIn && !isAgent && (
          <Typography variant="caption" color={appTheme.darkMode ? appTheme.muted : '#5E6A75'} style={styles.linkedinSenderName} numberOfLines={1}>
            {message.senderName || contactName}
          </Typography>
        )}
        {/* Image attachments */}
        {imageAttachments.map((attachment) => (
          <TouchableOpacity
            key={attachment.id}
            activeOpacity={0.88}
            onPress={() => attachment.url && void Linking.openURL(attachment.url)}
          >
            <Image
              source={{
                uri: attachment.url,
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
              }}
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}

        {/* MediaId image/video */}
        {(isImageMedia || isVideoMedia) && mediaUrl && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => void Linking.openURL(mediaUrl)}
          >
            <Image
              source={{
                uri: mediaUrl,
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
              }}
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Location card */}
        {isLocationMessage ? (
          <TouchableOpacity
            style={[styles.locationCard, { borderColor: isAgent ? 'rgba(255,255,255,0.24)' : appTheme.border }]}
            activeOpacity={0.82}
            onPress={() => locationLink && void Linking.openURL(locationLink)}
          >
            <View style={styles.locationCardIcon}>
              <MapPin color="#05C866" size={20} />
            </View>
            <View style={styles.locationCardText}>
              <Typography variant="bodySmall" color={isAgent ? palette.outgoingText : leadTextColor} style={{ fontWeight: '500' }} numberOfLines={1}>
                {locationName}
              </Typography>
              {locationLink ? (
                <Typography variant="caption" color={isAgent ? 'rgba(255,255,255,0.65)' : '#2563EB'} numberOfLines={1}>
                  Tap to open map
                </Typography>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : (
          !hasOnlyMedia && displayCaption ? (
            <Typography
              variant="body"
              color={isAgent ? palette.outgoingText : leadTextColor}
              style={[styles.messageText, isEmail && styles.emailMessageText]}
            >
              {displayCaption}
            </Typography>
          ) : null
        )}

        {/* Document attachments */}
        {docAttachments.map((attachment) => (
          <TouchableOpacity
            key={attachment.id}
            style={[styles.docCard, { borderColor: isAgent ? 'rgba(255,255,255,0.22)' : appTheme.border, backgroundColor: isAgent ? 'rgba(0,0,0,0.12)' : appTheme.softSurface }]}
            activeOpacity={0.82}
            onPress={() => attachment.url && void Linking.openURL(attachment.url)}
          >
            <FileText color="#2F83FF" size={20} />
            <Typography variant="caption" color={isAgent ? palette.outgoingText : leadTextColor} numberOfLines={1} style={styles.docCardName}>
              {attachment.name}
            </Typography>
            <Download color={isAgent ? 'rgba(255,255,255,0.7)' : appTheme.muted} size={16} />
          </TouchableOpacity>
        ))}

        {/* MediaId document */}
        {isAudioMedia && mediaUrl && (
          <TouchableOpacity
            style={[styles.audioCard, { borderColor: isAgent ? 'rgba(255,255,255,0.22)' : appTheme.border, backgroundColor: isAgent ? 'rgba(0,0,0,0.12)' : appTheme.softSurface }]}
            activeOpacity={0.82}
            onPress={() => onPlayAudio ? onPlayAudio(message.id, mediaUrl) : void Linking.openURL(mediaUrl)}
          >
            {isCurrentlyPlaying ? (
              <PauseCircle color="#FF6908" size={28} />
            ) : (
              <PlayCircle color="#FF6908" size={28} />
            )}
            <View style={styles.audioCardContent}>
              <Typography variant="caption" color={isAgent ? palette.outgoingText : leadTextColor} numberOfLines={1} style={styles.audioCardName}>
                {message.mediaFilename || 'Voice message'}
              </Typography>
              <View style={styles.audioWaveformRow}>
                {[4, 6, 8, 5, 9, 7, 6, 8, 4, 7, 5, 8, 6, 9, 5, 7, 4, 6, 8, 5].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.audioWaveBar,
                      { height: h * 2, backgroundColor: isCurrentlyPlaying ? '#FF6908' : (isAgent ? 'rgba(255,255,255,0.5)' : appTheme.disabled) },
                    ]}
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {isDocumentMedia && mediaUrl && (
          <TouchableOpacity
            style={[styles.docCard, { borderColor: isAgent ? 'rgba(255,255,255,0.22)' : appTheme.border, backgroundColor: isAgent ? 'rgba(0,0,0,0.12)' : appTheme.softSurface }]}
            activeOpacity={0.82}
            onPress={() => void Linking.openURL(mediaUrl)}
          >
            <FileText color="#2F83FF" size={20} />
            <Typography variant="caption" color={isAgent ? palette.outgoingText : leadTextColor} numberOfLines={1} style={styles.docCardName}>
              {message.mediaFilename || 'Document'}
            </Typography>
            <Download color={isAgent ? 'rgba(255,255,255,0.7)' : appTheme.muted} size={16} />
          </TouchableOpacity>
        )}

        <View style={[styles.messageMeta, isEmail && styles.emailMessageMeta]}>
          <Typography
            variant="caption"
            color={isAgent && palette.outgoingText === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : appTheme.disabled}
          >
            {formatTime(message.createdAt)}
          </Typography>
          <MessageStatusIcon message={message} />
        </View>
      </View>
      {isAgent && !isEmail && (
        <Avatar
          fallback={agentInitials}
          size={28}
          style={isLinkedIn ? { ...styles.messageAvatarImg, ...styles.linkedinAgentAvatar } : styles.messageAvatarImg}
          authToken={authToken}
        />
      )}
    </View>
  );
});

MessageBubble.displayName = 'MessageBubble';

type AgentMode = 'ai' | 'human';
const getAgentModeFromConversation = (conversation?: Conversation | null): AgentMode => {
  const owner = `${conversation?.ownerType ?? ''} ${conversation?.owner ?? ''}`;
  return /human_agent|human/i.test(owner) ? 'human' : 'ai';
};

const confirmHumanTakeover = () => new Promise<boolean>((resolve) => {
  const title = 'Take over this chat?';
  const message = 'This will pause the AI agent and give you manual control until you switch back.';

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    resolve(window.confirm(`${title}\n\n${message}`));
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Take Over', style: 'default', onPress: () => resolve(true) },
  ]);
});

type AttachmentAction = 'photos' | 'camera' | 'document' | 'audio' | 'location' | 'contact' | 'poll' | 'template' | 'event';
type QuickComposerAction = 'location' | 'contact' | 'poll' | 'event';
type QuickComposerDraft = {
  locationName: string;
  locationLink: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  pollQuestion: string;
  pollOptions: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
};
type MessageListItem =
  | { type: 'message'; id: string; message: ChatMessage }
  | { type: 'date'; id: string; label: string };

type MenuAction =
  | 'star'
  | 'pin'
  | 'resolve'
  | 'mute'
  | 'lock'
  | 'export'
  | 'block'
  | 'delete';

const EMPTY_QUICK_DRAFT: QuickComposerDraft = {
  locationName: '',
  locationLink: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  pollQuestion: '',
  pollOptions: 'Yes\nNo',
  eventTitle: '',
  eventDate: '',
  eventLocation: '',
};

const EMOJI_OPTIONS = ['👍', '🙏', '😊', '✅', '❤️', '🎉', '📞', '📍', '💬', '🔥', '⭐', '🙌'];

type EmojiCategoryDef = { id: string; label: string; icon: string; emojis: string[] };
const EMOJI_CATEGORIES: EmojiCategoryDef[] = [
  {
    id: 'smileys', label: 'Smileys & People', icon: '😊',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬',
      '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸',
      '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
      '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','👃',
    ],
  },
  {
    id: 'animals', label: 'Animals & Nature', icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊',
      '🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜',
      '🦟','🦗','🦂','🐢','🐍','🦎','🦕','🦖','🦏','🦛','🐘','🦒','🦘','🐃','🐂','🐄','🐎','🐖',
      '🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐈‍⬛','🐓','🦃','🦚','🦜','🦢','🦩','🕊️',
      '🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴',
      '🌱','🌿','☘️','🍀','🎍','🎋','🍃','🍂','🍁','🍄','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻',
      '🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌟','⭐','🌠','☁️','⛅',
    ],
  },
  {
    id: 'food', label: 'Food & Drink', icon: '🍔',
    emojis: [
      '🍏','🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑',
      '🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🍞','🥐','🥖','🫓',
      '🥨','🥯','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯',
      '🥙','🧆','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡',
      '🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍯',
      '🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾',
    ],
  },
  {
    id: 'activities', label: 'Activities', icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅',
      '⛳','🪁','🏹','🎣','🤿','🎽','🎿','🛷','🥌','🪂','🏋️','🤼','🤸','⛹️','🤺','🏇','🧘','🏄','🏊',
      '🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬',
      '🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎰','🎮','🕹️',
    ],
  },
  {
    id: 'travel', label: 'Travel & Places', icon: '🚗',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴',
      '🚨','🚥','🚦','🛑','🚧','⛽','🚢','✈️','🛩️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️',
      '🚞','🚝','🚄','🚅','🚈','🚂','🚃','🚋','🚆','🚇','🚊','🚉','🛫','🛬','🛰️','🌍','🌎','🌏','🗺️',
      '🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣',
      '🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🕍',
    ],
  },
  {
    id: 'objects', label: 'Objects', icon: '💡',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞',
      '☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️',
      '🧯','🛢️','💸','💵','💴','💶','💷','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒️','🛠️','⛏️','🔩','⚙️',
      '🔗','⛓️','🧲','🔫','💣','🪓','🔪','🛡️','🔮','📿','🧿','💈','⚗️','🔭','🔬','🩺','💊','💉','🧬',
      '🪤','🧴','🧷','🧹','🧺','🧻','🧼','🫧','🪥','🧽','🛒','🚪','🪞','🪟','🛋️','🪑','🚽','🚿','🛁',
    ],
  },
  {
    id: 'symbols', label: 'Symbols', icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟',
      '☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏',
      '♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐',
      '㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
      '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕','🔇','🔈','🔉','🔊','📣','📢','💬','💭','🗯️',
      '♠️','♣️','♥️','♦️','🃏','🀄','🎴','🔀','🔁','🔂','▶️','⏩','⏭️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬',
      '⏸️','⏹️','⏺️','🎦','🔅','🔆','📶','🔱','⚜️','🔰','♻️','✅','❇️','🔴','🟠','🟡','🟢','🔵','🟣',
    ],
  },
];

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CHAT_UI_STORAGE_KEYS = {
  starred: 'lad.chat.starredIds.v1',
  pinned: 'lad.chat.pinnedIds.v1',
  resolved: 'lad.chat.resolvedIds.v1',
  muted: 'lad.chat.mutedIds.v1',
  locked: 'lad.chat.lockedIds.v1',
  blocked: 'lad.chat.blockedIds.v1',
  deleted: 'lad.chat.deletedIds.v1',
};

const ActionMenuItem = ({
  icon: Icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  color?: string;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();
  const itemColor = color || appTheme.text;

  return (
    <TouchableOpacity style={styles.actionMenuItem} activeOpacity={0.78} onPress={onPress}>
      <Icon color={itemColor} size={18} />
      <Typography variant="body" color={itemColor} style={styles.actionMenuText}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
};

const AttachmentActionButton = ({
  icon: Icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  color: string;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();

  return (
    <TouchableOpacity style={styles.attachmentActionItem} activeOpacity={0.78} onPress={onPress}>
      <View style={[styles.attachmentActionIcon, { backgroundColor: color }]}>
        <Icon color="#FFFFFF" size={24} />
      </View>
      <Typography variant="bodySmall" color={appTheme.muted} align="center" style={styles.attachmentActionLabel}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
};

const DetailLine = ({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  children: React.ReactNode;
}) => {
  const appTheme = useAppTheme();

  return (
    <View style={styles.detailLine}>
      <Icon color={appTheme.muted} size={18} />
      <Typography variant="body" color={appTheme.text} style={styles.detailLineText}>
        {children}
      </Typography>
    </View>
  );
};

const ContactActionButton = ({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();

  return (
    <TouchableOpacity
      style={[styles.whatsAppContactAction, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
      activeOpacity={0.76}
      onPress={onPress}
    >
      <View style={styles.whatsAppContactActionIcon}>
        <Icon color="#00A884" size={21} />
      </View>
      <Typography variant="caption" color={appTheme.text} style={styles.whatsAppContactActionLabel}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
};

const ContactSwitchRow = ({
  icon: Icon,
  title,
  value,
  onValueChange,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  value: boolean;
  onValueChange: () => void;
}) => {
  const appTheme = useAppTheme();

  return (
    <TouchableOpacity style={styles.whatsAppInfoRow} activeOpacity={0.76} onPress={onValueChange}>
      <Icon color={appTheme.muted} size={22} />
      <Typography variant="body" color={appTheme.text} style={styles.whatsAppSwitchTitle}>
        {title}
      </Typography>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: appTheme.border, true: appTheme.successSoft }}
        thumbColor={value ? '#00A884' : appTheme.disabled}
      />
    </TouchableOpacity>
  );
};

const ContactInfoRow = ({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) => {
  const appTheme = useAppTheme();

  const content = (
    <>
      <Icon color={appTheme.muted} size={22} />
      <View style={styles.whatsAppInfoText}>
        <Typography variant="body" color={appTheme.text} style={styles.whatsAppInfoTitle}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.whatsAppInfoRow} activeOpacity={0.76} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.whatsAppInfoRow}>
      {content}
    </View>
  );
};

const ContactDangerRow = ({
  icon: Icon,
  title,
  subtitle,
  filled = false,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  subtitle?: string;
  filled?: boolean;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();
  return (
    <TouchableOpacity
      style={[
        styles.whatsAppDangerRow,
        filled && { backgroundColor: appTheme.darkMode ? '#2A171B' : '#FFF1F2' },
      ]}
      activeOpacity={0.72}
      onPress={onPress}
    >
      <Icon color="#E11D48" size={22} />
      <View style={styles.whatsAppDangerText}>
        <Typography variant="body" color="#E11D48" style={styles.whatsAppDangerTitle}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="#E11D48" style={styles.whatsAppDangerSubtitle} numberOfLines={1}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const BusinessProfileLine = ({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
}) => {
  const appTheme = useAppTheme();
  const content = (
    <>
      <Icon color={appTheme.muted} size={17} />
      <View style={styles.businessProfileLineText}>
        <Typography variant="bodySmall" color={appTheme.text} numberOfLines={2} style={styles.businessProfileLineTitle}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.businessProfileLine} activeOpacity={0.74} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.businessProfileLine}>{content}</View>;
};

const BusinessProfileCard = ({
  profile,
  loading,
}: {
  profile: WhatsAppBusinessProfile | null;
  loading: boolean;
}) => {
  const appTheme = useAppTheme();

  if (loading) {
    return (
      <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface }]}>
        <ActivityIndicator color={appTheme.primaryAccent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface }]}>
        <Typography variant="caption" color={appTheme.muted}>
          No business profile available
        </Typography>
      </View>
    );
  }

  const metrics = [
    { label: 'Members Met', value: profile.kpi_members_met },
    { label: 'Referrals Given', value: profile.kpi_referrals_given },
    { label: 'Referrals Rcvd', value: profile.kpi_referrals_received },
    { label: '1-to-1s', value: profile.kpi_one_to_ones },
  ].filter((metric) => metric.value !== null && metric.value !== undefined);

  const website = profile.website_url?.trim();

  return (
    <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface }]}>
      {profile.company_name ? (
        <BusinessProfileLine icon={Building2} title={profile.company_name} subtitle={profile.industry} />
      ) : null}
      {profile.designation ? <BusinessProfileLine icon={Briefcase} title={profile.designation} /> : null}
      {profile.email ? <BusinessProfileLine icon={Mail} title={profile.email} /> : null}
      {website ? (
        <BusinessProfileLine
          icon={Globe}
          title={website}
          onPress={() => void Linking.openURL(ensureUrlProtocol(website)).catch(() => undefined)}
        />
      ) : null}
      {profile.services_offered ? (
        <BusinessProfileLine icon={Target} title="Services" subtitle={profile.services_offered} />
      ) : null}
      {profile.ideal_customer_profile ? (
        <BusinessProfileLine icon={Users} title="Ideal Customer" subtitle={profile.ideal_customer_profile} />
      ) : null}
      {profile.website_about ? (
        <View style={[styles.businessProfileDivider, { borderTopColor: appTheme.border }]}>
          <Typography variant="overline" color={appTheme.muted}>About from website</Typography>
          <Typography variant="caption" color={appTheme.muted} numberOfLines={3}>{profile.website_about}</Typography>
        </View>
      ) : null}
      {profile.website_clients ? (
        <View style={styles.businessProfileTextBlock}>
          <Typography variant="overline" color={appTheme.muted}>Clients</Typography>
          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>{profile.website_clients}</Typography>
        </View>
      ) : null}
      {profile.website_services ? (
        <View style={styles.businessProfileTextBlock}>
          <Typography variant="overline" color={appTheme.muted}>Services from website</Typography>
          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>{profile.website_services}</Typography>
        </View>
      ) : null}
      {profile.icp_top_clients || profile.icp_decision_maker || profile.icp_ideal_referrals ? (
        <View style={[styles.businessProfileDivider, { borderTopColor: appTheme.border }]}>
          <Typography variant="overline" color={appTheme.muted}>ICP Discovery</Typography>
          {profile.icp_top_clients ? <Typography variant="caption" color={appTheme.text} numberOfLines={2}>Top Clients: {profile.icp_top_clients}</Typography> : null}
          {profile.icp_decision_maker ? <Typography variant="caption" color={appTheme.text} numberOfLines={2}>Decision Maker: {profile.icp_decision_maker}</Typography> : null}
          {profile.icp_ideal_referrals ? <Typography variant="caption" color={appTheme.text} numberOfLines={2}>Ideal Referrals: {profile.icp_ideal_referrals}</Typography> : null}
        </View>
      ) : null}
      {metrics.length ? (
        <View style={[styles.businessProfileDivider, { borderTopColor: appTheme.border }]}>
          <Typography variant="overline" color={appTheme.muted}>BNI Metrics</Typography>
          <View style={styles.businessMetricGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={[styles.businessMetricTile, { backgroundColor: appTheme.surface }]}>
                <Typography variant="bodySmall" color={appTheme.text} style={styles.businessMetricValue}>{metric.value}</Typography>
                <Typography variant="overline" color={appTheme.muted} numberOfLines={1}>{metric.label}</Typography>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const MindBodyPaymentPanel = ({
  conversation,
  onMessageSent,
}: {
  conversation: Conversation;
  onMessageSent?: () => void;
}) => {
  const appTheme = useAppTheme();
  const currentUser = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentLink, setPaymentLink] = useState<MindBodyPaymentLink | null>(null);
  const [verification, setVerification] = useState<MindBodyPaymentVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVerification(null);

    try {
      setPaymentLink(await getMindBodyPaymentLink());
    } catch (requestError) {
      setPaymentLink(null);
      setError(getActionErrorMessage(requestError, 'Unable to load MindBody payment options.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (next && !paymentLink && !loading) {
        void loadPaymentLink();
      }
      return next;
    });
  }, [loadPaymentLink, loading, paymentLink]);

  const handleSendPaymentLink = useCallback(async () => {
    if (!paymentLink?.portalUrl) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const sender = currentUser
        ? { id: currentUser.id, name: currentUser.name || currentUser.email || 'Agent' }
        : undefined;
      await sendMindBodyPaymentLinkMessage(conversation.id, paymentLink.portalUrl, sender);
      onMessageSent?.();
      Alert.alert('Payment link sent', 'The MindBody payment link was sent to this chat.');
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, 'Unable to send the payment link.'));
    } finally {
      setSending(false);
    }
  }, [conversation.id, currentUser, onMessageSent, paymentLink?.portalUrl]);

  const handleVerifyPayment = useCallback(async () => {
    const phone = conversation.phone?.trim();
    if (!phone) {
      setError('This contact does not have a phone number to verify.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      setVerification(await verifyMindBodyPayment(phone));
    } catch (requestError) {
      setVerification(null);
      setError(getActionErrorMessage(requestError, 'Unable to verify MindBody payment.'));
    } finally {
      setVerifying(false);
    }
  }, [conversation.phone]);

  return (
    <View style={[styles.paymentPanel, { borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}>
      <TouchableOpacity style={styles.paymentPanelHeader} activeOpacity={0.76} onPress={toggleOpen}>
        <View style={styles.paymentPanelTitleRow}>
          <CreditCard color={Theme.colors.primary} size={16} />
          <Typography variant="bodySmall" color={appTheme.text} style={styles.paymentButtonText}>
            MindBody Payment
          </Typography>
        </View>
        {open ? <ChevronUp color={appTheme.muted} size={17} /> : <ChevronDown color={appTheme.muted} size={17} />}
      </TouchableOpacity>

      {open ? (
        <View style={[styles.paymentPanelBody, { borderTopColor: appTheme.border }]}>
          {error ? (
            <View style={[styles.contactInlineAlert, { backgroundColor: appTheme.errorSoft, borderColor: Theme.colors.error }]}>
              <Info color={Theme.colors.error} size={14} />
              <Typography variant="caption" color={Theme.colors.error} style={styles.contactInlineAlertText}>
                {error}
              </Typography>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.contactLoadingRow}>
              <ActivityIndicator color={Theme.colors.primary} size="small" />
              <Typography variant="caption" color={appTheme.muted}>
                Loading pricing options...
              </Typography>
            </View>
          ) : paymentLink ? (
            <>
              {paymentLink.options.length ? (
                <View style={styles.paymentOptionsBlock}>
                  <Typography variant="overline" color={appTheme.muted} style={styles.paymentBlockTitle}>
                    Available Plans
                  </Typography>
                  {paymentLink.options.slice(0, 5).map((option) => (
                    <View key={option.id} style={[styles.paymentOptionRow, { backgroundColor: appTheme.surface }]}>
                      <Typography variant="caption" color={appTheme.text} numberOfLines={1} style={styles.paymentOptionName}>
                        {option.name}
                      </Typography>
                      {option.price ? (
                        <Typography variant="caption" color={Theme.colors.primary} style={styles.paymentOptionPrice}>
                          AED {option.price}
                        </Typography>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.paymentOptionsBlock}>
                <Typography variant="overline" color={appTheme.muted} style={styles.paymentBlockTitle}>
                  Payment Link
                </Typography>
                <Typography variant="caption" color={appTheme.muted} style={styles.paymentLinkText}>
                  {paymentLink.portalUrl}
                </Typography>
              </View>

              <View style={styles.paymentActionRow}>
                <TouchableOpacity
                  style={[styles.paymentActionButton, { backgroundColor: Theme.colors.primary }, sending && styles.disabledButton]}
                  activeOpacity={0.78}
                  disabled={sending}
                  onPress={handleSendPaymentLink}
                >
                  {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send color="#FFFFFF" size={15} />}
                  <Typography variant="caption" color="#FFFFFF" style={styles.paymentActionText}>
                    Send to Chat
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentActionButton, styles.paymentSecondaryButton, { borderColor: appTheme.border }, verifying && styles.disabledButton]}
                  activeOpacity={0.78}
                  disabled={verifying}
                  onPress={handleVerifyPayment}
                >
                  {verifying ? <ActivityIndicator color={Theme.colors.primary} size="small" /> : <Shield color={Theme.colors.primary} size={15} />}
                  <Typography variant="caption" color={Theme.colors.primary} style={styles.paymentActionText}>
                    Verify
                  </Typography>
                </TouchableOpacity>
              </View>

              {verification ? (
                <View
                  style={[
                    styles.paymentVerificationBox,
                    verification.paid
                      ? { backgroundColor: appTheme.successSoft, borderColor: Theme.colors.success }
                      : { backgroundColor: appTheme.warningSoft, borderColor: Theme.colors.warning },
                  ]}
                >
                  {verification.paid ? (
                    <CircleCheck color={Theme.colors.success} size={15} />
                  ) : (
                    <Info color={Theme.colors.warning} size={15} />
                  )}
                  <Typography
                    variant="caption"
                    color={verification.paid ? Theme.colors.success : Theme.colors.warning}
                    style={styles.contactInlineAlertText}
                  >
                    {verification.paid
                      ? `Payment confirmed (${verification.purchases.length} purchase${verification.purchases.length === 1 ? '' : 's'}, ${verification.services.length} service${verification.services.length === 1 ? '' : 's'})`
                      : 'No payment found in MindBody yet'}
                  </Typography>
                </View>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.paymentLoadButton, { borderColor: appTheme.border }]}
              activeOpacity={0.78}
              onPress={loadPaymentLink}
            >
              <CreditCard color={Theme.colors.primary} size={15} />
              <Typography variant="caption" color={Theme.colors.primary} style={styles.paymentActionText}>
                Load Payment Options
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
};

const AssignmentWorkflowPanel = ({
  conversation,
  onAssignmentChanged,
}: {
  conversation: Conversation;
  onAssignmentChanged?: () => void;
}) => {
  const appTheme = useAppTheme();
  const [assignment, setAssignment] = useState<ConversationAssignmentHistory | null>(null);
  const [members, setMembers] = useState<ConversationTeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const currentAssigneeId = assignment?.current?.assignedToUserId ?? null;
  const currentAssignee = currentAssigneeId
    ? membersById.get(currentAssigneeId) ?? { id: currentAssigneeId, name: conversation.owner || 'Team member' }
    : conversation.owner && !/^ai$/i.test(conversation.owner)
      ? { id: 'owner', name: conversation.owner }
      : null;

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [assignmentResult, membersResult] = await Promise.allSettled([
        getConversationAssignment(conversation.id),
        getConversationTeamWorkload(conversation.id),
      ]);

      if (assignmentResult.status === 'fulfilled') {
        setAssignment(assignmentResult.value);
      } else {
        setAssignment((current) => current ?? { current: null, history: [] });
        setError(getActionErrorMessage(assignmentResult.reason, 'Assignment history could not be loaded.'));
      }

      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value);
      } else if (!members.length) {
        setError((current) => current ?? getActionErrorMessage(membersResult.reason, 'Team members could not be loaded.'));
      }
    } finally {
      setLoading(false);
    }
  }, [conversation.id, members.length]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  const handleAssign = useCallback(async (member: ConversationTeamMember | null) => {
    setAssigningId(member?.id ?? 'unassign');
    setError(null);
    setNotice(null);

    try {
      const nextAssignment = member
        ? await assignConversationToTeamMember(conversation.id, member.id)
        : await unassignConversationFromTeamMember(conversation.id);
      setAssignment(nextAssignment);
      setPickerOpen(false);
      setNotice(member ? `Assigned to ${member.name}` : 'Conversation returned to AI');
      onAssignmentChanged?.();
      void loadAssignment();
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, member ? `Unable to assign ${member.name}.` : 'Unable to unassign conversation.'));
    } finally {
      setAssigningId(null);
    }
  }, [conversation.id, loadAssignment, onAssignmentChanged]);

  const initials = getInitials(currentAssignee?.name || conversation.owner || 'TE') || 'TE';
  const recentHistory = assignment?.history?.slice(0, 3) ?? [];

  return (
    <View style={[styles.assignmentCard, styles.workflowCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
      <View style={styles.assignmentMemberRow}>
        <View style={[styles.assignmentAvatar, { backgroundColor: appTheme.primarySoft }]}>
          <Typography variant="caption" color={Theme.colors.primary} style={styles.assignmentAvatarText}>
            {initials}
          </Typography>
        </View>
        <View style={styles.assignmentMemberText}>
          <Typography variant="caption" color={appTheme.muted}>
            Team member
          </Typography>
          <Typography variant="bodySmall" color={appTheme.text} style={styles.assignmentMemberName} numberOfLines={1}>
            {loading && !assignment ? 'Loading...' : currentAssignee?.name || 'Unassigned'}
          </Typography>
        </View>
        <TouchableOpacity
          style={[styles.reassignButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
          activeOpacity={0.78}
          onPress={() => setPickerOpen((value) => !value)}
          disabled={Boolean(assigningId)}
        >
          {assigningId ? (
            <ActivityIndicator color={Theme.colors.primary} size="small" />
          ) : (
            <>
              <Typography variant="caption" color={Theme.colors.primary} style={styles.reassignButtonText}>
                {currentAssignee ? 'Reassign' : 'Assign'}
              </Typography>
              <ChevronDown color={Theme.colors.primary} size={14} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {notice ? (
        <View style={[styles.contactInlineAlert, { backgroundColor: appTheme.successSoft, borderColor: Theme.colors.success }]}>
          <CircleCheck color={Theme.colors.success} size={14} />
          <Typography variant="caption" color={Theme.colors.success} style={styles.contactInlineAlertText}>
            {notice}
          </Typography>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.contactInlineAlert, { backgroundColor: appTheme.warningSoft, borderColor: Theme.colors.warning }]}>
          <Info color={Theme.colors.warning} size={14} />
          <Typography variant="caption" color={Theme.colors.warning} style={styles.contactInlineAlertText}>
            {error}
          </Typography>
        </View>
      ) : null}

      {pickerOpen ? (
        <View style={[styles.assignmentPicker, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
          {currentAssignee ? (
            <TouchableOpacity style={styles.assignmentPickerRow} activeOpacity={0.76} onPress={() => void handleAssign(null)}>
              <View style={[styles.assignmentPickerAvatar, { borderColor: Theme.colors.error }]}>
                <X color={Theme.colors.error} size={14} />
              </View>
              <Typography variant="bodySmall" color={Theme.colors.error} style={styles.assignmentPickerName}>
                Unassign
              </Typography>
            </TouchableOpacity>
          ) : null}

          {loading && !members.length ? (
            <View style={styles.contactLoadingRow}>
              <ActivityIndicator color={Theme.colors.primary} size="small" />
              <Typography variant="caption" color={appTheme.muted}>
                Loading team members...
              </Typography>
            </View>
          ) : members.length ? (
            members.map((member) => {
              const isCurrent = currentAssigneeId === member.id;
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.assignmentPickerRow, isCurrent && { backgroundColor: appTheme.successSoft }]}
                  activeOpacity={0.76}
                  disabled={isCurrent || Boolean(assigningId)}
                  onPress={() => void handleAssign(member)}
                >
                  <View style={[styles.assignmentPickerAvatar, { backgroundColor: appTheme.primarySoft }]}>
                    <Typography variant="caption" color={Theme.colors.primary} style={styles.assignmentAvatarText}>
                      {getInitials(member.name) || 'TM'}
                    </Typography>
                  </View>
                  <View style={styles.assignmentPickerText}>
                    <Typography variant="bodySmall" color={appTheme.text} style={styles.assignmentPickerName} numberOfLines={1}>
                      {member.name}
                    </Typography>
                    {member.workload !== undefined ? (
                      <Typography variant="caption" color={appTheme.muted}>
                        {member.workload} open chat{member.workload === 1 ? '' : 's'}
                      </Typography>
                    ) : member.email ? (
                      <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                        {member.email}
                      </Typography>
                    ) : null}
                  </View>
                  {isCurrent ? <Check color={Theme.colors.success} size={16} /> : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.assignmentEmptyState}>
              <Users color={appTheme.disabled} size={22} />
              <Typography variant="caption" color={appTheme.muted}>
                No team members available
              </Typography>
            </View>
          )}
        </View>
      ) : null}

      {recentHistory.length ? (
        <View style={[styles.assignmentHistory, { borderTopColor: appTheme.border }]}>
          <Typography variant="overline" color={appTheme.muted}>
            History
          </Typography>
          {recentHistory.map((record) => {
            const member = record.assignedToUserId ? membersById.get(record.assignedToUserId) : null;
            return (
              <View key={record.id} style={styles.assignmentHistoryRow}>
                <Clock color={appTheme.muted} size={13} />
                <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.assignmentHistoryText}>
                  {member?.name || (record.assignedToUserId ? 'Team member' : 'Unassigned')} - {formatTime(record.assignedAt)}
                </Typography>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const NotesWorkflowPanel = ({
  conversation,
  internal = false,
}: {
  conversation: Conversation;
  internal?: boolean;
}) => {
  const appTheme = useAppTheme();
  const currentUser = useAuthStore((state) => state.user);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setNotes(await getConversationNotes(conversation.id));
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, 'Unable to load notes.'));
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const visibleNotes = useMemo(
    () => notes.filter((note) => Boolean(note.isInternal) === internal),
    [internal, notes],
  );

  const handleAddNote = useCallback(async () => {
    const content = draft.trim();
    if (!content || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const note = await createConversationNote(conversation.id, content, {
        authorName: currentUser?.name || currentUser?.email || 'Agent',
        internal,
      });
      setNotes((current) => [note, ...current]);
      setDraft('');
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, internal ? 'Unable to post internal comment.' : 'Unable to add note.'));
    } finally {
      setSaving(false);
    }
  }, [conversation.id, currentUser?.email, currentUser?.name, draft, internal, saving]);

  const handleSaveEdit = useCallback(async (note: ConversationNote) => {
    const content = editingContent.trim();
    if (!content) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateConversationNote(note.id, content, { internal: note.isInternal });
      setNotes((current) => current.map((item) => (item.id === note.id ? updated : item)));
      setEditingId(null);
      setEditingContent('');
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, 'Unable to update note.'));
    } finally {
      setSaving(false);
    }
  }, [editingContent]);

  const handleDeleteNote = useCallback((note: ConversationNote) => {
    Alert.alert(
      internal ? 'Delete internal comment?' : 'Delete note?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversationNote(note.id);
              setNotes((current) => current.filter((item) => item.id !== note.id));
            } catch (requestError) {
              setError(getActionErrorMessage(requestError, 'Unable to delete note.'));
            }
          },
        },
      ],
    );
  }, [internal]);

  return (
    <View style={[styles.workflowCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={internal ? 'Add internal comment (not visible to contact)...' : 'Add a note...'}
        placeholderTextColor={appTheme.disabled}
        multiline
        style={[
          styles.noteInput,
          {
            color: appTheme.text,
            borderColor: appTheme.border,
            backgroundColor: appTheme.surface,
          },
          WEB_INPUT_RESET,
        ]}
      />
      <TouchableOpacity
        style={[styles.noteSubmitButton, { backgroundColor: Theme.colors.primary }, (!draft.trim() || saving) && styles.disabledButton]}
        activeOpacity={0.78}
        disabled={!draft.trim() || saving}
        onPress={handleAddNote}
      >
        {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : internal ? <Send color="#FFFFFF" size={14} /> : <Plus color="#FFFFFF" size={14} />}
        <Typography variant="caption" color="#FFFFFF" style={styles.noteSubmitText}>
          {internal ? 'Post Comment' : 'Add Note'}
        </Typography>
      </TouchableOpacity>

      {error ? (
        <View style={[styles.contactInlineAlert, { backgroundColor: appTheme.errorSoft, borderColor: Theme.colors.error }]}>
          <Info color={Theme.colors.error} size={14} />
          <Typography variant="caption" color={Theme.colors.error} style={styles.contactInlineAlertText}>
            {error}
          </Typography>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.contactLoadingRow}>
          <ActivityIndicator color={Theme.colors.primary} size="small" />
          <Typography variant="caption" color={appTheme.muted}>
            Loading {internal ? 'internal comments' : 'notes'}...
          </Typography>
        </View>
      ) : visibleNotes.length ? (
        <View style={styles.notesList}>
          {visibleNotes.map((note) => (
            <View key={note.id} style={[styles.noteItem, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
              {editingId === note.id ? (
                <>
                  <TextInput
                    value={editingContent}
                    onChangeText={setEditingContent}
                    multiline
                    style={[
                      styles.noteInput,
                      {
                        color: appTheme.text,
                        borderColor: appTheme.border,
                        backgroundColor: appTheme.input,
                      },
                      WEB_INPUT_RESET,
                    ]}
                  />
                  <View style={styles.noteActionRow}>
                    <TouchableOpacity style={[styles.noteMiniButton, { backgroundColor: Theme.colors.primary }]} activeOpacity={0.76} onPress={() => void handleSaveEdit(note)}>
                      <Check color="#FFFFFF" size={13} />
                      <Typography variant="caption" color="#FFFFFF">Save</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.noteMiniButton, { borderColor: appTheme.border }]} activeOpacity={0.76} onPress={() => setEditingId(null)}>
                      <Typography variant="caption" color={appTheme.text}>Cancel</Typography>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.noteMetaRow}>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.noteMetaText}>
                      {note.authorName || 'Agent'}{note.createdAt ? ` - ${formatTime(note.createdAt)}` : ''}
                    </Typography>
                    <View style={styles.noteActionRow}>
                      <TouchableOpacity
                        style={[styles.noteTextButton, { borderColor: appTheme.border }]}
                        activeOpacity={0.76}
                        onPress={() => {
                          setEditingId(note.id);
                          setEditingContent(note.displayContent);
                        }}
                      >
                        <Typography variant="caption" color={Theme.colors.primary}>Edit</Typography>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.noteTextButton, { borderColor: appTheme.border }]}
                        activeOpacity={0.76}
                        onPress={() => handleDeleteNote(note)}
                      >
                        <Typography variant="caption" color={Theme.colors.error}>Delete</Typography>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.noteContent}>
                    {note.displayContent}
                  </Typography>
                </>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.assignmentEmptyState}>
          <MessageSquare color={appTheme.disabled} size={22} />
          <Typography variant="caption" color={appTheme.muted}>
            No {internal ? 'internal comments' : 'notes'} yet
          </Typography>
        </View>
      )}
    </View>
  );
};

const ContactWorkflowTabs = ({
  conversation,
  onAssignmentChanged,
}: {
  conversation: Conversation;
  onAssignmentChanged?: () => void;
}) => {
  const appTheme = useAppTheme();
  const [activeTab, setActiveTab] = useState<'assignment' | 'notes' | 'internal'>('assignment');
  const tabs: {
    id: 'assignment' | 'notes' | 'internal';
    label: string;
    icon: React.ComponentType<{ color?: string; size?: number }>;
  }[] = [
    { id: 'assignment', label: 'Assignment', icon: UserRound },
    { id: 'notes', label: 'Notes', icon: Tag },
    { id: 'internal', label: 'Internal', icon: MessageSquare },
  ];

  return (
    <View style={styles.workflowTabsBlock}>
      <View style={[styles.assignmentTabs, styles.workflowSegmentedTabs, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[
                active ? styles.assignmentTabActive : styles.assignmentTab,
                active && { backgroundColor: appTheme.surface, borderColor: appTheme.border },
              ]}
              activeOpacity={0.78}
              onPress={() => setActiveTab(id)}
            >
              <Icon color={active ? Theme.colors.primary : appTheme.muted} size={15} />
              <Typography
                variant="caption"
                color={active ? Theme.colors.primary : appTheme.muted}
                style={active ? styles.assignmentTabText : undefined}
                numberOfLines={1}
              >
                {label}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'assignment' ? (
        <AssignmentWorkflowPanel conversation={conversation} onAssignmentChanged={onAssignmentChanged} />
      ) : activeTab === 'notes' ? (
        <NotesWorkflowPanel conversation={conversation} />
      ) : (
        <NotesWorkflowPanel conversation={conversation} internal />
      )}
    </View>
  );
};

const MediaPreviewTile = ({ item, compact = false }: { item: ChatMediaItem; compact?: boolean }) => {
  const appTheme = useAppTheme();
  const authToken = useAuthStore((state) => state.token);
  const openItem = () => {
    void Linking.openURL(item.url).catch(() => undefined);
  };

  if (item.kind === 'doc') {
    return (
      <TouchableOpacity
        style={[compact ? styles.whatsAppMediaPreviewTile : styles.mediaGridDocTile, { backgroundColor: appTheme.softSurface }]}
        activeOpacity={0.78}
        onPress={openItem}
      >
        <FileText color={appTheme.muted} size={compact ? 22 : 30} />
        {!compact ? (
          <Typography variant="caption" color={appTheme.text} numberOfLines={2} style={styles.mediaGridDocTitle}>
            {item.title}
          </Typography>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (item.kind === 'link') {
    return (
      <TouchableOpacity
        style={[compact ? styles.whatsAppMediaPreviewTile : styles.mediaGridDocTile, { backgroundColor: appTheme.softSurface }]}
        activeOpacity={0.78}
        onPress={openItem}
      >
        <Link2 color={appTheme.muted} size={compact ? 22 : 30} />
        {!compact ? (
          <Typography variant="caption" color={appTheme.text} numberOfLines={2} style={styles.mediaGridDocTitle}>
            {item.title}
          </Typography>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (isVideoMediaItem(item)) {
    return (
      <TouchableOpacity style={[compact ? styles.whatsAppMediaPreviewTile : styles.mediaGridTile, styles.videoMediaTile]} activeOpacity={0.78} onPress={openItem}>
        <Video color="#FFFFFF" size={compact ? 24 : 32} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={compact ? styles.whatsAppMediaPreviewTile : styles.mediaGridTile} activeOpacity={0.78} onPress={openItem}>
      <Image
        source={{
          uri: item.url,
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        }}
        style={styles.mediaGridImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};

const MediaLibraryScreen = ({
  conversation,
  items,
  initialTab,
  onClose,
}: {
  conversation: Conversation;
  items: ChatMediaItem[];
  initialTab: ChatMediaKind;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const appTheme = useAppTheme();
  const [activeTab, setActiveTab] = useState<ChatMediaKind>(initialTab);
  const mediaItems = useMemo(() => items.filter((item) => item.kind === activeTab), [activeTab, items]);
  const columns = width >= 620 ? 4 : 3;
  const horizontalPadding = width < 360 ? Theme.spacing.md : Theme.spacing.xl;
  const gap = 6;
  const tileSize = Math.floor((Math.min(width, 720) - horizontalPadding * 2 - gap * (columns - 1)) / columns);

  const renderTab = (tab: ChatMediaKind, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.mediaLibraryTab, activeTab === tab && styles.mediaLibraryTabActive]}
      activeOpacity={0.76}
      onPress={() => setActiveTab(tab)}
    >
      <Typography variant="bodySmall" color={activeTab === tab ? '#047857' : appTheme.text} style={styles.mediaLibraryTabText}>
        {label}
      </Typography>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.mediaLibraryScreen, { backgroundColor: appTheme.surface }]}>
      <View style={[styles.mediaLibraryHeader, { paddingTop: Math.max(insets.top, 16), borderBottomColor: appTheme.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.darkIconButton} activeOpacity={0.72}>
          <ArrowLeft color={appTheme.text} size={23} />
        </TouchableOpacity>
        <Typography variant="h4" color={appTheme.text} numberOfLines={1} style={styles.mediaLibraryTitle}>
          {conversation.name}
        </Typography>
      </View>

      <View style={[styles.mediaLibraryTabs, { borderBottomColor: appTheme.border }]}>
        {renderTab('media', 'Media')}
        {renderTab('doc', 'Docs')}
        {renderTab('link', 'Links')}
      </View>

      <ScrollView
        contentContainerStyle={[styles.mediaLibraryContent, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(insets.bottom, 12) + 64 }]}
        showsVerticalScrollIndicator={false}
      >
        <Typography variant="caption" color={appTheme.text} style={styles.mediaMonthLabel}>
          THIS MONTH
        </Typography>

        {mediaItems.length ? (
          activeTab === 'media' ? (
            <View style={styles.mediaGrid}>
              {mediaItems.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    width: tileSize,
                    height: tileSize,
                    marginRight: (index + 1) % columns === 0 ? 0 : gap,
                    marginBottom: gap,
                  }}
                >
                  <MediaPreviewTile item={item} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.mediaList}>
              {mediaItems.map((item) => (
                <TouchableOpacity key={item.id} style={[styles.mediaListRow, { borderBottomColor: appTheme.border }]} activeOpacity={0.76} onPress={() => void Linking.openURL(item.url).catch(() => undefined)}>
                  <View style={[styles.mediaListIcon, { backgroundColor: appTheme.softSurface }]}>
                    {activeTab === 'doc' ? <FileText color={appTheme.muted} size={22} /> : <Link2 color={appTheme.muted} size={22} />}
                  </View>
                  <View style={styles.mediaListText}>
                    <Typography variant="bodySmall" color={appTheme.text} numberOfLines={1} style={styles.mediaListTitle}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                      {formatTime(item.createdAt)}
                    </Typography>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          <View style={[styles.mediaEmptyState, { borderColor: appTheme.border }]}>
            {activeTab === 'media' ? <ImageIcon color={appTheme.disabled} size={30} /> : activeTab === 'doc' ? <FileText color={appTheme.disabled} size={30} /> : <Link2 color={appTheme.disabled} size={30} />}
            <Typography variant="bodySmall" color={appTheme.muted} style={styles.mediaEmptyText}>
              No {activeTab === 'media' ? 'media' : activeTab === 'doc' ? 'documents' : 'links'} found in this chat.
            </Typography>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.mediaLibraryFooter, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: appTheme.border, backgroundColor: appTheme.surface }]} activeOpacity={0.78}>
        <ImageIcon color="#047857" size={18} />
        <Typography variant="bodySmall" color="#047857" style={styles.mediaLibraryFooterText}>
          View media from all chats.
        </Typography>
      </TouchableOpacity>
    </View>
  );
};

const ContactDetailsPanel = ({
  conversation,
  messages,
  messageCount,
  resolved,
  favourite,
  listed,
  muted,
  locked,
  fullPage = false,
  onClose,
  onOpenMedia,
  onOpenSearch,
  onOpenStarredMessages,
  onToggleFavourite,
  onToggleList,
  onToggleMute,
  onTogglePrivacy,
  onOpenDisappearingMessages,
  onVerifyEncryption,
  onClearChat,
  onBlock,
  onReport,
  onDelete,
  onConversationRefresh,
}: {
  conversation: Conversation;
  messages: ChatMessage[];
  messageCount: number;
  resolved: boolean;
  favourite: boolean;
  listed: boolean;
  muted: boolean;
  locked: boolean;
  fullPage?: boolean;
  onClose: () => void;
  onOpenMedia: (tab?: ChatMediaKind) => void;
  onOpenSearch: () => void;
  onOpenStarredMessages: () => void;
  onToggleFavourite: () => void;
  onToggleList: () => void;
  onToggleMute: () => void;
  onTogglePrivacy: () => void;
  onOpenDisappearingMessages: () => void;
  onVerifyEncryption: () => void;
  onClearChat: () => void;
  onBlock: () => void;
  onReport: () => void;
  onDelete: () => void;
  onConversationRefresh?: () => void;
}) => {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const authToken = useAuthStore((state) => state.token);
  const [businessProfile, setBusinessProfile] = useState<WhatsAppBusinessProfile | null>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false);
  const mediaItems = useMemo(() => getMediaItemsFromMessages(messages), [messages]);
  const mediaPreviewItems = mediaItems.filter((item) => item.kind === 'media').slice(0, 4);
  const stateLabel = resolved ? 'Resolved' : conversation.conversationState || 'Open';
  const ownerLabel = conversation.owner || 'AI';
  const startedLabel = formatTime(conversation.startedAt || conversation.lastMessageAt);
  const phoneLabel = conversation.phone || conversation.email || getChannelLabel(conversation.channel);
  const isWhatsAppContact = isWhatsAppChannel(conversation.channel);
  const profileAvatarSize = width < 360 ? 124 : width < 390 ? 136 : fullPage ? 148 : 140;
  const firstName = conversation.name.split(' ').filter(Boolean)[0] || conversation.name;

  useEffect(() => {
    let mounted = true;

    if (!isWhatsAppContact) {
      setBusinessProfile(null);
      setBusinessProfileLoading(false);
      return () => {
        mounted = false;
      };
    }

    setBusinessProfileLoading(true);
    void fetchWhatsAppBusinessProfile(conversation.id)
      .then((profile) => {
        if (mounted) {
          setBusinessProfile(profile);
        }
      })
      .catch(() => {
        if (mounted) {
          setBusinessProfile(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setBusinessProfileLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [conversation.id, isWhatsAppContact]);

  if (isWhatsAppContact) {
    return (
      <View style={[styles.contactPanel, fullPage && styles.contactPanelFullPage, styles.whatsAppContactPanel, { backgroundColor: appTheme.surface, borderLeftColor: appTheme.border }]}>
        <View style={[styles.whatsAppContactHeader, { paddingTop: Math.max(insets.top, 14), borderBottomColor: appTheme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.darkIconButton} activeOpacity={0.72}>
            <X color={appTheme.text} size={22} />
          </TouchableOpacity>
          <Typography variant="body" color={appTheme.text} style={styles.whatsAppContactHeaderTitle}>
            Contact info
          </Typography>
          <View style={styles.darkIconButton} />
        </View>

        <ScrollView contentContainerStyle={[styles.whatsAppContactBody, { paddingBottom: Math.max(insets.bottom, 0) + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.whatsAppContactHero}>
            <View style={styles.whatsAppProfileAvatarWrap}>
              <Avatar src={conversation.avatar} fallback={getInitials(conversation.name)} size={profileAvatarSize} authToken={authToken} />
              <View style={[styles.whatsAppProfileChannelBadge, { backgroundColor: appTheme.surface }]}>
                <WhatsAppIcon size={18} color="#25D366" />
              </View>
            </View>
            <Typography variant="h3" color={appTheme.text} style={styles.whatsAppContactName} numberOfLines={2}>
              {conversation.name}
            </Typography>
            <Typography variant="body" color={appTheme.muted} style={styles.whatsAppContactPhone} numberOfLines={1}>
              {phoneLabel}
            </Typography>
            <View style={styles.whatsAppContactActions}>
              <ContactActionButton icon={Search} label="Search" onPress={onOpenSearch} />
            </View>
          </View>

          <View style={styles.whatsAppAboutLabel}>
            <Typography variant="caption" color={appTheme.muted} style={styles.whatsAppAboutText}>About</Typography>
          </View>

          <View style={[styles.whatsAppSection, styles.whatsAppBusinessAccountSection, { borderTopColor: appTheme.border }]}>
            <View style={styles.whatsAppBusinessAccountRow}>
              <Typography variant="bodySmall" color={appTheme.text} style={styles.whatsAppBusinessAccountText}>
                This is a business account.
              </Typography>
              <Info color={appTheme.muted} size={17} />
            </View>
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <TouchableOpacity style={styles.whatsAppMediaHeader} activeOpacity={0.76} onPress={() => onOpenMedia('media')}>
              <ImageIcon color={appTheme.muted} size={22} />
              <Typography variant="body" color={appTheme.text} style={styles.whatsAppMediaTitle}>
                Media, links and docs
              </Typography>
              <Typography variant="bodySmall" color={appTheme.muted}>{mediaItems.length}</Typography>
              <ChevronRight color={appTheme.muted} size={19} />
            </TouchableOpacity>
            <View style={styles.whatsAppMediaPreviewRow}>
              {mediaPreviewItems.length ? (
                mediaPreviewItems.map((item) => (
                  <MediaPreviewTile key={item.id} item={item} compact />
                ))
              ) : (
                <TouchableOpacity style={[styles.whatsAppMediaEmptyPreview, { borderColor: appTheme.border }]} activeOpacity={0.76} onPress={() => onOpenMedia('media')}>
                  <ImageIcon color={appTheme.disabled} size={22} />
                  <Typography variant="caption" color={appTheme.muted}>
                    No media yet
                  </Typography>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <Typography variant="overline" color={appTheme.muted} style={styles.whatsAppSectionTitle}>Contact Info</Typography>
            {conversation.company ? <BusinessProfileLine icon={Building2} title={conversation.company} /> : null}
            {conversation.email ? <BusinessProfileLine icon={Mail} title={conversation.email} /> : null}
            {conversation.phone ? (
              <BusinessProfileLine
                icon={Phone}
                title={conversation.phone}
                onPress={() => void Linking.openURL(`tel:${conversation.phone?.replace(/[^\d+]/g, '')}`).catch(() => undefined)}
              />
            ) : null}
            <BusinessProfileLine icon={Clock} title={`Conversation started ${startedLabel}`} />
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <Typography variant="overline" color={appTheme.muted} style={styles.whatsAppSectionTitle}>Business Profile</Typography>
            <BusinessProfileCard profile={businessProfile} loading={businessProfileLoading} />
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <MindBodyPaymentPanel conversation={conversation} onMessageSent={onConversationRefresh} />
            <ContactWorkflowTabs conversation={conversation} onAssignmentChanged={onConversationRefresh} />
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <ContactInfoRow icon={Star} title="Starred messages" onPress={onOpenStarredMessages} />
            <ContactSwitchRow icon={Bell} title="Mute notifications" value={muted} onValueChange={onToggleMute} />
            <ContactInfoRow icon={Clock} title="Disappearing messages" subtitle="Off" onPress={onOpenDisappearingMessages} />
            <ContactInfoRow icon={Shield} title="Advanced chat privacy" subtitle={locked ? 'On' : 'Off'} onPress={onTogglePrivacy} />
            <ContactInfoRow icon={Lock} title="Encryption" subtitle="Messages are end-to-end encrypted. Click to verify." onPress={onVerifyEncryption} />
          </View>

          <View style={[styles.whatsAppSection, { borderTopColor: appTheme.border }]}>
            <ContactInfoRow icon={Heart} title={favourite ? 'Remove from favourites' : 'Add to favourites'} onPress={onToggleFavourite} />
            <ContactInfoRow icon={ListIcon} title={listed ? 'Remove from list' : 'Add to list'} onPress={onToggleList} />
          </View>

          <View style={[styles.whatsAppActionSection, { borderTopColor: appTheme.border }]}>
            <ContactDangerRow icon={MinusCircle} title="Clear chat" filled onPress={onClearChat} />
            <ContactDangerRow icon={Ban} title="Block" subtitle={firstName} onPress={onBlock} />
            <ContactDangerRow icon={ThumbsDown} title="Report" subtitle={firstName} onPress={onReport} />
            <ContactDangerRow icon={Trash2} title="Delete chat" onPress={onDelete} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.contactPanel, fullPage && styles.contactPanelFullPage, { backgroundColor: appTheme.surface, borderLeftColor: appTheme.border }]}>
      <View style={styles.contactPanelHeader}>
        <Typography variant="h4" color={appTheme.text}>
          Contact Details
        </Typography>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseButton} activeOpacity={0.75}>
          <X color={appTheme.muted} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.contactPanelBody, { paddingBottom: Math.max(insets.bottom, 0) + 108 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.contactHero}>
          <View style={styles.largeAvatar}>
            <Typography variant="h2" color={Theme.colors.primary}>
              {getInitials(conversation.name) || '?'}
            </Typography>
            <View style={styles.heroChannelBadge}>
              <ChannelGlyph channel={conversation.channel} size={18} color={getChannelColor(conversation.channel)} />
            </View>
          </View>
          <Typography variant="h3" color={appTheme.text} style={styles.contactHeroName} numberOfLines={2}>
            {conversation.name}
          </Typography>
          {conversation.company ? (
            <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1}>
              {conversation.company}
            </Typography>
          ) : null}
        </View>

        <View style={styles.detailSection}>
          <View style={styles.detailSectionTitleRow}>
            <Typography variant="caption" color={appTheme.muted} style={styles.detailSectionTitle}>
              LABELS
            </Typography>
            <Plus color={appTheme.muted} size={18} />
          </View>
          <Typography variant="bodySmall" color={appTheme.muted}>
            {conversation.tags?.length ? conversation.tags.join(', ') : 'No labels assigned'}
          </Typography>
        </View>

        <View style={styles.detailSection}>
          {conversation.email ? <DetailLine icon={Mail}>{conversation.email}</DetailLine> : null}
          {conversation.phone ? <DetailLine icon={Phone}>{conversation.phone}</DetailLine> : null}
          <DetailLine icon={MessageCircle}>Conversation started {startedLabel || 'recently'}</DetailLine>
        </View>

        <View style={[styles.detailCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
          <Typography variant="caption" color={appTheme.muted} style={styles.detailSectionTitle}>
            METADATA
          </Typography>
          <View style={styles.metaRow}>
            <Typography variant="bodySmall" color={appTheme.muted}>Status</Typography>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.metaValue}>{stateLabel}</Typography>
          </View>
          <View style={styles.metaRow}>
            <Typography variant="bodySmall" color={appTheme.muted}>Owner</Typography>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.metaValue}>{ownerLabel}</Typography>
          </View>
          <View style={styles.metaRow}>
            <Typography variant="bodySmall" color={appTheme.muted}>Channel</Typography>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.metaValue}>{getChannelLabel(conversation.channel)}</Typography>
          </View>
          <View style={styles.metaRow}>
            <Typography variant="bodySmall" color={appTheme.muted}>Messages</Typography>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.metaValue}>
              {conversation.messageCount || messageCount}
            </Typography>
          </View>
        </View>

        <TouchableOpacity style={styles.paymentButton} activeOpacity={0.8}>
          <FileText color={Theme.colors.primary} size={16} />
          <Typography variant="bodySmall" color={Theme.colors.primary} style={styles.paymentButtonText}>
            MindBody Payment
          </Typography>
        </TouchableOpacity>

        <View style={styles.assignmentTabs}>
          <View style={styles.assignmentTabActive}>
            <UserRound color={Theme.colors.primary} size={16} />
            <Typography variant="caption" color={Theme.colors.primary} style={styles.assignmentTabText}>Assignment</Typography>
          </View>
          <View style={styles.assignmentTab}>
          <Tag color={appTheme.muted} size={15} />
          <Typography variant="caption" color={appTheme.muted}>Notes</Typography>
          </View>
          <View style={styles.assignmentTab}>
          <MessageSquare color={appTheme.muted} size={15} />
          <Typography variant="caption" color={appTheme.muted}>Internal</Typography>
          </View>
        </View>

        <View style={[styles.assignmentCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
          <Users color={Theme.colors.primary} size={36} />
          <Typography variant="h4" color={appTheme.text} style={styles.assignmentTitle}>
            {conversation.owner ? `Assigned to ${conversation.owner}` : 'Not Assigned'}
          </Typography>
          <Typography variant="bodySmall" color={appTheme.muted} style={styles.assignmentCopy}>
            {conversation.owner ? 'Messages are handled by the assigned owner' : 'Messages will be handled by AI'}
          </Typography>
          <TouchableOpacity style={styles.assignButton} activeOpacity={0.8}>
            <UserRound color={Theme.colors.surface} size={16} />
            <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.assignButtonText}>
              Assign to Team Member
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const currentUser = useAuthStore((state) => state.user);
  const [activeFilter, setActiveFilter] = useState<ChannelFilterId>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownAnimation = useRef(new Animated.Value(0)).current;
  const [createChatMenuOpen, setCreateChatMenuOpen] = useState(false);
  const [createChatNotice, setCreateChatNotice] = useState<string | null>(null);
  const [createChatMode, setCreateChatMode] = useState<ChatCreateActionId | null>(null);
  const [createChatSearch, setCreateChatSearch] = useState('');
  const [createChatSelectedIds, setCreateChatSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryInitialTab, setMediaLibraryInitialTab] = useState<ChatMediaKind>('media');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickComposer, setQuickComposer] = useState<QuickComposerAction | null>(null);
  const [quickDraft, setQuickDraft] = useState<QuickComposerDraft>(EMPTY_QUICK_DRAFT);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState('');
  const [threadSearchMatchIndex, setThreadSearchMatchIndex] = useState(0);
  const [emojiCategory, setEmojiCategory] = useState('smileys');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{ uri: string; durationSec: number } | null>(null);
  const [pendingVoiceNotePlaying, setPendingVoiceNotePlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messageListRef = useRef<FlatList<MessageListItem>>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSoundRef = useRef<Audio.Sound | null>(null);
  const pendingVoiceNoteSoundRef = useRef<Audio.Sound | null>(null);
  const [chatUiStateLoaded, setChatUiStateLoaded] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [chatTemplates, setChatTemplates] = useState<ChatTemplate[]>([]);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>('ai');
  const [agentModeUpdating, setAgentModeUpdating] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set());
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const {
    conversations,
    activeConversationId,
    activeMessages,
    isLoadingConversations,
    isLoadingMoreConversations,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasOlderMessages,
    isSending,
    isUploadingAttachment,
    isSyncing,
    error,
    syncError,
    lastSyncedAt,
    typingConversationIds,
    initializeRealtime,
    fetchMoreConversations,
    syncConversations,
    startConversationAutoSync,
    stopConversationAutoSync,
    setActiveConversation,
    getOlderMessages,
    sendMessage,
    sendAttachment,
    emitTypingState,
    clearConversationMessages,
    clearActiveConversation,
    disposeRealtime,
    connectedIntegrations,
    fetchConnectedIntegrations,
    isLoadingIntegrations,
  } = useChatStore();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigation = useNavigation();
  const router = useRouter();
  const isChatFocused = useIsFocused();
  const authToken = useAuthStore((state) => state.token);

  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: {
        display: activeConversationId && isChatFocused ? 'none' : 'flex',
      },
    });
    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, activeConversationId, isChatFocused]);

  useEffect(() => {
    if (!filterDropdownOpen) {
      return;
    }

    filterDropdownAnimation.setValue(0);
    Animated.timing(filterDropdownAnimation, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filterDropdownAnimation, filterDropdownOpen]);

  useEffect(() => {
    initializeRealtime();
    void syncConversations();
    startConversationAutoSync();

    return () => {
      stopConversationAutoSync();
      disposeRealtime();
    };
  }, [
    disposeRealtime,
    initializeRealtime,
    startConversationAutoSync,
    stopConversationAutoSync,
    syncConversations,
  ]);

  useEffect(() => {
    void fetchConnectedIntegrations();
  }, [fetchConnectedIntegrations]);

  useEffect(() => {
    let mounted = true;

    const loadChatUiState = async () => {
      const entries = await Promise.all([
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.starred),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.pinned),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.resolved),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.muted),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.locked),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.blocked),
        safeStorage.getItem(CHAT_UI_STORAGE_KEYS.deleted),
      ]);

      if (!mounted) {
        return;
      }

      setStarredIds(parseStoredIdSet(entries[0]));
      setPinnedIds(parseStoredIdSet(entries[1]));
      setResolvedIds(parseStoredIdSet(entries[2]));
      setMutedIds(parseStoredIdSet(entries[3]));
      setLockedIds(parseStoredIdSet(entries[4]));
      setBlockedIds(parseStoredIdSet(entries[5]));
      setDeletedIds(parseStoredIdSet(entries[6]));
      setChatUiStateLoaded(true);
    };

    void loadChatUiState();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.starred, starredIds);
  }, [chatUiStateLoaded, starredIds]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.pinned, pinnedIds);
  }, [chatUiStateLoaded, pinnedIds]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.resolved, resolvedIds);
  }, [chatUiStateLoaded, resolvedIds]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.muted, mutedIds);
  }, [chatUiStateLoaded, mutedIds]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.locked, lockedIds);
  }, [chatUiStateLoaded, lockedIds]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.blocked, blockedIds);
  }, [blockedIds, chatUiStateLoaded]);

  useEffect(() => {
    if (!chatUiStateLoaded) return;
    saveIdSet(CHAT_UI_STORAGE_KEYS.deleted, deletedIds);
  }, [chatUiStateLoaded, deletedIds]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );

  useEffect(() => {
    setAgentMode(getAgentModeFromConversation(activeConversation));
  }, [activeConversation]);

  useEffect(() => {
    forceBottomTabHidden(Boolean(activeConversationId && isChatFocused));
    return () => {
      forceBottomTabHidden(false);
    };
  }, [activeConversationId, isChatFocused]);
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    // Pre-compute disconnected third-party channels so we can exclude their conversations
    // from the "all" filter. WhatsApp (personal/waba) is intentionally excluded from this
    // check because WAPA session status can be unreliable across environments.
    const integrationsLoaded = !isLoadingIntegrations && connectedIntegrations.length > 0;
    const linkedInOff = integrationsLoaded && !connectedIntegrations.some((i) => i.channel === 'linkedin' && i.connected);
    const instagramOff = integrationsLoaded && !connectedIntegrations.some((i) => i.channel === 'instagram' && i.connected);
    const emailOff = integrationsLoaded && !connectedIntegrations.some((i) => i.channel === 'email' && i.connected);

    return conversations
      .filter((conversation) => {
        if (deletedIds.has(conversation.id) || blockedIds.has(conversation.id)) {
          return false;
        }

        // Hide conversations from disconnected third-party channels in the "all" view.
        if (activeFilter === 'all') {
          if (linkedInOff && conversation.channel === 'linkedin') return false;
          if (instagramOff && conversation.channel === 'instagram') return false;
          if (emailOff && (conversation.channel === 'email' || conversation.channel === 'gmail')) return false;
        }

        const searchable = [
          conversation.name,
          conversation.lastMessage,
          conversation.email,
          conversation.phone,
          conversation.company,
          ...(conversation.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesSearch =
          !query ||
          searchable.includes(query);
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'unread' && conversation.unreadCount > 0) ||
          (activeFilter === 'personal' && conversation.channel === 'whatsapp' && conversation.waBackendChannel === 'personal') ||
          (activeFilter === 'waba' && conversation.channel === 'whatsapp' && conversation.waBackendChannel === 'waba') ||
          conversation.channel === activeFilter ||
          (activeFilter === 'email' && conversation.channel === 'gmail');

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const pinDelta = Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id));
        if (pinDelta) {
          return pinDelta;
        }

        return Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? '');
      });
  }, [activeFilter, blockedIds, connectedIntegrations, conversations, deletedIds, isLoadingIntegrations, pinnedIds, search]);

  const createChatContacts = useMemo(() => {
    const query = createChatSearch.trim().toLowerCase();
    const visibleContacts = sortNewestConversations(
      conversations.filter((conversation) => !deletedIds.has(conversation.id) && !blockedIds.has(conversation.id)),
    );

    if (!query) {
      return visibleContacts;
    }

    return visibleContacts.filter((conversation) => getConversationSearchLabel(conversation).includes(query));
  }, [blockedIds, conversations, createChatSearch, deletedIds]);

  const messageListData = useMemo<MessageListItem[]>(() => {
    const newestFirst = [...activeMessages].reverse();
    const items: MessageListItem[] = [];

    newestFirst.forEach((message, index) => {
      items.push({ type: 'message', id: message.id, message });

      const currentDay = getDateKey(message.createdAt);
      const nextDay = getDateKey(newestFirst[index + 1]?.createdAt);
      if (currentDay !== nextDay) {
        items.push({
          type: 'date',
          id: `date-${currentDay}-${message.id}`,
          label: formatDateChip(message.createdAt),
        });
      }
    });

    return items;
  }, [activeMessages]);
  const visibleMessageListData = useMemo(() => {
    const query = threadSearchQuery.trim().toLowerCase();
    if (!query) {
      return messageListData;
    }

    return messageListData.filter((item) => (
      item.type === 'message'
      && [
        item.message.content,
        item.message.senderName,
        item.message.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [messageListData, threadSearchQuery]);
  const threadSearchMatchCount = threadSearchQuery.trim() ? visibleMessageListData.length : activeMessages.length;
  const threadSearchTotalMatches = visibleMessageListData.filter((item) => item.type === 'message').length;
  const highlightedSearchMessageId = threadSearchQuery.trim() && threadSearchTotalMatches > 0
    ? (visibleMessageListData[Math.min(threadSearchMatchIndex, threadSearchTotalMatches - 1)]?.id ?? null)
    : null;
  const activeTyping = Boolean(activeConversationId && typingConversationIds[activeConversationId]);
  const activePalette = useMemo(() => {
    const basePalette = getChannelSurface(activeConversation?.channel ?? 'unknown');
    if (!appTheme.darkMode) {
      return basePalette;
    }

    return {
      ...basePalette,
      screen: appTheme.background,
      incoming: appTheme.surface,
      border: appTheme.border,
      composer: appTheme.surface,
      outgoingText: basePalette.outgoingText === '#FFFFFF' ? '#FFFFFF' : appTheme.text,
    };
  }, [activeConversation?.channel, appTheme]);
  const activeMediaItems = useMemo(() => getMediaItemsFromMessages(activeMessages), [activeMessages]);
  const lastSyncedLabel = lastSyncedAt ? `Synced ${formatTime(lastSyncedAt)}` : 'Ready to sync';
  const visibleChannels = useMemo(() => {
    const hasPersonalConversation = conversations.some(
      (c) => c.channel === 'whatsapp' && c.waBackendChannel === 'personal',
    );
    const hasWabaConversation = conversations.some(
      (c) => c.channel === 'whatsapp' && c.waBackendChannel === 'waba',
    );
    const hasLinkedInConversation = conversations.some((c) => c.channel === 'linkedin');
    const hasInstagramConversation = conversations.some((c) => c.channel === 'instagram');
    const hasEmailConversation = conversations.some((c) => c.channel === 'email');

    // While integrations are still loading (or haven't been fetched yet), fall back to showing
    // tabs for channels that already have conversations so the list isn't suddenly empty.
    if (isLoadingIntegrations || !connectedIntegrations.length) {
      return CHANNELS.filter((ch) => {
        if (ch.id === 'all' || ch.id === 'unread') return true;
        if (ch.id === 'personal') return hasPersonalConversation;
        if (ch.id === 'waba') return hasWabaConversation;
        if (ch.id === 'linkedin') return hasLinkedInConversation;
        if (ch.id === 'instagram') return hasInstagramConversation;
        if (ch.id === 'email') return hasEmailConversation;
        return true;
      });
    }
    // Integrations loaded — for WhatsApp (personal + WABA), keep the conversation-based fallback
    // because the WAPA service can be temporarily unreachable or return a non-matching status even
    // when the session is actually live. For third-party channels (LinkedIn, Instagram, Email) we
    // trust the API status directly: those are clean OAuth connections with no ambiguity.
    const personalConnected =
      connectedIntegrations.some((i) => i.label === 'WhatsApp Personal' && i.connected) ||
      hasPersonalConversation;
    const wabaConnected =
      connectedIntegrations.some((i) => i.label === 'WhatsApp API Agent' && i.connected) ||
      hasWabaConversation;
    const linkedInConnected = connectedIntegrations.some((i) => i.channel === 'linkedin' && i.connected);
    const instagramConnected = connectedIntegrations.some((i) => i.channel === 'instagram' && i.connected);
    const emailConnected = connectedIntegrations.some((i) => i.channel === 'email' && i.connected);
    return CHANNELS.filter((ch) => {
      if (ch.id === 'all' || ch.id === 'unread') return true;
      if (ch.id === 'personal') return personalConnected;
      if (ch.id === 'waba') return wabaConnected;
      if (ch.id === 'linkedin') return linkedInConnected;
      if (ch.id === 'instagram') return instagramConnected;
      if (ch.id === 'email') return emailConnected;
      return true;
    });
  }, [connectedIntegrations, isLoadingIntegrations, conversations]);
  const activeFilterOption = CHANNELS.find((channel) => channel.id === activeFilter) ?? CHANNELS[0];
  const activeFilterLabel = activeFilterOption.label;

  // When integrations load and the currently selected channel tab is no longer available
  // (because the integration is disconnected), fall back to 'all'.
  useEffect(() => {
    if (!isLoadingIntegrations && connectedIntegrations.length > 0) {
      if (!visibleChannels.some((ch) => ch.id === activeFilter)) {
        setActiveFilter('all');
      }
    }
  }, [visibleChannels, activeFilter, isLoadingIntegrations, connectedIntegrations]);
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) {
      return chatTemplates;
    }

    return chatTemplates.filter((template) =>
      [template.name, template.body, template.category, template.language]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [chatTemplates, templateSearch]);
  const emptyConversationMessage = conversations.length
    ? `No matches in ${activeFilterLabel}. ${conversations.length} total conversations loaded.`
    : syncError || 'No backend conversations found';

  const [pendingAttachment, setPendingAttachment] = useState<any>(null);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToTop = contentOffset.y <= 100;
    if (isCloseToTop && hasOlderMessages && !isLoadingOlderMessages) {
      getOlderMessages();
    }
  }, [hasOlderMessages, isLoadingOlderMessages, getOlderMessages]);

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (!message || isSending || (activeConversation && lockedIds.has(activeConversation.id))) {
      return;
    }

    emitTypingState(false);
    setDraft('');
    void sendMessage(message);
  }, [activeConversation, draft, emitTypingState, isSending, lockedIds, sendMessage]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    emitTypingState(Boolean(value.trim()));

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    typingTimer.current = setTimeout(() => {
      emitTypingState(false);
    }, 1400);
  }, [emitTypingState]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      emitTypingState(false);
    };
  }, [emitTypingState]);

  const handlePickAttachment = useCallback(async (type: string | string[] = [
    'image/*',
    'video/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]) => {
    if (isUploadingAttachment) {
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const isImageOrVideo = asset.mimeType?.startsWith('image/') || asset.mimeType?.startsWith('video/');
    if (isImageOrVideo && Platform.OS !== 'web') {
      setPendingAttachment(asset);
    } else {
      await sendAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
    }
  }, [isUploadingAttachment, sendAttachment]);

  const confirmPendingAttachment = useCallback(async () => {
    if (!pendingAttachment) return;
    const asset = pendingAttachment;
    setPendingAttachment(null);
    const caption = draft.trim();
    if (caption) {
      setDraft('');
    }
    await sendAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
    }, caption || undefined);
  }, [pendingAttachment, sendAttachment, draft]);

  const loadTemplates = useCallback(async (channel: ChatChannel) => {
    const endpoint = getTemplateEndpoint(channel);
    const fallback = getFallbackTemplates(channel);

    if (!endpoint) {
      setChatTemplates(fallback);
      setTemplatesError(null);
      return;
    }

    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const token = await getAuthToken();
      const response = await fetch(buildApiUrl(endpoint, RESOLVED_API_URL), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      const raw = Array.isArray(data) ? data : data.data ?? data.templates ?? data.items ?? [];
      const normalized = Array.isArray(raw)
        ? raw
            .map((item, index) => normalizeTemplate(item, channel === 'gmail' ? 'email' : channel, index))
            .filter((item): item is ChatTemplate => Boolean(item))
        : [];

      if (normalized.length) {
        setChatTemplates(normalized);
      } else {
        setChatTemplates(fallback);
        setTemplatesError('No saved templates found. Showing quick-start templates.');
      }
    } catch {
      setChatTemplates(fallback);
      setTemplatesError('Could not load saved templates. Showing quick-start templates.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const openTemplateMenu = useCallback(() => {
    const channel = activeConversation?.channel ?? 'whatsapp';
    setQuickActionsOpen(false);
    setTemplateMenuOpen(true);
    setTemplateSearch('');
    void loadTemplates(channel);
  }, [activeConversation?.channel, loadTemplates]);

  const applyTemplate = useCallback((template: ChatTemplate) => {
    setDraft((value) => (value.trim() ? `${value.trim()}\n${template.body}` : template.body));
    setTemplateMenuOpen(false);
  }, []);

  const openQuickComposer = useCallback((action: QuickComposerAction) => {
    setTemplateMenuOpen(false);
    setEmojiPickerOpen(false);
    setQuickActionsOpen(false);
    setQuickComposer(action);
    setQuickDraft((current) => ({
      ...EMPTY_QUICK_DRAFT,
      pollOptions: current.pollOptions || EMPTY_QUICK_DRAFT.pollOptions,
      contactName: action === 'contact' ? activeConversation?.name ?? '' : '',
      contactPhone: action === 'contact' ? activeConversation?.phone ?? '' : '',
      contactEmail: action === 'contact' ? activeConversation?.email ?? '' : '',
    }));
  }, [activeConversation?.email, activeConversation?.name, activeConversation?.phone]);

  const fillCurrentLocation = useCallback(() => {
    const onSuccess = (latitude: number, longitude: number) => {
      setQuickDraft((current) => ({
        ...current,
        locationName: current.locationName || 'Current location',
        locationLink: `https://maps.google.com/?q=${latitude},${longitude}`,
      }));
    };
    const onError = () => {
      setQuickDraft((current) => ({
        ...current,
        locationName: current.locationName || 'Current location',
      }));
    };

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => onSuccess(position.coords.latitude, position.coords.longitude),
          onError,
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        onError();
      }
    } else {
      // Native: use RN's built-in Geolocation (works on Android & iOS)
      const RNGeolocation = require('react-native').Geolocation;
      if (RNGeolocation && typeof RNGeolocation.getCurrentPosition === 'function') {
        RNGeolocation.getCurrentPosition(
          (position: { coords: { latitude: number; longitude: number } }) =>
            onSuccess(position.coords.latitude, position.coords.longitude),
          onError,
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
        );
      } else {
        onError();
      }
    }
  }, []);

  const sendQuickComposerMessage = useCallback(async () => {
    if (!quickComposer || isSending || (activeConversation && lockedIds.has(activeConversation.id))) {
      return;
    }

    const options = quickDraft.pollOptions
      .split(/\n|,/)
      .map((option) => option.trim())
      .filter(Boolean);
    let message = '';

    if (quickComposer === 'location') {
      const label = quickDraft.locationName.trim() || 'Shared location';
      const link = quickDraft.locationLink.trim();
      message = ['Location shared', label, link].filter(Boolean).join('\n');
    }

    if (quickComposer === 'contact') {
      const lines = [
        'Contact card',
        quickDraft.contactName.trim(),
        quickDraft.contactPhone.trim() ? `Phone: ${quickDraft.contactPhone.trim()}` : '',
        quickDraft.contactEmail.trim() ? `Email: ${quickDraft.contactEmail.trim()}` : '',
      ].filter(Boolean);
      message = lines.join('\n');
    }

    if (quickComposer === 'poll') {
      const question = quickDraft.pollQuestion.trim();
      message = [
        `Poll: ${question || 'Please choose one option'}`,
        ...options.map((option, index) => `${index + 1}. ${option}`),
      ].join('\n');
    }

    if (quickComposer === 'event') {
      const lines = [
        `Event: ${quickDraft.eventTitle.trim() || 'Scheduled event'}`,
        quickDraft.eventDate.trim() ? `When: ${quickDraft.eventDate.trim()}` : '',
        quickDraft.eventLocation.trim() ? `Where: ${quickDraft.eventLocation.trim()}` : '',
      ].filter(Boolean);
      message = lines.join('\n');
    }

    if (!message.trim()) {
      return;
    }

    await sendMessage(message);
    setQuickComposer(null);
    setQuickDraft(EMPTY_QUICK_DRAFT);
  }, [activeConversation, isSending, lockedIds, quickComposer, quickDraft, sendMessage]);

  const handleAttachmentAction = useCallback(async (action: AttachmentAction) => {
    setQuickActionsOpen(false);

    switch (action) {
      case 'photos':
        await handlePickAttachment(['image/*', 'video/*']);
        break;
      case 'camera':
        await handlePickAttachment('image/*');
        break;
      case 'document':
        await handlePickAttachment([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ]);
        break;
      case 'audio':
        await handlePickAttachment('audio/*');
        break;
      case 'location':
        openQuickComposer('location');
        break;
      case 'contact':
        openQuickComposer('contact');
        break;
      case 'poll':
        openQuickComposer('poll');
        break;
      case 'template':
        openTemplateMenu();
        break;
      case 'event':
        openQuickComposer('event');
        break;
      default:
        break;
    }
  }, [handlePickAttachment, openQuickComposer, openTemplateMenu]);

  const handleImportLeadsAction = useCallback(async () => {
    setCreateChatMenuOpen(false);
    setCreateChatMode(null);
    setCreateChatNotice(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/pdf',
          'image/*',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const count = result.assets.length;
      setCreateChatNotice(`${count} lead file${count === 1 ? '' : 's'} selected. Sync will refresh contacts from the backend.`);
      await syncConversations({ silent: true, force: true });
    } catch (err) {
      setCreateChatNotice(err instanceof Error && err.message ? err.message : 'Unable to open the lead importer.');
    }
  }, [syncConversations]);

  const handleCreateAction = useCallback(async (action: ChatCreateActionId) => {
    setCreateChatNotice(null);
    setCreateChatSelectedIds(new Set());

    if (action === 'import_leads') {
      await handleImportLeadsAction();
      return;
    }

    setCreateChatMode(action);
    await syncConversations({ silent: true, force: true });
  }, [handleImportLeadsAction, syncConversations]);

  const openCreateChatConversation = useCallback(async (conversation: Conversation) => {
    const mode = createChatMode;
    setCreateChatMenuOpen(false);
    setCreateChatMode(null);
    setCreateChatSearch('');
    setCreateChatSelectedIds(new Set());
    await setActiveConversation(conversation.id);

  }, [createChatMode, setActiveConversation]);

  const toggleCreateChatSelection = useCallback((conversationId: string) => {
    setCreateChatSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }, []);

  const commitCreateChatSelection = useCallback(async () => {
    const selectedIds = Array.from(createChatSelectedIds);
    const selectedConversation = createChatContacts.find((conversation) => createChatSelectedIds.has(conversation.id));

    if (!selectedIds.length || !selectedConversation) {
      setCreateChatNotice('Select at least one contact first.');
      return;
    }

    if (createChatMode !== 'broadcast') {
      await openCreateChatConversation(selectedConversation);
      return;
    }

    const isInstagramGroup = selectedConversation.channel === 'instagram';
    const groupBase = isInstagramGroup
      ? '/api/instagram-conversations/chat-groups'
      : '/api/whatsapp-conversations/chat-groups?channel=personal';
    const addBase = isInstagramGroup
      ? '/api/instagram-conversations/chat-groups'
      : '/api/whatsapp-conversations/chat-groups';
    const addSuffix = isInstagramGroup ? '' : '?channel=personal';
    const groupName = `Broadcast ${new Date().toLocaleDateString('en-IN')}`;

    try {
      const created = await postJsonToBackend(groupBase, {
        name: groupName,
        color: '#10B981',
        description: null,
      });
      const groupId =
        created?.group?.id ||
        created?.data?.id ||
        created?.id;

      if (!groupId) {
        throw new Error('Group was created but the backend did not return an ID.');
      }

      await postJsonToBackend(`${addBase}/${groupId}/conversations${addSuffix}`, {
        conversation_ids: selectedIds,
      });
      setCreateChatMenuOpen(false);
      setCreateChatMode(null);
      setCreateChatSearch('');
      setCreateChatSelectedIds(new Set());
      setCreateChatNotice(`${groupName} created with ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}.`);
      await syncConversations({ silent: true, force: true });
    } catch (err) {
      setCreateChatNotice(err instanceof Error && err.message ? err.message : 'Unable to create the group.');
    }
  }, [createChatContacts, createChatMode, createChatSelectedIds, openCreateChatConversation, syncConversations]);

  const toggleSetValue = useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setIdSetValue = useCallback((
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    enabled: boolean,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (enabled) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const exportActiveConversation = useCallback(async () => {
    if (!activeConversation) {
      return;
    }

    const transcript = activeMessages
      .map((message) => {
        const sender = message.sender === 'agent' ? 'Agent' : activeConversation.name;
        return `[${formatTime(message.createdAt)}] ${sender}: ${message.content}`;
      })
      .join('\n');
    const fileName = `${activeConversation.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'chat'}-conversation.txt`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([transcript || 'No messages yet'], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    await Share.share({
      title: fileName,
      message: transcript || 'No messages yet',
    });
  }, [activeConversation, activeMessages]);

  const handleMenuAction = useCallback((action: MenuAction) => {
    if (!activeConversation) {
      return;
    }

    const { id } = activeConversation;

    switch (action) {
      case 'star':
        toggleSetValue(setStarredIds, id);
        break;
      case 'pin':
        toggleSetValue(setPinnedIds, id);
        break;
      case 'resolve':
        toggleSetValue(setResolvedIds, id);
        break;
      case 'mute':
        toggleSetValue(setMutedIds, id);
        break;
      case 'lock':
        toggleSetValue(setLockedIds, id);
        break;
      case 'export':
        void exportActiveConversation();
        break;
      case 'block':
        setBlockedIds((current) => new Set(current).add(id));
        clearActiveConversation();
        break;
      case 'delete':
        setDeletedIds((current) => new Set(current).add(id));
        clearActiveConversation();
        break;
      default:
        break;
    }

    setActionsOpen(false);
  }, [activeConversation, clearActiveConversation, exportActiveConversation, toggleSetValue]);

  const openContactMediaLibrary = useCallback((tab: ChatMediaKind = 'media') => {
    setMediaLibraryInitialTab(tab);
    setMediaLibraryOpen(true);
    setActionsOpen(false);
  }, []);

  const openContactSearch = useCallback(() => {
    setDetailsOpen(false);
    setMediaLibraryOpen(false);
    setActionsOpen(false);
    setThreadSearchOpen(true);
  }, []);

  const handleOpenStarredMessages = useCallback(() => {
    if (!activeConversation) return;
    Alert.alert(
      'Starred messages',
      starredIds.has(activeConversation.id)
        ? 'This conversation is saved in favourites. Message-level starred items are not available from the mobile backend yet.'
        : 'No starred messages are available for this chat yet.',
    );
  }, [activeConversation, starredIds]);

  const handleToggleFavourite = useCallback(() => {
    if (!activeConversation) return;
    const { id } = activeConversation;
    const nextFavourite = !starredIds.has(id);
    setIdSetValue(setStarredIds, id, nextFavourite);
    void patchWhatsAppConversationAction(id, 'favorite')
      .then(() => syncConversations({ silent: true, force: true }))
      .catch((error) => {
        setIdSetValue(setStarredIds, id, !nextFavourite);
        Alert.alert('Favourite not updated', getActionErrorMessage(error, 'Unable to update favourite status.'));
      });
  }, [activeConversation, setIdSetValue, starredIds, syncConversations]);

  const handleToggleList = useCallback(() => {
    if (!activeConversation) return;
    const { id } = activeConversation;
    const nextListed = !pinnedIds.has(id);
    setIdSetValue(setPinnedIds, id, nextListed);
    void patchWhatsAppConversationAction(id, 'pin')
      .then(() => syncConversations({ silent: true, force: true }))
      .catch((error) => {
        setIdSetValue(setPinnedIds, id, !nextListed);
        Alert.alert('List not updated', getActionErrorMessage(error, 'Unable to update list status.'));
      });
  }, [activeConversation, pinnedIds, setIdSetValue, syncConversations]);

  const handleToggleMute = useCallback(() => {
    if (!activeConversation) return;
    toggleSetValue(setMutedIds, activeConversation.id);
  }, [activeConversation, toggleSetValue]);

  const handleTogglePrivacy = useCallback(() => {
    if (!activeConversation) return;
    const { id } = activeConversation;
    const nextLocked = !lockedIds.has(id);
    setIdSetValue(setLockedIds, id, nextLocked);
    void patchWhatsAppConversationAction(id, 'lock')
      .then(() => syncConversations({ silent: true, force: true }))
      .catch((error) => {
        setIdSetValue(setLockedIds, id, !nextLocked);
        Alert.alert('Privacy not updated', getActionErrorMessage(error, 'Unable to update chat privacy.'));
      });
  }, [activeConversation, lockedIds, setIdSetValue, syncConversations]);

  const handleOpenDisappearingMessages = useCallback(() => {
    Alert.alert('Disappearing messages', 'Disappearing messages are currently off for LAD WhatsApp chats.');
  }, []);

  const handleVerifyEncryption = useCallback(() => {
    if (!activeConversation) return;
    Alert.alert(
      'Encryption',
      `${activeConversation.name} messages are protected by the WhatsApp/LAD backend transport. Verification details are managed by the backend contact profile.`,
    );
  }, [activeConversation]);

  const handleClearChat = useCallback(() => {
    if (!activeConversation) return;
    const { id, name } = activeConversation;
    Alert.alert(
      'Clear chat?',
      `Clear visible messages with ${name}? Backend history can be loaded again with refresh.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearConversationMessages(id);
            setDetailsOpen(false);
          },
        },
      ],
    );
  }, [activeConversation, clearConversationMessages]);

  const handleBlockContact = useCallback(() => {
    if (!activeConversation) return;
    const { id, name } = activeConversation;
    Alert.alert(
      'Block contact?',
      `Block ${name} and hide this chat from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await patchWhatsAppConversationAction(id, 'status', { status: 'resolved' });
              setBlockedIds((current) => new Set(current).add(id));
              clearActiveConversation();
              setDetailsOpen(false);
            } catch (error) {
              Alert.alert('Block failed', getActionErrorMessage(error, 'Unable to block this contact.'));
            }
          },
        },
      ],
    );
  }, [activeConversation, clearActiveConversation]);

  const handleReportContact = useCallback(() => {
    if (!activeConversation) return;
    Alert.alert(
      'Report contact?',
      `Send ${activeConversation.name} to LAD support for review?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiPost('/api/contact', {
                name: currentUser?.name || 'LAD mobile app user',
                email: currentUser?.email || 'support@techiemaya.com',
                subject: `Reported WhatsApp chat: ${activeConversation.name}`,
                message: [
                  `Conversation ID: ${activeConversation.id}`,
                  `Contact: ${activeConversation.name}`,
                  activeConversation.phone ? `Phone: ${activeConversation.phone}` : '',
                  activeConversation.email ? `Email: ${activeConversation.email}` : '',
                  `Channel: ${activeConversation.channel}`,
                ].filter(Boolean).join('\n'),
                source: 'lad-app-whatsapp-contact-info',
              });
              Alert.alert('Report sent', 'LAD support has received this chat report.');
            } catch (error) {
              Alert.alert('Report failed', getActionErrorMessage(error, 'Unable to send this report right now.'));
            }
          },
        },
      ],
    );
  }, [activeConversation, currentUser?.email, currentUser?.name]);

  const handleDeleteChat = useCallback(() => {
    if (!activeConversation) return;
    const { id, name } = activeConversation;
    Alert.alert(
      'Delete chat?',
      `Delete ${name} from this chat list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWhatsAppConversationFromBackend(id);
              setDeletedIds((current) => new Set(current).add(id));
              clearActiveConversation();
              setDetailsOpen(false);
            } catch (error) {
              Alert.alert('Delete failed', getActionErrorMessage(error, 'Unable to delete this chat.'));
            }
          },
        },
      ],
    );
  }, [activeConversation, clearActiveConversation]);

  const switchAgentMode = useCallback(async (mode: AgentMode) => {
    if (!activeConversation || agentModeUpdating || mode === agentMode) {
      return;
    }

    if (mode === 'human' && agentMode === 'ai') {
      const confirmed = await confirmHumanTakeover();
      if (!confirmed) {
        setAgentMenuOpen(false);
        return;
      }
    }

    setAgentMenuOpen(false);
    setCreateChatNotice(null);
    setAgentModeUpdating(true);

    try {
      await assignConversationHandler(activeConversation.id, {
        handler: mode,
        humanAgentId: mode === 'human' ? currentUser?.id ?? null : null,
      });
      setAgentMode(mode);
      await setActiveConversation(activeConversation.id, { force: true });
      setCreateChatNotice(
        mode === 'human'
          ? 'Human agent mode is active. The AI will stay paused until you switch back.'
          : 'AI agent is now handling this conversation.',
      );
    } catch (modeError) {
      setCreateChatNotice(modeError instanceof Error ? modeError.message : 'Unable to switch conversation handler.');
    } finally {
      setAgentModeUpdating(false);
    }
  }, [activeConversation, agentMode, agentModeUpdating, currentUser?.id, setActiveConversation]);

  useEffect(() => {
    setDetailsOpen(false);
    setMediaLibraryOpen(false);
    setMediaLibraryInitialTab('media');
    setActionsOpen(false);
    setCreateChatMenuOpen(false);
    setCreateChatNotice(null);
    setCreateChatMode(null);
    setCreateChatSearch('');
    setCreateChatSelectedIds(new Set());
    setQuickActionsOpen(false);
    setAgentMenuOpen(false);
    setTemplateMenuOpen(false);
    setQuickComposer(null);
    setEmojiPickerOpen(false);
    setThreadSearchOpen(false);
    setThreadSearchQuery('');
  }, [activeConversationId]);

  const closeCreateChatMenu = useCallback(() => {
    setCreateChatMenuOpen(false);
    setCreateChatMode(null);
    setCreateChatSearch('');
    setCreateChatSelectedIds(new Set());
  }, []);

  const closeConversationListPopups = useCallback(() => {
    setFilterDropdownOpen(false);
    closeCreateChatMenu();
  }, [closeCreateChatMenu]);

  const closeComposerPopups = useCallback(() => {
    setAgentMenuOpen(false);
    setQuickActionsOpen(false);
    setTemplateMenuOpen(false);
    setQuickComposer(null);
    setEmojiPickerOpen(false);
  }, []);

  const closeThreadSearch = useCallback(() => {
    setThreadSearchOpen(false);
    setThreadSearchQuery('');
    setThreadSearchMatchIndex(0);
  }, []);

  const closeThreadPopups = useCallback(() => {
    setActionsOpen(false);
    closeThreadSearch();
    closeComposerPopups();
  }, [closeComposerPopups, closeThreadSearch]);

  const navigateSearchMatch = useCallback((direction: 'up' | 'down') => {
    const total = visibleMessageListData.filter((item) => item.type === 'message').length;
    if (!total) return;
    setThreadSearchMatchIndex((prev) => {
      const next = direction === 'down'
        ? (prev + 1) % total
        : (prev - 1 + total) % total;
      messageListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
      return next;
    });
  }, [visibleMessageListData]);

  const startVoiceRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is needed to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }, []);

  const stopVoiceRecording = useCallback(async (discard = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
    } catch { /* already stopped */ }
    if (discard) {
      setRecordingDuration(0);
      return;
    }
    const uri = rec.getURI();
    if (!uri) return;
    setPendingVoiceNote({ uri, durationSec: recordingDuration });
    setRecordingDuration(0);
  }, [recordingDuration]);

  const sendVoiceNote = useCallback(async () => {
    if (!pendingVoiceNote) return;
    const { uri } = pendingVoiceNote;
    setPendingVoiceNote(null);
    setPendingVoiceNotePlaying(false);
    if (pendingVoiceNoteSoundRef.current) {
      await pendingVoiceNoteSoundRef.current.stopAsync().catch(() => undefined);
      await pendingVoiceNoteSoundRef.current.unloadAsync().catch(() => undefined);
      pendingVoiceNoteSoundRef.current = null;
    }
    await sendAttachment({ uri, name: `voice_${Date.now()}.m4a`, mimeType: 'audio/m4a' });
  }, [pendingVoiceNote, sendAttachment]);

  const togglePendingVoiceNotePlayback = useCallback(async () => {
    if (!pendingVoiceNote) return;
    if (pendingVoiceNotePlaying) {
      await pendingVoiceNoteSoundRef.current?.pauseAsync().catch(() => undefined);
      setPendingVoiceNotePlaying(false);
      return;
    }
    if (!pendingVoiceNoteSoundRef.current) {
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: pendingVoiceNote.uri });
        pendingVoiceNoteSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPendingVoiceNotePlaying(false);
            pendingVoiceNoteSoundRef.current = null;
          }
        });
      } catch {
        return;
      }
    }
    await pendingVoiceNoteSoundRef.current?.playAsync().catch(() => undefined);
    setPendingVoiceNotePlaying(true);
  }, [pendingVoiceNote, pendingVoiceNotePlaying]);

  const toggleMessagePlayback = useCallback(async (messageId: string, audioUrl: string) => {
    if (playingMessageId === messageId) {
      await activeSoundRef.current?.pauseAsync().catch(() => undefined);
      setPlayingMessageId(null);
      return;
    }
    if (activeSoundRef.current) {
      await activeSoundRef.current.stopAsync().catch(() => undefined);
      await activeSoundRef.current.unloadAsync().catch(() => undefined);
      activeSoundRef.current = null;
    }
    setPlayingMessageId(messageId);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      activeSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingMessageId(null);
          activeSoundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch {
      setPlayingMessageId(null);
    }
  }, [playingMessageId]);

  const showBottomTabs = useCallback(() => {
    forceBottomTabHidden(false);
    setBottomTabHidden(false);
  }, []);

  const closeActiveChatSession = useCallback(() => {
    setDetailsOpen(false);
    setMediaLibraryOpen(false);
    setPendingAttachment(null);
    closeThreadPopups();
    clearActiveConversation();
    showBottomTabs();
  }, [clearActiveConversation, closeThreadPopups, showBottomTabs]);

  const handleChatsBackRequest = useCallback(() => {
    if (!isChatFocused) {
      return false;
    }

    if (mediaLibraryOpen) {
      setMediaLibraryOpen(false);
      return true;
    }

    if (detailsOpen) {
      setDetailsOpen(false);
      return true;
    }

    if (pendingAttachment) {
      setPendingAttachment(null);
      return true;
    }

    if (
      actionsOpen ||
      threadSearchOpen ||
      agentMenuOpen ||
      quickActionsOpen ||
      templateMenuOpen ||
      quickComposer ||
      emojiPickerOpen
    ) {
      closeThreadPopups();
      return true;
    }

    if (activeConversationId) {
      closeActiveChatSession();
      return true;
    }

    if (filterDropdownOpen) {
      setFilterDropdownOpen(false);
      return true;
    }

    if (createChatMenuOpen || createChatMode) {
      closeCreateChatMenu();
      return true;
    }

    return false;
  }, [
    activeConversationId,
    actionsOpen,
    agentMenuOpen,
    closeActiveChatSession,
    closeCreateChatMenu,
    closeThreadPopups,
    createChatMenuOpen,
    createChatMode,
    detailsOpen,
    emojiPickerOpen,
    filterDropdownOpen,
    isChatFocused,
    mediaLibraryOpen,
    pendingAttachment,
    quickActionsOpen,
    quickComposer,
    templateMenuOpen,
    threadSearchOpen,
  ]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleChatsBackRequest);
      return () => subscription.remove();
    }, [handleChatsBackRequest]),
  );

  useFocusEffect(
    useCallback(() => {
      void fetchConnectedIntegrations();
    }, [fetchConnectedIntegrations]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (handleChatsBackRequest()) {
        event.preventDefault();
      }
    });

    return unsubscribe;
  }, [handleChatsBackRequest, navigation]);

  const renderMessage = useCallback(({ item }: { item: MessageListItem }) => {
    if (item.type === 'date') {
      return (
        <View
          style={[
            styles.dateSeparator,
            {
              backgroundColor: appTheme.darkMode ? 'rgba(15, 23, 42, 0.72)' : 'rgba(247, 233, 212, 0.92)',
              borderColor: appTheme.darkMode ? 'rgba(248, 250, 252, 0.16)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <Typography
            variant="bodySmall"
            color={appTheme.darkMode ? '#F8FAFC' : '#000000'}
            style={styles.dateSeparatorText}
          >
            {item.label}
          </Typography>
        </View>
      );
    }

    return (
      <MessageBubble
        message={item.message}
        channel={activeConversation?.channel ?? item.message.channel}
        contactName={activeConversation?.name ?? 'Lead'}
        contactAvatar={activeConversation?.avatar}
        authToken={authToken}
        onPlayAudio={toggleMessagePlayback}
        isCurrentlyPlaying={playingMessageId === item.message.id}
      />
    );
  }, [activeConversation?.avatar, activeConversation?.channel, activeConversation?.name, appTheme.darkMode, authToken, playingMessageId, toggleMessagePlayback]);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <ConversationRow
      conversation={item}
      isActive={activeConversationId === item.id}
      onPress={() => void setActiveConversation(item.id)}
    />
  ), [activeConversationId, setActiveConversation]);

  if (activeConversation) {
    const presenceLabel = activeTyping ? 'Typing...' : activeConversation.online ? 'Online' : 'Offline';
    const showSideDetails = detailsOpen && width >= 900;
    const showOverlayDetails = detailsOpen && width < 900;
    const isResolved = resolvedIds.has(activeConversation.id);
    const isMuted = mutedIds.has(activeConversation.id);
    const isLocked = lockedIds.has(activeConversation.id);
    const isPinned = pinnedIds.has(activeConversation.id);
    const isStarred = starredIds.has(activeConversation.id);
    const isLinkedInThread = isLinkedInChannel(activeConversation.channel);
    const isEmailThread = isEmailChannel(activeConversation.channel);
    const isWhatsAppThread = isWhatsAppChannel(activeConversation.channel);
    const composerBottomPadding = isKeyboardVisible ? 12 : Math.max(insets.bottom, 12);
    const floatingMenuBottom = composerBottomPadding + 62;
    const composerPopupOpen = agentMenuOpen || quickActionsOpen || templateMenuOpen || Boolean(quickComposer) || emojiPickerOpen;
    const ThreadSurface = (isWhatsAppThread ? ImageBackground : View) as React.ComponentType<any>;
    const threadSurfaceProps = isWhatsAppThread
      ? {
          source: appTheme.darkMode ? CHAT_DARK_BACKGROUND_IMAGE : CHAT_LIGHT_BACKGROUND_IMAGE,
          resizeMode: Platform.OS === 'web' ? 'repeat' as const : 'cover' as const,
          imageStyle: styles.threadBackgroundImage,
        }
      : {};

    const KeyboardContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const keyboardProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

    return (
      <KeyboardContainer
        {...keyboardProps}
        style={[styles.container, { backgroundColor: activePalette.screen }]}
      >
        <Reanimated.View entering={FadeIn.duration(220)} style={styles.threadLayout}>
          <View style={styles.threadMain}>
            <View style={[styles.threadHeaderDark, { paddingTop: insets.top, backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
              <TouchableOpacity onPress={closeActiveChatSession} style={styles.darkIconButton} activeOpacity={0.7}>
                <ArrowLeft color={appTheme.text} size={22} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setDetailsOpen((value) => !value)}
                style={styles.threadIdentity}
                activeOpacity={0.78}
              >
                <View style={styles.threadAvatarWrap}>
                  <Avatar src={activeConversation.avatar} fallback={getInitials(activeConversation.name)} size={32} />
                  <View style={styles.threadChannelDot}>
                    <ChannelGlyph channel={activeConversation.channel} size={6} color={getChannelColor(activeConversation.channel)} />
                  </View>
                </View>
                <View style={styles.threadTitleBlock}>
                  <View style={styles.threadTitleLine}>
                    <Typography variant="h4" numberOfLines={1} color={appTheme.text} style={styles.threadTitle}>
                      {activeConversation.name}
                    </Typography>
                    {isStarred ? <Star color={appTheme.primaryAccent} size={14} /> : null}
                    {isPinned ? <Pin color={appTheme.primaryAccent} size={14} /> : null}
                    {isMuted ? <VolumeX color={appTheme.primaryAccent} size={14} /> : null}
                    {isLocked ? <Lock color={appTheme.primaryAccent} size={14} /> : null}
                  </View>
                  <View style={styles.threadSubtitle}>
                    <View style={[styles.presenceDot, activeConversation.online && styles.presenceDotOnline]} />
                    <Typography variant="caption" color={appTheme.muted}>
                      {presenceLabel}
                    </Typography>
                    {isResolved ? (
                      <Typography variant="caption" color={Theme.colors.success}>
                        Resolved
                      </Typography>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.threadHeaderActions}>
                <TouchableOpacity
                  style={[styles.darkIconButton, threadSearchOpen && { backgroundColor: appTheme.infoSoft }]}
                  activeOpacity={0.75}
                  onPress={() => {
                    closeComposerPopups();
                    setActionsOpen(false);
                    setThreadSearchOpen((value) => !value);
                  }}
                >
                  <Search color={appTheme.muted} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDetailsOpen((value) => !value)} style={styles.darkIconButton} activeOpacity={0.75}>
                  <Users color={appTheme.muted} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void setActiveConversation(activeConversation.id, { force: true })} style={styles.darkIconButton} activeOpacity={0.75}>
                  <RefreshCw color={appTheme.muted} size={19} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    closeComposerPopups();
                    closeThreadSearch();
                    setActionsOpen((value) => !value);
                  }}
                  style={styles.darkIconButton}
                  activeOpacity={0.75}
                >
                  <MoreVertical color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>
            </View>

            {actionsOpen ? (
              <Pressable style={styles.threadDismissLayer} onPress={() => setActionsOpen(false)} />
            ) : null}
            {actionsOpen && (
              <View style={[styles.actionMenu, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                <ActionMenuItem
                  icon={Star}
                  label={isStarred ? 'Unstar conversation' : 'Star conversation'}
                  onPress={() => handleMenuAction('star')}
                />
                <ActionMenuItem
                  icon={Pin}
                  label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                  onPress={() => handleMenuAction('pin')}
                />
                <ActionMenuItem
                  icon={CircleCheck}
                  label={isResolved ? 'Reopen conversation' : 'Mark as resolved'}
                  onPress={() => handleMenuAction('resolve')}
                />
                <ActionMenuItem
                  icon={VolumeX}
                  label={isMuted ? 'Unmute conversation' : 'Mute conversation'}
                  onPress={() => handleMenuAction('mute')}
                />
                <ActionMenuItem
                  icon={Lock}
                  label={isLocked ? 'Unlock conversation' : 'Lock conversation'}
                  onPress={() => handleMenuAction('lock')}
                />
                <ActionMenuItem icon={Download} label="Export chat" onPress={() => handleMenuAction('export')} />
                <View style={styles.actionMenuDangerDivider} />
                <ActionMenuItem icon={ShieldOff} label="Block contact" color="#FF3B91" onPress={() => handleMenuAction('block')} />
                <ActionMenuItem icon={Trash2} label="Delete conversation" color="#FF3B91" onPress={() => handleMenuAction('delete')} />
              </View>
            )}

            {error && error !== 'Feature not found' && (
              <View style={styles.errorStrip}>
                <Typography variant="bodySmall" color={Theme.colors.error}>
                  {error.includes('Personal WhatsApp') ? 'Service unavailable. Please try again.' : error.length > 80 ? 'An unexpected error occurred. Please try again.' : error}
                </Typography>
              </View>
            )}

            {threadSearchOpen && (
              <View style={[styles.threadSearchPanel, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
                <View style={[styles.threadSearchInputWrap, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}>
                  <Search color={appTheme.disabled} size={17} />
                  <TextInput
                    value={threadSearchQuery}
                    onChangeText={(text) => {
                      setThreadSearchQuery(text);
                      setThreadSearchMatchIndex(0);
                    }}
                    placeholder="Search in conversation"
                    placeholderTextColor={appTheme.disabled}
                    style={[styles.threadSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                    autoFocus
                  />
                  {threadSearchQuery.trim() ? (
                    <Typography variant="caption" color={appTheme.muted} style={styles.threadSearchCounter}>
                      {threadSearchTotalMatches === 0 ? '0/0' : `${Math.min(threadSearchMatchIndex + 1, threadSearchTotalMatches)}/${threadSearchTotalMatches}`}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color={appTheme.muted} style={styles.threadSearchCounter}>
                      {threadSearchMatchCount}
                    </Typography>
                  )}
                  {threadSearchQuery.trim() ? (
                    <>
                      <TouchableOpacity
                        onPress={() => navigateSearchMatch('up')}
                        style={styles.threadSearchNav}
                        disabled={threadSearchTotalMatches === 0}
                        activeOpacity={0.7}
                      >
                        <ChevronUp color={threadSearchTotalMatches > 0 ? appTheme.text : appTheme.disabled} size={20} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => navigateSearchMatch('down')}
                        style={styles.threadSearchNav}
                        disabled={threadSearchTotalMatches === 0}
                        activeOpacity={0.7}
                      >
                        <ChevronDown color={threadSearchTotalMatches > 0 ? appTheme.text : appTheme.disabled} size={20} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                  <TouchableOpacity
                    onPress={closeThreadSearch}
                    style={styles.threadSearchClose}
                    activeOpacity={0.7}
                  >
                    <X color={appTheme.muted} size={17} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <ThreadSurface
              {...threadSurfaceProps}
              style={[
                styles.threadBackground,
                isLinkedInThread && styles.linkedinThreadBackground,
                isEmailThread && styles.emailThreadBackground,
                { backgroundColor: activePalette.screen },
              ]}
            >
              {isEmailThread && (
                <View style={[styles.emailThreadBanner, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
                  <Mail color="#D93025" size={20} />
                  <View style={styles.emailThreadBannerText}>
                    <Typography variant="h4" color={appTheme.text} numberOfLines={1}>
                      {activeConversation.name}
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                      Mail conversation - replies are sent as email
                    </Typography>
                  </View>
                </View>
              )}
              <FlatList
                ref={messageListRef}
                data={visibleMessageListData}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                inverted
                onEndReached={() => void getOlderMessages()}
                onEndReachedThreshold={0.25}
                style={styles.messageListSurface}
                scrollEventThrottle={16}
                onScrollToIndexFailed={() => undefined}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.messageListDark,
                  isLinkedInThread && styles.linkedinMessageList,
                  isEmailThread && styles.emailMessageList,
                ]}
                ListFooterComponent={
                  isLoadingOlderMessages ? (
                    <ActivityIndicator color={appTheme.primaryAccent} style={styles.olderLoader} />
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptyThread}>
                    {isLoadingMessages ? (
                      <Reanimated.View entering={FadeIn.duration(300)} style={{ width: '100%', padding: 16 }}>
                        <SkeletonMessageBlock />
                        <SkeletonMessageBlock isSender />
                        <SkeletonMessageBlock />
                        <SkeletonMessageBlock isSender />
                        <SkeletonMessageBlock />
                      </Reanimated.View>
                    ) : (
                      <Typography variant="body" color={appTheme.disabled}>
                        No messages yet
                      </Typography>
                    )}
                  </View>
                }
                initialNumToRender={16}
                maxToRenderPerBatch={12}
                windowSize={9}
                removeClippedSubviews={Platform.OS !== 'web'}
              />

              {threadSearchOpen ? (
                <Pressable style={styles.threadSearchDismissLayer} onPress={closeThreadSearch} />
              ) : null}

              {activeTyping && (
                <View style={styles.typingPillDark}>
                  <View style={[styles.typingDot, { backgroundColor: getChannelColor(activeConversation.channel) }]} />
                  <Typography variant="caption" color={appTheme.muted}>
                    {activeConversation.name} is typing
                  </Typography>
                </View>
              )}
            </ThreadSurface>

            {composerPopupOpen ? (
              <Pressable style={styles.threadComposerDismissLayer} onPress={closeComposerPopups} />
            ) : null}

            <View
              style={[
                styles.composerShellDark,
                isLinkedInThread && styles.linkedinComposerShell,
                isEmailThread && styles.emailComposerShell,
                { paddingBottom: composerBottomPadding + 8, backgroundColor: activePalette.composer, borderTopColor: activePalette.border },
              ]}
            >
              {agentMenuOpen && (
                <View style={[styles.agentMenu, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  <TouchableOpacity
                    style={[styles.agentMenuItem, { backgroundColor: appTheme.input }, agentMode === 'ai' && styles.agentMenuItemActive]}
                    activeOpacity={0.78}
                    disabled={agentModeUpdating || agentMode === 'ai'}
                    onPress={() => void switchAgentMode('ai')}
                  >
                    {agentModeUpdating && agentMode !== 'ai' ? (
                      <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                    ) : (
                      <AIAgentIcon color={agentMode === 'ai' ? Theme.colors.surface : appTheme.muted} size={18} />
                    )}
                    <Typography variant="bodySmall" color={agentMode === 'ai' ? Theme.colors.surface : appTheme.text}>
                      AI Agent
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.agentMenuItem, { backgroundColor: appTheme.input }, agentMode === 'human' && styles.agentMenuItemActive]}
                    activeOpacity={0.78}
                    disabled={agentModeUpdating || agentMode === 'human'}
                    onPress={() => void switchAgentMode('human')}
                  >
                    {agentModeUpdating && agentMode !== 'human' ? (
                      <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                    ) : (
                      <UserRound color={agentMode === 'human' ? Theme.colors.surface : appTheme.muted} size={18} />
                    )}
                    <Typography variant="bodySmall" color={agentMode === 'human' ? Theme.colors.surface : appTheme.text}>
                      Human Agent
                    </Typography>
                  </TouchableOpacity>
                </View>
              )}

              {quickActionsOpen && (
                <View style={[styles.quickActionMenu, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  <Typography variant="caption" color={appTheme.muted} style={styles.quickActionTitle}>
                    ATTACH
                  </Typography>
                  <View style={styles.quickActionGrid}>
                    {ATTACHMENT_ACTIONS.map((action) => (
                      <AttachmentActionButton
                        key={action.id}
                        icon={action.icon}
                        label={action.label}
                        color={action.color}
                        onPress={() => void handleAttachmentAction(action.id)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {templateMenuOpen && (
                <View style={[styles.templateMenu, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  <View style={styles.templateMenuHeader}>
                    <View>
                      <Typography variant="caption" color={appTheme.muted} style={styles.quickActionTitle}>
                        TEMPLATES
                      </Typography>
                      <Typography variant="caption" color={appTheme.muted}>
                        {activeConversation ? getChannelLabel(activeConversation.channel) : 'Chat'} message templates
                      </Typography>
                    </View>
                    <TouchableOpacity onPress={() => setTemplateMenuOpen(false)} style={[styles.templateCloseButton, { backgroundColor: appTheme.softSurface }]} activeOpacity={0.7}>
                      <X color={appTheme.muted} size={18} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.templateSearchBox, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}>
                    <Search color={appTheme.disabled} size={16} />
                    <TextInput
                      value={templateSearch}
                      onChangeText={setTemplateSearch}
                      placeholder="Search templates..."
                      placeholderTextColor={appTheme.disabled}
                      style={[styles.templateSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                    />
                  </View>

                  {templatesError && (
                    <Typography variant="caption" color={appTheme.muted} style={styles.templateHint}>
                      {templatesError}
                    </Typography>
                  )}

                  {templatesLoading ? (
                    <View style={styles.templateLoadingRow}>
                      <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                      <Typography variant="caption" color={appTheme.muted}>Loading templates...</Typography>
                    </View>
                  ) : filteredTemplates.length ? (
                    <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      {filteredTemplates.map((template) => (
                        <TouchableOpacity
                          key={template.id}
                          style={[styles.templateItem, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}
                          onPress={() => applyTemplate(template)}
                          activeOpacity={0.78}
                        >
                          <View style={styles.templateItemTop}>
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.templateName} numberOfLines={1}>
                              {template.name}
                            </Typography>
                            {template.category && (
                              <View style={[styles.templateBadge, appTheme.darkMode && { backgroundColor: appTheme.infoSoft }]}>
                                <Typography
                                  variant="caption"
                                  color={appTheme.darkMode ? '#F8FAFC' : '#0A66C2'}
                                  style={styles.templateBadgeText}
                                  numberOfLines={1}
                                >
                                  {template.category}
                                </Typography>
                              </View>
                            )}
                          </View>
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={2}>
                            {template.body}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Typography variant="caption" color={appTheme.muted} style={styles.templateEmptyText}>
                      No templates match your search.
                    </Typography>
                  )}
                </View>
              )}

              {quickComposer && (
                <View style={[styles.quickComposerMenu, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  <View style={styles.templateMenuHeader}>
                    <View>
                      <Typography variant="caption" color={appTheme.muted} style={styles.quickActionTitle}>
                        {quickComposer.toUpperCase()}
                      </Typography>
                      <Typography variant="caption" color={appTheme.muted}>
                        Send structured {quickComposer} data in this conversation
                      </Typography>
                    </View>
                    <TouchableOpacity onPress={() => setQuickComposer(null)} style={[styles.templateCloseButton, { backgroundColor: appTheme.softSurface }]} activeOpacity={0.7}>
                      <X color={appTheme.muted} size={18} />
                    </TouchableOpacity>
                  </View>

                  {quickComposer === 'location' && (
                    <>
                      <TextInput
                        value={quickDraft.locationName}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, locationName: value }))}
                        placeholder="Location name"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.locationLink}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, locationLink: value }))}
                        placeholder="Map link or address"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TouchableOpacity onPress={fillCurrentLocation} style={[styles.quickComposerGhostButton, { borderColor: appTheme.border }]} activeOpacity={0.78}>
                        <MapPin color={appTheme.primaryAccent} size={16} />
                        <Typography variant="bodySmall" color={appTheme.text}>Use current location</Typography>
                      </TouchableOpacity>
                    </>
                  )}

                  {quickComposer === 'contact' && (
                    <>
                      <TextInput
                        value={quickDraft.contactName}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, contactName: value }))}
                        placeholder="Contact name"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.contactPhone}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, contactPhone: value }))}
                        placeholder="Phone number"
                        placeholderTextColor={appTheme.disabled}
                        keyboardType="phone-pad"
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.contactEmail}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, contactEmail: value }))}
                        placeholder="Email address"
                        placeholderTextColor={appTheme.disabled}
                        keyboardType="email-address"
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                    </>
                  )}

                  {quickComposer === 'poll' && (
                    <>
                      <TextInput
                        value={quickDraft.pollQuestion}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, pollQuestion: value }))}
                        placeholder="Poll question"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.pollOptions}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, pollOptions: value }))}
                        placeholder="Options, one per line"
                        placeholderTextColor={appTheme.disabled}
                        multiline
                        style={[styles.quickComposerInput, styles.quickComposerTextarea, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                    </>
                  )}

                  {quickComposer === 'event' && (
                    <>
                      <TextInput
                        value={quickDraft.eventTitle}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, eventTitle: value }))}
                        placeholder="Event title"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.eventDate}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, eventDate: value }))}
                        placeholder="Date and time"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                      <TextInput
                        value={quickDraft.eventLocation}
                        onChangeText={(value) => setQuickDraft((current) => ({ ...current, eventLocation: value }))}
                        placeholder="Event location or meeting link"
                        placeholderTextColor={appTheme.disabled}
                        style={[styles.quickComposerInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
                      />
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => void sendQuickComposerMessage()}
                    style={[styles.quickComposerSendButton, (isSending || isLocked) && styles.sendButtonDisabled]}
                    disabled={isSending || isLocked}
                    activeOpacity={0.82}
                  >
                    {isSending ? (
                      <ActivityIndicator color={Theme.colors.surface} size="small" />
                    ) : (
                      <>
                        <Send color={Theme.colors.surface} size={17} />
                        <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.quickComposerSendText}>
                          Send {quickComposer}
                        </Typography>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {emojiPickerOpen && (
                <View style={[styles.emojiPickerPanel, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  {/* Search bar */}
                  <View style={[styles.emojiSearchBar, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}>
                    <Search color={appTheme.disabled} size={14} />
                    <TextInput
                      value={emojiSearch}
                      onChangeText={setEmojiSearch}
                      placeholder="Search emoji"
                      placeholderTextColor={appTheme.disabled}
                      style={[styles.emojiSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                    />
                    {emojiSearch ? (
                      <TouchableOpacity onPress={() => setEmojiSearch('')} activeOpacity={0.7}>
                        <X color={appTheme.disabled} size={14} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Category tabs */}
                  {!emojiSearch ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryRow} contentContainerStyle={styles.emojiCategoryRowContent}>
                      {EMOJI_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setEmojiCategory(cat.id)}
                          style={[styles.emojiCategoryTab, emojiCategory === cat.id && { borderBottomColor: '#00A884', borderBottomWidth: 2 }]}
                          activeOpacity={0.7}
                        >
                          <Typography style={styles.emojiCategoryIcon}>{cat.icon}</Typography>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}

                  {/* Emoji grid */}
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.emojiGridScroll} nestedScrollEnabled>
                    <View style={styles.emojiGrid}>
                      {(emojiSearch
                        ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((_, i, arr) => arr.indexOf(_) === i).slice(0, 120)
                        : EMOJI_CATEGORIES.find((c) => c.id === emojiCategory)?.emojis ?? EMOJI_CATEGORIES[0].emojis
                      ).map((emoji, idx) => (
                        <TouchableOpacity
                          key={`${emojiCategory}-${idx}`}
                          style={[styles.emojiButton, { backgroundColor: appTheme.input }]}
                          onPress={() => setDraft((value) => `${value}${emoji}`)}
                          activeOpacity={0.7}
                        >
                          <Typography style={styles.emojiButtonText}>{emoji}</Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.agentToggleButton,
                  {
                    backgroundColor: agentMode === 'ai' ? appTheme.infoSoft : appTheme.warningSoft,
                    borderColor: agentMode === 'ai' ? appTheme.primaryAccent : Theme.colors.warning,
                  },
                ]}
                activeOpacity={0.75}
                disabled={agentModeUpdating}
                onPress={() => {
                  setActionsOpen(false);
                  closeThreadSearch();
                  setTemplateMenuOpen(false);
                  setQuickComposer(null);
                  setEmojiPickerOpen(false);
                  setQuickActionsOpen(false);
                  setAgentMenuOpen((value) => !value);
                }}
              >
                {agentModeUpdating ? (
                  <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                ) : agentMode === 'ai' ? (
                  <AIAgentIcon color={appTheme.primaryAccent} size={23} />
                ) : (
                  <UserRound color={Theme.colors.warning} size={21} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.composerToolButton}
                activeOpacity={0.75}
                onPress={() => {
                  setActionsOpen(false);
                  closeThreadSearch();
                  setAgentMenuOpen(false);
                  setTemplateMenuOpen(false);
                  setQuickComposer(null);
                  setEmojiPickerOpen(false);
                  setQuickActionsOpen((value) => !value);
                }}
              >
                <Plus color={appTheme.muted} size={22} />
              </TouchableOpacity>
              {!isRecording && !pendingVoiceNote ? (
                <TextInput
                  placeholder={
                    isLocked
                      ? 'Conversation is locked'
                      : activeConversation.channel === 'linkedin'
                      ? 'Write a message...'
                      : activeConversation.channel === 'email' || activeConversation.channel === 'gmail'
                        ? 'Compose your email reply...'
                        : 'Type a message...'
                  }
                  placeholderTextColor={appTheme.disabled}
                  value={draft}
                  onChangeText={handleDraftChange}
                  style={[
                    styles.composerInputDark,
                    isLinkedInThread && styles.linkedinComposerInput,
                    isEmailThread && styles.emailComposerInput,
                    WEB_INPUT_RESET,
                    { backgroundColor: appTheme.input, color: appTheme.text },
                  ]}
                  onFocus={closeThreadPopups}
                  multiline
                  editable={!isLocked}
                />
              ) : null}
              {!isRecording && !pendingVoiceNote ? (
                <TouchableOpacity
                  style={styles.composerToolButton}
                  activeOpacity={0.75}
                  onPress={() => {
                    setActionsOpen(false);
                    closeThreadSearch();
                    setAgentMenuOpen(false);
                    setTemplateMenuOpen(false);
                    setQuickComposer(null);
                    setQuickActionsOpen(false);
                    setEmojiSearch('');
                    setEmojiPickerOpen((value) => !value);
                  }}
                >
                  <Smile color={appTheme.muted} size={20} />
                </TouchableOpacity>
              ) : null}

              {draft.trim() && !isRecording && !pendingVoiceNote ? (
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={isSending || isLocked}
                  style={[
                    styles.sendButtonDark,
                    isLinkedInThread && styles.linkedinSendButton,
                    isEmailThread && styles.emailSendButton,
                    (isSending || isLocked) && styles.sendButtonDisabled,
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator color={Theme.colors.surface} size="small" />
                  ) : (
                    <Send color={Theme.colors.surface} size={20} />
                  )}
                </TouchableOpacity>
              ) : !isRecording && !pendingVoiceNote ? (
                <TouchableOpacity
                  onPress={startVoiceRecording}
                  activeOpacity={0.8}
                  disabled={isLocked}
                  style={[
                    styles.sendButtonDark,
                    isLinkedInThread && styles.linkedinSendButton,
                    isEmailThread && styles.emailSendButton,
                    isLocked && styles.sendButtonDisabled,
                  ]}
                >
                  <Mic color={Theme.colors.surface} size={20} />
                </TouchableOpacity>
              ) : null}

              {isRecording ? (
                <View style={styles.recordingBar}>
                  <TouchableOpacity onPress={() => void stopVoiceRecording(true)} style={styles.recordingCancelButton} activeOpacity={0.7}>
                    <Trash2 color="#EF4444" size={20} />
                  </TouchableOpacity>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Typography variant="bodySmall" color={appTheme.text} style={styles.recordingTimer}>
                      {formatDuration(recordingDuration)}
                    </Typography>
                  </View>
                  <TouchableOpacity
                    onPress={() => void stopVoiceRecording(false)}
                    style={[styles.sendButtonDark, isLinkedInThread && styles.linkedinSendButton, isEmailThread && styles.emailSendButton]}
                    activeOpacity={0.8}
                  >
                    <StopCircle color={Theme.colors.surface} size={20} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {pendingVoiceNote ? (
                <View style={styles.voicePreviewBar}>
                  <TouchableOpacity
                    onPress={() => {
                      setPendingVoiceNote(null);
                      setPendingVoiceNotePlaying(false);
                      pendingVoiceNoteSoundRef.current?.stopAsync().catch(() => undefined);
                      pendingVoiceNoteSoundRef.current?.unloadAsync().catch(() => undefined);
                      pendingVoiceNoteSoundRef.current = null;
                    }}
                    style={styles.recordingCancelButton}
                    activeOpacity={0.7}
                  >
                    <Trash2 color="#EF4444" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void togglePendingVoiceNotePlayback()} style={styles.voicePreviewPlay} activeOpacity={0.7}>
                    {pendingVoiceNotePlaying ? (
                      <PauseCircle color="#00A884" size={28} />
                    ) : (
                      <PlayCircle color="#00A884" size={28} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.voicePreviewWave}>
                    {[4, 6, 8, 5, 9, 7, 6, 8, 4, 7, 5, 8, 6, 9, 5].map((h, i) => (
                      <View key={i} style={[styles.audioWaveBar, { height: h * 2, backgroundColor: pendingVoiceNotePlaying ? '#00A884' : appTheme.disabled }]} />
                    ))}
                  </View>
                  <Typography variant="caption" color={appTheme.muted} style={styles.voicePreviewDuration}>
                    {formatDuration(pendingVoiceNote.durationSec)}
                  </Typography>
                  <TouchableOpacity
                    onPress={() => void sendVoiceNote()}
                    style={[styles.sendButtonDark, isLinkedInThread && styles.linkedinSendButton, isEmailThread && styles.emailSendButton, isSending && styles.sendButtonDisabled]}
                    disabled={isSending}
                    activeOpacity={0.8}
                  >
                    {isSending ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Send color={Theme.colors.surface} size={20} />}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {pendingAttachment && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 1000 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: insets.top + 16 }}>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)} style={{ padding: 8 }}>
                    <X color="#FFF" size={28} />
                  </TouchableOpacity>
                </View>
                <Image
                  source={{ uri: pendingAttachment.uri }}
                  style={{ flex: 1 }}
                  resizeMode="contain"
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: (isKeyboardVisible ? 0 : insets.bottom) + 16, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <TextInput
                    placeholder="Add a caption..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={draft}
                    onChangeText={setDraft}
                    style={{ flex: 1, color: '#FFF', fontSize: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, marginRight: 12 }}
                  />
                  <TouchableOpacity
                    onPress={confirmPendingAttachment}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00a884', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Send color="#FFF" size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {showSideDetails && (
            <ContactDetailsPanel
              conversation={activeConversation}
              messages={activeMessages}
              messageCount={activeMessages.length}
              resolved={isResolved}
              favourite={isStarred}
              listed={isPinned}
              muted={isMuted}
              locked={isLocked}
              onClose={() => setDetailsOpen(false)}
              onOpenMedia={openContactMediaLibrary}
              onOpenSearch={openContactSearch}
              onOpenStarredMessages={handleOpenStarredMessages}
              onToggleFavourite={handleToggleFavourite}
              onToggleList={handleToggleList}
              onToggleMute={handleToggleMute}
              onTogglePrivacy={handleTogglePrivacy}
              onOpenDisappearingMessages={handleOpenDisappearingMessages}
              onVerifyEncryption={handleVerifyEncryption}
              onClearChat={handleClearChat}
              onBlock={handleBlockContact}
              onReport={handleReportContact}
              onDelete={handleDeleteChat}
              onConversationRefresh={() => void setActiveConversation(activeConversation.id, { force: true })}
            />
          )}
        </Reanimated.View>

        {showOverlayDetails && (
          <View style={styles.contactPanelOverlay}>
            <ContactDetailsPanel
              conversation={activeConversation}
              messages={activeMessages}
              messageCount={activeMessages.length}
              resolved={isResolved}
              favourite={isStarred}
              listed={isPinned}
              muted={isMuted}
              locked={isLocked}
              fullPage
              onClose={() => setDetailsOpen(false)}
              onOpenMedia={openContactMediaLibrary}
              onOpenSearch={openContactSearch}
              onOpenStarredMessages={handleOpenStarredMessages}
              onToggleFavourite={handleToggleFavourite}
              onToggleList={handleToggleList}
              onToggleMute={handleToggleMute}
              onTogglePrivacy={handleTogglePrivacy}
              onOpenDisappearingMessages={handleOpenDisappearingMessages}
              onVerifyEncryption={handleVerifyEncryption}
              onClearChat={handleClearChat}
              onBlock={handleBlockContact}
              onReport={handleReportContact}
              onDelete={handleDeleteChat}
              onConversationRefresh={() => void setActiveConversation(activeConversation.id, { force: true })}
            />
          </View>
        )}

        {mediaLibraryOpen ? (
          <View style={styles.mediaLibraryOverlay}>
            <MediaLibraryScreen
              conversation={activeConversation}
              items={activeMediaItems}
              initialTab={mediaLibraryInitialTab}
              onClose={() => setMediaLibraryOpen(false)}
            />
          </View>
        ) : null}
      </KeyboardContainer>
    );
  }

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleArea}>
            <Typography variant="h1" color={appTheme.text}>Chats</Typography>
          </View>
          <View style={styles.headerActionGroup}>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void syncConversations({ force: true })} activeOpacity={0.75}>
              {isLoadingConversations || isSyncing ? (
                <ActivityIndicator color={Theme.colors.surface} size="small" />
              ) : (
                <RefreshCw color={Theme.colors.surface} size={18} />
              )}
              <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.refreshText}>
                Sync
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createChatButton, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}
              onPress={() => {
                setCreateChatNotice(null);
                setFilterDropdownOpen(false);
                setCreateChatMenuOpen((value) => {
                  const next = !value;
                  if (!next) {
                    setCreateChatMode(null);
                    setCreateChatSearch('');
                    setCreateChatSelectedIds(new Set());
                  }
                  return next;
                });
              }}
              activeOpacity={0.76}
            >
              <Plus color={appTheme.text} size={21} />
            </TouchableOpacity>
          </View>
        </View>
        <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1} style={styles.headerMeta}>
          {filteredConversations.length} focused / {conversations.length} total - {lastSyncedLabel}
        </Typography>
      </View>

      <View style={styles.content}>
        {createChatMenuOpen || filterDropdownOpen ? (
          <Pressable style={styles.listDismissLayer} onPress={closeConversationListPopups} />
        ) : null}
        {createChatMenuOpen && (
          <View style={[styles.createChatPanel, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
            <View style={styles.createChatPanelHeader}>
              <View>
                <Typography variant="caption" color={appTheme.muted} style={styles.createChatMenuTitle}>
                  NEW CHAT
                </Typography>
                <Typography variant="caption" color={appTheme.muted}>
                  Start from contacts, imports, or broadcasts
                </Typography>
              </View>
              <TouchableOpacity
                onPress={closeCreateChatMenu}
                style={[styles.createChatCloseButton, { backgroundColor: appTheme.softSurface }]}
                activeOpacity={0.72}
              >
                <X color={appTheme.muted} size={17} />
              </TouchableOpacity>
            </View>

            <View style={styles.createChatGrid}>
              {CHAT_CREATE_ACTIONS.map((action) => {
                const ActionIcon = action.icon;
                const isSelected = createChatMode === action.id;

                return (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.createChatCard,
                      {
                        backgroundColor: isSelected ? `${action.accent}14` : appTheme.input,
                        borderColor: isSelected ? action.accent : appTheme.borderSoft,
                      },
                    ]}
                    onPress={() => void handleCreateAction(action.id)}
                    activeOpacity={0.76}
                  >
                    <View style={[styles.createChatIconShell, { backgroundColor: `${action.accent}20` }]}>
                      <ActionIcon color={action.accent} size={17} />
                    </View>
                    <View style={styles.createChatMenuText}>
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.createChatMenuLabel} numberOfLines={1}>
                        {action.label}
                      </Typography>
                      <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                        {action.description}
                      </Typography>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {createChatMode ? (
              <View style={styles.createChatPicker}>
                <View style={[styles.createChatSearchBar, { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft }]}>
                  <Search color={appTheme.disabled} size={17} />
                  <TextInput
                    placeholder="Search name, phone, email"
                    placeholderTextColor={appTheme.disabled}
                    value={createChatSearch}
                    onChangeText={setCreateChatSearch}
                    style={[styles.createChatSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                  />
                </View>

                <ScrollView
                  style={styles.createChatContactList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {createChatContacts.length ? (
                    createChatContacts.slice(0, 30).map((conversation) => {
                      const isMultiSelect = createChatMode === 'broadcast';
                      const isChecked = createChatSelectedIds.has(conversation.id);

                      return (
                        <TouchableOpacity
                          key={conversation.id}
                          style={[
                            styles.createChatContactRow,
                            {
                              backgroundColor: isChecked ? `${Theme.colors.success}14` : appTheme.input,
                              borderColor: isChecked ? Theme.colors.success : appTheme.borderSoft,
                            },
                          ]}
                          onPress={() => {
                            if (isMultiSelect) {
                              toggleCreateChatSelection(conversation.id);
                            } else {
                              void openCreateChatConversation(conversation);
                            }
                          }}
                          activeOpacity={0.76}
                        >
                          <Avatar src={conversation.avatar} fallback={getInitials(conversation.name)} size="sm" />
                          <View style={styles.createChatContactText}>
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.createChatMenuLabel} numberOfLines={1}>
                              {conversation.name}
                            </Typography>
                            <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                              {conversation.phone || conversation.email || getChannelLabel(conversation.channel)}
                            </Typography>
                          </View>
                          <ChannelGlyph channel={conversation.channel} size={13} />
                          {isMultiSelect ? (
                            <View
                              style={[
                                styles.createChatCheck,
                                {
                                  backgroundColor: isChecked ? Theme.colors.success : 'transparent',
                                  borderColor: isChecked ? Theme.colors.success : appTheme.border,
                                },
                              ]}
                            >
                              {isChecked ? <Check color={Theme.colors.surface} size={13} /> : null}
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={[styles.createChatEmpty, { borderColor: appTheme.borderSoft }]}>
                      <Typography variant="caption" color={appTheme.muted}>
                        No contacts found. Tap Sync or import leads to refresh backend data.
                      </Typography>
                    </View>
                  )}
                </ScrollView>

                {createChatMode === 'broadcast' ? (
                  <TouchableOpacity style={styles.createChatCommitButton} onPress={() => void commitCreateChatSelection()} activeOpacity={0.8}>
                    <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.createChatCommitText}>
                      Start Broadcast ({createChatSelectedIds.size})
                    </Typography>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        {createChatNotice ? (
          <View style={[styles.createChatNotice, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
            <Typography variant="caption" color={appTheme.muted}>{createChatNotice}</Typography>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          <View style={styles.filterDropdownWrap}>
            <TouchableOpacity
              style={[styles.filterDropdownButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
              onPress={() => {
                closeCreateChatMenu();
                setFilterDropdownOpen((value) => !value);
              }}
              activeOpacity={0.78}
            >
              <View style={[styles.filterSelectedDot, { backgroundColor: activeFilterOption.color }]} />
              <Typography
                variant="bodySmall"
                style={[styles.filterSelectedText, { color: activeFilterOption.color }]}
                numberOfLines={1}
              >
                {activeFilterOption.label}
              </Typography>
              <ChevronDown
                color={appTheme.muted}
                size={17}
                style={filterDropdownOpen ? styles.filterChevronOpen : undefined}
              />
            </TouchableOpacity>

            {filterDropdownOpen && (
              <Animated.View
                style={[
                  styles.filterDropdownMenu,
                  {
                    backgroundColor: appTheme.surface,
                    borderColor: appTheme.border,
                    opacity: filterDropdownAnimation,
                    transform: [
                      {
                        translateY: filterDropdownAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                      {
                        scale: filterDropdownAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {visibleChannels.filter((channel) => channel.id !== activeFilter).map((channel) => (
                  <TouchableOpacity
                    key={channel.id}
                    style={styles.filterDropdownItem}
                    onPress={() => {
                      setActiveFilter(channel.id);
                      setFilterDropdownOpen(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.filterOptionDot, { backgroundColor: channel.color }]} />
                    <Typography variant="bodySmall" style={[styles.filterDropdownText, { color: appTheme.text }]}>
                      {channel.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: appTheme.input, borderColor: appTheme.border, borderWidth: 1 }]}>
          <Search color={appTheme.disabled} size={20} />
          <TextInput
            placeholder="Search conversations"
            placeholderTextColor={appTheme.disabled}
            style={[styles.searchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {(error || syncError) && (
          <View style={styles.errorStrip}>
            <Typography variant="bodySmall" color={Theme.colors.error}>
              {error || syncError}
            </Typography>
          </View>
        )}

        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          refreshing={isLoadingConversations}
          onRefresh={() => void syncConversations({ force: true })}
          onEndReached={() => void fetchMoreConversations()}
          onEndReachedThreshold={0.35}
          contentContainerStyle={[styles.conversationList, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          ListFooterComponent={
            isLoadingMoreConversations ? (
              <ActivityIndicator color={appTheme.primaryAccent} style={styles.olderLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              {isLoadingConversations || isSyncing ? (
                <Reanimated.View entering={FadeIn.duration(350)} style={{ width: '100%', gap: 16 }}>
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                </Reanimated.View>
              ) : !isLoadingIntegrations && connectedIntegrations.length > 0 && !connectedIntegrations.some((i) => i.connected) ? (
                <Reanimated.View entering={FadeInDown.duration(350)} style={styles.connectPrompt}>
                  <View style={[styles.connectPromptIcon, { backgroundColor: appTheme.primarySoft }]}>
                    <Link2 color={appTheme.primaryAccent} size={28} />
                  </View>
                  <Typography variant="h4" color={appTheme.text} style={styles.connectPromptTitle}>
                    No Applications Connected
                  </Typography>
                  <Typography variant="bodySmall" color={appTheme.muted} style={styles.connectPromptBody}>
                    Connect WhatsApp, LinkedIn, Instagram, or Email to start receiving and managing conversations here.
                  </Typography>
                  <TouchableOpacity
                    style={[styles.connectPromptButton, { backgroundColor: appTheme.primaryAccent }]}
                    onPress={() => router.push('/(drawer)/integrations' as any)}
                    activeOpacity={0.8}
                  >
                    <Typography variant="bodySmall" color={appTheme.darkMode ? '#0F172A' : '#FFFFFF'} style={{ fontWeight: '600' }}>
                      Connect an Application
                    </Typography>
                  </TouchableOpacity>
                </Reanimated.View>
              ) : (
                <>
                  <MessageSquare color={appTheme.disabled} size={28} />
                  <Typography variant="body" color={appTheme.disabled} style={styles.emptyText}>
                    {emptyConversationMessage}
                  </Typography>
                </>
              )}
            </View>
          }
        />
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  titleArea: { flex: 1, minWidth: 150 },
  headerMeta: {
    marginTop: 2,
    maxWidth: '100%',
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Theme.spacing.sm,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  createChatButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  createChatPanel: {
    position: 'relative',
    zIndex: 110,
    borderRadius: 18,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.small,
  },
  createChatPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  createChatMenuTitle: {
    paddingBottom: Theme.spacing.xs,
    fontWeight: '600',
  },
  createChatCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createChatGrid: {
    gap: Theme.spacing.sm,
  },
  createChatCard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    padding: Theme.spacing.sm,
  },
  createChatIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createChatMenuText: {
    flex: 1,
    minWidth: 0,
  },
  createChatMenuLabel: {
    fontWeight: '600',
  },
  createChatNotice: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  createChatPicker: {
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  createChatSearchBar: {
    height: 42,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createChatSearchInput: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
    fontSize: 14,
  },
  createChatContactList: {
    maxHeight: 260,
  },
  createChatContactRow: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  createChatContactText: {
    flex: 1,
    minWidth: 0,
  },
  createChatCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createChatEmpty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Theme.spacing.md,
  },
  createChatCommitButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createChatCommitText: {
    fontWeight: '600',
  },
  refreshText: { color: Theme.colors.surface, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: Theme.spacing.xl, position: 'relative' },
  listDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    zIndex: 120,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 24,
    height: 48,
    marginBottom: Theme.spacing.lg,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: Theme.colors.text },
  filterDropdownWrap: {
    width: 146,
    height: 42,
    position: 'relative',
    zIndex: 100,
  },
  filterDropdownButton: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    ...Theme.shadows.small,
  },
  filterSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterSelectedText: {
    flex: 1,
    fontWeight: '600',
  },
  filterChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    width: 196,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    overflow: 'hidden',
    zIndex: 120,
    ...Theme.shadows.large,
  },
  filterDropdownItem: {
    minHeight: 42,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.16)',
  },
  filterOptionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterDropdownText: {
    color: Theme.colors.text,
    fontWeight: '600',
  },
  conversationList: {
    paddingTop: Theme.spacing.xs,
    paddingBottom: 20,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 86,
    paddingVertical: Theme.spacing.md,
    paddingLeft: Theme.spacing.md,
    paddingRight: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  conversationRowActive: {
    borderWidth: 1.5,
  },
  conversationAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  avatarWrap: {
    position: 'relative',
    marginLeft: 2,
  },
  channelDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    top: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.surface,
  },
  conversationBody: {
    flex: 1,
    marginLeft: Theme.spacing.md,
    minWidth: 0,
  },
  conversationTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0,
  },
  timePill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontWeight: '500',
  },
  conversationBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  previewText: {
    flex: 1,
    fontSize: 13.5,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontWeight: '600' },
  conversationMetaLine: {
    marginTop: Theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  channelPill: {
    minHeight: 22,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  channelPillText: {
    fontWeight: '600',
    fontSize: 11,
  },
  companyText: {
    flex: 1,
    fontWeight: '600',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { marginTop: Theme.spacing.sm },
  connectPrompt: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  connectPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  connectPromptTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  connectPromptBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  connectPromptButton: {
    marginTop: Theme.spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  errorStrip: {
    backgroundColor: Theme.colors.errorLight,
    borderRadius: 8,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  emailThreadHeader: {
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    padding: Theme.spacing.md,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  emailSubject: {
    marginVertical: 4,
    color: '#1F2937',
    fontWeight: '600',
  },
  threadLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ECE5DD',
  },
  threadMain: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F3EEE6',
    position: 'relative',
  },
  threadDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  threadSearchDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    elevation: 8,
  },
  threadComposerDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
    elevation: 18,
  },
  threadHeaderDark: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    zIndex: 12,
  },
  darkIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarWrap: {
    position: 'relative',
  },
  threadChannelDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.surface,
  },
  threadTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  presenceDotOnline: {
    backgroundColor: '#0FDD7E',
  },
  threadHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  threadSearchPanel: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
  },
  threadSearchInputWrap: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  threadSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
  },
  threadSearchClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenu: {
    position: 'absolute',
    top: 60,
    right: 18,
    width: 252,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    backgroundColor: Theme.colors.surface,
    paddingVertical: Theme.spacing.sm,
    zIndex: 40,
    ...Theme.shadows.large,
  },
  actionMenuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
  },
  actionMenuText: {
    flex: 1,
  },
  actionMenuDangerDivider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: Theme.spacing.sm,
  },
  threadBackground: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    backgroundColor: '#F3EEE6',
    position: 'relative',
  },
  threadBackgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  messageListSurface: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  messageListDark: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: Theme.spacing.md,
  },
  linkedinThreadBackground: {
    backgroundColor: '#F3F2EF',
  },
  linkedinMessageList: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
  },
  emailThreadBackground: {
    backgroundColor: '#F6F8FC',
  },
  emailThreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginHorizontal: Theme.spacing.xl,
    marginTop: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailThreadBannerText: {
    flex: 1,
  },
  emailMessageList: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  dateSeparator: {
    alignSelf: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F7E9D4',
    borderWidth: 1,
    marginVertical: Theme.spacing.lg,
  },
  dateSeparatorText: {
    fontWeight: '500',
  },
  typingPillDark: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  composerShellDark: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCE2EA',
    backgroundColor: '#FFFFFF',
    gap: 6,
    zIndex: 20,
  },
  linkedinComposerShell: {
    borderTopColor: '#D0D7DE',
    backgroundColor: '#FFFFFF',
  },
  emailComposerShell: {
    alignItems: 'center',
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  composerToolButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentToggleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAgentIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  composerInputDark: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 11 : 8,
    paddingBottom: Platform.OS === 'ios' ? 11 : 8,
    color: '#172033',
    fontSize: 15,
  },
  linkedinComposerInput: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    backgroundColor: '#FFFFFF',
  },
  emailComposerInput: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
  },
  sendButtonDark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
  },
  linkedinSendButton: {
    borderRadius: 6,
    backgroundColor: '#0A66C2',
  },
  emailSendButton: {
    borderRadius: 8,
    backgroundColor: '#1A73E8',
  },
  agentMenu: {
    position: 'absolute',
    left: Theme.spacing.lg,
    bottom: 72,
    width: 190,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    zIndex: 35,
    ...Theme.shadows.large,
  },
  agentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    minHeight: 40,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 8,
  },
  agentMenuItemActive: {
    backgroundColor: Theme.colors.primary,
  },
  quickActionMenu: {
    position: 'absolute',
    left: 48,
    bottom: 72,
    width: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    zIndex: 35,
    ...Theme.shadows.large,
  },
  quickActionTitle: {
    fontWeight: '600',
    marginBottom: Theme.spacing.md,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Theme.spacing.lg,
  },
  templateMenu: {
    position: 'absolute',
    left: 48,
    bottom: 72,
    width: 340,
    maxHeight: 430,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    zIndex: 36,
    ...Theme.shadows.large,
  },
  quickComposerMenu: {
    position: 'absolute',
    left: 48,
    bottom: 72,
    width: 340,
    maxHeight: 440,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.lg,
    zIndex: 37,
    gap: Theme.spacing.sm,
    ...Theme.shadows.large,
  },
  quickComposerInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 14,
  },
  quickComposerTextarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  quickComposerGhostButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  quickComposerSendButton: {
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.primary,
    marginTop: Theme.spacing.xs,
  },
  quickComposerSendText: {
    fontWeight: '600',
  },
  emojiMenu: {
    position: 'absolute',
    right: 64,
    bottom: 72,
    width: 236,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.md,
    zIndex: 38,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    ...Theme.shadows.large,
  },
  templateMenuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  templateCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  templateSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  templateSearchInput: {
    flex: 1,
    marginLeft: Theme.spacing.xs,
    color: Theme.colors.text,
    fontSize: 14,
  },
  templateHint: {
    marginBottom: Theme.spacing.sm,
  },
  templateLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.lg,
  },
  templateList: {
    maxHeight: 260,
  },
  templateItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  templateItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: 4,
  },
  templateName: {
    flex: 1,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  templateBadge: {
    maxWidth: 96,
    borderRadius: 999,
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  templateBadgeText: {
    color: '#0A66C2',
    fontWeight: '600',
  },
  templateEmptyText: {
    paddingVertical: Theme.spacing.lg,
    textAlign: 'center',
  },
  attachmentActionItem: {
    width: '33.33%',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  attachmentActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActionLabel: {
    minHeight: 36,
    paddingHorizontal: 4,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    minHeight: 40,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 8,
  },
  contactPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: '100%',
    zIndex: 50,
    ...Theme.shadows.large,
  },
  contactPanel: {
    width: 354,
    maxWidth: '100%',
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: Theme.colors.border,
  },
  contactPanelFullPage: {
    width: '100%',
    borderLeftWidth: 0,
  },
  mediaLibraryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    elevation: 90,
  },
  whatsAppContactPanel: {
    borderLeftWidth: 0,
  },
  whatsAppContactHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  whatsAppContactHeaderTitle: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
    fontWeight: '600',
  },
  whatsAppContactBody: {
    paddingHorizontal: Theme.spacing.xl,
  },
  whatsAppContactHero: {
    alignItems: 'center',
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
  },
  whatsAppProfileAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppProfileChannelBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Theme.shadows.small,
  },
  whatsAppContactName: {
    marginTop: Theme.spacing.lg,
    textAlign: 'center',
  },
  whatsAppContactPhone: {
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  whatsAppContactActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xs,
  },
  whatsAppContactAction: {
    width: 100,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppContactActionIcon: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppContactActionLabel: {
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  whatsAppAboutLabel: {
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
  },
  whatsAppAboutText: {
    fontWeight: '600',
  },
  whatsAppSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Theme.spacing.lg,
  },
  whatsAppBusinessAccountSection: {
    gap: Theme.spacing.md,
  },
  whatsAppBusinessAccountRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  whatsAppBusinessAccountText: {
    flex: 1,
  },
  whatsAppBusinessHoursRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  whatsAppBusinessDay: {
    fontWeight: '500',
  },
  whatsAppSectionTitle: {
    marginBottom: Theme.spacing.sm,
    fontWeight: '600',
  },
  whatsAppMediaHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  whatsAppMediaTitle: {
    flex: 1,
  },
  whatsAppMediaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
  },
  whatsAppMediaPreviewTile: {
    flex: 1,
    maxWidth: 82,
    aspectRatio: 1,
    minWidth: 0,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppMediaEmptyPreview: {
    flex: 1,
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  whatsAppInfoRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  whatsAppInfoText: {
    flex: 1,
    minWidth: 0,
  },
  whatsAppInfoTitle: {
    fontWeight: '500',
  },
  whatsAppSwitchTitle: {
    flex: 1,
    fontWeight: '500',
  },
  whatsAppActionSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  whatsAppDangerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    borderRadius: 16,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  whatsAppDangerText: {
    flex: 1,
    minWidth: 0,
  },
  whatsAppDangerTitle: {
    fontWeight: '500',
  },
  whatsAppDangerSubtitle: {
    opacity: 0.82,
    marginTop: 1,
  },
  businessProfileCard: {
    borderRadius: 10,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    minHeight: 42,
  },
  businessProfileLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    minHeight: 28,
  },
  businessProfileLineText: {
    flex: 1,
    minWidth: 0,
  },
  businessProfileLineTitle: {
    fontWeight: '600',
  },
  businessProfileTextBlock: {
    gap: 3,
  },
  businessProfileDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Theme.spacing.sm,
    gap: 4,
  },
  businessMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  businessMetricTile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: 8,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
    alignItems: 'center',
  },
  businessMetricValue: {
    fontWeight: '600',
  },
  mediaLibraryScreen: {
    flex: 1,
  },
  mediaLibraryHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mediaLibraryTitle: {
    flex: 1,
    marginLeft: Theme.spacing.xs,
  },
  mediaLibraryTabs: {
    minHeight: 52,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mediaLibraryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mediaLibraryTabActive: {
    borderBottomColor: '#22C55E',
  },
  mediaLibraryTabText: {
    fontWeight: '600',
  },
  mediaLibraryContent: {
    paddingTop: Theme.spacing.xl,
  },
  mediaMonthLabel: {
    marginBottom: Theme.spacing.sm,
    fontWeight: '500',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaGridTile: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  mediaGridImage: {
    width: '100%',
    height: '100%',
  },
  videoMediaTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  mediaGridDocTile: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.sm,
  },
  mediaGridDocTitle: {
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  mediaList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  mediaListRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mediaListIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaListText: {
    flex: 1,
    minWidth: 0,
  },
  mediaListTitle: {
    fontWeight: '500',
  },
  mediaEmptyState: {
    minHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
  },
  mediaEmptyText: {
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  mediaLibraryFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mediaLibraryFooterText: {
    fontWeight: '500',
  },
  contactPanelHeader: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  panelCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPanelBody: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  contactHero: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  largeAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    position: 'relative',
  },
  heroChannelBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F8EF',
  },
  contactHeroName: {
    marginTop: Theme.spacing.lg,
    textAlign: 'center',
  },
  detailSection: {
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  detailSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailSectionTitle: {
    fontWeight: '600',
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    minHeight: 30,
  },
  detailLineText: {
    flex: 1,
  },
  detailCard: {
    marginTop: Theme.spacing.xl,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  paymentButton: {
    marginTop: Theme.spacing.xl,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  paymentButtonText: {
    fontWeight: '500',
  },
  paymentPanel: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  paymentPanelHeader: {
    minHeight: 44,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  paymentPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    flex: 1,
  },
  paymentPanelBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  paymentOptionsBlock: {
    gap: 6,
  },
  paymentBlockTitle: {
    fontWeight: '700',
  },
  paymentOptionRow: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  paymentOptionName: {
    flex: 1,
    fontWeight: '500',
  },
  paymentOptionPrice: {
    fontWeight: '700',
  },
  paymentLinkText: {
    lineHeight: 17,
  },
  paymentActionRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  paymentActionButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  paymentSecondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  paymentActionText: {
    fontWeight: '700',
  },
  paymentLoadButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  paymentVerificationBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.xs,
  },
  contactInlineAlert: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.xs,
  },
  contactInlineAlertText: {
    flex: 1,
    fontWeight: '500',
  },
  contactLoadingRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  workflowTabsBlock: {
    marginTop: Theme.spacing.lg,
  },
  workflowSegmentedTabs: {
    marginTop: 0,
  },
  assignmentTabs: {
    marginTop: Theme.spacing.xl,
    minHeight: 46,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
  },
  assignmentTabActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  assignmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    minHeight: 34,
  },
  assignmentTabText: {
    fontWeight: '500',
  },
  assignmentCard: {
    marginTop: Theme.spacing.md,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.lg,
  },
  workflowCard: {
    alignItems: 'stretch',
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  assignmentMemberRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  assignmentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentAvatarText: {
    fontWeight: '700',
  },
  assignmentMemberText: {
    flex: 1,
    minWidth: 0,
  },
  assignmentMemberName: {
    marginTop: 1,
    fontWeight: '700',
  },
  reassignButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reassignButtonText: {
    fontWeight: '700',
  },
  assignmentPicker: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  assignmentPickerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  assignmentPickerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentPickerText: {
    flex: 1,
    minWidth: 0,
  },
  assignmentPickerName: {
    flex: 1,
    fontWeight: '700',
  },
  assignmentEmptyState: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  assignmentHistory: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  assignmentHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  assignmentHistoryText: {
    flex: 1,
  },
  assignmentTitle: {
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  assignmentCopy: {
    marginTop: 2,
    textAlign: 'center',
  },
  assignButton: {
    marginTop: Theme.spacing.lg,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    alignSelf: 'stretch',
  },
  assignButtonText: {
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 18,
  },
  noteSubmitButton: {
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  noteSubmitText: {
    fontWeight: '700',
  },
  notesList: {
    gap: Theme.spacing.sm,
  },
  noteItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  noteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  noteMetaText: {
    flex: 1,
  },
  noteContent: {
    lineHeight: 19,
  },
  noteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  noteTextButton: {
    minHeight: 26,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteMiniButton: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  disabledButton: {
    opacity: 0.55,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Theme.spacing.sm,
  },
  threadTitleBlock: { flex: 1, marginLeft: Theme.spacing.sm },
  threadTitle: { fontSize: 17, fontWeight: '500' },
  threadSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    gap: 6,
  },
  messageRowAgent: { justifyContent: 'flex-end' },
  messageRowLead: { justifyContent: 'flex-start' },
  linkedinMessageRow: {
    marginBottom: 10,
  },
  emailMessageRow: {
    marginBottom: Theme.spacing.md,
    justifyContent: 'center',
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  messageAvatarText: {
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '76%',
    borderRadius: 18,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
  },
  linkedinBubble: {
    maxWidth: '72%',
    borderRadius: 14,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
  },
  linkedinBubbleSent: {
    borderTopRightRadius: 14,
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  linkedinBubbleReceived: {
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 4,
  },
  linkedinSenderName: {
    marginBottom: 4,
    fontWeight: '500',
  },
  linkedinAvatar: {
    backgroundColor: '#E8F2FF',
    borderColor: '#BFD7F1',
  },
  linkedinAgentAvatar: {
    backgroundColor: '#0A66C2',
    borderColor: '#0A66C2',
  },
  emailBubble: {
    width: '92%',
    maxWidth: 760,
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.lg,
    borderColor: '#E5E7EB',
    ...Theme.shadows.small,
  },
  emailBubbleSent: {
    borderLeftWidth: 4,
    borderLeftColor: '#1A73E8',
  },
  emailBubbleReceived: {
    borderLeftWidth: 4,
    borderLeftColor: '#D93025',
  },
  emailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  emailSenderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE8E6',
  },
  emailHeaderText: {
    flex: 1,
  },

  messageBubbleAgent: {
    borderBottomRightRadius: 6,
  },
  messageBubbleLead: {
    borderBottomLeftRadius: 6,
  },
  messageText: { lineHeight: 20 },
  emailMessageText: {
    lineHeight: 22,
  },
  emailMessageMeta: {
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  emailMeta: {
    marginBottom: 6,
    fontWeight: '500',
  },
  attachments: {
    marginTop: Theme.spacing.sm,
    gap: 6,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  emailAttachmentRow: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DADCE0',
  },
  attachmentName: {
    flex: 1,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  emptyThread: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  olderLoader: { marginVertical: Theme.spacing.md },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    gap: Theme.spacing.sm,
  },
  attachmentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  attachmentButtonBusy: {
    opacity: 0.7,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 12 : 9,
    paddingBottom: Platform.OS === 'ios' ? 12 : 9,
    color: Theme.colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  typingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  // Avatar image style for message bubbles
  messageAvatarImg: {
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  // Media bubble (image-only, no padding)
  mediaBubble: {
    padding: 3,
    overflow: 'hidden',
  },
  // Image thumbnail inside bubble
  mediaThumbnail: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 2,
  },
  // Location card inside bubble
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    gap: 10,
  },
  locationCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCardText: {
    flex: 1,
    minWidth: 0,
  },
  // Document card inside bubble
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    gap: 8,
  },
  docCardName: {
    flex: 1,
    fontWeight: '600',
  },
  // Audio card inside bubble
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    gap: 10,
    minWidth: 180,
  },
  audioCardContent: {
    flex: 1,
    minWidth: 0,
  },
  audioCardName: {
    fontWeight: '500',
    marginBottom: 4,
  },
  audioWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  audioWaveBar: {
    width: 2.5,
    borderRadius: 2,
  },
  // Emoji picker panel
  emojiPickerPanel: {
    position: 'absolute',
    right: 4,
    left: 4,
    maxHeight: 320,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 38,
    overflow: 'hidden',
    ...Theme.shadows.large,
  },
  emojiSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    marginHorizontal: Theme.spacing.md,
    marginVertical: 8,
    gap: 6,
  },
  emojiSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  emojiCategoryRow: {
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  emojiCategoryRowContent: {
    paddingHorizontal: 8,
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiCategoryTab: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiCategoryIcon: {
    fontSize: 18,
  },
  emojiGridScroll: {
    maxHeight: 200,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 2,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: {
    fontSize: 22,
  },
  // Search navigation
  threadSearchCounter: {
    minWidth: 34,
    textAlign: 'center',
  },
  threadSearchNav: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Voice recording bar
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingCancelButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingTimer: {
    fontWeight: '600',
    color: '#EF4444',
  },
  // Voice note preview bar
  voicePreviewBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voicePreviewPlay: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePreviewWave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  voicePreviewDuration: {
    minWidth: 36,
    textAlign: 'right',
  },
});
