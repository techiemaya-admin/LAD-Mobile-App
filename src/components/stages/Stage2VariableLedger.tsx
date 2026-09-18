import React, { useState, useRef, useLayoutEffect } from "react";
import {
  Sparkles,
  Table2,
  WandSparkles,
  Quote,
  X,
  RefreshCw,
  Check,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { CustomDropdown } from "../ui/custom-dropdown";
import type { CompanyVariable, CompoundTable, VariableCategory } from "../../types/variable";

interface Stage2VariableLedgerProps {
  companyName: string;
  variables: CompanyVariable[];
  compoundTables: CompoundTable[];
  onVariablesChange: (updated: CompanyVariable[]) => void;
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
    label: "Pricing",
    badgeClass: "text-emerald-700 dark:text-emerald-300",
    idleChipClass:
      "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 hover:border-emerald-300",
  },
  {
    category: "paragraph",
    label: "Paragraphs",
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

export const Stage2VariableLedger: React.FC<Stage2VariableLedgerProps> = ({
  companyName,
  variables,
  compoundTables,
  onVariablesChange,
  onProceed,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(variables[0]?.id || null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [connectorLeft, setConnectorLeft] = useState<number | null>(null);

  const ledgerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const selectedVariable = variables.find((v) => v.id === selectedKey) || null;

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
  }, [selectedKey, variables]);

  const flash = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleRename = (id: string, natural_name: string) => {
    const updated = variables.map((v) => (v.id === id ? { ...v, natural_name } : v));
    onVariablesChange(updated);
    flash("Renamed");
  };

  const handleCategory = (id: string, category: VariableCategory) => {
    const updated = variables.map((v) => (v.id === id ? { ...v, category } : v));
    onVariablesChange(updated);
    flash(`Moved to ${category}`);
  };

  const handleToggleLeaveOut = (id: string, is_deleted: boolean) => {
    const updated = variables.map((v) => (v.id === id ? { ...v, is_deleted } : v));
    onVariablesChange(updated);
    flash(is_deleted ? "Left out" : "Brought back");
  };

  const registerChip = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) chipRefs.current.set(key, el);
    else chipRefs.current.delete(key);
  };

  const inUse = variables.filter((v) => !v.is_deleted).length + compoundTables.length;
  const leftOut = variables.filter((v) => v.is_deleted).length;

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 dark:bg-card/40 p-5 space-y-5 animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Current Proposal / Variable Discovery &amp; Review</span>
              {saveStatus && (
                <span className="text-[11px] font-normal text-emerald-500 flex items-center gap-1">
                  <Check className="size-3" />
                  {saveStatus}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Discover and review dynamic values before proceeding to pricing.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => flash("Refreshed variables")}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          <span>Re-scan</span>
        </Button>
      </div>

      {/* Ledger Chip Rows with distinct category color coding */}
      <div ref={ledgerRef} className="relative space-y-4 pt-1">
        {GROUPS.map((g) => {
          const rowVars = variables.filter((v) => v.category === g.category);
          const rowTables = g.category === "pricing" ? compoundTables : [];

          return (
            <div key={g.category} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <span className="w-32 shrink-0 text-xs font-bold text-muted-foreground">
                {g.label}
              </span>
              <div className="flex flex-wrap gap-2 min-w-0 flex-1">
                {rowVars.map((v) => {
                  const isSelected = v.id === selectedKey;
                  const isDrafted = v.descriptor?.paragraph_config?.mode === "ai_generated";

                  return (
                    <button
                      key={v.id}
                      ref={registerChip(v.id)}
                      type="button"
                      onClick={() => setSelectedKey(isSelected ? null : v.id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold border transition-all duration-150 select-none shadow-2xs ${
                        isSelected
                          ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white border-transparent shadow-xs ring-2 ring-[#2B7CFF]/40 font-bold"
                          : v.is_deleted
                          ? "bg-transparent border-dashed border-border text-muted-foreground line-through opacity-50"
                          : g.idleChipClass
                      }`}
                    >
                      {v.category === "paragraph" &&
                        (isDrafted ? (
                          <WandSparkles className={`size-3 ${isSelected ? "text-blue-300" : "text-purple-500"}`} />
                        ) : (
                          <Quote className={`size-3 ${isSelected ? "text-white" : "text-purple-400"}`} />
                        ))}
                      <span className="truncate max-w-56">{v.natural_name}</span>
                    </button>
                  );
                })}

                {rowTables.map((t) => (
                  <button
                    key={t.table_id}
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold border bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-100/80"
                  >
                    <Table2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span>{t.natural_name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Docked Detail Inspection Tray */}
        {selectedVariable && (
          <div className="relative mt-5 animate-in fade-in slide-in-from-top-1 duration-150">
            {connectorLeft !== null && (
              <span
                className="absolute -top-1.5 size-3 rotate-45 bg-muted dark:bg-[#14233a] border-l border-t border-border/80 transition-[left] duration-150"
                style={{ left: connectorLeft - 6 }}
              />
            )}
            <div className="rounded-2xl bg-muted/60 dark:bg-[#14233a] border border-border/80 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="text"
                    value={selectedVariable.natural_name}
                    onChange={(e) => handleRename(selectedVariable.id, e.target.value)}
                    className="text-xs font-bold text-foreground bg-transparent hover:bg-card/80 focus:bg-card rounded-lg px-2 py-1 border border-transparent focus:border-border outline-none transition-all"
                  />
                  <code className="font-mono text-[11px] text-[#0B1957] dark:text-[#2B7CFF] bg-blue-50 dark:bg-[#000724] px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-[#2B7CFF]/30 font-semibold">
                    {`{${selectedVariable.variable_name}}`}
                  </code>
                </div>

                <div className="flex items-center gap-2">
                  <CustomDropdown
                    value={selectedVariable.category}
                    onChange={(val) => handleCategory(selectedVariable.id, val as VariableCategory)}
                    options={CATEGORY_OPTIONS}
                    size="xs"
                    className="h-7 text-xs bg-card rounded-lg border-border"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleLeaveOut(selectedVariable.id, !selectedVariable.is_deleted)}
                    className="text-[11px] text-muted-foreground hover:text-red-500 px-2.5 py-1 rounded-md"
                  >
                    {selectedVariable.is_deleted ? "Bring back" : "Leave out"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label="Close detail tray"
                    className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1 font-medium">In the sample quotation</div>
                  <div className="p-2.5 rounded-xl bg-card border border-border/80 font-medium text-foreground">
                    &ldquo;{selectedVariable.descriptor?.sample_value || "N/A"}&rdquo;
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1 font-medium">Data classification</div>
                  <div className="p-2.5 rounded-xl bg-card border border-border/80 text-muted-foreground">
                    Type: <strong className="text-foreground">{selectedVariable.data_type || "string"}</strong> • Scope: Document Anchor
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {inUse} variables active in {companyName}&apos;s quotation{leftOut > 0 ? `, ${leftOut} omitted` : ""}
        </span>
        <Button
          onClick={onProceed}
          size="sm"
          className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs"
        >
          <span>Generate Template &amp; Validate Tags</span>
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};
