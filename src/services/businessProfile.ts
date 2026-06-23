import { apiGet, apiPost } from '@/src/api';

export type BusinessProfileData = {
  companyName: string;
  industry: string;
  website: string;
  valueProposition: string;
  productsServices: string;
  targetCustomers: string;
  companyDescription: string;
  icpJobTitles: string;
  icpCompanySize: string;
  icpLocations: string;
  icpPainPoints: string;
  sampleConversation: string;
  operatingHours: string;
  timezone: string;
  geographicFocus: string;
  competitors: string;
  campaignTone: string;
};

export const emptyBusinessProfile = (): BusinessProfileData => ({
  companyName: '',
  industry: '',
  website: '',
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
  timezone: '',
  geographicFocus: '',
  competitors: '',
  campaignTone: '',
});

export async function getBusinessProfile(): Promise<BusinessProfileData> {
  try {
    const response = await apiGet<any>('/api/ai-playground');
    // We assume the data might be stored in the icp_data field or returned directly
    const data = response.data?.icp_data || response.data || {};
    
    return {
      ...emptyBusinessProfile(),
      ...data,
    };
  } catch (error) {
    console.error('Failed to get business profile:', error);
    return emptyBusinessProfile();
  }
}

export async function saveBusinessProfile(profile: Partial<BusinessProfileData>): Promise<void> {
  await apiPost('/api/ai-playground', { icp_data: profile });
}
