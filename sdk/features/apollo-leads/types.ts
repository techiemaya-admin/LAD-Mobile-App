/**
 * Apollo Feature Types
 * 
 * Comprehensive TypeScript definitions for Apollo.io integration
 */
// ============================================================================
// COMPANY TYPES
// ============================================================================
export interface ApolloCompany {
  id: string;
  name: string;
  website?: string;
  domain?: string;
  industry?: string;
  description?: string;
  founded_year?: number;
  employee_count?: number;
  revenue?: string;
  location?: ApolloLocation;
  social_profiles?: ApolloSocialProfiles;
  technologies?: string[];
  keywords?: string[];
  logo_url?: string;
}
export interface ApolloLocation {
  city?: string;
  state?: string;
  country?: string;
  street_address?: string;
  postal_code?: string;
}
export interface ApolloSocialProfiles {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
}
// ============================================================================
// EMPLOYEE/PERSON TYPES
// ============================================================================
export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company?: ApolloCompany;
  location?: ApolloLocation;
  seniority?: string;
  department?: string[];
}
// ============================================================================
// SEARCH TYPES
// ============================================================================
export interface ApolloSearchParams {
  query?: string;
  keywords?: string[];
  location?: string;
  industry?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  revenue_min?: number;
  revenue_max?: number;
  technologies?: string[];
  limit?: number;
  offset?: number;
}
export interface ApolloSearchResponse {
  companies: ApolloCompany[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
export interface ApolloEmployeeSearchParams {
  company_id?: string;
  company_name?: string;
  titles?: string[];
  seniority?: string[];
  departments?: string[];
  location?: string;
  limit?: number;
}
export interface ApolloEmployeeSearchResponse {
  employees: ApolloPerson[];
  total: number;
  page: number;
  limit: number;
}
// ============================================================================
// CREDIT & BILLING TYPES
// ============================================================================
export interface ApolloCredits {
  available: number;
  used: number;
  total: number;
  costs: {
    search: number;
    email_reveal: number;
    phone_reveal: number;
  };
}
export interface ApolloUsageRecord {
  id: string;
  operation: 'search' | 'email_reveal' | 'phone_reveal';
  credits_used: number;
  timestamp: string;
  user_id: string;
  details?: any;
}
// ============================================================================
// API RESPONSE TYPES
// ============================================================================
export interface ApolloApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  credits_used?: number;
  credits_remaining?: number;
}
export interface ApolloHealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  feature: string;
  version: string;
  client_id?: string;
}
// ============================================================================
// FEATURE FLAG TYPES
// ============================================================================
export interface ApolloFeatureAccess {
  enabled: boolean;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  credits_available: number;
  upgrade_required: boolean;
  message?: string;
}
// ============================================================================
// HOOK RETURN TYPES
// ============================================================================
export interface UseApolloLeadsReturn {
  searchCompanies: (params: ApolloSearchParams) => Promise<ApolloSearchResponse>;
  searchEmployees: (params: ApolloEmployeeSearchParams) => Promise<ApolloEmployeeSearchResponse>;
  revealEmail: (personId: string) => Promise<string>;
  revealPhone: (personId: string) => Promise<string>;
  checkHealth: () => Promise<ApolloHealthResponse>;
  loading: boolean;
  error: string | null;
  credits: ApolloCredits | null;
}
export interface UseApolloSearchReturn {
  results: ApolloCompany[];
  loading: boolean;
  error: string | null;
  search: (params: ApolloSearchParams) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  total: number;
}
export interface UseApolloCreditsReturn {
  credits: ApolloCredits | null;
  loading: boolean;
  refresh: () => Promise<void>;
  canAfford: (operation: 'search' | 'email_reveal' | 'phone_reveal') => boolean;
}
// ============================================================================
// SERVICE TYPES
// ============================================================================
export interface ApolloLeadsServiceInterface {
  searchCompanies(params: ApolloSearchParams): Promise<ApolloSearchResponse>;
  getCompanyDetails(companyId: string): Promise<ApolloCompany>;
  searchEmployees(params: ApolloEmployeeSearchParams): Promise<ApolloEmployeeSearchResponse>;
  revealEmail(personId: string): Promise<string>;
  revealPhone(personId: string): Promise<string>;
  checkHealth(): Promise<ApolloHealthResponse>;
}
// ============================================================================
// COMPONENT PROPS
// ============================================================================
export interface ApolloLeadsSearchProps {
  onCompanySelect?: (company: ApolloCompany) => void;
  onEmployeeSelect?: (employee: ApolloPerson) => void;
  defaultParams?: Partial<ApolloSearchParams>;
  showFilters?: boolean;
  maxResults?: number;
}
export interface ApolloCompanyCardProps {
  company: ApolloCompany;
  onClick?: () => void;
  showActions?: boolean;
  showEmployees?: boolean;
}
export interface ApolloEmployeeListProps {
  companyId?: string;
  companyName?: string;
  filters?: ApolloEmployeeSearchParams;
  onEmployeeSelect?: (employee: ApolloPerson) => void;
  showRevealActions?: boolean;
}
// ============================================================================
// PHONE SERVICE TYPES
// ============================================================================
export interface PhoneRevealRequest {
  contacts: Array<{
    id: string;
    name: string;
    company?: string;
    title?: string;
  }>;
}
export interface PhoneRevealResponse {
  success: boolean;
  results: Array<{
    contact_id: string;
    phone?: string;
    error?: string;
    credits_used: number;
  }>;
  total_credits_used: number;
  credits_remaining: number;
}