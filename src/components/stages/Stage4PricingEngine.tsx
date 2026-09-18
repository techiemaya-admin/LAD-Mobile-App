import React, { useState, useEffect } from "react";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  User,
  ChevronRight,
  Check,
  Table2,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { RuleTableCard } from "../pricing/RuleTableCard";
import type {
  PricingRules,
  PricingRulesState,
  ValidationError,
} from "../../types/pricing";
import type { CompanyVariable, CompoundTable } from "../../types/variable";
import { updatePricingRules, RulesValidationError } from "../../services/api";
import { formatValue, readable } from "../pricing/readable";

export interface RulesStatus {
  status: "idle" | "compiling" | "error";
  message?: string;
}

interface Stage4PricingEngineProps {
  companyId: string;
  companyName: string;
  state: PricingRulesState | null;
  status?: RulesStatus;
  variables?: CompanyVariable[];
  compoundTables?: CompoundTable[];
  onStateChange: (state: PricingRulesState) => void;
  onProceed: () => void;
  onRegenerate: () => void;
  isProceeding?: boolean;
}

export const Stage4PricingEngine: React.FC<Stage4PricingEngineProps> = ({
  companyId,
  companyName,
  state,
  status = { status: "idle" },
  onStateChange,
  onProceed,
  onRegenerate,
  isProceeding = false,
}) => {
  const [rules, setRules] = useState<PricingRules | null>(state?.rules ?? null);
  const [, setErrors] = useState<ValidationError[]>(state?.validation_errors ?? []);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<PricingRules | null>(null);
  const [syncedRules, setSyncedRules] = useState(state?.rules);

  if (state?.rules !== syncedRules) {
    setSyncedRules(state?.rules);
    if (state?.rules !== lastSaved) {
      setRules(state?.rules ?? null);
      setErrors(state?.validation_errors ?? []);
    }
  }

  // Auto-save debounced PUT on user edits
  useEffect(() => {
    if (!rules || rules === state?.rules) return;
    const timer = setTimeout(async () => {
      try {
        const next = await updatePricingRules(companyId, rules);
        setLastSaved(rules);
        setErrors([]);
        onStateChange({ ...next, rules });
        setSaveStatus("Recalculated");
        setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
        setErrors(
          err instanceof RulesValidationError
            ? err.errors
            : [{ path: "", message: err instanceof Error ? err.message : String(err) }]
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [rules, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCompiling = status.status === "compiling";
  const values = state?.evaluation?.values ?? {};
  const order = state?.evaluation?.order ?? rules?.variables.map((v) => v.name) ?? [];
  const ledger = rules
    ? order
        .map((n) => rules.variables.find((v) => v.name === n)!)
        .filter((v) => v && v.kind !== "input")
    : [];
  const inputs = rules?.variables.filter((v) => v.kind === "input") ?? [];
  const checks = state?.sample_check ?? [];
  const matched = checks.filter((c) => c.ok).length;
  const allGreen = checks.length > 0 && matched === checks.length;

  const handleTableChange = (tableId: string, updatedRows: any[]) => {
    if (!rules) return;
    const updatedTables = rules.tables.map((t) =>
      t.id === tableId ? { ...t, rows: updatedRows } : t
    );
    setRules({ ...rules, tables: updatedTables });
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-xs animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`size-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors ${
              allGreen && !isCompiling
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/30"
                : "bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border-blue-200/80 dark:border-[#2B7CFF]/40"
            }`}
          >
            {allGreen && !isCompiling ? (
              <CheckCircle2 className="size-4.5" />
            ) : (
              <Calculator className="size-4.5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Stage 4: Pricing Rules &amp; Deterministic Engine</span>
              {saveStatus && (
                <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1 animate-in fade-in">
                  <Check className="size-3" />
                  {saveStatus}
                </span>
              )}
              {allGreen && !isCompiling && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  100% Benchmark Match
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isCompiling
                ? `Synthesizing ${companyName}'s pricing logic into rate tables and calculation formulas...`
                : `Every formula below is verified against ${companyName}'s quotation benchmark. Edit rates to test live recalculations.`}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={isCompiling}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title="Re-compile rules from pricing briefing"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${isCompiling ? "animate-spin" : ""}`} />
          <span>{isCompiling ? "Compiling..." : "Re-compile"}</span>
        </Button>
      </div>

      {status.status === "error" && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{status.message || "Failed to compile pricing rules."}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRegenerate} className="h-7 text-xs border-destructive/30">
            Try again
          </Button>
        </div>
      )}

      {isCompiling && !rules ? (
        <div className="p-10 rounded-xl border border-dashed border-[#2B7CFF]/40 bg-blue-50/20 dark:bg-[#000724]/30 text-center space-y-3">
          <Loader2 className="size-6 animate-spin text-[#2B7CFF] mx-auto" />
          <div className="text-xs font-bold text-foreground">Compiling Deterministic Pricing Model...</div>
          <p className="text-[11px] text-muted-foreground">AI is deriving mathematical formulas and tables.</p>
        </div>
      ) : rules ? (
        <>
          {/* Resolved Assumptions Banner */}
          {rules.assumptions && rules.assumptions.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>Compiler Assumptions Resolved</span>
              </div>
              <ul className="space-y-0.5 text-xs text-foreground/90 pl-5">
                {rules.assumptions.map((a, i) => (
                  <li key={i} className="list-disc text-[11px]">
                    <span className="text-muted-foreground">{a.text}</span> →{" "}
                    <strong className="text-foreground">{a.resolved_as}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rule Rate Tables Grid */}
          {rules.tables && rules.tables.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <Table2 className="size-3.5 text-[#2B7CFF]" />
                <span>Rate Matrices &amp; Tier Tables</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {rules.tables.map((t) => (
                  <RuleTableCard
                    key={t.id}
                    table={t}
                    onChange={(updatedTable) =>
                      handleTableChange(updatedTable.id, updatedTable.rows)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lead Inputs */}
          {inputs.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <User className="size-3.5 text-[#2B7CFF]" />
                <span>Client Lead Inputs Required</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {inputs.map((v) => (
                  <div
                    key={v.name}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/80 bg-muted/30 dark:bg-[#14233a] text-xs font-semibold text-foreground shadow-2xs"
                  >
                    <span>{v.label || v.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-card text-muted-foreground font-mono border border-border/50">
                      {v.input_type}
                    </span>
                    {v.required && (
                      <span className="size-1.5 rounded-full bg-[#2B7CFF]" title="Required field" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation Ledger & Target Benchmark Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Calculator className="size-3.5 text-[#2B7CFF]" />
                <span>Calculation Ledger &amp; Quotation Benchmark Verification</span>
              </div>
              <span className="text-[10px] font-mono">
                {matched} of {checks.length} benchmark items verified
              </span>
            </div>

            <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[11px] text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="text-left font-bold px-4 py-2.5">Variable</th>
                    <th className="text-left font-bold px-4 py-2.5 hidden sm:table-cell">
                      Formula Logic
                    </th>
                    <th className="text-right font-bold px-4 py-2.5">Computed Value</th>
                    <th className="text-right font-bold px-4 py-2.5">Quotation Target</th>
                    <th className="w-12 text-center font-bold px-2 py-2.5">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {ledger.map((v) => {
                    const rawVal = values[v.name];
                    const check = checks.find((c) => c.name === v.name);
                    const formattedComputed = formatValue(v.unit, rawVal);
                    const formattedTarget = check
                      ? check.expected
                      : "—";

                    return (
                      <tr key={v.name} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-sans">
                          <div className="font-bold text-foreground">{v.label || v.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{v.name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-sans text-[11px] hidden sm:table-cell">
                          {rules ? readable(rules, v) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-foreground">
                          {formattedComputed}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {formattedTarget}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {check ? (
                            check.ok ? (
                              <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3 stroke-[2.5]" />
                              </span>
                            ) : (
                              <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                !
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
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
            <span className="text-xs text-muted-foreground">
              Pricing engine certified for live client lead simulation
            </span>
            <Button
              onClick={onProceed}
              disabled={isProceeding}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
            >
              {isProceeding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Locking Rules &amp; Preparing Simulation...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Stage 5: Lead Simulation</span>
                  <ChevronRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};
