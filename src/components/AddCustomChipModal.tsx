import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { VariableCategory } from "../types/variable";

interface AddCustomChipModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdown?: string | null;
  onAdd: (payload: {
    natural_name: string;
    category: VariableCategory;
    exact_quotation_snippet: string;
    context_anchor?: string;
  }) => Promise<void>;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

export const AddCustomChipModal: React.FC<AddCustomChipModalProps> = ({
  isOpen,
  onClose,
  markdown,
  onAdd,
}) => {
  const [naturalName, setNaturalName] = useState("");
  const [category, setCategory] = useState<VariableCategory>("customer_input");
  const [snippet, setSnippet] = useState("");
  const [contextAnchor, setContextAnchor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const normalizedMarkdown = markdown ? normalizeWhitespace(markdown) : "";
  const normalizedSnippet = normalizeWhitespace(snippet);

  const isSnippetValid =
    normalizedSnippet.length > 0 &&
    Boolean(normalizedMarkdown && normalizedMarkdown.includes(normalizedSnippet));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalName.trim()) {
      setError("Natural name is required.");
      return;
    }
    if (!snippet.trim()) {
      setError("Exact quotation snippet is required.");
      return;
    }
    if (normalizedMarkdown && !isSnippetValid) {
      setError("Snippet not found in quotation. Please copy exact text from the document.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd({
        natural_name: naturalName.trim(),
        category,
        exact_quotation_snippet: snippet.trim(),
        context_anchor: contextAnchor.trim() || undefined,
      });
      onClose();
      // Reset form
      setNaturalName("");
      setSnippet("");
      setContextAnchor("");
      setCategory("customer_input");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add custom variable");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Add Custom Variable
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bind a custom placeholder to verbatim text in the quotation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground size-7 rounded-md flex items-center justify-center hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Natural Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Natural Variable Name
            </label>
            <Input
              value={naturalName}
              onChange={(e) => setNaturalName(e.target.value)}
              placeholder="e.g. Client Point of Contact"
              className="h-8 text-xs bg-muted/40 border-border/60"
              autoFocus
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Category</label>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "customer_input", label: "Customer Input" },
                  { id: "pricing", label: "Pricing" },
                  { id: "paragraph", label: "Paragraph" },
                ] as const
              ).map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exact Quotation Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Exact Quotation Snippet
              </label>
              {snippet && (
                <span
                  className={`text-[11px] flex items-center gap-1 ${
                    isSnippetValid ? "text-emerald-500" : "text-amber-500"
                  }`}
                >
                  {isSnippetValid ? (
                    <>
                      <CheckCircle2 className="size-3" />
                      <span>Verified in quotation</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3" />
                      <span>Text not matched in document</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <Input
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
              placeholder="Paste exact verbatim text from the quote (e.g. John Doe)"
              className="h-8 text-xs font-mono bg-muted/40 border-border/60"
            />
          </div>

          {/* Context Anchor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Context Anchor <span className="text-muted-foreground font-normal">(Optional surrounding text)</span>
            </label>
            <Input
              value={contextAnchor}
              onChange={(e) => setContextAnchor(e.target.value)}
              placeholder="e.g. Attn: John Doe, Operations"
              className="h-8 text-xs font-mono bg-muted/40 border-border/60"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !naturalName.trim() || !snippet.trim() || (Boolean(normalizedMarkdown) && !isSnippetValid)}
              className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs btn-tactile"
            >
              <Plus className="size-3.5 mr-1" />
              {isSubmitting ? "Adding..." : "Add Variable"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomChipModal;
