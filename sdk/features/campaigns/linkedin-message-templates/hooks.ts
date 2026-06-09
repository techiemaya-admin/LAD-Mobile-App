/**
 * LinkedIn Message Templates - React Query Hooks
 * 
 * Custom hooks using TanStack Query for data fetching and mutations.
 * Integrates with localStorage for performance caching.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { 
  LinkedInMessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters
} from './types';
import {
  linkedInMessageTemplateKeys,
  getMessageTemplatesQueryOptions,
  getMessageTemplateByIdQueryOptions,
  getDefaultMessageTemplateQueryOptions,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  saveTemplatesToLocalStorage,
  loadTemplatesFromLocalStorage,
  clearTemplatesFromLocalStorage,
} from './api';

/**
 * Hook to get all message templates
 * Integrates with localStorage for caching
 */
export function useMessageTemplates(filters?: TemplateFilters) {
  const query = useQuery({
    ...getMessageTemplatesQueryOptions(filters),
    placeholderData: () => {
      // Try to load from localStorage while fetching
      const cached = loadTemplatesFromLocalStorage();
      if (cached) {
        // Apply filters to cached data
        if (filters?.is_active !== undefined) {
          return cached.filter(t => t.is_active === filters.is_active);
        }
        if (filters?.category) {
          return cached.filter(t => t.category === filters.category);
        }
        return cached;
      }
      return undefined;
    },
  });

  // Save to localStorage on successful fetch
  if (query.isSuccess && query.data && !filters) {
    // Only save unfiltered results to avoid partial caching
    saveTemplatesToLocalStorage(query.data);
  }

  return query;
}

/**
 * Hook to get single template by ID
 */
export function useMessageTemplate(id: string) {
  return useQuery(getMessageTemplateByIdQueryOptions(id));
}

/**
 * Hook to get default template
 */
export function useDefaultMessageTemplate() {
  return useQuery(getDefaultMessageTemplateQueryOptions());
}

/**
 * Hook to create new template
 */
export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => createMessageTemplate(data),
    onSuccess: (newTemplate) => {
      // Invalidate all lists
      queryClient.invalidateQueries({ 
        queryKey: linkedInMessageTemplateKeys.lists() 
      });
      
      // Invalidate default query if this is now the default
      if (newTemplate.is_default) {
        queryClient.invalidateQueries({ 
          queryKey: linkedInMessageTemplateKeys.default() 
        });
      }

      // Clear localStorage to force refetch
      clearTemplatesFromLocalStorage();
    },
  });
}

/**
 * Hook to update template
 */
export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) => 
      updateMessageTemplate(id, data),
    onSuccess: (updatedTemplate) => {
      // Update specific template in cache
      queryClient.setQueryData(
        linkedInMessageTemplateKeys.detail(updatedTemplate.id),
        updatedTemplate
      );

      // Invalidate all lists
      queryClient.invalidateQueries({ 
        queryKey: linkedInMessageTemplateKeys.lists() 
      });

      // Invalidate default query if default status changed
      if (updatedTemplate.is_default) {
        queryClient.invalidateQueries({ 
          queryKey: linkedInMessageTemplateKeys.default() 
        });
      }

      // Clear localStorage to force refetch
      clearTemplatesFromLocalStorage();
    },
  });
}

/**
 * Hook to delete template
 */
export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMessageTemplate(id),
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ 
        queryKey: linkedInMessageTemplateKeys.detail(deletedId) 
      });

      // Invalidate all lists
      queryClient.invalidateQueries({ 
        queryKey: linkedInMessageTemplateKeys.lists() 
      });

      // Invalidate default query (deleted template might have been default)
      queryClient.invalidateQueries({ 
        queryKey: linkedInMessageTemplateKeys.default() 
      });

      // Clear localStorage to force refetch
      clearTemplatesFromLocalStorage();
    },
  });
}

/**
 * Hook to personalize a message with lead data
 */
export function usePersonalizeMessage() {
  return (
    message: string | null,
    leadData: {
      first_name?: string;
      last_name?: string;
      company?: string;
      title?: string;
      location?: string;
    }
  ): string | null => {
    if (!message) return null;

    let personalized = message;

    // Replace variables with lead data
    if (leadData.first_name) {
      personalized = personalized.replace(/\{\{first_name\}\}/gi, leadData.first_name);
    }
    if (leadData.last_name) {
      personalized = personalized.replace(/\{\{last_name\}\}/gi, leadData.last_name);
    }
    if (leadData.first_name && leadData.last_name) {
      const fullName = `${leadData.first_name} ${leadData.last_name}`;
      personalized = personalized.replace(/\{\{full_name\}\}/gi, fullName);
    }
    if (leadData.company) {
      personalized = personalized.replace(/\{\{company\}\}/gi, leadData.company);
    }
    if (leadData.title) {
      personalized = personalized.replace(/\{\{title\}\}/gi, leadData.title);
    }
    if (leadData.location) {
      personalized = personalized.replace(/\{\{location\}\}/gi, leadData.location);
    }

    return personalized;
  };
}

/**
 * Hook to validate message length
 */
export function useValidateMessageLength() {
  const CONNECTION_MESSAGE_MAX_LENGTH = 300;

  return {
    validateConnectionMessage: (message: string): { valid: boolean; error?: string } => {
      if (!message) {
        return { valid: true };
      }

      if (message.length > CONNECTION_MESSAGE_MAX_LENGTH) {
        return {
          valid: false,
          error: `Connection message must be ${CONNECTION_MESSAGE_MAX_LENGTH} characters or less (LinkedIn limit). Current: ${message.length} characters.`,
        };
      }

      return { valid: true };
    },
    CONNECTION_MESSAGE_MAX_LENGTH,
  };
}
