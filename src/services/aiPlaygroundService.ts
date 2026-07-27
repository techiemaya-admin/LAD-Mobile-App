/**
 * AI Playground (ICP Discovery) service — mobile port of LAD-Frontend-2's
 * ICP Discovery drawer data layer.
 *
 * The web app proxies these routes through Next.js API handlers to the main
 * LAD backend; the mobile app calls the same backend paths directly:
 *   GET  /api/ai-playground          — load persisted business profile
 *   POST /api/ai-playground/chat     — one conversational turn ({ message })
 *   POST /api/ai-playground/reset    — restart the guided conversation
 *   POST /api/ai-playground/suggest  — AI suggestion for the active card field
 *
 * Field list + completeness math mirror sdk/features/ai-icp-assistant/businessProfile.ts
 * so mobile shows the same "X / N fields" number as the web drawer and Settings.
 */
import { apiGet, apiPost } from '@/src/api';

export type BusinessProfile = Record<string, string | undefined | unknown>;

export interface PlaygroundCard {
  field: string;
  label: string;
  type: 'text' | 'textarea' | 'chips' | 'radio' | 'tags' | 'hours' | string;
  placeholder?: string;
  options?: string[];
}

export interface PlaygroundChatTurn {
  role: 'user' | 'assistant';
  content: string;
  card?: PlaygroundCard | null;
}

export interface PlaygroundChatResponse {
  success?: boolean;
  reply?: string;
  card?: PlaygroundCard | null;
  profile?: BusinessProfile | null;
  isComplete?: boolean;
  error?: string;
}

/** Card fields that behave as single-select in chips mode (mirrors web). */
export const SINGLE_SELECT_CHIP_FIELDS = new Set(['icpCompanySize', 'campaignTone', 'timezone']);

const OPTIONAL_FIELDS = new Set([
  'website',
  'sampleConversation',
  'competitors',
  'contactEmail',
  'contactPhone',
  'personaName',
  'personaTitle',
  'bookingLink',
]);

const COMPANY_HALF = [
  'companyName',
  'industry',
  'website',
  'valueProposition',
  'productsServices',
  'targetCustomers',
  'personaName',
  'personaTitle',
  'bookingLink',
  'contactEmail',
  'contactPhone',
];

const ICP_HALF = [
  'companyDescription',
  'icpJobTitles',
  'icpCompanySize',
  'icpLocations',
  'icpPainPoints',
  'sampleConversation',
  'operatingHours',
  'timezone',
  'geographicFocus',
  'competitors',
  'campaignTone',
];

export const BUSINESS_PROFILE_ALL_FIELDS = [...COMPANY_HALF, ...ICP_HALF];

export interface BusinessProfileCompleteness {
  filled: number;
  total: number;
  pct: number;
}

export function computeCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const required = BUSINESS_PROFILE_ALL_FIELDS.filter((key) => !OPTIONAL_FIELDS.has(key));
  const total = required.length;
  if (!profile || total === 0) return { filled: 0, total, pct: 0 };
  let filled = 0;
  for (const key of required) {
    const value = profile[key];
    if (typeof value === 'string' && value.trim().length > 0) filled += 1;
  }
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

export function hasAnyProfileData(profile: BusinessProfile | null | undefined): boolean {
  if (!profile) return false;
  return BUSINESS_PROFILE_ALL_FIELDS.some((key) => {
    const value = profile[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const response = await apiGet<{ success?: boolean; profile?: BusinessProfile | null }>('/api/ai-playground');
  return response.data?.profile ?? null;
}

export async function playgroundChat(message: string): Promise<PlaygroundChatResponse> {
  const response = await apiPost<PlaygroundChatResponse>('/api/ai-playground/chat', { message });
  return response.data ?? {};
}

export async function playgroundReset(): Promise<void> {
  await apiPost('/api/ai-playground/reset', {});
}

export async function playgroundSuggest(body: {
  field: string;
  label?: string;
  placeholder?: string;
  profile: BusinessProfile;
}): Promise<string | null> {
  const response = await apiPost<{ success?: boolean; suggestion?: string }>('/api/ai-playground/suggest', body);
  const data = response.data;
  return data?.success && data.suggestion ? data.suggestion : null;
}
