/**
 * LinkedIn Message Templates Feature - API Functions
 * 
 * All HTTP API calls for LinkedIn message templates.
 * Uses the shared apiClient for consistent request handling.
 */
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '../../../shared/apiClient';
import type {
  LinkedInMessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters
} from './types';

// Query keys for TanStack Query
export const linkedInMessageTemplateKeys = {
  all: ['linkedin-message-templates'] as const,
  lists: () => [...linkedInMessageTemplateKeys.all, 'list'] as const,
  list: (filters?: TemplateFilters) => [...linkedInMessageTemplateKeys.lists(), filters] as const,
  details: () => [...linkedInMessageTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...linkedInMessageTemplateKeys.details(), id] as const,
  default: () => [...linkedInMessageTemplateKeys.all, 'default'] as const,
} as const;

// ====================
// Core API Functions
// ====================

/**
 * Get all message templates
 */
export async function getMessageTemplates(filters?: TemplateFilters): Promise<LinkedInMessageTemplate[]> {
  const params: Record<string, string> = {};
  if (filters?.is_active !== undefined) params.is_active = String(filters.is_active);
  if (filters?.category) params.category = filters.category;
  
  const response = await apiClient.get<{ 
    success: boolean; 
    data: LinkedInMessageTemplate[];
    count: number;
  }>('/api/campaigns/linkedin/message-templates', { params });
  
  return response.data.data || [];
}

/**
 * Query options for getting all templates
 */
export function getMessageTemplatesQueryOptions(filters?: TemplateFilters) {
  return queryOptions({
    queryKey: linkedInMessageTemplateKeys.list(filters),
    queryFn: () => getMessageTemplates(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get single template by ID
 */
export async function getMessageTemplateById(id: string): Promise<LinkedInMessageTemplate> {
  const response = await apiClient.get<{ 
    success: boolean; 
    data: LinkedInMessageTemplate;
  }>(`/api/campaigns/linkedin/message-templates/${id}`);
  
  return response.data.data;
}

/**
 * Query options for getting template by ID
 */
export function getMessageTemplateByIdQueryOptions(id: string) {
  return queryOptions({
    queryKey: linkedInMessageTemplateKeys.detail(id),
    queryFn: () => getMessageTemplateById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

/**
 * Get default template
 */
export async function getDefaultMessageTemplate(): Promise<LinkedInMessageTemplate | null> {
  try {
    const response = await apiClient.get<{ 
      success: boolean; 
      data: LinkedInMessageTemplate;
    }>('/api/campaigns/linkedin/message-templates/default');
    
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Query options for getting default template
 */
export function getDefaultMessageTemplateQueryOptions() {
  return queryOptions({
    queryKey: linkedInMessageTemplateKeys.default(),
    queryFn: () => getDefaultMessageTemplate(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create new message template
 */
export async function createMessageTemplate(data: CreateTemplateRequest): Promise<LinkedInMessageTemplate> {
  const response = await apiClient.post<{ 
    success: boolean; 
    data: LinkedInMessageTemplate;
  }>('/api/campaigns/linkedin/message-templates', data);
  
  return response.data.data;
}

/**
 * Update existing message template
 */
export async function updateMessageTemplate(
  id: string, 
  data: UpdateTemplateRequest
): Promise<LinkedInMessageTemplate> {
  const response = await apiClient.put<{ 
    success: boolean; 
    data: LinkedInMessageTemplate;
  }>(`/api/campaigns/linkedin/message-templates/${id}`, data);
  
  return response.data.data;
}

/**
 * Delete message template
 */
export async function deleteMessageTemplate(id: string): Promise<void> {
  await apiClient.delete(`/api/campaigns/linkedin/message-templates/${id}`);
}

// ====================
// LocalStorage Utilities
// ====================

const STORAGE_KEY = 'linkedin_message_templates';

/**
 * Save templates to localStorage
 */
export function saveTemplatesToLocalStorage(templates: LinkedInMessageTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save templates to localStorage:', error);
  }
}

/**
 * Load templates from localStorage
 */
export function loadTemplatesFromLocalStorage(): LinkedInMessageTemplate[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Failed to load templates from localStorage:', error);
    return null;
  }
}

/**
 * Clear templates from localStorage
 */
export function clearTemplatesFromLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear templates from localStorage:', error);
  }
}
