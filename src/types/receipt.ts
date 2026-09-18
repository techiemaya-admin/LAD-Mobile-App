export interface ReceiptLineItem {
  id: string;
  label: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  rateLabel?: string;
  amount: number;
  type: "package" | "seat" | "device" | "addon" | "discount" | "tax" | "setup" | "other";
  isDiscount?: boolean;
  isTax?: boolean;
  isOneTime?: boolean;
}

export interface PaymentMilestone {
  milestone_name: string;
  trigger_description: string;
  share_percentage: number;
  amount: number;
  status?: "pending" | "due" | "paid";
}

export interface ProposalReceipt {
  receipt_id: string;
  proposal_id: string;
  date_issued: string;
  valid_until: string;
  status: "verified" | "draft" | "approved" | "sent";
  company: {
    name: string;
    location: string;
    email: string;
    phone?: string;
    tax_id?: string;
  };
  client: {
    name: string;
    company: string;
    location: string;
    email: string;
  };
  deal_summary: {
    tier_name?: string;
    locations_count?: number;
    seats_count?: number;
    devices_count?: number;
    products_count?: number;
    payment_terms: string;
  };
  line_items: ReceiptLineItem[];
  financials: {
    base_subtotal: number;
    discounts_total: number;
    taxable_subtotal: number;
    tax_rate: number;
    tax_amount: number;
    monthly_recurring_total?: number;
    one_time_setup_total?: number;
    grand_total: number;
    formatted_grand_total: string;
  };
  payment_milestones?: PaymentMilestone[];
  governing_rules: string[];
}

