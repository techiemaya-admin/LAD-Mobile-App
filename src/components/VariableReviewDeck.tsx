import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Plus,
  AlertCircle,
  Check,
  ChevronRight,
  Loader2,
  Table2,
  WandSparkles,
  Quote,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { CustomDropdown } from "./ui/custom-dropdown";
import { AddCustomChipModal } from "./AddCustomChipModal";
import type {
  CompanyVariable,
  CompoundTable,
  VariableCategory,
  VariableDataType,
  VariablesResponse,
} from "../types/variable";
import {
  fetchVariables,
  extractVariables,
  updateVariables,
  addCustomVariable,
} from "../services/api";

interface VariableReviewDeckProps {
  companyId: string;
  companyName: string;
  quotationMarkdown?: string | null;
  isGenerating?: boolean;
  /** A template exists for the current variables, so this step reads as settled. */
  isComplete?: boolean;
  /** variable_name / loop_tag values the last template run could not place. */
  attentionTargets?: string[];
  /** Open this variable_name in the tray; a fresh object per tap so repeat taps re-open it. */
  focusRequest?: { target: string } | null;
  onGenerateTemplate?: () => void;
  onVariablesChange?: (variables: CompanyVariable[], tables: CompoundTable[]) => void;
  /** Fired on every user edit, so the parent can drop a now-stale template. */
  onVariablesEdited?: () => void;
}

type VariablePatch = Partial<
  Pick<CompanyVariable, "natural_name" | "category" | "data_type" | "descriptor" | "is_deleted">
> & { id: string };

const GROUPS: { category: VariableCategory; label: string }[] = [
  { category: "customer_input", label: "Customer inputs" },
  { category: "pricing", label: "Pricing" },
  { category: "paragraph", label: "Paragraphs" },
];

const CATEGORY_OPTIONS = [
  { value: "customer_input", label: "Customer input" },
  { value: "pricing", label: "Pricing" },
  { value: "paragraph", label: "Paragraph" },
];

// ponytail: the backend is one opaque call, so the trace advances on a timer, not on events.
// Upgrade path: stream progress from /variables/extract and drive `traceStep` from it.
const SCAN_TRACE = [
  "Reading the quotation",
  "Finding what changes per client",
  "Sorting into customer inputs, pricing and paragraphs",
  "Checking for repeating tables",
];
const TRACE_STEP_MS = 1800;
const GHOST_ROWS = [[88, 64, 112, 72], [96, 120, 80, 68, 104, 76], [140, 92, 116]];

const tableKey = (t: CompoundTable) => `table:${t.table_id}`;

