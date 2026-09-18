import React from "react";
import { CheckCircle2, Download, RefreshCw, FileText, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import type { TemplateStats } from "../../types/template";

interface Stage3TemplateCheckProps {
  companyName: string;
  stats: TemplateStats;
  onProceed: () => void;
  onRegenerate: () => void;
}

export const Stage3TemplateCheck: React.FC<Stage3TemplateCheckProps> = ({
  companyName,
  stats,
  onProceed,
  onRegenerate,
}) => {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 dark:bg-card/40 p-5 space-y-5 animate-in fade-in duration-200">
      {/* Header Sub-banner */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Current Proposal / Word Document Template Checkpoint</span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                18 Placed Tags
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Validate proposal template tags and AST placements.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          <span>Regenerate</span>
        </Button>
      </div>

      {/* Document Proof Card */}
      <div className="rounded-2xl border border-border/80 bg-muted/30 dark:bg-[#14233a] p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] flex items-center justify-center border border-blue-200/50 dark:border-[#2B7CFF]/30 shadow-2xs">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                {companyName}_Template_Hydrated.docx
              </div>
              <div className="text-[11px] text-muted-foreground">
                Document size: 48.2 KB • Easy-template-x OpenXML compatible
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            ✓ AST Verified
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-card border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.tags_placed_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Placed Tags
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-card border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.loops_collapsed_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Repeating Loops
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-card border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.conditional_rows_wrapped_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Conditional Rows
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-border/50 flex items-center justify-between">
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold rounded-xl">
          <Download className="size-3.5 mr-1.5" />
          <span>Download .docx</span>
        </Button>

        <Button
          onClick={onProceed}
          size="sm"
          className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs"
        >
          <span>Configure Pricing Engine</span>
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
};
