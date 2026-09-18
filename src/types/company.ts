import type { TemplateStats } from "./template";
import type { PricingRulesState } from "./pricing";

export interface CompanyBasics {
  company_name: string;
  location?: string;
  timings?: string;
  email?: string;
  website?: string;
  phone?: string | null;
}

export interface CompanyDetails {
  industry?: string;
  value_proposition?: string;
  products_and_services?: string[];
  target_customers?: string;
}

export interface IdealCustomer {
  description?: string;
  pain_points?: string;
}

export interface Offer {
  buyer_segments?: string[];
  cost_of_doing_nothing?: string;
  discovery_questions?: string[];
  what_happens_after_they_sign?: string;
  evidenced_results?: string;
  who_is_not_a_good_fit?: string[];
  common_objections?: Array<{ objection: string; response: string }>;
  why_buyers_pick_you?: string;
  guarantee_risk_reversal?: string;
}

export interface PricingEngineSpec {
  pricing_context: string;
}

export interface CompanyData {
  company_id: string;
  company_basics: CompanyBasics;
  company_details?: CompanyDetails;
  ideal_customer?: IdealCustomer;
  offer?: Offer;
  pricing_engine_spec: PricingEngineSpec;
}

export interface DocumentMetadata {
  filename: string;
  filesize: number;
  extracted_markdown: string;
  parsed_at: string;
}

export interface CompanySummary {
  company_id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  pricing_spec: string;
  briefing_locked?: boolean;
  quotation_filename?: string | null;
  updated_at: string;
  created_at: string;
}

export interface CompanyWorkingState {
  stage?: string;
  template_generated?: boolean;
  template_generated_at?: string;
  template_stats?: TemplateStats;
  extracted_variables?: unknown;
  /** Stage 4; null until compiled, nulled again by any earlier-stage rerun. */
  pricing_rules?: PricingRulesState | null;
  [key: string]: unknown;
}

export interface Company {
  company_id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  data: CompanyData;
  pricing_spec: string;
  working_state: CompanyWorkingState | null;
  briefing_locked?: boolean;
  document_metadata?: DocumentMetadata | null;
  created_at: string;
  updated_at: string;
}
