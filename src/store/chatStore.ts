import { create } from 'zustand';
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
  fetchConversations: () => Promise<void>;
  fetchMoreConversations: () => Promise<void>;
  syncConversations: (options?: { silent?: boolean }) => Promise<void>;
  startConversationAutoSync: () => void;
  stopConversationAutoSync: () => void;
  setActiveConversation: (conversationId: string) => Promise<void>;
  getOlderMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendAttachment: (asset: AttachmentAsset) => Promise<void>;
  sendChannelMessage: (payload: Record<string, unknown>) => Promise<void>;
  emitTypingState: (isTyping: boolean) => void;
  clearActiveConversation: () => void;
  markConversationRead: (conversationId: string) => void;
  disposeRealtime: () => void;
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
  isLoadingConversations: false,
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
        .filter((message: ChatMessage) => message.content);
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
          activeMessages: shouldAppend ? sortMessages([...state.activeMessages, ...appendedMessages]) : state.activeMessages,
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

      set((state) => {
        const hasMessage = state.activeMessages.some((item) => item.id === message.id);
        const shouldIncrementUnread = state.activeConversationId !== conversationId && !isOwnMessage;

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
          activeMessages:
            state.activeConversationId === conversationId && message.content && !hasMessage
              ? [...state.activeMessages, message]
              : state.activeMessages,
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

        return {
          conversations,
          activeMessages:
            state.activeConversationId === message.conversationId && !hasMessage
              ? [...state.activeMessages, message]
              : state.activeMessages,
        };
      });
    });

    socket.on('message:status', (payload) => {
      set((state) => ({
        activeMessages: updateMessageStatus(state.activeMessages, payload),
        conversations: state.conversations.map((conversation) =>
          conversation.id === String(payload.conversationId ?? payload.conversation_id ?? '')
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

  fetchConnectedIntegrations: async () => {
    set({ isLoadingIntegrations: true, syncError: null });
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

  fetchConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const conversations = await loadAllConversationPages();
      set((state) => ({
        conversations: conversations.length ? conversations : state.conversations,
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
    if (!options.silent) {
      set({ isSyncing: true, syncError: null, error: null });
    }

    try {
      const conversations = await loadAllConversationPages();

      set((state) => ({
        conversations: conversations.length ? conversations : state.conversations,
        connectedIntegrations: state.connectedIntegrations,
        conversationPage: 1,
        hasMoreConversations: false,
        isSyncing: false,
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
    }, 30000);
  },

  stopConversationAutoSync: () => {
    if (conversationSyncTimer) {
      clearInterval(conversationSyncTimer);
      conversationSyncTimer = null;
    }
  },

  fetchMoreConversations: async () => {
    const { conversationPage, hasMoreConversations, isLoadingConversations, isLoadingMoreConversations } = get();
    if (!hasMoreConversations || isLoadingConversations || isLoadingMoreConversations) {
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

      set({
        error: getErrorMessage(error, 'Unable to load more conversations.'),
        isLoadingMoreConversations: false,
      });
    }
  },

  setActiveConversation: async (conversationId) => {
    const requestId = activeMessageRequest + 1;
    activeMessageRequest = requestId;
    const socket = getSocket();
    const previousConversationId = get().activeConversationId;
    if (previousConversationId && previousConversationId !== conversationId) {
      socket.emit('leave', previousConversationId);
    }

    socket.emit('join', conversationId);
    set({
      activeConversationId: conversationId,
      activeMessages: [],
      isLoadingMessages: true,
      hasOlderMessages: true,
      error: null,
    });

    get().markConversationRead(conversationId);

    try {
      const detail = await getConversation(conversationId).catch(() => null);
      const messages = await loadAllMessagePages(conversationId, detail?.messages ?? []);

      if (requestId !== activeMessageRequest) {
        return;
      }

      set((state) => ({
        conversations: detail?.conversation?.id
          ? upsertConversation(state.conversations, detail.conversation)
          : state.conversations,
        activeMessages: sortMessages(messages),
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
        conversations: state.conversations.map((conversation) =>
          conversation.id === activeConversationId ? { ...conversation, status: 'failed' } : conversation
        ),
        error: getErrorMessage(error, 'Message failed to send.'),
      }));
    }
  },

  sendAttachment: async (asset) => {
    const activeConversationId = get().activeConversationId;
    if (!activeConversationId || !asset.uri) {
      return;
    }

    set({ isUploadingAttachment: true, error: null });

    try {
      const formData = new FormData();
      formData.append('conversationId', activeConversationId);
      formData.append('type', asset.mimeType?.startsWith('image/') ? 'image' : 'document');
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || `attachment-${Date.now()}`,
        type: asset.mimeType || asset.type || 'application/octet-stream',
      } as any);

      await sendMessageWithAttachment(formData);
      set({ isUploadingAttachment: false });
      await get().setActiveConversation(activeConversationId);
    } catch (error) {
      set({
        isUploadingAttachment: false,
        error: getErrorMessage(error, 'Attachment failed to upload.'),
      });
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

  clearActiveConversation: () => {
    const activeConversationId = get().activeConversationId;
    if (activeConversationId) {
      getSocket().emit('leave', activeConversationId);
    }

    set({ activeConversationId: null, activeMessages: [], hasOlderMessages: true });
  },

  markConversationRead: (conversationId) => {
    set((state) => ({
      conversations: markConversationReadLocally(state.conversations, conversationId),
    }));
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
}));
