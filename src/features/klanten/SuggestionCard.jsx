/**
 * SuggestionCard — één card per pattern_suggestion in AnalyseView.
 *
 * Toont:
 *   - pattern-type badge in PATTERN_TYPE_STYLES-kleuren (StrategyOnePager-anker)
 *   - text_md (whitespace-pre-wrap render — geen full markdown-engine in MVP)
 *   - "vanuit"-chips (uit jsonb-array)
 *   - 4 actie-knoppen: Accept / Refine-edit / Refine-deeper / Reject
 *   - "verfijnd"-badge bij is_user_edited=true
 *   - parent-id child-indent + dunne lijn (wanneer prop hasParent=true)
 *
 * Props:
 *   - suggestion: { id, pattern_type, text_md, vanuit, is_user_edited, parent_id, current_status, ... }
 *   - hasParent: boolean (UI-laag bepaalt of indent wordt toegepast)
 *   - busy: boolean (true tijdens action-call → knoppen disabled)
 *   - onAccept(suggestion)
 *   - onRefineEdit(suggestion)
 *   - onRefineDeeper(suggestion)
 *   - onReject(suggestion)
 */

import React from "react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import {
  getStyle,
  getPatternTypeLabelKey,
  getPatternTypeLabelFallback,
} from "./patternTypeStyles";

export default function SuggestionCard({
  suggestion,
  hasParent = false,
  busy = false,
  onAccept,
  onRefineEdit,
  onRefineDeeper,
  onReject,
}) {
  const { label: appLabel } = useAppConfig();
  const style = getStyle(suggestion.pattern_type);

  const typeLabel = appLabel(
    getPatternTypeLabelKey(suggestion.pattern_type),
    getPatternTypeLabelFallback(suggestion.pattern_type),
  );

  // F5 (Stap 11.G.2): tooltip op type-badge — 1-zin-uitleg per type voor
  // consultant die in de lijst kijkt en wil weten wat het type betekent.
  const typeTooltip = appLabel(
    `klanten.analyse.helper.${suggestion.pattern_type}`,
    {
      cluster:       "Groep pijnpunten die samen wijzen op een capability- of positionering-vraagstuk",
      paradox:       "Pijnpunten die elkaar conceptueel tegenspreken",
      positionering: "Propositie of segment waar pijnpunten wijzen op een zwakke plek",
      overstijgend:  "Pijnpunten zonder specifieke koppeling die het hele werkblad raken",
      eigen:         "Consultant-eigen patroon (geen AI-bron)",
    }[suggestion.pattern_type] || ""
  );

  const vanuit = Array.isArray(suggestion.vanuit) ? suggestion.vanuit : [];

  return (
    <div
      data-testid={`suggestion-card-${suggestion.id}`}
      data-pattern-type={suggestion.pattern_type}
      className={`relative ${hasParent ? "ml-8" : ""}`}
    >
      {/* Indent-lijn naar parent */}
      {hasParent && (
        <div
          aria-hidden="true"
          className="absolute -left-4 top-0 bottom-0 w-px bg-slate-300"
        />
      )}

      <div
        className="rounded-md p-4 border border-slate-200 border-l-[3px]"
        style={{
          background: style.bg,
          borderLeftColor: style.border,
        }}
      >
        {/* Header: type-badge + verfijnd-badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm cursor-help"
            title={typeTooltip}
            style={{
              color: style.label,
              background: "rgba(255,255,255,0.6)",
            }}
          >
            <span aria-hidden="true">{style.icon}</span>
            {typeLabel}
          </span>
          {suggestion.is_user_edited && (
            <span
              data-testid={`badge-verfijnd-${suggestion.id}`}
              className="text-[10px] italic px-2 py-0.5 rounded-sm bg-white/60 text-slate-600 border border-slate-300"
            >
              {appLabel("klanten.analyse.badge.verfijnd", "verfijnd")}
            </span>
          )}
        </div>

        {/* Tekst (markdown niet full-rendered — pre-wrap is voldoende voor MVP) */}
        <p
          className="text-[12.5px] leading-relaxed whitespace-pre-wrap mb-3"
          style={{ color: style.text }}
        >
          {suggestion.text_md}
        </p>

        {/* Vanuit-chips */}
        {vanuit.length > 0 && (
          <div className="mb-3">
            <span
              className="text-[10px] font-bold uppercase tracking-widest mr-2"
              style={{ color: style.label }}
            >
              {appLabel("klanten.analyse.vanuit.label", "Vanuit:")}
            </span>
            <span className="inline-flex flex-wrap gap-1">
              {vanuit.map((v, i) => (
                <span
                  key={i}
                  className="inline-block text-[10px] px-2 py-0.5 rounded bg-white/70 text-slate-700 border border-slate-200"
                >
                  {String(v).length > 80 ? String(v).slice(0, 79) + "…" : v}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Acties */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/70">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAccept(suggestion)}
            data-testid={`actie-accept-${suggestion.id}`}
            title={appLabel("klanten.analyse.accept.tooltip.fase4", "nog te promoten in fase 4 — komt later")}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {appLabel("klanten.analyse.actie.accept", "Accept")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRefineEdit(suggestion)}
            data-testid={`actie-refine-edit-${suggestion.id}`}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.analyse.actie.refine.edit", "Verfijn — bewerken")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRefineDeeper(suggestion)}
            data-testid={`actie-refine-deeper-${suggestion.id}`}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.analyse.actie.refine.deeper", "Verfijn — graaf dieper")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(suggestion)}
            data-testid={`actie-reject-${suggestion.id}`}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors text-slate-500 hover:text-red-700 disabled:opacity-50"
          >
            {appLabel("klanten.analyse.actie.reject", "Wuif weg")}
          </button>
        </div>
      </div>
    </div>
  );
}
