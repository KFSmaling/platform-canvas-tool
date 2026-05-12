/**
 * PijnpuntChevronCard — pijnpunt-presentatie in chevron-vorm voor F26-iteratie.
 *
 * Zelfde clip-path-geometrie als `KlantreisChevronOverview` (named exports
 * `clipFor` / `CHEVRON_CLIP_*`), andere kleur-config: rood-tinten voor
 * pijnpunt-context (designer-result regel 213-223).
 *
 * Render-elementen:
 *   - Chevron-vorm (~180-220px breed, meer tekst-ruimte dan stage-chevron)
 *   - Cross-referentie-nummer linker-bovenhoek (= F27-PijnpuntCard.nummer)
 *   - Multi-relationele-chip rechts: "+ N dimensies" wanneer aan ≥2 dimensies
 *   - Stage-koppeling-pill onderaan: "stap N · {stage-naam}"
 *   - Tekst: 1 regel titel-style + max 2 regels sub-tekst
 *
 * Click → opent PijnpuntModal (via `onClick(pijnpunt)`-callback) zoals
 * bestaande PijnpuntCard-pattern in PijnpuntenView.
 *
 * Props:
 *   - pijnpunt: cd_pain_points-rij { id, text_md, ... }
 *   - nummer: cross-referentie-nummer (F27-consistent, linker-bovenhoek)
 *   - stageNummer: 1-based stage-volgnummer waaraan dit pijnpunt is gekoppeld
 *   - stageShortName: korte stage-naam voor pill ("Aanvraag" etc.)
 *   - extraDimensieCount: 0 als alleen klantreis-koppeling, anders extra dims
 *   - clipIdx: positie in flow (voor clipFor — alle midden ivm continue flow)
 *   - clipTotal: totaal in flow
 *   - onClick(pijnpunt)
 */

import React from "react";
import { clipFor } from "./KlantreisChevronOverview";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const COLOR_FILL    = "#FEF2F2";  // red-50
const COLOR_BORDER  = "#FCA5A5";  // red-300
const COLOR_TITLE   = "#7F1D1D";  // red-900
const COLOR_SUBTEXT = "#991B1B";  // red-800

// Eerste-regel-extract uit text_md (max 60 chars + ellipsis bij overflow).
function titleFromText(textMd) {
  if (!textMd) return "";
  const firstLine = String(textMd).split(/[\n.!?]/)[0].trim();
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 59).trim() + "…";
}

// Rest van tekst voor sub-tekst (max 2 regels via CSS line-clamp).
function subtextFromText(textMd) {
  if (!textMd) return "";
  const parts = String(textMd).split(/[\n]/);
  if (parts.length <= 1) {
    // Geen tweede regel — strip eerste-regel-titel-deel uit text
    const firstSentenceEnd = parts[0].search(/[.!?]/);
    if (firstSentenceEnd > 0 && firstSentenceEnd < parts[0].length - 1) {
      return parts[0].slice(firstSentenceEnd + 1).trim();
    }
    return "";
  }
  return parts.slice(1).join(" ").trim();
}

export default function PijnpuntChevronCard({
  pijnpunt,
  nummer = null,
  stageNummer = null,
  stageShortName = "",
  extraDimensieCount = 0,
  clipIdx = 0,
  clipTotal = 1,
  onClick,
}) {
  const { label: appLabel } = useAppConfig();
  const clipPath = clipFor(clipIdx, clipTotal);
  const title    = titleFromText(pijnpunt.text_md);
  const subtext  = subtextFromText(pijnpunt.text_md);

  const stagePillText = stageNummer != null
    ? `${appLabel("klanten.pijnpunt.stage_koppeling.prefix", "stap")} ${stageNummer}${stageShortName ? ` · ${stageShortName}` : ""}`
    : null;

  const extraDimsText = extraDimensieCount > 0
    ? appLabel("klanten.pijnpunt.multi_relationeel.prefix", "+ {N} dimensies").replace("{N}", String(extraDimensieCount))
    : null;

  return (
    <div
      className="relative shrink-0"
      style={{ width: 220 }}
      data-testid={`pijnpunt-chevron-card-${pijnpunt.id}`}
    >
      <button
        type="button"
        onClick={() => onClick && onClick(pijnpunt)}
        className="w-full text-left transition-all hover:brightness-95"
        style={{
          clipPath,
          backgroundColor: COLOR_FILL,
          padding: "8px 18px 8px 18px",
          minHeight: 76,
          border: `0.5px solid ${COLOR_BORDER}`,
        }}
      >
        {/* Cross-referentie-nummer wordt extern absolute gepositioneerd
            buiten de clip-path zodat 'm niet wordt afgeknipt. */}
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          color: COLOR_TITLE,
          lineHeight: 1.25,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {title}
        </div>
        {subtext && (
          <div style={{
            marginTop: 2,
            fontSize: 10,
            fontWeight: 400,
            color: COLOR_SUBTEXT,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {subtext}
          </div>
        )}
        {stagePillText && (
          <div
            data-testid={`pijnpunt-chevron-stage-pill-${pijnpunt.id}`}
            style={{
              marginTop: 4,
              display: "inline-block",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#7F1D1D",
              backgroundColor: "rgba(127,29,29,0.08)",
              padding: "1px 5px",
              borderRadius: 3,
            }}
          >
            {stagePillText}
          </div>
        )}
      </button>

      {/* Cross-referentie-nummer linker-bovenhoek — buiten clip-path */}
      {nummer != null && (
        <span
          data-testid={`pijnpunt-chevron-num-${pijnpunt.id}`}
          className="absolute -top-1.5 left-3 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none shadow-sm pointer-events-none"
        >
          {nummer}
        </span>
      )}
      {/* Multi-relationele-chip rechts — buiten clip-path */}
      {extraDimsText && (
        <span
          data-testid={`pijnpunt-chevron-multi-${pijnpunt.id}`}
          className="absolute top-1 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 pointer-events-none"
        >
          {extraDimsText}
        </span>
      )}
    </div>
  );
}
