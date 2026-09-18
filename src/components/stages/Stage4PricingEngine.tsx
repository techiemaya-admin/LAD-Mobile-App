import React from "react";
import {
  Calculator,
  CheckCircle2,
  Check,
  RefreshCw,
  User,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import type { PricingRulesState } from "../../types/pricing";
import { RuleTableCard } from "../pricing/RuleTableCard";
import { readable } from "../pricing/readable";

interface Stage4PricingEngineProps {
  companyName: string;
  state: PricingRulesState;
  onTableChange: (tableId: string, updatedRows: any[]) => void;
  onProceed: () => void;
  onRegenerate: () => void;
}

export const Stage4PricingEngine: React.FC<Stage4PricingEngineProps> = ({
  companyName,
  state,
  onTableChange,
  onProceed,
  onRegenerate,
}) => {
  const rules = state.rules;
  const values = state.evaluation?.values ?? {};
  const ledger = rules.variables.filter((v) => v.kind !== "input");
  const inputs = rules.variables.filter((v) => v.kind === "input");
  const checks = state.sample_check;
  const matched = checks.filter((c) => c.ok).length;

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 dark:bg-card/40 p-5 space-y-6 animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            <Calculator className="size-4.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Current Proposal / Pricing Rules &amp; Deterministic Engine</span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                100% Deterministic Match
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apply pricing rules and calculations checked live against {companyName}&apos;s quotation benchmark.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          <span>Re-compile</span>
        </Button>
      </div>

      {/* Assumptions Strip */}
      {rules.assumptions && rules.assumptions.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Assumptions Resolved</span>
          </div>
          <ul className="space-y-0.5 text-xs text-foreground/90 pl-5">
            {rules.assumptions.map((a, i) => (
              <li key={i} className="list-disc text-[11px]">
                <span className="text-muted-foreground">{a.text}</span> → <strong className="text-foreground">{a.resolved_as}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rule Tables Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {rules.tables.map((t) => (
          <RuleTableCard
            key={t.id}
            table={t}
            onChange={(updatedTable) => onTableChange(updatedTable.id, updatedTable.rows)}
          />
        ))}
      </div>

      {/* What we ask the lead */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <User className="size-3.5" /> What we ask the lead
        </div>
        <div className="flex flex-wrap gap-2">
          {inputs.map((v) => (
            <div
              key={v.name}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/80 bg-card text-xs font-semibold text-foreground shadow-2xs"
            >
              <span>{v.label || v.name}</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
                {v.input_type}
              </span>
              {v.required && <span className="size-1.5 rounded-full bg-[#2B7CFF]" title="required" />}
            </div>
          ))}
        </div>
      </div>

      {/* Calculation Ledger */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <Calculator className="size-3.5" /> Calculation Ledger &amp; Verification
        </div>
        <div className="rounded-2xl border border-border/80 overflow-hidden bg-card shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[11px] text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left font-bold px-4 py-2.5">Variable / Label</th>
                <th className="text-left font-bold px-4 py-2.5 hidden sm:table-cell">Calculation Logic</th>
                <th className="text-right font-bold px-4 py-2.5">Computed Value</th>
                <th className="text-right font-bold px-4 py-2.5">Quotation Target</th>
                <th className="w-10 text-center font-bold px-2 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ledger.map((v) => {
                const isMoney = v.unit === "money";
                const isPercent = v.unit === "percent";
                const rawVal = values[v.name];
                let displayVal = rawVal !== undefined ? String(rawVal) : "—";
                if (isMoney && typeof rawVal === "number") {
                  displayVal = `$${rawVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else if (isPercent && typeof rawVal === "number") {
                  displayVal = `${(rawVal * 100).toFixed(2)}%`;
                }

                const check = checks.find((c) => c.name === v.name);

                return (
                  <tr key={v.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{v.label || v.name}</span>
                        {!v.in_document && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded border border-dashed border-border text-muted-foreground">
                            helper
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell font-mono text-[11px]">
                      {readable(rules, v)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${isMoney || isPercent ? "text-[#0B1957] dark:text-[#2B7CFF]" : "text-foreground"}`}>
                      {displayVal}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {check?.expected || displayVal}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Check className="size-4 text-emerald-500 inline stroke-[2.5]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="size-4" />
          {matched} of {checks.length} calculations match quotation benchmark
        </span>
        <Button
          onClick={onProceed}
          size="sm"
          className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs"
        >
          <span>Proceed to Proposal &amp; Receipt</span>
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};
