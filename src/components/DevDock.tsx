import React, { useEffect, useState } from "react";
import {
  Code2,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Braces,
  Calculator,
  Activity,
  Maximize2,
  Minimize2,
  Building2,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Company } from "../types/company";
import type { CompanyVariable, CompoundTable } from "../types/variable";
import type { TemplateStats } from "../types/template";
import type { PricingRulesState, ValidationError } from "../types/pricing";
import { RulesValidationError, updatePricingRules, fetchLogArtifacts, fetchLogArtifact, type LogArtifact } from "../services/api";
import { Button } from "./ui/button";

interface DevDockProps {
  company: Company | null;
  variables?: CompanyVariable[];
  compoundTables?: CompoundTable[];
  templateStats?: TemplateStats | null;
  pricingRules?: PricingRulesState | null;
  onRulesChange?: (state: PricingRulesState) => void;
}

const stageLabel = (stage: string | undefined, hasTemplate: boolean, locked: boolean) =>
  stage === "lead_simulation"
    ? "Stage 5: Lead Simulation"
    : stage === "pricing_engine"
    ? "Stage 4: Pricing Engine"
    : hasTemplate
    ? "Stage 3: Template Checkpoint"
    : locked
    ? "Stage 2: Variable Review"
    : "Stage 1: Pricing Briefing";

type TabKey = "profile" | "anydoc" | "variables" | "rules" | "logs";

