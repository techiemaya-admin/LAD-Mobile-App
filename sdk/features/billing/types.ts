/**
 * Billing Feature - TypeScript Types
 * Shared type definitions for billing operations
 */
export interface WalletBalance {
  walletId: string;
  tenantId: string;
  currentBalance: number;
  reservedBalance: number;
  availableBalance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  lowBalanceThreshold?: number;
}
export interface UsageEvent {
  id: string;
  tenantId: string;
  userId?: string;
  featureKey: string;
  totalCost: number;
  status: 'pending' | 'charged' | 'voided' | 'failed';
  createdAt: string;
  chargedAt?: string;
  usageItems?: UsageItem[];
}
export interface UsageItem {
  category: string;
  provider: string;
  model: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  cost: number;
}
export interface LedgerTransaction {
  id: string;
  tenantId: string;
  walletId: string;
  transactionType: 'topup' | 'credit' | 'debit' | 'adjustment' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
}
export interface PricingItem {
  id: string;
  tenantId?: string; // null = global pricing
  category: string;
  provider: string;
  model: string;
  unit: string;
  unitPrice: number;
  description?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
}
export interface QuoteRequest {
  items: QuoteItem[];
}
export interface QuoteItem {
  category: string;
  provider: string;
  model: string;
  unit: string;
  quantity: number;
}
export interface QuoteResponse {
  totalCost: number;
  currency: string;
  items: QuoteResponseItem[];
}
export interface QuoteResponseItem extends QuoteItem {
  unitPrice: number;
  cost: number;
}
export interface ChargeRequest {
  featureKey: string;
  externalReferenceId?: string;
  idempotencyKey: string;
  items: QuoteItem[];
  metadata?: Record<string, any>;
}
export interface ChargeResponse {
  usageEvent: UsageEvent;
  transaction: LedgerTransaction;
}
export interface TopUpRequest {
  amount: number;
  description?: string;
  idempotencyKey: string;
}
export interface UsageListParams {
  from?: string;
  to?: string;
  featureKey?: string;
  status?: 'pending' | 'charged' | 'voided' | 'failed';
  limit?: number;
  offset?: number;
}
export interface UsageListResponse {
  events: UsageEvent[];
  summary: UsageSummary;
}
export interface UsageSummary {
  totalEvents: number;
  totalCost: number;
  byFeature: Record<string, { events: number; cost: number }>;
  byStatus: Record<string, { events: number; cost: number }>;
}
export interface UsageAggregation {
  featureKey: string;
  status: string;
  eventCount: number;
  totalCost: number;
}
export interface TransactionListParams {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
/**
 * LEGACY TYPES - For backward compatibility
 */
export interface LegacyWalletBalance {
  credits: number;
  balance: number;
  currency: string;
  lastRecharge: {
    amount: number;
    credits: number;
    date: string;
  } | null;
  monthlyUsage: number;
  totalSpent: number;
  transactions?: LegacyTransaction[];
}
export interface LegacyTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  savings: number;
  popular?: boolean;
  description: string;
}