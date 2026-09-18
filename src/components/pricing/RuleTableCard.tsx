import React from "react";
import { Package, BarChart3, Puzzle, Landmark, PieChart, Table2, Plus, X } from "lucide-react";
import type { Cell, Row, RuleTable, TableKind } from "../../types/pricing";
import { cellInputText, parseCellInput } from "./readable";

/** One editable grid per compiled table (packages, bands, add-ons, taxes, splits). Cells are typed by column unit. */

const KIND_ICON: Record<TableKind, React.ComponentType<{ className?: string }>> = {
  packages: Package,
  bands: BarChart3,
  addons: Puzzle,
  taxes: Landmark,
  splits: PieChart,
  other: Table2,
};

/** Text box that commits on blur / Enter, so half-typed numbers ("12.") are never reformatted mid-keystroke. */
export const Commit: React.FC<{ value: string; onCommit: (s: string) => void; placeholder?: string; inputMode?: "decimal" | "text"; className?: string }> = ({ value, onCommit, placeholder, inputMode, className = "" }) => (
  <input
    key={value}
    defaultValue={value}
    placeholder={placeholder}
    inputMode={inputMode}
    onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    className={className}
  />
);

const UNIT_HINT: Record<string, string> = { money: "$", percent: "%", integer: "#", boolean: "✓", text: "" };
const isNumeric = (unit: string) => unit === "money" || unit === "percent" || unit === "integer";

interface RuleTableCardProps {
  table: RuleTable;
  onChange: (table: RuleTable) => void;
}

export const RuleTableCard: React.FC<RuleTableCardProps> = ({ table, onChange }) => {
  const Icon = KIND_ICON[table.kind] ?? Table2;

  const setCell = (ri: number, key: string, value: Cell) =>
    onChange({ ...table, rows: table.rows.map((r, i) => (i === ri ? { ...r, [key]: value } : r)) });
  const addRow = () => {
    const blank: Row = {};
    for (const c of table.columns) blank[c.key] = c.unit === "text" ? "" : c.unit === "boolean" ? false : null;
    onChange({ ...table, rows: [...table.rows, blank] });
  };
  const removeRow = (ri: number) => onChange({ ...table, rows: table.rows.filter((_, i) => i !== ri) });

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs hover:-translate-y-0.5 transition-transform duration-100 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/60">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{table.label}</span>
        <span className="text-[11px] text-muted-foreground">
          {table.rows.length} row{table.rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              {table.columns.map((c) => (
                <th key={c.key} className={`px-3 py-1.5 font-medium whitespace-nowrap ${isNumeric(c.unit) ? "text-right" : "text-left"}`}>
                  {c.label}
                  {UNIT_HINT[c.unit] && <span className="ml-1 text-muted-foreground/60">{UNIT_HINT[c.unit]}</span>}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border/40 group">
                {table.columns.map((c) => (
                  <td key={c.key} className="px-1.5 py-0.5">
                    {c.unit === "boolean" ? (
                      <label className="flex items-center justify-center h-7">
                        <input
                          type="checkbox"
                          checked={Boolean(row[c.key])}
                          onChange={(e) => setCell(ri, c.key, e.target.checked)}
                          className="size-3.5 accent-blue-600"
                        />
                      </label>
                    ) : (
                      <Commit
                        value={cellInputText(c.unit, row[c.key])}
                        placeholder={c.unit === "integer" ? "∞" : ""}
                        inputMode={isNumeric(c.unit) ? "decimal" : "text"}
                        onCommit={(s) => setCell(ri, c.key, parseCellInput(c.unit, s))}
                        className={`h-7 w-full min-w-16 rounded-md border border-transparent bg-transparent px-1.5 text-xs text-foreground hover:border-border focus:border-border focus:bg-background outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-colors ${
                          isNumeric(c.unit) ? "font-mono tabular-nums text-right" : ""
                        }`}
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    title="Remove row"
                    className="size-6 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 inline-flex items-center justify-center transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center gap-1 px-3.5 py-1.5 border-t border-dashed border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <Plus className="size-3" />
        Add row
      </button>
    </div>
  );
};

export default RuleTableCard;
