import React, { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, ChevronRight, Check, X, Plus, ShieldAlert, User } from "lucide-react";
import { Button } from "../ui/button";
import { RulesValidationError, updatePricingRules } from "../../services/api";
import type { PricingRules, PricingRulesState, RuleVariable, ValidationError } from "../../types/pricing";
import type { CompanyVariable, CompoundTable } from "../../types/variable";
import { RuleTableCard } from "./RuleTableCard";
import { LedgerTray } from "./LedgerTray";
import { formatValue, readable, readableConds } from "./readable";

/**
 * Stage 4. One card per compiled table, the lead inputs, and a calculation ledger that
 * re-checks every document value against the sample quotation on each edit (300 ms debounce → PUT).
 */

export interface RulesStatus {
  status: "idle" | "compiling" | "error";
  message?: string;
}

interface PricingEngineDeckProps {
  companyId: string;
  companyName: string;
  state: PricingRulesState | null;
  status: RulesStatus;
  variables: CompanyVariable[];
  compoundTables: CompoundTable[];
  onStateChange: (state: PricingRulesState) => void;
  onRegenerate: () => void;
  onProceed: () => void;
  isProceeding?: boolean;
}

const INPUT_TYPE_LABEL: Record<string, string> = { integer: "a number", choice: "one option", multi_choice: "several options", boolean: "yes / no", us_state: "US state" };

