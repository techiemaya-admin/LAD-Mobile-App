import { create } from 'zustand';
import { Platform } from 'react-native';

import { getAuthToken } from '@/src/api';
import { getSocket } from '@/src/services/socketService';
import useAuthStore from '@/src/store/authStore';
import {
  ChatMessage,
  Conversation,
  getConversation,
  getConversationMessages,
  getConversations,
  getErrorMessage,
  markConversationReadRequest,
  normalizeConversation,
  normalizeMessage,
  normalizeStatus,
  sendChannelMessage as sendChannelMessageRequest,
  sendChatMessage,
  sendMessageWithAttachment,
} from '@/src/services/conversationService';
import {
  getConnectedIntegrations,
} from '@/src/services/integration.service';
import { ConnectedIntegration } from '@/src/types/chat';
import { getBroadcastGroups, getWhatsAppLabels, BroadcastGroup, WhatsAppLabel } from '@/src/services/chat.service';

export type {
  ChatChannel,
  ChatMessage,
  Conversation,
  MessageStatus,
} from '@/src/services/conversationService';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeMessages: ChatMessage[];
  messagesByConversationId: Record<string, ChatMessage[]>;
  broadcastGroups: BroadcastGroup[];
  whatsappLabels: WhatsAppLabel[];
  isLoadingGroups: boolean;
  isLoadingConversations: boolean;
  isLoadingMoreConversations: boolean;
  isLoadingMessages: boolean;
  isLoadingOlderMessages: boolean;
  isSending: boolean;
  isUploadingAttachment: boolean;
  isSyncing: boolean;
  isLoadingIntegrations: boolean;
  error: string | null;
  syncError: string | null;
  lastSyncedAt: string | null;
  conversationPage: number;
  hasMoreConversations: boolean;
  hasOlderMessages: boolean;
  connectedIntegrations: ConnectedIntegration[];
  typingConversationIds: Record<string, boolean>;

  initializeRealtime: () => void;
  fetchConnectedIntegrations: () => Promise<void>;
  fetchConversations: (options?: { force?: boolean }) => Promise<void>;
  fetchBroadcastGroups: () => Promise<void>;
  fetchWhatsAppLabels: () => Promise<void>;
  fetchMoreConversations: () => Promise<void>;
  syncConversations: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
  startConversationAutoSync: () => void;
  stopConversationAutoSync: () => void;
  setActiveConversation: (conversationId: string, options?: { force?: boolean }) => Promise<void>;
  getOlderMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendAttachment: (asset: AttachmentAsset, caption?: string) => Promise<void>;
  sendChannelMessage: (payload: Record<string, unknown>) => Promise<void>;
  emitTypingState: (isTyping: boolean) => void;
  clearConversationMessages: (conversationId: string) => void;
  clearActiveConversation: () => void;
  markConversationRead: (conversationId: string) => void;
  disposeRealtime: () => void;
  reset: () => void;
}

type RawRecord = Record<string, any>;
type AttachmentAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  type?: string | null;
};

const PAGE_SIZE = 20;
const CONVERSATION_PAGE_SIZE = 25;
let listenersAttached = false;
let activeMessageRequest = 0;
let conversationSyncTimer: ReturnType<typeof setInterval> | null = null;
// Conversations the user has marked read locally; used to preserve read state across force syncs
// until the backend confirms the update. Cleared when a new incoming message arrives for that conversation.
const localReadOverrides = new Set<string>();

const sortMessages = (messages: ChatMessage[]) =>
  [...messages].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

const appendUniqueMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const seen = new Set(current.map((message) => message.id));

  return [
    ...current,
    ...incoming.filter((message) => {
      if (seen.has(message.id)) {
        return false;
      }

      seen.add(message.id);
      return true;
    }),
  ];
};

const upsertConversation = (conversations: Conversation[], conversation: Conversation) => {
  const existingIndex = conversations.findIndex((item) => item.id === conversation.id);
  if (existingIndex === -1) {
    return [conversation, ...conversations];
  }

  const next = [...conversations];
  next[existingIndex] = { ...next[existingIndex], ...conversation };
  return next;
};

const appendUniqueConversations = (current: Conversation[], incoming: Conversation[]) => {
  const seen = new Set(current.map((conversation) => conversation.id));

  return [
    ...current,
    ...incoming.filter((conversation) => {
      if (seen.has(conversation.id)) {
        return false;
      }

      seen.add(conversation.id);
      return true;
    }),
  ];
};