export const VariableReviewDeck: React.FC<VariableReviewDeckProps> = ({
  companyId,
  companyName,
  quotationMarkdown,
  isGenerating = false,
  isComplete = false,
  attentionTargets = [],
  focusRequest,
  onGenerateTemplate,
  onVariablesChange,
  onVariablesEdited,
}) => {
  const [variables, setVariables] = useState<CompanyVariable[]>([]);
  const [compoundTables, setCompoundTables] = useState<CompoundTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [traceStep, setTraceStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const [connectorLeft, setConnectorLeft] = useState<number | null>(null);

  const ledgerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // If companyId changes without remounting, reset loading state during render
  // avoiding cascading renders caused by setting state synchronously inside an effect
  const [prevCompanyId, setPrevCompanyId] = useState(companyId);
  if (companyId !== prevCompanyId) {
    setPrevCompanyId(companyId);
    setIsLoading(true);
    setError(null);
    setSelectedKey(null);
  }

  // Stable refs for parent callbacks to avoid unnecessary effect re-runs
  const onVariablesChangeRef = useRef(onVariablesChange);
  const onVariablesEditedRef = useRef(onVariablesEdited);
  useEffect(() => {
    onVariablesChangeRef.current = onVariablesChange;
    onVariablesEditedRef.current = onVariablesEdited;
  });

  const runExtraction = useCallback(async () => {
    setIsExtracting(true);
    setTraceStep(0);
    setError(null);
    setSelectedKey(null);
    try {
      const result = await extractVariables(companyId);
      setVariables(result.variables);
      setCompoundTables(result.compound_tables);
      setDealKey((k) => k + 1);
      onVariablesChangeRef.current?.(result.variables, result.compound_tables);
      onVariablesEditedRef.current?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't scan the quotation. Check your connection and try again."
      );
    } finally {
      setIsExtracting(false);
      setIsLoading(false);
    }
  }, [companyId]);

  // Walk the scan trace while extracting; the last step holds until the call returns
  useEffect(() => {
    if (!isExtracting) return;
    const id = setInterval(
      () => setTraceStep((s) => Math.min(s + 1, SCAN_TRACE.length - 1)),
      TRACE_STEP_MS
    );
    return () => clearInterval(id);
  }, [isExtracting]);

  // Load variables on company change
  useEffect(() => {
    let ignore = false;

    fetchVariables(companyId)
      .then((data: VariablesResponse) => {
        if (!ignore) {
          if (data.variables.length === 0) {
            // Auto-trigger extraction if locked and no variables present
            runExtraction();
          } else {
            setVariables(data.variables);
            setCompoundTables(data.compound_tables);
            setIsLoading(false);
            setDealKey((k) => k + 1);
            onVariablesChangeRef.current?.(data.variables, data.compound_tables);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Couldn't load variables");
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [companyId, runExtraction]);

  // A warning chip in the template card asks us to open a specific variable (adjust during render)
  const [handledFocus, setHandledFocus] = useState(focusRequest);
  const [scrollToKey, setScrollToKey] = useState<string | null>(null);
  if (focusRequest !== handledFocus) {
    setHandledFocus(focusRequest);
    const v = variables.find((x) => x.variable_name === focusRequest?.target);
    const t = compoundTables.find((x) => x.loop_tag === focusRequest?.target);
    const key = v ? v.id : t ? tableKey(t) : null;
    if (key) {
      setSelectedKey(key);
      setScrollToKey(key);
    }
  }

  // Point the tray's connector at the selected chip; re-measure on resize
  useLayoutEffect(() => {
    const measure = () => {
      const chip = selectedKey ? chipRefs.current.get(selectedKey) : null;
      const ledger = ledgerRef.current;
      if (!chip || !ledger) return setConnectorLeft(null);
      const c = chip.getBoundingClientRect();
      const l = ledger.getBoundingClientRect();
      setConnectorLeft(c.left - l.left + c.width / 2);
      if (scrollToKey === selectedKey) {
        setScrollToKey(null);
        chip.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selectedKey, scrollToKey, variables, compoundTables]);

  // Escape closes the tray
  useEffect(() => {
    if (!selectedKey) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedKey(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey]);

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  /** Optimistic local update + parent notification; every edit invalidates the template. */
  const commit = (updated: CompanyVariable[]) => {
    setVariables(updated);
    onVariablesChange?.(updated, compoundTables);
    onVariablesEdited?.();
  };

  const persist = async (patch: VariablePatch, msg: string) => {
    try {
      await updateVariables(companyId, { variables: [patch] });
      flash(msg);
    } catch {
      flash("Couldn't save, try again");
    }
  };

  const handleRename = (id: string, name: string) => {
    const natural_name = name.trim();
    const current = variables.find((v) => v.id === id);
    if (!natural_name || !current || current.natural_name === natural_name) return;
    commit(variables.map((v) => (v.id === id ? { ...v, natural_name } : v)));
    persist({ id, natural_name }, "Renamed");
  };

  const handleCategory = (id: string, category: VariableCategory) => {
    const updated = variables.map((v) => {
      if (v.id !== id) return v;
      const descriptor = { ...v.descriptor };
      if (category === "paragraph" && !descriptor.paragraph_config) {
        descriptor.paragraph_config = { mode: "fixed", purpose: "Original quotation paragraph" };
      }
      return {
        ...v,
        category,
        data_type: (category === "paragraph" ? "paragraph" : v.data_type) as VariableDataType,
        descriptor,
      };
    });
    commit(updated);
    const target = updated.find((v) => v.id === id);
    persist(
      {
        id,
        category,
        data_type: category === "paragraph" ? "paragraph" : undefined,
        descriptor: target?.descriptor,
      },
      `Moved to ${CATEGORY_OPTIONS.find((o) => o.value === category)?.label}`
    );
  };

  const patchDescriptor = (
    id: string,
    fn: (v: CompanyVariable) => CompanyVariable["descriptor"],
    msg: string
  ) => {
    const updated = variables.map((v) => (v.id === id ? { ...v, descriptor: fn(v) } : v));
    commit(updated);
    persist({ id, descriptor: updated.find((v) => v.id === id)?.descriptor }, msg);
  };

  const handleParagraphMode = (id: string, mode: "fixed" | "ai_generated") =>
    patchDescriptor(
      id,
      (v) => ({
        ...v.descriptor,
        paragraph_config: {
          mode,
          purpose: v.descriptor.paragraph_config?.purpose || "Executive overview and scope",
          tone: v.descriptor.paragraph_config?.tone || "Professional and consultative",
          length_guideline: v.descriptor.paragraph_config?.length_guideline || "2-3 sentences",
          guidance: v.descriptor.paragraph_config?.guidance || "",
        },
      }),
      mode === "fixed" ? "Kept as fixed text" : "Will be drafted per client"
    );

  const handleSampleValue = (id: string, sample_value: string) =>
    patchDescriptor(id, (v) => ({ ...v.descriptor, sample_value }), "Text updated");

  const handleGuidance = (id: string, guidance: string) =>
    patchDescriptor(
      id,
      (v) => ({
        ...v.descriptor,
        paragraph_config: {
          mode: v.descriptor.paragraph_config?.mode || "ai_generated",
          purpose: v.descriptor.paragraph_config?.purpose || "",
          tone: v.descriptor.paragraph_config?.tone || "",
          length_guideline: v.descriptor.paragraph_config?.length_guideline || "",
          guidance,
        },
      }),
      "Focus saved"
    );

  const handleToggleLeaveOut = (id: string, is_deleted: boolean) => {
    commit(variables.map((v) => (v.id === id ? { ...v, is_deleted } : v)));
    persist({ id, is_deleted }, is_deleted ? "Left out, original wording stays" : "Back in");
  };

  const handleAddCustom = async (payload: {
    natural_name: string;
    category: VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => {
    const result = await addCustomVariable(companyId, payload);
    commit([result.variable, ...variables]);
    setSelectedKey(result.variable.id);
    flash(`Added "${payload.natural_name}"`);
  };

  const inUse = variables.filter((v) => !v.is_deleted).length + compoundTables.length;
  const leftOut = variables.filter((v) => v.is_deleted).length;
  const selectedVariable = variables.find((v) => v.id === selectedKey) || null;
  const selectedTable = compoundTables.find((t) => tableKey(t) === selectedKey) || null;
  const isScanning = isExtracting || (isLoading && variables.length === 0);

  const registerChip = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) chipRefs.current.set(key, el);
    else chipRefs.current.delete(key);
  };

  const chipClass = (selected: boolean, leftOutChip = false) =>
    `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
      selected
        ? "bg-foreground text-background border-foreground shadow-xs"
        : leftOutChip
        ? "bg-transparent border-dashed border-border text-muted-foreground line-through hover:text-foreground"
        : "bg-card border-border text-foreground shadow-xs hover:bg-muted/60 hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:shadow-xs"
    }`;

  let dealIndex = 0;

  return (
    <div className="relative bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all duration-200">
      {isExtracting && <div className="shimmer-bar" />}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors duration-300 ${
                isComplete && !isScanning
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isComplete && !isScanning ? <CheckCircle2 className="size-4" /> : <Sparkles className="size-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                <span>Variables</span>
                {saveStatus && (
                  <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1 animate-in fade-in">
                    <Check className="size-3" />
                    {saveStatus}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isScanning ? (
                  `Scanning ${companyName}'s quotation for what changes per client.`
                ) : (
                  <>
                    {inUse} spots in {companyName}&apos;s quotation will change for each client.{" "}
                    <span className="text-foreground font-medium">Tap one to check it.</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={runExtraction}
            disabled={isExtracting}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            title="Scan the quotation again"
          >
            <RefreshCw className={`size-3 mr-1 ${isExtracting ? "animate-spin" : ""}`} />
            <span>{isExtracting ? "Scanning" : "Re-scan"}</span>
          </Button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runExtraction}
              className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              <RefreshCw className="size-3 mr-1" />
              Try again
            </Button>
          </div>
        )}

        {isScanning ? (
          /* Agent trace + ghost ledger while the scan runs */
          <div className="space-y-4">
            <ol className="space-y-1.5" aria-live="polite">
              {SCAN_TRACE.map((label, i) => {
                const done = i < traceStep;
                const active = i === traceStep;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 text-xs transition-colors duration-300 ${
                      active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    <span className="size-4 flex items-center justify-center shrink-0">
                      {done ? (
                        <Check className="size-3 text-emerald-500 animate-in zoom-in-50 duration-200" />
                      ) : active ? (
                        <Loader2 className="size-3 text-primary animate-spin" />
                      ) : (
                        <span className="size-1 rounded-full bg-current" />
                      )}
                    </span>
                    <span>{label}{active ? "…" : ""}</span>
                  </li>
                );
              })}
            </ol>

            <div className="space-y-2.5 pt-1" aria-hidden="true">
              {GROUPS.map((g, gi) => (
                <div key={g.category} className="flex items-start gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground/60 pt-1.5">{g.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {GHOST_ROWS[gi].map((w, i) => (
                      <span
                        key={i}
                        className="h-7 rounded-md bg-muted/60 animate-pulse"
                        style={{ width: w, animationDelay: `${(gi * 4 + i) * 90}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Ledger: one row per category, chips fill the width */}
            <div ref={ledgerRef} className="relative">
              <div className="space-y-2.5">
                {GROUPS.map((g, gi) => {
                  const rowVars = variables
                    .filter((v) => v.category === g.category)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  const rowTables = g.category === "pricing" ? compoundTables : [];
                  const isLast = gi === GROUPS.length - 1;
                  return (
                    <div key={g.category} className="flex items-start gap-3">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground pt-1.5">
                        {g.label}
                      </span>
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {rowVars.length + rowTables.length === 0 && !isLast && (
                          <span className="text-xs text-muted-foreground/60 pt-1.5">None found</span>
                        )}
                        {rowVars.map((v) => {
                          const selected = v.id === selectedKey;
                          const needsAttention = attentionTargets.includes(v.variable_name);
                          const drafted = v.descriptor.paragraph_config?.mode === "ai_generated";
                          const i = dealIndex++;
                          return (
                            <button
                              key={`${dealKey}-${v.id}`}
                              ref={registerChip(v.id)}
                              type="button"
                              onClick={() => setSelectedKey(selected ? null : v.id)}
                              aria-pressed={selected}
                              title={
                                v.category === "paragraph"
                                  ? drafted ? "Drafted per client" : "Fixed text"
                                  : undefined
                              }
                              className={`${chipClass(selected, v.is_deleted)} animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none`}
                              style={{ animationDelay: `${i * 20}ms`, animationFillMode: "backwards" }}
                            >
                              {v.category === "paragraph" &&
                                (drafted ? (
                                  <WandSparkles className={`size-3 ${selected ? "" : "text-primary"}`} />
                                ) : (
                                  <Quote className={`size-3 ${selected ? "" : "text-muted-foreground"}`} />
                                ))}
                              <span className="truncate max-w-56">{v.natural_name}</span>
                              {needsAttention && !v.is_deleted && (
                                <span className="size-1.5 rounded-full bg-amber-500" title="Didn't land in the last template" />
                              )}
                            </button>
                          );
                        })}
                        {rowTables.map((t) => {
                          const key = tableKey(t);
                          const selected = key === selectedKey;
                          const i = dealIndex++;
                          return (
                            <button
                              key={`${dealKey}-${key}`}
                              ref={registerChip(key)}
                              type="button"
                              onClick={() => setSelectedKey(selected ? null : key)}
                              aria-pressed={selected}
                              title="Repeating table"
                              className={`${chipClass(selected)} animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none`}
                              style={{ animationDelay: `${i * 20}ms`, animationFillMode: "backwards" }}
                            >
                              <Table2 className={`size-3 ${selected ? "" : "text-muted-foreground"}`} />
                              <span className="truncate max-w-56">{t.natural_name || "Line items"}</span>
                              {attentionTargets.includes(t.loop_tag) && (
                                <span className="size-1.5 rounded-full bg-amber-500" />
                              )}
                            </button>
                          );
                        })}
                        {isLast && (
                          <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                          >
                            <Plus className="size-3" />
                            <span>Add one</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail tray, docked under the ledger with a connector pointing at the chip */}
              {(selectedVariable || selectedTable) && (
                <div className="relative mt-4 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                  {connectorLeft !== null && (
                    <span
                      className="absolute -top-1.5 size-3 rotate-45 bg-muted border-l border-t border-border/70 transition-[left] duration-200 ease-out"
                      style={{ left: connectorLeft - 6 }}
                    />
                  )}
                  <div
                    key={selectedKey}
                    className="rounded-xl bg-muted border border-border/70 p-3.5 space-y-2.5 animate-in fade-in duration-150 motion-reduce:animate-none"
                  >
                    {selectedVariable ? (
                      <VariableTray
                        v={selectedVariable}
                        onClose={() => setSelectedKey(null)}
                        onRename={handleRename}
                        onCategory={handleCategory}
                        onParagraphMode={handleParagraphMode}
                        onSampleValue={handleSampleValue}
                        onGuidance={handleGuidance}
                        onToggleLeaveOut={handleToggleLeaveOut}
                      />
                    ) : selectedTable ? (
                      <TableTray t={selectedTable} onClose={() => setSelectedKey(null)} />
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 flex items-center justify-between border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                {inUse} in use{leftOut > 0 ? `, ${leftOut} left out` : ""}
              </span>
              <Button
                onClick={onGenerateTemplate}
                disabled={isGenerating || inUse === 0}
                size="sm"
                className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <span>Generate template</span>
                    <ChevronRight className="size-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>

      <AddCustomChipModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        markdown={quotationMarkdown}
        onAdd={handleAddCustom}
      />
    </div>
  );
};

/* ---------- Tray contents ---------- */

/** Label over value, so terms and values line up across the grid. */
const Fact: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className = "",
  children,
}) => (
  <div className={`min-w-0 ${className}`}>
    <div className="text-[11px] text-muted-foreground leading-none mb-1">{label}</div>
    <div className="text-xs text-foreground leading-snug break-words">{children}</div>
  </div>
);

const TrayHeader: React.FC<{
  name: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
}> = ({ name, actions, onClose }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0 flex-1">{name}</div>
    <div className="flex items-center gap-1 shrink-0">
      {actions}
      <button
        type="button"
        onClick={onClose}
        className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/70 flex items-center justify-center transition-colors"
        title="Close (Esc)"
      >
        <X className="size-3.5" />
      </button>
    </div>
  </div>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="font-mono text-[11px] text-muted-foreground">{children}</code>
);

interface VariableTrayProps {
  v: CompanyVariable;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onCategory: (id: string, c: VariableCategory) => void;
  onParagraphMode: (id: string, mode: "fixed" | "ai_generated") => void;
  onSampleValue: (id: string, text: string) => void;
  onGuidance: (id: string, text: string) => void;
  onToggleLeaveOut: (id: string, is_deleted: boolean) => void;
}

const VariableTray: React.FC<VariableTrayProps> = ({
  v,
  onClose,
  onRename,
  onCategory,
  onParagraphMode,
  onSampleValue,
  onGuidance,
  onToggleLeaveOut,
}) => {
  const isParagraph = v.category === "paragraph";
  const mode = v.descriptor.paragraph_config?.mode || "fixed";
  const d = v.descriptor;
  const condition = d.visibility_rule?.show_when || d.visibility_rule?.condition_flag;

  return (
    <>
      <TrayHeader
        onClose={onClose}
        name={
          <input
            type="text"
            defaultValue={v.natural_name}
            onBlur={(e) => onRename(v.id, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="w-full text-[13px] font-semibold text-foreground bg-transparent hover:bg-background/60 focus:bg-background rounded px-1.5 py-0.5 -mx-1.5 border border-transparent focus:border-border/60 outline-hidden transition-colors"
            title="Click to rename"
          />
        }
        actions={
          <>
            <CustomDropdown
              value={v.category}
              onChange={(val) => onCategory(v.id, val as VariableCategory)}
              options={CATEGORY_OPTIONS}
              size="xs"
              menuAlign="right"
              className="h-7 px-2 text-[11px] bg-background/70 hover:bg-background border-border/50 rounded-md font-normal"
            />
            <button
              type="button"
              onClick={() => onToggleLeaveOut(v.id, !v.is_deleted)}
              className={`h-7 px-2 rounded-md text-[11px] transition-colors ${
                v.is_deleted
                  ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  : "text-muted-foreground hover:text-red-500 hover:bg-background/70"
              }`}
              title={v.is_deleted ? "Use this spot again" : "Keep the original wording in every proposal"}
            >
              {v.is_deleted ? "Bring back" : "Leave out"}
            </button>
          </>
        }
      />

      {v.is_deleted && (
        <p className="text-xs text-muted-foreground">
          Left out. The original wording stays in every proposal.
        </p>
      )}

      {!isParagraph && (
        <div className="space-y-3 pt-3 border-t border-border/50">
          {d.sample_value && (
            <Fact label="In the quotation">
              <span className="text-[13px] font-medium">&ldquo;{d.sample_value}&rdquo;</span>
            </Fact>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {d.enum_options && d.enum_options.length > 0 && (
              <Fact label="One of">{d.enum_options.join(", ")}</Fact>
            )}
            {condition && <Fact label="Shown only when">{condition.replace(/_/g, " ")}</Fact>}
            <Fact label="Template tag">
              <Tag>{`{${v.variable_name}}`}</Tag>
            </Fact>
            {v.is_custom && <Fact label="Source">Added by you</Fact>}
          </div>
          {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
        </div>
      )}

      {isParagraph && (
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <Fact label="How it's filled" className="col-span-2">
              <div className="flex items-center rounded-lg bg-background/70 p-0.5 border border-border/40 w-fit mt-0.5">
                {(
                  [
                    { id: "fixed", label: "Fixed text", Icon: Quote },
                    { id: "ai_generated", label: "Drafted per client", Icon: WandSparkles },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onParagraphMode(v.id, id)}
                    aria-pressed={mode === id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      mode === id ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3" />
                    {label}
                  </button>
                ))}
              </div>
            </Fact>
            <Fact label="Template tag">
              <Tag>{`{${v.variable_name}}`}</Tag>
            </Fact>
          </div>

          {mode === "fixed" ? (
            <Fact label="Text used in every proposal">
              <textarea
                key={`${v.id}-fixed`}
                defaultValue={d.sample_value || ""}
                onBlur={(e) => onSampleValue(v.id, e.target.value)}
                rows={3}
                placeholder="This exact wording goes into every proposal."
                className="mt-0.5 w-full text-xs leading-relaxed bg-background/60 border border-border/40 rounded-lg p-2.5 focus:outline-hidden focus:border-border text-foreground resize-none"
              />
            </Fact>
          ) : (
            <>
              {d.sample_value && (
                <Fact label="In the quotation">
                  <span className="text-muted-foreground line-clamp-2">&ldquo;{d.sample_value}&rdquo;</span>
                </Fact>
              )}
              <Fact label="What should the draft focus on?">
                <textarea
                  key={`${v.id}-guidance`}
                  defaultValue={d.paragraph_config?.guidance || d.paragraph_config?.purpose || ""}
                  onBlur={(e) => onGuidance(v.id, e.target.value)}
                  rows={2}
                  placeholder="e.g. Tie the recommendation to the client's number of locations"
                  className="mt-0.5 w-full text-xs leading-relaxed bg-background/60 border border-border/40 rounded-lg p-2.5 focus:outline-hidden focus:border-border text-foreground resize-none"
                />
              </Fact>
            </>
          )}
        </div>
      )}
    </>
  );
};

const TableTray: React.FC<{ t: CompoundTable; onClose: () => void }> = ({ t, onClose }) => (
  <>
    <TrayHeader
      onClose={onClose}
      name={<p className="text-[13px] font-semibold text-foreground">{t.natural_name || "Line items"}</p>}
    />
    <div className="pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      <Fact label="Repeats for">each line item on the proposal</Fact>
      {t.columns?.length > 0 && <Fact label="Columns">{t.columns.join(", ")}</Fact>}
      {t.row_labels?.length > 0 && (
        <Fact label="In the quotation">
          {t.row_labels.length} rows, starting with &ldquo;{t.row_labels[0]}&rdquo;
        </Fact>
      )}
      <Fact label="Template tag">
        <Tag>{`{#${t.loop_tag}} … {/${t.loop_tag}}`}</Tag>
      </Fact>
    </div>
  </>
);
