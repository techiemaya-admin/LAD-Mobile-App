import { ImportLeadsModal } from '@/components/features/ImportLeadsModal';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { Avatar } from '@/components/ui/Avatar';
import { forceBottomTabHidden, setBottomTabHidden, useBottomTabHidden, useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { LadLogoMark } from '@/components/ui/LadLogoMark';
import { NoConnectionState } from '@/components/ui/NoConnectionState';
import { SkeletonConversationRow, SkeletonMessageBlock } from '@/components/ui/SkeletonLoader';
import { Typography } from '@/components/ui/Typography';
import Theme from '@/constants/theme';
import { apiDelete, apiGet, apiPatch, apiPost, buildApiUrl, getAuthToken, RESOLVED_API_URL, safeStorage } from '@/src/api';
import { usePhoneMasking } from '@/src/hooks/usePhoneMasking';
import {
  addConversationsToBroadcastGroup,
  bulkConversationsAction,
  createBroadcastGroup,
  deleteBroadcastGroup,
  getBroadcastGroupMembers,
  getStarredMessages,
  getWabaChatSettings,
  getWhatsAppTemplates,
  removeBroadcastGroupMember,
  sendEmailReply,
  sendTemplateToBroadcastGroups,
  sendTemplateToConversation,
  sendTemplateToConversations,
  updateBroadcastGroup,
  updateWabaChatSettings,
  type BroadcastGroup,
  type BroadcastGroupMember,
  type BroadcastTemplateSendPayload,
  type StarredMessageRecord,
} from '@/src/services/chat.service';
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
import {
  createEmailBroadcastGroup,
  deleteEmailBroadcastGroup,
  getConnectedEmailAccounts,
  getEmailBroadcastGroup,
  getEmailBroadcastGroups,
  getEmailBroadcastRun,
  getEmailBroadcastRuns,
  sendEmailBroadcast,
  sendEmailBroadcastToGroup,
  type ConnectedEmailAccount,
  type EmailBroadcastChannel,
  type EmailBroadcastGroup,
  type EmailBroadcastGroupDetail,
  type EmailBroadcastRecipient,
  type EmailBroadcastRun,
  type EmailBroadcastRunDetail,
} from '@/src/services/emailBroadcast.service';
import useAuthStore from '@/src/store/authStore';
import { ChatChannel, ChatMessage, Conversation, useChatStore } from '@/src/store/chatStore';
import { usePreferencesStore } from '@/src/store/preferencesStore';
import { useAppTheme } from '@/src/theme/appTheme';
import type { ConnectedIntegration } from '@/src/types/chat';
import { getFriendlyError, isConnectionUnavailableError } from '@/src/utils/errors';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Share as ForwardIcon,
  Globe,
  Heart,
  Image as ImageIcon,
  Inbox,
  Info,
  Link2,
  List as ListIcon,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MinusCircle,
  MoreVertical,
  Music,
  Paperclip,
  PauseCircle,
  Pencil,
  Phone,
  Pin,
  PlayCircle,
  Plus,
  Redo2,
  RefreshCw,
  Reply,
  Search,
  Send,
  Shield,
  ShieldOff,
  SlidersHorizontal,
  Smile,
  Square,
  Star,
  StopCircle,
  Tag,
  Target,
  ThumbsDown,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Users,
  Video,
  VolumeX,
  X,
  Zap
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView as KeyboardControllerAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import Reanimated, { FadeIn, FadeInDown, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

const CHAT_LIGHT_BACKGROUND_IMAGE = require('../../../assets/images/whatsappbg-tiled.jpeg');
const CHAT_DARK_BACKGROUND_IMAGE = require('../../../assets/images/chat-dark-bg.jpeg');
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

type ChannelFilterId = 'all' | 'unread' | ChatChannel | 'personal' | 'waba' | 'outlook';
type WhatsAppListFilter = 'all' | 'unread';
type LinkedInStatusFilter = 'all' | 'pending' | 'accepted' | 'active';
// Mirrors lad-frontend-2's ConversationsPage tabs: Gmail and Outlook are separate
// channels (with Gmail red / Outlook blue), plus Custom SMTP as plain Email.
const CHANNELS: { id: ChannelFilterId; label: string; color: string }[] = [
  { id: 'all', label: 'All', color: '#6366f1' },
  { id: 'unread', label: 'Unread', color: '#15803D' },
  { id: 'personal', label: 'Personal WA', color: '#25D366' },
  { id: 'waba', label: 'WA Business', color: '#128C7E' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'gmail', label: 'Gmail', color: '#EA4335' },
  { id: 'outlook', label: 'Outlook', color: '#0078D4' },
  { id: 'email', label: 'Email', color: '#059669' },
];

// ── Email provider detection (Gmail / Outlook / Custom SMTP) ──
// The WABA email contacts carry their provider in `channel`; the mobile
// normalizer stores it on conversation.conversationState.
type EmailProviderId = 'gmail' | 'outlook' | 'custom';

const EMAIL_PROVIDER_META: Record<EmailProviderId, { label: string; color: string }> = {
  gmail: { label: 'Gmail', color: '#EA4335' },
  outlook: { label: 'Outlook', color: '#0078D4' },
  custom: { label: 'Email', color: '#059669' },
};

// Brand-accurate Microsoft Outlook mark (dark-blue "O" panel + light-blue
// envelope), rebuilt as an inline SVG so it renders crisply at any size and
// matches lad-frontend-2's Outlook provider identity.
// Official Microsoft Outlook 2025 icon, converted from the downloaded SVG to react-native-svg.
// Uses linear/radial gradients matching the brand-accurate icon.
const OutlookLogo = ({ size = 28 }: { size?: number }) => {
  // Unique ID prefix to avoid gradient ID collisions when multiple instances render
  const id = 'ol';
  return (
    <Svg width={size} height={size} viewBox="60 90.4 570.02 539.67">
      <Defs>
        <LinearGradient id={`${id}_lg0`} x1="149.836" y1="335.474" x2="463.983" y2="140.623" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#20A7FA" />
          <Stop offset="0.4" stopColor="#3BD5FF" />
          <Stop offset="1" stopColor="#C4B0FF" />
        </LinearGradient>
        <LinearGradient id={`${id}_lg1`} x1="257.958" y1="401.925" x2="432.843" y2="121.886" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#165BD9" />
          <Stop offset="0.5" stopColor="#1880E5" />
          <Stop offset="1" stopColor="#857FFF" />
        </LinearGradient>
        <LinearGradient id={`${id}_lg3`} x1="360.801" y1="466.482" x2="667.65" y2="270.655" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#1A435F" />
          <Stop offset="0.492" stopColor="#204FCC" />
          <Stop offset="1" stopColor="#5F20CC" />
        </LinearGradient>
        <LinearGradient id={`${id}_lg5`} x1="629.97" y1="449.146" x2="357.755" y2="449.146" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4DC3FF" />
          <Stop offset="0.196" stopColor="#0EAFFF" />
        </LinearGradient>
        <RadialGradient id={`${id}_rg4`} cx="59.144" cy="354.231" rx="315" ry="315" gradientUnits="userSpaceOnUse">
          <Stop offset="0.039" stopColor="#0090FF" />
          <Stop offset="0.919" stopColor="#183DAD" />
        </RadialGradient>
      </Defs>
      {/* Main envelope paths */}
      <Path fill={`url(#${id}_lg0)`} d="M 463.984375 140.144531 L 119.636719 358.414062 L 90.023438 311.695312 L 90.023438 271.4375 C 90.023438 256.78125 97.445312 243.121094 109.742188 235.144531 L 309.910156 105.257812 C 340.40625 85.46875 379.6875 85.464844 410.1875 105.25 Z" />
      <Path fill={`url(#${id}_lg1)`} d="M 407.101562 103.339844 C 408.136719 103.953125 409.164062 104.59375 410.183594 105.253906 L 566.398438 206.585938 L 179.0625 452.105469 L 119.625 358.335938 L 403.894531 177.800781 C 430.820312 160.699219 432 122.230469 407.101562 103.339844 Z" />
      <Path fill={`url(#${id}_lg3)`} d="M 333.601562 498.988281 L 179.066406 452.109375 L 507.628906 243.835938 C 535.300781 226.296875 535.230469 185.898438 507.496094 168.457031 L 506.015625 167.527344 L 510.277344 170.175781 L 610.273438 235.042969 C 622.574219 243.019531 629.996094 256.683594 629.996094 271.34375 L 629.996094 310.304688 Z" />
      {/* Bottom wing right */}
      <Path fill={`url(#${id}_lg5)`} d="M 315.769531 630.050781 L 536.21875 630.050781 C 587.996094 630.050781 629.96875 588.078125 629.96875 536.300781 L 629.96875 272.140625 C 629.96875 287.441406 622.105469 301.667969 609.148438 309.804688 L 281.242188 515.695312 C 263.554688 526.804688 252.820312 546.222656 252.820312 567.109375 C 252.824219 601.871094 281.003906 630.050781 315.769531 630.050781 Z" />
      {/* Bottom wing left */}
      <Path fill={`url(#${id}_rg4)`} d="M 108.75 345 L 251.25 345 C 278.175781 345 300 366.824219 300 393.75 L 300 536.25 C 300 563.175781 278.175781 585 251.25 585 L 108.75 585 C 81.824219 585 60 563.175781 60 536.25 L 60 393.75 C 60 366.824219 81.824219 345 108.75 345 Z" />
      {/* "O" letter (white) */}
      <Path fill="#FFFFFF" d="M 179.386719 534 C 159.539062 534 143.25 527.789062 130.511719 515.375 C 117.773438 502.960938 111.402344 486.757812 111.402344 466.769531 C 111.402344 445.660156 117.867188 428.589844 130.796875 415.550781 C 143.730469 402.515625 160.660156 396 181.59375 396 C 201.375 396 217.472656 402.238281 229.890625 414.714844 C 242.375 427.191406 248.617188 443.644531 248.617188 464.066406 C 248.617188 485.050781 242.148438 501.964844 229.21875 514.816406 C 216.351562 527.605469 199.742188 534 179.386719 534 Z M 179.960938 507.648438 C 190.777344 507.648438 199.484375 503.953125 206.078125 496.566406 C 212.671875 489.179688 215.96875 478.902344 215.96875 465.742188 C 215.96875 452.023438 212.765625 441.347656 206.367188 433.710938 C 199.964844 426.074219 191.417969 422.257812 180.730469 422.257812 C 169.71875 422.257812 160.851562 426.199219 154.132812 434.082031 C 147.410156 441.90625 144.050781 452.273438 144.050781 465.183594 C 144.050781 478.285156 147.410156 488.652344 154.132812 496.285156 C 160.851562 503.859375 169.460938 507.648438 179.960938 507.648438 Z" />
    </Svg>
  );
};

// Official Gmail 2026 icon, converted from the downloaded SVG to react-native-svg.
const GmailLogo = ({ size = 28 }: { size?: number }) => {
  const id = 'gm26';
  return (
    <Svg width={size} height={size} viewBox="0 0 800 636.36322">
      <Defs>
        <LinearGradient id={`${id}_a`} x1="165" x2="165" y1="44" y2="166" gradientUnits="userSpaceOnUse" gradientTransform="matrix(4.5454426,0,0,4.5454426,-36.362684,-118.18025)">
          <Stop offset="0" stopColor="#60d673" />
          <Stop offset="0.17" stopColor="#42c868" />
          <Stop offset="0.39" stopColor="#0ebc5f" />
          <Stop offset="0.62" stopColor="#00a9bb" />
          <Stop offset="0.86" stopColor="#3c90ff" />
          <Stop offset="1" stopColor="#3186ff" />
        </LinearGradient>
        <LinearGradient id={`${id}_b`} x1="8" x2="184" y1="46.130001" y2="46.130001" gradientUnits="userSpaceOnUse" gradientTransform="matrix(4.5454426,0,0,4.5454426,-36.362684,-118.18025)">
          <Stop offset="0.08" stopColor="#ff63a0" />
          <Stop offset="0.3" stopColor="#fc413d" />
          <Stop offset="0.5" stopColor="#fc413d" />
          <Stop offset="0.65" stopColor="#fc413d" />
          <Stop offset="0.72" stopColor="#fc5c30" />
          <Stop offset="0.86" stopColor="#feb10c" />
          <Stop offset="0.91" stopColor="#fec700" />
          <Stop offset="0.96" stopColor="#ffdb0f" />
        </LinearGradient>
      </Defs>
      <Path fill={`url(#${id}_a)`} d="M 627.27193,81.819216 H 799.99875 V 581.8179 c 0,30.12265 -24.42266,54.54532 -54.54531,54.54532 h -90.90885 a 27.272655,27.272655 0 0 1 -27.27266,-27.27266 z" />
      <Path fill="#fc413d" d="M 172.72768,81.819216 H 8.5692711e-4 V 581.8179 c 0,30.12265 24.42266207289,54.54532 54.54531007289,54.54532 h 90.908853 a 27.272655,27.272655 0 0 0 27.27266,-27.27266 z" />
      <Path fill={`url(#${id}_b)`} d="M 141.93685,20.255746 C 105.42331,-10.435083 50.946177,-5.7169131 20.255349,30.796627 -10.435479,67.305622 -5.7173098,121.78275 30.79623,152.47813 l 345.80818,290.6765 a 36.36354,36.36354 0 0 0 46.79533,0 L 769.20792,152.47358 C 805.71691,121.78275 810.43508,67.305622 779.74426,30.792081 749.05343,-5.7169131 694.5763,-10.435083 658.0673,20.255746 L 399.9998,237.18245 Z" />
    </Svg>
  );
};

// Official WhatsApp mark (green speech bubble + phone glyph), from the downloaded SVG.
const WhatsAppLogo = ({ size = 28 }: { size?: number }) => {
  const id = 'wa';
  return (
    <Svg width={size} height={size} viewBox="0 0 175.216 175.552">
      <Defs>
        <LinearGradient id={`${id}_b`} x1="85.915" x2="86.535" y1="32.567" y2="137.092" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#57d163" />
          <Stop offset="1" stopColor="#23b33a" />
        </LinearGradient>
      </Defs>
      <Path fill="#fff" d="m12.966 161.238 10.439-38.114a73.42 73.42 0 0 1-9.821-36.772c.017-40.556 33.021-73.55 73.578-73.55 19.681.01 38.154 7.669 52.047 21.572s21.537 32.383 21.53 52.037c-.018 40.553-33.027 73.553-73.578 73.553h-.032c-12.313-.005-24.412-3.094-35.159-8.954z" />
      <Path fill={`url(#${id}_b)`} d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z" />
      <Path fill="#fff" fillRule="evenodd" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647" />
    </Svg>
  );
};

// WhatsApp Business mark (raster PNG asset).
const WhatsAppBusinessLogo = ({ size = 28 }: { size?: number }) => (
  <Image source={require('@/assets/images/whatsapp-business.png')} style={{ width: size, height: size, resizeMode: 'contain' }} />
);

const LinkedInLogo = ({ size = 28 }: { size?: number }) => (
  <Image source={require('@/assets/images/linkedin.png')} style={{ width: size, height: size, resizeMode: 'contain' }} />
);

// Full-colour brand logo for a channel filter, shown like the Outlook mark in the
// channel selector. Returns null for channels without a brand logo (falls back to a dot).
const ChannelBrandLogo = ({ id, size = 20 }: { id: string; size?: number }) => {
  if (id === 'outlook') return <OutlookLogo size={size} />;
  if (id === 'gmail') return <GmailLogo size={size} />;
  if (id === 'email') return <Mail color={EMAIL_PROVIDER_META.custom.color} size={Math.max(15, size * 0.9)} />;
  if (id === 'linkedin') return <LinkedInLogo size={size} />;
  if (id === 'waba') return <WhatsAppBusinessLogo size={size} />;
  if (id === 'personal') return <WhatsAppLogo size={size} />;
  return null;
};

const ProviderLogo = ({ provider, size }: { provider: EmailProviderId; size?: number }) => {
  if (provider === 'outlook') {
    return <OutlookLogo size={size} />;
  }
  if (provider === 'gmail') {
    return <GmailLogo size={size} />;
  }
  return <Mail color={EMAIL_PROVIDER_META.custom.color} size={(size ?? 28) * 0.62} />;
};

// Smart replies — same heuristics as lad-frontend-2's getSmartReplies.
const SMART_REPLIES: Record<string, string[]> = {
  default: ['Looking forward to it!', 'We will be there!', 'Thanks for the update!'],
  inquiry: ['Thanks for reaching out!', "I'll review and get back to you", 'Can we schedule a call?'],
  approval: ['Sounds great!', 'Approved — please proceed', 'Let me check with the team'],
  meeting: ['Works for me!', 'Can we reschedule?', "I'll send a calendar invite"],
  proposal: ['Looks good to me!', 'I have a few questions', "Let's discuss further"],
};

const getSmartReplies = (subject: string): string[] => {
  const lowered = subject.toLowerCase();
  if (lowered.includes('inquiry') || lowered.includes('request')) return SMART_REPLIES.inquiry;
  if (lowered.includes('approved') || lowered.includes('confirm')) return SMART_REPLIES.approval;
  if (lowered.includes('meeting') || lowered.includes('schedule')) return SMART_REPLIES.meeting;
  if (lowered.includes('proposal') || lowered.includes('quote')) return SMART_REPLIES.proposal;
  return SMART_REPLIES.default;
};

const getEmailProviderId = (conversation: Conversation): EmailProviderId => {
  if (conversation.channel === 'gmail') {
    return 'gmail';
  }

  const providerHint = `${conversation.conversationState ?? ''} ${(conversation.tags ?? []).join(' ')}`.toLowerCase();
  if (providerHint.includes('outlook') || providerHint.includes('microsoft')) {
    return 'outlook';
  }

  if (providerHint.includes('gmail') || providerHint.includes('google')) {
    return 'gmail';
  }

  return 'custom';
};

const getBroadcastProviderForAccount = (account?: ConnectedEmailAccount | null): EmailBroadcastChannel | null => {
  if (!account) {
    return null;
  }
  if (account.provider === 'google') {
    return 'gmail';
  }
  if (account.provider === 'microsoft') {
    return 'outlook';
  }
  return null;
};

const getAccountProviderForEmailTab = (providerId: EmailProviderId) =>
  providerId === 'outlook' ? 'microsoft' : providerId === 'custom' ? 'custom_smtp' : 'google';

const parseBroadcastRecipients = (raw: string): EmailBroadcastRecipient[] => {
  const seen = new Set<string>();
  return raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\s*<([^<>]+@[^<>]+)>$/);
      if (match) {
        return {
          name: match[1].trim().replace(/^["']|["']$/g, ''),
          email: match[2].trim(),
        };
      }
      return { email: entry };
    })
    .filter((recipient) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email))
    .filter((recipient) => {
      const key = recipient.email.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const isBroadcastEmailContact = (conversation: Conversation) =>
  String(conversation.id ?? '').startsWith('email:') && !conversation.messageCount;

const ATTACHMENT_ACTIONS: {
  id: AttachmentAction;
  label: string;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  color: string;
}[] = [
  { id: 'document', label: 'Document', icon: FileText, color: '#007BFC' },
  { id: 'photos', label: 'Photos & videos', icon: ImageIcon, color: '#7F26C9' },
  { id: 'camera', label: 'Camera', icon: Camera, color: '#D42A55' },
  { id: 'audio', label: 'Audio', icon: Music, color: '#E85D04' },
  { id: 'contact', label: 'Contact', icon: Phone, color: '#009688' },
  { id: 'poll', label: 'Poll', icon: BarChart3, color: '#1F6597' },
  { id: 'event', label: 'Event', icon: Calendar, color: '#5555AA' },
  { id: 'sticker', label: 'New sticker', icon: Star, color: '#C89600' },
  { id: 'template', label: 'Send template', icon: FileText, color: '#008069' },
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

// WABA conversation stages (context_status) shown as a coloured capsule on each
// row — mirrors lad-frontend-2's WABusinessView stage tag colours. Unlike the
// web (which only reveals the stage name on hover), the APK shows the label text
// directly inside the capsule.
const WABA_STAGE_COLORS: Record<string, string> = {
  greeting: '#3b82f6',
  info_gathering: '#8b5cf6',
  booking_in_progress: '#f59e0b',
  booking_completed: '#10b981',
  cancelled: '#f43f5e',
  human: '#f97316',
  booked: '#10b981',
  qualified: '#8b5cf6',
  active: '#8b5cf6',
};
const WABA_STAGE_DEFAULT = '#9ca3af';
const formatContextStatus = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

type ChatTemplate = {
  id: string;
  name: string;
  templateName?: string;
  subject?: string;
  body: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  category?: string;
  channel: ChatChannel;
  language?: string;
  parameters?: string[];
  headerParamCount?: number;
  headerType?: string;
  headerUrl?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const looksLikeHtml = (value: string) => /<[a-z][\s\S]*>/i.test(value);

const toEmailBodyHtml = (value: string) => {
  if (looksLikeHtml(value)) {
    return value;
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
};

const toEmailBodyText = (value: string) => (looksLikeHtml(value) ? stripHtml(value) : value.trim());

const getTemplateEndpoint = (channel: ChatChannel, accountId?: string) => {
  if (channel === 'whatsapp') {
    const base = '/api/whatsapp-conversations/conversations/templates?channel=waba';
    return accountId ? `${base}&account_id=${encodeURIComponent(accountId)}` : base;
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
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const rawHtml =
    item.body_html ??
    item.content_html ??
    item.html_content ??
    item.html ??
    metadata.body_html ??
    metadata.content_html ??
    null;
  const rawText =
    item.body ??
    item.content ??
    item.plain_text ??
    item.text ??
    item.message_text ??
    item.followup_message ??
    item.connection_message ??
    item.description ??
    null;
  const rawBody =
    rawHtml ??
    rawText ??
    '';
  const body = stripHtml(String(rawBody));

  if (!body) {
    return null;
  }
  const bodyParameters = Array.from(new Set(
    (body.match(/\{\{([^}]+)\}\}/g) || [])
      .map((placeholder) => placeholder.replace(/^\{\{|\}\}$/g, '').trim())
      .filter(Boolean),
  ));
  const rawParameters = Array.isArray(item.parameters)
    ? item.parameters
    : Array.isArray(metadata.parameters)
      ? metadata.parameters
      : bodyParameters;

  return {
    id: String(item.id ?? item._id ?? item.name ?? `${channel}-template-${index}`),
    name: String(item.name ?? item.title ?? item.template_name ?? `Template ${index + 1}`),
    templateName: item.template_name ? String(item.template_name) : item.name ? String(item.name) : undefined,
    subject: item.subject || metadata.subject ? String(item.subject ?? metadata.subject) : undefined,
    body,
    bodyHtml: rawHtml !== undefined && rawHtml !== null ? String(rawHtml) : null,
    bodyText: rawText !== undefined && rawText !== null ? String(rawText) : body,
    category: item.category ? String(item.category) : metadata.channel_type ? String(metadata.channel_type) : undefined,
    channel,
    language: item.language ?? item.language_code ?? metadata.language_code ? String(item.language ?? item.language_code ?? metadata.language_code) : undefined,
    parameters: rawParameters.map((parameter: unknown) => String(parameter).trim()).filter(Boolean),
    headerParamCount: Number(item.header_param_count ?? metadata.header_param_count ?? 0) || 0,
    headerType: item.header_type ? String(item.header_type) : metadata.header_type ? String(metadata.header_type) : '',
    headerUrl: item.header_url ? String(item.header_url) : metadata.header_url ? String(metadata.header_url) : '',
    mediaUrl: metadata.media_url ?? item.media_url ?? null,
    mediaType: metadata.media_type ?? item.media_type ?? null,
    mediaFilename: metadata.media_filename ?? item.media_filename ?? null,
  };
};

const loadEmailTemplatesFromApi = async (): Promise<ChatTemplate[]> => {
  const response = await apiGet<unknown>('/api/campaigns/email-templates', {
    params: { is_active: true },
  });
  const payload = response.data;
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, any>
    : {};
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.templates)
        ? record.templates
        : Array.isArray(record.items)
          ? record.items
          : [];

  return raw
    .map((item, index) => normalizeTemplate(item as Record<string, any>, 'email', index))
    .filter((template): template is ChatTemplate => Boolean(template));
};

const substituteConversationVariables = (text: string, conversation?: Conversation | null) => {
  if (!text || !conversation) {
    return text;
  }

  const full = (conversation.name || '').trim();
  const first = full.split(/\s+/)[0] || '';
  const last = full.split(/\s+/).slice(1).join(' ') || '';
  const company = (conversation.company || '').trim();

  const replace = (source: string, key: string, value: string) =>
    value ? source.replace(new RegExp(`\\{\\{?\\s*${key}\\s*\\}\\}?`, 'gi'), value) : source;

  let output = text;
  output = replace(output, 'first_name', first);
  output = replace(output, 'last_name', last);
  output = replace(output, 'name', full);
  output = replace(output, 'company(?:_name)?', company);
  return output;
};

const getConversationTemplateValue = (parameter: string, conversation?: Conversation | null) => {
  const key = parameter.trim().toLowerCase();
  const fullName = (conversation?.name || '').trim();
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const company = (conversation?.company || '').trim();
  const phone = (conversation?.phone || '').trim();
  const email = (conversation?.email || '').trim();

  if (!key || /^\d+$/.test(key)) {
    return firstName || fullName || 'there';
  }
  if (key.includes('first')) {
    return firstName || fullName || 'there';
  }
  if (key.includes('name')) {
    return fullName || firstName || 'there';
  }
  if (key.includes('company') || key.includes('business')) {
    return company || fullName || firstName || 'your company';
  }
  if (key.includes('phone') || key.includes('mobile')) {
    return phone || fullName || firstName || 'your number';
  }
  if (key.includes('mail')) {
    return email || fullName || firstName || 'your email';
  }

  return fullName || firstName || company || phone || 'there';
};

const buildTemplateParameters = (template: ChatTemplate, conversation?: Conversation | null) => {
  const parameters = template.parameters?.length
    ? template.parameters
    : Array.from(new Set(
        (template.body.match(/\{\{([^}]+)\}\}/g) || [])
          .map((placeholder) => placeholder.replace(/^\{\{|\}\}$/g, '').trim())
          .filter(Boolean),
      ));

  return parameters.map((parameter) => getConversationTemplateValue(parameter, conversation));
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
const isWhatsAppFilterTab = (filter: ChannelFilterId) => filter === 'personal' || filter === 'waba' || filter === 'whatsapp';
const conversationMatchesWhatsAppTab = (conversation: Conversation, filter: ChannelFilterId) => {
  if (conversation.channel !== 'whatsapp') {
    return false;
  }
  if (filter === 'personal') {
    return conversation.waBackendChannel === 'personal';
  }
  if (filter === 'waba') {
    return conversation.waBackendChannel === 'waba';
  }
  return isWhatsAppFilterTab(filter);
};
const getLinkedInConversationStatus = (conversation: Conversation): LinkedInStatusFilter => {
  const raw = `${conversation.conversationState ?? ''} ${(conversation.tags ?? []).join(' ')}`.toLowerCase();
  if (raw.includes('active')) {
    return 'active';
  }
  if (raw.includes('accepted') || raw.includes('connected')) {
    return 'accepted';
  }
  return 'pending';
};
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

type WhatsAppIntegrationSource = 'personal' | 'waba';

const getConnectedWhatsAppSources = (integrations: ConnectedIntegration[]) => {
  const sources = new Set<WhatsAppIntegrationSource>();
  if (integrations.some((integration) => integration.label === 'WhatsApp Personal' && integration.connected)) {
    sources.add('personal');
  }
  if (integrations.some((integration) => integration.label === 'WhatsApp API Agent' && integration.connected)) {
    sources.add('waba');
  }
  return sources;
};

const matchesConnectedWhatsAppSource = (
  conversation: Conversation,
  connectedSources: Set<WhatsAppIntegrationSource>,
) => (
  conversation.channel === 'whatsapp' &&
  connectedSources.has(conversation.waBackendChannel ?? 'personal')
);

const matchesConnectedWhatsAppGroupSource = (
  group: BroadcastGroup,
  connectedSources: Set<WhatsAppIntegrationSource>,
) => connectedSources.has(group.waBackendChannel ?? 'personal');

const WHATSAPP_CONTACT_CHANNEL = 'personal';

const withWhatsAppContactChannel = (path: string) =>
  `${path}${path.includes('?') ? '&' : '?'}channel=${WHATSAPP_CONTACT_CHANNEL}`;

const getActionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// Same palette lad-frontend-2's ChatGroupManager offers for new groups.
const GROUP_COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#78716c',
];

// Alert.alert with buttons is a no-op on react-native-web; fall back to window.confirm.
const confirmAction = (title: string, message: string) =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });

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

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

const WAPA_MEDIA_BASE = (process.env.EXPO_PUBLIC_WAPA_SERVICE_URL || 'https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app').replace(/\/+$/, '');
// BNI/WABA service serves non-personal media at /api/conversations/media/{id} (different path prefix)
const WABA_BNI_MEDIA_BASE = (
  process.env.EXPO_PUBLIC_BNI_SERVICE_URL ||
  process.env.EXPO_PUBLIC_WHATSAPP_API_URL ||
  'https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app'
).replace(/\/+$/, '');

const getBackendMediaUrl = (mediaId: string) => {
  // Local copies of sent attachments (blob:/data:/file:) render directly — never proxy them
  if (/^(https?:|blob:|data:|file:)/.test(mediaId)) return mediaId;
  if (Platform.OS !== 'web') {
    if (mediaId.startsWith('pwa_')) {
      // Personal WhatsApp media — WAPA service, path unchanged
      return `${WAPA_MEDIA_BASE}/api/whatsapp-conversations/conversations/media/${mediaId}`;
    }
    // WABA media — BNI service with rewritten path (mirrors auth-proxy.js routing logic)
    // Proxy rewrites /api/whatsapp-conversations/conversations/media/{id} → /api/conversations/media/{id}
    return `${WABA_BNI_MEDIA_BASE}/api/conversations/media/${mediaId}`;
  }
  return buildApiUrl(`/api/whatsapp-conversations/conversations/media/${mediaId}`, RESOLVED_API_URL);
};

const isVideoMediaItem = (item: ChatMediaItem) =>
  item.mediaType === 'video' || item.mediaType?.startsWith('video/');

const normalizeBusinessProfile = (payload: unknown): WhatsAppBusinessProfile | null => {
  if (!isPlainRecord(payload)) {
    return null;
  }

  const data = isPlainRecord(payload.data) ? payload.data : null;
  const candidates = [
    data && isPlainRecord(data.business_profile) ? data.business_profile : null,
    data && isPlainRecord(data.businessProfile) ? data.businessProfile : null,
    data && isPlainRecord(data.profile) ? data.profile : null,
    isPlainRecord(payload.business_profile) ? payload.business_profile : null,
    isPlainRecord(payload.businessProfile) ? payload.businessProfile : null,
    isPlainRecord(payload.profile) ? payload.profile : null,
    data,
    payload,
  ].filter((candidate): candidate is Record<string, unknown> => Boolean(candidate));

  const pick = (record: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return undefined;
  };

  for (const record of candidates) {
    const profile: WhatsAppBusinessProfile = {
      company_name: pick(record, 'company_name', 'companyName', 'company', 'business_name', 'businessName') as string | undefined,
      industry: pick(record, 'industry', 'business_industry', 'businessIndustry') as string | undefined,
      designation: pick(record, 'designation', 'job_title', 'jobTitle', 'title') as string | undefined,
      services_offered: pick(record, 'services_offered', 'servicesOffered', 'services') as string | undefined,
      ideal_customer_profile: pick(record, 'ideal_customer_profile', 'idealCustomerProfile', 'icp') as string | undefined,
      email: pick(record, 'email', 'business_email', 'businessEmail') as string | undefined,
      website_url: pick(record, 'website_url', 'websiteUrl', 'website', 'url') as string | undefined,
      website_about: pick(record, 'website_about', 'websiteAbout', 'about', 'description') as string | undefined,
      website_clients: pick(record, 'website_clients', 'websiteClients', 'clients') as string | undefined,
      website_services: pick(record, 'website_services', 'websiteServices') as string | undefined,
      icp_top_clients: pick(record, 'icp_top_clients', 'icpTopClients') as string | undefined,
      icp_decision_maker: pick(record, 'icp_decision_maker', 'icpDecisionMaker') as string | undefined,
      icp_ideal_referrals: pick(record, 'icp_ideal_referrals', 'icpIdealReferrals') as string | undefined,
      icp_extra: pick(record, 'icp_extra', 'icpExtra') as string | undefined,
      kpi_members_met: pick(record, 'kpi_members_met', 'kpiMembersMet') as number | undefined,
      kpi_referrals_given: pick(record, 'kpi_referrals_given', 'kpiReferralsGiven') as number | undefined,
      kpi_referrals_received: pick(record, 'kpi_referrals_received', 'kpiReferralsReceived') as number | undefined,
      kpi_one_to_ones: pick(record, 'kpi_one_to_ones', 'kpiOneToOnes') as number | undefined,
      kpi_visitors_invited: pick(record, 'kpi_visitors_invited', 'kpiVisitorsInvited') as number | undefined,
    };
    const hasProfileValue = Object.values(profile).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
    if (hasProfileValue) return profile;
  }

  return null;
};

const fetchWhatsAppBusinessProfile = async (conversationId: string, channel: 'personal' | 'waba' = 'personal') => {
  const token = await getAuthToken();
  const response = await fetch(
    buildApiUrl(`/api/whatsapp-conversations/conversations/${encodeURIComponent(conversationId)}/business-profile?channel=${channel}`, RESOLVED_API_URL),
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

  return <AlertCircle color={Theme.colors.error} size={14} />;
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
  // Conversation stage (context_status) as the second capsule, e.g. "Greeting".
  const stageRaw = conversation.channel === 'whatsapp' ? conversation.conversationState?.trim() : undefined;
  const stageLabel = stageRaw ? formatContextStatus(stageRaw) : '';
  const stageColor = stageRaw ? WABA_STAGE_COLORS[stageRaw.toLowerCase()] ?? WABA_STAGE_DEFAULT : WABA_STAGE_DEFAULT;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.conversationRow,
        {
          backgroundColor: appTheme.surface,
          borderColor: isActive ? appTheme.primaryAccent : appTheme.borderSoft,
          shadowColor: '#000000',
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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Typography variant="h4" numberOfLines={1} style={[styles.conversationName, { color: appTheme.text }]}>
              {conversation.name}
            </Typography>
          </View>
          <View style={[styles.timePill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface }]}>
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
            <View style={[styles.unreadBadge, appTheme.darkMode && { backgroundColor: appTheme.labelBackgroundActive, borderColor: appTheme.labelBorder, borderWidth: 1 }]}>
              <Typography variant="caption" color={appTheme.darkMode ? appTheme.labelText : Theme.colors.surface} style={styles.unreadText}>
                {conversation.unreadCount}
              </Typography>
            </View>
          )}
        </View>

        <View style={styles.conversationMetaLine}>
          <View style={[styles.channelPill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${channelColor}16`, borderColor: appTheme.darkMode ? appTheme.labelBorder : `${channelColor}32` }]}>
            <ChannelGlyph channel={conversation.channel} color={channelColor} size={10} />
            <Typography variant="caption" style={[styles.channelPillText, { color: channelColor }]} numberOfLines={1}>
              {channelLabel}
            </Typography>
          </View>
          {stageLabel ? (
            <View style={[styles.stagePill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${stageColor}1F`, borderColor: appTheme.darkMode ? appTheme.labelBorder : `${stageColor}45` }]}>
              <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
              <Typography variant="caption" style={[styles.channelPillText, { color: stageColor }]} numberOfLines={1}>
                {stageLabel}
              </Typography>
            </View>
          ) : conversation.company ? (
            <Typography variant="caption" color={appTheme.disabled} numberOfLines={1} style={styles.companyText}>
              {conversation.company}
            </Typography>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Gmail-mobile style row for email conversations — sender, subject, snippet,
// date and unread state, tinted per provider (Gmail red / Outlook blue).
// Mirrors lad-frontend-2's EmailChannelView inbox rows.
const EmailConversationRow = memo(({
  conversation,
  isActive,
  onPress,
}: {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();
  const providerId = getEmailProviderId(conversation);
  const provider = EMAIL_PROVIDER_META[providerId];
  const isUnread = conversation.unreadCount > 0;
  const subjectLine = conversation.lastMessage && conversation.lastMessage !== 'Open email thread'
    ? conversation.lastMessage
    : '(no subject)';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginHorizontal: 12,
        marginVertical: 3,
        borderRadius: 14,
        backgroundColor: isActive ? appTheme.infoSoft : isUnread ? appTheme.surface : 'transparent',
        borderWidth: isActive ? 1 : 0,
        borderColor: appTheme.primaryAccent,
      }}
    >
      <Avatar src={conversation.avatar} fallback={getInitials(conversation.name)} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Typography
            variant="body"
            numberOfLines={1}
            style={{ flex: 1, color: appTheme.text, fontWeight: isUnread ? '700' : '500', fontSize: 15 }}
          >
            {conversation.name}
          </Typography>
          <Typography variant="caption" style={{ color: isUnread ? provider.color : appTheme.muted, fontWeight: isUnread ? '700' : '400' }}>
            {formatTime(conversation.lastMessageAt)}
          </Typography>
        </View>
        <Typography
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: appTheme.text, fontWeight: isUnread ? '600' : '400', marginTop: 1 }}
        >
          {subjectLine}
        </Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 }}>
          <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ flex: 1 }}>
            {conversation.email || conversation.company || ' '}
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Mail color={provider.color} size={12} />
            <Typography variant="caption" style={{ color: provider.color, fontWeight: '600' }}>
              {provider.label}
            </Typography>
          </View>
          {isUnread && (
            <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: provider.color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Typography variant="caption" color="#FFF" style={{ fontSize: 10, fontWeight: '700' }}>
                {conversation.unreadCount}
              </Typography>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Email thread message — Gmail-style collapsible card: sender row with
// <email> and date, subject, snippet when collapsed, full body + "to me"
// when expanded. Mirrors lad-frontend-2's EmailComposePanel thread items.
const EmailMessageCard = memo(({
  message,
  contactName,
  contactEmail,
  providerLabel,
  providerColor,
  providerId,
  defaultExpanded,
}: {
  message: ChatMessage;
  contactName: string;
  contactEmail?: string;
  providerLabel: string;
  providerColor: string;
  providerId: EmailProviderId;
  defaultExpanded: boolean;
}) => {
  const appTheme = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isAgent = message.sender === 'agent';
  const senderName = isAgent ? 'You' : contactName;
  const preview = message.content.replace(/\s+/g, ' ').trim();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((value) => !value)}
      style={{
        marginHorizontal: 12,
        marginVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: appTheme.borderSoft,
        backgroundColor: appTheme.surface,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: expanded ? 8 : 12 }}>
        {isAgent ? <ProviderLogo provider={providerId} size={34} /> : <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: isAgent ? providerColor : appTheme.softSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" style={{ fontWeight: '700', color: isAgent ? '#FFF' : appTheme.text }}>
            {getInitials(senderName)}
          </Typography>
        </View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Typography variant="bodySmall" style={{ fontWeight: '700', color: appTheme.text }} numberOfLines={1}>
              {senderName}
            </Typography>
            {isAgent ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: providerColor }}>
                <Typography variant="caption" color="#FFF" style={{ fontSize: 8, fontWeight: '700' }}>{providerLabel}</Typography>
              </View>
            ) : contactEmail ? (
              <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {`<${contactEmail}>`}
              </Typography>
            ) : null}
            <Typography variant="caption" color={appTheme.muted} style={{ marginLeft: 'auto' }}>
              {formatTime(message.createdAt)}
            </Typography>
            {expanded
              ? <ChevronUp color={appTheme.muted} size={14} />
              : <ChevronDown color={appTheme.muted} size={14} />}
          </View>
          <Typography
            variant="bodySmall"
            style={{ fontWeight: '600', color: appTheme.text, marginTop: 1 }}
            numberOfLines={1}
          >
            {message.subject || '(no subject)'}
          </Typography>
          {expanded ? (
            <Typography variant="caption" color={appTheme.muted} style={{ marginTop: 1 }}>
              {isAgent ? `to ${contactName}` : 'to me ▾'}
            </Typography>
          ) : (
            <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ marginTop: 1 }}>
              {preview}
            </Typography>
          )}
        </View>
      </View>
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: appTheme.borderSoft, marginTop: 2 }}>
          <Typography variant="bodySmall" color={appTheme.text} style={{ lineHeight: 21, fontSize: 14 }}>
            {message.content}
          </Typography>
        </View>
      )}
    </TouchableOpacity>
  );
});