const updateMessageStatus = (messages: ChatMessage[], payload: RawRecord) => {
  const messageId = String(payload.id ?? payload._id ?? payload.messageId ?? payload.message_id ?? payload.clientId ?? '');
  const status = normalizeStatus(payload.status ?? payload.delivery_status ?? payload.read_receipt);

  if (!messageId) {
    return messages;
  }

  return messages.map((message) => (message.id === messageId ? { ...message, status } : message));
};

const markConversationReadLocally = (conversations: Conversation[], conversationId: string) =>
  conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
  );

const getConversationIdFromPayload = (payload: RawRecord) =>
  String(payload.conversationId ?? payload.conversation_id ?? payload.id ?? '');

const getMessagePayload = (payload: RawRecord, conversationId: string) => {
  const messagePayload = payload.message && typeof payload.message === 'object'
    ? payload.message as RawRecord
    : payload;

  return normalizeMessage(
    {
      ...messagePayload,
      conversationId:
        messagePayload.conversationId ??
        messagePayload.conversation_id ??
        payload.conversationId ??
        payload.conversation_id ??
        conversationId,
    },
    conversationId,
  );
};

const isMessageFromCurrentAgent = (message: ChatMessage, payload?: RawRecord) => {
  const currentUserId = useAuthStore.getState().user?.id;
  const rawHumanAgentId = payload?.human_agent_id ?? payload?.humanAgentId;
  const humanAgentId = message.humanAgentId ?? (rawHumanAgentId ? String(rawHumanAgentId) : undefined);

  return Boolean(currentUserId && humanAgentId && humanAgentId === currentUserId);
};

const isFeatureUnavailableError = (error: unknown) =>
  error instanceof Error && /feature not found/i.test(error.message);

const loadAllConversationPages = async () => {
  return getConversations();
};

