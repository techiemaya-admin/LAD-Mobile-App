import React from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { CustomDropdown } from "../ui/custom-dropdown";
import type { Cond, Formula, PricingRules, RuleKind, RuleVariable, Unit, Where } from "../../types/pricing";
import { OP_SYMBOL, UNIT_LABEL, cellInputText, parseCellInput, parseLiteral, readableFormula } from "./readable";
import { Commit as CommitBox } from "./RuleTableCard";

/** Docked editor for one ledger variable: kind, unit, guard, and the kind's operands. */

const KINDS: { value: RuleKind; label: string }[] = [
  { value: "constant", label: "a fixed value" },
  { value: "formula", label: "a calculation" },
  { value: "lookup", label: "a lookup in a table" },
  { value: "condition", label: "a yes/no check" },
  { value: "aggregate", label: "a sum or count over a table" },
  { value: "rows", label: "rows for the document" },
  { value: "input", label: "asked from the lead" },
];
const UNITS = (Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] }));
const OPS = Object.entries(OP_SYMBOL).map(([value, label]) => ({ value, label }));
const FORMULA_OPS: { value: Formula["op"]; label: string }[] = [
  { value: "add", label: "add (+)" }, { value: "sub", label: "subtract (−)" }, { value: "mul", label: "multiply (×)" },
  { value: "div", label: "divide (÷)" }, { value: "min", label: "smaller of" }, { value: "max", label: "larger of" },
];
const INPUT_TYPES = ["integer", "choice", "multi_choice", "boolean", "us_state"].map((v) => ({ value: v, label: v.replace("_", " ") }));

/** Fresh operands for a kind, keeping the shared header fields. */
function defaultsFor(kind: RuleKind, base: RuleVariable, rules: PricingRules): RuleVariable {
  const head = { name: base.name, label: base.label, in_document: base.in_document, unit: base.unit, condition_flag: base.condition_flag };
  const table = rules.tables[0]?.id ?? "";
  const col = rules.tables[0]?.columns[0]?.key ?? "";
  switch (kind) {
    case "input": return { ...head, kind, input_type: "integer", required: true };
    case "constant": return { ...head, kind, value: base.unit === "text" ? "" : base.unit === "boolean" ? false : 0 };
    case "lookup": return { ...head, kind, table, where: [], take: col };
    case "formula": return { ...head, kind, op: "add", args: [] };
    case "condition": return { ...head, kind, unit: "boolean", all: [] };
    case "aggregate": return { ...head, kind, fn: "count", table, rows: "all", key_column: col };
    case "rows": return { ...head, kind, unit: "rows", table, rows: "all", key_column: col, map: {} };
  }
}

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = "", children }) => (
  <div className={`min-w-0 ${className}`}>
    <div className="text-[11px] text-muted-foreground leading-none mb-1">{label}</div>
    {children}
  </div>
);

const box = "h-7 w-full rounded-md border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20";

const Commit: React.FC<{ value: string; onCommit: (s: string) => void; placeholder?: string; mono?: boolean; className?: string }> = ({ mono, className = "", ...rest }) => (
  <CommitBox {...rest} className={`${box} ${mono ? "font-mono tabular-nums" : ""} ${className}`} />
);

interface CondRowsProps<T extends Where | Cond> {
  rules: PricingRules;
  items: T[];
  /** "column" (table filter) or "var" (variable test). */
  left: T extends Where ? "column" : "var";
  tableId?: string;
  onChange: (items: T[]) => void;
}

function CondRows<T extends Where | Cond>({ rules, items, left, tableId, onChange }: CondRowsProps<T>) {
  const leftOptions =
    left === "column"
      ? (rules.tables.find((t) => t.id === tableId)?.columns ?? []).map((c) => ({ value: c.key, label: c.label }))
      : rules.variables.map((v) => ({ value: v.name, label: v.label || v.name }));
  const varOptions = [{ value: "", label: "a value…" }, ...rules.variables.map((v) => ({ value: v.name, label: v.label || v.name }))];
  const update = (i: number, patch: Partial<Where & Cond>) => onChange(items.map((c, j) => (j === i ? ({ ...c, ...patch } as T) : c)));
  const rhsText = (c: Where | Cond) => (c.op === "in" ? (c.values ?? []).map((x) => cellInputText("text", x)).join(", ") : cellInputText("text", c.value));
  return (
    <div className="space-y-1.5">
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <CustomDropdown size="xs" className="min-w-28" value={(c as Where).column ?? (c as Cond).var ?? ""} options={leftOptions} onChange={(v) => update(i, { [left]: v } as Partial<Where & Cond>)} />
          <CustomDropdown size="xs" className="w-14" value={c.op} options={OPS} onChange={(v) => update(i, { op: v as Where["op"] })} />
          <CustomDropdown size="xs" className="min-w-24" value={c.value_var ?? ""} options={varOptions} onChange={(v) => update(i, v ? { value_var: v, value: undefined, values: undefined } : { value_var: undefined, value: null })} />
          {!c.value_var && (
            <Commit
              value={rhsText(c)}
              placeholder={c.op === "in" ? "a, b, c" : "value"}
              className="w-24"
              onCommit={(s) => update(i, c.op === "in" ? { values: s.split(",").map((x) => parseLiteral(x)) } : { value: parseLiteral(s) })}
            />
          )}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="size-6 rounded-md text-muted-foreground hover:text-destructive inline-flex items-center justify-center" title="Remove">
            <X className="size-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { [left]: leftOptions[0]?.value ?? "", op: "eq", value: null } as unknown as T])}
        className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] border border-dashed border-border text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" /> condition
      </button>
    </div>
  );
}

