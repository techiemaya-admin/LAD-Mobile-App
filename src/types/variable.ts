export type VariableCategory = "customer_input" | "pricing" | "paragraph" | "table_loop";

export type VariableDataType =
  | "string"
  | "number"
  | "currency"
  | "enum"
  | "paragraph"
  | "table";

export interface VisibilityRule {
  condition_flag?: string;
  show_when?: string;
}

export interface ParagraphConfig {
  mode: "fixed" | "ai_generated";
  purpose?: string;
  tone?: string;
  length_guideline?: string;
  guidance?: string;
}

export interface VariableDescriptor {
  sample_value?: string;
  description?: string;
  enum_options?: string[];
  default_value?: string;
  visibility_rule?: VisibilityRule;
  paragraph_config?: ParagraphConfig;
  /** Only when the same text appears elsewhere with a different meaning. */
  context_text?: string;
}

export interface CompanyVariable {
  id: string;
  company_id: string;
  variable_name: string;
  natural_name: string;
  category: VariableCategory;
  data_type: VariableDataType;
  is_custom: boolean;
  is_deleted: boolean;
  sort_order: number;
  descriptor: VariableDescriptor;
  created_at: string;
  updated_at: string;
}

/** A loop table: located by its header row, `row_labels` rows collapse into one {#loop_tag} row. */
export interface CompoundTable {
  id: string;
  table_id: string;
  natural_name: string;
  type: "repeating_loop";
  loop_tag: string;
  header_texts: string[];
  row_labels: string[];
  columns: string[];
  is_deleted: boolean;
}

export interface VariablesResponse {
  success: boolean;
  company_id: string;
  extracted_count?: number;
  variables: CompanyVariable[];
  compound_tables: CompoundTable[];
  document_summary?: string;
}
