/**
 * Conversations Feature - SDK Exports
 * 
 * Central export point for all conversations-related functionality.
 * 
 * USAGE:
 * ```typescript
 * import { useConversations, type Conversation } from '@/sdk/features/conversations';
 * ```
 */

// Hooks
export { useConversations } from './hooks';
export type { UseConversationsReturn } from './types';

// Types
export type {
  Channel,
  ConversationStatus,
  MessageStatus,
  Contact,
  Message,
  Attachment,
  Conversation,
} from './types';