const TableFields: React.FC<{
  rules: PricingRules;
  v: Extract<RuleVariable, { kind: "aggregate" | "rows" }>;
  onChange: (v: RuleVariable) => void;
}> = ({ rules, v, onChange }) => {
  const table = rules.tables.find((t) => t.id === v.table);
  const cols = (table?.columns ?? []).map((c) => ({ value: c.key, label: c.label }));
  const choiceInputs = rules.variables.filter((x) => x.kind === "input" && (x.input_type === "choice" || x.input_type === "multi_choice")).map((x) => ({ value: x.name, label: x.label || x.name }));
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Table"><CustomDropdown size="xs" className="w-full" value={v.table} options={rules.tables.map((t) => ({ value: t.id, label: t.label }))} onChange={(table) => onChange({ ...v, table })} /></Field>
        <Field label="Which rows"><CustomDropdown size="xs" className="w-full" value={v.rows} options={[{ value: "all", label: "all rows" }, { value: "selected", label: "the lead's picks" }]} onChange={(rows) => onChange({ ...v, rows: rows as "all" | "selected" })} /></Field>
        {v.rows === "selected" && (
          <Field label="Picked via"><CustomDropdown size="xs" className="w-full" value={v.selected_var ?? ""} options={choiceInputs} placeholder="choice input" onChange={(selected_var) => onChange({ ...v, selected_var })} /></Field>
        )}
        <Field label="Match column"><CustomDropdown size="xs" className="w-full" value={v.key_column} options={cols} onChange={(key_column) => onChange({ ...v, key_column })} /></Field>
      </div>
      <Field label="Only rows where">
        <CondRows<Where> rules={rules} items={v.where ?? []} left="column" tableId={v.table} onChange={(where) => onChange({ ...v, where })} />
      </Field>
    </>
  );
};

interface LedgerTrayProps {
  rules: PricingRules;
  variable: RuleVariable;
  /** Sample value from Stage 2 when the variable is in the document. */
  sample?: string;
  onChange: (variable: RuleVariable) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const LedgerTray: React.FC<LedgerTrayProps> = ({ rules, variable: v, sample, onChange, onDelete, onClose }) => {
  const varOptions = rules.variables.filter((x) => x.name !== v.name && x.unit !== "text" && x.unit !== "rows").map((x) => ({ value: x.name, label: x.label || x.name }));
  const flagOptions = [{ value: "", label: "always" }, ...rules.variables.filter((x) => x.kind === "condition" && x.name !== v.name).map((x) => ({ value: x.name, label: `only when ${x.label || x.name}` }))];
  const tableCols = (id: string) => (rules.tables.find((t) => t.id === id)?.columns ?? []).map((c) => ({ value: c.key, label: c.label }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Commit value={v.label} onCommit={(label) => onChange({ ...v, label })} className="max-w-64 font-medium" />
          <code className="font-mono text-[11px] text-muted-foreground truncate">{v.name}</code>
          {!v.in_document && <span className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-border text-muted-foreground whitespace-nowrap">not in document</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <button type="button" onClick={onDelete} className="size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center" title="Remove this helper">
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button type="button" onClick={onClose} className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 flex items-center justify-center" title="Close">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Field label="This is"><CustomDropdown size="xs" className="w-full" value={v.kind} options={KINDS} onChange={(k) => onChange(defaultsFor(k as RuleKind, v, rules))} /></Field>
        <Field label="Unit"><CustomDropdown size="xs" className="w-full" value={v.unit} options={UNITS} onChange={(unit) => onChange({ ...v, unit: unit as Unit })} /></Field>
        <Field label="Computed"><CustomDropdown size="xs" className="w-full" value={v.condition_flag} options={flagOptions} onChange={(condition_flag) => onChange({ ...v, condition_flag })} /></Field>
      </div>

      {v.kind === "constant" && (
        <Field label="Value">
          {v.unit === "boolean" ? (
            <CustomDropdown size="xs" value={v.value ? "true" : "false"} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} onChange={(s) => onChange({ ...v, value: s === "true" })} />
          ) : (
            <Commit mono={v.unit !== "text"} className="max-w-48" value={cellInputText(v.unit, v.value)} onCommit={(s) => onChange({ ...v, value: parseCellInput(v.unit, s) })} />
          )}
        </Field>
      )}

      {v.kind === "formula" && (
        <div className="space-y-2">
          <div className="flex items-end gap-2 flex-wrap">
            <Field label="Operation"><CustomDropdown size="xs" value={v.op} options={FORMULA_OPS} onChange={(op) => onChange({ ...v, op: op as Formula["op"] })} /></Field>
            <div className="flex items-center gap-1.5 flex-wrap">
              {v.args.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {typeof a === "number" ? (
                    <Commit mono className="w-20" value={String(a)} onCommit={(s) => onChange({ ...v, args: v.args.map((x, j) => (j === i ? (Number(s) || 0) : x)) })} />
                  ) : (
                    <CustomDropdown size="xs" value={a} options={varOptions} onChange={(name) => onChange({ ...v, args: v.args.map((x, j) => (j === i ? name : x)) })} />
                  )}
                  <button type="button" onClick={() => onChange({ ...v, args: v.args.filter((_, j) => j !== i) })} className="size-5 rounded text-muted-foreground hover:text-destructive inline-flex items-center justify-center" title="Remove">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => onChange({ ...v, args: [...v.args, varOptions[0]?.value ?? ""] })} className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] border border-dashed border-border text-muted-foreground hover:text-foreground">
                <Plus className="size-3" /> variable
              </button>
              <button type="button" onClick={() => onChange({ ...v, args: [...v.args, 1] })} className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] border border-dashed border-border text-muted-foreground hover:text-foreground">
                <Plus className="size-3" /> number
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">= {readableFormula(rules, v) || "…"}</p>
        </div>
      )}

      {v.kind === "lookup" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Table"><CustomDropdown size="xs" className="w-full" value={v.table} options={rules.tables.map((t) => ({ value: t.id, label: t.label }))} onChange={(table) => onChange({ ...v, table, take: tableCols(table)[0]?.value ?? "", where: [] })} /></Field>
            <Field label="Read column"><CustomDropdown size="xs" className="w-full" value={v.take} options={tableCols(v.table)} onChange={(take) => onChange({ ...v, take })} /></Field>
          </div>
          <Field label="First row where">
            <CondRows<Where> rules={rules} items={v.where} left="column" tableId={v.table} onChange={(where) => onChange({ ...v, where })} />
          </Field>
        </div>
      )}

