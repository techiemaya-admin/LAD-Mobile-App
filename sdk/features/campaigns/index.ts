/**
 * Campaigns Feature - Frontend SDK Exports
 * 
 * Central export point for all campaigns-related frontend functionality.
 * Import from this file to use campaigns features in your application.
 * 
 * USAGE:
 * ```typescript
 * import { 
 *   useCampaigns,
 *   useCampaign,
 *   useCampaignStats,
 *   useCampaignAnalytics,
 *   useCampaignLeads,
 *   type Campaign,
 *   type CampaignStats
 * } from '@/sdk/features/campaigns';
 * ```
 */
// ============================================================================
// API FUNCTIONS
// ============================================================================
export {
  getCampaigns,
  getCampaign,
  getCampaignStats,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  stopCampaign,
  getCampaignAnalytics,
  getCampaignLeads,
  getLeadProfileSummary,
  generateLeadProfileSummary,
  getLeadsSummaries,
  revealLeadEmail,
  revealLeadPhone,
  revealLeadLinkedIn,
  saveInboundLeads,
  getInboundLeads,
  cancelLeadBookingsForReNurturing,
} from './api';

// ============================================================================
// HOOKS
// ============================================================================
export { useCampaigns } from './hooks/useCampaigns';
export { useCampaign } from './hooks/useCampaign';
export { useCampaignStats } from './hooks/useCampaignStats';
export { useCampaignAnalytics } from './hooks/useCampaignAnalytics';
export { useCampaignLeads } from './hooks/useCampaignLeads';
export { useLeadsSummaries } from './hooks/useLeadsSummaries';
export { useLeadProfileSummary, useGenerateLeadProfileSummary } from './hooks/useLeadProfileSummary';
export { useRevealLeadEmail, useRevealLeadPhone, useRevealLeadLinkedIn } from './hooks/useLeadReveal';
export { useSaveInboundLeads, useInboundLeads } from './hooks/useInboundLeads';
export { useCampaignActivityFeed } from './hooks/useCampaignActivityFeed';
// ============================================================================
// TYPES
// ============================================================================
export type {
  Campaign,
  CampaignStatus,
  CampaignStats,
  CampaignFilters,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignAnalytics,
  CampaignLead,
} from './types';
// ============================================================================
// HOOK RETURN TYPES
// ============================================================================
export type { UseCampaignsReturn } from './hooks/useCampaigns';
export type { UseCampaignReturn } from './hooks/useCampaign';
export type { UseCampaignStatsReturn } from './hooks/useCampaignStats';
export type { UseCampaignAnalyticsReturn } from './hooks/useCampaignAnalytics';
export type { UseCampaignLeadsReturn } from './hooks/useCampaignLeads';

// ============================================================================
// LINKEDIN MESSAGE TEMPLATES (Sub-Feature)
// ============================================================================
export {
  // Types
  type LinkedInMessageTemplate,
  type CreateTemplateRequest as CreateLinkedInTemplateRequest,
  type UpdateTemplateRequest as UpdateLinkedInTemplateRequest,
  type TemplateFilters as LinkedInTemplateFilters,
  type PersonalizedTemplate as PersonalizedLinkedInTemplate,
  type TemplateCategory as LinkedInTemplateCategory,
  TEMPLATE_CATEGORIES as LINKEDIN_TEMPLATE_CATEGORIES,
  MESSAGE_VARIABLES as LINKEDIN_MESSAGE_VARIABLES,
  CONNECTION_MESSAGE_MAX_LENGTH as LINKEDIN_CONNECTION_MESSAGE_MAX_LENGTH,
  // Hooks
  useMessageTemplates as useLinkedInMessageTemplates,
  useMessageTemplate as useLinkedInMessageTemplate,
  useDefaultMessageTemplate as useDefaultLinkedInMessageTemplate,
  useCreateMessageTemplate as useCreateLinkedInMessageTemplate,
  useUpdateMessageTemplate as useUpdateLinkedInMessageTemplate,
  useDeleteMessageTemplate as useDeleteLinkedInMessageTemplate,
  usePersonalizeMessage as usePersonalizeLinkedInMessage,
  useValidateMessageLength as useValidateLinkedInMessageLength,
  // API Functions
  linkedInMessageTemplateKeys,
  getMessageTemplates as getLinkedInMessageTemplates,
  getMessageTemplatesQueryOptions as getLinkedInMessageTemplatesQueryOptions,
  getMessageTemplateById as getLinkedInMessageTemplateById,
  getMessageTemplateByIdQueryOptions as getLinkedInMessageTemplateByIdQueryOptions,
  getDefaultMessageTemplate as getDefaultLinkedInMessageTemplate,
  getDefaultMessageTemplateQueryOptions as getDefaultLinkedInMessageTemplateQueryOptions,
  createMessageTemplate as createLinkedInMessageTemplate,
  updateMessageTemplate as updateLinkedInMessageTemplate,
  deleteMessageTemplate as deleteLinkedInMessageTemplate,
  saveTemplatesToLocalStorage as saveLinkedInTemplatesToLocalStorage,
  loadTemplatesFromLocalStorage as loadLinkedInTemplatesFromLocalStorage,
  clearTemplatesFromLocalStorage as clearLinkedInTemplatesFromLocalStorage,
} from './linkedin-message-templates';

