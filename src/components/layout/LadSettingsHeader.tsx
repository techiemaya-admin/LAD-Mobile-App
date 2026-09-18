import React from "react";
import {
  Target,
  Users,
  Plug,
  FolderOpen,
  Send,
  Flame,
  CreditCard,
  Coins,
  FileText,
  Crosshair,
  Sun,
  Moon,
  ChevronDown,
  Cpu,
} from "lucide-react";
import type { CompanySummary } from "../../types/company";
import { useTheme } from "../theme-provider";

export interface AIModelOption {
  id: string;
  name: string;
  provider: "deepseek" | "gemini" | "openai" | "anthropic";
  badge: string;
}

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  { id: "deepseek-flash", name: "DeepSeek Flash", provider: "deepseek", badge: "Fast & Accurate" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "deepseek", badge: "High Reasoning" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", badge: "Google Multimodal" },
  { id: "gemini-pro-latest", name: "Gemini 1.5 Pro", provider: "gemini", badge: "Google Pro" },
  { id: "gpt-4o", name: "OpenAI GPT-4o", provider: "openai", badge: "Flagship Omni" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic", badge: "Anthropic Top" },
];

interface LadSettingsHeaderProps {
  companies: CompanySummary[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  activeTab: string;
  onSelectTab?: (tab: string) => void;
  activeAiModel?: string;
  onSelectAiModel?: (modelId: string) => void;
}

export const LadSettingsHeader: React.FC<LadSettingsHeaderProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  activeTab = "businessprofile",
  onSelectTab,
  activeAiModel = "deepseek-flash",
  onSelectAiModel,
}) => {
  const { theme, setTheme } = useTheme();
  const activeCompany = companies.find((c) => c.company_id === activeCompanyId) || companies[0];

  const tabs = [
    { id: "businessprofile", label: "Business Profile", icon: Target },
    { id: "team", label: "Team", icon: Users },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "mediahub", label: "Media Hub", icon: FolderOpen },
    { id: "coldoutbox", label: "Cold Outbox", icon: Send },
    { id: "warmoutbox", label: "Warm Outbox", icon: Flame },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "credits", label: "Credits", icon: Coins },
    { id: "proposals", label: "Auto Proposal", icon: FileText },
    { id: "icp", label: "ICP Strategy", icon: Crosshair },
  ];

  return (
    <header className="bg-gradient-to-b from-blue-50/60 via-background to-background dark:from-[#040e36] dark:via-background dark:to-background border-b border-border/60 pb-3 pt-4 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
        {/* Top Company Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            {/* Logo Avatar Badge */}
            <div className="size-11 rounded-full bg-white dark:bg-[#1A2A43] shadow-xs border border-border/80 flex items-center justify-center text-[#0B1957] dark:text-[#2B7CFF] font-bold text-base select-none">
              <span className="tracking-tight">Mrl</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-foreground font-bold text-base tracking-tight">
                  {activeCompany?.company_name.toLowerCase().replace(/\s+/g, "") || "mrlad"}
                </h1>
              </div>
              <p className="text-muted-foreground text-xs font-normal">
                Renews on October 2, 2026
              </p>
            </div>
          </div>

          {/* Right Header Controls: AI Model Switcher, Tenant Switcher & Theme */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* AI Model Selector */}
            <div className="relative inline-block text-left">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs font-medium shadow-xs text-foreground">
                <Cpu className="size-3.5 text-[#0B1957] dark:text-[#2B7CFF]" />
                <span className="text-muted-foreground hidden sm:inline">AI Engine:</span>
                <select
                  value={activeAiModel}
                  onChange={(e) => onSelectAiModel?.(e.target.value)}
                  aria-label="Select AI Model"
                  className="bg-transparent text-foreground font-semibold outline-hidden cursor-pointer pr-4 appearance-none"
                >
                  {AVAILABLE_AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-card text-foreground">
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none -ml-4" />
              </div>
            </div>

            {/* Company Switcher Dropdown */}
            <div className="relative inline-block text-left">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs font-medium shadow-xs text-foreground">
                <span className="text-muted-foreground">Tenant:</span>
                <select
                  value={activeCompanyId}
                  onChange={(e) => onSelectCompany(e.target.value)}
                  aria-label="Select Tenant Company"
                  className="bg-transparent text-foreground font-semibold outline-hidden cursor-pointer pr-4 appearance-none"
                >
                  {companies.map((c) => (
                    <option key={c.company_id} value={c.company_id} className="bg-card text-foreground">
                      {c.company_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none -ml-4" />
              </div>
            </div>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="size-8 rounded-xl border border-border/80 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-xs cursor-pointer"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1.5 overflow-x-auto pt-1 no-scrollbar">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab?.(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all select-none cursor-pointer ${
                  isSelected
                    ? "bg-card text-[#0B1957] dark:text-[#2B7CFF] border border-border/80 shadow-xs font-bold ring-1 ring-[#2B7CFF]/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
