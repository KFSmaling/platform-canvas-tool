/**
 * DoorloopView — focus-doorloop voor verbeteracties (Variant D).
 *
 * 11.U Block 2b — RFC-007-rev2 §B.
 *
 * Layout: top-strip met counter [N/Total] + Vorige/Volgende-knoppen,
 * body = <PijnpuntFocusCard> centraal.
 *
 * State-orchestratie zit in VerbeteractiesView (parent); deze component is
 * presentational + dispatch.
 */

import React from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import PijnpuntFocusCard from "./PijnpuntFocusCard";

export default function DoorloopView({
  painPoints,
  intents,
  links,
  currentIdx,
  onPrev,
  onNext,
  // Inline-state per focus
  lensPickerOpenFor,
  lensLoading,
  aiDraftFor,
  eigenActieEditFor,
  // Choice/Lens/AI/Eigen handlers
  onChooseAi,
  onChooseEigen,
  onChooseDismiss,
  onPickLens,
  onCancelLens,
  onAccepteerAi,
  onVerfijnAi,
  onWuifWegAi,
  onSaveEigenActie,
  onCancelEigenActie,
  onReopen,
  onEditIntent,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const total = (painPoints || []).length;

  if (total === 0) {
    return (
      <div
        className="px-5 py-8 bg-slate-50 border border-slate-200 rounded text-center"
        data-testid="doorloop-empty"
      >
        <Inbox size={28} className="mx-auto text-slate-400 mb-3" />
        <p className="text-sm text-slate-700 font-medium mb-1">
          {lbl("klanten.verbeteracties.doorloop.empty.titel", "Geen pijnpunten")}
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {lbl(
            "klanten.verbeteracties.doorloop.empty.body",
            "Voeg eerst pijnpunten toe in fase 2 om de Doorloop te starten.",
          )}
        </p>
      </div>
    );
  }

  const safeIdx = Math.min(Math.max(currentIdx, 0), total - 1);
  const painPoint = painPoints[safeIdx];
  const linkedIntents = (intents || []).filter(intent =>
    (links || []).some(l => l.intent_id === intent.id && l.pain_point_id === painPoint.id),
  );

  const isLensOpenHere = lensPickerOpenFor === painPoint.id;
  const isLensLoadingHere = lensLoading && lensLoading.painPointId === painPoint.id;
  const isAiDraftHere = aiDraftFor?.painPointId === painPoint.id ? aiDraftFor.draftIntent : null;
  const isEigenOpenHere = eigenActieEditFor === painPoint.id;

  return (
    <div className="space-y-5" data-testid="doorloop-view">
      {/* Top-strip */}
      <div className="flex items-center justify-between">
        <div
          className="text-xs font-bold uppercase tracking-widest text-slate-500"
          data-testid="doorloop-counter"
        >
          {lbl("klanten.verbeteracties.doorloop.counter", "Pijnpunt")} [{safeIdx + 1}/{total}]
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={safeIdx === 0}
            data-testid="doorloop-prev"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-700 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={12} />
            {lbl("klanten.verbeteracties.actie.vorige", "Vorige")}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={safeIdx === total - 1}
            data-testid="doorloop-next"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-700 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {lbl("klanten.verbeteracties.actie.volgende", "Volgende")}
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Focus card */}
      <div className="max-w-3xl mx-auto">
        <PijnpuntFocusCard
          painPoint={painPoint}
          painIndex={safeIdx}
          linkedIntents={linkedIntents}
          lensPickerOpen={isLensOpenHere}
          lensLoading={isLensLoadingHere ? lensLoading : null}
          aiDraft={isAiDraftHere}
          eigenActieOpen={isEigenOpenHere}
          onChooseAi={() => onChooseAi(painPoint)}
          onChooseEigen={() => onChooseEigen(painPoint)}
          onChooseDismiss={() => onChooseDismiss(painPoint)}
          onPickLens={(lens) => onPickLens(painPoint, lens)}
          onCancelLens={() => onCancelLens(painPoint)}
          onAccepteerAi={(payload) => onAccepteerAi(painPoint, payload)}
          onVerfijnAi={() => onVerfijnAi(painPoint)}
          onWuifWegAi={() => onWuifWegAi(painPoint)}
          onSaveEigenActie={(payload) => onSaveEigenActie(painPoint, payload)}
          onCancelEigenActie={() => onCancelEigenActie(painPoint)}
          onReopen={() => onReopen(painPoint)}
          onEditIntent={onEditIntent}
          appLabel={appLabel}
        />
      </div>
    </div>
  );
}
