import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Download,
  ChevronRight,
  RefreshCw,
  X,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { renderAsync } from "docx-preview";
import { Button } from "./ui/button";
import type { TemplateStats } from "../types/template";
import { fetchTemplateBlob, getTemplateDownloadUrl } from "../services/api";

interface TemplateCheckpointCardProps {
  companyId: string;
  companyName: string;
  stats: TemplateStats;
  filesize?: number | null;
  /** Natural names keyed by variable_name / loop_tag, so warnings read like the chips do. */
  naturalNames?: Record<string, string>;
  onProceedToPricing?: () => void;
  onRegenerate?: () => void;
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

export const TemplateCheckpointCard: React.FC<TemplateCheckpointCardProps> = ({
  companyId,
  companyName,
  stats,
  filesize,
  naturalNames = {},
  onProceedToPricing,
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

  // One fetch feeds both the thumbnail and the full preview; `stats` is a new object per generate
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
        if (!ignore) setBlobError(err instanceof Error ? err.message : "Couldn't load the template");
      });
    return () => {
      ignore = true;
    };
  }, [companyId, stats]);

  const renderInto = (el: HTMLDivElement | null, onDone?: () => void) => {
    if (!blob || !el) return;
    el.innerHTML = "";
    renderAsync(blob, el, undefined, { inWrapper: false, ignoreWidth: false, ignoreHeight: false })
      .then(() => onDone?.())
      .catch((err) =>
        setRenderError(err instanceof Error ? err.message : "Couldn't draw the preview")
      );
  };

  useEffect(() => {
    renderInto(thumbRef.current, () => setThumbReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  useEffect(() => {
    if (isPreviewOpen) renderInto(modalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewOpen, blob]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsPreviewOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen]);

  const downloadUrl = getTemplateDownloadUrl(companyId);
  // The engine never drops a variable silently: a miss arrives here as applied:false. A context_text skip
  // ("2 other occurrences skipped") is the disambiguation working as intended, not a miss.
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

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-foreground">Template ready</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{summary}.</p>
            </div>
          </div>

          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
              title="Build the template again from the current variables"
            >
              <RefreshCw className={`size-3 mr-1.5 ${isRegenerating ? "animate-spin" : ""}`} />
              <span>Regenerate</span>
            </Button>
          )}
        </div>

        {/* Thumbnail of the real document: the proof it worked */}
        <button
          type="button"
          onClick={() => blob && setIsPreviewOpen(true)}
          disabled={!blob}
          className="group relative block w-full h-56 rounded-xl border border-border/60 bg-zinc-100 dark:bg-zinc-900 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default"
          aria-label="Open template preview"
        >
          {blobError || renderError ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
              {blobError || renderError}. Download it to check.
            </div>
          ) : (
            <>
              {!thumbReady && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="size-3.5 animate-spin text-primary" />
                  <span>Drawing your template</span>
                </div>
              )}
              <div className="absolute inset-x-0 top-0 flex justify-center pt-4">
                <div
                  ref={thumbRef}
                  className={`bg-white text-zinc-900 shadow-md w-[816px] max-w-none origin-top scale-[0.62] sm:scale-[0.72] transition-opacity duration-300 ${
                    thumbReady ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>

              <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-zinc-100 dark:from-zinc-900 to-transparent pointer-events-none" />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-card/90 border border-border/60 rounded-md px-2 py-1 shadow-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <Maximize2 className="size-3" />
                Open preview
              </span>
            </>
          )}
        </button>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>
                {plural(warnings.length, "field didn't", "fields didn't")} land. Tap one to check its
                wording, then regenerate.
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {warnings.map((d) => (
                <button
                  key={d.target}
                  type="button"
                  onClick={() => onFixVariable?.(d.target)}
                  title={d.info}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-amber-500/40 bg-card text-foreground hover:border-amber-500 transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {naturalNames[d.target] || d.target}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href={downloadUrl} download="template.docx" className="inline-flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 btn-tactile"
              >
                <Download className="size-3.5 mr-1.5" />
                <span>Download .docx</span>
              </Button>
            </a>
            {filesize ? (
              <span className="text-[11px] text-muted-foreground/70">{formatBytes(filesize)}</span>
            ) : null}
          </div>

          <Button
            onClick={onProceedToPricing}
            size="sm"
            className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
          >
            <span>Set up pricing</span>
            <ChevronRight className="size-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
          <div
            className="bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20 shrink-0">
              <div>
                <h4 className="font-semibold text-xs tracking-tight">Template preview</h4>
                <p className="text-[11px] text-muted-foreground">
                  {companyName}. Curly tags mark what changes per client.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <a href={downloadUrl} download="template.docx">
                  <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
                    <Download className="size-3 mr-1" />
                    Download
                  </Button>
                </a>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-8 bg-zinc-200/50 dark:bg-zinc-950/60 flex justify-center">
              {renderError ? (
                <div className="p-6 text-center max-w-md my-auto text-xs text-muted-foreground">{renderError}</div>
              ) : (
                <div
                  ref={modalRef}
                  className="bg-white text-zinc-900 rounded-lg shadow-md p-6 sm:p-10 max-w-2xl w-full min-h-125 overflow-x-auto text-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
