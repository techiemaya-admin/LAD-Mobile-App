import React from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";

interface HeroBannerProps {
  companyName?: string;
  onCreateProposal?: () => void;
  onRescanPipeline?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  companyName,
  onCreateProposal,
  onRescanPipeline,
}) => {
  return (
    <div className="bg-[#0B1957] dark:bg-[#1A2A43] text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-blue-900/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0 shadow-inner">
            <FileText className="size-6 text-blue-200" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Auto Proposal
              </h1>
              {companyName && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-blue-200 border border-white/20">
                  {companyName}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/80 mt-1 leading-relaxed max-w-xl">
              Generate accurate, branded proposals from customer briefs and pricing inputs.
            </p>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0 flex-wrap">
          {onRescanPipeline && (
            <button
              onClick={onRescanPipeline}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Re-scan Pipeline</span>
            </button>
          )}

          <button
            onClick={onCreateProposal}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-[#0B1957] font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Create Proposal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
