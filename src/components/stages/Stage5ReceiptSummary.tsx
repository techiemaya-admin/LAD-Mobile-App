import React, { useState } from "react";
import {
  Download,
  Send,
  Sparkles,
  CheckCircle2,
  Receipt,
  User,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "../ui/button";
import type { InboundLeadSimulation } from "../../types/proposal";
import type { ProposalReceipt } from "../../types/receipt";
import { DocxDocumentPreview } from "./DocxDocumentPreview";

interface Stage5ReceiptSummaryProps {
  simulation: InboundLeadSimulation;
  receipt: ProposalReceipt;
  onDownload: () => void;
  onSendEmail: () => void;
}

export const Stage5ReceiptSummary: React.FC<Stage5ReceiptSummaryProps> = ({
  simulation,
  receipt,
  onDownload,
  onSendEmail,
}) => {
  const [activeViewMode, setActiveViewMode] = useState<"receipt" | "docx_preview">("receipt");

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 dark:bg-card/40 p-5 space-y-6 animate-in fade-in duration-200">
      {/* Header Sub-banner with View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-2xs">
            <Receipt className="size-4.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Current Proposal / Proposal &amp; Itemized Receipt Summary</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="size-3" />
                Quotation Ready
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate final tailored proposal and itemized financial receipt.
            </p>
          </div>
        </div>

        {/* View Mode Segmented Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-muted/60 dark:bg-[#14233a] border border-border/80 text-xs font-semibold self-start sm:self-center shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveViewMode("receipt")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeViewMode === "receipt"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Receipt &amp; Lead View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode("docx_preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeViewMode === "docx_preview"
                ? "bg-[#0B1957] dark:bg-[#2B7CFF] text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="size-3.5" />
            <span>Document Preview (.docx)</span>
          </button>
        </div>
      </div>

      {/* Conditional View Rendering */}
      {activeViewMode === "docx_preview" ? (
        /* High-Fidelity .docx Document Preview */
        <DocxDocumentPreview
          receipt={receipt}
          simulation={simulation}
          onDownload={onDownload}
          onSendEmail={onSendEmail}
        />
      ) : (
        /* Standard 2-Column Receipt & Lead Simulation View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Lead Simulation & Tailored Proposal Copy */}
            <div className="space-y-4">
              {/* Inbound Message Container */}
              <div className="p-4 rounded-2xl border border-border/80 bg-muted/30 dark:bg-[#14233a] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="size-3.5 text-[#0B1957] dark:text-[#2B7CFF]" />
                    <span className="text-xs font-bold text-foreground">
                      {simulation.sender_name} ({simulation.sender_company})
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono font-medium">
                    {simulation.received_at}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/80 text-xs text-foreground/90 italic leading-relaxed shadow-2xs">
                  &ldquo;{simulation.raw_message}&rdquo;
                </div>

                {/* Extracted Parameters */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Extracted Parameters
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {simulation.extracted_params.locations && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/60 dark:border-[#2B7CFF]/30">
                        {simulation.extracted_params.locations} Clinics / Locations
                      </span>
                    )}
                    {simulation.extracted_params.seats && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/60 dark:border-[#2B7CFF]/30">
                        {simulation.extracted_params.seats} Employee Seats
                      </span>
                    )}
                    {simulation.extracted_params.tier_requested && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50">
                        Tier: {simulation.extracted_params.tier_requested}
                      </span>
                    )}
                    {simulation.extracted_params.is_annual_prepay && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                        Annual Prepayment
                      </span>
                    )}
                    {simulation.extracted_params.client_state && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-card text-foreground border border-border">
                        State: {simulation.extracted_params.client_state}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tailored Sales Copy Preview */}
              <div className="p-4 rounded-2xl border border-border/80 bg-card space-y-2.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Sparkles className="size-3.5 text-[#0B1957] dark:text-[#2B7CFF]" />
                  <span>Tailored Sales Proposal Narrative</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {simulation.tailored_sales_copy.executive_overview}
                </p>
                <div className="p-3.5 rounded-xl bg-muted/40 dark:bg-[#14233a] text-[11px] text-foreground/80 font-mono leading-relaxed whitespace-pre-wrap border border-border/60 shadow-inner">
                  {simulation.tailored_sales_copy.deliverables_scope}
                </div>
              </div>
            </div>

            {/* Right Column: Official Itemized Financial Receipt Summary */}
            <div className="p-5 rounded-2xl border-2 border-border/80 bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <div className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                    Official Proposal Receipt
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {receipt.receipt_id} • Proposal Ref: {receipt.proposal_id}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    Issued: {receipt.date_issued}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    Valid: {receipt.valid_until}
                  </span>
                </div>
              </div>

              {/* Client & Company Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 dark:bg-[#14233a] p-3 rounded-xl border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Prepared For</div>
                  <div className="font-bold text-foreground mt-0.5">{receipt.client.name}</div>
                  <div className="text-[11px] text-muted-foreground">{receipt.client.company}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Issued By</div>
                  <div className="font-bold text-foreground mt-0.5">{receipt.company.name}</div>
                  <div className="text-[11px] text-muted-foreground">{receipt.company.location}</div>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Itemized Line Items
                </div>
                <div className="rounded-xl border border-border/70 overflow-hidden divide-y divide-border/40 shadow-2xs">
                  {receipt.line_items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 pr-2">
                        <span className={`font-semibold ${item.isDiscount ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                          {item.label}
                        </span>
                        {item.rateLabel && (
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {item.rateLabel}
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono tabular-nums font-bold shrink-0 ${
                          item.isDiscount
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.isTax
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.amount < 0 ? `−$${Math.abs(item.amount).toLocaleString()}` : `$${item.amount.toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Milestones (If Applicable) */}
              {receipt.payment_milestones && receipt.payment_milestones.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Payment Milestones (50/50 Split)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {receipt.payment_milestones.map((m, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-muted/40 dark:bg-[#14233a] border border-border/60">
                        <div className="text-[11px] font-semibold text-foreground">{m.milestone_name}</div>
                        <div className="text-xs font-mono font-extrabold text-[#0B1957] dark:text-[#2B7CFF] mt-0.5">
                          ${m.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grand Total Box */}
              <div className="p-4 rounded-2xl bg-[#0B1957] dark:bg-[#10244C] border border-blue-900/40 text-white flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-blue-200 font-bold block">
                    Total Proposal Value
                  </span>
                  <span className="text-[10px] text-blue-200/70">
                    {receipt.deal_summary.payment_terms}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-white">
                  {receipt.financials.formatted_grand_total}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                Governing rules: {receipt.governing_rules[0]}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveViewMode("docx_preview")}
                className="h-8 px-3 text-xs font-semibold rounded-xl"
              >
                <Eye className="size-3.5 mr-1.5" />
                <span>Preview .docx</span>
              </Button>

              <Button variant="outline" size="sm" onClick={onDownload} className="h-8 px-3 text-xs font-semibold rounded-xl">
                <Download className="size-3.5 mr-1.5" />
                <span>Download .docx</span>
              </Button>

              <Button
                onClick={onSendEmail}
                size="sm"
                className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs flex items-center gap-2"
              >
                <Send className="size-3.5" />
                <span>Send from Connected Inbox</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
