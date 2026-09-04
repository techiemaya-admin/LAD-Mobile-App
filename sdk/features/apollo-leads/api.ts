/**
 * Apollo Leads Feature - API Functions
 * 
 * All HTTP API calls for the Apollo Leads feature.
 * LAD Architecture Compliant - Uses shared apiClient
 */
import { apiClient } from '../../shared/apiClient';
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://lad-backend-develop-160078175457.us-central1.run.app';
const BASE_PATH = `${API_BASE_URL}/api/apollo-leads`;
/**
 * Search companies using Apollo.io
 */
export async function searchCompanies(params: {
  query?: string;
  keywords?: string[];
  location?: string;
  industry?: string[];
  limit?: number;
  offset?: number;
}) {
  const response = await apiClient.post(`${BASE_PATH}/search`, params);
  return response.data;
}
/**
 * Get company details
 */
export async function getCompanyDetails(companyId: string) {
  const response = await apiClient.get(`${BASE_PATH}/companies/${companyId}`);
  return response.data;
}
/**
 * Search employees at a company
 */
export async function searchEmployees(params: {
  company_id?: string;
  company_name?: string;
  titles?: string[];
  seniority?: string[];
  departments?: string[];
  location?: string;
  limit?: number;
}) {
  const response = await apiClient.post(`${BASE_PATH}/employees/search`, params);
  return response.data;
}
/**
 * Reveal email for a person (costs 1 credit)
 */
export async function revealEmail(personId: string): Promise<string> {
  const response = await apiClient.get(`${BASE_PATH}/leads/${personId}/email`);
  return response.data.email;
}
/**
 * Reveal phone for a person (costs 8 credits)
 */
export async function revealPhone(personId: string): Promise<string> {
  const response = await apiClient.get(`${BASE_PATH}/leads/${personId}/phone`);
  return response.data.phone;
}
/**
 * Health check for Apollo service
 */
export async function checkHealth() {
  const response = await apiClient.get(`${BASE_PATH}/health`);
  return response.data;
}
/**
 * Search employees from database cache
 */
export async function searchEmployeesFromDb(params: {
  organization_locations?: string[];
  person_titles?: string[];
  organization_industries?: string[];
  per_page?: number;
  page?: number;
}) {
  const response = await apiClient.post(`${BASE_PATH}/search-employees-from-db`, params);
  return response.data;
}
/**
 * Reveal email via POST endpoint
 */
export async function revealEmailPost(params: {
  person_id: string;
  employee_name?: string;
}) {
  const response = await apiClient.post(`${BASE_PATH}/reveal-email`, params);
  return response.data;
}
/**
 * Reveal phone via POST endpoint
 */
export async function revealPhonePost(params: {
  person_id: string;
  employee_name?: string;
}) {
  const response = await apiClient.post(`${BASE_PATH}/reveal-phone`, params);
  return response.data;
}
/**
 * Get decision maker phone numbers for a list of contacts
 * LAD Architecture: Phone reveal functionality
 */
export async function getDecisionMakerPhones(request: {
  contacts: Array<{
    id: string;
    name: string;
    company?: string;
    title?: string;
  }>;
}) {
  const response = await apiClient.post(`${BASE_PATH}/get-decision-maker-phones`, request);
  return response.data;
}
/**
 * Reveal a single phone number
 */
export async function revealSinglePhone(
  contactId: string,
  name: string,
  company?: string,
  title?: string
): Promise<string | null> {
  const response = await getDecisionMakerPhones({
    contacts: [{ id: contactId, name, company, title }]
  });
  if (response.results && response.results.length > 0) {
    const result = response.results[0];
    if (result.phone) {
      return result.phone;
    }
    if (result.error) {
      throw new Error(result.error);
    }
  }
  return null;
}