export const PricingEngineDeck: React.FC<PricingEngineDeckProps> = ({
  companyId,
  companyName,
  state,
  status,
  variables,
  compoundTables,
  onStateChange,
  onRegenerate,
  onProceed,
  isProceeding = false,
}) => {
  const [rules, setRules] = useState<PricingRules | null>(state?.rules ?? null);
  const [errors, setErrors] = useState<ValidationError[]>(state?.validation_errors ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  // A local edit makes `rules` differ from `state.rules` until the debounced PUT's response comes back
  // through onStateChange. A parent change we did NOT cause (new compile, Dev Dock apply, reset) replaces
  // the local copy; our own response is recognised by `lastSaved` so an edit made while the PUT was in
  // flight is kept and saved next.
  const [lastSaved, setLastSaved] = useState<PricingRules | null>(null);
  const [syncedRules, setSyncedRules] = useState(state?.rules);
  if (state?.rules !== syncedRules) {
    setSyncedRules(state?.rules);
    if (state?.rules !== lastSaved) {
      setRules(state?.rules ?? null);
      setErrors(state?.validation_errors ?? []);
    }
  }

  useEffect(() => {
    if (!rules || rules === state?.rules) return;
    const timer = setTimeout(async () => {
      try {
        const next = await updatePricingRules(companyId, rules);
        setLastSaved(rules);
        setErrors([]);
        onStateChange({ ...next, rules });
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
        setErrors(err instanceof RulesValidationError ? err.errors : [{ path: "", message: err instanceof Error ? err.message : String(err) }]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [rules, companyId]); // eslint-disable-line react-hooks/exhaustive-deps -- state.rules only matters at fire time

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const editVariable = (name: string, v: RuleVariable) => rules && setRules({ ...rules, variables: rules.variables.map((x) => (x.name === name ? v : x)) });
  const addHelper = () => {
    if (!rules) return;
    let n = 1;
    while (rules.variables.some((v) => v.name === `helper_${n}`)) n++;
    const name = `helper_${n}`;
    setRules({ ...rules, variables: [...rules.variables, { name, label: `Helper ${n}`, in_document: false, unit: "money", condition_flag: "", kind: "constant", value: 0 }] });
    setSelected(name);
  };

  const samples = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of variables) if (v.descriptor?.sample_value !== undefined) m[v.variable_name] = v.descriptor.sample_value;
    for (const t of compoundTables) m[t.loop_tag] = `${t.row_labels.length} rows`;
    return m;
  }, [variables, compoundTables]);
  const checkByName = useMemo(() => new Map((state?.sample_check ?? []).map((c) => [c.name, c])), [state?.sample_check]);
  const errorByPath = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const e of errors) {
      const i = /^variables\[(\d+)\]/.exec(e.path);
      if (i) m.set(Number(i[1]), [...(m.get(Number(i[1])) ?? []), e.message]);
    }
    return m;
  }, [errors]);

  const isCompiling = status.status === "compiling";
  const values = state?.evaluation?.values ?? {};
  const order = state?.evaluation?.order ?? rules?.variables.map((v) => v.name) ?? [];
  const ledger = rules ? order.map((n) => rules.variables.find((v) => v.name === n)!).filter((v) => v && v.kind !== "input") : [];
  const inputs = rules?.variables.filter((v) => v.kind === "input") ?? [];
  const checks = state?.sample_check ?? [];
  const matched = checks.filter((c) => c.ok).length;
  const allGreen = checks.length > 0 && matched === checks.length;
  const selectedVar = rules?.variables.find((v) => v.name === selected) ?? null;
  const generalErrors = errors.filter((e) => !/^variables\[\d+\]/.test(e.path));

  return (
    <div className="relative bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      {isCompiling && <div className="shimmer-bar" />}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className={`flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors duration-300 ${allGreen && !isCompiling ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
              {allGreen && !isCompiling ? <CheckCircle2 className="size-4" /> : <Calculator className="size-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                <span>Pricing rules</span>
                {saveStatus && (
                  <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1 animate-in fade-in">
                    <Check className="size-3" />
                    {saveStatus}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCompiling ? (
                  `Turning ${companyName}'s pricing notes into tables and calculations.`
                ) : (
                  <>
                    Every number below is checked against the sample quotation.{" "}
                    <span className="text-foreground font-medium">Edit a price and the ledger recalculates.</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isCompiling} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0" title="Compile the rules again from the notes">
            <RefreshCw className={`size-3 mr-1 ${isCompiling ? "animate-spin" : ""}`} />
            <span>{isCompiling ? "Compiling" : "Regenerate"}</span>
          </Button>
        </div>

        {status.status === "error" && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{status.message ?? "Compiling the pricing rules failed."}</span>
            </div>
            <Button size="sm" variant="outline" onClick={onRegenerate} className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive">
              <RefreshCw className="size-3 mr-1" />
              Try again
            </Button>
          </div>
        )}

        {isCompiling && !rules ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-dashed border-border/60 bg-muted/20 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : rules ? (
          <>
            {/* Assumptions the compiler had to make */}
            {rules.assumptions.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>Your notes left {rules.assumptions.length === 1 ? "one thing" : `${rules.assumptions.length} things`} open. Here's what was assumed:</span>
                </div>
                <ul className="space-y-1 text-xs text-foreground/90 pl-5.5">
                  {rules.assumptions.map((a, i) => (
                    <li key={i} className="list-disc">
                      <span className="text-muted-foreground">{a.text}</span> → {a.resolved_as}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generalErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-0.5">
                {generalErrors.map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
              </div>
            )}

            {/* One card per table */}
            <div className="grid gap-3 sm:grid-cols-2">
              {rules.tables.map((t, i) => (
                <RuleTableCard key={t.id} table={t} onChange={(table) => setRules({ ...rules, tables: rules.tables.map((x, j) => (j === i ? table : x)) })} />
              ))}
            </div>

            {/* What we ask the lead */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <User className="size-3" /> What we ask the lead
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inputs.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setSelected(selected === v.name ? null : v.name)}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-all duration-150 select-none ${
                      selected === v.name ? "bg-foreground text-background border-foreground shadow-xs" : "bg-card border-border text-foreground shadow-xs hover:bg-muted/60 hover:-translate-y-px"
                    }`}
                  >
                    <span>{v.label || v.name}</span>
                    <span className={`text-[10px] ${selected === v.name ? "text-background/70" : "text-muted-foreground"}`}>{INPUT_TYPE_LABEL[v.input_type] ?? v.input_type}</span>
                    {v.required && <span className="size-1.5 rounded-full bg-blue-500" title="required" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculation ledger */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Calculator className="size-3" /> Calculation ledger
              </div>
              <div className="rounded-xl border border-border/70 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-1.5">Value</th>
                      <th className="text-left font-medium px-3 py-1.5 hidden sm:table-cell">How it's worked out</th>
                      <th className="text-right font-medium px-3 py-1.5">Sample</th>
                      <th className="text-right font-medium px-3 py-1.5 hidden md:table-cell">Quotation</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((v) => {
                      const c = checkByName.get(v.name);
                      const idx = rules.variables.indexOf(v);
                      const rowErrors = errorByPath.get(idx);
                      const isSel = selected === v.name;
                      const computed = c?.computed ?? formatValue(v.unit, values[v.name]);
                      return (
                        <tr
                          key={v.name}
                          onClick={() => setSelected(isSel ? null : v.name)}
                          className={`border-t border-border/40 cursor-pointer transition-colors ${isSel ? "bg-muted/60" : "hover:bg-muted/30"} ${rowErrors ? "bg-destructive/5" : ""}`}
                        >
                          <td className="px-3 py-1.5 align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{v.label || v.name}</span>
                              {!v.in_document && <span className="text-[10px] px-1.5 py-px rounded border border-dashed border-border text-muted-foreground">not in document</span>}
                              {v.condition_flag && <span className="text-[10px] text-muted-foreground">only when {rules.variables.find((x) => x.name === v.condition_flag)?.label || v.condition_flag}</span>}
                            </div>
                            <div className="sm:hidden text-[11px] text-muted-foreground mt-0.5">{readable(rules, v)}</div>
                            {rowErrors && <div className="text-[11px] text-destructive mt-0.5">{rowErrors.join("; ")}</div>}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell align-top">{readable(rules, v)}</td>
                          <td className={`px-3 py-1.5 text-right align-top ${v.unit === "money" || v.unit === "percent" || v.unit === "integer" ? "font-mono tabular-nums" : ""} ${c && !c.ok ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                            {computed}
                          </td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground hidden md:table-cell align-top font-mono tabular-nums">{c?.expected ?? samples[v.name] ?? ""}</td>
                          <td className="px-2 py-1.5 text-center align-top">
                            {c ? (
                              c.ok ? <Check className="size-3.5 text-emerald-500 inline" /> : <X className="size-3.5 text-amber-500 inline" aria-label={c.note ?? "does not match"} />
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button type="button" onClick={addHelper} className="w-full flex items-center gap-1 px-3 py-1.5 border-t border-dashed border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                  <Plus className="size-3" /> Add variable
                </button>
              </div>

              {selectedVar && (
                <div className="relative mt-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                  <span className="absolute -top-1.5 left-6 size-3 rotate-45 bg-muted border-l border-t border-border/70" />
                  <div key={selectedVar.name} className="rounded-xl bg-muted border border-border/70 p-3.5">
                    <LedgerTray
                      rules={rules}
                      variable={selectedVar}
                      sample={samples[selectedVar.name]}
                      onChange={(v) => editVariable(selectedVar.name, v)}
                      onDelete={selectedVar.in_document ? undefined : () => { setRules({ ...rules, variables: rules.variables.filter((x) => x.name !== selectedVar.name) }); setSelected(null); }}
                      onClose={() => setSelected(null)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Review rules */}
            {rules.review_rules.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  <ShieldAlert className="size-3" /> Held for review when
                </div>
                <ul className="space-y-1 text-xs">
                  {rules.review_rules.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{readableConds(rules, r.when)}</span>
                      <span className="text-foreground">→ {r.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 flex items-center justify-between border-t border-border/40">
              <span className={`text-[11px] ${allGreen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {checks.length ? `${matched} of ${checks.length} match the quotation` : errors.length ? `${errors.length} thing${errors.length === 1 ? "" : "s"} to fix` : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isCompiling} className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground btn-tactile">
                  Regenerate
                </Button>
                <Button
                  onClick={onProceed}
                  disabled={isCompiling || isProceeding || errors.length > 0}
                  size="sm"
                  className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
                >
                  <span>{isProceeding ? "Proceeding…" : "Proceed to Lead Simulation"}</span>
                  <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PricingEngineDeck;
