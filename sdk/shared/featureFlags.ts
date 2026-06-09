/**
 * Feature Flags Utility - SDK Shared
 * 
 * Dynamically fetches feature flags from the backend API.
 * Caches results in memory to avoid excessive API calls.
 */

interface FeatureFlagsResponse {
  features: Record<string, { enabled: boolean; [key: string]: any }>;
  metadata?: {
    last_updated: string;
    version: string;
  };
}

let flagsCache: Record<string, boolean> | null = null;
let cacheTime: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch feature flags from the backend API
 */
async function fetchFeatureFlagsFromAPI(): Promise<Record<string, boolean>> {
  try {
    // Determine the API base URL
    const apiBase = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const response = await fetch(`${apiBase}/api/feature-flags`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Feature flags API returned ${response.status}`);
    }

    const data: FeatureFlagsResponse = await response.json();
    
    // Convert response to simple boolean map
    const flags: Record<string, boolean> = {};
    Object.entries(data.features || {}).forEach(([key, feature]) => {
      flags[key] = feature.enabled ?? true;
    });

    return flags;
  } catch (error) {
    console.warn('[FeatureFlags] Failed to fetch from API, using fallback defaults', error);
    // Return default flags on API failure
    return getDefaultFlags();
  }
}

/**
 * Get default feature flags (fallback when API unavailable)
 */
function getDefaultFlags(): Record<string, boolean> {
  return {
    apollo_leads: true,
    campaigns_basic: true,
    campaigns_advanced_analytics: true,
    campaign_scheduling: true,
    voice_agent: true,
    social_integration: true,
    advanced_search: true,
    deals_pipeline: true,
    lead_enrichment: true,
    overview: true,
  };
}

/**
 * Check if a feature is enabled
 * Fetches from API with caching to avoid excessive requests
 * @param featureName - Name of the feature to check
 * @returns true if feature is enabled, false otherwise
 */
export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  // Check cache validity
  const now = Date.now();
  if (flagsCache && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    // Use cached flags
    return flagsCache[featureName] !== false;
  }

  // Fetch fresh flags from API
  try {
    flagsCache = await fetchFeatureFlagsFromAPI();
    cacheTime = now;
    return flagsCache[featureName] !== false;
  } catch (error) {
    console.warn('[FeatureFlags] Error checking feature status, using fallback', error);
    const defaults = getDefaultFlags();
    return defaults[featureName] !== false;
  }
}

/**
 * Get all feature flags synchronously (from cache only)
 * If cache is empty, returns default flags
 * @returns Object containing all cached feature flags
 */
export function getAllFeatures(): Record<string, boolean> {
  if (flagsCache) {
    return { ...flagsCache };
  }
  return getDefaultFlags();
}

/**
 * Clear the feature flags cache (useful for testing or manual refresh)
 */
export function clearFlagsCache(): void {
  flagsCache = null;
  cacheTime = null;
}

export default {
  isFeatureEnabled,
  getAllFeatures,
  clearFlagsCache,
};
