import type { Cell, Cond, Formula, PricingRules, RuleVariable, Unit, Value, Where } from "../../types/pricing";

/** Plain-language rendering of a rule definition for the ledger: no JSON, no jargon. */

export const OP_SYMBOL: Record<string, string> = { eq: "=", neq: "≠", gte: "≥", lte: "≤", gt: ">", lt: "<", in: "in" };
export const FORMULA_SYMBOL: Record<Formula["op"], string> = { add: "+", sub: "−", mul: "×", div: "÷", min: ",", max: "," };

export const UNIT_LABEL: Record<Unit, string> = { money: "money", percent: "percent", integer: "number", text: "text", boolean: "yes/no", rows: "rows" };

const fixed = (v: number, d: number) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Default notation per unit; `null` in an integer is the unbounded cap. */
export function formatValue(unit: Unit | string, value: Value | Cell | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return unit === "integer" ? "∞" : "—";
  if (Array.isArray(value)) return `${value.length} row${value.length === 1 ? "" : "s"}`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (unit === "money") return `$${fixed(value, 2)}`;
  if (unit === "percent") {
    const pct = value * 100;
    let d = 0;
    while (d < 4 && Math.abs(Number(pct.toFixed(d)) - pct) > 1e-9) d++;
    return `${fixed(pct, d)}%`;
  }
  return String(value);
}

const labelOf = (rules: PricingRules, name: string) => rules.variables.find((v) => v.name === name)?.label || name;
const tableOf = (rules: PricingRules, id: string) => rules.tables.find((t) => t.id === id);
const columnLabel = (rules: PricingRules, tableId: string, key: string) => tableOf(rules, tableId)?.columns.find((c) => c.key === key)?.label || key;

const literal = (c: Cell | Cell[] | undefined): string =>
  Array.isArray(c) ? c.map((x) => literal(x)).join(", ") : c === null || c === undefined ? "∞" : typeof c === "boolean" ? (c ? "true" : "false") : String(c);

const rhs = (rules: PricingRules, c: Where | Cond) => (c.value_var ? labelOf(rules, c.value_var) : c.op === "in" ? literal(c.values) : literal(c.value));

export const readableWhere = (rules: PricingRules, tableId: string, where?: Where[]) =>
  (where ?? []).map((w) => `${columnLabel(rules, tableId, w.column)} ${OP_SYMBOL[w.op] ?? w.op} ${rhs(rules, w)}`).join(" and ");

export const readableConds = (rules: PricingRules, conds: Cond[]) =>
  conds
    .map((c) => (c.op === "eq" && c.value === true ? `${labelOf(rules, c.var)} is true` : c.op === "eq" && c.value === false ? `${labelOf(rules, c.var)} is false` : `${labelOf(rules, c.var)} ${OP_SYMBOL[c.op] ?? c.op} ${rhs(rules, c)}`))
    .join(" and ") || "always";

export function readableFormula(rules: PricingRules, f: Formula): string {
  const args = f.args.map((a) => (typeof a === "number" ? String(a) : a.startsWith("col:") ? `row's ${a.slice(4)}` : labelOf(rules, a)));
  if (f.op === "min" || f.op === "max") return `${f.op === "min" ? "smaller" : "larger"} of ${args.join(", ")}`;
  return args.join(` ${FORMULA_SYMBOL[f.op]} `);
}

export function readable(rules: PricingRules, v: RuleVariable): string {
  switch (v.kind) {
    case "input":
      return `asked from the lead${v.required ? "" : " (optional)"}`;
    case "constant":
      return formatValue(v.unit, v.value);
    case "lookup": {
      const t = tableOf(rules, v.table);
      return `${t?.label ?? v.table} · first row where ${readableWhere(rules, v.table, v.where) || "any"} → ${columnLabel(rules, v.table, v.take)}`;
    }
    case "formula":
      return readableFormula(rules, v);
    case "condition":
      return readableConds(rules, v.all);
    case "aggregate": {
      const t = tableOf(rules, v.table);
      const scope = v.rows === "selected" ? `selected ${t?.label ?? v.table}` : `all ${t?.label ?? v.table}`;
      const where = v.where?.length ? ` where ${readableWhere(rules, v.table, v.where)}` : "";
      return v.fn === "count" ? `count of ${scope}${where}` : `sum of ${columnLabel(rules, v.table, v.column ?? "")} across ${scope}${where}`;
    }
    case "rows": {
      const t = tableOf(rules, v.table);
      const where = v.where?.length ? ` where ${readableWhere(rules, v.table, v.where)}` : "";
      return `one row per ${v.rows === "selected" ? "selected" : ""} ${t?.label ?? v.table}${where}`.replace(/\s+/g, " ");
    }
  }
}

/** Parse what a person typed into a cell of the given unit. "" in an integer = unbounded. */
export function parseCellInput(unit: string, text: string): Cell {
  const s = text.trim();
  if (unit === "text") return s;
  if (unit === "boolean") return /^(true|yes|1|✓)$/i.test(s);
  if (s === "") return null;
  const n = Number(s.replace(/[$,%\s]/g, ""));
  if (Number.isNaN(n)) return null;
  if (unit === "percent") return n / 100;
  if (unit === "integer") return Math.round(n);
  return n;
}

/** The inverse for the cell's edit box: raw number text (percent shown ×100), never currency symbols. */
export function cellInputText(unit: string, value: Cell | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (unit === "percent" && typeof value === "number") return String(Number((value * 100).toFixed(4)));
  return String(value);
}

/** Literal typed into a condition/where value box: true/false, number, else text. */
export function parseLiteral(text: string): Cell {
  const s = text.trim();
  if (s === "" || s === "∞") return null;
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (!Number.isNaN(n)) return /%$/.test(s) ? Number(s.replace(/[%\s]/g, "")) / 100 : n;
  return s;
}
