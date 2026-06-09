/**
 * Billing Feature - SDK Exports
 * 
 * Central export point for all billing-related frontend functionality.
 * Import from this file to use billing features in your application.
 * 
 * USAGE:
 * ```typescript
 * import { 
 *   useWalletBalance,
 *   useQuote,
 *   useChargeUsage,
 *   type WalletBalance,
 *   type QuoteRequest
 * } from '@/sdk/features/billing';
 * ```
 * 
 * ARCHITECTURE:
 * - All API calls go through api.ts (SDK layer)
 * - React components import hooks from this file
 * - No direct axios/fetch calls in web pages
 * - All operations are tenant-scoped automatically via getApiClient()
 */
// ============================================================================
// API FUNCTIONS
// ============================================================================
export {
  // Primary API (credits-based naming)
  getCreditsBalance,
  getPricing,
  getQuote,
  chargeUsage,
  topUpCredits,
  listUsage,
  getUsageAggregation,
  listTransactions,
  getCreditsBalanceLegacy,
  getCreditPackages,
  createStripeCheckoutSession,
  // Backward compatibility aliases
  getWalletBalance,
  getWalletBalanceLegacy,
} from './api';
// ============================================================================
// HOOKS
// ============================================================================
export {
  // Primary hooks (credits-based naming)
  useCreditsBalance,
  usePricing,
  useQuote,
  useChargeUsage,
  useTopUp,
  useUsage,
  useUsageAggregation,
  useTransactions,
  useCreditsBalanceLegacy,
  useCreditPackages,
  useStripeCheckout,
  // Backward compatibility aliases
  useWalletBalance,
  useWalletBalanceLegacy,
} from './hooks';
// ============================================================================
// TYPES
// ============================================================================
export type {
  WalletBalance,
  UsageEvent,
  UsageItem,
  LedgerTransaction,
  PricingItem,
  QuoteRequest,
  QuoteItem,
  QuoteResponse,
  QuoteResponseItem,
  ChargeRequest,
  ChargeResponse,
  TopUpRequest,
  UsageListParams,
  UsageListResponse,
  UsageSummary,
  UsageAggregation,
  TransactionListParams,
  LegacyWalletBalance,
  LegacyTransaction,
  CreditPackage,
} from './types';
