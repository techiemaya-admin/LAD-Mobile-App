import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Sparkles,
  Table2,
  Quote,
  RefreshCw,
  Check,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { CustomDropdown } from "../ui/custom-dropdown";
import { AddCustomChipModal } from "../AddCustomChipModal";
import type {
  CompanyVariable,
  CompoundTable,
  VariableCategory,
} from "../../types/variable";

interface Stage2VariableLedgerProps {
  companyId: string;
  companyName: string;
  variables: CompanyVariable[];
  compoundTables: CompoundTable[];
  quotationMarkdown?: string | null;
  isLoading?: boolean;
  isExtracting?: boolean;
  isGeneratingTemplate?: boolean;
  attentionTargets?: string[];
  onVariablesChange: (variables: CompanyVariable[], tables?: CompoundTable[]) => void;
  onRescan: () => Promise<void>;
  onAddCustomVariable: (payload: {
    natural_name: string;
    category: VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => Promise<void>;
  onProceed: () => void;
}

const GROUPS: {
  category: VariableCategory;
  label: string;
  badgeClass: string;
  idleChipClass: string;
}[] = [
  {
    category: "customer_input",
    label: "Customer Inputs",
    badgeClass: "text-blue-700 dark:text-blue-300",
    idleChipClass:
      "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/90 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 hover:border-blue-300",
  },
  {
    category: "pricing",
    label: "Pricing & Calculations",
    badgeClass: "text-emerald-700 dark:text-emerald-300",
    idleChipClass:
      "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 hover:border-emerald-300",
  },
  {
    category: "paragraph",
    label: "Dynamic Narrative Paragraphs",
    badgeClass: "text-purple-700 dark:text-purple-300",
    idleChipClass:
      "bg-purple-50/70 dark:bg-purple-950/30 border-purple-200/90 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 hover:border-purple-300",
  },
];

const CATEGORY_OPTIONS = [
  { value: "customer_input", label: "Customer Input" },
  { value: "pricing", label: "Pricing" },
  { value: "paragraph", label: "Paragraph" },
];

const SCAN_TRACE = [
  "Reading the quotation document...",
  "Discovering dynamic variables per client...",
  "Categorizing into customer inputs, pricing & paragraphs...",
  "Scanning repeating line-item tables & loops...",
];
const TRACE_STEP_MS = 1800;

const tableKey = (t: CompoundTable) => `table:${t.table_id}`;

export const Stage2VariableLedger: React.FC<Stage2VariableLedgerProps> = ({
  companyName,
  variables,
  compoundTables,
  quotationMarkdown,
  isExtracting = false,
  isGeneratingTemplate = false,
  attentionTargets = [],
  onVariablesChange,
  onRescan,
  onAddCustomVariable,
  onProceed,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [connectorLeft, setConnectorLeft] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [traceStep, setTraceStep] = useState(0);

  const ledgerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Auto-select first active variable on mount
  useEffect(() => {
    if (!selectedKey && variables.length > 0) {
      setSelectedKey(variables[0].id || variables[0].variable_name);
    }
  }, [variables, selectedKey]);

  // Trace step progress when extracting
  useEffect(() => {
    if (!isExtracting) return;
    const id = setInterval(
      () => setTraceStep((s) => Math.min(s + 1, SCAN_TRACE.length - 1)),
      TRACE_STEP_MS
    );
    return () => clearInterval(id);
  }, [isExtracting]);

  useLayoutEffect(() => {
    const measure = () => {
      const chip = selectedKey ? chipRefs.current.get(selectedKey) : null;
      const ledger = ledgerRef.current;
      if (!chip || !ledger) return setConnectorLeft(null);
      const c = chip.getBoundingClientRect();
      const l = ledger.getBoundingClientRect();
      setConnectorLeft(c.left - l.left + c.width / 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selectedKey, variables, compoundTables]);

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleRename = (id: string, natural_name: string) => {
    const updated = variables.map((v) =>
      (v.id === id || v.variable_name === id) ? { ...v, natural_name } : v
    );
    onVariablesChange(updated, compoundTables);
    flash("Renamed");
  };

  const handleCategory = (id: string, category: VariableCategory) => {
    const updated = variables.map((v) =>
      (v.id === id || v.variable_name === id) ? { ...v, category } : v
    );
    onVariablesChange(updated, compoundTables);
    flash(`Moved to ${category}`);
  };

  const handleToggleLeaveOut = (id: string, is_deleted: boolean) => {
    const updated = variables.map((v) =>
      (v.id === id || v.variable_name === id) ? { ...v, is_deleted } : v
    );
    onVariablesChange(updated, compoundTables);
    flash(is_deleted ? "Left out" : "Brought back");
  };

  const registerChip = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) chipRefs.current.set(key, el);
    else chipRefs.current.delete(key);
  };

  const selectedVariable = variables.find(
    (v) => (v.id && v.id === selectedKey) || v.variable_name === selectedKey
  ) || null;

  const selectedTable = compoundTables.find(
    (t) => tableKey(t) === selectedKey || t.table_id === selectedKey || t.loop_tag === selectedKey
  ) || null;

  const inUse = variables.filter((v) => !v.is_deleted).length + compoundTables.length;
  const leftOut = variables.filter((v) => v.is_deleted).length;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Stage 2: Dynamic Variable Discovery &amp; Taxonomy Review</span>
              {saveStatus && (
                <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1">
                  <Check className="size-3" />
                  {saveStatus}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and customize extracted variables from {companyName}&apos;s quotation document.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-8 px-2.5 text-xs text-foreground hover:bg-muted cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" />
            <span>Add Custom</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRescan}
            disabled={isExtracting}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Re-run AI extraction against quotation markdown"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isExtracting ? "animate-spin" : ""}`} />
            <span>{isExtracting ? "Scanning..." : "Re-scan"}</span>
          </Button>
        </div>
      </div>

      {/* Extraction in progress HUD */}
      {isExtracting ? (
        <div className="p-8 rounded-xl border border-dashed border-[#2B7CFF]/40 bg-blue-50/20 dark:bg-[#000724]/30 text-center space-y-3 animate-pulse">
          <Loader2 className="size-6 text-[#2B7CFF] animate-spin mx-auto" />
          <div className="text-xs font-bold text-foreground">
            {SCAN_TRACE[traceStep]}
          </div>
          <p className="text-[11px] text-muted-foreground">
            AI is scanning the document markdown AST and mapping placeholders.
          </p>
        </div>
      ) : (
        <div ref={ledgerRef} className="space-y-4">
          {/* Categorized Chips Container */}
          <div className="space-y-4">
            {GROUPS.map((g) => {
              const groupVars = variables.filter(
                (v) => v.category === g.category && !v.is_deleted
              );

              return (
                <div key={g.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>{g.label}</span>
                    <span className="text-[10px] font-mono font-medium">
                      {groupVars.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {groupVars.length === 0 ? (
                      <span className="text-xs text-muted-foreground/60 italic">
                        No variables in this category
                      </span>
                    ) : (
                      groupVars.map((v) => {
                        const key = v.id || v.variable_name;
                        const isSelected = selectedKey === key;
                        const needsAttention = attentionTargets.includes(v.variable_name);

                        return (
                          <button
                            key={key}
                            ref={registerChip(key)}
                            type="button"
                            onClick={() => setSelectedKey(key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white border-transparent shadow-xs ring-2 ring-[#2B7CFF]/40 scale-102"
                                : needsAttention
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                                : g.idleChipClass
                            }`}
                          >
                            <span>{v.natural_name || v.variable_name}</span>
                            {v.data_type && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-background/80 text-muted-foreground"
                                }`}
                              >
                                {v.data_type}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            {/* Repeating Compound Tables */}
            {compoundTables.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Table2 className="size-3.5 text-[#2B7CFF]" />
                    <span>Repeating Line-Item Tables (Loops)</span>
                  </span>
                  <span className="text-[10px] font-mono font-medium">
                    {compoundTables.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {compoundTables.map((t) => {
                    const key = tableKey(t);
                    const isSelected = selectedKey === key;

                    return (
                      <button
                        key={key}
                        ref={registerChip(key)}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white border-transparent shadow-xs ring-2 ring-[#2B7CFF]/40"
                            : "bg-teal-50/70 dark:bg-teal-950/30 border-teal-200/90 dark:border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100/80"
                        }`}
                      >
                        <Table2 className="size-3" />
                        <span>{t.natural_name || t.loop_tag}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? "bg-white/20 text-white" : "bg-background/80 text-muted-foreground"
                          }`}
                        >
                          {t.row_labels?.length || 0} rows
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Left Out / Excluded variables list */}
            {leftOut > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Excluded from proposal template ({leftOut})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables
                    .filter((v) => v.is_deleted)
                    .map((v) => {
                      const key = v.id || v.variable_name;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleToggleLeaveOut(key, false)}
                          className="px-2.5 py-1 rounded-full text-[11px] bg-muted/60 text-muted-foreground line-through border border-border/60 hover:text-foreground hover:no-underline cursor-pointer"
                          title="Click to restore"
                        >
                          {v.natural_name || v.variable_name} +
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Context Tray Drawer with Pointer Line */}
          {selectedVariable && (
            <div className="relative mt-4 rounded-xl border border-border/80 bg-muted/30 dark:bg-[#14233a] p-4 space-y-3.5 shadow-xs animate-in fade-in duration-150">
              {connectorLeft !== null && (
                <div
                  className="absolute -top-2 size-3.5 rotate-45 border-t border-l border-border/80 bg-muted/30 dark:bg-[#14233a]"
                  style={{ left: connectorLeft - 7 }}
                />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-foreground">Natural Name:</span>
                  <input
                    type="text"
                    value={selectedVariable.natural_name}
                    onChange={(e) =>
                      handleRename(
                        selectedVariable.id || selectedVariable.variable_name,
                        e.target.value
                      )
                    }
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-border/80 bg-card text-foreground focus:ring-2 focus:ring-[#2B7CFF]/30 outline-hidden flex-1 max-w-sm"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <CustomDropdown
                    size="sm"
                    value={selectedVariable.category}
                    onChange={(val) =>
                      handleCategory(
                        selectedVariable.id || selectedVariable.variable_name,
                        val as VariableCategory
                      )
                    }
                    options={CATEGORY_OPTIONS}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleToggleLeaveOut(
                        selectedVariable.id || selectedVariable.variable_name,
                        !selectedVariable.is_deleted
                      )
                    }
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    {selectedVariable.is_deleted ? "Include" : "Leave out"}
                  </Button>
                </div>
              </div>

              {/* Exact Quotation Snippet Context Highlight */}
              {(selectedVariable.descriptor?.context_text || selectedVariable.descriptor?.description) && (
                <div className="p-3 rounded-lg bg-card border border-border/80 space-y-1 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Quote className="size-3 text-[#2B7CFF]" />
                    <span>Quotation Context in Document</span>
                  </div>
                  <div className="text-xs text-foreground/90 font-mono leading-relaxed bg-muted/20 p-2 rounded-md">
                    &ldquo;{selectedVariable.descriptor.context_text || selectedVariable.descriptor.description}&rdquo;
                  </div>
                </div>
              )}

              {/* Variable Metadata */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                <span>
                  AST Tag: <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded-md">&#123;&#123;{selectedVariable.variable_name}&#125;&#125;</code>
                </span>
                {selectedVariable.data_type && (
                  <span>
                    Data Type: <strong className="text-foreground font-mono">{selectedVariable.data_type}</strong>
                  </span>
                )}
                {selectedVariable.descriptor?.sample_value !== undefined && (
                  <span>
                    Sample Value: <strong className="text-foreground">{String(selectedVariable.descriptor.sample_value)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Repeating Table Tray */}
          {selectedTable && (
            <div className="relative mt-4 rounded-xl border border-border/80 bg-muted/30 dark:bg-[#14233a] p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="size-4 text-[#2B7CFF]" />
                  <span className="text-xs font-bold text-foreground">
                    Repeating Table Loop: <code>&#123;#{selectedTable.loop_tag}&#125;...&#123;/{selectedTable.loop_tag}&#125;</code>
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedTable.row_labels?.length || 0} columns / rows mapped
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(selectedTable.row_labels || []).map((col, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-card border border-border/80 text-foreground shadow-2xs"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {inUse} dynamic tags configured for template placement
            </span>
            <Button
              onClick={onProceed}
              disabled={isGeneratingTemplate}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
            >
              {isGeneratingTemplate ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Generating AST Template...</span>
                </>
              ) : (
                <>
                  <span>Generate Template &amp; Checkpoint</span>
                  <ChevronRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Add Custom Variable Modal */}
      <AddCustomChipModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        markdown={quotationMarkdown}
        onAdd={onAddCustomVariable}
      />
    </div>
  );
};
