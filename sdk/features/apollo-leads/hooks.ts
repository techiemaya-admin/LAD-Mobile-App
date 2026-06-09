/**
 * Apollo Leads Feature - React Hooks
 * 
 * React Query hooks for Apollo.io integration.
 * LAD Architecture: Framework-independent SDK with hooks.ts for React hooks
 * 
 * USAGE:
 * ```typescript
 * import { useApolloLeads } from '@/features/apollo-leads';
 * ```
 */
import { useState, useCallback } from 'react';
import type {
  ApolloSearchParams,
  ApolloSearchResponse,
  ApolloEmployeeSearchParams,
  ApolloEmployeeSearchResponse,
  ApolloCompany,
  ApolloPerson
} from './types';
import * as apolloApi from './api';
import { isFeatureEnabled } from '../../shared/featureFlags';
export const useApolloLeads = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchCompanies = useCallback(async (
    params: ApolloSearchParams
  ): Promise<ApolloSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      // Check feature flag
      const featureEnabled = await isFeatureEnabled('apollo_leads');
      if (!featureEnabled) {
        throw new Error('Apollo Leads feature is not enabled');
      }
      return await apolloApi.searchCompanies(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  const getCompanyDetails = useCallback(async (companyId: string): Promise<ApolloCompany> => {
    setLoading(true);
    setError(null);
    try {
      // Check feature flag
      const featureEnabled = await isFeatureEnabled('apollo_leads');
      if (!featureEnabled) {
        throw new Error('Apollo Leads feature is not enabled');
      }
      return await apolloApi.getCompanyDetails(companyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  const searchEmployees = useCallback(async (
    params: ApolloEmployeeSearchParams
  ): Promise<ApolloEmployeeSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      // Check feature flag
      const featureEnabled = await isFeatureEnabled('apollo_leads');
      if (!featureEnabled) {
        throw new Error('Apollo Leads feature is not enabled');
      }
      return await apolloApi.searchEmployees(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  const revealEmail = useCallback(async (personId: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      // Check feature flag
      const featureEnabled = await isFeatureEnabled('apollo_leads');
      if (!featureEnabled) {
        throw new Error('Apollo Leads feature is not enabled');
      }
      return await apolloApi.revealEmail(personId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  const revealPhone = useCallback(async (personId: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      // Check feature flag
      const featureEnabled = await isFeatureEnabled('apollo_leads');
      if (!featureEnabled) {
        throw new Error('Apollo Leads feature is not enabled');
      }
      return await apolloApi.revealPhone(personId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await apolloApi.checkHealth();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  return {
    // State
    loading,
    error,
    // Methods
    searchCompanies,
    getCompanyDetails,
    searchEmployees,
    revealEmail,
    revealPhone,
    checkHealth,
    // Utilities
    clearError: () => setError(null)
  };
};
