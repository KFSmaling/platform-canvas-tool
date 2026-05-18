/**
 * PijnpuntenRail — 280px linker rail met alle pijnpunten in Doorloop-modus.
 *
 * 11.U Block 2b retro — wireframe-doc regel 137-143 + designer-spec.
 *
 * Per rij: nummer-bolletje + status-dot + pijnpunt-tekst (afgeknot) + dimensie-naam.
 * Geselecteerde rij krijgt accent-bg + border-left in kleur van coverage_status.
 * Klik op rij → onClickPainPoint(idx) → currentFocusIdx update in parent.
 */

import React from "react";

const STATUS_DOT = {
  open:      "bg-amber-500",
  addressed: "bg-emerald-500",
  dismissed: "bg-slate-400",
};

const SELECTED_BG = {
  open:      "bg-amber-50",
  addressed: "bg-emerald-50",
  dismissed: "bg-slate-100",
};

const SELECTED_BORDER = {
  open:      "border-l-amber-500",
  addressed: "border-l-emerald-500",
  dismissed: "border-l-slate-400",
};

export default function PijnpuntenRail({
  painPoints = [],
  dimensions = [],
  currentIdx,
  onClickPainPoint,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);

  if (painPoints.length === 0) {
    return (
      <div
        className="p-4 text-xs text-slate-500 italic"
        data-testid="doorloop-rail-empty"
      >
        {lbl(
          "klanten.verbeteracties.rail.empty",
          "Geen pijnpunten — gebruik fase 2 om toe te voegen",
        )}
      </div>
    );
  }

  // Dimensie-naam-lookup-helper (per render, kleine N).
  const dimNameById = new Map((dimensions || []).map(d => [d.id, d.name || ""]));

  return (
    <ul className="divide-y divide-slate-100" data-testid="doorloop-rail">
      {painPoints.map((pp, idx) => {
        const isSelected = idx === currentIdx;
        const status = pp.coverage_status || "open";
        const statusAriaLabel = lbl(
          `klanten.verbeteracties.rail.status.${status}`,
          status === "addressed" ? "Geadresseerd" :
          status === "dismissed" ? "Genegeerd" : "Open",
        );
        const baseClasses = "w-full text-left px-3 py-3 flex items-start gap-2.5 border-l-2 transition-colors";
        const selectedClasses = isSelected
          ? `${SELECTED_BG[status] || SELECTED_BG.open} ${SELECTED_BORDER[status] || SELECTED_BORDER.open}`
          : "bg-white hover:bg-slate-50 border-l-transparent";

        return (
          <li key={pp.id}>
            <button
              type="button"
              onClick={() => onClickPainPoint(idx)}
              data-testid={`doorloop-rail-row-${pp.id}`}
              data-selected={isSelected ? "true" : "false"}
              aria-current={isSelected ? "true" : undefined}
              className={`${baseClasses} ${selectedClasses}`}
            >
              {/* Nummer-bolletje */}
              <span
                aria-hidden="true"
                className="w-6 h-6 flex-shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center"
              >
                {idx + 1}
              </span>
              {/* Status-dot */}
              <span
                aria-label={statusAriaLabel}
                title={statusAriaLabel}
                data-testid={`doorloop-rail-row-status-${pp.id}`}
                className={`w-2 h-2 mt-2 flex-shrink-0 rounded-full ${STATUS_DOT[status] || STATUS_DOT.open}`}
              />
              {/* Tekst + dimensie */}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 leading-snug line-clamp-2">
                  {pp.text_md || pp.title || ""}
                </p>
                {pp.dimension_id && dimNameById.get(pp.dimension_id) && (
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {dimNameById.get(pp.dimension_id)}
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
