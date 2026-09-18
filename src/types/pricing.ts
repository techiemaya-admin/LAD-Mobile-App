/**
 * PricingRules — a spreadsheet whose cells are the Stage 2 variable names.
 *
 * Every Stage 2 `pricing` variable gets one definition written in terms of other
 * variables; pricing-only helpers live here too with `in_document: false`. The
 * calculator (pricing-calculator.ts) evaluates the sheet; the AI only writes it.
* Design: docs/plans/05-pricing-engine.md §1.
 * Mirror of backend/src/services/pricing-rules.types.ts (types only).
 */

export type Unit = "money" | "percent" | "integer" | "text" | "boolean" | "rows";
export type CellUnit = Exclude<Unit, "rows">;
export type CompareOp = "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in";
/** null in an integer column = unbounded (a cap of ∞). */
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
/** null = a looked-up unbounded cell (e.g. no product cap). */
export type Value = number | string | boolean | string[] | Row[] | null;

export type TableKind = "packages" | "bands" | "addons" | "taxes" | "splits" | "other";
export interface RuleColumn { key: string; label: string; unit: CellUnit }
export interface RuleTable { id: string; label: string; kind: TableKind; columns: RuleColumn[]; rows: Row[] }

/** Row filter: `column <op> (value_var | value | values)`. `values` only for "in". */
export interface Where { column: string; op: CompareOp; value_var?: string; value?: Cell; values?: Cell[] }
/** Variable test: `var <op> (value_var | value | values)`. */
export interface Cond { var: string; op: CompareOp; value_var?: string; value?: Cell; values?: Cell[] }

export type FormulaOp = "add" | "sub" | "mul" | "div" | "min" | "max";
/** One flat operation. add/mul/min/max are n-ary (≥1); sub/div take exactly 2. "col:<key>" allowed inside rows.map. */
export interface Formula { op: FormulaOp; args: (string | number)[] }

export type InputType = "integer" | "choice" | "multi_choice" | "boolean" | "us_state";

interface VariableBase { name: string; label: string; in_document: boolean; unit: Unit; /** "" = none; when the flag is false the variable is skipped. */ condition_flag: string }

export type RuleVariable = VariableBase & (
  | { kind: "input"; input_type: InputType; options_table?: string; options_column?: string; options?: string[]; required: boolean }
  | { kind: "constant"; value: Cell }
  | { kind: "lookup"; table: string; where: Where[]; take: string }
  | ({ kind: "formula" } & Formula)
  | { kind: "condition"; all: Cond[] }
  | { kind: "aggregate"; fn: "sum" | "count"; table: string; rows: "selected" | "all"; selected_var?: string; key_column: string; column?: string; where?: Where[] }
  | { kind: "rows"; table: string; rows: "selected" | "all"; selected_var?: string; key_column: string; where?: Where[]; map: Record<string, string | Formula> }
);

export type RuleKind = RuleVariable["kind"];

export interface ReviewRule { when: Cond[]; reason: string }
export interface Assumption { text: string; resolved_as: string }

export interface PricingRules {
  version: 1;
  tables: RuleTable[];
  variables: RuleVariable[];
  /** Explicit "decline to auto-quote" conditions. */
  review_rules: ReviewRule[];
  assumptions: Assumption[];
  /** The lead facts behind the sample quotation; drive the sample check. */
  sample_inputs: Record<string, Value>;
}

export interface Evaluation {
  values: Record<string, Value>;
  present: Record<string, boolean>;
  needs_review: { reason: string; source?: string }[];
  order: string[];
}

export interface ValidationError { path: string; message: string }
export interface SampleCheckEntry { name: string; computed: string; expected: string; ok: boolean; note?: string }

export interface Stage2Variable {
  variable_name: string;
  natural_name?: string;
  category: string;
  data_type?: string;
  sample_value: string;
  condition_flag?: string;
  enum_options?: string[];
  paragraph_mode?: string;
}
export interface Stage2Context {
  variables: Stage2Variable[];
  loop_tables: { loop_tag: string; columns: string[]; row_labels: string[] }[];
}

export interface PricingRulesState {
  rules: PricingRules;
  compiled_at: string;
  validation_errors: ValidationError[];
  sample_check: SampleCheckEntry[];
  evaluation: Evaluation | null;
}
