import React, { useState } from "react";
import {
  FileText,
  Upload,
  Lock,
  Edit2,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Wand2,
  FileCheck,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import type { Company } from "../../types/company";
import type { BusinessProfile } from "../../types/businessProfile";

interface Stage1BriefingProps {
  company: Company;
  businessProfile?: BusinessProfile;
  isLocked: boolean;
  onSubmit: (prompt: string, files?: File[]) => void;
  onUnlock: () => void;
  onProceed: () => void;
}

interface SuggestedDoc {
  id: string;
  title: string;
  category: string;
  filename: string;
  isUploaded: boolean;
  isAIGenerated?: boolean;
  fileSize?: string;
}

export const Stage1Briefing: React.FC<Stage1BriefingProps> = ({
  company,
  businessProfile,
  isLocked,
  onSubmit,
  onUnlock,
  onProceed,
}) => {
  const [promptText, setPromptText] = useState(
    company.pricing_spec || "Enter your pricing model description, tiers, discounts, and tax rules..."
  );

  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const [suggestedDocs, setSuggestedDocs] = useState<SuggestedDoc[]>([
    {
      id: "doc_quote",
      title: "1. Primary Quotation & Pricing (.docx)",
      category: "Quotation Schedule",
      filename: company.document_metadata?.filename || "Co1_Proposal_Northstar_BloomAndCo.docx",
      isUploaded: true,
      fileSize: "28.4 KB",
    },
    {
      id: "doc_sow",
      title: "2. Scope of Work & Deliverables SOW (.docx)",
      category: "Scope Specifications",
      filename: "Scope_of_Work_Deliverables.docx",
      isUploaded: false,
      fileSize: "32.1 KB",
    },
    {
      id: "doc_msa",
      title: "3. Master Services Agreement MSA (.docx)",
      category: "Terms & Conditions",
      filename: "Master_Services_Agreement_Terms.docx",
      isUploaded: false,
      fileSize: "45.0 KB",
    },
  ]);

  // Dynamically synthesize natural language briefing prompt from Business Profile data
  const handleAIGeneratePrompt = () => {
    const bp = businessProfile;
    const companyName = bp?.companyName || company.company_name || "Our Company";
    const industry = bp?.industry || "B2B Services";
    const dealSize = bp?.averageDealSize || "$25,000 - $80,000";
    const guarantee = bp?.compliantGuarantee || "100% money back guarantee if not satisfied within 14 days.";
    const locations = bp?.icpLocations || "USA, UAE, Singapore";

    let generated = "";

    if (company.company_id === "co2_msp" || industry.toLowerCase().includes("it") || industry.toLowerCase().includes("cloud")) {
      generated = `${companyName} Managed Security & IT Retainer Specification:

1. Per-Seat Service Tiers:
• Essential IT Defense: $45 / user / mo (24/7 helpdesk, anti-virus, patch management).
• Standard Zero-Trust: $65 / user / mo (SOC monitoring, email security, cloud backup).
• Premium Enterprise: $85 / user / mo (Dedicated SOC, compliance audit readiness, HIPAA/SOC2).

2. Volume & Commitments:
• $5/seat/mo discount for 25+ seats, $10/seat/mo discount for 50+ seats.
• Extra server / firewall endpoints billed at $120/device/mo.
• One-time onboarding setup fee: $75/seat.

3. Discounts & Taxes:
• 10% annual prepayment discount on 12-month commitments.
• Applicable state sales tax (6.00%) applied to hardware & taxable post-discount subtotal.
• Guarantee: ${guarantee}`;
    } else if (company.company_id === "co3_dev" || industry.toLowerCase().includes("software") || industry.toLowerCase().includes("dev")) {
      generated = `${companyName} Dedicated Product Squad & Fixed Builds:

1. Milestone & Build Packages:
• MVP / Landing Engine: $4,500 fixed (Scope: 2-week turnaround, responsive UI, database).
• Core Platform Build: $12,500 fixed (Scope: Full stack web application, auth, payment rails).
• Enterprise Scaled Squad: $24,000 / mo (Dedicated 3-engineer squad, CI/CD, weekly sprints).

2. Optional Modular Add-ons:
• AI Model Integration: $3,500 fixed.
• DevOps & Cloud Infrastructure: $2,200 fixed.
• 10% bundle discount when 2 or more modular add-ons are included.

3. Payment Structure & Terms:
• 50% upfront deposit upon contract execution, 50% on final UAT milestone acceptance.
• Standard engagement cycle: 3 to 6 weeks. Target regions: ${locations}.`;
    } else {
      generated = `${companyName} (${industry}) 3-Tier Proposal Pricing Model:

1. Structured Packages:
• Local Starter: $1,000 / mo (Single location, monthly audit, local visibility & core optimization).
• Growth Accelerator: $3,000 / mo (Up to 3 clinic locations, directory citations, 4 content pieces/mo).
• Authority Leader: $8,000 / mo (Unlimited locations, dedicated senior strategist, weekly custom deliverables).

2. Commercial Terms & Incentives:
• 10% annual prepayment discount applied for upfront 12-month contract commitment.
• Texas state sales tax (8.25%) applied to taxable post-discount subtotal.
• Average Deal Benchmark: ${dealSize}.
• Guarantee & Reversal: ${guarantee}`;
    }

    setPromptText(generated);
  };

  const handlePresetPrompt = (preset: "tier" | "seat" | "milestone") => {
    if (preset === "tier") {
      setPromptText(`Tier Model: Local ($1000/mo, 1 loc), Growth ($3000/mo, 3 locs), Authority ($8000/mo, unlimited). 10% annual discount. 8.25% TX tax.`);
    } else if (preset === "seat") {
      setPromptText(`Per-seat IT Support: Essential ($45/seat/mo), Standard ($65/seat/mo), Premium ($85/seat/mo). $5/seat off past 25 seats, $10 off past 50. Extra devices $12/mo. $75 setup/seat. 6% OH tax.`);
    } else {
      setPromptText(`Fixed Web Builds: Landing Page ($2500), Business Site ($6000), E-Commerce ($9500). Add-ons: Copywriting ($600), SEO ($450). 10% bundle discount on 2+ add-ons. 50/50 payment split.`);
    }
  };

  const handleLetAIBuildDoc = (docId: string) => {
    setGeneratingDocId(docId);
    setTimeout(() => {
      setSuggestedDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, isUploaded: true, isAIGenerated: true }
            : d
        )
      );
      setGeneratingDocId(null);
    }, 700);
  };

  const handleFileUpload = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFiles((prev) => [...prev, file]);
      setSuggestedDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                filename: file.name,
                fileSize: `${(file.size / 1024).toFixed(1)} KB`,
                isUploaded: true,
                isAIGenerated: false,
              }
            : d
        )
      );
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 dark:bg-card/40 p-5 space-y-6 animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 flex items-center justify-center shrink-0 shadow-2xs">
            {isLocked ? <CheckCircle2 className="size-4.5 text-emerald-500" /> : <Sparkles className="size-4.5" />}
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Current Proposal / Pricing Briefing &amp; Quotation Ingestion</span>
              {isLocked && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Locked &amp; Parsed
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture quotation request and ingest natural language pricing briefing.
            </p>
          </div>
        </div>

        {isLocked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUnlock}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <Edit2 className="size-3.5 mr-1.5" />
            <span>Unlock &amp; Edit</span>
          </Button>
        )}
      </div>

      {isLocked ? (
        /* Read-only Locked View */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 dark:bg-[#14233a] border border-border/80 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3.5" />
              <span>Confirmed Pricing Briefing Spec</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
              {promptText}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center border border-blue-200/50 dark:border-[#2B7CFF]/30">
                <FileText className="size-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  {company.document_metadata?.filename || "Sample_Quotation.docx"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Verified sample quotation • Extracted with @firecrawl/anydoc
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              Ingested
            </span>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Quotation parsed into semantic markdown
            </span>
            <Button
              onClick={onProceed}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
            >
              <span>View Variable Ledger</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        /* Active Editable Form */
        <div className="space-y-5">
          {/* Prompt Section with AI generation actions */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-foreground">
                Describe your pricing logic, tiers, volume rules, and taxes
              </label>

              {/* AI Prompt Generator & Sample Words */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleAIGeneratePrompt}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-[#000724] border border-blue-200/80 dark:border-[#2B7CFF]/40 text-[#0B1957] dark:text-[#2B7CFF] text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-[#1A2A43] transition-all shadow-2xs cursor-pointer"
                >
                  <Wand2 className="size-3 text-[#2B7CFF]" />
                  <span>AI Generate Prompt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetPrompt("tier")}
                  className="px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-[10px] font-medium border border-border cursor-pointer"
                >
                  Tiers Preset
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetPrompt("seat")}
                  className="px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-[10px] font-medium border border-border cursor-pointer"
                >
                  Per-Seat Preset
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetPrompt("milestone")}
                  className="px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-[10px] font-medium border border-border cursor-pointer"
                >
                  Fixed Build Preset
                </button>
              </div>
            </div>

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={5}
              className="w-full text-xs p-3.5 rounded-xl border border-border/80 bg-card text-foreground focus:ring-2 focus:ring-[#2B7CFF]/30 outline-hidden leading-relaxed shadow-inner"
              placeholder="e.g. We have 3 packages: Local ($1000/mo), Growth ($3000/mo), Authority ($8000/mo)..."
            />
          </div>

          {/* 3 Suggested Reference Documents Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Suggested Reference Proposal Documents (Upload or Build with AI)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Upload your templates one-by-one. If you don&apos;t have one, click &ldquo;Let AI Build&rdquo; to auto-generate it.
                </p>
              </div>
              <span className="text-[10px] font-mono font-medium text-muted-foreground">
                {suggestedDocs.filter((d) => d.isUploaded).length} of 3 Attached
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {suggestedDocs.map((doc) => {
                const isGenerating = generatingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between space-y-3 transition-all ${
                      doc.isUploaded
                        ? "bg-card border-border/80 shadow-2xs ring-1 ring-emerald-500/20"
                        : "bg-muted/20 border-dashed border-border hover:border-[#2B7CFF]/50"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {doc.category}
                        </span>
                        {doc.isUploaded && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="size-2.5" />
                            {doc.isAIGenerated ? "AI Generated" : "Uploaded"}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-foreground">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {doc.filename} {doc.fileSize ? `(${doc.fileSize})` : ""}
                      </div>
                    </div>

                    {/* Actions per card */}
                    <div className="pt-2 border-t border-border/40">
                      {doc.isUploaded ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <FileCheck className="size-3.5" /> Ready for AST Scan
                          </span>
                          <label className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
                            <span>Replace</span>
                            <input
                              type="file"
                              accept=".docx"
                              className="hidden"
                              onChange={(e) => handleFileUpload(doc.id, e)}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-card border border-border/80 hover:bg-muted text-[11px] font-medium text-foreground transition-colors shadow-2xs cursor-pointer">
                            <Upload className="size-3" />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept=".docx"
                              className="hidden"
                              onChange={(e) => handleFileUpload(doc.id, e)}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => handleLetAIBuildDoc(doc.id)}
                            disabled={isGenerating}
                            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] text-[11px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="size-3 animate-spin" />
                                <span>Building...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3" />
                                <span>Let AI Build</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ready to parse documents &amp; discover template variables
            </span>
            <Button
              onClick={() => onSubmit(promptText, uploadedFiles)}
              size="sm"
              className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
            >
              <span>Save &amp; Discover Variables</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
