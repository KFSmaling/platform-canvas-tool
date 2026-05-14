/**
 * WerkbladActieknoppen — canoniek werkflow-knoppen-component voor werkbladen.
 *
 * Layout: [Tips]* [Analyse draaien]* [Inzichten bekijken] [Rapportage]
 *
 * Designer 2026-05-13 §1.6 + §7 punt 1+2: alle werkbladen gebruiken dit
 * component consistent. "Werkruimte/Rapport"-toggle (klanten oud) vervalt —
 * Rapportage is een aparte knop.
 *
 * Designer §7 punt 2: "Analyse draaien" weg uit werkblad-header in target-
 * design — verhuist naar Inzichten-scherm. Maar Strategie + Richtlijnen
 * gebruiken dit nog. Vandaar: `onAnalyse` is optioneel — bij `null`/`undefined`
 * wordt de analyse-knop niet gerendered.
 *
 * T2: `onTips` is optionele extension voor werkbladen die invultips bieden
 * (Strategie eerst, T3 Richtlijnen + T4 Klanten volgen). Geen breaking change —
 * default niet zichtbaar.
 *
 * Props:
 *   onTips            () => void | null/undefined  — null → tips-knop weg (T2+)
 *   onAnalyse         () => void | null/undefined  — null → analyse-knop weg
 *   onBekijken        () => void                   — handler voor "Inzichten bekijken"
 *   onRapportage      () => void | null            — handler; null → knop disabled
 *   tipsLabel         string?                      — override default "Tips"
 *   analyseLabel      string?                      — alleen relevant als onAnalyse gegeven
 *   analysing         boolean                      — true = analyse draait (knop disabled)
 *   bekijkenDisabled  boolean                      — true = nog geen analyse beschikbaar
 *   rapportageLabel   string?                      — override default "Rapportage"
 *   appLabel          (key, fb) => string          — config-resolver
 */

import { FileText, Lightbulb } from "lucide-react";
import AiIcon from "./AiIcon";

export default function WerkbladActieknoppen({
  onTips,
  onAnalyse,
  onBekijken,
  onRapportage,
  tipsLabel,
  analyseLabel,
  analysing        = false,
  bekijkenDisabled = false,
  rapportageLabel,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const rapportageOff = !onRapportage;
  const showAnalyse   = typeof onAnalyse === "function";
  const showTips      = typeof onTips === "function";

  return (
    <div className="flex items-center gap-2" data-testid="werkblad-actieknoppen">

      {/* 0 — Tips (T2: optioneel — Strategie eerst, T3/T4 volgen) */}
      {showTips && (
        <button
          type="button"
          onClick={onTips}
          data-testid="werkblad-actie-tips"
          title={lbl("werkblad.action.tips.tooltip", "Invultips voor dit werkblad")}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 hover:border-neutral-400 text-primary text-sm rounded-md transition-colors"
          style={{ color: "var(--color-primary)" }}
        >
          <Lightbulb size={14} className="text-[var(--color-accent)]" />
          {tipsLabel ?? lbl("werkblad.action.tips", "Tips")}
        </button>
      )}

      {/* 1 — Analyse draaien (optioneel — alleen Strategie + Richtlijnen MVP) */}
      {showAnalyse && (
        <button
          type="button"
          onClick={analysing ? undefined : onAnalyse}
          disabled={analysing}
          data-testid="werkblad-actie-analyse"
          className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 hover:border-neutral-400 text-primary text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "var(--color-primary)" }}
        >
          <AiIcon variant="generate" size={14} />
          {analyseLabel}
        </button>
      )}

      {/* 2 — Inzichten bekijken (disabled tot er een analyse is) */}
      <button
        type="button"
        onClick={bekijkenDisabled ? undefined : onBekijken}
        disabled={bekijkenDisabled}
        data-testid="werkblad-actie-inzichten"
        title={bekijkenDisabled ? lbl("werkblad.action.bekijk_disabled_tooltip", "Eerst een analyse draaien") : undefined}
        className={`flex items-center gap-2 px-3 py-2 border text-sm rounded-md transition-colors ${
          bekijkenDisabled
            ? "bg-white border-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-white border-neutral-300 hover:border-neutral-400 text-primary cursor-pointer"
        }`}
        style={!bekijkenDisabled ? { color: "var(--color-primary)" } : undefined}
      >
        <AiIcon
          variant="generate"
          size={14}
          colorClass={bekijkenDisabled ? "text-neutral-400" : "text-[var(--color-ai-accent)]"}
        />
        {lbl("werkblad.action.bekijk_inzichten", "Inzichten")}
      </button>

      {/* 3 — Rapportage */}
      <button
        type="button"
        onClick={rapportageOff ? undefined : onRapportage}
        disabled={rapportageOff}
        data-testid="werkblad-actie-rapportage"
        title={rapportageOff ? lbl("werkblad.action.rapportage_tooltip", "Volgt in volgende release") : undefined}
        className={`flex items-center gap-2 px-3 py-2 bg-white border text-sm rounded-md transition-colors ${
          rapportageOff
            ? "border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60"
            : "border-neutral-300 hover:border-neutral-400 text-primary"
        }`}
        style={!rapportageOff ? { color: "var(--color-primary)" } : undefined}
      >
        <FileText size={14} />
        {rapportageLabel ?? lbl("werkblad.action.rapportage", "Rapportage")}
      </button>

    </div>
  );
}
