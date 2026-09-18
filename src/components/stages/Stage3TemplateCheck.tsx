import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Download,
  RefreshCw,
  FileText,
  ChevronRight,
  Maximize2,
  X,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react";
import { renderAsync } from "docx-preview";
import { Button } from "../ui/button";
import type { TemplateStats } from "../../types/template";
import { fetchTemplateBlob, getTemplateDownloadUrl } from "../../services/api";

interface Stage3TemplateCheckProps {
  companyId: string;
  companyName: string;
  stats: TemplateStats;
  filesize?: number | null;
  naturalNames?: Record<string, string>;
  onProceed: () => void;
  onRegenerate: () => void;
  onFixVariable?: (target: string) => void;
  isRegenerating?: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const Stage3TemplateCheck: React.FC<Stage3TemplateCheckProps> = ({
  companyId,
  companyName,
  stats,
  filesize,
  naturalNames = {},
  onProceed,
  onRegenerate,
  onFixVariable,
  isRegenerating = false,
}) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobError, setBlobError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const thumbRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch hydrated template docx blob for preview
  useEffect(() => {
    let ignore = false;
    fetchTemplateBlob(companyId)
      .then((b) => {
        if (ignore) return;
        setThumbReady(false);
        setBlobError(null);
        setBlob(b);
      })
      .catch((err) => {
        if (!ignore) setBlobError(err instanceof Error ? err.message : "Couldn't load template .docx");
      });
    return () => {
      ignore = true;
    };
  }, [companyId, stats]);

  const renderInto = (el: HTMLDivElement | null, onDone?: () => void) => {
    if (!blob || !el) return;
    el.innerHTML = "";
    renderAsync(blob, el, undefined, {
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
    })
      .then(() => onDone?.())
      .catch((err) =>
        setRenderError(err instanceof Error ? err.message : "Couldn't render docx preview")
      );
  };

  useEffect(() => {
    renderInto(thumbRef.current, () => setThumbReady(true));
  }, [blob]);

  useEffect(() => {
    if (isPreviewOpen) renderInto(modalRef.current);
  }, [isPreviewOpen, blob]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsPreviewOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen]);

  const downloadUrl = getTemplateDownloadUrl(companyId);
  const warnings = (stats.details ?? []).filter((d) => !d.applied);

  const summary = [
    `${plural(stats.tags_placed_count, "field fills", "fields fill")} in per client`,
    stats.loops_collapsed_count > 0 &&
      plural(stats.loops_collapsed_count, "repeating table", "repeating tables"),
    stats.conditional_rows_wrapped_count > 0 &&
      `${plural(stats.conditional_rows_wrapped_count, "row hides", "rows hide")} when empty`,
  ]
    .filter(Boolean)
    .join(", ");

  const handleDownload = () => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName}_Template_Hydrated.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.open(downloadUrl, "_blank");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs animate-in fade-in duration-200">
        {/* Header Sub-banner */}
        <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Stage 3: Word Document Template AST Checkpoint</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {stats.tags_placed_count} Tags Placed
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary || "OpenXML AST validated and hydrated with mustache/jinja tags."}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isRegenerating ? "animate-spin" : ""}`} />
            <span>{isRegenerating ? "Generating..." : "Regenerate"}</span>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-[#14233a] border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.tags_placed_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Placed Tags
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-[#14233a] border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.loops_collapsed_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Repeating Loops
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-[#14233a] border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.conditional_rows_wrapped_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              Conditional Rows
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-[#14233a] border border-border/80 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-foreground">{stats.mutations_applied_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
              AST Mutations
            </div>
          </div>
        </div>

        {/* Live Hydrated DOCX Document Interactive Thumbnail Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-[#2B7CFF]" />
              <span>Live Generated Template Preview (.docx)</span>
            </div>
            <span className="text-[11px] font-normal text-muted-foreground">
              {filesize ? `${formatBytes(filesize)} • ` : ""}Click below to open full preview
            </span>
          </div>

          <button
            type="button"
            onClick={() => blob && setIsPreviewOpen(true)}
            disabled={!blob}
            className="group relative block w-full h-64 rounded-xl border border-border/80 bg-zinc-100 dark:bg-zinc-900 overflow-hidden text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2B7CFF]/40 cursor-pointer shadow-inner"
            aria-label="Open template full preview"
          >
            {blobError || renderError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground px-4 text-center space-y-2">
                <FileText className="size-8 text-muted-foreground/60" />
                <p>{blobError || renderError || "Template generated successfully. Download to view in Word."}</p>
              </div>
            ) : (
              <>
                {!thumbReady && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-[#2B7CFF]" />
                    <span>Rendering OpenXML document layout...</span>
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 flex justify-center pt-4 pointer-events-none">
                  <div
                    ref={thumbRef}
                    className={`bg-white text-zinc-900 shadow-md w-[816px] max-w-none origin-top scale-[0.62] sm:scale-[0.72] transition-opacity duration-300 rounded-sm overflow-hidden ${
                      thumbReady ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-100 dark:from-zinc-900 via-zinc-100/60 dark:via-zinc-900/60 to-transparent pointer-events-none" />
                
                <span className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-card/95 border border-border/80 rounded-lg px-3 py-1.5 shadow-sm group-hover:scale-105 transition-all">
                  <Maximize2 className="size-3.5 text-[#2B7CFF]" />
                  <span>Open Full Document Preview</span>
                </span>
              </>
            )}
          </button>
        </div>

        {/* Unplaced Field Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>
                {plural(warnings.length, "field was not", "fields were not")} placed. Click a variable to review its snippet context:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {warnings.map((d) => (
                <button
                  key={d.target}
                  type="button"
                  onClick={() => onFixVariable?.(d.target)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-colors"
                >
                  <span>{naturalNames[d.target] || d.target}</span>
                  <span className="text-[10px] text-amber-600/70">→ Fix</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-border/50 flex items-center justify-between">
          <Button
            onClick={handleDownload}
            variant="outline"
            size="sm"
            className="h-8 px-3.5 text-xs font-semibold rounded-xl cursor-pointer"
          >
            <Download className="size-3.5 mr-1.5" />
            <span>Download .docx Template</span>
          </Button>

          <Button
            onClick={onProceed}
            size="sm"
            className="h-8 px-5 text-xs font-semibold bg-[#0B1957] hover:bg-[#152a8a] dark:bg-[#2B7CFF] dark:hover:bg-[#2563eb] text-white dark:text-[#000724] rounded-xl shadow-xs cursor-pointer"
          >
            <span>Configure Pricing Engine</span>
            <ChevronRight className="size-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Full-Screen Document Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4.5 text-[#2B7CFF]" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {companyName}_Template_Hydrated.docx
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Word OpenXML generated template with dynamic tags
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                >
                  <Download className="size-3 mr-1" />
                  <span>Download</span>
                </Button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center hover:bg-muted cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Document Pages Viewport */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-200 dark:bg-zinc-950 flex justify-center">
              <div
                ref={modalRef}
                className="bg-white text-zinc-900 shadow-xl rounded-sm max-w-[816px] w-full p-2 sm:p-4 [&_.docx]:shadow-none"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
