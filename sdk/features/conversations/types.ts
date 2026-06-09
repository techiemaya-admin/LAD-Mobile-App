/**
 * Conversations Feature - Type Definitions
 * 
 * Central location for all conversations-related TypeScript interfaces.
 */

export type Channel = 'whatsapp' | 'linkedin' | 'gmail';
export type ConversationStatus = 'open' | 'resolved' | 'muted';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  avatar?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: MessageStatus;
  sender: {
    id: string;
    name: string;
  };
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  url: string;
  type: 'image' | 'document' | 'video';
  name: string;
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

export interface UseConversationsReturn {
  conversations: Conversation[];
  allConversations: Conversation[];
  selectedConversation: Conversation | null;
  selectedId: string | null;
  selectConversation: (id: string) => void;
  channelFilter: Channel | 'all';
  setChannelFilter: (filter: Channel | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  unreadCounts: {
    all: number;
    whatsapp: number;
    linkedin: number;
    gmail: number;
  };
  sendMessage: (content: string) => void;
  markAsResolved: (id: string) => void;
  muteConversation: (id: string) => void;
}