export const DevDock: React.FC<DevDockProps> = ({
  company,
  variables,
  compoundTables,
  templateStats,
  pricingRules,
  onRulesChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [copied, setCopied] = useState(false);
  // Rules tab: the raw PricingRules JSON, editable; Apply = PUT, structural errors listed, nothing persisted on 400
  const [rulesText, setRulesText] = useState("");
  const [rulesErrors, setRulesErrors] = useState<ValidationError[]>([]);
  const [rulesApplying, setRulesApplying] = useState(false);
  const [syncedRules, setSyncedRules] = useState(pricingRules);
  if (pricingRules !== syncedRules) {
    setSyncedRules(pricingRules);
    setRulesText(pricingRules ? JSON.stringify(pricingRules.rules, null, 2) : "");
    setRulesErrors(pricingRules?.validation_errors ?? []);
  }
  const applyRules = async () => {
    if (!company) return;
    let parsed;
    try {
      parsed = JSON.parse(rulesText);
    } catch (err) {
      setRulesErrors([{ path: "", message: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}` }]);
      return;
    }
    setRulesApplying(true);
    try {
      const next = await updatePricingRules(company.company_id, parsed);
      setRulesErrors([]);
      onRulesChange?.(next);
    } catch (err) {
      setRulesErrors(err instanceof RulesValidationError ? err.errors : [{ path: "", message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setRulesApplying(false);
    }
  };

  // Logs tab: on-disk pipeline artifacts (prototype-only endpoint), fetched when the tab is shown
  const [artifacts, setArtifacts] = useState<LogArtifact[]>([]);
  const [openArtifact, setOpenArtifact] = useState<{ file: string; text: string } | null>(null);
  const companyId = company?.company_id;
  const stage = company?.working_state?.stage;
  useEffect(() => {
    if (!isOpen || activeTab !== "logs" || !companyId) return;
    let ignore = false;
    fetchLogArtifacts(companyId)
      .then((list) => { if (!ignore) setArtifacts(list); })
      .catch(() => { if (!ignore) setArtifacts([]); });
    return () => { ignore = true; };
  }, [isOpen, activeTab, companyId, stage, templateStats, pricingRules]);
  // Filenames carry a millisecond stamp, so an artifact left open for another company simply never matches.
  const shownArtifact = artifacts.some((a) => a.file === openArtifact?.file) ? openArtifact : null;
  const toggleArtifact = async (file: string) => {
    if (openArtifact?.file === file) { setOpenArtifact(null); return; }
    if (!companyId) return;
    try {
      setOpenArtifact({ file, text: await fetchLogArtifact(companyId, file) });
    } catch (err) {
      setOpenArtifact({ file, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const docMeta = company?.document_metadata;
  const markdown = docMeta?.extracted_markdown || "";

  const resolvedTemplateStats =
    templateStats || company?.working_state?.template_stats || null;

  const isBriefingLocked = Boolean(company?.briefing_locked);

  const variablesPayload = isBriefingLocked
    ? variables && variables.length > 0
      ? { variables, compound_tables: compoundTables || [] }
      : company?.working_state?.extracted_variables || {
          status: "extracting_variables",
          info: "Variable extraction in progress...",
          working_state: company?.working_state,
        }
    : {
        status: "awaiting_stage_2",
        info: "Gemini variable extraction runs in Stage 2 upon briefing confirmation.",
        working_state: company?.working_state ?? null,
      };

  const handleCopy = () => {
    let content = "";
    if (activeTab === "profile") {
      content = JSON.stringify(company?.data || {}, null, 2);
    } else if (activeTab === "anydoc") {
      content = markdown;
    } else if (activeTab === "variables") {
      content = JSON.stringify(variablesPayload, null, 2);
    } else if (activeTab === "rules") {
      content = rulesText || JSON.stringify({ status: "awaiting_stage_4" }, null, 2);
    } else if (activeTab === "logs") {
      content = shownArtifact?.text ?? JSON.stringify(pipelineState, null, 2);
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = markdown ? markdown.split("\n").length : 0;
  const { details: mutationDetails = [], ...templateSummary } = resolvedTemplateStats ?? {};
  const pipelineState = {
    company_id: company?.company_id,
    pipeline_stage: stageLabel(stage, Boolean(resolvedTemplateStats), Boolean(company?.briefing_locked)),
    briefing_locked: company?.briefing_locked,
    pricing_rules_status: pricingRules
      ? `${pricingRules.sample_check.filter((c) => c.ok).length}/${pricingRules.sample_check.length} sample values match, ${pricingRules.validation_errors.length} errors`
      : "awaiting_compile",
    template_status: resolvedTemplateStats ? "generated" : "awaiting_generation",
    template_stats: resolvedTemplateStats ? templateSummary : null,
    document_metadata: docMeta ? { ...docMeta, extracted_markdown: `<${lineCount} lines — see Quotation Markdown tab>` } : null,
    updated_at: company?.updated_at,
  };
  const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : 0;

  return (
    <>
      {/* Floating Trigger Pill when closed */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card text-foreground shadow-lg hover:shadow-xl transition-all duration-150 text-xs font-mono font-medium hover:scale-105 active:scale-95 btn-tactile border border-border"
          >
            <Code2 className="size-3.5 text-primary shrink-0" />
            <span>Dev Inspector</span>
            {markdown ? (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : null}
          </button>
        </div>
      )}

      {/* Docked Inspector Tray when open */}
      {isOpen && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-card/95 text-foreground border-t border-border shadow-2xl backdrop-blur-md transition-all duration-200 flex flex-col ${
            isExpanded ? "h-[90vh]" : "h-72 sm:h-80"
          }`}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40 shrink-0 select-none">
            <div className="flex items-center gap-3 overflow-x-auto">
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground shrink-0">
                <Code2 className="size-3.5 text-primary" />
                <span>Dev Inspector</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {company?.company_name}
                </span>
              </div>

              {/* Tabs */}
              <nav className="flex items-center rounded-lg bg-muted p-0.5 border border-border/70 text-xs">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "profile"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="size-3 text-indigo-500" />
                  <span>Profile JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("anydoc")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "anydoc"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="size-3 text-primary" />
                  <span>Quotation Markdown</span>
                  {markdown && (
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("variables")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "variables"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Braces className="size-3 text-sky-500" />
                  <span>Variables JSON</span>
                </button>

                <button
                  onClick={() => setActiveTab("rules")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "rules"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calculator className="size-3 text-emerald-500" />
                  <span>Rule Schema</span>
                </button>

                <button
                  onClick={() => setActiveTab("logs")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "logs"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="size-3 text-amber-500" />
                  <span>Pipeline Logs</span>
                </button>
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {activeTab === "anydoc" && markdown && (
                <div className="hidden sm:flex items-center gap-1 text-xs font-mono text-muted-foreground mr-2 bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                  <span>{lineCount} lines</span>
                  <span>•</span>
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>{docMeta?.filesize ? `${(docMeta.filesize / 1024).toFixed(1)} KB` : ""}</span>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title="Copy contents"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title={isExpanded ? "Collapse height" : "Expand to 80% height"}
              >
                {isExpanded ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title="Close Inspector"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content Body: Constrained readable width, auto wrap, no horizontal scroll */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs leading-relaxed">
            <div className="max-w-6xl mx-auto w-full">
            {activeTab === "profile" && (
              <div>
                <div className="text-xs font-sans text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Raw Company Profile JSON:</span>
                  <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border/60">
                    {company?.company_id}
                  </span>
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>{JSON.stringify(company?.data || {}, null, 2)}</code>
                </pre>
              </div>
            )}

            {activeTab === "anydoc" && (
              <div>
                {markdown ? (
                  <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all select-text">
                    <code>{markdown}</code>
                  </pre>
                ) : (
                  <div className="py-12 text-center text-muted-foreground space-y-2 font-sans">
                    <FileText className="size-8 mx-auto opacity-30 text-primary" />
                    <p className="text-xs font-medium text-foreground">
                      No quotation document parsed yet for this company.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attach a Microsoft Word quotation (.docx) in Stage 1 and click Send to inspect the extracted Markdown.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "variables" && (
              <div>
                <div className="text-xs font-sans text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Taxonomy and variable anchors (Stage 2):</span>
                  {isBriefingLocked && variables && variables.length > 0 && (
                    <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border border-border/60">
                      {variables.length} active • {compoundTables?.length || 0} tables
                    </span>
                  )}
                </div>
                <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                  <code>{JSON.stringify(variablesPayload, null, 2)}</code>
                </pre>
              </div>
            )}

            {activeTab === "rules" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
                  <span>
                    Pricing Rules JSON{pricingRules ? ` · compiled ${new Date(pricingRules.compiled_at).toLocaleString()}` : " (compiles in Stage 4)"}
                  </span>
                  {pricingRules && (
                    <Button size="sm" variant="outline" onClick={applyRules} disabled={rulesApplying} className="h-6 px-2 text-[11px]">
                      {rulesApplying ? "Applying…" : "Apply"}
                    </Button>
                  )}
                </div>
                {rulesErrors.length > 0 && (
                  <ul className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono space-y-0.5">
                    {rulesErrors.map((e, i) => (
                      <li key={i}>
                        {e.path && <span className="text-destructive/70">{e.path}: </span>}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                {pricingRules ? (
                  <textarea
                    value={rulesText}
                    onChange={(e) => setRulesText(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-64 p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs font-mono leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  />
                ) : (
                  <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                    <code>{JSON.stringify({ status: "awaiting_stage_4", info: "Press “Set up pricing” on the template checkpoint to compile the rules." }, null, 2)}</code>
                  </pre>
                )}
              </div>
            )}

            {activeTab === "logs" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-sans text-muted-foreground mb-2">
                    <span>Where this company is in the pipeline:</span>
                    {resolvedTemplateStats && (
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {resolvedTemplateStats.tags_placed_count} tags • {resolvedTemplateStats.loops_collapsed_count} loops
                      </span>
                    )}
                  </div>
                  <pre className="p-4 rounded-xl bg-muted/30 border border-border/60 text-foreground text-xs leading-relaxed whitespace-pre-wrap wrap-break-word break-all">
                    <code>{JSON.stringify(pipelineState, null, 2)}</code>
                  </pre>
                </div>

                <div>
                  <div className="text-xs font-sans text-muted-foreground mb-2">
                    Template mutations ({mutationDetails.length}) — every tag, loop and matrix docxmlater placed in Stage 3:
                  </div>
                  {mutationDetails.length > 0 ? (
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/60 text-muted-foreground font-sans">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium w-8"></th>
                            <th className="text-left px-3 py-1.5 font-medium">Action</th>
                            <th className="text-left px-3 py-1.5 font-medium">Target</th>
                            <th className="text-left px-3 py-1.5 font-medium">Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mutationDetails.map((d, i) => (
                            <tr key={i} className="border-t border-border/40 align-top">
                              <td className="px-3 py-1">
                                {d.applied ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-destructive" />}
                              </td>
                              <td className="px-3 py-1 whitespace-nowrap">{d.action}</td>
                              <td className="px-3 py-1 break-all">{d.target}</td>
                              <td className="px-3 py-1 text-muted-foreground break-words">{d.info}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] font-sans text-muted-foreground px-1">Generate the template in Stage 3 to see the mutation log.</p>
                  )}
                </div>

                <div>
                  <div className="text-xs font-sans text-muted-foreground mb-2">
                    Run artifacts — the raw model responses and parsed markdown each stage wrote to disk (latest {artifacts.length}):
                  </div>
                  {artifacts.length > 0 ? (
                    <ul className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {artifacts.map((a) => {
                        const expanded = shownArtifact?.file === a.file;
                        return (
                          <li key={a.file}>
                            <button
                              onClick={() => toggleArtifact(a.file)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/40 transition-colors"
                            >
                              <ChevronRight className={`size-3 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                              <span className="text-foreground">{a.kind}</span>
                              <span className="text-muted-foreground ml-auto text-[11px] whitespace-nowrap">{a.logged_at}</span>
                              <span className="text-muted-foreground/70 text-[11px] w-14 text-right">{(a.size / 1024).toFixed(1)} KB</span>
                            </button>
                            {expanded && (
                              <pre className="px-4 py-3 bg-muted/30 border-t border-border/40 text-foreground text-[11px] leading-relaxed whitespace-pre-wrap wrap-break-word break-all max-h-96 overflow-y-auto">
                                <code>{shownArtifact?.text}</code>
                              </pre>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-[11px] font-sans text-muted-foreground px-1">Nothing written yet — artifacts appear after the first extraction or compile.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default DevDock;
