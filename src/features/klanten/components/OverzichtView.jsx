/**
 * OverzichtView — matrix-tabel voor Overzicht-modus van fase 3.
 *
 * 11.U Block 3b — RFC-007-rev2 §B + wireframe-doc regel 145-149.
 *
 * Layout:
 *   Matrix-tabel met 5 kolommen: # / Pijnpunt + dim / Status / Gekoppelde acties / Actie
 *   Klik op rij → inline-expansion in amber-tint panel met dezelfde ChoiceCards
 *   (delegeert naar parent-handlers).
 *   "Doorloop →"-knop op open-rijen → spring naar focus-modus.
 *
 * Vervangt de oude S4 RFC-007 C1 concept/definitief-list-render.
 */

import React, { useState, Fragment } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Circle, CheckCircle2, Slash } from "lucide-react";
import ChoiceCards from "./ChoiceCards";
import SuggestedLensHint from "./SuggestedLensHint";
import { suggestLens } from "./lensSuggestion";

const STATUS_BADGE = {
  open:      { bg: "bg-amber-100",   text: "text-amber-800",   icon: Circle,       label: "Open" },
  addressed: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2, label: "Geadresseerd" },
  dismissed: { bg: "bg-slate-100",   text: "text-slate-600",   icon: Slash,        label: "Genegeerd" },
};

export default function OverzichtView({
  painPoints = [],
  intents = [],
  links = [],
  dimensions = [],
  onDoorloopJump,
  // Choice-handlers — delegeren naar parent (zelfde als DoorloopView)
  onChooseAi,
  onChooseEigen,
  onChooseDismiss,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const [expandedRow, setExpandedRow] = useState(null);

  if (painPoints.length === 0) {
    return (
      <div
        className="px-5 py-8 bg-slate-50 border border-slate-200 rounded text-center"
        data-testid="overzicht-empty"
      >
        <p className="text-sm text-slate-700">
          {lbl(
            "klanten.verbeteracties.overzicht.empty",
            "Geen pijnpunten — gebruik fase 2 om toe te voegen",
          )}
        </p>
      </div>
    );
  }

  const dimNameById = new Map((dimensions || []).map(d => [d.id, d.name || ""]));

  return (
    <div className="overflow-x-auto" data-testid="overzicht-view">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-widest text-slate-600">
            <th className="px-3 py-2 w-10">
              {lbl("klanten.verbeteracties.overzicht.kolom.nr", "#")}
            </th>
            <th className="px-3 py-2">
              {lbl("klanten.verbeteracties.overzicht.kolom.pijnpunt", "Pijnpunt")}
            </th>
            <th className="px-3 py-2 w-32">
              {lbl("klanten.verbeteracties.overzicht.kolom.status", "Status")}
            </th>
            <th className="px-3 py-2">
              {lbl("klanten.verbeteracties.overzicht.kolom.acties", "Gekoppelde acties")}
            </th>
            <th className="px-3 py-2 w-40 text-right">
              {lbl("klanten.verbeteracties.overzicht.kolom.actie", "Actie")}
            </th>
          </tr>
        </thead>
        <tbody>
          {painPoints.map((pp, idx) => {
            const status = pp.coverage_status || "open";
            const badge = STATUS_BADGE[status] || STATUS_BADGE.open;
            const StatusIcon = badge.icon;
            const linkedIntents = (intents || []).filter(intent =>
              (links || []).some(l => l.intent_id === intent.id && l.pain_point_id === pp.id),
            );
            const isExpanded = expandedRow === pp.id;
            const canExpand = status === "open";

            return (
              <Fragment key={pp.id}>
                <tr
                  className={`border-b border-slate-100 hover:bg-slate-50 ${canExpand ? "cursor-pointer" : ""}`}
                  data-testid={`overzicht-row-${pp.id}`}
                  data-status={status}
                  onClick={() => canExpand && setExpandedRow(isExpanded ? null : pp.id)}
                >
                  <td className="px-3 py-3 text-slate-500 align-top">
                    {canExpand && (
                      isExpanded
                        ? <ChevronDown size={12} className="inline mr-1" />
                        : <ChevronRight size={12} className="inline mr-1" />
                    )}
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-sm text-slate-900 leading-snug">
                      {pp.text_md || pp.title || ""}
                    </p>
                    {pp.dimension_id && dimNameById.get(pp.dimension_id) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dimNameById.get(pp.dimension_id)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${badge.bg} ${badge.text}`}
                      data-testid={`overzicht-status-badge-${pp.id}`}
                    >
                      <StatusIcon size={10} />
                      {lbl(`klanten.verbeteracties.status.${status}`, badge.label)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {linkedIntents.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {linkedIntents.map(intent => (
                          <li key={intent.id} className="text-xs text-slate-700 truncate">
                            {intent.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                    {status === "open" ? (
                      <button
                        type="button"
                        onClick={() => onDoorloopJump?.(idx)}
                        data-testid={`overzicht-row-doorloop-${pp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] border border-[var(--color-accent)]/30 hover:border-[var(--color-accent)] px-2.5 py-1.5 rounded"
                      >
                        {lbl("klanten.verbeteracties.overzicht.actie.doorloop", "Doorloop")}
                        <ArrowRight size={11} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDoorloopJump?.(idx)}
                        data-testid={`overzicht-row-bekijken-${pp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-2.5 py-1.5 rounded"
                      >
                        {lbl("klanten.verbeteracties.overzicht.actie.bekijken", "Bekijken")}
                      </button>
                    )}
                  </td>
                </tr>
                {/* Inline-expansion (amber-tint panel) bij open-row-klik */}
                {isExpanded && canExpand && (
                  <tr data-testid={`overzicht-row-expansion-${pp.id}`}>
                    <td colSpan={5} className="px-3 py-4 bg-amber-50 border-b border-amber-200">
                      <ExpansionPanel
                        painPoint={pp}
                        intents={intents}
                        dimensions={dimensions}
                        onChooseAi={onChooseAi}
                        onChooseEigen={onChooseEigen}
                        onChooseDismiss={onChooseDismiss}
                        onDoorloopJump={() => onDoorloopJump?.(idx)}
                        appLabel={appLabel}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-component: inline-expansion-panel ─────────────────────────────────

function ExpansionPanel({
  painPoint, intents, dimensions,
  onChooseAi, onChooseEigen, onChooseDismiss,
  onDoorloopJump,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const recommendedLens = suggestLens({ painPoint, intents, dimensions });

  return (
    <div className="space-y-3">
      <ChoiceCards
        onChooseAi={() => onChooseAi?.(painPoint)}
        onChooseEigen={() => onChooseEigen?.(painPoint)}
        onChooseDismiss={() => onChooseDismiss?.(painPoint)}
        appLabel={appLabel}
      />
      {recommendedLens && (
        <SuggestedLensHint
          recommendedLens={recommendedLens}
          onClick={onDoorloopJump}
          appLabel={appLabel}
        />
      )}
      <p className="text-xs text-slate-600 italic">
        {lbl(
          "klanten.verbeteracties.overzicht.expansion.hint",
          "Voor uitgebreide AI-flow → klik 'Doorloop' rechts om volledige focus-modus te openen.",
        )}
      </p>
    </div>
  );
}
