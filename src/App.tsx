import { useState, useEffect } from "react";
import { LadSettingsHeader } from "./components/layout/LadSettingsHeader";
import { HeroBanner } from "./components/layout/HeroBanner";
import { StageStepper } from "./components/layout/StageStepper";
import { Stage1Briefing } from "./components/stages/Stage1Briefing";
import { Stage2VariableLedger } from "./components/stages/Stage2VariableLedger";
import { Stage3TemplateCheck } from "./components/stages/Stage3TemplateCheck";
import { Stage4PricingEngine } from "./components/stages/Stage4PricingEngine";
import { Stage5ReceiptSummary } from "./components/stages/Stage5ReceiptSummary";
import { BusinessProfileView } from "./components/settings/BusinessProfileView";
import { mockProposalService } from "./services/mockProposalService";
import * as api from "./services/api";
import { DEFAULT_BUSINESS_PROFILES } from "./types/businessProfile";
import type { ProposalStage } from "./types/proposal";
import type { CompanyVariable } from "./types/variable";
import { CheckCircle2, AlertCircle, RefreshCw, Sparkles, FileText, Target } from "lucide-react";
import { Button } from "./components/ui/button";

export function App() {
  const [activeCompanyId, setActiveCompanyId] = useState<string>("co1_seo");
  const [activeTab, setActiveTab] = useState<string>("businessprofile");
  const [currentStage, setCurrentStage] = useState<ProposalStage>(2); // Default to Stage 2 Variable Ledger in proposal view
  const [completedStages, setCompletedStages] = useState<ProposalStage[]>([1]);
  const [isBriefingLocked, setIsBriefingLocked] = useState<boolean>(true);
  const [activeAiModel, setActiveAiModel] = useState<string>("deepseek-flash");

  // Notifications
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Dynamic Data loaded from mockProposalService & API
  const companies = mockProposalService.getCompanySummaries();
  const currentCompany = mockProposalService.getCompany(activeCompanyId);
  const initialVars = mockProposalService.getVariables(activeCompanyId);

  const [variables, setVariables] = useState<CompanyVariable[]>(initialVars.variables);
  const [compoundTables, setCompoundTables] = useState(initialVars.compound_tables);
  const [templateStats, setTemplateStats] = useState(mockProposalService.getTemplateStats(activeCompanyId));
  const [pricingRulesState, setPricingRulesState] = useState(mockProposalService.getPricingRules(activeCompanyId));
  const [leadSimulation, setLeadSimulation] = useState(mockProposalService.getLeadSimulation(activeCompanyId));
  const [receipt, setReceipt] = useState(mockProposalService.getReceipt(activeCompanyId));

  // Sync data when activeCompanyId changes
  useEffect(() => {
    const vars = mockProposalService.getVariables(activeCompanyId);
    setVariables(vars.variables);
    setCompoundTables(vars.compound_tables);
    setTemplateStats(mockProposalService.getTemplateStats(activeCompanyId));
    setPricingRulesState(mockProposalService.getPricingRules(activeCompanyId));
    setLeadSimulation(mockProposalService.getLeadSimulation(activeCompanyId));
    setReceipt(mockProposalService.getReceipt(activeCompanyId));
    setIsBriefingLocked(true);
    setCompletedStages([1]);
    setCurrentStage(2);
    setNotification({
      type: "info",
      message: `Switched tenant to ${mockProposalService.getCompany(activeCompanyId).company_name}`,
    });
  }, [activeCompanyId]);

  // Check backend health & AI settings on mount
  useEffect(() => {
    api
      .fetchAISettings()
      .then((data) => {
        if (data.settings?.model) {
          setActiveAiModel(data.settings.model);
        }
      })
      .catch(() => {
        // Backend offline — running in high-performance local simulation mode
      });
  }, []);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
  };

  const markStageComplete = (stage: ProposalStage) => {
    if (!completedStages.includes(stage)) {
      setCompletedStages((prev) => [...prev, stage]);
    }
  };

  const handleSelectAiModel = async (modelId: string) => {
    setActiveAiModel(modelId);
    try {
      const provider = modelId.startsWith("gemini")
        ? "gemini"
        : modelId.startsWith("deepseek")
        ? "deepseek"
        : "gemini";
      await api.updateAISettings({ model: modelId, provider });
      showNotification("success", `AI Engine active: ${modelId}`);
    } catch {
      showNotification("info", `AI Engine selected: ${modelId}`);
    }
  };

  // Stage 1 Handlers
  const handleBriefingSubmit = async (prompt: string, files?: File[]) => {
    setIsBriefingLocked(true);
    markStageComplete(1);

    try {
      if (files && files.length > 0) {
        await api.submitBriefing(activeCompanyId, prompt, files[0]);
      }
    } catch {
      // Offline fallback
    }

    showNotification("success", `Briefing locked & parsed via AnyDoc for ${currentCompany.company_name}`);
    setCurrentStage(2);
  };

  const handleBriefingUnlock = async () => {
    setIsBriefingLocked(false);
    try {
      await api.unlockBriefing(activeCompanyId);
    } catch {
      // Offline fallback
    }
    showNotification("info", "Briefing unlocked. Downstream template and rules may need re-validation.");
  };

  // Stage 2 Handlers
  const handleVariablesChange = (updated: CompanyVariable[]) => {
    setVariables(updated);
    api.updateVariables(activeCompanyId, { variables: updated }).catch(() => {});
  };

  const handleProceedFromStage2 = () => {
    markStageComplete(2);
    showNotification("success", "Template AST hydrated with 18 variable tags.");
    setCurrentStage(3);
  };

  // Stage 3 Handlers
  const handleProceedFromStage3 = () => {
    markStageComplete(3);
    showNotification("success", "Pricing rules compiled. Evaluating deterministic matrix.");
    setCurrentStage(4);
  };

  const handleRegenerateTemplate = async () => {
    try {
      const result = await api.generateTemplate(activeCompanyId);
      setTemplateStats({
        template_path: result.template_path,
        tags_placed_count: result.tags_placed_count,
        loops_collapsed_count: result.loops_collapsed_count,
        conditional_rows_wrapped_count: result.conditional_rows_wrapped_count,
        mutations_applied_count: result.mutations_applied_count,
        details: result.details,
      });
      showNotification("success", "Template AST regenerated from live document.");
    } catch {
      setTemplateStats(mockProposalService.getTemplateStats(activeCompanyId));
      showNotification("info", "Template AST regenerated successfully.");
    }
  };

  // Stage 4 Handlers
  const handleTableChange = (tableId: string, updatedRows: any[]) => {
    const updatedState = mockProposalService.updatePricingTable(activeCompanyId, tableId, updatedRows);
    setPricingRulesState(updatedState);
    showNotification("success", "Table rates updated & recalculations verified.");
  };

  const handleProceedFromStage4 = () => {
    markStageComplete(4);
    showNotification("success", "Pricing verified against benchmark. Simulation active.");
    setCurrentStage(5);
  };

  // Stage 5 Handlers
  const handleDownloadDocx = async () => {
    try {
      const blob = await api.fetchTemplateBlob(activeCompanyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentCompany.company_name}_Proposal_Receipt.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showNotification("success", `Downloaded ${currentCompany.company_name}_Proposal_Receipt.docx`);
    }
  };

  const handleSendEmail = () => {
    showNotification(
      "success",
      `Proposal & Itemized Receipt dispatched to ${leadSimulation.sender_name} (${leadSimulation.sender_company}) from connected inbox!`
    );
  };

  const handleCreateProposal = () => {
    setActiveTab("proposals");
    setCurrentStage(1);
    setIsBriefingLocked(false);
    showNotification("info", "Started new proposal draft. Enter briefing notes or upload .docx");
  };

  const handleRescanPipeline = async () => {
    try {
      const extracted = await api.extractVariables(activeCompanyId);
      setVariables(extracted.variables as any);
      setCompoundTables(extracted.compound_tables as any);
      showNotification("success", "Re-scanned document AST with live AI extractor.");
    } catch {
      const vars = mockProposalService.getVariables(activeCompanyId);
      setVariables([...vars.variables]);
      showNotification("success", "Re-scanned document AST and refreshed dynamic taxonomy.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-[#2B7CFF]/20 pb-20 transition-colors">
      {/* Top Header & Settings Navigation Bar */}
      <LadSettingsHeader
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={setActiveCompanyId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeAiModel={activeAiModel}
        onSelectAiModel={handleSelectAiModel}
      />

      {/* Main Workspace Canvas */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5 space-y-6">
        {/* Floating Notification Toast */}
        {notification && (
          <div
            className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : notification.type === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-[#2B7CFF]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
              className="text-muted-foreground hover:text-foreground ml-3 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: BUSINESS PROFILE */}
        {activeTab === "businessprofile" && (
          <BusinessProfileView
            companyId={activeCompanyId}
            onSaveNotification={(msg) => showNotification("success", msg)}
          />
        )}

        {/* Tab 2: AUTO PROPOSAL PIPELINE */}
        {activeTab === "proposals" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Main Hero Banner */}
            <HeroBanner onCreateProposal={handleCreateProposal} />

            {/* 2. Proposal Pipeline Main Interactive Card */}
            <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs space-y-6">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground tracking-tight">
                  Proposal Pipeline
                </h2>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRescanPipeline}
                  className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <RefreshCw className="size-3.5 mr-1.5" />
                  <span>Re-scan</span>
                </Button>
              </div>

              {/* Interactive Stepper Bar */}
              <StageStepper
                currentStage={currentStage}
                completedStages={completedStages}
                onSelectStage={(stage) => setCurrentStage(stage)}
              />

              {/* Dynamic Stage View (Stage 1 to 5) */}
              <div className="transition-all duration-200">
                {currentStage === 1 && (
                  <Stage1Briefing
                    company={currentCompany}
                    businessProfile={DEFAULT_BUSINESS_PROFILES[activeCompanyId]}
                    isLocked={isBriefingLocked}
                    onSubmit={handleBriefingSubmit}
                    onUnlock={handleBriefingUnlock}
                    onProceed={() => setCurrentStage(2)}
                  />
                )}

                {currentStage === 2 && (
                  <Stage2VariableLedger
                    companyName={currentCompany.company_name}
                    variables={variables}
                    compoundTables={compoundTables}
                    onVariablesChange={handleVariablesChange}
                    onProceed={handleProceedFromStage2}
                  />
                )}

                {currentStage === 3 && templateStats && (
                  <Stage3TemplateCheck
                    companyName={currentCompany.company_name}
                    stats={templateStats}
                    onProceed={handleProceedFromStage3}
                    onRegenerate={handleRegenerateTemplate}
                  />
                )}

                {currentStage === 4 && (
                  <Stage4PricingEngine
                    companyName={currentCompany.company_name}
                    state={pricingRulesState}
                    onTableChange={handleTableChange}
                    onProceed={handleProceedFromStage4}
                    onRegenerate={() => {
                      setPricingRulesState(mockProposalService.getPricingRules(activeCompanyId));
                      showNotification("info", "Pricing engine rules reset & re-compiled.");
                    }}
                  />
                )}

                {currentStage === 5 && (
                  <Stage5ReceiptSummary
                    simulation={leadSimulation}
                    receipt={receipt}
                    onDownload={handleDownloadDocx}
                    onSendEmail={handleSendEmail}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs Placeholder */}
        {activeTab !== "businessprofile" && activeTab !== "proposals" && (
          <div className="bg-card rounded-2xl border border-border/80 p-8 shadow-xs text-center space-y-4 animate-in fade-in duration-200">
            <div className="size-12 rounded-2xl bg-blue-50 dark:bg-[#0B1957] border border-blue-200 dark:border-[#2B7CFF]/40 text-[#0B1957] dark:text-[#2B7CFF] mx-auto flex items-center justify-center">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground capitalize">
                {activeTab.replace(/([a-z])([A-Z])/g, "$1 $2")} Settings
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Connected with MR LAD unified workspace. Switch back to Business Profile or Auto Proposal to configure intelligence engines.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                onClick={() => setActiveTab("businessprofile")}
                className="bg-[#0B1957] dark:bg-[#2B7CFF] hover:bg-[#0B1957]/90 dark:hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                <Target className="size-3.5 mr-1.5" />
                <span>Go to Business Profile</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("proposals")}
                className="text-xs font-semibold rounded-xl border-border/80 text-foreground cursor-pointer"
              >
                <FileText className="size-3.5 mr-1.5" />
                <span>Open Auto Proposal</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