const loadAllMessagePages = async (conversationId: string, initialMessages: ChatMessage[] = []) => {
  let page = 1;
  let hasMore = true;
  let messages = initialMessages;

  while (hasMore && page <= 50) {
    const pageMessages = await getConversationMessages(conversationId, { page, limit: PAGE_SIZE });
    messages = appendUniqueMessages(messages, pageMessages);
    hasMore = pageMessages.length >= PAGE_SIZE;
    page += 1;
  }

  return messages;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeMessages: [],
  messagesByConversationId: {},
  isLoadingConversations: true,
  isLoadingMoreConversations: false,
  isLoadingMessages: false,
  isLoadingOlderMessages: false,
  isSending: false,
  isUploadingAttachment: false,
  isSyncing: false,
  isLoadingIntegrations: false,
  broadcastGroups: [],
  whatsappLabels: [],
  isLoadingGroups: false,
  error: null,
  syncError: null,
  lastSyncedAt: null,
  conversationPage: 1,
  hasMoreConversations: true,
  hasOlderMessages: true,
  connectedIntegrations: [],
  typingConversationIds: {},

  initializeRealtime: () => {
    if (listenersAttached) {
      return;
    }

    listenersAttached = true;
    const socket = getSocket();

    socket.off('conversation:new');
    socket.off('conversation:updated');
    socket.off('notification:new');
    socket.off('message:new');
    socket.off('message:status');
    socket.off('conversation:read');
    socket.off('conversation:activity');
    socket.off('typing:start');
    socket.off('typing:stop');
    socket.off('connect');
    socket.off('connect_error');

    socket.on('connect', () => {
      set({ error: null });
      const activeConversationId = get().activeConversationId;
      if (activeConversationId) {
        socket.emit('join', activeConversationId);
      }
    });

    socket.on('connect_error', () => {
      set({ error: 'Realtime connection is unavailable.' });
    });

    socket.on('conversation:new', (payload) => {
      const conversation = normalizeConversation(payload);
      if (conversation.id) {
        set((state) => ({
          conversations: upsertConversation(state.conversations, conversation),
        }));
      }
    });

    socket.on('conversation:activity', (payload) => {
      const conversationId = String(payload.conversationId ?? payload.conversation_id ?? payload.id ?? '');
      if (!conversationId) {
        return;
      }

      const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
      const messages = rawMessages
        .map((message: RawRecord) => getMessagePayload({ ...payload, message }, conversationId))
        .filter((message: ChatMessage) => message.content || message.mediaId);
      const lastMessage = payload.lastMessage
        ? getMessagePayload({ ...payload, message: payload.lastMessage }, conversationId)
        : messages[messages.length - 1];

      set((state) => {
        const activeMessageIds = new Set(state.activeMessages.map((message) => message.id));
        const shouldAppend = state.activeConversationId === conversationId;
        const appendedMessages = shouldAppend
          ? messages.filter((message: ChatMessage) => !activeMessageIds.has(message.id))
          : [];
        const unreadIncomingCount = messages.filter(
          (message: ChatMessage) => message.sender === 'lead' && !isMessageFromCurrentAgent(message),
        ).length;

        const nextActiveMessages = shouldAppend ? sortMessages([...state.activeMessages, ...appendedMessages]) : state.activeMessages;
        const nextCachedMessages = shouldAppend
          ? sortMessages([...(state.messagesByConversationId[conversationId] ?? state.activeMessages), ...appendedMessages])
          : state.messagesByConversationId[conversationId];

        return {
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessage: lastMessage?.content || conversation.lastMessage,
                  lastMessageAt: lastMessage?.createdAt || conversation.lastMessageAt,
                  unreadCount:
                    typeof payload.unread === 'number'
                      ? payload.unread
                      : state.activeConversationId === conversationId
                        ? 0
                        : conversation.unreadCount + unreadIncomingCount,
                  status: lastMessage?.status || conversation.status,
                }
              : conversation
          ),
          activeMessages: nextActiveMessages,
          messagesByConversationId: shouldAppend
            ? { ...state.messagesByConversationId, [conversationId]: nextCachedMessages }
            : state.messagesByConversationId,
        };
      });
    });

    socket.on('conversation:updated', (payload) => {
      const conversation = normalizeConversation(payload);
      if (conversation.id) {
        set((state) => ({
          conversations: upsertConversation(state.conversations, conversation),
        }));
      }
    });

    socket.on('notification:new', (payload) => {
      const conversationId = getConversationIdFromPayload(payload);
      if (!conversationId) {
        return;
      }

      const message = getMessagePayload(payload, conversationId);
      const rawMessage = payload.message && typeof payload.message === 'object' ? payload.message as RawRecord : payload;
      const isOwnMessage = isMessageFromCurrentAgent(message, rawMessage);

      // New incoming message invalidates the local read override so fresh unread counts show
      if (!isOwnMessage) {
        localReadOverrides.delete(conversationId);
      }

      set((state) => {
        const hasMessage = state.activeMessages.some((item) => item.id === message.id);
        const shouldIncrementUnread = state.activeConversationId !== conversationId && !isOwnMessage;

        const shouldAppendToActive = state.activeConversationId === conversationId && (message.content || message.mediaId) && !hasMessage;
        const cachedMessages = state.messagesByConversationId[conversationId] ?? [];
        const cachedHasMessage = cachedMessages.some((item) => item.id === message.id);

        return {
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessage: message.content || conversation.lastMessage,
                  lastMessageAt: message.createdAt || conversation.lastMessageAt,
                  unreadCount: Number(payload.unreadCount ?? (
                    shouldIncrementUnread ? conversation.unreadCount + 1 : conversation.unreadCount
                  )),
                  status: message.status,
                }
              : conversation
          ),
          activeMessages: shouldAppendToActive ? [...state.activeMessages, message] : state.activeMessages,
          messagesByConversationId:
            (message.content || message.mediaId) && !cachedHasMessage
              ? { ...state.messagesByConversationId, [conversationId]: [...cachedMessages, message] }
              : state.messagesByConversationId,
        };
      });

      if (get().activeConversationId === conversationId && !isOwnMessage) {
        get().markConversationRead(conversationId);
      }
    });

    socket.on('message:new', (payload) => {
      const activeConversationId = get().activeConversationId;
      const message = normalizeMessage(payload, activeConversationId ?? '');
      if (!message.conversationId) {
        return;
      }

      if (message.sender === 'lead' && activeConversationId !== message.conversationId) {
        localReadOverrides.delete(message.conversationId);
      }

      set((state) => {
        const hasMessage = state.activeMessages.some((item) => item.id === message.id);
        const conversations = state.conversations.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessage: message.content,
                lastMessageAt: message.createdAt,
                unreadCount:
                  state.activeConversationId === message.conversationId || isMessageFromCurrentAgent(message, payload)
                    ? 0
                    : conversation.unreadCount + (message.sender === 'lead' ? 1 : 0),
                status: message.status,
              }
            : conversation
        );

        const shouldAppendToActive = state.activeConversationId === message.conversationId && !hasMessage;
        const cachedMessages = state.messagesByConversationId[message.conversationId] ?? [];
        const cachedHasMessage = cachedMessages.some((item) => item.id === message.id);

        return {
          conversations,
          activeMessages: shouldAppendToActive ? [...state.activeMessages, message] : state.activeMessages,
          messagesByConversationId:
            !cachedHasMessage
              ? { ...state.messagesByConversationId, [message.conversationId]: [...cachedMessages, message] }
              : state.messagesByConversationId,
        };
      });
    });

    socket.on('message:status', (payload) => {
      const conversationId = String(payload.conversationId ?? payload.conversation_id ?? '');
      set((state) => ({
        activeMessages: updateMessageStatus(state.activeMessages, payload),
        messagesByConversationId: conversationId && state.messagesByConversationId[conversationId]
          ? {
              ...state.messagesByConversationId,
              [conversationId]: updateMessageStatus(state.messagesByConversationId[conversationId], payload),
            }
          : state.messagesByConversationId,
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, status: normalizeStatus(payload.status ?? payload.delivery_status) }
            : conversation
        ),
      }));
    });

    socket.on('conversation:read', (payload) => {
      const conversationId = String(payload.conversationId ?? payload.conversation_id ?? payload.id ?? '');
      if (conversationId) {
        set((state) => ({
          conversations: markConversationReadLocally(state.conversations, conversationId),
        }));
      }
    });

    socket.on('typing:start', (payload) => {
      const conversationId = String(payload.conversationId ?? payload.conversation_id ?? payload.id ?? '');
      if (conversationId) {
        set((state) => ({
          typingConversationIds: { ...state.typingConversationIds, [conversationId]: true },
        }));
      }
    });

    socket.on('typing:stop', (payload) => {
      const conversationId = String(payload.conversationId ?? payload.conversation_id ?? payload.id ?? '');
      if (conversationId) {
        set((state) => {
          const next = { ...state.typingConversationIds };
          delete next[conversationId];
          return { typingConversationIds: next };
        });
      }
    });
  },

  fetchBroadcastGroups: async () => {
    try {
      set({ isLoadingGroups: true });
      const groups = await getBroadcastGroups();
      set({ broadcastGroups: groups, isLoadingGroups: false });
    } catch (error) {
      console.log('Error fetching broadcast groups:', error);
      set({ isLoadingGroups: false });
    }
  },
  
  fetchWhatsAppLabels: async () => {
    try {
      const labels = await getWhatsAppLabels();
      set({ whatsappLabels: labels });
    } catch (error) {
      console.log('Error fetching whatsapp labels:', error);
    }
  },

  fetchConnectedIntegrations: async () => {
    // Only show the loading spinner on the very first fetch.
    // Background re-fetches (e.g. on every screen focus) should be silent so
    // they don't trigger re-renders that reset the channel tabs or the FlatList.
    const isFirstFetch = get().connectedIntegrations.length === 0;
    if (isFirstFetch) {
      set({ isLoadingIntegrations: true, syncError: null });
    }
    try {
      const summary = await getConnectedIntegrations();
      set({
        connectedIntegrations: summary.integrations,
        isLoadingIntegrations: false,
      });
    } catch (error) {
      set({
        isLoadingIntegrations: false,
        syncError: getErrorMessage(error, 'Unable to load connected integrations.'),
      });
    }
  },

  fetchConversations: async (options = {}) => {
    if (!options.force && get().conversations.length) {
      set({ isLoadingConversations: false, error: null });
      return;
    }

    set({ isLoadingConversations: true, error: null });
    try {
      const conversations = await loadAllConversationPages();
      set((state) => ({
        conversations: conversations.length
          ? conversations.map((conv) =>
              localReadOverrides.has(conv.id) ? { ...conv, unreadCount: 0 } : conv
            )
          : state.conversations,
        conversationPage: 1,
        hasMoreConversations: false,
        isLoadingConversations: false,
        syncError: conversations.length || state.conversations.length
          ? null
          : 'Backend returned 0 live conversations for this account.',
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch (error) {
      if (isFeatureUnavailableError(error)) {
        set({
          conversations: [],
          conversationPage: 1,
          hasMoreConversations: false,
          isLoadingConversations: false,
          error: null,
        });
        return;
      }

      set({
        error: getErrorMessage(error, 'Unable to load conversations from the backend.'),
        isLoadingConversations: false,
      });
    }
  },

  syncConversations: async (options = {}) => {
    if (!options.force && get().conversations.length) {
      if (!options.silent) {
        set({ isSyncing: false, isLoadingConversations: false, error: null, syncError: null });
      }
      return;
    }

    if (!options.silent) {
      set({ isSyncing: true, syncError: null, error: null });
    }

    try {
      const conversations = await loadAllConversationPages();

      set((state) => {
        const mergedConversations = conversations.length
          ? conversations.map((conv) =>
              localReadOverrides.has(conv.id) ? { ...conv, unreadCount: 0 } : conv
            )
          : state.conversations;

        return {
          conversations: mergedConversations,
          connectedIntegrations: state.connectedIntegrations,
          conversationPage: 1,
          hasMoreConversations: false,
          isSyncing: false,
          isLoadingConversations: false,
          syncError: conversations.length || state.conversations.length
            ? null
            : 'Backend returned 0 live conversations for this account.',
          lastSyncedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      if (isFeatureUnavailableError(error)) {
        set({
          conversations: [],
          conversationPage: 1,
          hasMoreConversations: false,
          isSyncing: false,
          isLoadingConversations: false,
          syncError: null,
          error: null,
          lastSyncedAt: new Date().toISOString(),
        });
        return;
      }

      set({
        isSyncing: false,
        conversations: get().conversations,
        conversationPage: 1,
        hasMoreConversations: false,
        syncError: getErrorMessage(error, 'Unable to sync conversations.'),
        error: options.silent ? get().error : getErrorMessage(error, 'Unable to sync conversations.'),
      });
    }
  },

  startConversationAutoSync: () => {
    if (conversationSyncTimer) {
      return;
    }

    void get().syncConversations({ silent: true });
    conversationSyncTimer = setInterval(() => {
      void get().syncConversations({ silent: true });
    }, 20_000); // 20 s — silent background sync, no visible spinner
  },

  stopConversationAutoSync: () => {
    if (conversationSyncTimer) {
      clearInterval(conversationSyncTimer);
      conversationSyncTimer = null;
    }
  },

  fetchMoreConversations: async () => {
    const { conversationPage, hasMoreConversations, isLoadingConversations, isLoadingMoreConversations, isSyncing, conversations } = get();
    // Also block while a full sync is running — prevents a race where the initial
    // sync hasn't finished yet but onEndReached fires for a short list.
    // Prevent fetching more if the list is completely empty.
    if (!hasMoreConversations || isLoadingConversations || isLoadingMoreConversations || isSyncing || conversations.length === 0) {
      return;
    }

    const nextPage = conversationPage + 1;
    set({ isLoadingMoreConversations: true });

    try {
      const conversations = await getConversations({ page: nextPage, limit: CONVERSATION_PAGE_SIZE });
      set((state) => ({
        conversations: appendUniqueConversations(state.conversations, conversations),
        conversationPage: nextPage,
        hasMoreConversations: conversations.length >= CONVERSATION_PAGE_SIZE,
        isLoadingMoreConversations: false,
      }));
    } catch (error) {
      if (isFeatureUnavailableError(error)) {
        set({
          hasMoreConversations: false,
          isLoadingMoreConversations: false,
          error: null,
        });
        return;
      }

      // Set hasMoreConversations:false on error so a transient 503 or network
      // failure does not cause an infinite retry loop (onEndReached keeps firing
      // while hasMoreConversations is true, flooding the backend).
      set({
        error: getErrorMessage(error, 'Unable to load more conversations.'),
        isLoadingMoreConversations: false,
        hasMoreConversations: false,
      });
    }
  },

  setActiveConversation: async (conversationId, options = {}) => {
    const requestId = activeMessageRequest + 1;
    activeMessageRequest = requestId;
    const socket = getSocket();
    const previousConversationId = get().activeConversationId;
    if (previousConversationId && previousConversationId !== conversationId) {
      socket.emit('leave', previousConversationId);
    }

    socket.emit('join', conversationId);
    const cachedMessages = get().messagesByConversationId[conversationId];
    const hasCachedMessages = Object.prototype.hasOwnProperty.call(get().messagesByConversationId, conversationId);
    set({
      activeConversationId: conversationId,
      activeMessages: hasCachedMessages && !options.force ? cachedMessages : [],
      isLoadingMessages: options.force || !hasCachedMessages,
      hasOlderMessages: options.force || !hasCachedMessages,
      error: null,
    });

    get().markConversationRead(conversationId);

    if (hasCachedMessages && !options.force) {
      return;
    }

    try {
      const detail = await getConversation(conversationId).catch(() => null);
      const messages = await loadAllMessagePages(conversationId, detail?.messages ?? []);
      const sortedMessages = sortMessages(messages);

      if (requestId !== activeMessageRequest) {
        return;
      }

      set((state) => ({
        conversations: detail?.conversation?.id
          ? upsertConversation(state.conversations, detail.conversation)
          : state.conversations,
        activeMessages: sortedMessages,
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: sortedMessages,
        },
        hasOlderMessages: false,
        isLoadingMessages: false,
      }));
    } catch (error) {
      if (requestId !== activeMessageRequest) {
        return;
      }

      set({
        error: getErrorMessage(error, 'Unable to load messages for this conversation.'),
        isLoadingMessages: false,
      });
    }
  },

  getOlderMessages: async () => {
    const { activeConversationId, activeMessages, hasOlderMessages, isLoadingOlderMessages } = get();
    if (!activeConversationId || !hasOlderMessages || isLoadingOlderMessages) {
      return;
    }

    set({ isLoadingOlderMessages: true });
    const oldestMessage = activeMessages[0];

    try {
      const olderMessages = await getConversationMessages(activeConversationId, {
        limit: PAGE_SIZE,
        before: oldestMessage?.createdAt,
      });

      set((state) => ({
        activeMessages: [...sortMessages(olderMessages), ...state.activeMessages],
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [activeConversationId]: [...sortMessages(olderMessages), ...state.activeMessages],
        },
        hasOlderMessages: olderMessages.length >= PAGE_SIZE,
        isLoadingOlderMessages: false,
      }));
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Unable to load older messages.'),
        isLoadingOlderMessages: false,
      });
    }
  },

  sendMessage: async (content) => {
    const trimmedContent = content.trim();
    const activeConversationId = get().activeConversationId;
    if (!trimmedContent || !activeConversationId) {
      return;
    }

    const clientId = `local-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: clientId,
      conversationId: activeConversationId,
      content: trimmedContent,
      sender: 'agent',
      channel: get().conversations.find((item) => item.id === activeConversationId)?.channel ?? 'unknown',
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      isSending: true,
      activeMessages: [...state.activeMessages, optimisticMessage],
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [activeConversationId]: [
          ...(state.messagesByConversationId[activeConversationId] ?? state.activeMessages),
          optimisticMessage,
        ],
      },
      conversations: state.conversations.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              lastMessage: trimmedContent,
              lastMessageAt: optimisticMessage.createdAt,
              status: 'sending',
            }
          : conversation
      ),
    }));

    try {
      const currentUser = useAuthStore.getState().user;
      const sentMessage = await sendChatMessage({
        conversationId: activeConversationId,
        message: trimmedContent,
        content: trimmedContent,
        clientId,
        humanAgentId: currentUser?.id,
      });

      set((state) => ({
        isSending: false,
        activeMessages: state.activeMessages.map((message) =>
          message.id === clientId ? { ...optimisticMessage, ...sentMessage, status: sentMessage.status ?? 'sent' } : message
        ),
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [activeConversationId]: (state.messagesByConversationId[activeConversationId] ?? state.activeMessages).map((message) =>
            message.id === clientId ? { ...optimisticMessage, ...sentMessage, status: sentMessage.status ?? 'sent' } : message
          ),
        },
        conversations: state.conversations.map((conversation) =>
          conversation.id === activeConversationId ? { ...conversation, status: 'sent' } : conversation
        ),
      }));
    } catch (error) {
      set((state) => ({
        isSending: false,
        activeMessages: state.activeMessages.map((message) =>
          message.id === clientId ? { ...message, status: 'failed' } : message
        ),
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [activeConversationId]: (state.messagesByConversationId[activeConversationId] ?? state.activeMessages).map((message) =>
            message.id === clientId ? { ...message, status: 'failed' } : message
          ),
        },
        conversations: state.conversations.map((conversation) =>
          conversation.id === activeConversationId ? { ...conversation, status: 'failed' } : conversation
        ),
        error: getErrorMessage(error, 'Message failed to send.'),
      }));
    }
  },

  sendAttachment: async (asset, caption?: string) => {
    const activeConversationId = get().activeConversationId;
    if (!activeConversationId || !asset.uri) {
      return;
    }

    const optimisticMessageId = `optimistic-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticMessageId,
      conversationId: activeConversationId,
      content: caption || asset.name || 'Attachment',
      sender: 'agent',
      channel: get().conversations.find((c) => c.id === activeConversationId)?.channel || 'whatsapp',
      status: 'sending',
      createdAt: new Date().toISOString(),
      mediaId: asset.uri, // Use local URI for preview
      mediaType: asset.mimeType?.startsWith('image/') ? 'image' 
               : asset.mimeType?.startsWith('video/') ? 'video' 
               : asset.mimeType?.startsWith('audio/') ? 'audio' 
               : 'document',
      mediaMimeType: asset.mimeType ?? undefined,
      mediaFilename: asset.name,
      mediaCaption: caption,
    };

    set((state) => ({
      isUploadingAttachment: true,
      error: null,
      activeMessages: [...state.activeMessages, optimisticMessage],
    }));

    try {
      const conversation = get().conversations.find((c) => c.id === activeConversationId);
      const rawChannel = conversation?.waBackendChannel || 'personal';
      const apiChannel = rawChannel === 'waba' ? 'waba' : 'personal';

      let mediaType = 'document';
      if (asset.mimeType?.startsWith('image/')) mediaType = 'image';
      else if (asset.mimeType?.startsWith('video/')) mediaType = 'video';
      else if (asset.mimeType?.startsWith('audio/')) mediaType = 'audio';

      if (Platform.OS !== 'web') {
        // Native: XMLHttpRequest with { uri, name, type } FormData entry.
        // React Native's OkHttp layer reads file:// URIs natively — no extra package needed.
        // copyToCacheDirectory:true in the picker guarantees a file:// URI.
        const token = await getAuthToken();
        const wapaBase = (process.env.EXPO_PUBLIC_WAPA_SERVICE_URL || 'https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app').replace(/\/+$/, '');
        const bniBase = (process.env.EXPO_PUBLIC_BNI_SERVICE_URL || process.env.EXPO_PUBLIC_WHATSAPP_API_URL || 'https://lad-waba-comms-develop-asia-160078175457.asia-south1.run.app').replace(/\/+$/, '');
        const uploadBase = apiChannel === 'waba' ? bniBase : wapaBase;
        const uploadPath = apiChannel === 'waba'
          ? '/api/conversations/upload-media'
          : '/api/whatsapp-conversations/conversations/upload-media';
        const uploadUrl = `${uploadBase}${uploadPath}?channel=${apiChannel}`;

        const nativeForm = new FormData();
        nativeForm.append('file', {
          uri: asset.uri,
          name: asset.name || `attachment-${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
        } as any);
        nativeForm.append('conversationId', activeConversationId);
        nativeForm.append('type', mediaType);
        if (caption) nativeForm.append('caption', caption);

        const uploadResult = await new Promise<{ status: number; body: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl);
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.timeout = 60000;
          xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          xhr.send(nativeForm);
        });

        if (uploadResult.status >= 400) {
          let errMsg = 'Failed to upload media.';
          try {
            const errBody = JSON.parse(uploadResult.body) as Record<string, unknown>;
            errMsg = String(errBody.message || errBody.error || errMsg);
          } catch {}
          throw new Error(errMsg);
        }

        let uploadData: Record<string, unknown> = {};
        try { uploadData = JSON.parse(uploadResult.body) as Record<string, unknown>; } catch {}
        const nested = uploadData?.data as Record<string, unknown> | undefined;
        const uploadedMediaId = String(nested?.media_id ?? uploadData?.media_id ?? uploadData?.url ?? '');

        if (!uploadedMediaId) {
          throw new Error('Media upload did not return a media ID.');
        }

        await sendChatMessage({
          conversationId: activeConversationId,
          message: caption || asset.name || 'Media',
          content: uploadedMediaId,
          role: 'user',
          type: mediaType as any,
          mediaId: uploadedMediaId,
          mediaType: mediaType as any,
          mediaFilename: asset.name || `attachment-${Date.now()}`,
          mediaCaption: caption || undefined,
        });
      } else {
        // Web: use FormData + fetch approach via the local proxy
        const formData = new FormData();
        formData.append('conversationId', activeConversationId);
        formData.append('channel', apiChannel);
        if (caption) formData.append('caption', caption);
        formData.append('type', mediaType);

        let fileData: any = (asset as any).file;
        if (!fileData) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const effectiveMimeType = blob.type || asset.mimeType || asset.type || 'application/octet-stream';
          let fileName = asset.name || `attachment-${Date.now()}`;
          if (effectiveMimeType.startsWith('audio/webm') && fileName.endsWith('.m4a')) {
            fileName = fileName.replace(/\.m4a$/, '.webm');
          } else if (effectiveMimeType.startsWith('audio/ogg') && fileName.endsWith('.m4a')) {
            fileName = fileName.replace(/\.m4a$/, '.ogg');
          }
          fileData = new File([blob], fileName, { type: effectiveMimeType });
        }
        formData.append('file', fileData);
        await sendMessageWithAttachment(formData);
      }
      
      // Cleanup optimistic message (it will be replaced by socket message, but we also refresh)
      set((state) => ({
        isUploadingAttachment: false,
        activeMessages: state.activeMessages.filter(m => m.id !== optimisticMessageId)
      }));
      
      await get().setActiveConversation(activeConversationId, { force: true });
    } catch (error) {
      set((state) => ({
        isUploadingAttachment: false,
        activeMessages: state.activeMessages.filter(m => m.id !== optimisticMessageId),
        error: getErrorMessage(error, 'Attachment failed to upload.'),
      }));
    }
  },

  sendChannelMessage: async (payload) => {
    await sendChannelMessageRequest(payload);
  },

  emitTypingState: (isTyping) => {
    const activeConversationId = get().activeConversationId;
    if (!activeConversationId) {
      return;
    }

    getSocket().emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: activeConversationId,
      conversation_id: activeConversationId,
    });
  },

  clearConversationMessages: (conversationId) => {
    set((state) => ({
      activeMessages: state.activeConversationId === conversationId ? [] : state.activeMessages,
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: [],
      },
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, lastMessage: 'No messages yet', unreadCount: 0 }
          : conversation
      ),
    }));
  },

  clearActiveConversation: () => {
    const activeConversationId = get().activeConversationId;
    if (activeConversationId) {
      getSocket().emit('leave', activeConversationId);
    }

    set({ activeConversationId: null, activeMessages: [], hasOlderMessages: true });
  },

  markConversationRead: (conversationId) => {
    localReadOverrides.add(conversationId);
    set((state) => ({
      conversations: markConversationReadLocally(state.conversations, conversationId),
    }));
    // Keep the local override until a new incoming message clears it — a 2xx here
    // doesn't guarantee the backend actually reset unread_count (e.g. the request
    // may have been served by a backend that ignores the read side effect).
    void markConversationReadRequest(conversationId).catch(() => undefined);
  },

  disposeRealtime: () => {
    const socket = getSocket();
    socket.off('conversation:new');
    socket.off('conversation:updated');
    socket.off('notification:new');
    socket.off('message:new');
    socket.off('message:status');
    socket.off('conversation:read');
    socket.off('conversation:activity');
    socket.off('typing:start');
    socket.off('typing:stop');
    socket.off('connect');
    socket.off('connect_error');
    get().stopConversationAutoSync();
    listenersAttached = false;
  },

  reset: () => {
    localReadOverrides.clear();
    set({
      conversations: [],
      activeConversationId: null,
      activeMessages: [],
      messagesByConversationId: {},
      isLoadingConversations: true,
      isLoadingMoreConversations: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isSending: false,
      isUploadingAttachment: false,
      isSyncing: false,
      isLoadingIntegrations: false,
      error: null,
      syncError: null,
      lastSyncedAt: null,
      conversationPage: 1,
      hasMoreConversations: true,
      hasOlderMessages: true,
      connectedIntegrations: [],
      typingConversationIds: {},
    });
  },
}));