EmailConversationRow.displayName = 'EmailConversationRow';
EmailMessageCard.displayName = 'EmailMessageCard';
ConversationRow.displayName = 'ConversationRow';
const SecureImage = ({ uri, headers, style, resizeMode, onLoad }: any) => {
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const appTheme = useAppTheme();

  // Auth-fetch for any protected URL — web gets a blob URL, native gets a data: URI via FileReader.
  // RN Image's headers prop is unreliable on Android (strips auth on cross-origin redirects).
  const needsAuthFetch = !!uri && !uri.startsWith('blob:') && !uri.startsWith('file:') && !uri.startsWith('data:') && !!headers?.Authorization;

  useEffect(() => {
    setDisplayUri(null);
    setError(null);
    setLoadFailed(false);
    if (!needsAuthFetch) return;

    let isMounted = true;

    void (async () => {
      try {
        const res = await fetch(uri, { headers });
        if (!isMounted) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        if (Platform.OS === 'web') {
          // Web: blob → object URL (no base64 overhead in browser)
          const blob = await res.blob();
          if (isMounted) setDisplayUri(URL.createObjectURL(blob));
        } else {
          // Native: arrayBuffer → base64 data URI (more reliable than blob→FileReader in RN)
          const ct = res.headers.get('content-type') || 'image/jpeg';
          const buf = await res.arrayBuffer();
          if (!isMounted) return;
          const bytes = new Uint8Array(buf);
          let binary = '';
          const CHUNK = 8192;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
          }
          if (isMounted) setDisplayUri(`data:${ct};base64,${btoa(binary)}`);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'fetch failed');
          setLoadFailed(true);
        }
      }
    })();

    return () => { isMounted = false; };
  }, [uri, needsAuthFetch]); // headers intentionally omitted — auth token doesn't change per-session

  if (loadFailed) {
    return (
      <View style={[style, { backgroundColor: appTheme.softSurface, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }]}>
        <ImageIcon color={appTheme.disabled} size={26} />
        <Typography variant="caption" color={appTheme.disabled} style={{ marginTop: 4, fontSize: 10 }}>
          {__DEV__ && error ? error : 'Image unavailable'}
        </Typography>
      </View>
    );
  }

  // Spinner while auth-fetching
  if (needsAuthFetch && !displayUri) {
    return (
      <View style={[style, { backgroundColor: appTheme.softSurface, justifyContent: 'center', alignItems: 'center', borderRadius: 8 }]}>
        <ActivityIndicator size="small" color={appTheme.primaryAccent} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: displayUri || uri }}
      style={style}
      resizeMode={resizeMode}
      onLoad={onLoad}
      onError={() => setLoadFailed(true)}
    />
  );
};

