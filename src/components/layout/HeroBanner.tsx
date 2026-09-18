import React from "react";
import { FileText, Plus } from "lucide-react";

interface HeroBannerProps {
  onCreateProposal?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onCreateProposal }) => {
  return (
    <div className="bg-[#0B1957] dark:bg-[#1A2A43] text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-blue-900/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0 shadow-inner">
            <FileText className="size-6 text-blue-200" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Auto Proposal
            </h1>
            <p className="text-xs text-blue-200/80 mt-1 leading-relaxed max-w-xl">
              Generate accurate, branded proposals from customer briefs and pricing inputs.
            </p>
          </div>
        </div>

        {/* Right Side: Status Badge & CTA Button */}
        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-medium bg-emerald-950/40 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-xs">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Pipeline Ready</span>
          </div>

          <button
            onClick={onCreateProposal}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-[#0B1957] font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all active:scale-98"
          >
            <Plus className="size-3.5" />
            <span>Create Proposal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

