/**
 * AiResultDraft — inline AI-suggestie met Accepteer/Verfijn/Wuif weg.
 *
 * 11.U Block 2b — RFC-007-rev2 Variant D.
 *
 * Renders binnen PijnpuntFocusCard wanneer `aiDraftFor.painPointId === painPoint.id`.
 * draftIntent is een al-opgeslagen concept-intent (cd_improvement_intents) van
 * de AI-call uit Block 2a generatePatternSuggestions. Tracking van edit-state:
 * vergelijk huidige textarea-waarde met `original_ai_text_md` bij Accepteer.
 *
 * Acties:
 *   Accepteer → updateIntent (bij edit) + createIntentPainPointLink
 *   Verfijn   → onVerfijn (parent regenerate, delete current draft)
 *   Wuif weg  → onWuifWeg (parent delete current draft)
 */

import React, { useState, useEffect } from "react";
import { Check, RefreshCw, X, Loader2 } from "lucide-react";

const TITLE_MAX = 100;
const INTENT_MAX = 2000;

export default function AiResultDraft({
  draftIntent,
  onAccepteer,
  onVerfijn,
  onWuifWeg,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);

  const [title, setTitle]       = useState(draftIntent?.title || "");
  const [intentMd, setIntentMd] = useState(draftIntent?.intent_md || "");
  const [busy, setBusy]         = useState(null); // 'accept' | 'verfijn' | 'wuif' | null

  // Reset state wanneer een ander draft-intent komt (bv. na Verfijn)
  useEffect(() => {
    setTitle(draftIntent?.title || "");
    setIntentMd(draftIntent?.intent_md || "");
    setBusy(null);
  }, [draftIntent?.id]);

  if (!draftIntent) return null;

  const isEdited =
    title !== draftIntent.title ||
    intentMd !== (draftIntent.intent_md || draftIntent.original_ai_text_md || "");
  const isUserEdited = (draftIntent.original_ai_text_md != null) &&
    intentMd.trim() !== draftIntent.original_ai_text_md.trim();

  const lensFromSource = (draftIntent.source_type || "").replace(/^ai_/, "");
  const draftTitelLabel = lbl("klanten.verbeteracties.ai_draft.titel", "AI-suggestie ({lens})")
    .replace("{lens}", capitalize(lensFromSource) || "AI");

  async function handleAccept() {
    if (busy) return;
    setBusy("accept");
    const r = await onAccepteer({
      title: title.trim().slice(0, TITLE_MAX),
      intentMd: intentMd.trim().slice(0, INTENT_MAX),
      isUserEdited,
      isEdited,
    });
    setBusy(null);
    return r;
  }
  async function handleVerfijn() {
    if (busy) return;
    setBusy("verfijn");
    await onVerfijn();
    setBusy(null);
  }
  async function handleWuif() {
    if (busy) return;
    setBusy("wuif");
    await onWuifWeg();
    setBusy(null);
  }

  return (
    <div
      className="border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 rounded-lg p-4 space-y-3"
      data-testid="doorloop-ai-result-draft"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
          {draftTitelLabel}
        </h4>
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
            {lbl("klanten.verbeteracties.ai_draft.titel_veld", "Titel")}
          </span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            data-testid="doorloop-ai-draft-title"
            disabled={!!busy}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
            {lbl("klanten.verbeteracties.ai_draft.intent_veld", "Tekst")}
          </span>
          <textarea
            rows={5}
            value={intentMd}
            onChange={e => setIntentMd(e.target.value)}
            maxLength={INTENT_MAX}
            data-testid="doorloop-ai-draft-intent-md"
            disabled={!!busy}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)] resize-y"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={handleWuif}
          disabled={!!busy}
          data-testid="doorloop-ai-wuif"
          className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-500 px-3 py-2 rounded disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy === "wuif" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          {lbl("klanten.verbeteracties.ai_draft.wuif_weg", "Wuif weg")}
        </button>
        <button
          type="button"
          onClick={handleVerfijn}
          disabled={!!busy}
          data-testid="doorloop-ai-verfijn"
          className="text-xs font-bold uppercase tracking-widest text-slate-700 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-2 rounded disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy === "verfijn" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {lbl("klanten.verbeteracties.ai_draft.verfijn", "Verfijn")}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={!!busy}
          data-testid="doorloop-ai-accepteer"
          className="text-xs font-bold uppercase tracking-widest text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] px-3 py-2 rounded disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy === "accept" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {lbl("klanten.verbeteracties.ai_draft.accepteer", "Accepteer als concept")}
        </button>
      </div>
    </div>
  );
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
