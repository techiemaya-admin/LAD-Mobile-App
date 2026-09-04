/**
 * LinkedIn Message Templates - TypeScript Type Definitions
 */

/**
 * LinkedIn Message Template
 */
export interface LinkedInMessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  connection_message: string | null;
  followup_message: string | null;
  category: string | null;
  tags: string[] | null;
  is_default: boolean;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

/**
 * Request to create new template
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  connection_message?: string;
  followup_message?: string;
  category?: string;
  tags?: string[];
  is_default?: boolean;
  is_active?: boolean;
}

/**
 * Request to update template
 */
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  connection_message?: string;
  followup_message?: string;
  category?: string;
  tags?: string[];
  is_default?: boolean;
  is_active?: boolean;
}

/**
 * Filters for querying templates
 */
export interface TemplateFilters {
  is_active?: boolean;
  category?: string;
}

/**
 * Template with personalized messages (for preview)
 */
export interface PersonalizedTemplate {
  template: LinkedInMessageTemplate;
  personalizedConnectionMessage: string | null;
  personalizedFollowupMessage: string | null;
}

/**
 * Template category options
 */
export const TEMPLATE_CATEGORIES = [
  'sales',
  'recruiting',
  'networking',
  'partnership',
  'custom'
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

/**
 * Variable placeholders for personalization
 */
export const MESSAGE_VARIABLES = {
  FIRST_NAME: '{{first_name}}',
  LAST_NAME: '{{last_name}}',
  FULL_NAME: '{{full_name}}',
  COMPANY: '{{company}}',
  TITLE: '{{title}}',
  LOCATION: '{{location}}',
} as const;

/**
 * LinkedIn connection message character limit
 */
export const CONNECTION_MESSAGE_MAX_LENGTH = 300;
