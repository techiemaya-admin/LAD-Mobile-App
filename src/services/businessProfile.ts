import { apiGet, apiPost, apiPatch } from '@/src/api';
import { getAuthToken } from '@/src/api/storage';
import { API_URL } from '@/src/api/apiClient';

export type BusinessProfileData = {
  // Company Basics (workspace level)
  logoUrl: string;
  companyName: string;
  tagline: string;
  industry: string;
  website: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  companySize: string;
  // ICP / AI
  valueProposition: string;
  productsServices: string;
  targetCustomers: string;
  companyDescription: string;
  icpJobTitles: string;
  icpCompanySize: string;
  icpLocations: string;
  icpPainPoints: string;
  // Optional
  sampleConversation: string;
  operatingHours: string;
  businessHoursPayload?: any;
  timezone: string;
  geographicFocus: string;
  competitors: string;
  campaignTone: string;
};

export const emptyBusinessProfile = (): BusinessProfileData => ({
  logoUrl: '',
  companyName: '',
  tagline: '',
  industry: '',
  website: '',
  phone: '',
  email: '',
  city: '',
  country: '',
  companySize: '',
  valueProposition: '',
  productsServices: '',
  targetCustomers: '',
  companyDescription: '',
  icpJobTitles: '',
  icpCompanySize: '',
  icpLocations: '',
  icpPainPoints: '',
  sampleConversation: '',
  operatingHours: '',
  businessHoursPayload: undefined,
  timezone: '',
  geographicFocus: '',
  competitors: '',
  campaignTone: '',
});

// Attempt to read company data from the /api/workspace endpoint (what the web app uses),
// then merge with the AI playground icp_data.
export async function getBusinessProfile(): Promise<BusinessProfileData> {
  const empty = emptyBusinessProfile();
  let workspaceData: Partial<BusinessProfileData> = {};
  let icpData: Partial<BusinessProfileData> = {};

  try {
    const res = await apiGet<any>('/api/workspace');
    const raw = res.data?.company ?? res.data?.workspace ?? res.data ?? {};
    workspaceData = {
      logoUrl: raw.logo_url ?? raw.logoUrl ?? raw.company_logo ?? '',
      companyName: raw.company_name ?? raw.companyName ?? raw.name ?? '',
      tagline: raw.tagline ?? raw.headline ?? raw.slogan ?? '',
      industry: raw.industry ?? '',
      website: raw.website ?? raw.website_url ?? '',
      phone: raw.phone ?? raw.phone_number ?? '',
      email: raw.email ?? raw.company_email ?? '',
      city: raw.city ?? '',
      country: raw.country ?? '',
      companySize: raw.company_size ?? raw.companySize ?? raw.size ?? '',
    };
  } catch {
    // workspace endpoint may not exist — that's fine
  }

  try {
    const res = await apiGet<any>('/api/ai-playground');
    const raw = res.data?.icp_data ?? res.data ?? {};
    icpData = {
      logoUrl: raw.logoUrl ?? raw.logo_url ?? '',
      companyName: raw.companyName ?? raw.company_name ?? '',
      tagline: raw.tagline ?? '',
      industry: raw.industry ?? '',
      website: raw.website ?? '',
      phone: raw.phone ?? '',
      email: raw.email ?? '',
      city: raw.city ?? '',
      country: raw.country ?? '',
      companySize: raw.companySize ?? raw.company_size ?? '',
      valueProposition: raw.valueProposition ?? raw.value_proposition ?? '',
      productsServices: raw.productsServices ?? raw.products_services ?? '',
      targetCustomers: raw.targetCustomers ?? raw.target_customers ?? '',
      companyDescription: raw.companyDescription ?? raw.company_description ?? '',
      icpJobTitles: raw.icpJobTitles ?? raw.icp_job_titles ?? '',
      icpCompanySize: raw.icpCompanySize ?? raw.icp_company_size ?? '',
      icpLocations: raw.icpLocations ?? raw.icp_locations ?? '',
      icpPainPoints: raw.icpPainPoints ?? raw.icp_pain_points ?? '',
      sampleConversation: raw.sampleConversation ?? '',
      operatingHours: raw.operatingHours ?? '',
      timezone: raw.timezone ?? '',
      geographicFocus: raw.geographicFocus ?? '',
      competitors: raw.competitors ?? '',
      campaignTone: raw.campaignTone ?? '',
    };
  } catch {
    // ignore
  }

  // workspace data takes priority for basics; icp fills the rest
  return { ...empty, ...icpData, ...workspaceData };
}

export async function saveBusinessProfile(profile: Partial<BusinessProfileData>): Promise<void> {
  // Company basics → workspace endpoint
  const companyPayload = {
    logo_url: profile.logoUrl,
    company_name: profile.companyName,
    tagline: profile.tagline,
    industry: profile.industry,
    website: profile.website,
    phone: profile.phone,
    email: profile.email,
    city: profile.city,
    country: profile.country,
    company_size: profile.companySize,
    // Also send camelCase versions for compatibility
    logoUrl: profile.logoUrl,
    companyName: profile.companyName,
    companySize: profile.companySize,
  };

  let workspaceSaved = false;
  try {
    await apiPatch('/api/workspace', { company: companyPayload });
    workspaceSaved = true;
  } catch {
    try {
      await apiPost('/api/workspace', { company: companyPayload });
      workspaceSaved = true;
    } catch {
      // workspace endpoint may not exist
    }
  }

  // Always sync full profile to ai-playground (so AI features see up-to-date data)
  await apiPost('/api/ai-playground', { icp_data: profile });

  if (!workspaceSaved) {
    // If workspace failed, at least the ai-playground save above captured everything.
    // Don't throw — the user's data is not lost.
  }
}

export async function uploadCompanyLogo(
  uri: string,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const token = await getAuthToken();
  const base = (API_URL || 'https://lad-backend-develop-160078175457.us-central1.run.app').replace(/\/+$/, '');

  // Try /api/workspace/logo first, then fallback endpoints
  const uploadUrls = [
    `${base}/api/workspace/logo`,
    `${base}/api/workspace/upload-logo`,
    `${base}/api/ai-playground/upload-logo`,
  ];

  const form = new FormData();
  form.append('file', { uri, name: fileName || 'company-logo.jpg', type: mimeType || 'image/jpeg' } as any);

  for (const uploadUrl of uploadUrls) {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 30000;
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const url =
                res.logoUrl ?? res.logo_url ?? res.url ?? res.fileUrl ?? res.imageUrl ?? res.image_url ?? null;
              url ? resolve(url) : reject(new Error('No URL in response'));
            } catch {
              reject(new Error('Invalid JSON response'));
            }
          } else if (xhr.status === 404) {
            reject(new Error('NOT_FOUND'));
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.send(form);
      });
      return result;
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') continue;
      throw err;
    }
  }

  // All endpoints failed — return the local URI so the UI can show a preview
  // and save the URL in the profile (it'll be a local file:// path, not ideal but usable)
  throw new Error('Logo upload endpoint not available. Contact your administrator.');
}
