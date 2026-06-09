/**
 * Apollo Leads Feature - Frontend Exports
 * 
 * Central export point for all Apollo-related frontend functionality.
 * Import from this file to use Apollo features in your application.
 * 
 * USAGE:
 * ```typescript
 * import { 
 *   apolloLeadsService,
 *   useApolloLeads,
 *   ApolloLeadsSearch 
 * } from '@/features/apollo-leads';
 * ```
 */
// ============================================================================
// API FUNCTIONS
// ============================================================================
export {
  searchCompanies,
  getCompanyDetails,
  searchEmployees,
  revealEmail,
  revealPhone,
  checkHealth,
  searchEmployeesFromDb,
  revealEmailPost,
  revealPhonePost,
  getDecisionMakerPhones,
  revealSinglePhone
} from './api';
// ============================================================================
// HOOKS
// ============================================================================
export { useApolloLeads } from './hooks';
// Future hooks can be added here:
// export { useApolloSearch } from './hooks';
// export { useApolloCredits } from './hooks';
// ============================================================================
// TYPES
// ============================================================================
export type {
  // Company Types
  ApolloCompany,
  ApolloLocation,
  ApolloSocialProfiles,
  // Person Types
  ApolloPerson,
  // Search Types
  ApolloSearchParams,
  ApolloSearchResponse,
  ApolloEmployeeSearchParams,
  ApolloEmployeeSearchResponse,
  // Credit & Billing
  ApolloCredits,
  ApolloUsageRecord,
  // API Response Types
  ApolloApiResponse,
  ApolloHealthResponse,
  // Feature Access
  ApolloFeatureAccess,
  // Hook Return Types
  UseApolloLeadsReturn,
  UseApolloSearchReturn,
  UseApolloCreditsReturn,
  // Service Interface
  ApolloLeadsServiceInterface,
  // Component Props
  ApolloLeadsSearchProps,
  ApolloCompanyCardProps,
  ApolloEmployeeListProps,
  // Phone Service Types
  PhoneRevealRequest,
  PhoneRevealResponse
} from './types';
// ============================================================================
// CONSTANTS
// ============================================================================
export const APOLLO_CREDIT_COSTS = {
  SEARCH: 1,
  EMAIL_REVEAL: 1,
  PHONE_REVEAL: 8
} as const;
export const APOLLO_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
} as const;