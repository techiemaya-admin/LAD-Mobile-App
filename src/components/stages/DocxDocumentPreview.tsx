import React, { useState } from "react";
import {
  Download,
  Send,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "../ui/button";
import type { ProposalReceipt } from "../../types/receipt";
import type { InboundLeadSimulation } from "../../types/proposal";

interface DocxDocumentPreviewProps {
  receipt: ProposalReceipt;
  simulation: InboundLeadSimulation;
  onDownload: () => void;
  onSendEmail: () => void;
}

export const DocxDocumentPreview: React.FC<DocxDocumentPreviewProps> = ({
  receipt,
  simulation,
  onDownload,
  onSendEmail,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 140));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 70));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <div
      className={`space-y-4 transition-all duration-200 ${
        isFullScreen
          ? "fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 sm:p-8 overflow-y-auto flex flex-col"
          : ""
      }`}
    >
      {/* Document Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center border border-blue-200/50 dark:border-[#2B7CFF]/30">
            <FileText className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-md">
              {receipt.company.name.replace(/\s+/g, "_")}_Proposal_{receipt.client.company.replace(/\s+/g, "")}.docx
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Word OpenXML Engine • Hydrated Preview • 2 Pages
            </div>
          </div>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-muted/60 border border-border/60 p-0.5 text-xs">
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="px-2 text-[11px] font-mono font-semibold text-foreground"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="size-8 rounded-xl border border-border/80 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shadow-2xs transition-colors"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Preview"}
            aria-label={isFullScreen ? "Exit Fullscreen" : "Fullscreen Preview"}
          >
            {isFullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          <Button variant="outline" size="sm" onClick={onDownload} className="h-8 px-3 text-xs font-semibold rounded-xl">
            <Download className="size-3.5 mr-1.5" />
            <span>Download</span>
          </Button>

          <Button
            onClick={onSendEmail}
            size="sm"
            className="h-8 px-4 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs"
          >
            <Send className="size-3.5 mr-1.5" />
            <span>Send</span>
          </Button>
        </div>
      </div>

      {/* A4 Paper Document Canvas */}
      <div className="flex-1 overflow-x-auto p-2 sm:p-6 bg-slate-200/60 dark:bg-[#030a21] rounded-2xl border border-border/80 flex justify-center shadow-inner">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          className="w-full max-w-3xl bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-14 space-y-8 font-sans transition-transform duration-150 border border-slate-300 select-text"
        >
          {/* Document Header / Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded bg-[#0B1957] text-white flex items-center justify-center font-black text-sm">
                  {receipt.company.name.charAt(0)}
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {receipt.company.name}
                </h1>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                {receipt.company.location} • {receipt.company.email || "proposals@agency.com"}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Official Proposal
              </span>
              <div className="text-xs font-mono font-bold text-slate-900 mt-1.5">
                Ref: {receipt.proposal_id}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Date: {receipt.date_issued}
              </div>
            </div>
          </div>

          {/* Client & Metadata Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Prepared For
              </span>
              <div className="font-bold text-slate-900 text-sm">{receipt.client.name}</div>
              <div className="font-semibold text-slate-700">{receipt.client.company}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">{receipt.client.location}</div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Agreement Terms
              </span>
              <div className="text-slate-800">
                <strong className="text-slate-900">Term:</strong> {receipt.deal_summary.payment_terms}
              </div>
              <div className="text-slate-800">
                <strong className="text-slate-900">Validity:</strong> Until {receipt.valid_until} (14 Days)
              </div>
              <div className="text-emerald-700 font-medium text-[11px] mt-0.5 flex items-center gap-1">
                <ShieldCheck className="size-3" /> Price Lock Guaranteed
              </div>
            </div>
          </div>

          {/* Executive Overview */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
              1. Executive Overview &amp; Strategy
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed">
              {simulation.tailored_sales_copy.executive_overview}
            </p>
          </div>

          {/* Scope of Deliverables */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
              2. Scope of Work &amp; Key Deliverables
            </h2>
            <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap">
              {simulation.tailored_sales_copy.deliverables_scope}
            </div>
          </div>

          {/* Itemized Investment Schedule Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
              3. Commercial Investment &amp; Fee Schedule
            </h2>

            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                  <th className="text-left p-2.5">Item Description</th>
                  <th className="text-right p-2.5 w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {receipt.line_items.map((item) => (
                  <tr key={item.id} className={item.isDiscount ? "bg-emerald-50/50" : ""}>
                    <td className="p-2.5">
                      <span className={`font-semibold ${item.isDiscount ? "text-emerald-800" : "text-slate-900"}`}>
                        {item.label}
                      </span>
                      {item.rateLabel && (
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {item.rateLabel}
                        </span>
                      )}
                    </td>
                    <td
                      className={`p-2.5 text-right font-mono font-bold tabular-nums ${
                        item.isDiscount ? "text-emerald-700" : item.isTax ? "text-slate-600" : "text-slate-900"
                      }`}
                    >
                      {item.amount < 0 ? `−$${Math.abs(item.amount).toLocaleString()}` : `$${item.amount.toLocaleString()}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Summary Strip */}
            <div className="flex justify-end pt-2">
              <div className="w-64 p-3 rounded bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                  Total Investment:
                </span>
                <span className="text-base font-bold font-mono text-white">
                  {receipt.financials.formatted_grand_total}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Milestones (If Applicable) */}
          {receipt.payment_milestones && receipt.payment_milestones.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                4. Payment Milestone Schedule (50/50 Split)
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {receipt.payment_milestones.map((m, idx) => (
                  <div key={idx} className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">{m.milestone_name}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{m.trigger_description}</div>
                    <div className="text-sm font-bold font-mono text-[#0B1957] mt-1">
                      ${m.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formal Sign-off Section */}
          <div className="pt-6 border-t-2 border-slate-900 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              5. Acceptance of Proposal &amp; Authorization
            </h2>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              By signing below, both parties agree to the terms, pricing schedule, and scope described in this agreement. Work will commence upon receipt of authorized signature.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="space-y-2">
                <div className="border-b border-slate-400 h-10 flex items-end pb-1 font-serif italic text-slate-800 text-sm">
                  {receipt.client.name}
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-600">
                  Authorized Client Signature ({receipt.client.company})
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Date: _______________</div>
              </div>

              <div className="space-y-2">
                <div className="border-b border-slate-400 h-10 flex items-end pb-1 font-serif italic text-slate-800 text-sm">
                  Managing Principal
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-600">
                  {receipt.company.name} Representative
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Date: {receipt.date_issued}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
