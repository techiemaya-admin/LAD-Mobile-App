/**
 * Billing Feature - React Hooks
 * Custom hooks for billing operations with automatic refetching and state management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as billingApi from './api';
/**
 * Hook to get credits balance
 * Auto-refetches on window focus
 */
export function useCreditsBalance() {
  return useQuery({
    queryKey: ['billing', 'credits'],
    queryFn: billingApi.getCreditsBalance,
    staleTime: 30000, // Consider fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
}
// Backward compatibility alias
export const useWalletBalance = useCreditsBalance;
/**
 * Hook to get pricing for a component
 */
export function usePricing(params: {
  category: string;
  provider: string;
  model: string;
  unit: string;
}) {
  return useQuery({
    queryKey: ['billing', 'pricing', params],
    queryFn: () => billingApi.getPricing(params),
    staleTime: 300000, // Pricing is stable, cache for 5 minutes
  });
}
/**
 * Hook to get cost quote
 */
export function useQuote(items: billingApi.QuoteItem[] | null) {
  return useQuery({
    queryKey: ['billing', 'quote', items],
    queryFn: () => billingApi.getQuote(items!),
    enabled: !!items && items.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });
}
/**
 * Hook to charge usage
 * Automatically refetches wallet and usage lists after success
 */
export function useChargeUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: billingApi.chargeUsage,
    onSuccess: () => {
      // Refetch credits balance and usage lists
      queryClient.invalidateQueries({ queryKey: ['billing', 'credits'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'usage'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'transactions'] });
    },
  });
}
/**
 * Hook to top up credits (admin only)
 * Automatically refetches credits balance after success
 */
export function useTopUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: billingApi.topUpCredits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'credits'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'transactions'] });
    },
  });
}
/**
 * Hook to list usage events
 */
export function useUsage(params?: {
  from?: string;
  to?: string;
  featureKey?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['billing', 'usage', params],
    queryFn: () => billingApi.listUsage(params),
    staleTime: 60000, // Cache for 1 minute
  });
}
/**
 * Hook to get usage aggregation
 */
export function useUsageAggregation(params?: {
  from?: string;
  to?: string;
  featureKey?: string;
}) {
  return useQuery({
    queryKey: ['billing', 'usage-aggregation', params],
    queryFn: () => billingApi.getUsageAggregation(params),
    staleTime: 60000,
  });
}
/**
 * Hook to list ledger transactions
 */
export function useTransactions(params?: {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['billing', 'transactions', params],
    queryFn: () => billingApi.listTransactions(params),
    staleTime: 60000,
  });
}
/**
 * LEGACY COMPATIBILITY
 * Hook for existing BillingDashboard component
 */
export function useCreditsBalanceLegacy() {
  return useQuery({
    queryKey: ['billing', 'credits', 'legacy'],
    queryFn: billingApi.getCreditsBalanceLegacy,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}
// Backward compatibility alias
export const useWalletBalanceLegacy = useCreditsBalanceLegacy;
/**
 * LEGACY COMPATIBILITY
 * Hook for credit packages
 */
export function useCreditPackages() {
  return useQuery({
    queryKey: ['billing', 'packages'],
    queryFn: billingApi.getCreditPackages,
    staleTime: 3600000, // Cache for 1 hour
  });
}

/**
 * Hook to create Stripe checkout session for credit purchase
 * Automatically redirects to Stripe checkout on success
 */
export function useStripeCheckout() {
  type CheckoutParams = Parameters<typeof billingApi.createStripeCheckoutSession>[0];
  type CheckoutResponse = Awaited<ReturnType<typeof billingApi.createStripeCheckoutSession>>;
  
  return useMutation<CheckoutResponse, Error, CheckoutParams>({
    mutationFn: billingApi.createStripeCheckoutSession,
    onSuccess: (data: CheckoutResponse) => {
      // Redirect to Stripe checkout
      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    },
  });
}
