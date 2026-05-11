/**
 * CollapseSection — generieke collapse-component voor "Gemarkeerd" en
 * "Verwijderd"-secties in AnalyseView (Stap 11.G.3 F8).
 *
 * Toont compactere kaarten dan SuggestionCard (geen actie-knoppen behalve
 * de un-mark / restore-knop). Gebruikt PATTERN_TYPE_STYLES voor consistente
 * type-badge-kleuren.
 *
 * Props:
 *   - title: string (bv. "Gemarkeerd voor verbeterrichtingen (3)")
 *   - items: array van suggestion-objects
 *   - emptyMessage: string als items leeg
 *   - actionLabel: string voor de un-mark / restore-knop
 *   - onAction(suggestion): handler aangeroepen bij klik op actie-knop
 *   - testIdPrefix: voor RTL-coverage (bv. "marked" of "deleted")
 *   - busyId: id van suggestion die momenteel een action uitvoert (knop disabled)
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import {
  getStyle,
  getPatternTypeLabelKey,
  getPatternTypeLabelFallback,
} from "./patternTypeStyles";

export default function CollapseSection({
  title,
  items = [],
  emptyMessage,
  actionLabel,
  onAction,
  testIdPrefix = "collapse",
  busyId = null,
  // Stap 11.H: optionele tweede actie (bv. "Promote naar verbeterrichting"
  // op gemarkeerde patterns). Wanneer set, rendert naast primary action.
  secondaryActionLabel = null,
  onSecondaryAction = null,
}) {
  const { label: appLabel } = useAppConfig();
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <div
      className="border border-slate-200 rounded-md bg-white mb-3"
      data-testid={`${testIdPrefix}-section`}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        data-testid={`${testIdPrefix}-toggle`}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        {open
          ? <ChevronDown size={14} className="text-slate-500" />
          : <ChevronRight size={14} className="text-slate-500" />}
        <span className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">
          {title}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          {count === 0 ? (
            <p className="text-[11px] text-slate-400 italic">{emptyMessage}</p>
          ) : (
            items.map(s => {
              const style = getStyle(s.pattern_type);
              const typeLabel = appLabel(
                getPatternTypeLabelKey(s.pattern_type),
                getPatternTypeLabelFallback(s.pattern_type),
              );
              return (
                <div
                  key={s.id}
                  data-testid={`${testIdPrefix}-card-${s.id}`}
                  className="rounded-md p-3 border border-slate-200 border-l-[3px] flex items-start justify-between gap-3"
                  style={{ background: style.bg, borderLeftColor: style.border }}
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                      style={{ color: style.label }}
                    >
                      <span aria-hidden="true">{style.icon}</span> {typeLabel}
                    </span>
                    <p
                      className="text-[12px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: style.text }}
                    >
                      {s.text_md}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-stretch gap-1">
                    {secondaryActionLabel && onSecondaryAction && (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => onSecondaryAction(s)}
                        data-testid={`${testIdPrefix}-actie-promote-${s.id}`}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {secondaryActionLabel}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => onAction(s)}
                      data-testid={`${testIdPrefix}-actie-${s.id}`}
                      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLabel}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