const MessageBubble = memo(({
  message,
  channel,
  contactName,
  contactAvatar,
  authToken,
  onPlayAudio,
  isCurrentlyPlaying,
  isGroup,
  isHighlighted,
}: {
  message: ChatMessage;
  channel: ChatChannel;
  contactName: string;
  contactAvatar?: string;
  authToken?: string | null;
  onPlayAudio?: (id: string, url: string) => void;
  isCurrentlyPlaying?: boolean;
  isGroup?: boolean;
  isHighlighted?: boolean;
}) => {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const appTheme = useAppTheme();
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isHighlighted) return undefined;
    const animation = Animated.sequence([
      Animated.timing(highlightAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.delay(150),
      Animated.timing(highlightAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [isHighlighted, highlightAnim]);

  const highlightBackgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(250, 204, 21, 0)', 'rgba(250, 204, 21, 0.38)'],
  });
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
  const timestampColor = appTheme.darkMode
    ? (isAgent ? 'rgba(226, 232, 240, 0.62)' : '#8FA1BA')
    : appTheme.disabled;
  const leadInitials = getInitials(message.senderName || contactName || 'L');
  const agentInitials = 'A';
  const emailMetaLabel = isAgent ? `To: ${contactName || 'Recipient'}` : `From: ${message.senderName || contactName || 'Sender'}`;

  // Detect special message types
  const hasLocationCoords = message.latitude != null && message.longitude != null;
  const isLocationMessage = hasLocationCoords || message.content?.includes('Location shared');
  const isContactMessage = message.type === 'contact' && Boolean(message.contactName || message.contactPhone || message.contactEmail);
  const locationLines = (isLocationMessage && !hasLocationCoords) ? message.content.split('\n') : [];
  const locationDisplayName = message.locationName || locationLines[1] || 'Location';

  // Try to extract coordinates from Google Maps link in text
  let extractedLat: number | undefined = undefined;
  let extractedLon: number | undefined = undefined;
  if (!hasLocationCoords && isLocationMessage && message.content) {
    const match = message.content.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      extractedLat = parseFloat(match[1]);
      extractedLon = parseFloat(match[2]);
    }
  }

  const locationLat = message.latitude ?? extractedLat;
  const locationLon = message.longitude ?? extractedLon;
  // Build map links from coordinates (prefer coords over embedded link in content)
  const googleMapsUrl = (locationLat != null && locationLon != null)
    ? `https://maps.google.com/maps?q=${locationLat},${locationLon}`
    : (locationLines[2] || '');
  const appleMapsUrl = (locationLat != null && locationLon != null)
    ? `https://maps.apple.com/?ll=${locationLat},${locationLon}&q=${locationLat},${locationLon}`
    : undefined;
  const wazeUrl = (locationLat != null && locationLon != null)
    ? `https://waze.com/ul?ll=${locationLat},${locationLon}&navigate=yes`
    : undefined;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const staticMapImageUrl = (locationLat != null && locationLon != null)
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${locationLat},${locationLon}&zoom=15&size=300x140&markers=color:red%7C${locationLat},${locationLon}${googleMapsApiKey ? `&key=${googleMapsApiKey}` : ''}`
    : undefined;

  // Check if content is just the media identifier or a common placeholder.
  // Case-insensitive: the WABA backend stores outbound media rows with
  // capitalised placeholders ("Image", "Video", …).
  const normalizedContent = (message.content || '').trim().toLowerCase();
  const isWaMediaPlaceholder = !!message.content && (
    [
      '\u{1F4F7} photo', '\u{1F4F8} photo', 'photo',
      '\u{1F3A5} video', 'video',
      '\u{1F4C4} document', 'document',
      '\u{1F3B5} audio', 'audio',
      '\u{1F3A4} voice message', 'voice message',
      'image', 'attachment',
    ].includes(normalizedContent) ||
    // Bare WhatsApp media id (15-16 digit number) echoed back as content
    /^\d{10,}$/.test(normalizedContent)
  );

  // content is a raw filename (e.g. "Mr LAD.png") — treat as media ref so it isn't shown as caption
  const isFilenameContent = /\.(jpe?g|png|gif|webp|heic|bmp|mp4|mov|avi|mkv|webm|mp3|m4a|ogg|opus|pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test((message.content || '').trim());

  const isContentMediaRef = message.mediaId && (
    message.content === message.mediaId ||
    message.content.includes(message.mediaId) ||
    (message.content.startsWith('http') && message.content === message.mediaId) ||
    isWaMediaPlaceholder ||
    isFilenameContent ||
    message.content === message.mediaFilename ||
    (message.mediaFilename && message.content.includes(message.mediaFilename))
  );

  const displayCaption = isContactMessage ? '' : message.mediaCaption || (!isContentMediaRef ? message.content : '');

  // Split attachments by type
  const imageAttachments = message.attachments?.filter((a) => a.type === 'image' || a.type === 'video') ?? [];
  const docAttachments = message.attachments?.filter((a) => a.type === 'document') ?? [];

  // Media info from direct backend response format
  const hasMediaId = !!message.mediaId;
  // Also infer image/video from filename extension when mediaType isn't set by the backend
  const filenameExt = (message.mediaFilename || message.content || '').toLowerCase();
  const isFilenameImage = /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(filenameExt);
  const isFilenameVideo = /\.(mp4|mov|avi|mkv|webm|3gp)$/.test(filenameExt);
  const isImageMedia = hasMediaId && (message.mediaType === 'image' || (message.mediaMimeType?.startsWith('image/') ?? false) || (!message.mediaType && isFilenameImage));
  const isVideoMedia = hasMediaId && (message.mediaType === 'video' || (message.mediaMimeType?.startsWith('video/') ?? false) || (!message.mediaType && isFilenameVideo));
  const isAudioMedia = hasMediaId && (message.mediaType === 'audio' || (message.mediaMimeType?.startsWith('audio/') ?? false));
  const isDocumentMedia = hasMediaId && !isImageMedia && !isVideoMedia && !isAudioMedia;
  // blob: URIs are local previews — use them directly; http/https are direct URLs; others go through proxy
  const mediaUrl = hasMediaId ? getBackendMediaUrl(message.mediaId!) : null;

  const hasOnlyMedia = (imageAttachments.length > 0 || isImageMedia || isVideoMedia) && !displayCaption && docAttachments.length === 0 && !isDocumentMedia;
  const [mapImageError, setMapImageError] = React.useState(false);

  return (
    <View
      style={[
        styles.messageRow,
        isAgent ? styles.messageRowAgent : styles.messageRowLead,
        isEmail && styles.emailMessageRow,
        isLinkedIn && styles.linkedinMessageRow,
      ]}
    >
      {isHighlighted ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.messageHighlightOverlay, { backgroundColor: highlightBackgroundColor }]}
        />
      ) : null}
      {!isAgent && !isEmail && isGroup && (
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
            onPress={() => attachment.url && setFullscreenImage(attachment.url)}
          >
            <SecureImage
              uri={attachment.url}
              headers={authToken ? { Authorization: `Bearer ${authToken}` } : undefined}
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}

        {/* MediaId image/video — only if not already rendered via imageAttachments above */}
        {(isImageMedia || isVideoMedia) && mediaUrl && imageAttachments.length === 0 && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setFullscreenImage(mediaUrl)}
          >
            <SecureImage
              uri={mediaUrl}
              headers={authToken ? { Authorization: `Bearer ${authToken}` } : undefined}
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
                    {/* Location card — matches LAD frontend-2 LocationCard */}
        {isContactMessage ? (
          <View style={[styles.contactMessageCard, { backgroundColor: appTheme.darkMode ? appTheme.softSurface : '#FFFFFF', borderColor: appTheme.border }]}>
            <View style={styles.contactMessageHeader}>
              <View style={[styles.contactMessageAvatar, { backgroundColor: appTheme.infoSoft }]}>
                <UserRound color={appTheme.primaryAccent} size={20} />
              </View>
              <View style={styles.contactMessageIdentity}>
                <Typography variant="bodySmall" color={appTheme.text} style={styles.contactMessageName} numberOfLines={1}>
                  {message.contactName || 'Contact'}
                </Typography>
                {message.contactCompany ? (
                  <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{message.contactCompany}</Typography>
                ) : null}
              </View>
            </View>
            {message.contactPhone ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => void Linking.openURL(`tel:${message.contactPhone}`).catch(() => undefined)}
                style={[styles.contactMessageRow, { borderTopColor: appTheme.borderSoft }]}
              >
                <Phone color={appTheme.primaryAccent} size={14} />
                <Typography variant="caption" color={appTheme.text} numberOfLines={1} style={styles.contactMessageValue}>
                  {message.contactPhone}
                </Typography>
              </TouchableOpacity>
            ) : null}
            {message.contactEmail ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => void Linking.openURL(`mailto:${message.contactEmail}`).catch(() => undefined)}
                style={[styles.contactMessageRow, { borderTopColor: appTheme.borderSoft }]}
              >
                <Mail color={appTheme.primaryAccent} size={14} />
                <Typography variant="caption" color={appTheme.text} numberOfLines={1} style={styles.contactMessageValue}>
                  {message.contactEmail}
                </Typography>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : isLocationMessage ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => googleMapsUrl ? void Linking.openURL(googleMapsUrl).catch(() => undefined) : undefined}
                        style={styles.locationCard}
                      >
                        {/* Static map thumbnail — dark gray bg like frontend-2 */}
                        <View style={styles.locationMapPreview}>
                          {staticMapImageUrl && !mapImageError && (
                            <Image
                              source={{ uri: staticMapImageUrl }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                              onError={() => setMapImageError(true)}
                            />
                          )}
                          {/* Pin overlay — always centered, same as frontend-2 */}
                          <View style={styles.locationPinOverlay}>
                            <MapPin color="#EF4444" size={32} fill="#EF4444" />
                          </View>
                        </View>

                        {/* Label bar — dark bg, white text + coords, matches frontend-2 */}
                        <View style={styles.locationLabelBar}>
                          <Typography
                            variant="body"
                            style={styles.locationLabelText}
                            numberOfLines={1}
                          >
                            {locationDisplayName || 'Current location'}
                          </Typography>
                          {locationLat != null && locationLon != null && (
                            <Typography
                              variant="caption"
                              style={styles.locationCoords}
                              numberOfLines={1}
                            >
                              {`${locationLat.toFixed(6)}, ${locationLon.toFixed(6)}`}
                            </Typography>
                          )}
                        </View>
                      </TouchableOpacity>
        ) : (
          !hasOnlyMedia && displayCaption ? (
            <Text
              style={[
                { lineHeight: 20, color: isAgent ? palette.outgoingText : leadTextColor, fontSize: 14 },
                isEmail && { lineHeight: 22 },
              ]}
            >
              {displayCaption.split(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi).map((part, i) => {
                const isUrl = /^https?:\/\//i.test(part) || /^www\./i.test(part);
                if (isUrl) {
                  const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
                  return (
                    <Text
                      key={i}
                      style={{
                        color: isAgent
                          ? appTheme.darkMode ? '#93C5FD' : '#027EB5'
                          : '#1A73E8',
                        textDecorationLine: 'underline',
                        fontWeight: '500',
                      }}
                      onPress={() => void Linking.openURL(href).catch(() => undefined)}
                    >
                      {part}
                    </Text>
                  );
                }
                return <Text key={i}>{part}</Text>;
              })}
            </Text>
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
            color={timestampColor}
          >
            {formatTime(message.createdAt)}
          </Typography>
          <MessageStatusIcon message={message} />
        </View>
      </View>
      {isAgent && !isEmail && isGroup && (
        <Avatar
          fallback={agentInitials}
          size={28}
          style={isLinkedIn ? { ...styles.messageAvatarImg, ...styles.linkedinAgentAvatar } : styles.messageAvatarImg}
          authToken={authToken}
        />
      )}
      <Modal visible={!!fullscreenImage} transparent={true} onRequestClose={() => setFullscreenImage(null)} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, flexDirection: 'row', alignItems: 'center' }} onPress={() => setFullscreenImage(null)}>
            <ArrowLeft color="#FFF" size={20} />
            <Typography variant="body" color="#FFF" style={{ marginLeft: 8 }}>Back</Typography>
          </TouchableOpacity>
          {fullscreenImage && (
            <SecureImage
              uri={fullscreenImage}
              headers={authToken ? { Authorization: `Bearer ${authToken}` } : undefined}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
});

MessageBubble.displayName = 'MessageBubble';

type AgentMode = 'ai' | 'human';
const getAgentModeFromConversation = (conversation?: Conversation | null): AgentMode => {
  if (conversation?.ownerType === 'human_agent') {
    return 'human';
  }

  if (conversation?.ownerType === 'AI') {
    return 'ai';
  }

  const owner = `${conversation?.ownerType ?? ''} ${conversation?.owner ?? ''}`;
  if (/ai[_\s-]?agent|bot|assistant|automation|\bai\b/i.test(owner)) {
    return 'ai';
  }

  return /human[_\s-]?agent|human|manual|team member/i.test(owner) ? 'human' : 'ai';
};

type MetadataRow = {
  label: string;
  value: string;
};

const METADATA_SKIP_KEYS = new Set([
  'avatar',
  'body',
  'caption',
  'content',
  'file_url',
  'filename',
  'last_message',
  'last_message_content',
  'media_filename',
  'media_id',
  'media_type',
  'message',
  'messages',
  'preview',
  'text',
  'url',
]);

const isPresentMetadataValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
};

const formatMetadataLabel = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatMetadataValue = (value: unknown): string => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .filter(Boolean)
      .join(', ');
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return '';
};

const getBackendMetadataRows = (conversation: Conversation): MetadataRow[] => {
  const metadata = {
    ...(conversation.metadata ?? {}),
    ...(conversation.contactMetadata ?? {}),
  };
  const seen = new Set<string>();

  return Object.entries(metadata)
    .filter(([key, value]) => !METADATA_SKIP_KEYS.has(key) && isPresentMetadataValue(value))
    .map(([key, value]) => ({
      label: formatMetadataLabel(key),
      value: formatMetadataValue(value),
    }))
    .filter((row) => {
      const dedupeKey = `${row.label.toLowerCase()}:${row.value}`;
      if (!row.value || seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
};

const getContactMetadataRows = (
  conversation: Conversation,
  stateLabel: string,
  ownerLabel: string,
  messageCount: number,
): MetadataRow[] => {
  const rows: MetadataRow[] = [
    { label: 'Status', value: stateLabel },
    { label: 'Owner', value: ownerLabel },
    { label: 'Channel', value: getChannelLabel(conversation.channel) },
    { label: 'Messages', value: String(conversation.messageCount || messageCount) },
    ...getBackendMetadataRows(conversation),
  ];
  const seen = new Set<string>();

  return rows.filter((row) => {
    const dedupeKey = row.label.toLowerCase();
    if (!row.value || seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
};

const confirmHumanTakeover = () => new Promise<boolean>((resolve) => {
  const title = 'Take over this chat?';
  const message = 'This will pause the AI agent and give you manual control until you switch back.';

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    resolve(window.confirm(`${title}\n\n${message}`));
    return;
  }

  Alert.alert(title, message, [
    { text: 'Take Over', style: 'default', onPress: () => resolve(true) },
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
  ]);
});

type AttachmentAction = 'photos' | 'camera' | 'document' | 'audio' | 'location' | 'contact' | 'poll' | 'template' | 'event' | 'sticker';
type QuickComposerAction = 'location' | 'contact' | 'poll' | 'event';
type QuickComposerDraft = {
  locationName: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
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
  locationAddress: undefined,
  latitude: undefined,
  longitude: undefined,
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
    <TouchableOpacity
      style={styles.attachmentActionItem}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={[styles.attachmentActionIcon, { backgroundColor: color }]}>
        <Icon color="#FFFFFF" size={16} />
      </View>
      <Typography variant="bodySmall" color={appTheme.text} style={styles.attachmentActionLabel} numberOfLines={1}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
};

const ChannelFilterPill = ({
  icon: Icon,
  label,
  active,
  accent,
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) => {
  const appTheme = useAppTheme();
  const color = active ? accent : appTheme.muted;

  return (
    <TouchableOpacity
      style={[
        styles.channelFilterPill,
        {
          backgroundColor: appTheme.darkMode
            ? active ? appTheme.labelBackgroundActive : appTheme.labelBackground
            : active ? `${accent}20` : appTheme.input,
          borderColor: appTheme.darkMode ? appTheme.labelBorder : active ? `${accent}80` : appTheme.border,
        },
      ]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <Icon color={color} size={14} />
      <Typography variant="caption" color={color} style={styles.channelFilterPillText} numberOfLines={1}>
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
      style={[
        styles.whatsAppContactAction,
        {
          backgroundColor: appTheme.surface,
          borderColor: appTheme.darkMode ? 'rgba(148, 163, 184, 0.24)' : appTheme.border,
        },
      ]}
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
  onPress,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.whatsAppDangerRow}
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
      <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border, borderWidth: appTheme.darkMode ? 1 : 0 }]}>
        <ActivityIndicator color={appTheme.primaryAccent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border, borderWidth: appTheme.darkMode ? 1 : 0 }]}>
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
    <View style={[styles.businessProfileCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border, borderWidth: appTheme.darkMode ? 1 : 0 }]}>
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
          <CreditCard color={appTheme.primaryAccent} size={16} />
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
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
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
                        <Typography variant="caption" color={appTheme.primaryAccent} style={styles.paymentOptionPrice}>
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
                  {verifying ? <ActivityIndicator color={appTheme.primaryAccent} size="small" /> : <Shield color={appTheme.primaryAccent} size={15} />}
                  <Typography variant="caption" color={appTheme.primaryAccent} style={styles.paymentActionText}>
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
              <CreditCard color={appTheme.primaryAccent} size={15} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.paymentActionText}>
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
  // Once the assignment has been loaded (or optimistically set), trust it as the
  // source of truth: a null `current` means the conversation is unassigned, even
  // if the conversation record still carries a stale `owner` name. Only fall back
  // to `conversation.owner` before the first load, to avoid a flash of "Unassigned".
  const assignmentLoaded = assignment !== null;
  const currentAssignee = currentAssigneeId
    ? membersById.get(currentAssigneeId) ?? { id: currentAssigneeId, name: conversation.owner || 'Team member' }
    : assignmentLoaded
      ? null
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
      if (member) {
        const nextAssignment = await assignConversationToTeamMember(conversation.id, member.id);
        setAssignment(nextAssignment);
        setPickerOpen(false);
        setNotice(`Assigned to ${member.name}`);
      } else {
        // Optimistically clear the assignment immediately so the UI reflects
        // the unassignment without waiting for the re-fetch. The backend
        // /threads/:id/unassign call persists it (mirrors lad-frontend-2), and
        // the re-fetch below confirms current === null.
        setAssignment({ current: null, history: assignment?.history ?? [] });
        setPickerOpen(false);
        await unassignConversationFromTeamMember(conversation.id);
        setNotice('Conversation unassigned');
      }
      onAssignmentChanged?.();
      void loadAssignment();
    } catch (requestError) {
      setError(getActionErrorMessage(requestError, member ? `Unable to assign ${member.name}.` : 'Unable to unassign conversation.'));
    } finally {
      setAssigningId(null);
    }
  }, [assignment, conversation.id, loadAssignment, onAssignmentChanged]);

  const initials = getInitials(currentAssignee?.name || conversation.owner || 'TE') || 'TE';
  const recentHistory = assignment?.history?.slice(0, 3) ?? [];

  return (
    <View style={[styles.assignmentCard, styles.workflowCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
      <View style={styles.assignmentMemberRow}>
        <View style={[styles.assignmentAvatar, { backgroundColor: appTheme.primarySoft }]}>
          <Typography variant="caption" color={appTheme.primaryAccent} style={styles.assignmentAvatarText}>
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
            <ActivityIndicator color={appTheme.primaryAccent} size="small" />
          ) : (
            <>
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.reassignButtonText}>
                {currentAssignee ? 'Reassign' : 'Assign'}
              </Typography>
              <ChevronDown color={appTheme.primaryAccent} size={14} />
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
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
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
                    <Typography variant="caption" color={appTheme.primaryAccent} style={styles.assignmentAvatarText}>
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
  const canManageExistingNotes = conversation.channel === 'whatsapp';
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
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteConversationNote(note.id);
              setNotes((current) => current.filter((item) => item.id !== note.id));
            } catch (requestError) {
              setError(getActionErrorMessage(requestError, 'Unable to delete note.'));
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
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
          <ActivityIndicator color={appTheme.primaryAccent} size="small" />
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
                    {canManageExistingNotes ? (
                      <View style={styles.noteActionRow}>
                        <TouchableOpacity
                          style={[styles.noteTextButton, { borderColor: appTheme.border }]}
                          activeOpacity={0.76}
                          onPress={() => {
                            setEditingId(note.id);
                            setEditingContent(note.displayContent);
                          }}
                        >
                          <Typography variant="caption" color={appTheme.primaryAccent}>Edit</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.noteTextButton, { borderColor: appTheme.border }]}
                          activeOpacity={0.76}
                          onPress={() => handleDeleteNote(note)}
                        >
                          <Typography variant="caption" color={Theme.colors.error}>Delete</Typography>
                        </TouchableOpacity>
                      </View>
                    ) : null}
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

const UnsupportedWorkflowPanel = ({
  icon: Icon = Info,
  title,
  description,
}: {
  icon?: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  description: string;
}) => {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.workflowCard, { backgroundColor: appTheme.warningSoft, borderColor: Theme.colors.warning }]}>
      <View style={styles.unsupportedWorkflowContent}>
        <Icon color={Theme.colors.warning} size={24} />
        <Typography variant="bodySmall" color={Theme.colors.warning} style={styles.unsupportedWorkflowTitle}>
          {title}
        </Typography>
        <Typography variant="caption" color={Theme.colors.warning} style={styles.unsupportedWorkflowCopy}>
          {description}
        </Typography>
      </View>
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
  const assignmentSupported = conversation.channel === 'whatsapp';
  const notesSupported = conversation.channel === 'whatsapp' || conversation.channel === 'linkedin';
  const internalSupported = conversation.channel === 'whatsapp';
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
              <Icon color={active ? appTheme.primaryAccent : appTheme.muted} size={15} />
              <Typography
                variant="caption"
                color={active ? appTheme.primaryAccent : appTheme.muted}
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
        assignmentSupported ? (
          <AssignmentWorkflowPanel conversation={conversation} onAssignmentChanged={onAssignmentChanged} />
        ) : (
          <UnsupportedWorkflowPanel
            icon={Users}
            title={`Assignment for ${getChannelLabel(conversation.channel)} is not available yet`}
            description="LAD-Frontend-2 keeps this disabled until the backend ships per-conversation assignment for this channel. WhatsApp assignment is fully wired."
          />
        )
      ) : activeTab === 'notes' ? (
        notesSupported ? (
          <NotesWorkflowPanel conversation={conversation} />
        ) : (
          <UnsupportedWorkflowPanel
            icon={Tag}
            title={`Notes for ${getChannelLabel(conversation.channel)} are not available yet`}
            description="This channel does not expose a conversation notes API in the backend yet."
          />
        )
      ) : internalSupported ? (
        <NotesWorkflowPanel conversation={conversation} internal />
      ) : (
        <UnsupportedWorkflowPanel
          icon={MessageSquare}
          title={`Internal comments for ${getChannelLabel(conversation.channel)} are not available yet`}
          description="LAD-Frontend-2 marks internal comments as coming soon for this channel. WhatsApp internal comments use the live notes API."
        />
      )}
    </View>
  );
};

const MediaPreviewTile = ({
  item,
  compact = false,
  onImagePress,
}: {
  item: ChatMediaItem;
  compact?: boolean;
  onImagePress?: (url: string) => void;
}) => {
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

  // Image tile — open in fullscreen viewer with auth (never open raw URL in browser → 401)
  return (
    <TouchableOpacity
      style={compact ? styles.whatsAppMediaPreviewTile : styles.mediaGridTile}
      activeOpacity={0.78}
      onPress={() => onImagePress ? onImagePress(item.url) : undefined}
    >
      <SecureImage
        uri={item.url}
        headers={authToken ? { Authorization: `Bearer ${authToken}` } : undefined}
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
  const authToken = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<ChatMediaKind>(initialTab);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
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
                  <MediaPreviewTile item={item} onImagePress={setFullscreenUrl} />
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

      {/* Fullscreen image viewer — uses SecureImage to attach auth header (prevents 401 on proxy-served images) */}
      <Modal visible={!!fullscreenUrl} transparent animationType="fade" onRequestClose={() => setFullscreenUrl(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: Math.max(insets.top, 16) + 8, left: 16, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => setFullscreenUrl(null)}
          >
            <ArrowLeft color="#FFF" size={20} />
            <Typography variant="body" color="#FFF" style={{ marginLeft: 8 }}>Back</Typography>
          </TouchableOpacity>
          {fullscreenUrl && (
            <SecureImage
              uri={fullscreenUrl}
              headers={authToken ? { Authorization: `Bearer ${authToken}` } : undefined}
              style={{ width: width, height: width, maxWidth: 720, maxHeight: 720 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  const { formatPhone } = usePhoneMasking();
  const stateLabel = resolved ? 'Resolved' : conversation.conversationState || 'Open';
  const ownerLabel = conversation.owner || (conversation.ownerType === 'human_agent' ? 'Human Agent' : 'AI Agent');
  const startedLabel = formatTime(conversation.startedAt || conversation.lastMessageAt);
  const phoneLabel = formatPhone(conversation.phone) || conversation.email || getChannelLabel(conversation.channel);
  const isWhatsAppContact = isWhatsAppChannel(conversation.channel);
  const profileAvatarSize = width < 360 ? 124 : width < 390 ? 136 : fullPage ? 148 : 140;
  const firstName = conversation.name.split(' ').filter(Boolean)[0] || conversation.name;
  const metadataRows = useMemo(
    () => getContactMetadataRows(conversation, stateLabel, ownerLabel, messageCount),
    [conversation, messageCount, ownerLabel, stateLabel],
  );
  const fallbackBusinessProfile = useMemo(() => {
    const metadata = conversation.metadata ?? {};
    const contactMetadata = conversation.contactMetadata ?? {};
    return normalizeBusinessProfile({
      ...metadata,
      ...contactMetadata,
      company_name: conversation.company ?? contactMetadata.company_name ?? metadata.company_name,
      email: conversation.email ?? contactMetadata.email ?? metadata.email,
      website_url: contactMetadata.website_url ?? contactMetadata.website ?? metadata.website_url ?? metadata.website,
      designation: contactMetadata.designation ?? contactMetadata.job_title ?? metadata.designation ?? metadata.job_title,
    });
  }, [conversation.company, conversation.contactMetadata, conversation.email, conversation.metadata]);
  const sectionBorderColor = appTheme.darkMode ? 'rgba(148, 163, 184, 0.18)' : appTheme.border;
  const darkSectionStyle = appTheme.darkMode
    ? {
        backgroundColor: appTheme.surface,
        borderColor: sectionBorderColor,
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: Theme.spacing.md,
        marginBottom: Theme.spacing.md,
      }
    : null;

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
    void fetchWhatsAppBusinessProfile(conversation.id, conversation.waBackendChannel ?? 'personal')
      .then((profile) => {
        if (mounted) {
          setBusinessProfile(profile ?? fallbackBusinessProfile);
        }
      })
      .catch(() => {
        if (mounted) {
          setBusinessProfile(fallbackBusinessProfile);
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
  }, [conversation.id, conversation.waBackendChannel, fallbackBusinessProfile, isWhatsAppContact]);

  if (isWhatsAppContact) {
    return (
      <View style={[styles.contactPanel, fullPage && styles.contactPanelFullPage, styles.whatsAppContactPanel, { backgroundColor: appTheme.darkMode ? appTheme.background : appTheme.surface, borderLeftColor: sectionBorderColor }]}>
        <View style={[styles.whatsAppContactHeader, { paddingTop: Math.max(insets.top, 14), backgroundColor: appTheme.surface, borderBottomColor: sectionBorderColor }]}>
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
              <View style={[styles.whatsAppProfileChannelBadge, { backgroundColor: appTheme.surface, borderColor: appTheme.darkMode ? 'rgba(148, 163, 184, 0.28)' : '#FFFFFF' }]}>
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

          <View style={[styles.whatsAppSection, styles.whatsAppBusinessAccountSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <View style={styles.whatsAppBusinessAccountRow}>
              <Typography variant="bodySmall" color={appTheme.text} style={styles.whatsAppBusinessAccountText}>
                This is a business account.
              </Typography>
              <Info color={appTheme.muted} size={17} />
            </View>
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
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
                <TouchableOpacity style={[styles.whatsAppMediaEmptyPreview, { borderColor: appTheme.darkMode ? 'rgba(148, 163, 184, 0.26)' : appTheme.border }]} activeOpacity={0.76} onPress={() => onOpenMedia('media')}>
                  <ImageIcon color={appTheme.disabled} size={22} />
                  <Typography variant="caption" color={appTheme.muted}>
                    No media yet
                  </Typography>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <Typography variant="overline" color={appTheme.muted} style={styles.whatsAppSectionTitle}>Contact Info</Typography>
            {conversation.company ? <BusinessProfileLine icon={Building2} title={conversation.company} /> : null}
            {conversation.email ? <BusinessProfileLine icon={Mail} title={conversation.email} /> : null}
            {conversation.phone ? (
              <BusinessProfileLine
                icon={Phone}
                title={formatPhone(conversation.phone)}
                onPress={() => void Linking.openURL(`tel:${conversation.phone?.replace(/[^\d+]/g, '')}`).catch(() => undefined)}
              />
            ) : null}
            <BusinessProfileLine icon={Clock} title={`Conversation started ${startedLabel}`} />
            {metadataRows.length ? (
              <View style={[styles.contactMetadataList, { borderTopColor: sectionBorderColor }]}>
                {metadataRows.map((row) => (
                  <BusinessProfileLine
                    key={`${row.label}-${row.value}`}
                    icon={Info}
                    title={row.label}
                    subtitle={row.value}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <Typography variant="overline" color={appTheme.muted} style={styles.whatsAppSectionTitle}>Business Profile</Typography>
            <BusinessProfileCard profile={businessProfile} loading={businessProfileLoading} />
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <MindBodyPaymentPanel conversation={conversation} onMessageSent={onConversationRefresh} />
            <ContactWorkflowTabs conversation={conversation} onAssignmentChanged={onConversationRefresh} />
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <ContactInfoRow icon={Star} title="Starred messages" onPress={onOpenStarredMessages} />
            <ContactSwitchRow icon={Bell} title="Mute notifications" value={muted} onValueChange={onToggleMute} />
            <ContactInfoRow icon={Clock} title="Disappearing messages" subtitle="Off" onPress={onOpenDisappearingMessages} />
            <ContactInfoRow icon={Shield} title="Advanced chat privacy" subtitle={locked ? 'On' : 'Off'} onPress={onTogglePrivacy} />
            <ContactInfoRow icon={Lock} title="Encryption" subtitle="Messages are end-to-end encrypted. Click to verify." onPress={onVerifyEncryption} />
          </View>

          <View style={[styles.whatsAppSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <ContactInfoRow icon={Heart} title={favourite ? 'Remove from favourites' : 'Add to favourites'} onPress={onToggleFavourite} />
            <ContactInfoRow icon={ListIcon} title={listed ? 'Remove from list' : 'Add to list'} onPress={onToggleList} />
          </View>

          <View style={[styles.whatsAppActionSection, darkSectionStyle, { borderTopColor: sectionBorderColor }]}>
            <ContactDangerRow icon={MinusCircle} title="Clear chat" onPress={onClearChat} />
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
      <View style={[styles.whatsAppContactHeader, { paddingTop: fullPage ? Math.max(insets.top, 14) : 0, borderBottomColor: appTheme.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.darkIconButton} activeOpacity={0.72}>
          <X color={appTheme.text} size={22} />
        </TouchableOpacity>
        <Typography variant="body" color={appTheme.text} style={styles.whatsAppContactHeaderTitle}>
          Contact Details
        </Typography>
        <View style={styles.darkIconButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.contactPanelBody, { paddingBottom: Math.max(insets.bottom, 0) + 108 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.contactHero}>
          <View style={styles.largeAvatar}>
            <Typography variant="h2" color={appTheme.primaryAccent}>
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
          <Typography variant="caption" color={appTheme.muted} style={{ marginTop: 4 }}>
            {messages.length} messages
          </Typography>
        </View>

        <View style={styles.detailSection}>
          {conversation.email ? <DetailLine icon={Mail}>{conversation.email}</DetailLine> : null}
          {conversation.phone ? <DetailLine icon={Phone}>{formatPhone(conversation.phone)}</DetailLine> : null}
          <DetailLine icon={MessageCircle}>Conversation started {startedLabel || 'recently'}</DetailLine>
        </View>

        <View style={[styles.detailCard, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
          <Typography variant="caption" color={appTheme.muted} style={styles.detailSectionTitle}>
            METADATA
          </Typography>
          {metadataRows.map((row) => (
            <View key={`${row.label}-${row.value}`} style={styles.metaRow}>
              <Typography variant="bodySmall" color={appTheme.muted}>{row.label}</Typography>
              <Typography variant="bodySmall" color={appTheme.text} style={styles.metaValue} numberOfLines={3}>{row.value}</Typography>
            </View>
          ))}
        </View>

        <MindBodyPaymentPanel conversation={conversation} onMessageSent={onConversationRefresh} />
        <ContactWorkflowTabs conversation={conversation} onAssignmentChanged={onConversationRefresh} />
      </ScrollView>
    </View>
  );
};


const AnimatedDotsBackground = ({ width, darkMode }: { width: number; darkMode: boolean }) => {
  const dot0 = React.useRef(new Animated.Value(0)).current;
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;
  const dot4 = React.useRef(new Animated.Value(0)).current;
  const dot5 = React.useRef(new Animated.Value(0)).current;
  const dot6 = React.useRef(new Animated.Value(0)).current;
  const dotAnims = [dot0, dot1, dot2, dot3, dot4, dot5, dot6];

  React.useEffect(() => {
    const loops = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -10, duration: 1800 + i * 300, delay: i * 180, useNativeDriver: true, easing: (t) => Math.sin(t * Math.PI) }),
          Animated.timing(anim, { toValue: 0, duration: 1800 + i * 300, useNativeDriver: true, easing: (t) => Math.sin(t * Math.PI) }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  const DOT_POSITIONS = [
    { top: 22, left: 26 }, { top: 18, right: 22 }, { top: 55, left: width * 0.42 },
    { top: 110, left: 14 }, { top: 95, right: 52 }, { top: 150, left: width * 0.30 }, { top: 165, right: 18 },
  ];

  const CIRCLE_POSITIONS = [
    { top: 42, left: 82 }, { top: 78, left: 40 }, { top: 132, right: 88 },
    { top: 50, right: 112 }, { top: 162, left: 142 },
  ];

  return (
    <>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: darkMode ? '#0F172A' : '#E0E7FF' }} />
      <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: darkMode ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.4)'}} />
      <View style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: darkMode ? 'rgba(129, 140, 248, 0.1)' : 'rgba(99, 102, 241, 0.05)'}} />


      {DOT_POSITIONS.map((dot, i) => {
        const sz = i % 3 === 0 ? 14 : 10;
        const clr = darkMode ? 'rgba(100,140,255,0.35)' : 'rgba(60,100,220,0.2)';
        const posStyle: any = { position: 'absolute', top: dot.top };
        if ('left' in dot) posStyle.left = dot.left;
        if ('right' in dot) posStyle.right = dot.right;
        return (
          <Animated.View key={`dot-${i}`} style={[posStyle, { transform: [{ translateY: dotAnims[i] }] }]}>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: sz, height: sz }}>
              <View style={{ position: 'absolute', width: sz, height: 2, borderRadius: 1, backgroundColor: clr }} />
              <View style={{ position: 'absolute', width: 2, height: sz, borderRadius: 1, backgroundColor: clr }} />
            </View>
          </Animated.View>
        );
      })}

      {CIRCLE_POSITIONS.map((dot, i) => {
        const posStyle: any = { position: 'absolute', top: dot.top, width: 6, height: 6, borderRadius: 3, backgroundColor: darkMode ? 'rgba(100,140,255,0.2)' : 'rgba(60,100,220,0.12)' };
        if ('left' in dot) posStyle.left = dot.left;
        if ('right' in dot) posStyle.right = dot.right;
        return <View key={`c-${i}`} style={posStyle} />;
      })}
    </>
  );
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const bottomTabHidden = useBottomTabHidden();

  const currentUser = useAuthStore((state) => state.user);
  const { formatPhone } = usePhoneMasking();
  const fetchMaskPhoneNumbers = usePreferencesStore((state) => state.fetchMaskPhoneNumbers);

  useFocusEffect(
    useCallback(() => {
      void fetchMaskPhoneNumbers();
    }, [fetchMaskPhoneNumbers])
  );

  const [activeFilter, setActiveFilter] = useState<ChannelFilterId>('all');
  const [whatsAppListFilter, setWhatsAppListFilter] = useState<WhatsAppListFilter>('all');
  const [whatsAppHideEmpty, setWhatsAppHideEmpty] = useState(false);
  const [whatsAppStageFilter, setWhatsAppStageFilter] = useState('all');
  const [linkedInStatusFilter, setLinkedInStatusFilter] = useState<LinkedInStatusFilter>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [broadcastGroupsScreenOpen, setBroadcastGroupsScreenOpen] = useState(false);
  // ── Broadcast groups screen state (mirrors lad-frontend-2's ChatGroupManager) ──
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSelectMode, setGroupSelectMode] = useState(false);
  const [selectedBroadcastGroupIds, setSelectedBroadcastGroupIds] = useState<Set<string>>(() => new Set());
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupFormTarget, setGroupFormTarget] = useState<BroadcastGroup | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDesc, setGroupFormDesc] = useState('');
  const [groupFormColor, setGroupFormColor] = useState(GROUP_COLOR_OPTIONS[0]);
  const [groupActionBusy, setGroupActionBusy] = useState(false);
  const [groupNotice, setGroupNotice] = useState<string | null>(null);
  const [groupInfoTarget, setGroupInfoTarget] = useState<BroadcastGroup | null>(null);
  const [groupInfoMembers, setGroupInfoMembers] = useState<BroadcastGroupMember[]>([]);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  // Template broadcast picker — target is either group ids or conversation ids.
  const [broadcastTemplateTarget, setBroadcastTemplateTarget] = useState<{ groupIds?: string[]; conversationIds?: string[] } | null>(null);
  const [broadcastTemplateSending, setBroadcastTemplateSending] = useState(false);
  // New chat overlay group multi-select (mirrors selectedNewChatGroupIds).
  const [newChatGroupIds, setNewChatGroupIds] = useState<Set<string>>(() => new Set());
  // "Select chats" mode on the conversation list (mirrors isSelectMode).
  const [listSelectMode, setListSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(() => new Set());
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  // Starred messages overlay.
  const [starredOpen, setStarredOpen] = useState(false);
  const [starredLoading, setStarredLoading] = useState(false);
  const [starredList, setStarredList] = useState<StarredMessageRecord[]>([]);
  // ── Email client (Gmail/Outlook sidebar + folders — mirrors EmailChannelView) ──
  const [emailSidebarOpen, setEmailSidebarOpen] = useState(false);
  const [emailFolder, setEmailFolder] = useState<string>('inbox');
  const [emailCommsGroups, setEmailCommsGroups] = useState<EmailBroadcastGroup[]>([]);
  const [emailGroupDetail, setEmailGroupDetail] = useState<EmailBroadcastGroupDetail | null>(null);
  const [emailGroupLoading, setEmailGroupLoading] = useState(false);
  const [emailMemberSearch, setEmailMemberSearch] = useState('');
  const [emailSidebarAccountEmail, setEmailSidebarAccountEmail] = useState('');
  const [emailGroupCreateOpen, setEmailGroupCreateOpen] = useState(false);
  const [emailGroupName, setEmailGroupName] = useState('');
  const [emailGroupBusy, setEmailGroupBusy] = useState(false);
  const [emailGroupTemplateOpen, setEmailGroupTemplateOpen] = useState(false);
  const [emailGroupTemplates, setEmailGroupTemplates] = useState<ChatTemplate[]>([]);
  const [emailGroupTemplatesLoading, setEmailGroupTemplatesLoading] = useState(false);
  const [emailGroupTemplateSendingId, setEmailGroupTemplateSendingId] = useState<string | null>(null);
  const [emailGroupTemplateError, setEmailGroupTemplateError] = useState<string | null>(null);
  const [sentRuns, setSentRuns] = useState<EmailBroadcastRun[]>([]);
  const [sentRunsLoading, setSentRunsLoading] = useState(false);
  const [sentRunOpen, setSentRunOpen] = useState<EmailBroadcastRun | null>(null);
  const [sentRunDetail, setSentRunDetail] = useState<EmailBroadcastRunDetail | null>(null);
  const [sentRunDetailLoading, setSentRunDetailLoading] = useState(false);
  const [sentBroadcastOpen, setSentBroadcastOpen] = useState(false);
  const [sentBroadcastAccounts, setSentBroadcastAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [sentBroadcastGroups, setSentBroadcastGroups] = useState<EmailBroadcastGroup[]>([]);
  const [sentBroadcastAccountId, setSentBroadcastAccountId] = useState('');
  const [sentBroadcastMode, setSentBroadcastMode] = useState<'group' | 'manual'>('group');
  const [sentBroadcastGroupId, setSentBroadcastGroupId] = useState('');
  const [sentBroadcastRecipients, setSentBroadcastRecipients] = useState('');
  const [sentBroadcastTemplates, setSentBroadcastTemplates] = useState<ChatTemplate[]>([]);
  const [sentBroadcastTemplateId, setSentBroadcastTemplateId] = useState('');
  const [sentBroadcastTemplateDropdownOpen, setSentBroadcastTemplateDropdownOpen] = useState(false);
  const [sentBroadcastTemplatesLoading, setSentBroadcastTemplatesLoading] = useState(false);
  const [sentBroadcastTemplatesError, setSentBroadcastTemplatesError] = useState<string | null>(null);
  const [sentBroadcastSubject, setSentBroadcastSubject] = useState('');
  const [sentBroadcastBody, setSentBroadcastBody] = useState('');
  const [sentBroadcastLoading, setSentBroadcastLoading] = useState(false);
  const [sentBroadcastSending, setSentBroadcastSending] = useState(false);
  const [sentBroadcastError, setSentBroadcastError] = useState<string | null>(null);
  // Compose-to-group (email-comms /broadcast/send with group_id).
  const [emailComposeGroup, setEmailComposeGroup] = useState<EmailBroadcastGroup | null>(null);
  const [emailComposeFromEmail, setEmailComposeFromEmail] = useState('');
  const [emailComposeTemplateId, setEmailComposeTemplateId] = useState<string | null>(null);
  // Compose extras (mirrors frontend-2's ComposeWindow: Cc/Bcc, minimize/
  // maximize, formatting toolbar, templates, attachments, emoji).
  const [emailComposeCc, setEmailComposeCc] = useState('');
  const [emailComposeBcc, setEmailComposeBcc] = useState('');
  const [emailComposeShowCc, setEmailComposeShowCc] = useState(false);
  const [emailComposeShowBcc, setEmailComposeShowBcc] = useState(false);
  const [emailComposeMinimized, setEmailComposeMinimized] = useState(false);
  const [emailComposeMaximized, setEmailComposeMaximized] = useState(false);
  const [emailComposeAttachments, setEmailComposeAttachments] = useState<{ name: string }[]>([]);
  const [emailComposeEmojiOpen, setEmailComposeEmojiOpen] = useState(false);
  const [emailComposeTemplatesOpen, setEmailComposeTemplatesOpen] = useState(false);
  const emailComposeHistoryRef = useRef<string[]>([]);
  const emailComposeRedoRef = useRef<string[]>([]);
  const emailComposeSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  // Email compose sheet (Reply / Forward — mirrors EmailComposePanel).
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailComposeMode, setEmailComposeMode] = useState<'reply' | 'forward' | 'new'>('reply');
  const [emailComposeTo, setEmailComposeTo] = useState('');
  const [emailComposeSubject, setEmailComposeSubject] = useState('');
  const [emailComposeBody, setEmailComposeBody] = useState('');
  const [emailComposeSending, setEmailComposeSending] = useState(false);
  const [emailComposeError, setEmailComposeError] = useState<string | null>(null);
  // ComposeWindow parity extras — contact suggestions, sent flash, agent
  // toggle, categorized emoji picker, confidential mode, more-options menu.
  const [emailComposeSent, setEmailComposeSent] = useState(false);
  const [emailComposeShowSuggestions, setEmailComposeShowSuggestions] = useState(false);
  const [emailComposeAgent, setEmailComposeAgent] = useState<'ai' | 'human'>('ai');
  const [emailComposeAgentMenuOpen, setEmailComposeAgentMenuOpen] = useState(false);
  const [emailComposeEmojiCategory, setEmailComposeEmojiCategory] = useState('smileys');
  const [emailComposeEmojiSearch, setEmailComposeEmojiSearch] = useState('');
  const [emailComposeConfidential, setEmailComposeConfidential] = useState(false);
  const [emailComposeMoreOpen, setEmailComposeMoreOpen] = useState(false);
  const [emailComposeTemplateSearch, setEmailComposeTemplateSearch] = useState('');
  const emailComposeSuggestionBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Message settings (AI inbound debounce — mirrors MessageSettings.tsx).
  const [messageSettingsOpen, setMessageSettingsOpen] = useState(false);
  const [inboundDebounce, setInboundDebounce] = useState<number | null>(null);
  const [inboundDebounceSaving, setInboundDebounceSaving] = useState(false);
  const [inboundDebounceError, setInboundDebounceError] = useState<string | null>(null);
  const filterDropdownAnimation = useRef(new Animated.Value(0)).current;
  const [createChatMenuOpen, setCreateChatMenuOpen] = useState(false);
  const [createChatNotice, setCreateChatNotice] = useState<string | null>(null);
  const [createChatMode, setCreateChatMode] = useState<ChatCreateActionId | null>(null);
  const [createChatSearch, setCreateChatSearch] = useState('');
  const [createChatSelectedIds, setCreateChatSelectedIds] = useState<Set<string>>(() => new Set());
  // "Create Group" step of the New Chat flow — mirrors frontend-2's CreateBroadcastGroupModal
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupColor, setCreateGroupColor] = useState('#10B981');
  const [createGroupExistingIds, setCreateGroupExistingIds] = useState<Set<string>>(() => new Set());
  const [createGroupSaving, setCreateGroupSaving] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
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
  const [templateSending, setTemplateSending] = useState(false);
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
  // react-native-keyboard-controller's state is driven by the real native
  // WindowInsetsAnimation/keyboard-frame callbacks (not the JS-side
  // keyboardDidShow/Hide heuristic), so it stays in sync with the
  // KeyboardAvoidingView below for both button-dismiss and drag-down
  // dismiss, and settles back to false the instant the keyboard is gone
  // instead of lagging behind it.
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

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
    sendLocationMessage,
    sendContactMessage,
    sendAttachment,
    emitTypingState,
    clearConversationMessages,
    clearActiveConversation,
    disposeRealtime,
    connectedIntegrations,
    fetchConnectedIntegrations,
    isLoadingIntegrations,
    broadcastGroups,
    fetchBroadcastGroups,
    isLoadingGroups,
    markConversationRead,
  } = useChatStore();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draft = activeConversationId ? (drafts[activeConversationId] || '') : '';
  // Keep the active id in a ref so `setDraft` can stay referentially stable.
  // Otherwise handlers that capture `setDraft` with stale deps (e.g. the
  // composer's onChangeText and applyTemplate) would hold the first-render
  // version — created when no conversation was open — whose body is a no-op,
  // silently dropping typed text and template inserts.
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  const setDraft = useCallback((value: string | ((prev: string) => string)) => {
    const id = activeConversationIdRef.current;
    if (!id) return;
    setDrafts((prev) => {
      const next = typeof value === 'function' ? value(prev[id] || '') : value;
      return { ...prev, [id]: next };
    });
  }, []);

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
    void fetchBroadcastGroups();
  }, [fetchBroadcastGroups]);

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
        // As requested, always hide email conversations from the "all" view so they only show in email tabs.
        if (activeFilter === 'all') {
          if (linkedInOff && conversation.channel === 'linkedin') return false;
          if (instagramOff && conversation.channel === 'instagram') return false;
          if (conversation.channel === 'email' || conversation.channel === 'gmail') return false;
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
        const emailProviderId =
          conversation.channel === 'email' || conversation.channel === 'gmail'
            ? getEmailProviderId(conversation)
            : null;
        const matchesFilter =
          activeFilter === 'all' ||
          (activeFilter === 'unread' && conversation.unreadCount > 0) ||
          (activeFilter === 'personal' && conversation.channel === 'whatsapp' && conversation.waBackendChannel === 'personal') ||
          (activeFilter === 'waba' && conversation.channel === 'whatsapp' && conversation.waBackendChannel === 'waba') ||
          (activeFilter === 'gmail' && emailProviderId === 'gmail') ||
          (activeFilter === 'outlook' && emailProviderId === 'outlook') ||
          (activeFilter === 'email' && emailProviderId === 'custom') ||
          (activeFilter !== 'gmail' && activeFilter !== 'email' && conversation.channel === activeFilter);

        if (isWhatsAppFilterTab(activeFilter) && conversationMatchesWhatsAppTab(conversation, activeFilter)) {
          if (whatsAppListFilter === 'unread' && conversation.unreadCount <= 0) {
            return false;
          }
          if (whatsAppHideEmpty && !conversation.lastMessage && !conversation.messageCount) {
            return false;
          }
          if (whatsAppStageFilter !== 'all') {
            const stage = (conversation.conversationState || '').toLowerCase();
            if (stage !== whatsAppStageFilter.toLowerCase()) {
              return false;
            }
          }
        }

        if (activeFilter === 'linkedin' && conversation.channel === 'linkedin' && linkedInStatusFilter !== 'all') {
          if (getLinkedInConversationStatus(conversation) !== linkedInStatusFilter) {
            return false;
          }
        }

        // Email folders: "Starred" narrows the inbox to favourited conversations.
        const isGroupFolder = emailFolder.startsWith('group:');
        const activeGroupId = isGroupFolder ? emailFolder.replace('group:', '') : null;

        const matchesEmailFolder =
          !(activeFilter === 'gmail' || activeFilter === 'outlook' || activeFilter === 'email') ||
          (emailFolder === 'starred' ? starredIds.has(conversation.id) :
           isGroupFolder ? (emailGroupDetail?.id === activeGroupId && emailGroupDetail.members.some((m: any) => m.id === conversation.leadId)) : true);

        // Web parity: the Gmail/Outlook inbox lists real mail threads only. The
        // entries pulled from LAD-Email-Comms /contacts are broadcast-list members,
        // not inbox conversations — the web client never shows them under a hosted
        // provider (it leaves the inbox empty and manages them via broadcast groups).
        // Surfacing them here made contacts appear under Outlook that aren't visible
        // on web, so we hide broadcast contacts from the hosted-provider inbox.
        const isBroadcastContact = conversation.id.startsWith('email:');
        if ((activeFilter === 'gmail' || activeFilter === 'outlook') && isBroadcastContact) {
          return false;
        }

        return matchesSearch && matchesFilter && matchesEmailFolder;
      })
      .sort((a, b) => {
        const pinDelta = Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id));
        if (pinDelta) {
          return pinDelta;
        }

        return Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? '');
      });
  }, [activeFilter, blockedIds, connectedIntegrations, conversations, deletedIds, emailFolder, emailGroupDetail, isLoadingIntegrations, linkedInStatusFilter, pinnedIds, search, starredIds, whatsAppHideEmpty, whatsAppListFilter, whatsAppStageFilter]);
  const liveConversationCount = useMemo(
    () => conversations.filter((conversation) => !isBroadcastEmailContact(conversation)).length,
    [conversations],
  );
  const focusedConversationCount = useMemo(
    () => filteredConversations.filter((conversation) => !isBroadcastEmailContact(conversation)).length,
    [filteredConversations],
  );
  const whatsAppBaseConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatchesWhatsAppTab(conversation, activeFilter)),
    [activeFilter, conversations],
  );
  const whatsAppUnreadCount = useMemo(
    () => whatsAppBaseConversations.filter((conversation) => conversation.unreadCount > 0).length,
    [whatsAppBaseConversations],
  );
  const whatsAppStageOptions = useMemo(() => {
    const counts = new Map<string, number>();
    whatsAppBaseConversations.forEach((conversation) => {
      const stage = conversation.conversationState?.trim();
      if (!stage) {
        return;
      }
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => formatContextStatus(a).localeCompare(formatContextStatus(b)))
      .map(([value, count]) => ({ value, label: formatContextStatus(value), count }));
  }, [whatsAppBaseConversations]);
  const linkedInStatusCounts = useMemo(() => {
    const counts: Record<LinkedInStatusFilter, number> = { all: 0, pending: 0, accepted: 0, active: 0 };
    conversations.forEach((conversation) => {
      if (conversation.channel !== 'linkedin') {
        return;
      }
      const status = getLinkedInConversationStatus(conversation);
      counts.all += 1;
      counts[status] += 1;
    });
    return counts;
  }, [conversations]);
  const showWhatsAppChannelFilters = isWhatsAppFilterTab(activeFilter);
  const showLinkedInChannelFilters = activeFilter === 'linkedin';
  const connectedWhatsAppSources = useMemo(
    () => getConnectedWhatsAppSources(connectedIntegrations),
    [connectedIntegrations],
  );

  const createChatContacts = useMemo(() => {
    const query = createChatSearch.trim().toLowerCase();
    const visibleContacts = sortNewestConversations(
      conversations.filter((conversation) => (
        !deletedIds.has(conversation.id) &&
        !blockedIds.has(conversation.id) &&
        matchesConnectedWhatsAppSource(conversation, connectedWhatsAppSources)
      )),
    );

    if (!query) {
      return visibleContacts;
    }

    return visibleContacts.filter((conversation) => getConversationSearchLabel(conversation).includes(query));
  }, [blockedIds, connectedWhatsAppSources, conversations, createChatSearch, deletedIds]);

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
  
  const isDisconnected = useMemo(() => {
    if (!activeConversation || isLoadingIntegrations) return false;
    const channel = activeConversation.channel;
    if (channel === 'whatsapp' && activeConversation.waBackendChannel === 'personal') {
      return !connectedIntegrations.some((i) => i.label === 'WhatsApp Personal' && i.connected);
    }
    if (channel === 'whatsapp' && activeConversation.waBackendChannel === 'waba') {
      return !connectedIntegrations.some((i) => i.label === 'WhatsApp API Agent' && i.connected);
    }
    return !connectedIntegrations.some((i) => i.channel === channel && i.connected);
  }, [activeConversation, connectedIntegrations, isLoadingIntegrations]);

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
      composer: 'transparent',
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
    const isEmailConversation = (c: Conversation) => c.channel === 'email' || c.channel === 'gmail';
    const hasGmailConversation = conversations.some((c) => isEmailConversation(c) && getEmailProviderId(c) === 'gmail');
    const hasOutlookConversation = conversations.some((c) => isEmailConversation(c) && getEmailProviderId(c) === 'outlook');
    const hasCustomEmailConversation = conversations.some((c) => isEmailConversation(c) && getEmailProviderId(c) === 'custom');

    // While integrations are still loading (or haven't been fetched yet), fall back to showing
    // tabs for channels that already have conversations so the list isn't suddenly empty.
    if (isLoadingIntegrations || !connectedIntegrations.length) {
      return CHANNELS.filter((ch) => {
        if (ch.id === 'all' || ch.id === 'unread') return true;
        if (ch.id === 'personal') return hasPersonalConversation;
        if (ch.id === 'waba') return hasWabaConversation;
        if (ch.id === 'linkedin') return hasLinkedInConversation;
        if (ch.id === 'instagram') return hasInstagramConversation;
        if (ch.id === 'gmail') return hasGmailConversation;
        if (ch.id === 'outlook') return hasOutlookConversation;
        if (ch.id === 'email') return hasCustomEmailConversation;
        return true;
      });
    }
    // Integrations loaded — for WhatsApp (personal + WABA), keep the conversation-based fallback
    // because the WAPA service can be temporarily unreachable or return a non-matching status even
    // when the session is actually live. For third-party channels (LinkedIn, Instagram, Email) we
    // trust the API status directly: those are clean OAuth connections with no ambiguity.
    const personalConnected =
      connectedIntegrations.some((i) => i.label === 'WhatsApp Personal' && i.connected);
    const wabaConnected =
      connectedIntegrations.some((i) => i.label === 'WhatsApp API Agent' && i.connected);
    const linkedInConnected = connectedIntegrations.some((i) => i.channel === 'linkedin' && i.connected);
    const instagramConnected = connectedIntegrations.some((i) => i.channel === 'instagram' && i.connected);
    // Gmail and Outlook are separate tabs like lad-frontend-2's ConversationsPage.
    const gmailConnected = connectedIntegrations.some((i) => i.label === 'Google/Gmail' && i.connected);
    const outlookConnected = connectedIntegrations.some((i) => i.label === 'Microsoft/Outlook' && i.connected);
    const customEmailConnected = connectedIntegrations.some((i) => i.channel === 'custom-email' && i.connected);
    return CHANNELS.filter((ch) => {
      if (ch.id === 'all' || ch.id === 'unread') return true;
      if (ch.id === 'personal') return personalConnected;
      if (ch.id === 'waba') return wabaConnected;
      if (ch.id === 'linkedin') return linkedInConnected;
      if (ch.id === 'instagram') return instagramConnected;
      if (ch.id === 'gmail') return gmailConnected || hasGmailConversation;
      if (ch.id === 'outlook') return outlookConnected || hasOutlookConversation;
      if (ch.id === 'email') return customEmailConnected || hasCustomEmailConversation;
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
  const emptyConversationMessage = liveConversationCount
    ? `No matches in ${activeFilterLabel}. ${liveConversationCount} total conversations loaded.`
    : syncError || 'No backend conversations found';
  // A partial 5xx/socket failure must not replace chats returned by healthy
  // sources. Only show the blocking retry state when no usable conversations
  // have been loaded at all.
  const visibleListError = liveConversationCount > 0 ? null : error || syncError;
  const showNoConnectionListError = isConnectionUnavailableError(visibleListError);
  const displayedConversations = filteredConversations;
  const noConnectionListMinHeight = Math.max(360, height - insets.top - insets.bottom - 320);

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
    const fallback = getFallbackTemplates(channel);

    // WhatsApp templates are stored per connected account on the channel-specific
    // microservice (waba → BNI, personal → WAPA). Route through the service using
    // the active conversation's backend channel so we display exactly the templates
    // that belong to the currently connected account (e.g. Frontdesk), not the
    // main backend (which 404s these and left the list empty).
    if (channel === 'whatsapp') {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const raw = await getWhatsAppTemplates(
          activeConversation?.waBackendChannel,
          activeConversation?.accountId,
        );
        const normalized = raw
          .map((item, index) => normalizeTemplate(item as Record<string, any>, 'whatsapp', index))
          .filter((item): item is ChatTemplate => Boolean(item));

        if (normalized.length) {
          setChatTemplates(normalized);
        } else {
          setChatTemplates(fallback);
          setTemplatesError('No saved templates found for this account. Showing quick-start templates.');
        }
      } catch {
        setChatTemplates(fallback);
        setTemplatesError('Could not load saved templates. Showing quick-start templates.');
      } finally {
        setTemplatesLoading(false);
      }
      return;
    }

    const endpoint = getTemplateEndpoint(channel);

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
  }, [activeConversation?.waBackendChannel, activeConversation?.accountId]);

  const openTemplateMenu = useCallback(() => {
    const channel = activeConversation?.channel ?? 'whatsapp';
    setQuickActionsOpen(false);
    setTemplateMenuOpen(true);
    setTemplateSearch('');
    void loadTemplates(channel);
  }, [activeConversation?.channel, loadTemplates]);

  const insertTemplateIntoDraft = useCallback((template: ChatTemplate) => {
    const body = substituteConversationVariables(template.body, activeConversation);
    setDraft((value) => (value.trim() ? `${value.trim()}\n${body}` : body));
    setTemplateMenuOpen(false);
  }, [activeConversation, setDraft]);

  const handleTemplateSelect = useCallback(async (template: ChatTemplate) => {
    if (!activeConversation) {
      insertTemplateIntoDraft(template);
      return;
    }

    const channel = activeConversation.channel;
    const body = substituteConversationVariables(template.body, activeConversation);
    const templateName = template.templateName || template.name;

    if (channel !== 'whatsapp' && channel !== 'linkedin') {
      insertTemplateIntoDraft(template);
      return;
    }

    if (templateSending) {
      return;
    }

    if (channel === 'linkedin' && !body.trim() && !template.mediaUrl) {
      Alert.alert('Template is empty', 'This LinkedIn template has no message or attachment to send.');
      return;
    }

    setTemplateSending(true);
    setTemplatesError(null);
    try {
      await sendTemplateToConversation(
        {
          id: activeConversation.id,
          channel,
          waBackendChannel: activeConversation.waBackendChannel,
        },
        {
          templateId: template.id,
          templateName,
          languageCode: template.language || 'en',
          parameters: buildTemplateParameters(template, activeConversation),
          headerParamCount: template.headerParamCount ?? 0,
          headerType: template.headerType || '',
          headerUrl: template.headerUrl || '',
          body,
          mediaUrl: template.mediaUrl,
          mediaType: template.mediaType,
          mediaFilename: template.mediaFilename,
        },
      );

      setDraft('');
      setTemplateMenuOpen(false);
      await setActiveConversation(activeConversation.id, { force: true, silent: true });
      void syncConversations({ silent: true, force: true });
    } catch (error) {
      Alert.alert('Template failed', getActionErrorMessage(error, 'Unable to send the selected template.'));
    } finally {
      setTemplateSending(false);
    }
  }, [activeConversation, insertTemplateIntoDraft, setActiveConversation, setDraft, syncConversations, templateSending]);

  const openQuickComposer = useCallback((action: QuickComposerAction) => {
    setTemplateMenuOpen(false);
    setEmojiPickerOpen(false);
    setQuickActionsOpen(false);
    setQuickComposer(action);
    setQuickDraft((current) => action === 'poll'
      ? { ...EMPTY_QUICK_DRAFT, pollOptions: current.pollOptions || EMPTY_QUICK_DRAFT.pollOptions }
      : { ...EMPTY_QUICK_DRAFT });
  }, []);

  const fillCurrentLocation = useCallback(async () => {
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
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Location access is needed to share your current location.');
          onError();
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        onSuccess(location.coords.latitude, location.coords.longitude);
      } catch (error) {
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
      const address = quickDraft.locationAddress?.trim();
      const lat = quickDraft.latitude;
      const lon = quickDraft.longitude;
      if (lat != null && lon != null) {
        await sendLocationMessage(lat, lon, label, address);
        setQuickComposer(null);
        setQuickDraft(EMPTY_QUICK_DRAFT);
        return;
      }

      const link = quickDraft.locationLink.trim();
      message = ['Location shared', label, link].filter(Boolean).join('\n');
    }

    if (quickComposer === 'contact') {
      const contactName = quickDraft.contactName.trim();
      const contactPhone = quickDraft.contactPhone.trim();
      const contactEmail = quickDraft.contactEmail.trim();
      if (!contactName || !contactPhone || !contactEmail) return;
      await sendContactMessage(contactName, contactPhone, contactEmail);
      setQuickComposer(null);
      setQuickDraft(EMPTY_QUICK_DRAFT);
      return;
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
  }, [activeConversation, isSending, lockedIds, quickComposer, quickDraft, sendContactMessage, sendMessage, sendLocationMessage]);

  const handleAttachmentAction = useCallback(async (action: AttachmentAction) => {
    setQuickActionsOpen(false);

    switch (action) {
      case 'photos':
        await handlePickAttachment(['image/*', 'video/*']);
        break;
      case 'camera':
        await handlePickAttachment(['image/*']);
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
      case 'sticker':
        setEmojiSearch('');
        setEmojiPickerOpen(true);
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

  // Opens the Import Leads dialog (Add Leads / Excel Upload / Scrape from URL),
  // mirroring frontend-2's ImportLeadsDialog workflow.
  const handleImportLeadsAction = useCallback(async () => {
    setCreateChatNotice(null);
    setImportLeadsOpen(true);
  }, []);

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

  const openCreateGroupModal = useCallback(() => {
    setCreateGroupName('');
    setCreateGroupColor('#10B981');
    setCreateGroupExistingIds(new Set());
    setCreateGroupError(null);
    setCreateGroupModalOpen(true);
  }, []);

  // Mirrors frontend-2's CreateBroadcastGroupModal: create a new group (and/or pick
  // existing ones), then add every selected conversation to each target group.
  const handleCreateGroupFromSelection = useCallback(async () => {
    const selectedIds = Array.from(createChatSelectedIds);
    const name = createGroupName.trim();

    if (!name && createGroupExistingIds.size === 0) {
      setCreateGroupError('Enter a group name or select existing groups.');
      return;
    }
    if (!selectedIds.length) {
      setCreateGroupError('No contacts selected.');
      return;
    }

    setCreateGroupSaving(true);
    setCreateGroupError(null);
    try {
      const targetGroupIds: string[] = [];
      if (name) {
        const created = await createBroadcastGroup(name, createGroupColor);
        if (!created?.id) {
          throw new Error('Group could not be created. Please try again.');
        }
        targetGroupIds.push(created.id);
      }
      targetGroupIds.push(...Array.from(createGroupExistingIds));

      for (const groupId of targetGroupIds) {
        await addConversationsToBroadcastGroup(groupId, selectedIds);
      }

      setCreateGroupModalOpen(false);
      setCreateChatSelectedIds(new Set());
      setCreateChatNotice(
        name
          ? `"${name}" created with ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}.`
          : `Added ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'} to ${createGroupExistingIds.size} group${createGroupExistingIds.size === 1 ? '' : 's'}.`,
      );
      await fetchBroadcastGroups();
    } catch (err) {
      setCreateGroupError(getActionErrorMessage(err, 'Unable to create the group.'));
    } finally {
      setCreateGroupSaving(false);
    }
  }, [createChatSelectedIds, createGroupColor, createGroupExistingIds, createGroupName, fetchBroadcastGroups]);

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

    await Share.share({ message: transcript || 'No messages yet', title: fileName });
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
      `${activeConversation.name} messages are protected by the WhatsApp transport. Verification details are managed by the contact profile.`,
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
    setNewChatGroupIds(new Set());
  }, []);

  const closeConversationListPopups = useCallback(() => {
    setFilterDropdownOpen(false);
    setFilterSidebarOpen(false);
    closeCreateChatMenu();
  }, [closeCreateChatMenu]);

  // ── Broadcast group workflows (mirror lad-frontend-2's ChatGroupManager) ──

  const filteredBroadcastGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return query
      ? broadcastGroups.filter((group) => group.name.toLowerCase().includes(query))
      : broadcastGroups;
  }, [broadcastGroups, groupSearch]);

  const openGroupForm = useCallback((group?: BroadcastGroup) => {
    setGroupFormTarget(group ?? null);
    setGroupFormName(group?.name ?? '');
    setGroupFormDesc(group?.description ?? '');
    setGroupFormColor(group?.color ?? GROUP_COLOR_OPTIONS[0]);
    setGroupFormOpen(true);
  }, []);

  const closeGroupForm = useCallback(() => {
    setGroupFormOpen(false);
    setGroupFormTarget(null);
    setGroupFormName('');
    setGroupFormDesc('');
    setGroupFormColor(GROUP_COLOR_OPTIONS[0]);
  }, []);

  const submitGroupForm = useCallback(async () => {
    const name = groupFormName.trim();
    if (!name || groupActionBusy) {
      return;
    }

    setGroupActionBusy(true);
    setGroupNotice(null);
    try {
      if (groupFormTarget) {
        await updateBroadcastGroup(groupFormTarget.id, {
          name,
          color: groupFormColor,
          description: groupFormDesc.trim() || null,
        });
        setGroupNotice(`"${name}" updated.`);
      } else {
        const created = await createBroadcastGroup(name, groupFormColor, groupFormDesc.trim() || undefined);
        setGroupNotice(created ? `"${name}" created.` : 'The group could not be created.');
      }

      closeGroupForm();
      await fetchBroadcastGroups();
    } catch (error) {
      setGroupNotice(getActionErrorMessage(error, 'Unable to save the group.'));
    } finally {
      setGroupActionBusy(false);
    }
  }, [closeGroupForm, fetchBroadcastGroups, groupActionBusy, groupFormColor, groupFormDesc, groupFormName, groupFormTarget]);

  const handleDeleteGroup = useCallback(async (group: BroadcastGroup) => {
    const confirmed = await confirmAction('Delete group', `Delete "${group.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setGroupActionBusy(true);
    setGroupNotice(null);
    try {
      await deleteBroadcastGroup(group.id);
      setGroupNotice(`"${group.name}" deleted.`);
      setSelectedBroadcastGroupIds((current) => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
      setNewChatGroupIds((current) => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
      await fetchBroadcastGroups();
    } catch (error) {
      setGroupNotice(getActionErrorMessage(error, 'Unable to delete the group.'));
    } finally {
      setGroupActionBusy(false);
    }
  }, [fetchBroadcastGroups]);

  const openGroupInfo = useCallback((group: BroadcastGroup) => {
    setGroupInfoTarget(group);
    setGroupInfoMembers([]);
    setGroupInfoLoading(true);
    getBroadcastGroupMembers(group.id)
      .then(setGroupInfoMembers)
      .catch(() => setGroupInfoMembers([]))
      .finally(() => setGroupInfoLoading(false));
  }, []);

  const handleRemoveGroupMember = useCallback(async (memberId: string) => {
    if (!groupInfoTarget) {
      return;
    }

    try {
      await removeBroadcastGroupMember(groupInfoTarget.id, memberId);
      setGroupInfoMembers((current) => current.filter((member) => member.id !== memberId));
      void fetchBroadcastGroups();
    } catch (error) {
      Alert.alert('Remove failed', getActionErrorMessage(error, 'Unable to remove the member.'));
    }
  }, [fetchBroadcastGroups, groupInfoTarget]);

  // ── Template broadcast (mirrors TemplatePicker → send-template flows) ──

  const openBroadcastTemplatePicker = useCallback((target: { groupIds?: string[]; conversationIds?: string[] }) => {
    setBroadcastTemplateTarget(target);
    setTemplateSearch('');
    void loadTemplates('whatsapp');
  }, [loadTemplates]);

  const handleSendBroadcastTemplate = useCallback(async (template: ChatTemplate) => {
    if (!broadcastTemplateTarget || broadcastTemplateSending) {
      return;
    }

    const payload: BroadcastTemplateSendPayload = {
      templateName: template.name,
      languageCode: template.language || 'en',
    };

    setBroadcastTemplateSending(true);
    try {
      let summary = '';
      if (broadcastTemplateTarget.groupIds?.length) {
        const result = await sendTemplateToBroadcastGroups(broadcastTemplateTarget.groupIds, payload);
        if (result.errors.length) {
          throw new Error(result.errors[0]);
        }
        summary = `Template "${template.name}" queued for ${broadcastTemplateTarget.groupIds.length} group${broadcastTemplateTarget.groupIds.length === 1 ? '' : 's'}.`;
      } else if (broadcastTemplateTarget.conversationIds?.length) {
        await sendTemplateToConversations(broadcastTemplateTarget.conversationIds, payload);
        summary = `Template "${template.name}" queued for ${broadcastTemplateTarget.conversationIds.length} chat${broadcastTemplateTarget.conversationIds.length === 1 ? '' : 's'}.`;
      }

      setBroadcastTemplateTarget(null);
      setGroupSelectMode(false);
      setSelectedBroadcastGroupIds(new Set());
      setNewChatGroupIds(new Set());
      setListSelectMode(false);
      setSelectedChatIds(new Set());
      setGroupNotice(summary);
      Alert.alert('Broadcast queued', summary);
    } catch (error) {
      Alert.alert('Broadcast failed', getActionErrorMessage(error, 'Unable to send the template.'));
    } finally {
      setBroadcastTemplateSending(false);
    }
  }, [broadcastTemplateSending, broadcastTemplateTarget]);

  // ── "Select chats" mode (mirrors lad-frontend-2's bulk action bar) ──

  const exitListSelectMode = useCallback(() => {
    setListSelectMode(false);
    setSelectedChatIds(new Set());
    setAddToGroupOpen(false);
  }, []);

  const toggleChatSelection = useCallback((conversationId: string) => {
    setSelectedChatIds((current) => {
      const next = new Set(current);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }, []);

  const handleAddSelectedToGroup = useCallback(async (group: BroadcastGroup) => {
    const ids = Array.from(selectedChatIds);
    if (!ids.length) {
      return;
    }

    try {
      await addConversationsToBroadcastGroup(group.id, ids);
      Alert.alert('Added to group', `${ids.length} chat${ids.length === 1 ? '' : 's'} added to "${group.name}".`);
      exitListSelectMode();
      void fetchBroadcastGroups();
    } catch (error) {
      Alert.alert('Add failed', getActionErrorMessage(error, 'Unable to add chats to the group.'));
    }
  }, [exitListSelectMode, fetchBroadcastGroups, selectedChatIds]);

  const handleBulkResolve = useCallback(async () => {
    const ids = Array.from(selectedChatIds);
    if (!ids.length) {
      return;
    }

    try {
      await bulkConversationsAction('status', { conversation_ids: ids, status: 'resolved' });
      exitListSelectMode();
      void syncConversations({ silent: true, force: true });
    } catch (error) {
      Alert.alert('Resolve failed', getActionErrorMessage(error, 'Unable to resolve the selected chats.'));
    }
  }, [exitListSelectMode, selectedChatIds, syncConversations]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedChatIds);
    if (!ids.length) {
      return;
    }

    const confirmed = await confirmAction('Delete chats', `Delete ${ids.length} selected chat${ids.length === 1 ? '' : 's'}?`);
    if (!confirmed) {
      return;
    }

    try {
      await bulkConversationsAction('delete', { conversation_ids: ids });
      exitListSelectMode();
      void syncConversations({ silent: true, force: true });
    } catch (error) {
      Alert.alert('Delete failed', getActionErrorMessage(error, 'Unable to delete the selected chats.'));
    }
  }, [exitListSelectMode, selectedChatIds, syncConversations]);

  const handleMarkAllRead = useCallback(() => {
    conversations
      .filter((conversation) => conversation.unreadCount > 0)
      .forEach((conversation) => void markConversationRead(conversation.id).catch(() => undefined));
  }, [conversations, markConversationRead]);

  // ── Starred messages overlay (mirrors StarredMessagesDialog) ──

  const openStarredOverlay = useCallback(() => {
    setStarredOpen(true);
    setStarredLoading(true);
    getStarredMessages()
      .then(setStarredList)
      .catch(() => setStarredList([]))
      .finally(() => setStarredLoading(false));
  }, []);

  const openStarredConversation = useCallback((row: StarredMessageRecord) => {
    setStarredOpen(false);
    if (row.conversationId) {
      void setActiveConversation(row.conversationId);
    }
  }, [setActiveConversation]);

  // ── Message settings (mirrors MessageSettings' inbound debounce) ──

  const openMessageSettings = useCallback(() => {
    setMessageSettingsOpen(true);
    setInboundDebounceError(null);
    getWabaChatSettings()
      .then((settings) => {
        const value = Number(settings.inbound_debounce_seconds);
        setInboundDebounce(Number.isFinite(value) ? Math.min(300, Math.max(0, Math.round(value))) : 30);
      })
      .catch(() => {
        setInboundDebounce(30);
        setInboundDebounceError('Could not load the saved value.');
      });
  }, []);

  const saveInboundDebounce = useCallback(async (value: number) => {
    setInboundDebounce(value);
    setInboundDebounceSaving(true);
    setInboundDebounceError(null);
    try {
      await updateWabaChatSettings({ inbound_debounce_seconds: value });
    } catch (error) {
      setInboundDebounceError(getActionErrorMessage(error, 'Save failed.'));
    } finally {
      setInboundDebounceSaving(false);
    }
  }, []);

  // "New Broadcast" quick action — same as frontend-2's New Chat overlay button
  // that closes the overlay and opens the group manager with the create form.
  const openNewBroadcastFlow = useCallback(() => {
    closeCreateChatMenu();
    setBroadcastGroupsScreenOpen(true);
    openGroupForm();
  }, [closeCreateChatMenu, openGroupForm]);

  const emailTabProvider: 'gmail' | 'outlook' | null =
    activeFilter === 'gmail' ? 'gmail' : activeFilter === 'outlook' ? 'outlook' : null;
  const isEmailTabActive = activeFilter === 'gmail' || activeFilter === 'outlook' || activeFilter === 'email';
  const isEmailGroupFolder = isEmailTabActive && emailFolder.startsWith('group:');
  const emailTabProviderId: EmailProviderId = activeFilter === 'outlook' ? 'outlook' : activeFilter === 'email' ? 'custom' : 'gmail';
  const emailTabMeta = EMAIL_PROVIDER_META[emailTabProviderId];
  const emailComposeGroupAccountRef = useRef<string | null>(null);

  const resolveConnectedEmailAccount = useCallback(async (providerId: EmailProviderId) => {
    const accounts = await getConnectedEmailAccounts();
    const wanted = getAccountProviderForEmailTab(providerId);
    return (
      accounts.find((item) => item.provider === wanted && item.status === 'active') ??
      accounts.find((item) => item.provider === wanted) ??
      null
    );
  }, []);

  // ── Email reply / forward (mirrors EmailComposePanel's send-bulk flow) ──

  const openEmailCompose = useCallback(async (mode: 'reply' | 'forward', prefillBody?: string) => {
    if (!activeConversation) {
      return;
    }

    const latest = [...activeMessages].reverse().find((message) => message.subject || message.content);
    const baseSubject = (latest?.subject || '').replace(/^(re|fwd):\s*/i, '').trim() || activeConversation.name;
    const providerId = getEmailProviderId(activeConversation);
    const account = await resolveConnectedEmailAccount(providerId).catch(() => null);

    setEmailComposeMode(mode);
    emailComposeGroupAccountRef.current = account?.id ?? null;
    setEmailComposeFromEmail(account?.email ?? '');
    setEmailComposeTo(mode === 'reply' ? activeConversation.email ?? '' : '');
    setEmailComposeSubject(`${mode === 'reply' ? 'Re' : 'Fwd'}: ${baseSubject}`);
    setEmailComposeTemplateId(null);
    setEmailComposeBody(
      prefillBody ??
        (mode === 'forward' && latest
          ? `\n\n---------- Forwarded message ----------\nFrom: ${activeConversation.name}\nSubject: ${latest.subject ?? baseSubject}\n\n${latest.content}`
          : ''),
    );
    setEmailComposeError(null);
    setEmailComposeOpen(true);
  }, [activeConversation, activeMessages, resolveConnectedEmailAccount]);

  // Fresh compose from the Gmail/Outlook tab FAB — mirrors ComposeWindow's
  // free-form send (provider from the active tab, recipient typed by the user).
  const openEmailComposeNew = useCallback(async () => {
    const account = await resolveConnectedEmailAccount(emailTabProviderId).catch(() => null);

    setEmailComposeMode('new');
    emailComposeGroupAccountRef.current = account?.id ?? null;
    setEmailComposeFromEmail(account?.email ?? '');
    setEmailComposeTo('');
    setEmailComposeSubject('');
    setEmailComposeTemplateId(null);
    setEmailComposeBody('');
    setEmailComposeError(null);
    setEmailComposeOpen(true);
  }, [emailTabProviderId, resolveConnectedEmailAccount]);

  const submitEmailCompose = useCallback(async () => {
    if (emailComposeSending) {
      return;
    }

    const to = emailComposeTo.trim();
    const subjectText = emailComposeSubject.trim();
    const bodyText = emailComposeBody.trim();

    if (!to || !subjectText || !bodyText) {
      setEmailComposeError('Recipient, subject, and body are required.');
      return;
    }

    setEmailComposeSending(true);
    setEmailComposeError(null);
    try {
      if (emailComposeMode === 'new' || !activeConversation) {
        // Provider follows the active email tab (google | microsoft | custom_smtp).
        const backendProvider = activeFilter === 'outlook' ? 'microsoft' : activeFilter === 'email' ? 'custom_smtp' : 'google';
        // Cc entries join the recipients list and travel as a cc string —
        // exactly what ComposeWindow's handleSend posts to /send-bulk.
        const recipients = [{ email: to }];
        const ccText = emailComposeCc.trim();
        const bccText = emailComposeBcc.trim();
        if (ccText) {
          ccText.split(',').forEach((entry) => {
            if (entry.trim()) {
              recipients.push({ email: entry.trim() });
            }
          });
        }
        await apiPost('/api/social-integration/email/send-bulk', {
          provider: backendProvider,
          recipients,
          cc: ccText || undefined,
          bcc: bccText || undefined,
          subject: subjectText,
          body_html: bodyText,
        });
      } else {
        await sendEmailReply(
          { id: activeConversation.id, email: to, name: activeConversation.name, company: activeConversation.company },
          { subject: subjectText, bodyHtml: bodyText },
        );
        void setActiveConversation(activeConversation.id, { force: true });
      }
      // Green "Sent ✓" flash before the sheet closes — mirrors ComposeWindow.
      setEmailComposeSent(true);
      setTimeout(() => {
        setEmailComposeSent(false);
        setEmailComposeOpen(false);
        setEmailComposeBody('');
        setEmailComposeCc('');
        setEmailComposeBcc('');
        setEmailComposeShowCc(false);
        setEmailComposeShowBcc(false);
        setEmailComposeAttachments([]);
      }, 1500);
    } catch (error) {
      setEmailComposeError(getActionErrorMessage(error, 'Unable to send the email.'));
    } finally {
      setEmailComposeSending(false);
    }
  }, [activeConversation, activeFilter, emailComposeBcc, emailComposeBody, emailComposeCc, emailComposeMode, emailComposeSending, emailComposeSubject, emailComposeTo, setActiveConversation]);

  // ── Email client sidebar + folders (mirrors EmailChannelView) ──

  const loadEmailCommsGroups = useCallback(() => {
    if (!emailTabProvider) {
      setEmailCommsGroups([]);
      return;
    }

    getEmailBroadcastGroups(emailTabProvider)
      .then(setEmailCommsGroups)
      .catch(() => setEmailCommsGroups([]));
  }, [emailTabProvider]);

  const loadSentRuns = useCallback(() => {
    setSentRunsLoading(true);
    getEmailBroadcastRuns(50)
      .then(setSentRuns)
      .catch(() => setSentRuns([]))
      .finally(() => setSentRunsLoading(false));
  }, []);

  const sentBroadcastActiveAccounts = useMemo(
    () => sentBroadcastAccounts.filter((account) => account.status === 'active'),
    [sentBroadcastAccounts],
  );
  const sentBroadcastSelectedAccount = useMemo(
    () => sentBroadcastActiveAccounts.find((account) => account.id === sentBroadcastAccountId) ?? null,
    [sentBroadcastAccountId, sentBroadcastActiveAccounts],
  );
  const sentBroadcastAvailableGroups = useMemo(() => {
    const channel = sentBroadcastSelectedAccount ? getBroadcastProviderForAccount(sentBroadcastSelectedAccount) : emailTabProvider;
    return channel ? sentBroadcastGroups.filter((group) => group.channel === channel) : [];
  }, [emailTabProvider, sentBroadcastGroups, sentBroadcastSelectedAccount]);
  const sentBroadcastParsedRecipients = useMemo(
    () => parseBroadcastRecipients(sentBroadcastRecipients),
    [sentBroadcastRecipients],
  );
  const sentBroadcastSelectedTemplate = useMemo(
    () => sentBroadcastTemplates.find((template) => template.id === sentBroadcastTemplateId) ?? null,
    [sentBroadcastTemplateId, sentBroadcastTemplates],
  );
  const sentBroadcastSendCount = sentBroadcastMode === 'group'
    ? (sentBroadcastAvailableGroups.find((group) => group.id === sentBroadcastGroupId)?.memberCount ?? 0)
    : sentBroadcastParsedRecipients.length;

  useEffect(() => {
    if (sentBroadcastGroupId && !sentBroadcastAvailableGroups.some((group) => group.id === sentBroadcastGroupId)) {
      setSentBroadcastGroupId('');
      return;
    }
    if (sentBroadcastMode === 'group' && !sentBroadcastGroupId && sentBroadcastAvailableGroups.length > 0) {
      setSentBroadcastGroupId(sentBroadcastAvailableGroups[0].id);
    }
  }, [sentBroadcastAvailableGroups, sentBroadcastGroupId, sentBroadcastMode]);

  const openEmailSidebar = useCallback(() => {
    setEmailSidebarOpen(true);
    loadEmailCommsGroups();
    void resolveConnectedEmailAccount(emailTabProviderId)
      .then((account) => setEmailSidebarAccountEmail(account?.email ?? ''))
      .catch(() => setEmailSidebarAccountEmail(''));
  }, [emailTabProviderId, loadEmailCommsGroups, resolveConnectedEmailAccount]);

  const selectEmailFolder = useCallback((folder: string) => {
    setEmailFolder(folder);
    setEmailSidebarOpen(false);
    if (folder === 'sent') {
      loadSentRuns();
    } else if (folder.startsWith('group:')) {
      const groupId = folder.replace('group:', '');
      setEmailMemberSearch('');
      setEmailGroupDetail(null);
      setEmailGroupLoading(true);
      getEmailBroadcastGroup(groupId)
        .then(setEmailGroupDetail)
        .catch(console.error)
        .finally(() => setEmailGroupLoading(false));
    }
  }, [loadSentRuns]);

  const resetSentBroadcastComposer = useCallback(() => {
    setSentBroadcastAccountId('');
    setSentBroadcastMode('group');
    setSentBroadcastGroupId('');
    setSentBroadcastRecipients('');
    setSentBroadcastTemplateId('');
    setSentBroadcastTemplateDropdownOpen(false);
    setSentBroadcastTemplatesError(null);
    setSentBroadcastSubject('');
    setSentBroadcastBody('');
    setSentBroadcastError(null);
  }, []);

  const closeSentBroadcastComposer = useCallback(() => {
    setSentBroadcastOpen(false);
    resetSentBroadcastComposer();
  }, [resetSentBroadcastComposer]);

  const openSentBroadcastComposer = useCallback(async () => {
    setSentBroadcastOpen(true);
    setSentBroadcastLoading(true);
    setSentBroadcastTemplatesLoading(true);
    setSentBroadcastError(null);
    setSentBroadcastTemplates([]);
    setSentBroadcastTemplatesError(null);

    try {
      let templateError: string | null = null;
      const [accounts, gmailGroups, outlookGroups, emailTemplates] = await Promise.all([
        getConnectedEmailAccounts(),
        getEmailBroadcastGroups('gmail').catch(() => []),
        getEmailBroadcastGroups('outlook').catch(() => []),
        loadEmailTemplatesFromApi().catch((error) => {
          templateError = getActionErrorMessage(error, 'Unable to load saved templates.');
          return [];
        }),
      ]);
      const activeAccounts = accounts.filter((account) => account.status === 'active');
      const preferredProvider = getAccountProviderForEmailTab(emailTabProviderId);
      const preferredAccount =
        activeAccounts.find((account) => account.provider === preferredProvider) ??
        accounts.find((account) => account.provider === preferredProvider) ??
        activeAccounts[0] ??
        accounts[0] ??
        null;

      const groups = [...gmailGroups, ...outlookGroups];
      const preferredChannel = getBroadcastProviderForAccount(preferredAccount);
      const preferredGroup = preferredChannel
        ? groups.find((group) => group.channel === preferredChannel)
        : null;

      setSentBroadcastAccounts(accounts);
      setSentBroadcastGroups(groups);
      setSentBroadcastTemplates(emailTemplates);
      setSentBroadcastTemplatesError(templateError);
      setSentBroadcastAccountId(preferredAccount?.id ?? '');
      setSentBroadcastGroupId(preferredGroup?.id ?? '');
      setSentBroadcastMode(preferredAccount?.provider === 'custom_smtp' ? 'manual' : 'group');
    } catch (error) {
      setSentBroadcastError(getActionErrorMessage(error, 'Unable to load broadcast options.'));
    } finally {
      setSentBroadcastLoading(false);
      setSentBroadcastTemplatesLoading(false);
    }
  }, [emailTabProviderId]);

  const applySentBroadcastTemplate = useCallback((template: ChatTemplate) => {
    setSentBroadcastTemplateId(template.id);
    setSentBroadcastTemplateDropdownOpen(false);
    if (template.subject && !sentBroadcastSubject.trim()) {
      setSentBroadcastSubject(template.subject);
    }
    setSentBroadcastBody(template.bodyHtml || template.bodyText || template.body);
  }, [sentBroadcastSubject]);

  const submitSentBroadcast = useCallback(async () => {
    if (sentBroadcastSending) {
      return;
    }

    const subjectText = sentBroadcastSubject.trim();
    const bodyText = sentBroadcastBody.trim();
    const selectedGroup = sentBroadcastAvailableGroups.find((group) => group.id === sentBroadcastGroupId);
    const bodyHtml = toEmailBodyHtml(bodyText);
    const plainBodyText = toEmailBodyText(bodyText);

    if (!sentBroadcastAccountId) {
      setSentBroadcastError('Pick a sender account.');
      return;
    }
    if (!subjectText) {
      setSentBroadcastError('Subject is required.');
      return;
    }
    if (!bodyText) {
      setSentBroadcastError('Body cannot be empty.');
      return;
    }
    if (sentBroadcastMode === 'group') {
      if (!sentBroadcastGroupId) {
        setSentBroadcastError('Pick a group to send to.');
        return;
      }
      if (selectedGroup && selectedGroup.memberCount === 0) {
        setSentBroadcastError(`Group "${selectedGroup.name}" has no members.`);
        return;
      }
    }
    if (sentBroadcastMode === 'manual' && sentBroadcastParsedRecipients.length === 0) {
      setSentBroadcastError('Add at least one recipient email.');
      return;
    }

    setSentBroadcastSending(true);
    setSentBroadcastError(null);
    try {
      await sendEmailBroadcast({
        fromEmailAccountId: sentBroadcastAccountId,
        subject: subjectText,
        bodyHtml,
        bodyText: plainBodyText || null,
        templateId: sentBroadcastSelectedTemplate?.id,
        ...(sentBroadcastMode === 'group'
          ? { groupId: sentBroadcastGroupId }
          : { recipients: sentBroadcastParsedRecipients }),
      });
      closeSentBroadcastComposer();
      loadSentRuns();
      Alert.alert('Broadcast queued', `Email queued for ${sentBroadcastSendCount} recipient${sentBroadcastSendCount === 1 ? '' : 's'}.`);
    } catch (error) {
      setSentBroadcastError(getActionErrorMessage(error, 'Failed to queue broadcast.'));
    } finally {
      setSentBroadcastSending(false);
    }
  }, [
    closeSentBroadcastComposer,
    loadSentRuns,
    sentBroadcastAccountId,
    sentBroadcastAvailableGroups,
    sentBroadcastBody,
    sentBroadcastGroupId,
    sentBroadcastMode,
    sentBroadcastParsedRecipients,
    sentBroadcastSendCount,
    sentBroadcastSelectedTemplate?.id,
    sentBroadcastSending,
    sentBroadcastSubject,
  ]);

  // Leaving the email tabs resets the folder so other channels see the full list.
  useEffect(() => {
    setEmailFolder('inbox');
  }, [activeFilter]);

  // Keep email data warm without forcing the folder pane open.
  useEffect(() => {
    if (isEmailTabActive) {
      loadEmailCommsGroups();
      resolveConnectedEmailAccount(emailTabProviderId)
        .then((account) => setEmailSidebarAccountEmail(account?.email ?? ''))
        .catch(() => setEmailSidebarAccountEmail(''));
    } else {
      setEmailSidebarOpen(false);
      setEmailSidebarAccountEmail('');
    }
  }, [emailTabProviderId, isEmailTabActive, loadEmailCommsGroups, resolveConnectedEmailAccount]);

  const submitCreateEmailGroup = useCallback(async () => {
    const name = emailGroupName.trim();
    if (!name || !emailTabProvider || emailGroupBusy) {
      return;
    }

    setEmailGroupBusy(true);
    try {
      await createEmailBroadcastGroup({
        name,
        channel: emailTabProvider,
        color: GROUP_COLOR_OPTIONS[Math.floor(Math.random() * GROUP_COLOR_OPTIONS.length)],
      });
      setEmailGroupName('');
      setEmailGroupCreateOpen(false);
      loadEmailCommsGroups();
    } catch (error) {
      Alert.alert('Create failed', getActionErrorMessage(error, 'Unable to create the group.'));
    } finally {
      setEmailGroupBusy(false);
    }
  }, [emailGroupBusy, emailGroupName, emailTabProvider, loadEmailCommsGroups]);

  const handleDeleteEmailGroup = useCallback(async (group: EmailBroadcastGroup) => {
    const confirmed = await confirmAction('Delete group', `Delete "${group.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteEmailBroadcastGroup(group.id);
      loadEmailCommsGroups();
    } catch (error) {
      Alert.alert('Delete failed', getActionErrorMessage(error, 'Unable to delete the group.'));
    }
  }, [loadEmailCommsGroups]);

  const openSentRun = useCallback((run: EmailBroadcastRun) => {
    setSentRunOpen(run);
    setSentRunDetail(null);
    setSentRunDetailLoading(true);
    getEmailBroadcastRun(run.id)
      .then(setSentRunDetail)
      .catch(() => setSentRunDetail(null))
      .finally(() => setSentRunDetailLoading(false));
  }, []);

  // Compose to a broadcast group — resolves the connected account for the
  // provider (like frontend-2's From selector) and queues via /broadcast/send.
  const openComposeToGroup = useCallback(async (group: EmailBroadcastGroup) => {
    setEmailSidebarOpen(false);
    try {
      const account = await resolveConnectedEmailAccount(group.channel);

      if (!account) {
        Alert.alert('No connected account', `Connect a ${EMAIL_PROVIDER_META[group.channel].label} account first.`);
        return;
      }

      emailComposeGroupAccountRef.current = account.id;
      setEmailComposeFromEmail(account.email);
      setEmailComposeGroup(group);
      setEmailComposeMode('new');
      setEmailComposeTo(`${group.name} · ${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`);
      setEmailComposeSubject('');
      setEmailComposeTemplateId(null);
      setEmailComposeBody('');
      setEmailComposeError(null);
      setEmailComposeOpen(true);
    } catch (error) {
      Alert.alert('Unable to load accounts', getActionErrorMessage(error, 'Could not reach the email service.'));
    }
  }, [resolveConnectedEmailAccount]);

  const openEmailGroupTemplatePicker = useCallback(async () => {
    if (!emailGroupDetail) {
      return;
    }

    setEmailGroupTemplateOpen(true);
    setEmailGroupTemplatesLoading(true);
    setEmailGroupTemplateError(null);
    try {
      const templates = await loadEmailTemplatesFromApi();
      setEmailGroupTemplates(templates);
    } catch (error) {
      setEmailGroupTemplates([]);
      setEmailGroupTemplateError(getActionErrorMessage(error, 'Unable to load saved templates.'));
    } finally {
      setEmailGroupTemplatesLoading(false);
    }
  }, [emailGroupDetail]);

  const selectEmailGroupTemplate = useCallback(async (template: ChatTemplate) => {
    if (!emailGroupDetail || emailGroupTemplateSendingId) {
      return;
    }

    setEmailGroupTemplateSendingId(template.id);
    setEmailGroupTemplateError(null);
    try {
      const account = await resolveConnectedEmailAccount(emailGroupDetail.channel);
      if (!account) {
        throw new Error(`Connect a ${EMAIL_PROVIDER_META[emailGroupDetail.channel].label} account first.`);
      }

      const bodySource = template.bodyHtml || template.bodyText || template.body;
      emailComposeGroupAccountRef.current = account.id;
      setEmailComposeFromEmail(account.email);
      setEmailComposeGroup(emailGroupDetail);
      setEmailComposeMode('new');
      setEmailComposeTo(`${emailGroupDetail.name} Â· ${emailGroupDetail.memberCount} member${emailGroupDetail.memberCount === 1 ? '' : 's'}`);
      setEmailComposeSubject(template.subject || template.name);
      setEmailComposeTemplateId(template.id);
      setEmailComposeBody(bodySource);
      setEmailComposeError(null);
      setEmailGroupTemplateOpen(false);
      setEmailComposeOpen(true);
    } catch (error) {
      setEmailGroupTemplateError(getActionErrorMessage(error, 'Unable to open this template.'));
    } finally {
      setEmailGroupTemplateSendingId(null);
    }
  }, [emailGroupDetail, emailGroupTemplateSendingId, resolveConnectedEmailAccount]);

  const submitEmailBroadcastToGroup = useCallback(async () => {
    if (!emailComposeGroup || emailComposeSending) {
      return;
    }

    const subjectText = emailComposeSubject.trim();
    const bodyText = emailComposeBody.trim();
    if (!subjectText || !bodyText) {
      setEmailComposeError('Subject and body are required.');
      return;
    }

    const accountId = emailComposeGroupAccountRef.current;
    if (!accountId) {
      setEmailComposeError('No connected account for this provider.');
      return;
    }

    setEmailComposeSending(true);
    setEmailComposeError(null);
    try {
      await sendEmailBroadcastToGroup({
        fromEmailAccountId: accountId,
        subject: subjectText,
        bodyHtml: toEmailBodyHtml(bodyText),
        bodyText: toEmailBodyText(bodyText),
        templateId: emailComposeTemplateId,
        groupId: emailComposeGroup.id,
      });
      const summary = `Email queued for ${emailComposeGroup.memberCount} member${emailComposeGroup.memberCount === 1 ? '' : 's'} of "${emailComposeGroup.name}".`;
      setEmailComposeOpen(false);
      setEmailComposeGroup(null);
      setEmailComposeTemplateId(null);
      setEmailComposeBody('');
      loadSentRuns();
      Alert.alert('Broadcast queued', summary);
    } catch (error) {
      setEmailComposeError(getActionErrorMessage(error, 'Unable to queue the broadcast.'));
    } finally {
      setEmailComposeSending(false);
    }
  }, [emailComposeBody, emailComposeGroup, emailComposeSending, emailComposeSubject, emailComposeTemplateId, loadSentRuns]);

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
      // Match drag-down dismiss: back should collapse the keyboard first,
      // not skip straight to leaving the chat thread while still typing.
      if (isKeyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      closeActiveChatSession();
      return true;
    }

    if (listSelectMode) {
      exitListSelectMode();
      return true;
    }

    if (filterSidebarOpen) {
      setFilterSidebarOpen(false);
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
    filterSidebarOpen,
    isChatFocused,
    isKeyboardVisible,
    listSelectMode,
    mediaLibraryOpen,
    pendingAttachment,
    quickActionsOpen,
    quickComposer,
    templateMenuOpen,
    threadSearchOpen,
    exitListSelectMode,
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

    if (activeConversation && (activeConversation.channel === 'email' || activeConversation.channel === 'gmail')) {
      const provider = EMAIL_PROVIDER_META[getEmailProviderId(activeConversation)];
      const latestId = activeMessages[activeMessages.length - 1]?.id;
      return (
        <EmailMessageCard
          key={`${item.message.id}-${latestId === item.message.id ? 'open' : 'closed'}`}
          message={item.message}
          contactName={activeConversation.name}
          contactEmail={activeConversation.email}
          providerLabel={provider.label}
          providerColor={provider.color}
          providerId={getEmailProviderId(activeConversation)}
          defaultExpanded={latestId === item.message.id}
        />
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
        isHighlighted={item.message.id === highlightedSearchMessageId}
      />
    );
  }, [activeConversation, activeMessages, appTheme.darkMode, authToken, playingMessageId, toggleMessagePlayback, highlightedSearchMessageId]);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    const isEmailRow = item.channel === 'email' || item.channel === 'gmail';

    if (isEmailRow && !listSelectMode) {
      return (
        <EmailConversationRow
          conversation={item}
          isActive={activeConversationId === item.id}
          onPress={() => void setActiveConversation(item.id)}
        />
      );
    }

    if (listSelectMode) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => toggleChatSelection(item.id)}
            style={{ paddingLeft: 18, paddingRight: 2 }}
            activeOpacity={0.7}
          >
            {selectedChatIds.has(item.id)
              ? <CheckSquare color="#00A884" size={20} />
              : <Square color={appTheme.muted} size={20} />}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <ConversationRow
              conversation={item}
              isActive={selectedChatIds.has(item.id)}
              onPress={() => toggleChatSelection(item.id)}
            />
          </View>
        </View>
      );
    }

    return (
      <ConversationRow
        conversation={item}
        isActive={activeConversationId === item.id}
        onPress={() => void setActiveConversation(item.id)}
      />
    );
  }, [activeConversationId, appTheme.muted, listSelectMode, selectedChatIds, setActiveConversation, toggleChatSelection]);

  if (activeConversation) {
    const presenceLabel = activeTyping ? 'Typing...' : activeConversation.online ? 'Online' : '';
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
    const composerSurfaceColor = isWhatsAppThread
      ? 'transparent'
      : isEmailThread
        ? (appTheme.darkMode ? appTheme.surface : '#FFFFFF')
        : activePalette.screen;
    const composerBorderColor = isWhatsAppThread
      ? 'transparent'
      : isEmailThread
        ? activePalette.border
        : composerSurfaceColor;
    const attachmentMenuSurface = appTheme.surface;
    const attachmentMenuBorder = appTheme.border;
    const composerBottomPadding = isKeyboardVisible
      ? 8
      : Math.max(insets.bottom, 8);
    const floatingMenuBottom = composerBottomPadding + 58;
    const templateMenuMaxHeight = Math.max(260, Math.min(460, height - floatingMenuBottom - Math.max(insets.top, 16) - 20));
    const templateListMaxHeight = Math.max(150, templateMenuMaxHeight - 150);
    const composerPopupOpen = agentMenuOpen || quickActionsOpen || templateMenuOpen || Boolean(quickComposer) || emojiPickerOpen;
    const quickComposerIncomplete = quickComposer === 'contact' && (
      !quickDraft.contactName.trim() || !quickDraft.contactPhone.trim() || !quickDraft.contactEmail.trim()
    );
    const ThreadMainSurface = (isWhatsAppThread ? ImageBackground : View) as React.ComponentType<any>;
    const threadMainSurfaceProps = isWhatsAppThread
      ? {
          source: appTheme.darkMode ? CHAT_DARK_BACKGROUND_IMAGE : CHAT_LIGHT_BACKGROUND_IMAGE,
          resizeMode: Platform.OS === 'web' ? 'repeat' as const : 'cover' as const,
          imageStyle: styles.threadBackgroundImage,
        }
      : {};

    // react-native-keyboard-controller's KeyboardAvoidingView (not RN's stock
    // one) drives the push-up off the real native WindowInsetsAnimation/
    // keyboard-frame callbacks instead of the keyboardDidShow/Hide + layout
    // heuristic RN's version uses. Stock KeyboardAvoidingView paired with the
    // native `adjustResize`/edge-to-edge window behavior was double-
    // compensating on Android — the OS resized the window AND the JS layer
    // padded on top of that — which is what produced the large gap above the
    // keyboard on open and the leftover gap on close.
    const KeyboardContainer = KeyboardControllerAvoidingView;
    const keyboardProps = {
      behavior: 'padding' as const,
      keyboardVerticalOffset: 0,
    };

    return (
      <KeyboardContainer
        {...keyboardProps}
        style={[styles.container, { backgroundColor: activePalette.screen }]}
      >
        <Reanimated.View entering={FadeIn.duration(220)} style={styles.threadLayout}>
          <ThreadMainSurface
            {...threadMainSurfaceProps}
            style={[styles.threadMain, { backgroundColor: activePalette.screen }]}
          >
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
                    {(activeConversation.online || activeTyping) && (
                      <View style={[styles.presenceDot, styles.presenceDotOnline]} />
                    )}
                    {presenceLabel ? (
                      <Typography variant="caption" color={activeConversation.online || activeTyping ? appTheme.primaryAccent : appTheme.muted}>
                        {presenceLabel}
                      </Typography>
                    ) : null}
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
                <TouchableOpacity onPress={() => void setActiveConversation(activeConversation.id, { force: true })} style={styles.darkIconButton} activeOpacity={0.75}>
                  {isLoadingMessages ? (
                    <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                  ) : (
                    <RefreshCw color={appTheme.muted} size={19} />
                  )}
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
              isConnectionUnavailableError(error) ? (
                <NoConnectionState
                  compact
                  title="Oops, connection lost"
                  retryLabel="Retry"
                  onRetry={() => void setActiveConversation(activeConversation.id, { force: true })}
                  isRetrying={isLoadingMessages}
                />
              ) : (
                <View style={styles.errorStrip}>
                  <Typography variant="bodySmall" color={Theme.colors.error}>
                    {getFriendlyError(error)}
                  </Typography>
                </View>
              )
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
                  ) : null}
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

            <View
              style={[
                styles.threadBackground,
                isLinkedInThread && styles.linkedinThreadBackground,
                isEmailThread && styles.emailThreadBackground,
                { backgroundColor: isWhatsAppThread ? 'transparent' : activePalette.screen },
              ]}
            >
              {isEmailThread && (() => {
                const provider = EMAIL_PROVIDER_META[getEmailProviderId(activeConversation)];
                const latestSubject = [...activeMessages].reverse().find((message) => message.subject)?.subject;
                return (
                  <View style={[styles.emailThreadBanner, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
                    <Mail color={provider.color} size={20} />
                    <View style={styles.emailThreadBannerText}>
                      <Typography variant="h4" color={appTheme.text} numberOfLines={1}>
                        {latestSubject || activeConversation.name}
                      </Typography>
                      <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                        {activeConversation.email || activeConversation.name} · replies are sent as email
                      </Typography>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: provider.color }}>
                      <Typography variant="caption" color="#FFF" style={{ fontWeight: '700', fontSize: 10 }}>
                        {provider.label}
                      </Typography>
                    </View>
                  </View>
                );
              })()}
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
                      <Reanimated.View entering={FadeIn.duration(300)} style={{ width: '100%' }}>
                        <SkeletonMessageBlock channel={activeConversation.channel} />
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
            </View>

            {composerPopupOpen ? (
              <Pressable style={styles.threadComposerDismissLayer} onPress={closeComposerPopups} />
            ) : null}

            <View
              style={[
                styles.composerShellDark,
                isLinkedInThread && styles.linkedinComposerShell,
                isEmailThread && styles.emailComposerShell,
                {
                  paddingBottom: composerBottomPadding,
                  backgroundColor: composerSurfaceColor,
                  borderTopColor: composerBorderColor,
                },
              ]}
            >
              {isDisconnected ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Typography variant="body" color={Theme.colors.error} style={{ textAlign: 'center' }}>
                    Please connect your account to continue chatting.
                  </Typography>
                </View>
              ) : isEmailThread ? (
                (() => {
                  const provider = EMAIL_PROVIDER_META[getEmailProviderId(activeConversation)];
                  const latestSubject =
                    [...activeMessages].reverse().find((message) => message.subject)?.subject || activeConversation.name;
                  return (
                    <View>
                      {/* Smart reply chips — same suggestions as lad-frontend-2 */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 2 }}
                        keyboardShouldPersistTaps="handled"
                      >
                        {getSmartReplies(latestSubject).map((reply) => (
                          <TouchableOpacity
                            key={reply}
                            onPress={() => void openEmailCompose('reply', reply)}
                            activeOpacity={0.75}
                            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: appTheme.border }}
                          >
                            <Typography variant="caption" style={{ color: provider.color, fontWeight: '600' }}>
                              {reply}
                            </Typography>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: provider.color, borderRadius: 24, paddingVertical: 12 }}
                          onPress={() => void openEmailCompose('reply')}
                          activeOpacity={0.85}
                        >
                          <Reply color="#FFF" size={17} />
                          <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Reply</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, paddingVertical: 12, borderWidth: 1.5, borderColor: provider.color }}
                          onPress={() => void openEmailCompose('forward')}
                          activeOpacity={0.85}
                        >
                          <ForwardIcon color={provider.color} size={17} />
                          <Typography variant="bodySmall" style={{ fontWeight: '700', color: provider.color }}>Forward</Typography>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()
              ) : (
                <>
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
                <View style={[styles.quickActionMenu, { bottom: floatingMenuBottom, backgroundColor: attachmentMenuSurface, borderColor: attachmentMenuBorder }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
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
                  </ScrollView>
                </View>
              )}

              {templateMenuOpen && (
                <View style={[styles.templateMenu, { bottom: floatingMenuBottom, maxHeight: templateMenuMaxHeight, backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
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

                  {templateSending ? (
                    <View style={styles.templateLoadingRow}>
                      <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                      <Typography variant="caption" color={appTheme.muted}>Sending template...</Typography>
                    </View>
                  ) : templatesLoading ? (
                    <View style={styles.templateLoadingRow}>
                      <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                      <Typography variant="caption" color={appTheme.muted}>Loading templates...</Typography>
                    </View>
                  ) : filteredTemplates.length ? (
                    <ScrollView
                      style={[styles.templateList, { maxHeight: templateListMaxHeight }]}
                      contentContainerStyle={styles.templateListContent}
                      showsVerticalScrollIndicator
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredTemplates.map((template) => (
                        <TouchableOpacity
                          key={template.id}
                          style={[styles.templateItem, { backgroundColor: appTheme.input, borderColor: appTheme.border }]}
                          onPress={() => void handleTemplateSelect(template)}
                          disabled={templateSending}
                          activeOpacity={0.78}
                        >
                          <View style={styles.templateItemTop}>
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.templateName} numberOfLines={1}>
                              {template.name}
                            </Typography>
                            {template.category && (
                              <View style={[styles.templateBadge, appTheme.darkMode && { backgroundColor: appTheme.labelBackground, borderColor: appTheme.labelBorder }]}>
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
                        placeholder="Email (Gmail)"
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
                    style={[styles.quickComposerSendButton, (isSending || isLocked || quickComposerIncomplete) && styles.sendButtonDisabled]}
                    disabled={isSending || isLocked || quickComposerIncomplete}
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
              <View style={[styles.composerPillWrap, isEmailThread && styles.emailComposerInput, { backgroundColor: isEmailThread ? '#FFFFFF' : appTheme.input }]}>
                <TouchableOpacity
                  style={[styles.composerPillToolButton, quickActionsOpen && styles.composerAttachButtonOpen]}
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
                  {quickActionsOpen
                    ? <X color="#53BDA5" size={20} />
                    : <Plus color={appTheme.muted} size={22} />}
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
                      WEB_INPUT_RESET,
                      {
                        color: appTheme.text,
                        paddingTop: Platform.OS === 'web' ? 14 : 10,
                        paddingBottom: Platform.OS === 'web' ? 4 : 8,
                        textAlign: 'left',
                      },
                    ]}
                    onFocus={closeThreadPopups}
                    multiline
                    editable={!isLocked}
                  />
                ) : null}
                {!isRecording && !pendingVoiceNote ? (
                  <TouchableOpacity
                    style={styles.composerPillToolButton}
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
              </View>

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
                    styles.composerMicButton,
                    isLocked && styles.sendButtonDisabled,
                  ]}
                >
                  <Mic color={appTheme.muted} size={21} />
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
            </>
          )}
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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    paddingBottom: isKeyboardVisible ? 16 : Math.max(insets.bottom, 16),
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                >
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
          </ThreadMainSurface>

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

        {/* ── Email compose sheet (Reply / Forward — mirrors EmailComposePanel) ── */}
        {renderEmailComposeSheet(EMAIL_PROVIDER_META[getEmailProviderId(activeConversation)])}
      </KeyboardContainer>
    );
  }

  // Shared email compose sheet — used by the thread view (Reply/Forward) and
  // the Gmail/Outlook tab compose FAB. A function declaration so it hoists
  // above the thread view's early return.
  // Compose sheet — mirrors lad-frontend-2's ComposeWindow: title bar with
  // minimize/maximize/close, To with Cc/Bcc, formatting toolbar (undo/redo,
  // bold, italic, link, lists), templates, attachments, emoji, variables,
  // and a discard action.
  function renderEmailComposeSheet(provider: { label: string; color: string }) {
    const composeTitle = emailComposeGroup
      ? 'Broadcast to Group'
      : emailComposeMode === 'reply' ? 'Reply' : emailComposeMode === 'forward' ? 'Forward' : 'New Message';

    const closeComposeSheet = () => {
      setEmailComposeOpen(false);
      setEmailComposeGroup(null);
      setEmailComposeFromEmail('');
      setEmailComposeMinimized(false);
      setEmailComposeMaximized(false);
      setEmailComposeEmojiOpen(false);
      setEmailComposeTemplatesOpen(false);
      setEmailComposeShowCc(false);
      setEmailComposeShowBcc(false);
      setEmailComposeCc('');
      setEmailComposeBcc('');
      setEmailComposeAttachments([]);
      setEmailComposeSent(false);
      setEmailComposeShowSuggestions(false);
      setEmailComposeAgentMenuOpen(false);
      setEmailComposeEmojiCategory('smileys');
      setEmailComposeEmojiSearch('');
      setEmailComposeConfidential(false);
      setEmailComposeMoreOpen(false);
      setEmailComposeTemplateSearch('');
      emailComposeHistoryRef.current = [];
      emailComposeRedoRef.current = [];
      emailComposeGroupAccountRef.current = null;
    };

    // Contact suggestions for the To field — mirrors ComposeWindow's
    // suggestedContacts, sourced from the conversations we already hold.
    const composeToQuery = emailComposeTo.trim().toLowerCase();
    const suggestedComposeContacts = composeToQuery
      ? conversations
          .filter((conversation) => {
            const email = (conversation.email ?? '').toLowerCase();
            if (!email || email === composeToQuery) {
              return false;
            }
            return email.includes(composeToQuery) || (conversation.name ?? '').toLowerCase().includes(composeToQuery);
          })
          .filter((conversation, index, list) => list.findIndex((c) => (c.email ?? '').toLowerCase() === (conversation.email ?? '').toLowerCase()) === index)
          .slice(0, 5)
      : [];

    const pushBodyHistory = (previous: string) => {
      const history = emailComposeHistoryRef.current;
      if (history[history.length - 1] !== previous) {
        history.push(previous);
        if (history.length > 100) {
          history.shift();
        }
      }
      emailComposeRedoRef.current = [];
    };

    const handleBodyChange = (next: string) => {
      pushBodyHistory(emailComposeBody);
      setEmailComposeBody(next);
    };

    const undoBody = () => {
      const history = emailComposeHistoryRef.current;
      if (!history.length) {
        return;
      }
      emailComposeRedoRef.current.push(emailComposeBody);
      setEmailComposeBody(history.pop() as string);
    };

    const redoBody = () => {
      const redo = emailComposeRedoRef.current;
      if (!redo.length) {
        return;
      }
      emailComposeHistoryRef.current.push(emailComposeBody);
      setEmailComposeBody(redo.pop() as string);
    };

    const wrapBodySelection = (wrap: string, fallback: string) => {
      const { start, end } = emailComposeSelectionRef.current;
      const body = emailComposeBody;
      const from = Math.min(start, body.length);
      const to = Math.min(Math.max(end, from), body.length);
      const selected = body.slice(from, to) || fallback;
      pushBodyHistory(body);
      setEmailComposeBody(`${body.slice(0, from)}${wrap}${selected}${wrap}${body.slice(to)}`);
    };

    const insertIntoBody = (snippet: string) => {
      const { start, end } = emailComposeSelectionRef.current;
      const body = emailComposeBody;
      const from = Math.min(start, body.length);
      const to = Math.min(Math.max(end, from), body.length);
      pushBodyHistory(body);
      setEmailComposeBody(`${body.slice(0, from)}${snippet}${body.slice(to)}`);
    };

    const handleInsertLink = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = window.prompt('Enter URL:', 'https://');
        if (url) {
          insertIntoBody(`[link text](${url})`);
        }
        return;
      }

      insertIntoBody('[link text](https://)');
    };

    const handlePickComposeAttachment = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
        if (!result.canceled) {
          setEmailComposeAttachments((current) => [
            ...current,
            ...result.assets.map((asset) => ({ name: asset.name })),
          ]);
        }
      } catch {
        // Picker cancelled or unavailable.
      }
    };

    const toggleComposeTemplates = () => {
      setEmailComposeEmojiOpen(false);
      setEmailComposeTemplatesOpen((value) => {
        if (!value) {
          void loadTemplates('email');
        }
        return !value;
      });
    };

    const applyComposeTemplate = (template: ChatTemplate) => {
      if (!emailComposeSubject.trim()) {
        setEmailComposeSubject(template.name);
      }
      pushBodyHistory(emailComposeBody);
      setEmailComposeTemplateId(template.id);
      setEmailComposeBody(template.body);
      setEmailComposeTemplatesOpen(false);
    };

    const discardCompose = () => {
      setEmailComposeTo('');
      setEmailComposeSubject('');
      setEmailComposeTemplateId(null);
      setEmailComposeBody('');
      setEmailComposeError(null);
      closeComposeSheet();
    };

    const sendAction = () => void (emailComposeGroup ? submitEmailBroadcastToGroup() : submitEmailCompose());

    const toolbarButton = (Icon: typeof Send, onPress: () => void, options?: { bold?: boolean; italic?: boolean }) => (
      <TouchableOpacity onPress={onPress} style={{ padding: 8 }} activeOpacity={0.7}>
        <Icon color={appTheme.muted} size={16} {...(options ?? {})} />
      </TouchableOpacity>
    );

    // Minimized — just the title bar docked at the bottom, like Gmail.
    if (emailComposeMinimized) {
      return (
        <Modal visible={emailComposeOpen} transparent animationType="none" onRequestClose={closeComposeSheet}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#404040', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 14, marginBottom: Math.max(insets.bottom, 12), borderRadius: 12 }}>
              <TouchableOpacity onPress={() => setEmailComposeMinimized(false)} style={{ flex: 1 }} activeOpacity={0.8}>
                <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {emailComposeSubject.trim() || composeTitle}
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEmailComposeMinimized(false)} style={{ padding: 4 }} activeOpacity={0.7}>
                <ChevronUp color="#FFF" size={17} />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeComposeSheet} style={{ padding: 4 }} activeOpacity={0.7}>
                <X color="#FFF" size={17} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    return (
        <Modal visible={emailComposeOpen} transparent animationType="slide" onRequestClose={closeComposeSheet}>
              <KeyboardAvoidingView
                behavior="padding"
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
              >
                <View
                  style={{
                    backgroundColor: appTheme.surface,
                    borderTopLeftRadius: emailComposeMaximized ? 0 : 18,
                    borderTopRightRadius: emailComposeMaximized ? 0 : 18,
                    height: emailComposeMaximized ? '100%' : undefined,
                    maxHeight: emailComposeMaximized ? '100%' : '92%',
                    paddingBottom: Math.max(insets.bottom, 12),
                    paddingTop: emailComposeMaximized ? Math.max(insets.top, 12) : 0,
                  }}
                >
                  {/* Title bar — New Message · − ⛶ × (like ComposeWindow) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                    <Mail color={provider.color} size={18} />
                    <Typography variant="body" color={appTheme.text} style={{ fontWeight: '700', flex: 1, marginLeft: 4 }}>
                      {composeTitle}
                    </Typography>
                    <TouchableOpacity onPress={() => setEmailComposeMinimized(true)} style={{ padding: 6 }} activeOpacity={0.7}>
                      <MinusCircle color={appTheme.muted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEmailComposeMaximized((value) => !value)} style={{ padding: 6 }} activeOpacity={0.7}>
                      {emailComposeMaximized
                        ? <ChevronDown color={appTheme.muted} size={18} />
                        : <ChevronUp color={appTheme.muted} size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={closeComposeSheet} style={{ padding: 6 }} activeOpacity={0.7}>
                      <X color={appTheme.muted} size={19} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
                    {/* To + Cc/Bcc toggles */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                      <Typography variant="bodySmall" color={appTheme.muted} style={{ width: 52 }}>To</Typography>
                      {emailComposeGroup ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: appTheme.softSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flex: 1 }}>
                          <Users color={provider.color} size={13} />
                          <Typography variant="caption" color={appTheme.text} style={{ fontWeight: '600' }} numberOfLines={1}>
                            {emailComposeGroup.name} · {emailComposeGroup.memberCount} member{emailComposeGroup.memberCount === 1 ? '' : 's'}
                          </Typography>
                        </View>
                      ) : (
                        <>
                          <TextInput
                            value={emailComposeTo}
                            onChangeText={(value) => {
                              setEmailComposeTo(value);
                              setEmailComposeShowSuggestions(true);
                            }}
                            onFocus={() => setEmailComposeShowSuggestions(true)}
                            onBlur={() => {
                              if (emailComposeSuggestionBlurRef.current) {
                                clearTimeout(emailComposeSuggestionBlurRef.current);
                              }
                              emailComposeSuggestionBlurRef.current = setTimeout(() => setEmailComposeShowSuggestions(false), 200);
                            }}
                            placeholder="Recipient email"
                            placeholderTextColor={appTheme.disabled}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 14, paddingVertical: 2 }]}
                          />
                          <TouchableOpacity onPress={() => setEmailComposeShowCc((value) => !value)} activeOpacity={0.7}>
                            <Typography variant="caption" style={{ color: emailComposeShowCc ? provider.color : appTheme.muted, fontWeight: '600' }}>Cc</Typography>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEmailComposeShowBcc((value) => !value)} activeOpacity={0.7}>
                            <Typography variant="caption" style={{ color: emailComposeShowBcc ? provider.color : appTheme.muted, fontWeight: '600' }}>Bcc</Typography>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                    {/* Contact suggestions — mirrors ComposeWindow's suggested contacts list */}
                    {emailComposeShowSuggestions && !emailComposeGroup && suggestedComposeContacts.length > 0 && (
                      <View style={{ borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft, backgroundColor: appTheme.softSurface }}>
                        {suggestedComposeContacts.map((contact) => (
                          <TouchableOpacity
                            key={contact.id}
                            onPress={() => {
                              if (emailComposeSuggestionBlurRef.current) {
                                clearTimeout(emailComposeSuggestionBlurRef.current);
                              }
                              setEmailComposeTo(contact.email ?? '');
                              setEmailComposeShowSuggestions(false);
                            }}
                            activeOpacity={0.75}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9 }}
                          >
                            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${provider.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="caption" style={{ color: provider.color, fontWeight: '700' }}>
                                {(contact.name || contact.email || '?').charAt(0).toUpperCase()}
                              </Typography>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600' }} numberOfLines={1}>
                                {contact.name || contact.email}
                              </Typography>
                              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{contact.email}</Typography>
                            </View>
                            {contact.company ? (
                              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: appTheme.input }}>
                                <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ maxWidth: 90 }}>{contact.company}</Typography>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {emailComposeShowCc && !emailComposeGroup && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                        <Typography variant="bodySmall" color={appTheme.muted} style={{ width: 52 }}>Cc</Typography>
                        <TextInput
                          value={emailComposeCc}
                          onChangeText={setEmailComposeCc}
                          placeholder="Comma-separated emails"
                          placeholderTextColor={appTheme.disabled}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 14, paddingVertical: 2 }]}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            setEmailComposeShowCc(false);
                            setEmailComposeCc('');
                          }}
                          style={{ padding: 4 }}
                          activeOpacity={0.7}
                        >
                          <X color={appTheme.muted} size={14} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {emailComposeShowBcc && !emailComposeGroup && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                        <Typography variant="bodySmall" color={appTheme.muted} style={{ width: 52 }}>Bcc</Typography>
                        <TextInput
                          value={emailComposeBcc}
                          onChangeText={setEmailComposeBcc}
                          placeholder="Comma-separated emails"
                          placeholderTextColor={appTheme.disabled}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 14, paddingVertical: 2 }]}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            setEmailComposeShowBcc(false);
                            setEmailComposeBcc('');
                          }}
                          style={{ padding: 4 }}
                          activeOpacity={0.7}
                        >
                          <X color={appTheme.muted} size={14} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {/* From (read-only, connected account context) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                      <Typography variant="bodySmall" color={appTheme.muted} style={{ width: 52 }}>From</Typography>
                      <Typography variant="bodySmall" color={appTheme.text} numberOfLines={1} style={{ flex: 1 }}>
                        {emailComposeFromEmail || `Connect ${provider.label} in Settings`}
                      </Typography>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: provider.color }}>
                        <Typography variant="caption" color="#FFF" style={{ fontSize: 9, fontWeight: '700' }}>{provider.label}</Typography>
                      </View>
                    </View>
                    {/* Subject */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                      <Typography variant="bodySmall" color={appTheme.muted} style={{ width: 52 }}>Subject</Typography>
                      <TextInput
                        value={emailComposeSubject}
                        onChangeText={setEmailComposeSubject}
                        placeholder="Subject"
                        placeholderTextColor={appTheme.disabled}
                        style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 14, fontWeight: '600', paddingVertical: 2 }]}
                      />
                    </View>
                    {/* Body */}
                    <TextInput
                      value={emailComposeBody}
                      onChangeText={handleBodyChange}
                      onSelectionChange={(event) => {
                        emailComposeSelectionRef.current = event.nativeEvent.selection;
                      }}
                      placeholder="Body Text"
                      placeholderTextColor={appTheme.disabled}
                      multiline
                      style={[WEB_INPUT_RESET, { minHeight: emailComposeMaximized ? 280 : 160, maxHeight: emailComposeMaximized ? 480 : 280, color: appTheme.text, fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 14, textAlignVertical: 'top' }]}
                    />
                    {/* Attachment chips */}
                    {emailComposeAttachments.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
                        {emailComposeAttachments.map((attachment, index) => (
                          <View key={`${attachment.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: appTheme.softSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Paperclip color={appTheme.muted} size={11} />
                            <Typography variant="caption" color={appTheme.text} numberOfLines={1} style={{ maxWidth: 160 }}>{attachment.name}</Typography>
                            <TouchableOpacity onPress={() => setEmailComposeAttachments((current) => current.filter((_, i) => i !== index))}>
                              <X color={appTheme.muted} size={11} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Variable chips — {name} {first_name} {company} {email} */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 6 }}>
                      {['{name}', '{first_name}', '{company}', '{email}'].map((variable) => (
                        <TouchableOpacity
                          key={variable}
                          onPress={() => insertIntoBody(variable)}
                          activeOpacity={0.7}
                          style={{ borderWidth: 1, borderColor: appTheme.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}
                        >
                          <Typography variant="caption" color={appTheme.muted} style={{ fontSize: 10 }}>{variable}</Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {emailComposeError ? (
                      <Typography variant="caption" color={Theme.colors.error} style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                        {emailComposeError}
                      </Typography>
                    ) : null}
                  </ScrollView>

                  {/* Templates panel — search mirrors InlineTemplatePicker */}
                  {emailComposeTemplatesOpen && (
                    <View style={{ maxHeight: 230, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: appTheme.input }}>
                        <Search color={appTheme.disabled} size={13} />
                        <TextInput
                          value={emailComposeTemplateSearch}
                          onChangeText={setEmailComposeTemplateSearch}
                          placeholder="Search templates"
                          placeholderTextColor={appTheme.disabled}
                          style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 13, paddingVertical: 0 }]}
                        />
                        {emailComposeTemplateSearch ? (
                          <TouchableOpacity onPress={() => setEmailComposeTemplateSearch('')} activeOpacity={0.7}>
                            <X color={appTheme.disabled} size={13} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {templatesLoading ? (
                        <ActivityIndicator color={provider.color} style={{ paddingVertical: 18 }} />
                      ) : (
                        <ScrollView keyboardShouldPersistTaps="handled">
                          {chatTemplates.filter((template) => {
                            const query = emailComposeTemplateSearch.trim().toLowerCase();
                            if (!query) {
                              return true;
                            }
                            return template.name.toLowerCase().includes(query) || template.body.toLowerCase().includes(query);
                          }).map((template) => (
                            <TouchableOpacity
                              key={template.id}
                              onPress={() => applyComposeTemplate(template)}
                              activeOpacity={0.7}
                              style={{ paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}
                            >
                              <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600' }} numberOfLines={1}>{template.name}</Typography>
                              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{template.body}</Typography>
                            </TouchableOpacity>
                          ))}
                          {!chatTemplates.length && (
                            <Typography variant="caption" color={appTheme.muted} style={{ padding: 14, textAlign: 'center' }}>
                              No email templates found.
                            </Typography>
                          )}
                        </ScrollView>
                      )}
                    </View>
                  )}

                  {/* Emoji popover — searchable + categorized (mirrors ComposeWindow's emoji picker) */}
                  {emailComposeEmojiOpen && (
                    <View style={{ height: 300, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                      {/* Search bar */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: appTheme.input }}>
                        <Search color={appTheme.disabled} size={13} />
                        <TextInput
                          value={emailComposeEmojiSearch}
                          onChangeText={setEmailComposeEmojiSearch}
                          placeholder="Search emoji"
                          placeholderTextColor={appTheme.disabled}
                          style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 13, paddingVertical: 0 }]}
                        />
                        {emailComposeEmojiSearch ? (
                          <TouchableOpacity onPress={() => setEmailComposeEmojiSearch('')} activeOpacity={0.7}>
                            <X color={appTheme.disabled} size={13} />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {/* Category tabs */}
                      {!emailComposeEmojiSearch ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }} contentContainerStyle={{ paddingHorizontal: 8 }}>
                          {EMOJI_CATEGORIES.map((cat) => (
                            <TouchableOpacity
                              key={cat.id}
                              onPress={() => setEmailComposeEmojiCategory(cat.id)}
                              style={{ paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: emailComposeEmojiCategory === cat.id ? provider.color : 'transparent' }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : null}

                      {/* Emoji grid */}
                      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 10, paddingVertical: 8 }}>
                          {(emailComposeEmojiSearch
                            ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, i, arr) => arr.indexOf(emoji) === i).slice(0, 160)
                            : EMOJI_CATEGORIES.find((c) => c.id === emailComposeEmojiCategory)?.emojis ?? EMOJI_CATEGORIES[0].emojis
                          ).map((emoji, idx) => (
                            <TouchableOpacity
                              key={`${emailComposeEmojiCategory}-${idx}`}
                              onPress={() => insertIntoBody(emoji)}
                              style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 22 }}>{emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Formatting toolbar — undo redo | B I link | numbered bulleted */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                    <TouchableOpacity onPress={undoBody} style={{ padding: 8 }} activeOpacity={0.7}>
                      <Undo2 color={appTheme.muted} size={15} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={redoBody} style={{ padding: 8 }} activeOpacity={0.7}>
                      <Redo2 color={appTheme.muted} size={15} />
                    </TouchableOpacity>
                    <View style={{ width: 1, height: 18, backgroundColor: appTheme.borderSoft, marginHorizontal: 4 }} />
                    <TouchableOpacity onPress={() => wrapBodySelection('**', 'bold text')} style={{ paddingHorizontal: 10, paddingVertical: 8 }} activeOpacity={0.7}>
                      <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '800' }}>B</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => wrapBodySelection('_', 'italic text')} style={{ paddingHorizontal: 10, paddingVertical: 8 }} activeOpacity={0.7}>
                      <Typography variant="bodySmall" color={appTheme.text} style={{ fontStyle: 'italic', fontWeight: '600' }}>I</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleInsertLink} style={{ padding: 8 }} activeOpacity={0.7}>
                      <Link2 color={appTheme.muted} size={15} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertIntoBody('\n1. ')} style={{ paddingHorizontal: 10, paddingVertical: 8 }} activeOpacity={0.7}>
                      <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '700' }}>1.</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertIntoBody('\n• ')} style={{ padding: 8 }} activeOpacity={0.7}>
                      <ListIcon color={appTheme.muted} size={15} />
                    </TouchableOpacity>
                  </View>

                  {/* Agent chooser menu — mirrors ComposeWindow's Human / Mr LAD dropdown */}
                  {emailComposeAgentMenuOpen && (
                    <View style={{ marginHorizontal: 12, marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: appTheme.border, backgroundColor: appTheme.surface, overflow: 'hidden' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEmailComposeAgent('human');
                          setEmailComposeAgentMenuOpen(false);
                        }}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: emailComposeAgent === 'human' ? appTheme.softSurface : 'transparent' }}
                      >
                        <UserRound color="#F97316" size={17} />
                        <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1 }}>Human Agent</Typography>
                        {emailComposeAgent === 'human' ? <Typography variant="caption" color={appTheme.muted}>Active</Typography> : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setEmailComposeAgent('ai');
                          setEmailComposeAgentMenuOpen(false);
                        }}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: emailComposeAgent === 'ai' ? appTheme.softSurface : 'transparent' }}
                      >
                        <LadLogoMark color={provider.color} size={17} />
                        <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1 }}>Mr LAD</Typography>
                        {emailComposeAgent === 'ai' ? <Typography variant="caption" color={appTheme.muted}>Active</Typography> : null}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* More-options menu — confidential mode surfaced here on mobile */}
                  {emailComposeMoreOpen && (
                    <View style={{ marginHorizontal: 12, marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: appTheme.border, backgroundColor: appTheme.surface, overflow: 'hidden' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEmailComposeConfidential((value) => !value);
                          setEmailComposeMoreOpen(false);
                        }}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 }}
                      >
                        <Lock color={emailComposeConfidential ? provider.color : appTheme.muted} size={16} />
                        <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1 }}>Confidential mode</Typography>
                        {emailComposeConfidential ? <Check color={provider.color} size={16} /> : null}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Bottom action bar — Send · agent · templates · attach · emoji · confidential · more · discard */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingTop: 8 }}>
                    <TouchableOpacity
                      onPress={sendAction}
                      disabled={emailComposeSending || emailComposeSent}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: emailComposeSent ? '#188038' : provider.color, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, opacity: emailComposeSending ? 0.6 : 1 }}
                      activeOpacity={0.85}
                    >
                      {emailComposeSent
                        ? <Check color="#FFF" size={15} />
                        : emailComposeSending
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Send color="#FFF" size={15} />}
                      <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>
                        {emailComposeSent ? 'Sent' : emailComposeSending ? 'Sending…' : 'Send'}
                      </Typography>
                    </TouchableOpacity>

                    {/* Agent toggle — AI (Mr LAD) / human handoff */}
                    <TouchableOpacity
                      onPress={() => {
                        setEmailComposeMoreOpen(false);
                        setEmailComposeAgentMenuOpen((value) => !value);
                      }}
                      style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }}
                      activeOpacity={0.7}
                    >
                      {emailComposeAgent === 'human'
                        ? <UserRound color="#F97316" size={19} />
                        : <LadLogoMark color={provider.color} size={19} />}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={toggleComposeTemplates} style={{ padding: 9 }} activeOpacity={0.7}>
                      <FileText color={emailComposeTemplatesOpen ? provider.color : appTheme.muted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void handlePickComposeAttachment()} style={{ padding: 9 }} activeOpacity={0.7}>
                      <Paperclip color={emailComposeAttachments.length ? provider.color : appTheme.muted} size={18} />
                    </TouchableOpacity>
                    {emailComposeAttachments.length > 0 ? (
                      <Typography variant="caption" color={appTheme.muted} style={{ marginRight: 2 }}>{emailComposeAttachments.length}</Typography>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => {
                        setEmailComposeTemplatesOpen(false);
                        setEmailComposeEmojiOpen((value) => !value);
                      }}
                      style={{ padding: 9 }}
                      activeOpacity={0.7}
                    >
                      <Smile color={emailComposeEmojiOpen ? provider.color : appTheme.muted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEmailComposeConfidential((value) => !value)}
                      style={{ padding: 9 }}
                      activeOpacity={0.7}
                    >
                      <Lock color={emailComposeConfidential ? provider.color : appTheme.muted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setEmailComposeAgentMenuOpen(false);
                        setEmailComposeMoreOpen((value) => !value);
                      }}
                      style={{ padding: 9 }}
                      activeOpacity={0.7}
                    >
                      <MoreVertical color={emailComposeMoreOpen ? provider.color : appTheme.muted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={discardCompose} style={{ padding: 9 }} activeOpacity={0.7}>
                      <Trash2 color={appTheme.muted} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
        </Modal>
    );
  }

  const chatSubscreenOpen = createChatMenuOpen || broadcastGroupsScreenOpen;

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      {!isEmailGroupFolder && !chatSubscreenOpen && (
        <Reanimated.View entering={FadeInDown.delay(0).duration(380).springify()} style={[styles.header, styles.mainChatsHeader, { paddingTop: Math.max(insets.top, 16) + 16, zIndex: 10, backgroundColor: appTheme.background }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleArea}>
              <Typography variant="h1" color={appTheme.text} style={{ fontWeight: '800' }}>Chats</Typography>
            </View>
          </View>
          <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={1} style={[styles.headerMeta, { fontWeight: '600', marginTop: 4 }]}>
            {focusedConversationCount} focused • {liveConversationCount} total • {lastSyncedLabel}
          </Typography>
        </Reanimated.View>
      )}

      <View style={[styles.content, chatSubscreenOpen && styles.contentFullBleed]}>
        {createChatMenuOpen || filterDropdownOpen ? (
          <Pressable style={styles.listDismissLayer} onPress={closeConversationListPopups} />
        ) : null}
        {createChatMenuOpen && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: appTheme.background, zIndex: 999, elevation: 40 }]}>
             <View style={[styles.subscreenHeader, { paddingTop: Math.max(insets.top, 16) + 14, backgroundColor: appTheme.background }]}>
               <TouchableOpacity onPress={closeCreateChatMenu} activeOpacity={0.7} style={styles.subscreenBackButton}>
                 <ArrowLeft color={appTheme.text} size={24} />
               </TouchableOpacity>
               <Typography variant="h2" color={appTheme.text} style={{ fontWeight: '800' }}>New chat</Typography>
             </View>

             {(() => {
               const query = createChatSearch.trim().toLowerCase();
               const connectedBroadcastGroups = broadcastGroups.filter((group) =>
                 matchesConnectedWhatsAppGroupSource(group, connectedWhatsAppSources),
               );
               const groupsForNewChat = query
                 ? connectedBroadcastGroups.filter((group) => group.name.toLowerCase().includes(query))
                 : connectedBroadcastGroups;
               const allGroupsSelected = groupsForNewChat.length > 0 && groupsForNewChat.every((group) => newChatGroupIds.has(group.id));
               const contactsForNewChat = createChatContacts.slice(0, 200);
               const newChatEmptyText = isLoadingIntegrations
                 ? 'Loading WhatsApp contacts...'
                 : connectedWhatsAppSources.size === 0
                   ? 'Connect WhatsApp in Integrations to view contacts'
                   : 'No connected WhatsApp contacts or groups found';

               const listHeader = (
                 <View>
                   <View style={{ paddingHorizontal: 24, paddingBottom: 4, paddingTop: 8 }}>
                     <View style={[styles.createChatSearchBar, { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft, marginBottom: 16, borderRadius: 24, paddingHorizontal: 16, height: 48 }]}>
                       <Search color={appTheme.muted} size={18} />
                       <TextInput
                         placeholder="Search name or number"
                         placeholderTextColor={appTheme.disabled}
                         value={createChatSearch}
                         onChangeText={setCreateChatSearch}
                         style={[styles.createChatSearchInput, WEB_INPUT_RESET, { color: appTheme.text, fontSize: 15, fontWeight: '500' }]}
                       />
                     </View>

                     <TouchableOpacity
                       style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 }}
                       activeOpacity={0.7}
                       onPress={() => void handleImportLeadsAction()}
                     >
                       <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                         <Upload color="#FFF" size={20} />
                       </View>
                       <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 16 }}>Import Leads</Typography>
                     </TouchableOpacity>

                     <TouchableOpacity
                       style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 }}
                       activeOpacity={0.7}
                       onPress={openNewBroadcastFlow}
                     >
                       <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                         <Megaphone color="#FFF" size={20} />
                       </View>
                       <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 16 }}>New Broadcast</Typography>
                     </TouchableOpacity>
                   </View>

                   {groupsForNewChat.length > 0 && (
                     <View style={{ paddingHorizontal: 24 }}>
                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                         <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '600', letterSpacing: 0.5 }}>GROUPS</Typography>
                         <TouchableOpacity
                           onPress={() => {
                             setNewChatGroupIds((current) => {
                               const next = new Set(current);
                               if (allGroupsSelected) {
                                 groupsForNewChat.forEach((group) => next.delete(group.id));
                               } else {
                                 groupsForNewChat.forEach((group) => next.add(group.id));
                               }
                               return next;
                             });
                           }}
                         >
                           <Typography variant="bodySmall" color={appTheme.primaryAccent}>
                             {allGroupsSelected ? 'Deselect all' : 'Select all'} {newChatGroupIds.size}/{groupsForNewChat.length}
                           </Typography>
                         </TouchableOpacity>
                       </View>
                       {isLoadingGroups ? (
                         <Reanimated.View entering={FadeIn.duration(350)} style={{ width: '100%', gap: 16 }}>
                           <SkeletonConversationRow />
                           <SkeletonConversationRow />
                         </Reanimated.View>
                       ) : (
                         groupsForNewChat.map((group, groupIndex) => {
                           const checked = newChatGroupIds.has(group.id);
                           return (
                             <Reanimated.View key={group.id} entering={FadeInDown.delay(Math.min(groupIndex, 8) * 24).duration(240)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
                               <TouchableOpacity
                                 onPress={() => {
                                   setNewChatGroupIds((current) => {
                                     const next = new Set(current);
                                     if (next.has(group.id)) {
                                       next.delete(group.id);
                                     } else {
                                       next.add(group.id);
                                     }
                                     return next;
                                   });
                                 }}
                                 activeOpacity={0.7}
                               >
                                 {checked
                                   ? <CheckSquare color="#00A884" size={22} />
                                   : <Square color={appTheme.muted} size={22} />}
                               </TouchableOpacity>
                               <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: group.color || '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                                 <Users color="#FFF" size={22} />
                               </View>
                               <View style={{ flex: 1 }}>
                                 <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 15 }}>{group.name}</Typography>
                                 <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 2 }}>
                                   {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                                 </Typography>
                               </View>
                               <TouchableOpacity
                                 onPress={() => openBroadcastTemplatePicker({ groupIds: [group.id] })}
                                 style={{ padding: 8 }}
                                 activeOpacity={0.7}
                               >
                                 <Send color="#00A884" size={18} />
                               </TouchableOpacity>
                               <TouchableOpacity
                                 onPress={() => void handleDeleteGroup(group)}
                                 style={{ padding: 8 }}
                                 activeOpacity={0.7}
                               >
                                 <Trash2 color={Theme.colors.error} size={18} />
                               </TouchableOpacity>
                             </Reanimated.View>
                           );
                         })
                       )}
                     </View>
                   )}

                   <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 8, marginBottom: 8 }}>
                     <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '600', letterSpacing: 0.5 }}>CONTACTS</Typography>
                     <Typography variant="caption" color={appTheme.muted}>{contactsForNewChat.length}</Typography>
                   </View>
                 </View>
               );

               return (
                 <>
                   <FlatList
                     style={{ flex: 1 }}
                     data={contactsForNewChat}
                     keyExtractor={(conversation) => conversation.id}
                     keyboardShouldPersistTaps="handled"
                     keyboardDismissMode="on-drag"
                     showsVerticalScrollIndicator={false}
                     scrollEventThrottle={16}
                     initialNumToRender={15}
                     maxToRenderPerBatch={12}
                     windowSize={9}
                     removeClippedSubviews={Platform.OS !== 'web'}
                     contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                     ListHeaderComponent={listHeader}
                     ListEmptyComponent={
                       groupsForNewChat.length ? null : (
                         <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                           <Search color={appTheme.disabled} size={26} />
                           <Typography variant="bodySmall" color={appTheme.muted}>{newChatEmptyText}</Typography>
                         </View>
                       )
                     }
                     renderItem={({ item: conversation }) => {
                       const contactChecked = createChatSelectedIds.has(conversation.id);
                       const selectionActive = createChatSelectedIds.size > 0;
                       return (
                         <TouchableOpacity
                           style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, paddingHorizontal: 24, backgroundColor: contactChecked ? (appTheme.darkMode ? 'rgba(0,168,132,0.12)' : 'rgba(0,168,132,0.08)') : 'transparent' }}
                           activeOpacity={0.7}
                           // Tap opens the chat (like frontend-2); tap while selecting — or
                           // long-press — toggles the contact into the selection instead.
                           onPress={() => {
                             if (selectionActive) {
                               toggleCreateChatSelection(conversation.id);
                             } else {
                               void openCreateChatConversation(conversation);
                             }
                           }}
                           onLongPress={() => toggleCreateChatSelection(conversation.id)}
                           delayLongPress={250}
                         >
                           <TouchableOpacity
                             onPress={() => toggleCreateChatSelection(conversation.id)}
                             hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                             activeOpacity={0.7}
                           >
                             {contactChecked
                               ? <CheckSquare color="#00A884" size={22} />
                               : <Square color={appTheme.muted} size={22} />}
                           </TouchableOpacity>
                           <Avatar src={conversation.avatar} fallback={getInitials(conversation.name)} size={44} />
                           <View style={{ flex: 1 }}>
                             <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 15 }} numberOfLines={1}>
                               {conversation.name}
                             </Typography>
                             {conversation.phone ? (
                               <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 2 }} numberOfLines={1}>
                                 {formatPhone(conversation.phone)}
                               </Typography>
                             ) : null}
                           </View>
                           <ChannelGlyph channel={conversation.channel} size={14} />
                         </TouchableOpacity>
                       );
                     }}
                   />

                   {/* Bottom action bar — mirrors frontend-2's New Chat panel:
                       groups selected → Send Broadcast · 1 contact → Open Chat · many → Create Group */}
                   {(newChatGroupIds.size > 0 || createChatSelectedIds.size > 0) && (
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                       <View style={{ flex: 1 }}>
                         <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600' }}>
                           {newChatGroupIds.size > 0
                             ? `${newChatGroupIds.size} group${newChatGroupIds.size === 1 ? '' : 's'} selected`
                             : `${createChatSelectedIds.size} contact${createChatSelectedIds.size === 1 ? '' : 's'} selected`}
                         </Typography>
                       </View>
                       <TouchableOpacity
                         style={{ backgroundColor: '#00A884', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                         activeOpacity={0.8}
                         onPress={() => {
                           if (newChatGroupIds.size > 0) {
                             openBroadcastTemplatePicker({ groupIds: Array.from(newChatGroupIds) });
                             return;
                           }
                           if (createChatSelectedIds.size === 1) {
                             const selected = contactsForNewChat.find((conversation) => createChatSelectedIds.has(conversation.id))
                               ?? createChatContacts.find((conversation) => createChatSelectedIds.has(conversation.id));
                             if (selected) {
                               void openCreateChatConversation(selected);
                             }
                             return;
                           }
                           openCreateGroupModal();
                         }}
                       >
                         {newChatGroupIds.size > 0
                           ? <Send color="#FFF" size={16} />
                           : createChatSelectedIds.size === 1
                             ? <MessageSquare color="#FFF" size={16} />
                             : <Users color="#FFF" size={16} />}
                         <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '600' }}>
                           {newChatGroupIds.size > 0
                             ? 'Send Broadcast'
                             : createChatSelectedIds.size === 1
                               ? 'Open Chat'
                               : 'Create Group'}
                         </Typography>
                       </TouchableOpacity>
                       <TouchableOpacity
                         onPress={() => {
                           setNewChatGroupIds(new Set());
                           setCreateChatSelectedIds(new Set());
                         }}
                         activeOpacity={0.7}
                       >
                         <Typography variant="bodySmall" color={appTheme.muted}>Clear</Typography>
                       </TouchableOpacity>
                     </View>
                   )}
                 </>
               );
             })()}

             {/* ── Create Group modal — name + colour + optional existing groups ── */}
             <Modal visible={createGroupModalOpen} transparent animationType="fade" onRequestClose={() => setCreateGroupModalOpen(false)}>
               <Pressable
                 style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 }}
                 onPress={() => !createGroupSaving && setCreateGroupModalOpen(false)}
               >
                 <Pressable
                   style={{ backgroundColor: appTheme.surface, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: appTheme.borderSoft, ...Theme.shadows.medium }}
                   onPress={() => undefined}
                 >
                   <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                     <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '800' }}>Create Group</Typography>
                     <TouchableOpacity onPress={() => setCreateGroupModalOpen(false)} disabled={createGroupSaving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                       <X color={appTheme.muted} size={20} />
                     </TouchableOpacity>
                   </View>
                   <Typography variant="bodySmall" color={appTheme.muted}>
                     {createChatSelectedIds.size} contact{createChatSelectedIds.size === 1 ? '' : 's'} will be added.
                   </Typography>

                   <TextInput
                     placeholder="Group name"
                     placeholderTextColor={appTheme.disabled}
                     value={createGroupName}
                     onChangeText={setCreateGroupName}
                     editable={!createGroupSaving}
                     style={[WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: appTheme.text, fontSize: 15, borderWidth: 1, borderColor: appTheme.borderSoft }]}
                   />

                   {/* Colour palette — same options as frontend-2 */}
                   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                     {['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#10B981'].map((color) => (
                       <TouchableOpacity
                         key={color}
                         onPress={() => setCreateGroupColor(color)}
                         style={{
                           width: 28,
                           height: 28,
                           borderRadius: 14,
                           backgroundColor: color,
                           borderWidth: createGroupColor === color ? 3 : 0,
                           borderColor: appTheme.darkMode ? '#FFFFFF' : '#0F172A',
                         }}
                         activeOpacity={0.8}
                       />
                     ))}
                   </View>

                   {broadcastGroups.filter((group) => !group.isBroadcastList).length > 0 && (
                     <View style={{ gap: 6 }}>
                       <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '600', letterSpacing: 0.5 }}>
                         OR ADD TO EXISTING GROUPS
                       </Typography>
                       <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                         {broadcastGroups.filter((group) => !group.isBroadcastList).map((group) => {
                           const checked = createGroupExistingIds.has(group.id);
                           return (
                             <TouchableOpacity
                               key={group.id}
                               style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                               activeOpacity={0.7}
                               onPress={() => {
                                 setCreateGroupExistingIds((current) => {
                                   const next = new Set(current);
                                   if (next.has(group.id)) next.delete(group.id);
                                   else next.add(group.id);
                                   return next;
                                 });
                               }}
                             >
                               {checked
                                 ? <CheckSquare color="#00A884" size={20} />
                                 : <Square color={appTheme.muted} size={20} />}
                               <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: group.color || '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                                 <Users color="#FFF" size={14} />
                               </View>
                               <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1 }} numberOfLines={1}>{group.name}</Typography>
                               <Typography variant="caption" color={appTheme.muted}>{group.memberCount}</Typography>
                             </TouchableOpacity>
                           );
                         })}
                       </ScrollView>
                     </View>
                   )}

                   {createGroupError ? (
                     <Typography variant="caption" color={Theme.colors.error}>{createGroupError}</Typography>
                   ) : null}

                   <TouchableOpacity
                     style={{ backgroundColor: '#00A884', borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: createGroupSaving ? 0.6 : 1 }}
                     activeOpacity={0.85}
                     disabled={createGroupSaving}
                     onPress={() => void handleCreateGroupFromSelection()}
                   >
                     {createGroupSaving
                       ? <ActivityIndicator color="#FFF" size="small" />
                       : <Users color="#FFF" size={16} />}
                     <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>
                       {createGroupSaving ? 'Creating…' : 'Create Group'}
                     </Typography>
                   </TouchableOpacity>
                 </Pressable>
               </Pressable>
             </Modal>

             {/* ── Import Leads — Add Leads / Excel Upload / Scrape from URL ── */}
             <ImportLeadsModal
               visible={importLeadsOpen}
               onClose={() => setImportLeadsOpen(false)}
               onImportComplete={() => {
                 void syncConversations({ silent: true, force: true });
                 void fetchBroadcastGroups();
               }}
             />
          </View>
        )}

        {broadcastGroupsScreenOpen && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: appTheme.background, zIndex: 999, elevation: 40 }]}>
             <View style={[styles.subscreenHeader, { paddingTop: Math.max(insets.top, 16) + 14, backgroundColor: appTheme.background }]}>
               <TouchableOpacity
                 onPress={() => {
                   setBroadcastGroupsScreenOpen(false);
                   setGroupSelectMode(false);
                   setSelectedBroadcastGroupIds(new Set());
                   setGroupNotice(null);
                   closeGroupForm();
                 }}
                 activeOpacity={0.7}
                 style={styles.subscreenBackButton}
               >
                 <ArrowLeft color={appTheme.text} size={24} />
               </TouchableOpacity>
               <Typography variant="h2" color={appTheme.text} style={{ fontWeight: '800', flex: 1 }}>Broadcast Groups</Typography>
               <TouchableOpacity onPress={() => void fetchBroadcastGroups()} activeOpacity={0.7} style={styles.subscreenIconButton}>
                 {isLoadingGroups
                   ? <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                   : <RefreshCw color={appTheme.text} size={20} />}
               </TouchableOpacity>
             </View>

             <ScrollView
               style={{ flex: 1 }}
               keyboardShouldPersistTaps="handled"
               keyboardDismissMode="on-drag"
               showsVerticalScrollIndicator={false}
               scrollEventThrottle={16}
               contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
             >
             <View style={{ paddingHorizontal: 24, paddingBottom: 8, paddingTop: 2 }}>
                <View style={[styles.createChatSearchBar, { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft, borderRadius: 24, height: 48 }]}>
                  <Search color={appTheme.disabled} size={17} />
                  <TextInput
                    placeholder="Search groups..."
                    placeholderTextColor={appTheme.disabled}
                    value={groupSearch}
                    onChangeText={setGroupSearch}
                    style={[styles.createChatSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                  />
                </View>

                {!groupFormOpen ? (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14 }}
                    activeOpacity={0.7}
                    onPress={() => openGroupForm()}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: appTheme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Plus color={appTheme.primaryAccent} size={22} />
                    </View>
                    <View>
                      <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 15 }}>New Group</Typography>
                      <Typography variant="caption" color={appTheme.muted}>Create a group to organize conversations</Typography>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: appTheme.borderSoft, backgroundColor: appTheme.softSurface, gap: 10 }}>
                    <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600' }}>
                      {groupFormTarget ? `Edit "${groupFormTarget.name}"` : 'New Group'}
                    </Typography>
                    <TextInput
                      placeholder="Group name"
                      placeholderTextColor={appTheme.disabled}
                      value={groupFormName}
                      onChangeText={setGroupFormName}
                      style={[WEB_INPUT_RESET, { color: appTheme.text, borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 }]}
                    />
                    <TextInput
                      placeholder="Description (optional)"
                      placeholderTextColor={appTheme.disabled}
                      value={groupFormDesc}
                      onChangeText={setGroupFormDesc}
                      style={[WEB_INPUT_RESET, { color: appTheme.text, borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 }]}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '600' }}>Color:</Typography>
                      {GROUP_COLOR_OPTIONS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          onPress={() => setGroupFormColor(color)}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: color,
                            borderWidth: groupFormColor === color ? 2 : 0,
                            borderColor: appTheme.text,
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#00A884', borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: groupFormName.trim() && !groupActionBusy ? 1 : 0.5 }}
                        disabled={!groupFormName.trim() || groupActionBusy}
                        onPress={() => void submitGroupForm()}
                        activeOpacity={0.8}
                      >
                        {groupActionBusy
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : (
                            <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '600' }}>
                              {groupFormTarget ? 'Save' : 'Create Group'}
                            </Typography>
                          )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: appTheme.border, alignItems: 'center' }}
                        onPress={closeGroupForm}
                        activeOpacity={0.8}
                      >
                        <Typography variant="bodySmall" color={appTheme.text}>Cancel</Typography>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {groupNotice ? (
                  <Typography variant="caption" color={appTheme.muted} style={{ marginTop: 4 }}>{groupNotice}</Typography>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
                   <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '600', letterSpacing: 0.5 }}>
                     GROUPS · {filteredBroadcastGroups.length}
                   </Typography>
                   {groupSelectMode ? (
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                       <TouchableOpacity
                         onPress={() => {
                           const allSelected = filteredBroadcastGroups.length > 0 && filteredBroadcastGroups.every((group) => selectedBroadcastGroupIds.has(group.id));
                           setSelectedBroadcastGroupIds(() => allSelected ? new Set() : new Set(filteredBroadcastGroups.map((group) => group.id)));
                         }}
                       >
                         <Typography variant="caption" color={appTheme.primaryAccent}>
                           {filteredBroadcastGroups.length > 0 && filteredBroadcastGroups.every((group) => selectedBroadcastGroupIds.has(group.id)) ? 'Deselect all' : 'Select all'}
                         </Typography>
                       </TouchableOpacity>
                       <TouchableOpacity onPress={() => { setGroupSelectMode(false); setSelectedBroadcastGroupIds(new Set()); }}>
                         <Typography variant="caption" color={appTheme.muted}>Done</Typography>
                       </TouchableOpacity>
                     </View>
                   ) : (
                     <TouchableOpacity onPress={() => setGroupSelectMode(true)}>
                       <Typography variant="caption" color={appTheme.primaryAccent}>Select</Typography>
                     </TouchableOpacity>
                   )}
                </View>
             </View>

             <View style={{ paddingHorizontal: 16 }}>
               {isLoadingGroups ? (
                 <Reanimated.View entering={FadeIn.duration(350)} style={{ width: '100%', gap: 16 }}>
                   <SkeletonConversationRow />
                   <SkeletonConversationRow />
                   <SkeletonConversationRow />
                   <SkeletonConversationRow />
                 </Reanimated.View>
               ) : filteredBroadcastGroups.length === 0 ? (
                 <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                   <Users color={appTheme.disabled} size={30} />
                   <Typography variant="body" color={appTheme.muted}>
                     {groupSearch ? 'No groups found' : 'No groups yet'}
                   </Typography>
                   {!groupSearch && (
                     <TouchableOpacity onPress={() => openGroupForm()}>
                       <Typography variant="bodySmall" color={appTheme.primaryAccent}>Create a group</Typography>
                     </TouchableOpacity>
                   )}
                 </View>
               ) : (
                 filteredBroadcastGroups.map(group => {
                   const checked = selectedBroadcastGroupIds.has(group.id);
                   return (
                     <TouchableOpacity
                       key={group.id}
                       style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}
                       activeOpacity={0.7}
                       onPress={() => {
                         if (groupSelectMode) {
                           setSelectedBroadcastGroupIds((current) => {
                             const next = new Set(current);
                             if (next.has(group.id)) {
                               next.delete(group.id);
                             } else {
                               next.add(group.id);
                             }
                             return next;
                           });
                         } else {
                           openGroupInfo(group);
                         }
                       }}
                     >
                        {groupSelectMode && (
                          checked
                            ? <CheckSquare color="#00A884" size={22} />
                            : <Square color={appTheme.muted} size={22} />
                        )}
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: group.color || '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                           <Users color="#FFF" size={24} />
                        </View>
                        <View style={{ flex: 1 }}>
                           <Typography variant="body" color={appTheme.text} style={{ fontWeight: '500', fontSize: 16 }}>{group.name}</Typography>
                           <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 2 }} numberOfLines={1}>
                             {group.isBroadcastList
                               ? `${group.memberGroupCount ?? 0} group${(group.memberGroupCount ?? 0) === 1 ? '' : 's'}`
                               : `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`}
                             {group.description ? ` · ${group.description}` : ''}
                           </Typography>
                        </View>
                        {!groupSelectMode && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => openGroupInfo(group)} style={{ padding: 7 }} activeOpacity={0.7}>
                              <Info color={appTheme.primaryAccent} size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openBroadcastTemplatePicker({ groupIds: [group.id] })}
                              style={{ padding: 7 }}
                              activeOpacity={0.7}
                            >
                              <Send color="#00A884" size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openGroupForm(group)} style={{ padding: 7 }} activeOpacity={0.7}>
                              <Pencil color={appTheme.muted} size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => void handleDeleteGroup(group)} style={{ padding: 7 }} activeOpacity={0.7}>
                              <Trash2 color={Theme.colors.error} size={18} />
                            </TouchableOpacity>
                          </View>
                        )}
                     </TouchableOpacity>
                   );
                 })
               )}
             </View>
             </ScrollView>

             {groupSelectMode && selectedBroadcastGroupIds.size > 0 && (
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                 <View style={{ flex: 1 }}>
                   <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600' }}>
                     {selectedBroadcastGroupIds.size} group{selectedBroadcastGroupIds.size === 1 ? '' : 's'} selected
                   </Typography>
                   <Typography variant="caption" color={appTheme.muted}>
                     {broadcastGroups
                       .filter((group) => selectedBroadcastGroupIds.has(group.id))
                       .reduce((total, group) => total + group.memberCount, 0)} total recipients
                   </Typography>
                 </View>
                 <TouchableOpacity
                   style={{ backgroundColor: '#00A884', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                   activeOpacity={0.8}
                   onPress={() => openBroadcastTemplatePicker({ groupIds: Array.from(selectedBroadcastGroupIds) })}
                 >
                   <Send color="#FFF" size={16} />
                   <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '600' }}>Send Template</Typography>
                 </TouchableOpacity>
               </View>
             )}
          </View>
        )}

        {createChatNotice ? (
          <View style={[styles.createChatNotice, { backgroundColor: appTheme.softSurface, borderColor: appTheme.borderSoft }]}>
            <Typography variant="caption" color={appTheme.muted}>{createChatNotice}</Typography>
          </View>
        ) : null}

        {!isEmailGroupFolder && (
        <Reanimated.View entering={FadeInDown.delay(80).duration(380).springify()} style={[styles.filterRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 900 }]}>
          <View style={styles.filterDropdownWrap}>
            <TouchableOpacity
              style={[styles.filterDropdownButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
              onPress={() => {
                closeCreateChatMenu();
                setFilterDropdownOpen((value) => !value);
              }}
              activeOpacity={0.78}
            >
              {isEmailTabActive ? (
                <ProviderLogo provider={emailTabProviderId} size={20} />
              ) : (activeFilterOption.id === 'personal' || activeFilterOption.id === 'waba' || activeFilterOption.id === 'email') ? (
                <ChannelBrandLogo id={activeFilterOption.id} size={20} />
              ) : (
                <View style={[styles.filterSelectedDot, { backgroundColor: activeFilterOption.color }]} />
              )}
              <Typography
                variant="bodySmall"
                style={[styles.filterSelectedText, { color: isEmailTabActive ? emailTabMeta.color : activeFilterOption.color, fontWeight: '700' }]}
                numberOfLines={1}
              >
                {activeFilterOption.label}
              </Typography>
              <ChevronDown
                color={isEmailTabActive ? emailTabMeta.color : appTheme.muted}
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
                    {(channel.id === 'personal' || channel.id === 'waba' || channel.id === 'gmail' || channel.id === 'outlook' || channel.id === 'linkedin' || channel.id === 'email') ? (
                      <ChannelBrandLogo id={channel.id} size={18} />
                    ) : (
                      <View style={[styles.filterOptionDot, { backgroundColor: channel.color }]} />
                    )}
                    <Typography variant="bodySmall" style={[styles.filterDropdownText, { color: appTheme.text }]}>
                      {channel.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>
          {(activeFilter === 'waba' || activeFilter === 'whatsapp') && (
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => {
                    setBroadcastGroupsScreenOpen(true);
                    void fetchBroadcastGroups();
                  }}
                  activeOpacity={0.75}
                >
                  <Users color={appTheme.text} size={20} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => void syncConversations({ force: true })} activeOpacity={0.75}>
                  {isLoadingConversations || isSyncing ? (
                    <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                  ) : (
                    <RefreshCw color={appTheme.text} size={20} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconBtn}
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
                  activeOpacity={0.75}
                >
                  <MessageSquarePlus color={appTheme.text} size={20} />
                </TouchableOpacity>
                <View>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => setMoreOptionsOpen(true)} activeOpacity={0.75}>
                    <MoreVertical color={appTheme.text} size={20} />
                  </TouchableOpacity>
                </View>
             </View>
          )}
          {isEmailTabActive && !isEmailGroupFolder && (
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {emailFolder !== 'inbox' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${emailTabMeta.color}18` }}
                    onPress={() => setEmailFolder('inbox')}
                    activeOpacity={0.75}
                  >
                    <Typography variant="caption" style={{ color: emailTabMeta.color, fontWeight: '700', textTransform: 'capitalize' }}>
                      {emailFolder}
                    </Typography>
                    <X color={emailTabMeta.color} size={12} />
                  </TouchableOpacity>
                )}
                {/* Circular refresh icon matching the reference design */}
                <TouchableOpacity
                  onPress={() => void syncConversations({ force: true })}
                  activeOpacity={0.75}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: appTheme.input,
                    borderWidth: 1,
                    borderColor: appTheme.borderSoft,
                  }}
                >
                  {isLoadingConversations || isSyncing ? (
                    <ActivityIndicator color={emailTabMeta.color} size="small" />
                  ) : (
                    <RefreshCw color={appTheme.muted} size={18} />
                  )}
                </TouchableOpacity>
             </View>
          )}
        </Reanimated.View>
        )}
        
        <Modal visible={filterSidebarOpen} transparent animationType="fade" onRequestClose={() => setFilterSidebarOpen(false)}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.38)' }]}
              onPress={() => setFilterSidebarOpen(false)}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: Math.min(width * 0.86, 340),
                backgroundColor: appTheme.surface,
                borderLeftWidth: 1,
                borderLeftColor: appTheme.borderSoft,
                paddingTop: Math.max(insets.top, 16) + 14,
                paddingBottom: Math.max(insets.bottom, 16),
                shadowColor: '#000',
                shadowOffset: { width: -6, height: 0 },
                shadowOpacity: 0.16,
                shadowRadius: 18,
                elevation: 18,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <SlidersHorizontal color={appTheme.primaryAccent} size={19} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '800', fontSize: 16 }}>Filters</Typography>
                  <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                    {focusedConversationCount} focused · {liveConversationCount} total
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setFilterSidebarOpen(false)} style={{ padding: 6 }} activeOpacity={0.7}>
                  <X color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, gap: 18 }}>
                {showWhatsAppChannelFilters ? (
                  <>
                    <View style={{ gap: 8 }}>
                      <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800', textTransform: 'uppercase' }}>WhatsApp</Typography>
                      {([
                        { id: 'all' as const, label: 'All chats', icon: MessageCircle },
                        { id: 'unread' as const, label: `Unread${whatsAppUnreadCount ? ` ${whatsAppUnreadCount}` : ''}`, icon: Clock },
                      ]).map((option) => {
                        const active = whatsAppListFilter === option.id;
                        const Icon = option.icon;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            onPress={() => {
                              setWhatsAppListFilter(option.id);
                              setFilterSidebarOpen(false);
                            }}
                            activeOpacity={0.75}
                            style={[styles.filterSheetOption, { backgroundColor: active ? '#00A88418' : appTheme.input, borderColor: active ? '#00A884' : appTheme.borderSoft }]}
                          >
                            <Icon color={active ? '#00A884' : appTheme.muted} size={18} />
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.filterSheetOptionText}>{option.label}</Typography>
                            {active ? <Check color="#00A884" size={17} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        onPress={() => setWhatsAppHideEmpty((value) => !value)}
                        activeOpacity={0.75}
                        style={[styles.filterSheetOption, { backgroundColor: appTheme.darkMode ? (whatsAppHideEmpty ? appTheme.labelBackgroundActive : appTheme.labelBackground) : whatsAppHideEmpty ? '#00A88418' : appTheme.input, borderColor: appTheme.darkMode ? appTheme.labelBorder : whatsAppHideEmpty ? '#00A884' : appTheme.borderSoft }]}
                      >
                        {whatsAppHideEmpty ? <EyeOff color="#00A884" size={18} /> : <Eye color={appTheme.muted} size={18} />}
                        <Typography variant="bodySmall" color={appTheme.text} style={styles.filterSheetOptionText}>
                          {whatsAppHideEmpty ? 'Hiding empty' : 'Hide empty'}
                        </Typography>
                        {whatsAppHideEmpty ? <Check color="#00A884" size={17} /> : null}
                      </TouchableOpacity>
                    </View>

                    <View style={{ gap: 8 }}>
                      <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800', textTransform: 'uppercase' }}>Stage</Typography>
                      <TouchableOpacity
                        onPress={() => {
                          setWhatsAppStageFilter('all');
                          setFilterSidebarOpen(false);
                        }}
                        activeOpacity={0.75}
                        style={[styles.filterSheetOption, { backgroundColor: appTheme.darkMode ? (whatsAppStageFilter === 'all' ? appTheme.labelBackgroundActive : appTheme.labelBackground) : whatsAppStageFilter === 'all' ? '#00A88418' : appTheme.input, borderColor: appTheme.darkMode ? appTheme.labelBorder : whatsAppStageFilter === 'all' ? '#00A884' : appTheme.borderSoft }]}
                      >
                        <Tag color={whatsAppStageFilter === 'all' ? '#00A884' : appTheme.muted} size={18} />
                        <Typography variant="bodySmall" color={appTheme.text} style={styles.filterSheetOptionText}>All stages</Typography>
                        {whatsAppStageFilter === 'all' ? <Check color="#00A884" size={17} /> : null}
                      </TouchableOpacity>
                      {whatsAppStageOptions.map((stage) => {
                        const active = whatsAppStageFilter === stage.value;
                        const stageColor = WABA_STAGE_COLORS[stage.value.toLowerCase()] ?? WABA_STAGE_DEFAULT;
                        return (
                          <TouchableOpacity
                            key={stage.value}
                            onPress={() => {
                              setWhatsAppStageFilter(stage.value);
                              setFilterSidebarOpen(false);
                            }}
                            activeOpacity={0.75}
                            style={[styles.filterSheetOption, { backgroundColor: appTheme.darkMode ? (active ? appTheme.labelBackgroundActive : appTheme.labelBackground) : active ? `${stageColor}18` : appTheme.input, borderColor: appTheme.darkMode ? appTheme.labelBorder : active ? stageColor : appTheme.borderSoft }]}
                          >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: stageColor }} />
                            <Typography variant="bodySmall" color={appTheme.text} style={styles.filterSheetOptionText}>{stage.label}</Typography>
                            <Typography variant="caption" color={appTheme.muted}>{stage.count}</Typography>
                            {active ? <Check color={stageColor} size={17} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {showLinkedInChannelFilters ? (
                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800', textTransform: 'uppercase' }}>LinkedIn status</Typography>
                    {([
                      { id: 'all' as const, label: `All ${linkedInStatusCounts.all}`, icon: Users, color: '#0A66C2' },
                      { id: 'pending' as const, label: `${linkedInStatusCounts.pending} pending`, icon: Clock, color: '#F59E0B' },
                      { id: 'accepted' as const, label: `${linkedInStatusCounts.accepted} connected`, icon: CircleCheck, color: '#10B981' },
                      { id: 'active' as const, label: `${linkedInStatusCounts.active} active`, icon: Zap, color: '#22C55E' },
                    ]).map((option) => {
                      const active = linkedInStatusFilter === option.id;
                      const Icon = option.icon;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          onPress={() => {
                            setLinkedInStatusFilter(option.id);
                            setFilterSidebarOpen(false);
                          }}
                          activeOpacity={0.75}
                          style={[styles.filterSheetOption, { backgroundColor: active ? `${option.color}18` : appTheme.input, borderColor: active ? option.color : appTheme.borderSoft }]}
                        >
                          <Icon color={active ? option.color : appTheme.muted} size={18} />
                          <Typography variant="bodySmall" color={appTheme.text} style={styles.filterSheetOptionText}>{option.label}</Typography>
                          {active ? <Check color={option.color} size={17} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {isEmailTabActive ? (
                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800', textTransform: 'uppercase' }}>Mail folders</Typography>
                    {[
                      { id: 'inbox', label: 'Inbox', icon: Inbox },
                      { id: 'starred', label: 'Starred', icon: Star },
                      { id: 'sent', label: 'Sent', icon: Send },
                      { id: 'drafts', label: 'Drafts', icon: FileText },
                      { id: 'spam', label: 'Spam', icon: AlertTriangle },
                      { id: 'trash', label: 'Trash', icon: Trash2 },
                    ].map((folder) => {
                      const active = emailFolder === folder.id;
                      return (
                        <TouchableOpacity
                          key={folder.id}
                          onPress={() => {
                            selectEmailFolder(folder.id);
                            setFilterSidebarOpen(false);
                          }}
                          activeOpacity={0.75}
                          style={{
                            minHeight: 42,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            backgroundColor: active ? `${emailTabMeta.color}14` : 'transparent',
                          }}
                        >
                          <folder.icon color={active ? emailTabMeta.color : appTheme.muted} size={18} />
                          <Typography variant="bodySmall" color={active ? emailTabMeta.color : appTheme.text} style={{ flex: 1, fontWeight: active ? '800' : '600' }}>
                            {folder.label}
                          </Typography>
                          {active ? <Check color={emailTabMeta.color} size={16} /> : null}
                        </TouchableOpacity>
                      );
                    })}

                    {emailCommsGroups.length ? (
                      <View style={{ gap: 6, paddingTop: 6 }}>
                        <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800', textTransform: 'uppercase' }}>Broadcast groups</Typography>
                        {emailCommsGroups.map((group) => {
                          const folderId = `group:${group.id}`;
                          const active = emailFolder === folderId;
                          return (
                            <TouchableOpacity
                              key={group.id}
                              onPress={() => {
                                selectEmailFolder(folderId);
                                setFilterSidebarOpen(false);
                              }}
                              activeOpacity={0.75}
                              style={{
                                minHeight: 40,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                backgroundColor: active ? `${emailTabMeta.color}14` : 'transparent',
                              }}
                            >
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: group.color || emailTabMeta.color }} />
                              <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1, fontWeight: active ? '800' : '600' }} numberOfLines={1}>
                                {group.name}
                              </Typography>
                              <Typography variant="caption" color={appTheme.muted}>{group.memberCount}</Typography>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setWhatsAppListFilter('all');
                    setWhatsAppHideEmpty(false);
                    setWhatsAppStageFilter('all');
                    setLinkedInStatusFilter('all');
                    setEmailFolder('inbox');
                    setFilterSidebarOpen(false);
                  }}
                  activeOpacity={0.75}
                  style={{ minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: appTheme.softSurface }}
                >
                  <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '800' }}>Clear filters</Typography>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={moreOptionsOpen} transparent={true} animationType="fade" onRequestClose={() => setMoreOptionsOpen(false)}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMoreOptionsOpen(false)} activeOpacity={1}>
            <View style={[styles.moreOptionsMenu, { backgroundColor: appTheme.surface, borderColor: appTheme.border, top: 130, right: 16 }]}>
              {([
                {
                  label: 'Broadcast group',
                  icon: Users,
                  onPress: () => {
                    setBroadcastGroupsScreenOpen(true);
                    void fetchBroadcastGroups();
                  },
                },
                { label: 'Starred messages', icon: Star, onPress: openStarredOverlay },
                { label: 'Select chats', icon: CheckSquare, onPress: () => setListSelectMode(true) },
                { label: 'Mark all as read', icon: CheckCheck, onPress: handleMarkAllRead },
                { label: 'Message settings', icon: Clock, onPress: openMessageSettings },
              ] as { label: string; icon: typeof Users; onPress: () => void }[]).map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.moreOptionsMenuItem, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                  onPress={() => {
                    setMoreOptionsOpen(false);
                    item.onPress();
                  }}
                >
                  <item.icon color={appTheme.muted} size={17} />
                  <Typography variant="body" color={appTheme.text}>{item.label}</Typography>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Add selected chats to a group (mirrors AddToGroupDropdown) ── */}
        <Modal visible={addToGroupOpen} transparent={true} animationType="fade" onRequestClose={() => setAddToGroupOpen(false)}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }]} onPress={() => setAddToGroupOpen(false)} activeOpacity={1}>
            <View style={{ backgroundColor: appTheme.surface, borderRadius: 16, maxHeight: 420, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600' }}>Add to Group</Typography>
                <TouchableOpacity onPress={() => setAddToGroupOpen(false)}>
                  <X color={appTheme.muted} size={18} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {broadcastGroups.length === 0 ? (
                  <Typography variant="bodySmall" color={appTheme.muted} style={{ padding: 20, textAlign: 'center' }}>
                    No groups. Create one first.
                  </Typography>
                ) : (
                  broadcastGroups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
                      onPress={() => void handleAddSelectedToGroup(group)}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: group.color || '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                        <Users color="#FFF" size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '500' }}>{group.name}</Typography>
                        <Typography variant="caption" color={appTheme.muted}>{group.memberCount} members</Typography>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Starred messages overlay (mirrors StarredMessagesDialog) ── */}
        <Modal visible={starredOpen} transparent={true} animationType="fade" onRequestClose={() => setStarredOpen(false)}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }]} onPress={() => setStarredOpen(false)} activeOpacity={1}>
            <View style={{ backgroundColor: appTheme.surface, borderRadius: 16, maxHeight: 480, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <Star color="#F59E0B" size={18} />
                <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600', flex: 1 }}>Starred messages</Typography>
                <TouchableOpacity onPress={() => setStarredOpen(false)}>
                  <X color={appTheme.muted} size={18} />
                </TouchableOpacity>
              </View>
              {starredLoading ? (
                <ActivityIndicator color={appTheme.primaryAccent} style={{ paddingVertical: 32 }} />
              ) : starredList.length === 0 ? (
                <Typography variant="bodySmall" color={appTheme.muted} style={{ padding: 24, textAlign: 'center' }}>
                  No starred messages yet.
                </Typography>
              ) : (
                <ScrollView>
                  {starredList.map((row) => (
                    <TouchableOpacity
                      key={row.id}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}
                      onPress={() => openStarredConversation(row)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {row.conversationName || row.senderName || 'Conversation'}
                        </Typography>
                        {row.createdAt ? (
                          <Typography variant="caption" color={appTheme.muted}>{formatTime(row.createdAt)}</Typography>
                        ) : null}
                      </View>
                      <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 2 }} numberOfLines={2}>
                        {row.content}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Message settings (mirrors MessageSettings' AI reply delay) ── */}
        <Modal visible={messageSettingsOpen} transparent={true} animationType="fade" onRequestClose={() => setMessageSettingsOpen(false)}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }]} onPress={() => setMessageSettingsOpen(false)} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: appTheme.surface, borderRadius: 16, borderWidth: 1, borderColor: appTheme.border, padding: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Clock color={appTheme.primaryAccent} size={18} />
                <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600', flex: 1 }}>Message settings</Typography>
                <TouchableOpacity onPress={() => setMessageSettingsOpen(false)}>
                  <X color={appTheme.muted} size={18} />
                </TouchableOpacity>
              </View>
              <Typography variant="bodySmall" color={appTheme.muted}>
                AI reply delay — how long Mr LAD waits after an inbound message before replying, so rapid messages are answered together.
              </Typography>
              {inboundDebounce === null ? (
                <ActivityIndicator color={appTheme.primaryAccent} style={{ paddingVertical: 8 }} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {[0, 15, 30, 60, 120, 300].map((seconds) => (
                    <TouchableOpacity
                      key={seconds}
                      onPress={() => void saveInboundDebounce(seconds)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: inboundDebounce === seconds ? '#00A884' : appTheme.border,
                        backgroundColor: inboundDebounce === seconds ? 'rgba(0,168,132,0.12)' : 'transparent',
                      }}
                      activeOpacity={0.7}
                    >
                      <Typography variant="bodySmall" color={inboundDebounce === seconds ? '#00A884' : appTheme.text}>
                        {seconds === 0 ? 'Instant' : seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {inboundDebounceSaving ? (
                <Typography variant="caption" color={appTheme.muted}>Saving…</Typography>
              ) : inboundDebounceError ? (
                <Typography variant="caption" color={Theme.colors.error}>{inboundDebounceError}</Typography>
              ) : null}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── Group info (mirrors GroupInfoModal) ── */}
        <Modal visible={Boolean(groupInfoTarget)} transparent={true} animationType="fade" onRequestClose={() => setGroupInfoTarget(null)}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }]} onPress={() => setGroupInfoTarget(null)} activeOpacity={1}>
            <View style={{ backgroundColor: appTheme.surface, borderRadius: 16, maxHeight: 480, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: groupInfoTarget?.color || '#00A884', alignItems: 'center', justifyContent: 'center' }}>
                  <Users color="#FFF" size={17} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600' }}>{groupInfoTarget?.name}</Typography>
                  <Typography variant="caption" color={appTheme.muted}>
                    {groupInfoLoading ? 'Loading…' : `${groupInfoMembers.length} member${groupInfoMembers.length === 1 ? '' : 's'}`}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setGroupInfoTarget(null)}>
                  <X color={appTheme.muted} size={18} />
                </TouchableOpacity>
              </View>
              {groupInfoLoading ? (
                <ActivityIndicator color={appTheme.primaryAccent} style={{ paddingVertical: 32 }} />
              ) : groupInfoMembers.length === 0 ? (
                <Typography variant="bodySmall" color={appTheme.muted} style={{ padding: 24, textAlign: 'center' }}>
                  No members in this group.
                </Typography>
              ) : (
                <ScrollView>
                  {groupInfoMembers.map((member) => (
                    <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                      <Avatar fallback={getInitials(member.name || member.phone || '?')} size={34} />
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '500' }} numberOfLines={1}>
                          {member.name || member.phone || 'Unknown'}
                        </Typography>
                        {member.name && member.phone ? (
                          <Typography variant="caption" color={appTheme.muted}>{formatPhone(member.phone)}</Typography>
                        ) : null}
                      </View>
                      <TouchableOpacity onPress={() => void handleRemoveGroupMember(member.id)} style={{ padding: 6 }}>
                        <X color={Theme.colors.error} size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Broadcast template picker (mirrors TemplatePicker for group/bulk send) ── */}
        <Modal visible={Boolean(broadcastTemplateTarget)} transparent={true} animationType="fade" onRequestClose={() => setBroadcastTemplateTarget(null)}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }]} onPress={() => setBroadcastTemplateTarget(null)} activeOpacity={1}>
            <View style={{ backgroundColor: appTheme.surface, borderRadius: 16, maxHeight: 520, overflow: 'hidden', borderWidth: 1, borderColor: appTheme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <Megaphone color="#00A884" size={18} />
                <View style={{ flex: 1 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '600' }}>Send Template</Typography>
                  <Typography variant="caption" color={appTheme.muted}>
                    {broadcastTemplateTarget?.groupIds?.length
                      ? `To ${broadcastTemplateTarget.groupIds.length} group${broadcastTemplateTarget.groupIds.length === 1 ? '' : 's'}`
                      : `To ${broadcastTemplateTarget?.conversationIds?.length ?? 0} chat${(broadcastTemplateTarget?.conversationIds?.length ?? 0) === 1 ? '' : 's'}`}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setBroadcastTemplateTarget(null)}>
                  <X color={appTheme.muted} size={18} />
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <View style={[styles.createChatSearchBar, { backgroundColor: appTheme.input, borderColor: appTheme.borderSoft }]}>
                  <Search color={appTheme.disabled} size={15} />
                  <TextInput
                    placeholder="Search templates"
                    placeholderTextColor={appTheme.disabled}
                    value={templateSearch}
                    onChangeText={setTemplateSearch}
                    style={[styles.createChatSearchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
                  />
                </View>
              </View>
              {templatesLoading ? (
                <ActivityIndicator color={appTheme.primaryAccent} style={{ paddingVertical: 28 }} />
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {chatTemplates
                    .filter((template) => {
                      const query = templateSearch.trim().toLowerCase();
                      return !query || `${template.name} ${template.body}`.toLowerCase().includes(query);
                    })
                    .map((template) => (
                      <TouchableOpacity
                        key={template.id}
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}
                        onPress={() => void handleSendBroadcastTemplate(template)}
                        disabled={broadcastTemplateSending}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                            {template.name}
                          </Typography>
                          {template.language ? (
                            <Typography variant="caption" color={appTheme.muted}>{template.language}</Typography>
                          ) : null}
                        </View>
                        <Typography variant="caption" color={appTheme.muted} style={{ marginTop: 2 }} numberOfLines={2}>
                          {template.body}
                        </Typography>
                      </TouchableOpacity>
                    ))}
                  {!chatTemplates.length && (
                    <Typography variant="bodySmall" color={appTheme.muted} style={{ padding: 24, textAlign: 'center' }}>
                      {templatesError || 'No templates available.'}
                    </Typography>
                  )}
                </ScrollView>
              )}
              {broadcastTemplateSending && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: appTheme.borderSoft }}>
                  <ActivityIndicator color="#00A884" size="small" />
                  <Typography variant="caption" color={appTheme.muted}>Sending…</Typography>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {!isEmailGroupFolder && (
        <Reanimated.View entering={FadeInDown.delay(140).duration(380).springify()} style={[styles.searchBar, { backgroundColor: appTheme.input, borderColor: appTheme.border, borderWidth: 1 }]}>
          <Search color={appTheme.disabled} size={20} />
          <TextInput
            placeholder="Search conversations"
            placeholderTextColor={appTheme.disabled}
            style={[styles.searchInput, WEB_INPUT_RESET, { color: appTheme.text }]}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            onPress={() => {
              closeCreateChatMenu();
              setFilterDropdownOpen(false);
              if (isEmailTabActive) {
                loadEmailCommsGroups();
              }
              setFilterSidebarOpen(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <SlidersHorizontal color={appTheme.muted} size={19} />
          </TouchableOpacity>
        </Reanimated.View>
        )}

        {!isEmailGroupFolder && listSelectMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Theme.spacing.xl, paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <CheckSquare color="#00A884" size={18} />
              <Typography
                variant="bodySmall"
                color={appTheme.text}
                numberOfLines={1}
                style={{ minWidth: 76, fontWeight: '600' }}
              >
                {selectedChatIds.size} selected
              </Typography>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', gap: 10, paddingRight: 2 }}
              style={{ flex: 1 }}
            >
              <TouchableOpacity
                onPress={() => {
                  const allIds = filteredConversations.map((conversation) => conversation.id);
                  const allSelected = allIds.length > 0 && allIds.every((id) => selectedChatIds.has(id));
                  setSelectedChatIds(allSelected ? new Set() : new Set(allIds));
                }}
                style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }}
              >
                <Typography variant="caption" color={appTheme.primaryAccent} numberOfLines={1} style={{ fontWeight: '700' }}>
                  {filteredConversations.length > 0 && filteredConversations.every((conversation) => selectedChatIds.has(conversation.id))
                    ? 'Deselect all'
                    : 'Select all'}
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddToGroupOpen(true)}
                disabled={!selectedChatIds.size}
                style={{ padding: 6, opacity: selectedChatIds.size ? 1 : 0.4 }}
                activeOpacity={0.7}
              >
                <Users color="#8B5CF6" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openBroadcastTemplatePicker({ conversationIds: Array.from(selectedChatIds) })}
                disabled={!selectedChatIds.size}
                style={{ padding: 6, opacity: selectedChatIds.size ? 1 : 0.4 }}
                activeOpacity={0.7}
              >
                <Send color="#2563EB" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleBulkResolve()}
                disabled={!selectedChatIds.size}
                style={{ padding: 6, opacity: selectedChatIds.size ? 1 : 0.4 }}
                activeOpacity={0.7}
              >
                <CircleCheck color="#16A34A" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleBulkDelete()}
                disabled={!selectedChatIds.size}
                style={{ padding: 6, opacity: selectedChatIds.size ? 1 : 0.4 }}
                activeOpacity={0.7}
              >
                <Trash2 color={Theme.colors.error} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={exitListSelectMode} style={{ padding: 6 }} activeOpacity={0.7}>
                <X color={appTheme.muted} size={18} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {!isEmailGroupFolder && visibleListError && !visibleListError.includes('Personal WhatsApp') && !showNoConnectionListError && (
          <View style={styles.errorStrip}>
            <Typography variant="bodySmall" color={Theme.colors.error}>
              {visibleListError}
            </Typography>
          </View>
        )}

        <View style={{ flex: 1 }}>
        {isEmailTabActive && emailFolder !== 'inbox' && emailFolder !== 'starred' ? (
          <Reanimated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
            {emailFolder === 'sent' ? (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                  <Typography variant="caption" color={appTheme.muted}>
                    {sentRunsLoading
                      ? 'Loading...'
                      : sentRuns.length === 0
                        ? 'No broadcasts yet'
                        : `${sentRuns.length} broadcast${sentRuns.length === 1 ? '' : 's'}`}
                  </Typography>
                  <TouchableOpacity
                    onPress={() => void openSentBroadcastComposer()}
                    activeOpacity={0.82}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: emailTabMeta.color, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Pencil color="#FFF" size={14} />
                    <Typography variant="caption" color="#FFF" style={{ fontWeight: '800' }}>New Broadcast</Typography>
                  </TouchableOpacity>
                </View>
                {sentRunsLoading ? (
                  <ActivityIndicator color={emailTabMeta.color} style={{ marginTop: 40 }} />
                ) : sentRuns.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 }}>
                    <Send color={appTheme.disabled} size={30} />
                    <Typography variant="body" color={appTheme.muted}>No sent broadcasts yet</Typography>
                    <Typography variant="caption" color={appTheme.disabled} style={{ textAlign: 'center' }}>
                      Compose a new broadcast to send the same message to many recipients.
                    </Typography>
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
                    {sentRuns.map((run) => {
                       const statusColor = run.status === 'completed' ? '#188038' : run.status === 'failed' ? '#D93025' : '#F9AB00';
                       return (
                         <TouchableOpacity
                           key={run.id}
                           onPress={() => openSentRun(run)}
                           activeOpacity={0.75}
                           style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}
                         >
                           <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${emailTabMeta.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                             <Send color={emailTabMeta.color} size={17} />
                           </View>
                           <View style={{ flex: 1, minWidth: 0 }}>
                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                               <Typography variant="body" style={{ flex: 1, fontWeight: '600', color: appTheme.text, fontSize: 15 }} numberOfLines={1}>
                                 {run.subject}
                               </Typography>
                               <Typography variant="caption" color={appTheme.muted}>{formatTime(run.createdAt)}</Typography>
                             </View>
                             <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                               To {run.recipientCount} recipient{run.recipientCount === 1 ? '' : 's'} · from {run.fromEmail}
                             </Typography>
                             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${statusColor}1A`, borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }}>
                                 <Typography variant="caption" style={{ color: statusColor, fontWeight: '700', fontSize: 10, textTransform: 'capitalize' }}>
                                   {run.status.replace(/_/g, ' ')}
                                 </Typography>
                               </View>
                               <Typography variant="caption" color={appTheme.disabled}>
                                 {run.sentCount} sent{run.failedCount ? ` · ${run.failedCount} failed` : ''}
                               </Typography>
                             </View>
                           </View>
                         </TouchableOpacity>
                       );
                     })}
                   </ScrollView>
                 )}
               </View>
             ) : emailFolder.startsWith('group:') ? (
              (() => {
                const MEMBER_COLORS = ['#7C3AED', '#EA580C', '#DB2777', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#EF4444'];
                const channelName = emailGroupDetail?.channel === 'outlook' ? 'Outlook' : 'Gmail';
                const memberCount = emailGroupDetail?.members.length ?? emailGroupDetail?.memberCount ?? 0;
                const memberQuery = emailMemberSearch.trim().toLowerCase();
                const visibleMembers = (emailGroupDetail?.members ?? []).filter((m) =>
                  !memberQuery ||
                  (m.contactName || '').toLowerCase().includes(memberQuery) ||
                  m.email.toLowerCase().includes(memberQuery),
                );
                const groupInitial = (emailGroupDetail?.name || '?').trim().charAt(0).toUpperCase() || '?';

                return (
                  <View style={{ flex: 1, backgroundColor: appTheme.darkMode ? appTheme.background : '#F0F4FF', marginHorizontal: -16, marginTop: -Math.max(insets.top, 16) - 16 }}>
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
                    >
                      {/* ─── Animated Header (scrolls with content) ─── */}
                      <View style={{ overflow: 'hidden', paddingTop: Math.max(insets.top, 16) + Math.max(insets.top, 16) + 18, paddingHorizontal: 16, paddingBottom: 36 }}>
                        <AnimatedDotsBackground width={width} darkMode={appTheme.darkMode} />

                        {/* Nav row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                          <TouchableOpacity
                            onPress={() => selectEmailFolder('inbox')}
                            activeOpacity={0.85}
                            style={{ height: 42, borderRadius: 13, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 14, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 }}
                          >
                            <ArrowLeft color={appTheme.darkMode ? '#fff' : '#1E293B'} size={20} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void openEmailGroupTemplatePicker()}
                            activeOpacity={0.85}
                            style={{ height: 42, borderRadius: 13, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 14, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 }}
                          >
                            <Send color="#fff" size={16} />
                            <Typography variant="caption" color="#fff" style={{ fontWeight: '800' }}>Send</Typography>
                          </TouchableOpacity>
                        </View>

                        {/* Avatar + identity */}
                        <View style={{ alignItems: 'center', gap: 16, paddingHorizontal: 10 }}>
                          <View style={{ position: 'relative' }}>
                            <View style={{ width: 94, height: 94, borderRadius: 47, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10, borderWidth: 3, borderColor: '#fff' }}>
                              <Typography variant="body" color="#fff" style={{ fontWeight: '900', fontSize: 34, lineHeight: 40 }}>{groupInitial}</Typography>
                            </View>
                            <View style={{ position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                              <Check color="#fff" size={13} strokeWidth={3} />
                            </View>
                          </View>
                          <Typography
                            variant="body"
                            color={appTheme.darkMode ? '#fff' : '#0F172A'}
                            style={{ fontWeight: '800', fontSize: 22, lineHeight: 30, textAlign: 'center', letterSpacing: 0, maxWidth: '92%' }}
                            numberOfLines={2}
                          >
                            {emailGroupDetail?.name || 'Loading...'}
                          </Typography>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: appTheme.darkMode ? 'rgba(37,99,235,0.25)' : '#EEF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: appTheme.darkMode ? 'rgba(99,102,241,0.4)' : '#C7D2FE' }}>
                              <Mail color="#4F46E5" size={12} strokeWidth={2.5} />
                              <Typography variant="caption" style={{ color: '#4F46E5', fontWeight: '700', fontSize: 12 }}>{channelName} broadcast</Typography>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* ─── Below header content ─── */}
                      {emailGroupLoading ? (
                        <ActivityIndicator color="#2563EB" style={{ marginTop: 48 }} />
                      ) : (
                        <>
                          {/* Stat Cards */}
                          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>
                            {[
                              { icon: <Users color="#6366F1" size={22} strokeWidth={1.8} />, iconBg: appTheme.darkMode ? 'rgba(99,102,241,0.2)' : '#EEF2FF', value: String(memberCount), label: 'Members' },
                              { icon: <Mail color="#2563EB" size={22} strokeWidth={1.8} />, iconBg: appTheme.darkMode ? 'rgba(37,99,235,0.2)' : '#EEF2FF', value: channelName, label: 'Channel' },
                              { icon: <Check color="#10B981" size={22} strokeWidth={2.5} />, iconBg: appTheme.darkMode ? 'rgba(16,185,129,0.2)' : '#ECFDF5', value: 'Active', label: 'Status' },
                            ].map((card, ci) => (
                              <View key={ci} style={{ flex: 1, borderRadius: 20, paddingVertical: 20, paddingHorizontal: 8, backgroundColor: appTheme.darkMode ? '#1E2340' : '#fff', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: appTheme.darkMode ? 0.3 : 0.06, shadowRadius: 8, elevation: 3 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: card.iconBg, alignItems: 'center', justifyContent: 'center' }}>{card.icon}</View>
                                <Typography variant="body" color={appTheme.darkMode ? '#fff' : '#0F172A'} style={{ fontWeight: '800', fontSize: ci === 0 ? 22 : 16 }}>{card.value}</Typography>
                                <Typography variant="caption" color={appTheme.darkMode ? 'rgba(255,255,255,0.5)' : '#64748B'} style={{ fontWeight: '500', fontSize: 12 }}>{card.label}</Typography>
                              </View>
                            ))}
                          </View>

                          {/* Members Section */}
                          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
                            {/* Header row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                              <Typography variant="body" color={appTheme.darkMode ? '#fff' : '#0F172A'} style={{ fontWeight: '800', fontSize: 17 }}>Members ({memberCount})</Typography>
                            </View>

                            {/* Search */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: appTheme.darkMode ? '#1E2340' : '#fff', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                              <Search color={appTheme.darkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8'} size={16} />
                              <TextInput
                                value={emailMemberSearch}
                                onChangeText={setEmailMemberSearch}
                                placeholder="Search members..."
                                placeholderTextColor={appTheme.darkMode ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                                style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.darkMode ? '#fff' : '#0F172A', fontSize: 14, padding: 0, fontWeight: '500' }]}
                              />
                            </View>

                            {/* Member List */}
                            <View style={{ backgroundColor: appTheme.darkMode ? '#1E2340' : '#fff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: appTheme.darkMode ? 0.3 : 0.07, shadowRadius: 10, elevation: 4 }}>
                              {visibleMembers.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 52 }}>
                                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: appTheme.darkMode ? 'rgba(99,102,241,0.15)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                    <Users color={appTheme.darkMode ? '#818CF8' : '#6366F1'} size={30} strokeWidth={1.5} />
                                  </View>
                                  <Typography variant="bodySmall" color={appTheme.darkMode ? 'rgba(255,255,255,0.5)' : '#64748B'} style={{ fontWeight: '600' }}>
                                    {memberCount === 0 ? 'No members in this group yet' : 'No members match your search'}
                                  </Typography>
                                </View>
                              ) : (
                                visibleMembers.map((member, index) => {
                                  const displayName = member.contactName || member.email.split('@')[0] || 'Member';
                                  const initials = getInitials(displayName);
                                  const avatarColor = MEMBER_COLORS[index % MEMBER_COLORS.length];
                                  const isLast = index === visibleMembers.length - 1;
                                  return (
                                    <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: appTheme.darkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }}>
                                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center', shadowColor: avatarColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 }}>
                                        <Typography variant="caption" color="#fff" style={{ fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>{initials}</Typography>
                                      </View>
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body" color={appTheme.darkMode ? '#fff' : '#0F172A'} numberOfLines={1} style={{ fontWeight: '700', fontSize: 15 }}>{displayName}</Typography>
                                        <Typography variant="caption" numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: appTheme.darkMode ? 'rgba(255,255,255,0.45)' : '#94A3B8' }}>{member.email}</Typography>
                                      </View>
                                      <TouchableOpacity style={{ padding: 6 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={() => Alert.alert(displayName, member.email)}>
                                        <MoreVertical color={appTheme.darkMode ? 'rgba(255,255,255,0.4)' : '#CBD5E1'} size={18} />
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })
                              )}
                            </View>

                            {/* Delete Group */}
                            <TouchableOpacity
                              onPress={async () => {
                                const g = emailGroupDetail;
                                if (!g) return;
                                const confirmed = await confirmAction('Delete group', `Delete "${g.name}"? This cannot be undone.`);
                                if (!confirmed) return;
                                try {
                                  await deleteEmailBroadcastGroup(g.id);
                                  loadEmailCommsGroups();
                                  selectEmailFolder('inbox');
                                } catch (error) {
                                  Alert.alert('Delete failed', getActionErrorMessage(error, 'Unable to delete the group.'));
                                }
                              }}
                              activeOpacity={0.75}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, backgroundColor: appTheme.darkMode ? 'rgba(239,68,68,0.12)' : '#FFF5F5', paddingVertical: 17, borderRadius: 16, borderWidth: 1, borderColor: appTheme.darkMode ? 'rgba(239,68,68,0.2)' : '#FFE4E6' }}
                            >
                              <Trash2 color="#EF4444" size={18} strokeWidth={2} />
                              <Typography variant="body" style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Delete this group</Typography>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </ScrollView>

                      </View>
                );
              })()
            ) : (

              <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <Mail color={appTheme.disabled} size={30} />
                <Typography variant="body" color={appTheme.muted} style={{ textTransform: 'capitalize' }}>
                  Nothing in {emailFolder}
                </Typography>
              </View>
            )}
          </Reanimated.View>
        ) : (
        <Reanimated.View entering={FadeIn.delay(200).duration(400)} style={{ flex: 1 }}>
        <FlatList
          data={displayedConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          refreshControl={(
            <RefreshControl
              refreshing={isSyncing && !isLoadingConversations}
              onRefresh={() => void syncConversations({ force: true })}
              tintColor={appTheme.primaryAccent}
              colors={[appTheme.primaryAccent]}
              progressBackgroundColor={appTheme.darkMode ? appTheme.surface : '#FFFFFF'}
            />
          )}
          onEndReached={() => {
            if (!showNoConnectionListError) {
              void fetchMoreConversations();
            }
          }}
          onEndReachedThreshold={0.35}
          contentContainerStyle={[
            styles.conversationList,
            { paddingBottom: insets.bottom + 100 },
            (listSelectMode || showNoConnectionListError) && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          ListFooterComponent={
            <View>
              {isLoadingMoreConversations ? (
                <ActivityIndicator color={appTheme.primaryAccent} style={styles.olderLoader} />
              ) : null}
              {listSelectMode ? (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={exitListSelectMode}
                  style={{ minHeight: Math.max(220, width * 0.72) }}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.emptyList, showNoConnectionListError && styles.connectionEmptyList]}>
              {isLoadingConversations || isSyncing ? (
                <View style={{ width: '100%', gap: 16 }}>
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                  <SkeletonConversationRow />
                </View>
              ) : showNoConnectionListError ? (
                <NoConnectionState
                  title="Oops, chats could not load"
                  retryLabel="Retry"
                  onRetry={() => void syncConversations({ force: true })}
                  isRetrying={isSyncing}
                  minHeight={noConnectionListMinHeight}
                />
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
              ) : isEmailTabActive ? (
                /* ── Outlook / Gmail branded empty inbox state (matches image 3 / lad-frontend-2) ── */
                <Reanimated.View
                  entering={FadeInDown.duration(400)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 60,
                    gap: 14,
                  }}
                >
                  {/* Inbox icon with glowing circle */}
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 44,
                      backgroundColor: appTheme.darkMode ? 'rgba(30,80,180,0.22)' : 'rgba(30,100,220,0.09)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                      shadowColor: emailTabMeta.color,
                      shadowOpacity: 0.3,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    <Inbox color={emailTabMeta.color} size={38} strokeWidth={1.5} />
                  </View>
                  <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '700', fontSize: 20, textAlign: 'center' }}>
                    Your inbox is empty
                  </Typography>
                  <Typography variant="bodySmall" color={appTheme.muted} style={{ textAlign: 'center', fontSize: 14, lineHeight: 22, maxWidth: 260 }}>
                    Import your leads or compose a new email.
                  </Typography>
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
        </Reanimated.View>
        )}

        {/* ── Gmail/Outlook compose FAB (mirrors ComposeWindow's compose button) ── */}
        {!isKeyboardVisible && (activeFilter === 'gmail' || activeFilter === 'outlook' || activeFilter === 'email') && (() => {
          const provider = EMAIL_PROVIDER_META[activeFilter === 'outlook' ? 'outlook' : activeFilter === 'email' ? 'custom' : 'gmail'];
          return (
            <TouchableOpacity
              onPress={() => void openEmailComposeNew()}
              activeOpacity={0.85}
              style={{
                position: 'absolute',
                right: 18,
                // Sits above the floating bottom-nav; when the nav slides away on
                // scroll it drops down to cover the freed gap, and rises back when
                // the nav returns.
                bottom: bottomTabHidden ? insets.bottom + 16 : insets.bottom + 92,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: provider.color,
                borderRadius: 28,
                paddingHorizontal: 18,
                paddingVertical: 14,
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 6,
              }}
            >
              <Pencil color="#FFF" size={18} />
              <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Compose</Typography>
            </TouchableOpacity>
          );
        })()}

        {renderEmailComposeSheet(
          EMAIL_PROVIDER_META[activeFilter === 'outlook' ? 'outlook' : activeFilter === 'email' ? 'custom' : 'gmail'],
        )}

        {/* ── Email folder pane — frosted glass overlay matching reference design (image 3) ── */}
        {isEmailTabActive && !isEmailGroupFolder && (
          <Modal
            visible={emailSidebarOpen}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={() => setEmailSidebarOpen(false)}
          >
          <Reanimated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
            <View style={{ flex: 1 }}>

              {/* ── Full-screen white blur backdrop (tap to close) — card floats above it ── */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setEmailSidebarOpen(false)}
                style={[
                  StyleSheet.absoluteFill,
                  Platform.OS === 'web'
                    ? ({
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        backgroundColor: appTheme.darkMode ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.6)',
                      } as any)
                    : { backgroundColor: appTheme.darkMode ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.62)' },
                ]}
              />

              {/* ── Left-flush sidebar card — straight left edge, rounded right side (matches reference) ── */}
              <Reanimated.View
                entering={SlideInLeft.duration(220)}
                style={{
                  position: 'absolute',
                  top: insets.top + 8,
                  left: 0,
                  bottom: 0,
                  width: 300,
                  maxWidth: '86%',
                  backgroundColor: appTheme.surface,
                  borderTopRightRadius: 24,
                  borderBottomRightRadius: 24,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOpacity: 0.16,
                  shadowRadius: 24,
                  shadowOffset: { width: 6, height: 0 },
                  elevation: 18,
                }}
              >
                {/* Header — provider logo + account + chevron (no divider; flows into the list) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10 }}>
                  <ProviderLogo provider={emailTabProviderId} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '800', fontSize: 17 }}>
                      {emailTabMeta.label}
                    </Typography>
                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ fontSize: 12 }}>
                      {emailSidebarAccountEmail || `Connect ${emailTabMeta.label} in Settings`}
                    </Typography>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEmailSidebarOpen(false)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: appTheme.softSurface }}
                  >
                    <ChevronDown color={appTheme.muted} size={20} />
                  </TouchableOpacity>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 28 }}>
                  {/* Compose button */}
                  <TouchableOpacity
                    onPress={() => { setEmailSidebarOpen(false); void openEmailComposeNew(); }}
                    activeOpacity={0.85}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: emailTabMeta.color, borderRadius: 16, marginHorizontal: 14, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, shadowColor: emailTabMeta.color, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                  >
                    <Pencil color="#FFF" size={16} />
                    <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '700' }}>Compose</Typography>
                  </TouchableOpacity>

                  {/* Folder list with count badges */}
                  {(() => {
                    const inboxCount = conversations.filter((c) => c.channel === 'email' || c.channel === 'gmail').reduce((s, c) => s + (c.unreadCount || 0), 0);
                    const folders: { id: typeof emailFolder; label: string; icon: typeof Star; badge: string | null }[] = [
                      { id: 'inbox',     label: 'Inbox',     icon: Inbox,         badge: inboxCount > 0 ? (inboxCount > 99 ? '99+' : String(inboxCount)) : null },
                      { id: 'starred',   label: 'Starred',   icon: Star,          badge: starredIds.size > 0 ? String(starredIds.size) : null },
                      { id: 'snoozed',   label: 'Snoozed',   icon: Clock,         badge: null },
                      { id: 'important', label: 'Important', icon: AlertCircle,   badge: null },
                      { id: 'sent',      label: 'Sent',      icon: Send,          badge: null },
                      { id: 'drafts',    label: 'Drafts',    icon: FileText,      badge: null },
                      { id: 'spam',      label: 'Spam',      icon: AlertTriangle, badge: null },
                      { id: 'trash',     label: 'Trash',     icon: Trash2,        badge: null },
                    ];
                    return folders.map((folder) => {
                      const active = emailFolder === folder.id;
                      return (
                        <TouchableOpacity
                          key={folder.id}
                          onPress={() => selectEmailFolder(folder.id)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 14,
                            marginHorizontal: 14, paddingHorizontal: 16, paddingVertical: 13,
                            borderRadius: 14, marginBottom: 2,
                            backgroundColor: active ? `${emailTabMeta.color}14` : 'transparent',
                          }}
                        >
                          <folder.icon color={active ? emailTabMeta.color : appTheme.muted} size={19} />
                          <Typography variant="bodySmall" style={{ flex: 1, color: active ? emailTabMeta.color : appTheme.text, fontWeight: active ? '700' : '500', fontSize: 15 }}>
                            {folder.label}
                          </Typography>
                          {folder.badge ? (
                            <View style={{ minWidth: 28, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: active ? emailTabMeta.color : `${emailTabMeta.color}18`, alignItems: 'center' }}>
                              <Typography variant="caption" style={{ color: active ? '#FFF' : emailTabMeta.color, fontWeight: '700', fontSize: 11 }}>
                                {folder.badge}
                              </Typography>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    });
                  })()}

                  {/* Broadcast groups */}
                  <View style={{ height: 1, backgroundColor: appTheme.borderSoft, marginVertical: 12, marginHorizontal: 14 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 6 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '700', letterSpacing: 1, flex: 1 }}>BROADCAST GROUPS</Typography>
                    <TouchableOpacity onPress={() => setEmailGroupCreateOpen((v) => !v)} activeOpacity={0.7}>
                      <Plus color={appTheme.muted} size={17} />
                    </TouchableOpacity>
                  </View>
                  {emailGroupCreateOpen && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8 }}>
                      <TextInput
                        value={emailGroupName}
                        onChangeText={setEmailGroupName}
                        placeholder="Group name"
                        placeholderTextColor={appTheme.disabled}
                        style={[WEB_INPUT_RESET, { flex: 1, color: appTheme.text, fontSize: 13, borderWidth: 1, borderColor: appTheme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }]}
                      />
                      <TouchableOpacity onPress={() => void submitCreateEmailGroup()} disabled={emailGroupBusy} activeOpacity={0.75}>
                        {emailGroupBusy ? <ActivityIndicator color={emailTabMeta.color} size="small" /> : <Check color={emailTabMeta.color} size={18} />}
                      </TouchableOpacity>
                    </View>
                  )}
                  {emailCommsGroups.length === 0 ? (
                    <Typography variant="caption" color={appTheme.disabled} style={{ paddingHorizontal: 22, paddingVertical: 6 }}>
                      {emailTabProvider ? 'No groups — create one above' : 'Groups are available for Gmail and Outlook'}
                    </Typography>
                  ) : (
                    emailCommsGroups.map((group) => (
                      <TouchableOpacity key={group.id} onPress={() => selectEmailFolder(`group:${group.id}`)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 9 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: group.color || emailTabMeta.color }} />
                        <Typography variant="bodySmall" color={appTheme.text} numberOfLines={1} style={{ flex: 1 }}>{group.name}</Typography>
                        <Typography variant="caption" color={appTheme.muted}>{group.memberCount}</Typography>
                        <TouchableOpacity onPress={() => void handleDeleteEmailGroup(group)} style={{ padding: 4 }} activeOpacity={0.7}>
                          <Trash2 color={appTheme.disabled} size={14} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  )}

                  {/* Meet */}
                  <View style={{ height: 1, backgroundColor: appTheme.borderSoft, marginVertical: 12, marginHorizontal: 14 }} />
                  <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '700', paddingHorizontal: 22, marginBottom: 4 }}>Meet</Typography>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 9 }} onPress={() => void Linking.openURL(activeFilter === 'outlook' ? 'https://teams.live.com/start' : 'https://meet.google.com/new')} activeOpacity={0.75}>
                    <Calendar color="#188038" size={16} />
                    <Typography variant="bodySmall" color={appTheme.text}>New meeting</Typography>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 9 }} onPress={() => void Linking.openURL(activeFilter === 'outlook' ? 'https://teams.live.com' : 'https://meet.google.com')} activeOpacity={0.75}>
                    <Video color="#1A73E8" size={16} />
                    <Typography variant="bodySmall" color={appTheme.text}>Join a meeting</Typography>
                  </TouchableOpacity>
                </ScrollView>
              </Reanimated.View>
            </View>
          </Reanimated.View>
          </Modal>
        )}
        </View>

        {/* ── Sent broadcast detail — real-mail view ── */}
        {/* Group send template picker */}
        <Modal
          visible={emailGroupTemplateOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setEmailGroupTemplateOpen(false);
            setEmailGroupTemplateError(null);
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: Math.max(insets.top, 18) }}>
            <View
              style={{
                alignSelf: 'center',
                width: '100%',
                maxWidth: 720,
                maxHeight: Math.min(height - Math.max(insets.top + insets.bottom, 40) - 24, 720),
                backgroundColor: appTheme.darkMode ? '#101827' : appTheme.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: emailTabMeta.color,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.34,
                shadowRadius: 26,
                elevation: 18,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: emailTabMeta.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="bodySmall" color="#fff" style={{ fontWeight: '900' }}>
                    {(emailGroupDetail?.name || '?').trim().charAt(0).toUpperCase() || '?'}
                  </Typography>
                </View>
                <View style={{ flex: 1, minWidth: 0, flexShrink: 1 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '900', fontSize: 15, lineHeight: 19, flexShrink: 1 }} numberOfLines={2}>
                    {`Send Email to “${emailGroupDetail?.name ?? 'Group'}”`}
                  </Typography>
                  <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                    {emailGroupDetail?.memberCount ?? 0} recipient{(emailGroupDetail?.memberCount ?? 0) === 1 ? '' : 's'} via {emailGroupDetail?.channel === 'outlook' ? 'Outlook' : 'Gmail'}
                  </Typography>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEmailGroupTemplateOpen(false);
                    setEmailGroupTemplateError(null);
                  }}
                  activeOpacity={0.75}
                  style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X color={appTheme.muted} size={22} />
                </TouchableOpacity>
              </View>

              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 24 }}
                showsVerticalScrollIndicator
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => Alert.alert('Create template', 'Create a saved email template from the web dashboard. It will appear here after sync.')}
                  style={{ borderWidth: 1.5, borderColor: '#5EEAD4', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: appTheme.darkMode ? 'rgba(20,184,166,0.07)' : 'rgba(20,184,166,0.06)' }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${emailTabMeta.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus color={emailTabMeta.color} size={21} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body" color={emailTabMeta.color} style={{ fontWeight: '900' }}>Create New Template</Typography>
                    <Typography variant="caption" color={appTheme.muted}>Write a new email template</Typography>
                  </View>
                </TouchableOpacity>

                <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '900', letterSpacing: 0.8, marginTop: 4 }}>
                  SAVED TEMPLATES
                </Typography>

                {emailGroupTemplateError ? (
                  <Typography variant="caption" color={Theme.colors.error}>{emailGroupTemplateError}</Typography>
                ) : null}

                {emailGroupTemplatesLoading ? (
                  <View style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={emailTabMeta.color} size="large" />
                  </View>
                ) : emailGroupTemplates.length ? (
                  emailGroupTemplates.map((template) => {
                    const sending = emailGroupTemplateSendingId === template.id;
                    return (
                      <TouchableOpacity
                        key={template.id}
                        onPress={() => void selectEmailGroupTemplate(template)}
                        disabled={Boolean(emailGroupTemplateSendingId)}
                        activeOpacity={0.82}
                        style={{
                          borderWidth: 1,
                          borderColor: emailTabMeta.color,
                          borderRadius: 12,
                          padding: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 14,
                          backgroundColor: appTheme.darkMode ? '#111827' : appTheme.input,
                          opacity: emailGroupTemplateSendingId && !sending ? 0.58 : 1,
                        }}
                      >
                        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: appTheme.darkMode ? '#EAF2FF' : '#EEF6FF', alignItems: 'center', justifyContent: 'center' }}>
                          <Mail color={emailTabMeta.color} size={19} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
                            {template.name}
                          </Typography>
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                            {template.subject || template.body}
                          </Typography>
                        </View>
                        {sending ? <ActivityIndicator color={emailTabMeta.color} size="small" /> : null}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appTheme.borderSoft, borderRadius: 12, padding: 18 }}>
                    <FileText color={appTheme.disabled} size={28} />
                    <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 8 }}>No saved templates found for this account.</Typography>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => {
                  setEmailGroupTemplateOpen(false);
                  setEmailGroupTemplateError(null);
                }}
                style={{ borderTopWidth: 1, borderTopColor: appTheme.borderSoft, minHeight: 58, alignItems: 'center', justifyContent: 'center' }}
              >
                <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '800' }}>Cancel</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Sent folder New Broadcast composer */}
        <Modal visible={sentBroadcastOpen} transparent animationType="slide" onRequestClose={closeSentBroadcastComposer}>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          >
            <View style={{ backgroundColor: appTheme.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '92%', paddingBottom: Math.max(insets.bottom, 14) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <Pencil color={emailTabMeta.color} size={18} />
                <View style={{ flex: 1 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '800', fontSize: 16 }}>New Broadcast</Typography>
                  <Typography variant="caption" color={appTheme.muted}>Send via a connected email account.</Typography>
                </View>
                <TouchableOpacity onPress={closeSentBroadcastComposer} style={{ padding: 6 }} activeOpacity={0.7}>
                  <X color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>

              {sentBroadcastLoading ? (
                <ActivityIndicator color={emailTabMeta.color} style={{ paddingVertical: 36 }} />
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800' }}>From</Typography>
                    {sentBroadcastActiveAccounts.length === 0 ? (
                      <Typography variant="bodySmall" color={Theme.colors.error}>No active accounts. Connect an email account in Settings.</Typography>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {sentBroadcastActiveAccounts.map((account) => {
                          const active = sentBroadcastAccountId === account.id;
                          const providerId = account.provider === 'microsoft' ? 'outlook' : account.provider === 'custom_smtp' ? 'custom' : 'gmail';
                          return (
                            <TouchableOpacity
                              key={account.id}
                              onPress={() => {
                                setSentBroadcastAccountId(account.id);
                                const nextChannel = getBroadcastProviderForAccount(account);
                                const nextGroup = nextChannel
                                  ? sentBroadcastGroups.find((group) => group.channel === nextChannel)
                                  : null;
                                setSentBroadcastGroupId(nextGroup?.id ?? '');
                                if (account.provider === 'custom_smtp' || !nextChannel) {
                                  setSentBroadcastMode('manual');
                                } else {
                                  setSentBroadcastMode('group');
                                }
                              }}
                              activeOpacity={0.78}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: active ? emailTabMeta.color : appTheme.border, backgroundColor: active ? `${emailTabMeta.color}10` : appTheme.input, borderRadius: 10, padding: 10 }}
                            >
                              <ProviderLogo provider={providerId as EmailProviderId} size={24} />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '700' }} numberOfLines={1}>{account.email}</Typography>
                                {account.displayName ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{account.displayName}</Typography> : null}
                              </View>
                              {active ? <Check color={emailTabMeta.color} size={18} /> : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800' }}>Recipients</Typography>
                    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, padding: 3, backgroundColor: appTheme.input }}>
                      {(['group', 'manual'] as const).map((mode) => {
                        const active = sentBroadcastMode === mode;
                        const disabled = mode === 'group' && !getBroadcastProviderForAccount(sentBroadcastSelectedAccount);
                        return (
                          <TouchableOpacity
                            key={mode}
                            disabled={disabled}
                            onPress={() => setSentBroadcastMode(mode)}
                            activeOpacity={0.75}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: active ? emailTabMeta.color : 'transparent', opacity: disabled ? 0.45 : 1 }}
                          >
                            <Typography variant="caption" color={active ? '#FFF' : appTheme.text} style={{ fontWeight: '800', textTransform: 'capitalize' }}>{mode}</Typography>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {sentBroadcastMode === 'group' ? (
                      <View style={{ gap: 8 }}>
                        {sentBroadcastAvailableGroups.length === 0 ? (
                          <Typography variant="bodySmall" color={appTheme.muted}>No saved groups for this sender.</Typography>
                        ) : (
                          sentBroadcastAvailableGroups.map((group) => {
                            const active = sentBroadcastGroupId === group.id;
                            return (
                              <TouchableOpacity
                                key={group.id}
                                onPress={() => setSentBroadcastGroupId(group.id)}
                                activeOpacity={0.78}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: active ? emailTabMeta.color : appTheme.border, backgroundColor: active ? `${emailTabMeta.color}10` : appTheme.input, borderRadius: 10, padding: 10 }}
                              >
                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: group.color || emailTabMeta.color }} />
                                <Typography variant="bodySmall" color={appTheme.text} style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{group.name}</Typography>
                                <Typography variant="caption" color={appTheme.muted}>{group.memberCount} member{group.memberCount === 1 ? '' : 's'}</Typography>
                                {active ? <Check color={emailTabMeta.color} size={18} /> : null}
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    ) : (
                      <View style={{ gap: 6 }}>
                        <TextInput
                          value={sentBroadcastRecipients}
                          onChangeText={setSentBroadcastRecipients}
                          placeholder="name@example.com, Alex <alex@example.com>"
                          placeholderTextColor={appTheme.disabled}
                          multiline
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={[WEB_INPUT_RESET, { minHeight: 76, borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, padding: 10, color: appTheme.text, backgroundColor: appTheme.input, textAlignVertical: 'top' }]}
                        />
                        <Typography variant="caption" color={appTheme.muted}>
                          {sentBroadcastParsedRecipients.length} parsed. Use comma, semicolon, or one recipient per line.
                        </Typography>
                      </View>
                    )}
                  </View>

                  <View style={{ gap: 8, position: 'relative', zIndex: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800' }}>Template</Typography>
                      {sentBroadcastTemplateId ? (
                        <TouchableOpacity
                          onPress={() => {
                            setSentBroadcastTemplateId('');
                            setSentBroadcastTemplateDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 6 }}
                        >
                          <X color={appTheme.disabled} size={12} />
                          <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '700' }}>Clear</Typography>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setSentBroadcastTemplateDropdownOpen((value) => !value)}
                      style={{
                        minHeight: 48,
                        borderWidth: 1,
                        borderColor: sentBroadcastTemplateDropdownOpen ? emailTabMeta.color : appTheme.border,
                        borderRadius: 10,
                        backgroundColor: appTheme.input,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <FileText color={sentBroadcastSelectedTemplate ? emailTabMeta.color : appTheme.disabled} size={17} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="bodySmall"
                          color={sentBroadcastSelectedTemplate ? appTheme.text : appTheme.muted}
                          style={{ fontWeight: sentBroadcastSelectedTemplate ? '800' : '500' }}
                          numberOfLines={1}
                        >
                          {sentBroadcastSelectedTemplate?.name ?? 'Start from a saved template (optional)'}
                        </Typography>
                        {sentBroadcastSelectedTemplate ? (
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                            {sentBroadcastSelectedTemplate.subject || sentBroadcastSelectedTemplate.body}
                          </Typography>
                        ) : null}
                      </View>
                      {sentBroadcastTemplatesLoading ? (
                        <ActivityIndicator color={emailTabMeta.color} size="small" />
                      ) : (
                        <ChevronDown
                          color={appTheme.muted}
                          size={17}
                          style={sentBroadcastTemplateDropdownOpen ? styles.filterChevronOpen : undefined}
                        />
                      )}
                    </TouchableOpacity>

                    {sentBroadcastTemplatesError ? (
                      <Typography variant="caption" color={Theme.colors.error}>{sentBroadcastTemplatesError}</Typography>
                    ) : null}

                    {sentBroadcastTemplateDropdownOpen ? (
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: emailTabMeta.color,
                          borderRadius: 10,
                          backgroundColor: appTheme.darkMode ? '#17233A' : appTheme.surface,
                          overflow: 'hidden',
                          maxHeight: 280,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 12 },
                          shadowOpacity: 0.18,
                          shadowRadius: 20,
                          elevation: 10,
                        }}
                      >
                        {sentBroadcastTemplatesLoading ? (
                          <View style={{ minHeight: 76, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={emailTabMeta.color} size="small" />
                          </View>
                        ) : sentBroadcastTemplates.length ? (
                          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                            {sentBroadcastTemplates.map((template) => {
                              const active = sentBroadcastTemplateId === template.id;
                              return (
                                <TouchableOpacity
                                  key={template.id}
                                  onPress={() => applySentBroadcastTemplate(template)}
                                  activeOpacity={0.78}
                                  style={{
                                    minHeight: 44,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    backgroundColor: active ? `${emailTabMeta.color}24` : 'transparent',
                                    borderBottomWidth: 1,
                                    borderBottomColor: appTheme.borderSoft,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  <FileText color={active ? emailTabMeta.color : appTheme.muted} size={15} />
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: active ? '800' : '600' }} numberOfLines={1}>
                                      {template.name}
                                    </Typography>
                                    <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                                      {template.subject || template.body}
                                    </Typography>
                                  </View>
                                  {active ? <Check color={emailTabMeta.color} size={17} /> : null}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        ) : (
                          <View style={{ minHeight: 76, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                            <Typography variant="bodySmall" color={appTheme.muted}>No saved templates found for this account.</Typography>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>

                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800' }}>Subject</Typography>
                    <TextInput
                      value={sentBroadcastSubject}
                      onChangeText={setSentBroadcastSubject}
                      placeholder="Subject"
                      placeholderTextColor={appTheme.disabled}
                      style={[WEB_INPUT_RESET, { minHeight: 44, borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, paddingHorizontal: 12, color: appTheme.text, backgroundColor: appTheme.input }]}
                    />
                  </View>

                  <View style={{ gap: 8 }}>
                    <Typography variant="caption" color={appTheme.muted} style={{ fontWeight: '800' }}>Body</Typography>
                    <TextInput
                      value={sentBroadcastBody}
                      onChangeText={setSentBroadcastBody}
                      placeholder="Write your broadcast..."
                      placeholderTextColor={appTheme.disabled}
                      multiline
                      style={[WEB_INPUT_RESET, { minHeight: 150, borderWidth: 1, borderColor: appTheme.border, borderRadius: 10, padding: 12, color: appTheme.text, backgroundColor: appTheme.input, textAlignVertical: 'top', lineHeight: 21 }]}
                    />
                  </View>

                  {sentBroadcastError ? (
                    <Typography variant="caption" color={Theme.colors.error}>{sentBroadcastError}</Typography>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => void submitSentBroadcast()}
                    disabled={sentBroadcastSending || sentBroadcastActiveAccounts.length === 0}
                    activeOpacity={0.85}
                    style={{ minHeight: 46, borderRadius: 23, backgroundColor: emailTabMeta.color, opacity: sentBroadcastSending || sentBroadcastActiveAccounts.length === 0 ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {sentBroadcastSending ? <ActivityIndicator color="#FFF" size="small" /> : <Send color="#FFF" size={16} />}
                    <Typography variant="bodySmall" color="#FFF" style={{ fontWeight: '800' }}>
                      Send{sentBroadcastSendCount ? ` to ${sentBroadcastSendCount}` : ''}
                    </Typography>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={Boolean(sentRunOpen)} transparent animationType="slide" onRequestClose={() => setSentRunOpen(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: appTheme.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 16) }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${emailTabMeta.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <Send color={emailTabMeta.color} size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body" color={appTheme.text} style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={2}>
                    {sentRunOpen?.subject}
                  </Typography>
                  <Typography variant="caption" color={appTheme.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                    From {sentRunOpen?.fromEmail} · {sentRunOpen ? formatTime(sentRunOpen.createdAt) : ''}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setSentRunOpen(null)} style={{ padding: 4 }}>
                  <X color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appTheme.borderSoft }}>
                {[
                  { label: 'Recipients', value: sentRunOpen?.recipientCount ?? 0, color: appTheme.text },
                  { label: 'Sent', value: sentRunOpen?.sentCount ?? 0, color: '#188038' },
                  { label: 'Failed', value: sentRunOpen?.failedCount ?? 0, color: '#D93025' },
                ].map((stat) => (
                  <View key={stat.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: appTheme.softSurface }}>
                    <Typography variant="body" style={{ fontWeight: '700', color: stat.color }}>{stat.value}</Typography>
                    <Typography variant="caption" color={appTheme.muted}>{stat.label}</Typography>
                  </View>
                ))}
              </View>
              <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 14 }}>
                {sentRunDetailLoading ? (
                  <ActivityIndicator color={emailTabMeta.color} style={{ paddingVertical: 24 }} />
                ) : (
                  <Typography variant="bodySmall" color={appTheme.text} style={{ lineHeight: 21, fontSize: 14 }}>
                    {sentRunDetail?.bodyText?.trim() ||
                      (sentRunDetail?.bodyHtml ? stripHtml(sentRunDetail.bodyHtml) : 'No content available.')}
                  </Typography>
                )}
                {sentRunDetail?.errorMessage ? (
                  <Typography variant="caption" color={Theme.colors.error} style={{ marginTop: 12 }}>
                    {sentRunDetail.errorMessage}
                  </Typography>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  mainChatsHeader: {
    paddingBottom: 10,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  subscreenHeader: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  subscreenBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscreenIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerIconBtn: {
    padding: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOptionsMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 200,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    ...Theme.shadows.medium,
    zIndex: 1000,
  },
  moreOptionsMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  contentFullBleed: {
    paddingHorizontal: 0,
  },
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
  channelFilterWrap: {
    marginTop: -Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  channelFilterPill: {
    height: 36,
    minWidth: 74,
    flexGrow: 1,
    flexBasis: '22%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  channelFilterPillText: {
    fontWeight: '800',
    fontSize: 12,
  },
  filterSheetOption: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  filterSheetOptionText: {
    flex: 1,
    fontWeight: '700',
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
    flexShrink: 1,
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
  stagePill: {
    minHeight: 22,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
  connectionEmptyList: {
    paddingTop: 0,
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
    paddingHorizontal: 6,
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
    alignItems: 'center',
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
  // Single rounded pill housing the attach/input/emoji controls, matching
  // WhatsApp's composer — only the mic/send button sits outside it as its
  // own circular accent button.
  composerPillWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    paddingLeft: 4,
    paddingRight: 6,
  },
  composerPillToolButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAttachButtonOpen: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#53BDA5',
  },
  composerInputDark: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 6,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  linkedinComposerInput: {},
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
  composerMicButton: {
    borderRadius: 21,
    backgroundColor: 'transparent',
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
    left: 18,
    bottom: 72,
    width: 200,
    maxHeight: 359,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 0,
    zIndex: 35,
    ...Theme.shadows.large,
  },
  quickActionTitle: {
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: Theme.spacing.sm,
  },
  quickActionGrid: {
    flexDirection: 'column',
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
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    zIndex: 10,
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
  templateListContent: {
    paddingBottom: Theme.spacing.xs,
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
  },
  templateBadge: {
    maxWidth: 96,
    borderRadius: 999,
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  templateBadgeText: {
    fontWeight: '600',
  },
  templateEmptyText: {
    paddingVertical: Theme.spacing.lg,
    textAlign: 'center',
  },
  attachmentActionItem: {
    width: '100%',
    height: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
  },
  attachmentActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActionLabel: {
    fontWeight: '600',
    fontSize: 14,
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
  contactMetadataList: {
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Theme.spacing.sm,
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
  unsupportedWorkflowContent: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  unsupportedWorkflowTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  unsupportedWorkflowCopy: {
    textAlign: 'center',
    lineHeight: 17,
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
    alignItems: 'flex-start',
    marginBottom: 3,
    gap: 6,
    position: 'relative',
  },
  messageRowAgent: { justifyContent: 'flex-end', paddingLeft: 64, paddingRight: 4 },
  messageRowLead: { justifyContent: 'flex-start', paddingRight: 64, paddingLeft: 4 },
  messageHighlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
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
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  linkedinBubble: {
    maxWidth: '80%',
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
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  messageBubbleLead: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
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
  // Location message bubble — keep normal padding (card is self-contained)
  contactMessageCard: {
    width: 238,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  contactMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  contactMessageAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactMessageIdentity: {
    flex: 1,
    minWidth: 0,
  },
  contactMessageName: {
    fontWeight: '800',
  },
  contactMessageRow: {
    minHeight: 38,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  contactMessageValue: {
    flex: 1,
  },
  locationBubble: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  // Location card — matches frontend-2 max-w-xs compact card
  locationCard: {
    width: 240,
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: 10,
  },
  locationMapPreview: {
    height: 128,
    width: '100%',
    // bg-gray-800 equivalent — shows behind map image or when image hidden
    backgroundColor: '#1F2937',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  locationPinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as any,
  },
  locationLabelBar: {
    // bg-gray-900 equivalent
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationLabelText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  locationCoords: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
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
