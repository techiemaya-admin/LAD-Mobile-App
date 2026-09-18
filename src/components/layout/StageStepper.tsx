import React from "react";
import { Check, ChevronRight } from "lucide-react";
import type { ProposalStage } from "../../types/proposal";

interface StageStepperProps {
  currentStage: ProposalStage;
  completedStages: ProposalStage[];
  onSelectStage: (stage: ProposalStage) => void;
}

const STAGES = [
  { id: 1 as ProposalStage, label: "Briefing", statusText: "Completed" },
  { id: 2 as ProposalStage, label: "Variable Ledger", statusText: "In Progress" },
  { id: 3 as ProposalStage, label: "Template Check", statusText: "Pending" },
  { id: 4 as ProposalStage, label: "Pricing Engine", statusText: "Pending" },
  { id: 5 as ProposalStage, label: "Proposal & Receipt", statusText: "Pending" },
];

export const StageStepper: React.FC<StageStepperProps> = ({
  currentStage,
  completedStages,
  onSelectStage,
}) => {
  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
      {STAGES.map((s, index) => {
        const isActive = currentStage === s.id;
        const isCompleted = completedStages.includes(s.id);
        const isLast = index === STAGES.length - 1;

        // Determine status display text
        let statusLabel = s.statusText;
        if (isActive) {
          statusLabel = "In Progress";
        } else if (isCompleted) {
          statusLabel = "Completed";
        } else {
          statusLabel = "Pending";
        }

        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => onSelectStage(s.id)}
              className={`flex-1 min-w-[170px] py-2.5 px-3.5 rounded-2xl flex items-center gap-3 transition-all select-none text-left border ${
                isActive
                  ? "bg-[#0B1957] dark:bg-[#1A2A43] dark:border-[#2B7CFF]/60 text-white shadow-xs font-semibold ring-1 ring-[#2B7CFF]/40"
                  : isCompleted
                  ? "bg-slate-50 dark:bg-[#14233a] border-border/80 text-foreground hover:bg-slate-100 dark:hover:bg-[#1A2A43]"
                  : "bg-muted/30 dark:bg-[#101c30]/50 border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {/* Left Circle Number or Checkmark */}
              <div
                className={`size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isActive
                    ? "bg-blue-600 dark:bg-[#2B7CFF] text-white shadow-2xs"
                    : isCompleted
                    ? "bg-emerald-500 text-white shadow-2xs"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted && !isActive ? <Check className="size-3.5 stroke-[3]" /> : s.id}
              </div>

              {/* Labels */}
              <div className="min-w-0">
                <div className={`text-xs font-bold leading-tight truncate ${isActive ? "text-white" : "text-foreground"}`}>
                  {s.label}
                </div>
                <div
                  className={`text-[11px] leading-tight truncate mt-0.5 font-medium ${
                    isActive
                      ? "text-blue-200 dark:text-[#2B7CFF]"
                      : isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {statusLabel}
                </div>
              </div>
            </button>

            {!isLast && (
              <ChevronRight className="size-4 text-muted-foreground/30 shrink-0 hidden md:block" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
