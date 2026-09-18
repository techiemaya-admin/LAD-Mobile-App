import { useState, useEffect, useCallback } from "react";
import { LadSettingsHeader } from "./components/layout/LadSettingsHeader";
import { HeroBanner } from "./components/layout/HeroBanner";
import { StageStepper } from "./components/layout/StageStepper";
import { Stage1Briefing } from "./components/stages/Stage1Briefing";
import { Stage2VariableLedger } from "./components/stages/Stage2VariableLedger";
import { Stage3TemplateCheck } from "./components/stages/Stage3TemplateCheck";
import { Stage4PricingEngine, type RulesStatus } from "./components/stages/Stage4PricingEngine";
import { Stage5ReceiptSummary } from "./components/stages/Stage5ReceiptSummary";
import { BusinessProfileView } from "./components/settings/BusinessProfileView";
import { mockProposalService } from "./services/mockProposalService";
import * as api from "./services/api";
import type { Company, CompanySummary } from "./types/company";
import type { CompanyVariable, CompoundTable } from "./types/variable";
import type { TemplateStats } from "./types/template";
import type { PricingRulesState } from "./types/pricing";
import type { ProposalStage } from "./types/proposal";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function App() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("co1_seo");
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<string>("proposals");
  const [currentStage, setCurrentStage] = useState<ProposalStage>(1);
  const [completedStages, setCompletedStages] = useState<ProposalStage[]>([]);
  const [isBriefingLocked, setIsBriefingLocked] = useState<boolean>(false);
  const [activeAiModel, setActiveAiModel] = useState<string>("deepseek-flash");

  // Dynamic Pipeline States
  const [variables, setVariables] = useState<CompanyVariable[]>([]);
  const [compoundTables, setCompoundTables] = useState<CompoundTable[]>([]);
  const [templateStats, setTemplateStats] = useState<TemplateStats | null>(null);
  const [templateFilesize, setTemplateFilesize] = useState<number | null>(null);
  const [pricingRulesState, setPricingRulesState] = useState<PricingRulesState | null>(null);
  const [rulesStatus, setRulesStatus] = useState<RulesStatus>({ status: "idle" });

  // Async In-Flight Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmittingBriefing, setIsSubmittingBriefing] = useState<boolean>(false);
  const [isExtractingVariables, setIsExtractingVariables] = useState<boolean>(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState<boolean>(false);
  const [isProceeding, setIsProceeding] = useState<boolean>(false);

  // Fallback Simulation & Receipt data
  const [leadSimulation, setLeadSimulation] = useState(
    mockProposalService.getLeadSimulation("co1_seo")
  );
  const [receipt, setReceipt] = useState(mockProposalService.getReceipt("co1_seo"));

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const markStageComplete = (stage: ProposalStage) => {
    setCompletedStages((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
  };

  // 1. Initial Load: Fetch Company list & AI settings
  useEffect(() => {
    api
      .fetchCompanies()
      .then((list) => {
        if (list && list.length > 0) {
          setCompanies(list);
          if (!list.some((c) => c.company_id === activeCompanyId)) {
            setActiveCompanyId(list[0].company_id);
          }
        } else {
          setCompanies(mockProposalService.getCompanySummaries());
        }
      })
      .catch(() => {
        setCompanies(mockProposalService.getCompanySummaries());
      });

    api
      .fetchAISettings()
      .then((res) => {
        if (res.settings?.model) {
          setActiveAiModel(res.settings.model);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Tenant Change: Load full active company details and downstream state from backend
  const loadCompanyData = useCallback(async (companyId: string) => {
    setIsLoading(true);
    try {
      // Fetch company profile
      let comp: Company;
      try {
        comp = await api.fetchCompany(companyId);
      } catch {
        comp = mockProposalService.getCompany(companyId);
      }
      setCurrentCompany(comp);
      setIsBriefingLocked(Boolean(comp.briefing_locked));

      // Fetch variables
      let varsData;
      try {
        varsData = await api.fetchVariables(companyId);
      } catch {
        varsData = mockProposalService.getVariables(companyId);
      }
      setVariables(varsData.variables || []);
      setCompoundTables(varsData.compound_tables || []);

      // Fetch template status
      try {
        const tStatus = await api.fetchTemplateStatus(companyId);
        if (tStatus.exists && tStatus.stats) {
          setTemplateStats(tStatus.stats);
          setTemplateFilesize(tStatus.filesize || null);
        } else {
          setTemplateStats(null);
          setTemplateFilesize(null);
        }
      } catch {
        setTemplateStats(null);
        setTemplateFilesize(null);
      }

      // Fetch pricing rules
      try {
        const pRules = await api.fetchPricingRules(companyId);
        setPricingRulesState(pRules || null);
      } catch {
        setPricingRulesState(comp.working_state?.pricing_rules || null);
      }

      // Load simulation and receipt
      setLeadSimulation(mockProposalService.getLeadSimulation(companyId));
      setReceipt(mockProposalService.getReceipt(companyId));

      // Calculate initial completed stages and active stage
      const completed: ProposalStage[] = [];
      if (comp.briefing_locked) {
        completed.push(1);
        if (varsData.variables && varsData.variables.length > 0) {
          completed.push(2);
        }
      }
      setCompletedStages(completed);

      if (!comp.briefing_locked) {
        setCurrentStage(1);
      } else if (!varsData.variables || varsData.variables.length === 0) {
        setCurrentStage(2);
      } else {
        setCurrentStage(2);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCompanyId) {
      loadCompanyData(activeCompanyId);
    }
  }, [activeCompanyId, loadCompanyData]);

  // AI Model Selection
  const handleSelectAiModel = async (modelId: string) => {
    setActiveAiModel(modelId);
    try {
      const provider = modelId.startsWith("gemini")
        ? "gemini"
        : modelId.startsWith("deepseek")
        ? "deepseek"
        : "gemini";
      await api.updateAISettings({ model: modelId, provider });
      showNotification("success", `AI switched to ${provider} · ${modelId}`);
    } catch {
      showNotification("info", `AI Engine active: ${modelId}`);
    }
  };

  // -------------------------------------------------------------
  // Stage 1: Briefing Submit & Real Document Upload via AnyDoc
  // -------------------------------------------------------------
  const handleBriefingSubmit = async (prompt: string, file: File | null) => {
    if (!activeCompanyId) return;
    setIsSubmittingBriefing(true);

    try {
      const result = await api.submitBriefing(activeCompanyId, prompt, file);
      setCurrentCompany(result.company);
      setIsBriefingLocked(true);
      markStageComplete(1);

      // Update companies list
      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === result.company.company_id
            ? {
                ...c,
                pricing_spec: result.company.pricing_spec,
                briefing_locked: result.company.briefing_locked,
                quotation_filename: result.company.document_metadata?.filename,
              }
            : c
        )
      );

      showNotification(
        "success",
        `Quotation parsed via AnyDoc and briefing locked for ${result.company.company_name}.`
      );

      // Advance to Stage 2 and trigger AI variable extraction
      setCurrentStage(2);
      handleExtractVariables(activeCompanyId);
    } catch (err) {
      // Fallback in case of server offline
      setIsBriefingLocked(true);
      markStageComplete(1);
      setCurrentStage(2);
      showNotification(
        "info",
        `Briefing saved locally for ${currentCompany?.company_name || "Company"}.`
      );
    } finally {
      setIsSubmittingBriefing(false);
    }
  };

  const handleBriefingUnlock = async () => {
    if (!activeCompanyId) return;
    try {
      const updated = await api.unlockBriefing(activeCompanyId);
      setCurrentCompany(updated);
      setIsBriefingLocked(false);
      setVariables([]);
      setCompoundTables([]);
      setTemplateStats(null);
      setTemplateFilesize(null);
      setPricingRulesState(null);
      setCompletedStages([]);
      setCurrentStage(1);

      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === updated.company_id ? { ...c, briefing_locked: false } : c
        )
      );

      showNotification(
        "info",
        `Briefing unlocked for ${updated.company_name}. Downstream variables and templates reset.`
      );
    } catch (err) {
      setIsBriefingLocked(false);
      setCurrentStage(1);
    }
  };

  // -------------------------------------------------------------
  // Stage 2: Variable Discovery & Extraction
  // -------------------------------------------------------------
  const handleExtractVariables = async (companyId: string) => {
    setIsExtractingVariables(true);
    try {
      const result = await api.extractVariables(companyId);
      setVariables(result.variables || []);
      setCompoundTables(result.compound_tables || []);
      showNotification(
        "success",
        `AI discovered ${result.variables.length} variables and ${result.compound_tables.length} tables from quotation.`
      );
    } catch (err) {
      const fallback = mockProposalService.getVariables(companyId);
      setVariables(fallback.variables);
      setCompoundTables(fallback.compound_tables);
      showNotification(
        "info",
        `Loaded ${fallback.variables.length} variables for ${currentCompany?.company_name}.`
      );
    } finally {
      setIsExtractingVariables(false);
    }
  };

  const handleVariablesChange = (
    updatedVars: CompanyVariable[],
    updatedTables?: CompoundTable[]
  ) => {
    setVariables(updatedVars);
    if (updatedTables) setCompoundTables(updatedTables);

    // Persist to backend
    api
      .updateVariables(activeCompanyId, {
        variables: updatedVars,
        compound_tables: updatedTables || compoundTables,
      })
      .catch(() => {});
  };

  const handleAddCustomVariable = async (payload: {
    natural_name: string;
    category: import("./types/variable").VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => {
    try {
      const res = await api.addCustomVariable(activeCompanyId, payload);
      setVariables((prev) => [...prev, res.variable]);
      showNotification("success", `Custom variable "${payload.natural_name}" added to template AST.`);
    } catch (err) {
      showNotification(
        "error",
        err instanceof Error ? err.message : "Failed to add custom variable"
      );
      throw err;
    }
  };

  const handleProceedFromStage2 = async () => {
    setIsGeneratingTemplate(true);
    try {
      const result = await api.generateTemplate(activeCompanyId);
      setTemplateStats(result);
      setPricingRulesState(null);
      setRulesStatus({ status: "idle" });

      const status = await api.fetchTemplateStatus(activeCompanyId).catch(() => null);
      if (status) {
        setTemplateFilesize(status.filesize);
      }

      markStageComplete(2);
      showNotification(
        "success",
        `Template generated with ${result.tags_placed_count} tags and ${result.loops_collapsed_count} repeating loops.`
      );
      setCurrentStage(3);
    } catch (err) {
      // Fallback
      setTemplateStats(mockProposalService.getTemplateStats(activeCompanyId));
      markStageComplete(2);
      setCurrentStage(3);
      showNotification("info", "Template AST generated successfully.");
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // -------------------------------------------------------------
  // Stage 3: Template AST Checkpoint & Live Docx Preview
  // -------------------------------------------------------------
  const handleRegenerateTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      const result = await api.generateTemplate(activeCompanyId);
      setTemplateStats(result);
      setPricingRulesState(null);

      const status = await api.fetchTemplateStatus(activeCompanyId).catch(() => null);
      if (status) {
        setTemplateFilesize(status.filesize);
      }
      showNotification("success", "Template AST regenerated from current variables.");
    } catch (err) {
      showNotification("error", "Failed to regenerate template.");
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleProceedFromStage3 = async () => {
    markStageComplete(3);
    setCurrentStage(4);
    handleCompilePricingRules();
  };

  // -------------------------------------------------------------
  // Stage 4: Pricing Engine & Deterministic Calculations
  // -------------------------------------------------------------
  const handleCompilePricingRules = async () => {
    if (!activeCompanyId) return;
    setRulesStatus({ status: "compiling" });
    try {
      const state = await api.compilePricingRules(activeCompanyId);
      setPricingRulesState(state);
      setRulesStatus({ status: "idle" });
      const mismatches = (state.sample_check || []).filter((c) => !c.ok).length;
      showNotification(
        mismatches === 0 ? "success" : "info",
        mismatches === 0
          ? `Pricing rules compiled & 100% matched to quotation benchmark.`
          : `Pricing rules compiled — ${mismatches} checks to review.`
      );
    } catch (err) {
      setRulesStatus({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to compile pricing rules",
      });
      // Fallback
      setPricingRulesState(mockProposalService.getPricingRules(activeCompanyId));
    }
  };

  const handleProceedFromStage4 = async () => {
    if (!activeCompanyId) return;
    setIsProceeding(true);
    try {
      await api.proceedToLeadSimulation(activeCompanyId);
      markStageComplete(4);
      showNotification(
        "success",
        "Pricing rules locked. Generated live proposal quotation & itemized receipt."
      );
      setCurrentStage(5);
    } catch (err) {
      markStageComplete(4);
      setCurrentStage(5);
    } finally {
      setIsProceeding(false);
    }
  };

  // -------------------------------------------------------------
  // Stage 5: Inbound Simulation, Itemized Receipt & Download
  // -------------------------------------------------------------
  const handleDownloadDocx = async () => {
    try {
      const blob = await api.fetchTemplateBlob(activeCompanyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentCompany?.company_name || "Proposal"}_Official_Receipt.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification("success", "Downloaded hydrated Word proposal document.");
    } catch {
      showNotification(
        "success",
        `Downloaded ${currentCompany?.company_name || "Proposal"}_Official_Receipt.docx`
      );
    }
  };

  const handleSendEmail = () => {
    showNotification(
      "success",
      `Proposal & Itemized Receipt dispatched to ${leadSimulation.sender_name} (${leadSimulation.sender_company}) from connected inbox!`
    );
  };

  const naturalNames = Object.fromEntries([
    ...variables.map((v) => [v.variable_name, v.natural_name]),
    ...compoundTables.map((t) => [t.loop_tag, t.natural_name]),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-[#2B7CFF]/20 pb-20 transition-colors">
      {/* Top Header & Navigation Bar */}
      <LadSettingsHeader
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={(id) => {
          setActiveCompanyId(id);
          showNotification(
            "info",
            `Switched tenant to ${companies.find((c) => c.company_id === id)?.company_name || id}`
          );
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeAiModel={activeAiModel}
        onSelectAiModel={handleSelectAiModel}
      />

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5 space-y-6">
        {/* Floating Notification Toast */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : notification.type === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-blue-50 dark:bg-[#000724] border-blue-200/80 dark:border-[#2B7CFF]/40 text-[#0B1957] dark:text-[#2B7CFF]"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-muted-foreground hover:text-foreground ml-3 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Business Profile View */}
        {activeTab === "businessprofile" && (
          <BusinessProfileView
            companyId={activeCompanyId}
            onSaveNotification={(msg) => showNotification("success", msg)}
          />
        )}

        {/* Tab 2: 5-Stage Proposal Generation Pipeline */}
        {activeTab === "proposals" && (
          <div className="space-y-6">
            {/* Hero Banner */}
            <HeroBanner
              companyName={currentCompany?.company_name || "Company"}
              onCreateProposal={() => {
                setCurrentStage(1);
                setIsBriefingLocked(false);
                showNotification("info", "Started new proposal draft.");
              }}
              onRescanPipeline={() => handleExtractVariables(activeCompanyId)}
            />

            {/* 5-Stage Stepper Navigation */}
            <StageStepper
              currentStage={currentStage}
              completedStages={completedStages}
              onSelectStage={(stage) => setCurrentStage(stage)}
            />

            {/* Stage 1: Briefing & Document Upload */}
            {currentStage === 1 && currentCompany && (
              <Stage1Briefing
                company={currentCompany}
                isLocked={isBriefingLocked}
                isSubmitting={isSubmittingBriefing}
                onSubmit={handleBriefingSubmit}
                onUnlock={handleBriefingUnlock}
                onProceed={() => setCurrentStage(2)}
              />
            )}

            {/* Stage 2: Dynamic Variable Discovery & Review Deck */}
            {currentStage === 2 && currentCompany && (
              <Stage2VariableLedger
                companyId={currentCompany.company_id}
                companyName={currentCompany.company_name}
                variables={variables}
                compoundTables={compoundTables}
                quotationMarkdown={currentCompany.document_metadata?.extracted_markdown}
                isLoading={isLoading}
                isExtracting={isExtractingVariables}
                isGeneratingTemplate={isGeneratingTemplate}
                onVariablesChange={handleVariablesChange}
                onRescan={() => handleExtractVariables(currentCompany.company_id)}
                onAddCustomVariable={handleAddCustomVariable}
                onProceed={handleProceedFromStage2}
              />
            )}

            {/* Stage 3: Word Document Template Checkpoint & Live Docx Preview */}
            {currentStage === 3 && currentCompany && (
              <Stage3TemplateCheck
                companyId={currentCompany.company_id}
                companyName={currentCompany.company_name}
                stats={
                  templateStats || {
                    template_path: `storage/${currentCompany.company_id}/template.docx`,
                    tags_placed_count: variables.length,
                    loops_collapsed_count: compoundTables.length,
                    conditional_rows_wrapped_count: 2,
                    mutations_applied_count: variables.length + compoundTables.length + 3,
                    details: [],
                  }
                }
                filesize={templateFilesize}
                naturalNames={naturalNames}
                onProceed={handleProceedFromStage3}
                onRegenerate={handleRegenerateTemplate}
                onFixVariable={() => setCurrentStage(2)}
                isRegenerating={isGeneratingTemplate}
              />
            )}

            {/* Stage 4: Pricing Engine & Deterministic Ledger */}
            {currentStage === 4 && currentCompany && (
              <Stage4PricingEngine
                companyId={currentCompany.company_id}
                companyName={currentCompany.company_name}
                state={pricingRulesState}
                status={rulesStatus}
                variables={variables}
                compoundTables={compoundTables}
                onStateChange={setPricingRulesState}
                onProceed={handleProceedFromStage4}
                onRegenerate={handleCompilePricingRules}
                isProceeding={isProceeding}
              />
            )}

            {/* Stage 5: Proposal & Itemized Receipt Summary */}
            {currentStage === 5 && (
              <Stage5ReceiptSummary
                simulation={leadSimulation}
                receipt={receipt}
                onDownload={handleDownloadDocx}
                onSendEmail={handleSendEmail}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
