import React from "react";
import { Sparkles, Calculator, CheckCircle2, Cpu } from "lucide-react";

interface PipelineKpiBannerProps {
  modelName?: string;
  benchmarkTotal?: string;
  tagPlacementCount?: number;
  totalTags?: number;
}

export const PipelineKpiBanner: React.FC<PipelineKpiBannerProps> = ({
  modelName = "Gemini 2.5 Flash",
  benchmarkTotal = "$35,073.00",
  tagPlacementCount = 18,
  totalTags = 18,
}) => {
  return (
    <div className="bg-gradient-to-br from-[#0B1957] via-[#102a71] to-[#1e3a8a] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-blue-900/40">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-white/10 flex items-center justify-center">
            <Calculator className="size-3.5 text-blue-300" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
            Auto-Proposal Pipeline Status
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Zero-Config Verified</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
            <Cpu className="size-3.5 opacity-80" />
            <span>AI Extraction Engine</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 tracking-tight flex items-center gap-2">
            <span>{modelName}</span>
          </div>
          <p className="text-[11px] text-blue-200/70 mt-0.5">Automated document parsing</p>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6">
          <div className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
            <Calculator className="size-3.5 opacity-80" />
            <span>Quotation Benchmark</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 font-mono tracking-tight text-white">
            {benchmarkTotal}
          </div>
          <p className="text-[11px] text-emerald-300 font-medium mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            100% Deterministic match
          </p>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6">
          <div className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
            <Sparkles className="size-3.5 opacity-80" />
            <span>Template Health</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">
            {tagPlacementCount} of {totalTags} Tags Placed
          </div>
          <p className="text-[11px] text-blue-200/70 mt-0.5">0 AST mutation misses</p>
        </div>
      </div>
    </div>
  );
};