      {v.kind === "condition" && (
        <Field label="True when all of">
          <CondRows<Cond> rules={rules} items={v.all} left="var" onChange={(all) => onChange({ ...v, all })} />
        </Field>
      )}

      {v.kind === "aggregate" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Function"><CustomDropdown size="xs" className="w-full" value={v.fn} options={[{ value: "count", label: "count rows" }, { value: "sum", label: "sum a column" }]} onChange={(fn) => onChange({ ...v, fn: fn as "sum" | "count" })} /></Field>
            {v.fn === "sum" && <Field label="Column"><CustomDropdown size="xs" className="w-full" value={v.column ?? ""} options={tableCols(v.table)} onChange={(column) => onChange({ ...v, column })} /></Field>}
          </div>
          <TableFields rules={rules} v={v} onChange={onChange} />
        </div>
      )}

      {v.kind === "rows" && (
        <div className="space-y-2">
          <TableFields rules={rules} v={v} onChange={onChange} />
          <Field label="Columns in the document">
            <div className="space-y-1.5">
              {Object.entries(v.map).map(([tag, m]) => (
                <div key={tag} className="flex items-center gap-2">
                  <code className="font-mono text-[11px] text-muted-foreground w-40 truncate">{tag}</code>
                  {typeof m === "string" ? (
                    <CustomDropdown size="xs" value={m} options={tableCols(v.table)} onChange={(col) => onChange({ ...v, map: { ...v.map, [tag]: col } })} />
                  ) : (
                    <span className="text-xs text-foreground">{readableFormula(rules, m)} <span className="text-[11px] text-muted-foreground">(edit in the Dev Dock)</span></span>
                  )}
                </div>
              ))}
            </div>
          </Field>
        </div>
      )}

      {v.kind === "input" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label="Answer type"><CustomDropdown size="xs" className="w-full" value={v.input_type} options={INPUT_TYPES} onChange={(input_type) => onChange({ ...v, input_type: input_type as typeof v.input_type })} /></Field>
          <Field label="Required"><CustomDropdown size="xs" className="w-full" value={v.required ? "yes" : "no"} options={[{ value: "yes", label: "yes" }, { value: "no", label: "optional" }]} onChange={(s) => onChange({ ...v, required: s === "yes" })} /></Field>
          {(v.input_type === "choice" || v.input_type === "multi_choice") && (
            <>
              <Field label="Options from"><CustomDropdown size="xs" className="w-full" value={v.options_table ?? ""} options={rules.tables.map((t) => ({ value: t.id, label: t.label }))} onChange={(options_table) => onChange({ ...v, options_table, options_column: tableCols(options_table)[0]?.value })} /></Field>
              <Field label="Column"><CustomDropdown size="xs" className="w-full" value={v.options_column ?? ""} options={tableCols(v.options_table ?? "")} onChange={(options_column) => onChange({ ...v, options_column })} /></Field>
            </>
          )}
        </div>
      )}

      {sample !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          In the sample quotation this reads <span className="font-medium text-foreground">{sample}</span>.
        </p>
      )}
    </div>
  );
};

export default LedgerTray;
