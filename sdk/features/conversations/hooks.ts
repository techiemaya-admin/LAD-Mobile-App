/**
 * Conversations Feature - React Hooks
 *
 * Backend-connected hook that mirrors the LAD-Frontend chat workflow:
 * authenticated conversation fetch, active room loading, unread reset, and
 * message send through the existing `/api/chat` endpoint.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Channel, Conversation, Message, MessageStatus, UseConversationsReturn } from './types';

type RawRecord = Record<string, any>;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://lad-backend-develop-160078175457.us-central1.run.app';

const getToken = () => {
  if (typeof localStorage === 'undefined') {
    return '';
  }

  return (
    localStorage.getItem('userToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    ''
  );
};

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json().catch(() => null);
};

const asArray = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as RawRecord;
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  if (record.data && typeof record.data === 'object') {
    return asArray(record.data, keys);
  }

  return [];
};

const asDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
};

const normalizeChannel = (value: unknown): Channel => {
  if (value === 'whatsapp' || value === 'linkedin' || value === 'gmail') {
    return value;
  }

  if (value === 'email') {
    return 'gmail';
  }

  return 'whatsapp';
};

const normalizeStatus = (value: unknown): MessageStatus => {
  if (value === 'delivered' || value === 'read' || value === 'failed') {
    return value;
  }

  return 'sent';
};

const normalizeMessage = (item: RawRecord, conversationId: string): Message => {
  const humanAgentId = item.human_agent_id ?? item.humanAgentId;
  const senderName = item.sender_name ?? item.senderName;
  const isOutgoing =
    item.isOutgoing === true ||
    item.role === 'agent' ||
    item.role === 'user' ||
    item.sender === 'agent' ||
    item.direction === 'outgoing';

  return {
    id: String(item.id ?? item._id ?? item.clientId ?? `${Date.now()}-${Math.random()}`),
    conversationId: String(item.conversationId ?? item.conversation_id ?? conversationId),
    content: String(item.content ?? item.text ?? item.body ?? item.message ?? ''),
    timestamp: asDate(item.timestamp ?? item.created_at ?? item.createdAt),
    isOutgoing,
    status: normalizeStatus(item.message_status ?? item.delivery_status ?? item.status ?? item.metadata?.delivery_status),
    sender: {
      id: String(humanAgentId ?? item.sender?.id ?? (isOutgoing ? 'agent' : 'lead')),
      name: String(senderName ?? item.sender?.name ?? (isOutgoing ? 'Agent' : 'Lead')),
    },
    attachments: Array.isArray(item.attachments) ? item.attachments : undefined,
  };
};

const normalizeConversation = (item: RawRecord): Conversation => {
  const lead = item.contact ?? item.lead ?? item.customer ?? item.participant ?? {};
  const id = String(item.id ?? item._id ?? item.conversationId ?? item.conversation_id ?? '');
  const lastMessage = item.lastMessage ?? item.last_message ?? item.latestMessage ?? item.preview ?? item.message;
  const messages = asArray(item.messages, ['messages']).map((message) => normalizeMessage(message, id));
  const normalizedLastMessage =
    lastMessage && typeof lastMessage === 'object'
      ? normalizeMessage(lastMessage, id)
      : messages[messages.length - 1] ?? null;

  return {
    id,
    contact: {
      id: String(lead.id ?? lead._id ?? item.leadId ?? id),
      name: String(item.name ?? item.title ?? lead.name ?? lead.fullName ?? lead.email ?? 'Unknown lead'),
      email: lead.email ? String(lead.email) : undefined,
      phone: lead.phone ? String(lead.phone) : undefined,
      company: lead.company ? String(lead.company) : undefined,
      avatar: lead.avatar ?? lead.profileImage,
    },
    channel: normalizeChannel(item.channel ?? item.source ?? item.platform ?? normalizedLastMessage?.attachments?.[0]?.type),
    messages,
    lastMessage: normalizedLastMessage,
    unreadCount: Number(item.unreadCount ?? item.unread_count ?? item.unread ?? 0),
    status: item.status === 'resolved' || item.status === 'muted' ? item.status : 'open',
    createdAt: asDate(item.createdAt ?? item.created_at),
    updatedAt: asDate(item.updatedAt ?? item.updated_at ?? normalizedLastMessage?.timestamp),
    tags: Array.isArray(item.tags) ? item.tags : undefined,
  };
};

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const refreshConversations = useCallback(async () => {
    const payload = await request('/api/conversations');
    const nextConversations = asArray(payload, ['conversations', 'data', 'items'])
      .map((item) => normalizeConversation(item))
      .filter((conversation) => conversation.id)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    setConversations(nextConversations);
    setSelectedId((current) => current ?? nextConversations[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const matchesChannel = channelFilter === 'all' || conv.channel === channelFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        query === '' ||
        conv.contact.name.toLowerCase().includes(query) ||
        conv.contact.email?.toLowerCase().includes(query) ||
        conv.contact.company?.toLowerCase().includes(query);

      return matchesChannel && matchesSearch;
    });
  }, [conversations, channelFilter, searchQuery]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const unreadCounts = useMemo(() => {
    const counts = { all: 0, whatsapp: 0, linkedin: 0, gmail: 0 };
    conversations.forEach((conv) => {
      counts.all += conv.unreadCount;
      counts[conv.channel] += conv.unreadCount;
    });
    return counts;
  }, [conversations]);

  const selectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, unreadCount: 0 } : conv)),
    );
    void request(`/api/conversations/${id}/read`, { method: 'POST' }).catch(() => undefined);
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!selectedId || !content.trim()) {
      return;
    }

    const messageText = content.trim();
    void request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: selectedId,
        role: 'user',
        content: messageText,
        type: 'text',
        metadata: {
          tags: [],
          read_receipt: false,
          delivery_status: 'sent',
        },
        message_status: 'sent',
      }),
    }).then(refreshConversations);
  }, [refreshConversations, selectedId]);

  const markAsResolved = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, status: 'resolved' } : conv)),
    );
  }, []);

  const muteConversation = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, status: conv.status === 'muted' ? 'open' : 'muted' } : conv,
      ),
    );
  }, []);

  return {
    conversations: filteredConversations,
    allConversations: conversations,
    selectedConversation,
    selectedId,
    selectConversation,
    channelFilter,
    setChannelFilter,
    searchQuery,
    setSearchQuery,
    unreadCounts,
    sendMessage,
    markAsResolved,
    muteConversation,
  };
}
