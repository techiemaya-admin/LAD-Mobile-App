import React from "react";
import { ChevronRight } from "lucide-react";

interface StepItem {
  number: number;
  title: string;
  subtitle: string;
}

const STEPS: StepItem[] = [
  {
    number: 1,
    title: "Briefing",
    subtitle: "Capture quotation request",
  },
  {
    number: 2,
    title: "Variable Ledger",
    subtitle: "Discover and review dynamic values",
  },
  {
    number: 3,
    title: "Template Check",
    subtitle: "Validate proposal template tags",
  },
  {
    number: 4,
    title: "Pricing Engine",
    subtitle: "Apply pricing rules and calculations",
  },
  {
    number: 5,
    title: "Proposal & Receipt",
    subtitle: "Generate final proposal and receipt",
  },
];

export const HowItWorksCard: React.FC = () => {
  return (
    <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs">
      <h2 className="text-sm font-bold text-foreground mb-4 tracking-tight">
        How Auto Proposal Works
      </h2>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 overflow-x-auto pb-1">
        {STEPS.map((step, index) => {
          const isLast = index === STEPS.length - 1;

          return (
            <React.Fragment key={step.number}>
              <div className="flex items-center gap-3 min-w-[190px] flex-1">
                {/* Number Circle */}
                <div className="size-8 rounded-full bg-blue-50 dark:bg-[#000724] text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200/80 dark:border-[#2B7CFF]/40 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {step.number}
                </div>

                {/* Text Labels */}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground leading-tight">
                    {step.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                    {step.subtitle}
                  </div>
                </div>
              </div>

              {!isLast && (
                <ChevronRight className="size-4 text-muted-foreground/30 shrink-0 hidden lg:block" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

