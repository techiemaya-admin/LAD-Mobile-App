import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Send,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Company } from "../types/company";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PromptDocCapsuleProps {
  company: Company;
  isSubmitting?: boolean;
  onSubmit: (prompt: string, file: File | null) => Promise<void>;
  onUnlock: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const PromptDocCapsule: React.FC<PromptDocCapsuleProps> = ({
  company,
  isSubmitting = false,
  onSubmit,
  onUnlock,
}) => {
  const [promptText, setPromptText] = useState(company.pricing_spec || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLockedExpanded, setIsLockedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if pricing_spec changes on reset or company switch
  const [prevSpec, setPrevSpec] = useState(company.pricing_spec);
  if (company.pricing_spec !== prevSpec) {
    setPrevSpec(company.pricing_spec);
    setPromptText(company.pricing_spec || "");
  }

  // Auto-resize textarea height to fit content, allowing scroll if it exceeds max-height
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [promptText]);

  const isLocked = Boolean(company.briefing_locked);
  const hasExistingDoc = Boolean(company.document_metadata?.filename);
  const hasDocument = Boolean(selectedFile) || hasExistingDoc;
  const isPromptValid = promptText.trim().length > 0;
  const canSubmit = isPromptValid && hasDocument && !isSubmitting;

  // Realistic placeholders matching the company's domain
  const getPlaceholder = () => {
    if (company.company_id === "co1_seo") {
      return "Describe your tiers, packages, and taxes (e.g. Local is $1,000/mo, Growth is $3,000/mo up to 3 locations, Authority is $8,000/mo. Annual prepay gets 10% off. Texas sales tax 8.25%)...";
    } else if (company.company_id === "co2_msp") {
      return "Describe your seat tiers, volume discounts, and device addons (e.g. Essential $45/seat, Standard $65/seat, Premium $85/seat. 25-49 seats gets $5/seat volume discount. Extra servers $12/mo. Ohio tax 6% on recurring only)...";
    } else if (company.company_id === "co3_dev") {
      return "Describe your project scope, add-on menu, and payment milestones (e.g. E-Commerce Build base is $9,500. Copywriting is $600, Basic SEO is $450. Selecting 2+ add-ons gets 10% off add-ons. 50% deposit on signing, 50% on delivery)...";
    }
    return "Describe your pricing model, tiers, volume rules, add-ons, and taxes in natural language...";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a Microsoft Word document (.docx)");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".docx")) {
        setSelectedFile(file);
      } else {
        alert("Please upload a Microsoft Word document (.docx)");
      }
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(promptText.trim(), selectedFile);
  };

  const handleConfirmUnlock = async () => {
    setIsResetting(true);
    try {
      await onUnlock();
      setShowResetModal(false);
    } finally {
      setIsResetting(false);
    }
  };

  // LOCKED STATE: Elevated read-only summary card
  if (isLocked) {
    const docMeta = company.document_metadata;
    return (
      <Card className="border-border/80 shadow-xs transition-all duration-200 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  Pricing Briefing
                </CardTitle>
                <Badge variant="success" className="text-[11px] font-medium">
                  Active
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="text-xs h-7 self-start sm:self-auto gap-1.5 text-muted-foreground hover:text-foreground btn-tactile"
            >
              <Edit3 className="size-3" />
              <span>Edit / Reset</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-3 space-y-3">
          {/* Document Status Chip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 text-xs font-mono text-foreground select-none border border-border/40">
              <FileText className="size-3.5 text-primary shrink-0" />
              <span className="font-medium truncate max-w-65 sm:max-w-md">
                {docMeta?.filename || "original_quotation.docx"}
              </span>
              {/* {docMeta?.filesize ? (
                <span className="text-muted-foreground text-[11px]">
                  ({formatBytes(docMeta.filesize)})
                </span>
              ) : null} */}
              <span className="size-1 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                Parsed
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsLockedExpanded(!isLockedExpanded)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto transition-colors"
            >
              <span>{isLockedExpanded ? "Collapse Notes" : "View Full Notes"}</span>
              {isLockedExpanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          </div>

          {/* Pricing Spec Content */}
          <div className="rounded-xl bg-muted/30 p-3 border border-border/30">
            <p
              className={`text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap ${
                isLockedExpanded ? "" : "line-clamp-3"
              }`}
            >
              {promptText}
            </p>
          </div>
        </CardContent>

        {/* Hard Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Reset Downstream Pipeline?
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Editing your pricing prompt or quotation will re-extract variables and regenerate downstream templates and pricing rules. Your current text will be preserved in the prompt box.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmUnlock}
                  disabled={isResetting}
                  className="text-xs h-8 btn-tactile"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="size-3 mr-1.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Unlock & Reset"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // EDITABLE STATE: Matching Wireframe 2 with slid-down connected tray feel
  return (
    <div className="space-y-0">
      {/* Heading like before */}
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Pricing Briefing
        </h3>
      </div>

      {/* 1. Prompt Box: Fully rounded, elevated white card, no divider line */}
      <div className="relative z-10 rounded-2xl bg-card border border-border/80 shadow-xs p-4 sm:p-5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/40">
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={(e) => {
            setPromptText(e.target.value);
            adjustTextareaHeight();
          }}
          disabled={isSubmitting}
          placeholder={getPlaceholder()}
          className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:ring-0 p-1 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 resize-none overflow-y-auto block max-h-72"
          style={{ minHeight: "100px" }}
        />

        {/* Seamless bottom-right action container: NO divider, NO character count */}
        <div className="flex justify-end items-center pt-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`h-8 px-4 text-xs font-medium rounded-lg gap-1.5 btn-tactile transition-all duration-150 ${
              canSubmit
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-xs active:scale-[0.98]"
                : "bg-blue-600/40 text-white/60 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <Send className="size-3" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Drag & Drop Box: Slid down, moved up to connect under the prompt, same drop shadow, narrower width */}
      <div className="mx-auto relative z-0 -mt-3.5">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-b-2xl rounded-t-none pt-7.5 pb-3.5 sm:pb-4 px-4 cursor-pointer transition-all duration-150 border border-dashed select-none text-center shadow-xs ${
            isDragging
              ? "bg-blue-500/15 border-blue-500"
              : selectedFile || hasExistingDoc
              ? "bg-zinc-200/70 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800"
              : "bg-zinc-200/50 hover:bg-zinc-200/75 dark:bg-zinc-900/70 dark:hover:bg-zinc-900 border-zinc-300/80 dark:border-zinc-800 hover:border-blue-500/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            /* Attached File Badge */
            <div className="flex items-center justify-between gap-3 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(selectedFile.size)} • Attached quotation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearFile}
                className="size-7 rounded-md hover:bg-zinc-300/70 dark:hover:bg-zinc-800 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                title="Remove attached file"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : hasExistingDoc ? (
            /* Previously Uploaded File Badge */
            <div className="flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {company.document_metadata?.filename}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Attached quotation • Click to replace (.docx)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Idle Dropzone Call to Action: [+] and original text */
            <div className="flex flex-col items-center justify-center space-y-1 py-1">
              <div className="size-6 rounded-md border border-zinc-400/50 dark:border-zinc-700 flex items-center justify-center text-muted-foreground bg-background/80 shadow-2xs">
                <Plus className="size-3.5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Drop your sample quotation here (.docx)
              </p>
              <p className="text-[11px] text-muted-foreground">
                or click to browse from your device
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptDocCapsule;
