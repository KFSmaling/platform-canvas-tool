/**
 * ChoiceCards — 3 atomic keuze-paden voor een pijnpunt in Doorloop-modus.
 *
 * 11.U Block 2b — RFC-007-rev2 Variant D.
 *
 * Cards gelijk-gestyled (border-slate-200 + hover:bg-slate-50 + cursor-pointer).
 * - "Genereer met AI" → opent LensPicker inline
 * - "Schrijf eigen actie" → opent textarea-inline-edit
 * - "Niet adresseren" → placeholder-alert (Block 3 MotivatieModal volgt)
 */

import React from "react";
import { Sparkles, PenLine, XCircle } from "lucide-react";

const CARD_CLASS =
  "flex-1 border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors text-left flex flex-col gap-2";

export default function ChoiceCards({
  onChooseAi,
  onChooseEigen,
  onChooseDismiss,
  disabled = false,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  return (
    <div
      className="flex flex-col sm:flex-row gap-3"
      data-testid="doorloop-choice-cards"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onChooseAi}
        data-testid="doorloop-choice-ai"
        className={`${CARD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2 text-[var(--color-accent)]">
          <Sparkles size={18} />
          <span className="text-base font-semibold text-[var(--color-primary)]">
            {lbl("klanten.verbeteracties.choice.ai.titel", "Genereer met AI")}
          </span>
        </div>
        <p className="text-xs text-slate-600">
          {lbl(
            "klanten.verbeteracties.choice.ai.body",
            "Laat AI een verbeteractie voorstellen op basis van een gekozen lens.",
          )}
        </p>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onChooseEigen}
        data-testid="doorloop-choice-eigen"
        className={`${CARD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2 text-[var(--color-primary)]">
          <PenLine size={18} />
          <span className="text-base font-semibold">
            {lbl("klanten.verbeteracties.choice.eigen.titel", "Schrijf eigen actie")}
          </span>
        </div>
        <p className="text-xs text-slate-600">
          {lbl(
            "klanten.verbeteracties.choice.eigen.body",
            "Formuleer zelf een verbeteractie voor dit pijnpunt.",
          )}
        </p>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onChooseDismiss}
        data-testid="doorloop-choice-dismiss"
        className={`${CARD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2 text-slate-500">
          <XCircle size={18} />
          <span className="text-base font-semibold text-[var(--color-primary)]">
            {lbl("klanten.verbeteracties.choice.dismiss.titel", "Niet adresseren")}
          </span>
        </div>
        <p className="text-xs text-slate-600">
          {lbl(
            "klanten.verbeteracties.choice.dismiss.body",
            "Markeer dit pijnpunt als bewust niet aangepakt — motivatie verplicht.",
          )}
        </p>
      </button>
    </div>
  );
}
