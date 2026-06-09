import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Music,
  Paperclip,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldOff,
  Smile,
  Star,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Users,
  VolumeX,
  X,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { setBottomTabHidden, useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { LadLogoMark } from '@/components/ui/LadLogoMark';
import { ChatChannel, ChatMessage, Conversation, useChatStore } from '@/src/store/chatStore';
import { RESOLVED_API_URL, buildApiUrl, getAuthToken, safeStorage } from '@/src/api';
import useAuthStore from '@/src/store/authStore';
import { assignConversationHandler } from '@/src/services/conversationService';
import { useAppTheme } from '@/src/theme/appTheme';

const CHAT_LIGHT_BACKGROUND_IMAGE = require('../../../assets/images/whatsappbg-tiled.jpeg');
const CHAT_DARK_BACKGROUND_IMAGE = require('../../../assets/images/chat-dark-bg.jpeg');
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

const CHANNELS: { id: 'all' | 'unread' | ChatChannel; label: string; color: string }[] = [
  { id: 'all', label: 'All', color: Theme.colors.primary },
  { id: 'unread', label: 'Unread', color: '#15803D' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
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
  const channelColor = getChannelColor(conversation.channel);
  const channelLabel = getChannelLabel(conversation.channel);

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
}: {
  message: ChatMessage;
  channel: ChatChannel;
  contactName: string;
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
  const avatarLabel = isAgent ? 'A' : getInitials(message.senderName || contactName || 'Lead');
  const emailMetaLabel = isAgent ? `To: ${contactName || 'Recipient'}` : `From: ${message.senderName || contactName || 'Sender'}`;

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
        <View style={[styles.messageAvatar, isLinkedIn && styles.linkedinAvatar]}>
          <Typography variant="caption" color={appTheme.darkMode ? '#F8FAFC' : isLinkedIn ? '#0A66C2' : Theme.colors.primary} style={styles.messageAvatarText}>
            {avatarLabel || '?'}
          </Typography>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isEmail && styles.emailBubble,
          isLinkedIn && styles.linkedinBubble,
          isAgent ? styles.messageBubbleAgent : styles.messageBubbleLead,
          isEmail && (isAgent ? styles.emailBubbleSent : styles.emailBubbleReceived),
          isLinkedIn && (isAgent ? styles.linkedinBubbleSent : styles.linkedinBubbleReceived),
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
                {avatarLabel || 'M'}
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
        <Typography
          variant="body"
          color={isAgent ? palette.outgoingText : leadTextColor}
          style={[styles.messageText, isEmail && styles.emailMessageText]}
        >
          {message.content}
        </Typography>
        {message.attachments?.length ? (
          <View style={styles.attachments}>
            {message.attachments.map((attachment) => (
              <View key={attachment.id} style={[styles.attachmentRow, isEmail && styles.emailAttachmentRow]}>
                <Paperclip color={appTheme.muted} size={14} />
                <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={styles.attachmentName}>
                  {attachment.name}
                </Typography>
              </View>
            ))}
          </View>
        ) : null}
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
        <View style={[styles.messageAvatar, isLinkedIn && styles.linkedinAgentAvatar]}>
          <Typography variant="caption" color={isLinkedIn ? '#FFFFFF' : Theme.colors.primary} style={styles.messageAvatarText}>
            A
          </Typography>
        </View>
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

const ContactDetailsPanel = ({
  conversation,
  messageCount,
  resolved,
  fullPage = false,
  onClose,
}: {
  conversation: Conversation;
  messageCount: number;
  resolved: boolean;
  fullPage?: boolean;
  onClose: () => void;
}) => {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const stateLabel = resolved ? 'Resolved' : conversation.conversationState || 'Open';
  const ownerLabel = conversation.owner || 'AI';
  const startedLabel = formatTime(conversation.startedAt || conversation.lastMessageAt);

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | ChatChannel>('all');
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickComposer, setQuickComposer] = useState<QuickComposerAction | null>(null);
  const [quickDraft, setQuickDraft] = useState<QuickComposerDraft>(EMPTY_QUICK_DRAFT);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState('');
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

  const {
    conversations,
    activeConversationId,
    activeMessages,
    isLoadingConversations,
    isLoadingMoreConversations,
    isLoadingMessages,
    isLoadingOlderMessages,
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
    clearActiveConversation,
    disposeRealtime,
  } = useChatStore();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setBottomTabHidden(Boolean(activeConversationId));
    return () => {
      setBottomTabHidden(false);
    };
  }, [activeConversationId]);
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (deletedIds.has(conversation.id) || blockedIds.has(conversation.id)) {
          return false;
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
  }, [activeFilter, blockedIds, conversations, deletedIds, pinnedIds, search]);

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
  const lastSyncedLabel = lastSyncedAt ? `Synced ${formatTime(lastSyncedAt)}` : 'Ready to sync';
  const activeFilterOption = CHANNELS.find((channel) => channel.id === activeFilter) ?? CHANNELS[0];
  const activeFilterLabel = activeFilterOption.label;
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
    await sendAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
    });
  }, [isUploadingAttachment, sendAttachment]);

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
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setQuickDraft((current) => ({
        ...current,
        locationName: current.locationName || 'Current location',
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setQuickDraft((current) => ({
          ...current,
          locationName: current.locationName || 'Current location',
          locationLink: `https://maps.google.com/?q=${latitude},${longitude}`,
        }));
      },
      () => {
        setQuickDraft((current) => ({
          ...current,
          locationName: current.locationName || 'Location',
        }));
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
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
      await syncConversations({ silent: true });
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
    await syncConversations({ silent: true });
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
      await syncConversations({ silent: true });
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
      await setActiveConversation(activeConversation.id);
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
      />
    );
  }, [activeConversation?.channel, activeConversation?.name, appTheme.darkMode]);

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
    const composerBottomPadding = Math.max(insets.bottom, Theme.spacing.sm);
    const floatingMenuBottom = composerBottomPadding + 56;
    const ThreadSurface = (isWhatsAppThread ? ImageBackground : View) as React.ComponentType<any>;
    const threadSurfaceProps = isWhatsAppThread
      ? {
          source: appTheme.darkMode ? CHAT_DARK_BACKGROUND_IMAGE : CHAT_LIGHT_BACKGROUND_IMAGE,
          resizeMode: Platform.OS === 'web' ? 'repeat' as const : 'cover' as const,
          imageStyle: styles.threadBackgroundImage,
        }
      : {};

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={[styles.container, { paddingTop: insets.top, backgroundColor: activePalette.screen }]}
      >
        <View style={styles.threadLayout}>
          <View style={styles.threadMain}>
            <View style={[styles.threadHeaderDark, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
              <TouchableOpacity onPress={clearActiveConversation} style={styles.darkIconButton} activeOpacity={0.7}>
                <ArrowLeft color={appTheme.text} size={22} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setDetailsOpen((value) => !value)}
                style={styles.threadIdentity}
                activeOpacity={0.78}
              >
                <View style={styles.threadAvatarWrap}>
                  <Avatar src={activeConversation.avatar} fallback={getInitials(activeConversation.name)} size="sm" />
                  <View style={styles.threadChannelDot}>
                    <ChannelGlyph channel={activeConversation.channel} size={13} color={getChannelColor(activeConversation.channel)} />
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
                    setActionsOpen(false);
                    setThreadSearchOpen((value) => !value);
                  }}
                >
                  <Search color={appTheme.muted} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDetailsOpen((value) => !value)} style={styles.darkIconButton} activeOpacity={0.75}>
                  <Users color={appTheme.muted} size={20} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void setActiveConversation(activeConversation.id)} style={styles.darkIconButton} activeOpacity={0.75}>
                  <RefreshCw color={appTheme.muted} size={19} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActionsOpen((value) => !value)} style={styles.darkIconButton} activeOpacity={0.75}>
                  <MoreVertical color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>
            </View>

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

            {error && (
              <View style={styles.errorStrip}>
                <Typography variant="bodySmall" color={Theme.colors.error}>
                  {error}
                </Typography>
              </View>
            )}

            {threadSearchOpen && (
              <View style={[styles.threadSearchPanel, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
                <View style={[styles.threadSearchInputWrap, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}>
                  <Search color={appTheme.disabled} size={17} />
                  <TextInput
                    value={threadSearchQuery}
                    onChangeText={setThreadSearchQuery}
                    placeholder="Search in conversation"
                    placeholderTextColor={appTheme.disabled}
                    style={[styles.threadSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                    autoFocus={Platform.OS === 'web'}
                  />
                  <Typography variant="caption" color={appTheme.muted}>
                    {threadSearchMatchCount}
                  </Typography>
                  <TouchableOpacity
                    onPress={() => {
                      setThreadSearchQuery('');
                      setThreadSearchOpen(false);
                    }}
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
                data={visibleMessageListData}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                inverted
                onEndReached={() => void getOlderMessages()}
                onEndReachedThreshold={0.25}
                style={styles.messageListSurface}
                scrollEventThrottle={16}
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
                      <ActivityIndicator color={appTheme.primaryAccent} />
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

              {activeTyping && (
                <View style={styles.typingPillDark}>
                  <View style={[styles.typingDot, { backgroundColor: getChannelColor(activeConversation.channel) }]} />
                  <Typography variant="caption" color={appTheme.muted}>
                    {activeConversation.name} is typing
                  </Typography>
                </View>
              )}
            </ThreadSurface>

            <View
              style={[
                styles.composerShellDark,
                isLinkedInThread && styles.linkedinComposerShell,
                isEmailThread && styles.emailComposerShell,
                { paddingBottom: composerBottomPadding, backgroundColor: activePalette.composer, borderTopColor: activePalette.border },
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
                <View style={[styles.emojiMenu, { bottom: floatingMenuBottom, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.emojiButton, { backgroundColor: appTheme.input }]}
                      onPress={() => setDraft((value) => `${value}${emoji}`)}
                      activeOpacity={0.7}
                    >
                      <Typography variant="h3" color={appTheme.text}>{emoji}</Typography>
                    </TouchableOpacity>
                  ))}
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
                  setAgentMenuOpen(false);
                  setTemplateMenuOpen(false);
                  setQuickComposer(null);
                  setEmojiPickerOpen(false);
                  setQuickActionsOpen((value) => !value);
                }}
              >
                <Plus color={appTheme.muted} size={22} />
              </TouchableOpacity>
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
                multiline
                editable={!isLocked}
              />
              <TouchableOpacity
                style={styles.composerToolButton}
                activeOpacity={0.75}
                onPress={() => {
                  setAgentMenuOpen(false);
                  setTemplateMenuOpen(false);
                  setQuickComposer(null);
                  setQuickActionsOpen(false);
                  setEmojiPickerOpen((value) => !value);
                }}
              >
                <Smile color={appTheme.muted} size={20} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.8}
                disabled={!draft.trim() || isSending || isLocked}
                style={[
                  styles.sendButtonDark,
                  isLinkedInThread && styles.linkedinSendButton,
                  isEmailThread && styles.emailSendButton,
                  (!draft.trim() || isSending || isLocked) && styles.sendButtonDisabled,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={Theme.colors.surface} size="small" />
                ) : (
                  <Send color={Theme.colors.surface} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {showSideDetails && (
            <ContactDetailsPanel
              conversation={activeConversation}
              messageCount={activeMessages.length}
              resolved={isResolved}
              onClose={() => setDetailsOpen(false)}
            />
          )}
        </View>

        {showOverlayDetails && (
          <View style={styles.contactPanelOverlay}>
            <ContactDetailsPanel
              conversation={activeConversation}
              messageCount={activeMessages.length}
              resolved={isResolved}
              fullPage
              onClose={() => setDetailsOpen(false)}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: appTheme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleArea}>
            <Typography variant="h1" color={appTheme.text}>Chats</Typography>
          </View>
          <View style={styles.headerActionGroup}>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void syncConversations()} activeOpacity={0.75}>
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
                onPress={() => {
                  setCreateChatMenuOpen(false);
                  setCreateChatMode(null);
                  setCreateChatSearch('');
                  setCreateChatSelectedIds(new Set());
                }}
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
              onPress={() => setFilterDropdownOpen((value) => !value)}
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
                {CHANNELS.filter((channel) => channel.id !== activeFilter).map((channel) => (
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
          onRefresh={() => void syncConversations()}
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
              {isLoadingConversations ? (
                <ActivityIndicator color={appTheme.primaryAccent} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  titleArea: { flex: 1 },
  headerMeta: {
    marginTop: 2,
    maxWidth: '100%',
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
  },
  refreshText: { color: Theme.colors.surface, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: Theme.spacing.xl },
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
  unreadText: { fontWeight: '800' },
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
    fontWeight: '800',
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
    fontWeight: '800',
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
  threadHeaderDark: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    zIndex: 12,
  },
  darkIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarWrap: {
    position: 'relative',
  },
  threadChannelDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 2,
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
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
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
    fontWeight: '700',
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
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#DCE2EA',
    backgroundColor: '#FFFFFF',
    gap: Theme.spacing.sm,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  assignmentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    minHeight: 34,
  },
  assignmentTabText: {
    fontWeight: '700',
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
    fontWeight: '800',
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
  threadTitle: { fontSize: 17, fontWeight: '700' },
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
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
});








