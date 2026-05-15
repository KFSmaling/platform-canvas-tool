/**
 * DossierAiButton — gedeelde AI-extract-knop per sub-tab (11.M.1 block-1).
 *
 * Props:
 *  - onClick(): async
 *  - busy: boolean (loading-state)
 *  - hasUploads, hasIndexedChunks, uploadsProcessing: affordance-status
 *  - label: knop-tekst
 *  - testIdSuffix: voor data-testid="dossier-ai-{suffix}"
 */

import React from "react";
import { Sparkles, Loader2 } from "lucide-react";

export default function DossierAiButton({
  onClick, busy = false,
  hasUploads = false, hasIndexedChunks = false, uploadsProcessing = false,
  label = "Genereer vanuit dossier",
  testIdSuffix = "extract",
}) {
  const disabled = !hasIndexedChunks || uploadsProcessing || busy;
  const tooltip = !hasUploads
    ? "Upload eerst documenten"
    : uploadsProcessing
      ? "Documenten worden nog verwerkt"
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={`dossier-ai-${testIdSuffix}`}
      title={tooltip || undefined}
      className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
        disabled
          ? "text-slate-400 cursor-not-allowed opacity-60"
          : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
      }`}
    >
      {busy ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
      {label}
    </button>
  );
}
