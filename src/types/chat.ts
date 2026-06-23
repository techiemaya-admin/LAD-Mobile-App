export type Channel = 'whatsapp' | 'linkedin' | 'instagram' | 'gmail';
export type ChatChannel = Channel | 'email' | 'web' | 'unknown';
export type IntegrationChannel = 'whatsapp' | 'linkedin' | 'email' | 'instagram' | 'gohighlevel' | string;
export type ConversationStatus = 'open' | 'resolved' | 'muted';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type IntegrationStatus = 'connected' | 'disconnected' | 'connecting' | 'checkpoint' | 'error' | 'unknown';

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  avatar?: string;
}

export interface Attachment {
  id: string;
  url: string;
  type: 'image' | 'document' | 'video';
  name: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: Exclude<MessageStatus, 'sending'>;
  sender: {
    id: string;
    name: string;
  };
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  contact: Contact;
  channel: Channel;
  messages: Message[];
  lastMessage: Message | null;
  unreadCount: number;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface ApiMessage {
  id?: string | number;
  _id?: string | number;
  clientId?: string | number;
  conversationId?: string | number;
  conversation_id?: string | number;
  threadId?: string | number;
  thread_id?: string | number;
  content?: string;
  text?: string;
  body?: string;
  message?: string;
  role?: string;
  sender?: string;
  direction?: string;
  from?: string;
  human_agent_id?: string | number;
  humanAgentId?: string | number;
  sender_name?: string;
  senderName?: string;
  created_at?: string | number;
  createdAt?: string | number;
  timestamp?: string | number;
  type?: string;
  channel?: string;
  source?: string;
  platform?: string;
  metadata?: {
    tags?: unknown[];
    read_receipt?: boolean;
    delivery_status?: string;
    [key: string]: unknown;
  };
  message_status?: string;
  delivery_status?: string;
  status?: string;
  read_receipt?: boolean;
  attachments?: Attachment[];
  [key: string]: unknown;
}

export interface ApiConversation {
  id?: string | number;
  _id?: string | number;
  conversationId?: string | number;
  conversation_id?: string | number;
  threadId?: string | number;
  thread_id?: string | number;
  name?: string;
  title?: string;
  channel?: string;
  source?: string;
  platform?: string;
  contact?: Partial<Contact>;
  lead?: Partial<Contact> & { fullName?: string; profileImage?: string };
  customer?: Partial<Contact>;
  participant?: Partial<Contact>;
  participants?: Partial<Contact>[];
  messages?: ApiMessage[];
  lastMessage?: ApiMessage | string | null;
  last_message?: ApiMessage | string | null;
  latestMessage?: ApiMessage | string | null;
  latest_message?: ApiMessage | string | null;
  preview?: ApiMessage | string | null;
  message?: ApiMessage | string | null;
  lastMessageText?: string;
  lastMessageAt?: string | number;
  last_message_at?: string | number;
  createdAt?: string | number;
  created_at?: string | number;
  updatedAt?: string | number;
  updated_at?: string | number;
  unreadCount?: number;
  unread_count?: number;
  unread?: number;
  avatar?: string;
  online?: boolean;
  isOnline?: boolean;
  status?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  sender: 'agent' | 'lead' | 'system';
  channel: ChatChannel;
  status: MessageStatus;
  createdAt: string;
  humanAgentId?: string;
  senderName?: string;
  attachments?: Attachment[];
  mediaId?: string;
  mediaType?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
}

export interface ChatConversation {
  id: string;
  name: string;
  channel: ChatChannel;
  lastMessage: string;
  lastMessageAt?: string;
  unreadCount: number;
  avatar?: string;
  online?: boolean;
  status?: MessageStatus;
  tags?: string[];
  email?: string;
  phone?: string;
  company?: string;
  leadId?: string;
  startedAt?: string;
  owner?: string;
  ownerType?: 'AI' | 'human_agent';
  conversationState?: string;
  messageCount?: number;
  waBackendChannel?: 'personal' | 'waba';
}

export interface ConnectedIntegration {
  channel: IntegrationChannel;
  label: string;
  connected: boolean;
  status: IntegrationStatus;
  accountId?: string;
  accountName?: string;
  email?: string;
  lastSyncedAt?: string;
  requiresAction?: boolean;
  error?: string;
}

export interface IntegrationSummary {
  integrations: ConnectedIntegration[];
  userId?: string;
}

export interface ConversationActivityPayload {
  conversationId: string;
  messages?: ApiMessage[];
  lastMessage?: ApiMessage;
  updatedAt?: string | number;
  unread?: number;
  leadId?: string;
  lead?: { name?: string };
}

export interface NotificationPayload {
  conversation_id?: string;
  conversationId?: string;
  id?: string;
  unreadCount?: number;
  message?: ApiMessage;
}

export interface SendChannelMessageParams {
  channel: string;
  phone_number?: string;
  message_text: string;
  conversation_id?: string;
  lead_id?: string;
  human_agent_id?: string;
  role?: string;
}

export interface SendMessageParams {
  conversationId: string;
  message: string;
  content?: string;
  clientId?: string;
  humanAgentId?: string;
  currentUser?: CurrentUser;
  role?: string;
  type?: string;
  mediaId?: string;
  mediaType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
}

export interface CurrentUser {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface SocketStatus {
  connected: boolean;
  id: string | null;
  readyState: number | null;
  url: string;
  timestamp: string;
}

export interface AssignHandlerParams {
  handler?: string | null;
  humanAgentId: string | null;
}

export interface ConversationDetail {
  conversation?: ChatConversation;
  messages: ChatMessage[];
}

export interface MessagePageParams {
  limit?: number;
  page?: number;
  before?: string;
}

export interface ConversationPageParams {
  limit?: number;
  page?: number;
  cursor?: string;
  search?: string;
  channel?: ChatChannel | 'all' | 'unread';
}

