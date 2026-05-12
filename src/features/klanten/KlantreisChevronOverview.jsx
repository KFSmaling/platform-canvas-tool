/**
 * KlantreisChevronOverview — chevron-strip boven detail-cards voor klantreis-
 * archetype (Bundle 4 F26, designer-note 6 mei). Twee zoom-niveaus op dezelfde
 * data: compacte chevron-flow + bestaande verticale ItemCard-render.
 *
 * Visual: N clip-path-chevron-divs in horizontale flex-rij; per chevron een
 * nummer in de pijl + korte stage-naam onder. Tooltip = volle naam. Click
 * triggert callback (DimensieKolom doet scroll-naar-card + ring-glow).
 *
 * Props:
 *   - items: array van klantreis-cd_items, gesorteerd op sort_order ASC
 *   - painPointCounts: Map<item_id, count> — telt pijn-koppelingen (fase 2)
 *   - currentPhase: 1 | 2 | 3 | 4 — bepaalt color-overlay
 *   - highlightedItemId: id van card die net is aangeklikt (subtiele
 *     border-emphasis op corresponderende chevron) of null
 *   - onChevronClick(itemId)
 *
 * Color-overlay-regels (designer-note):
 *   fase 1               → neutraal `#7F77DD`
 *   fase 2 + geen pijn   → neutraal `#7F77DD`
 *   fase 2 + pijn        → `#534AB7` (donkerder)
 *   fase 2 + MoT/Silent  → `#3C3489` (donkerste, asymmetrie-erkenning)
 *                          OF weight_multiplier > 1.0
 *
 * Fase 3+4 uit scope (designer-note) — chevrons blijven neutraal voorlopig.
 */

import React from "react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const COLOR_NEUTRAL    = "#7F77DD";
const COLOR_PAIN       = "#534AB7";
const COLOR_ASYMMETRIE = "#3C3489";

// Clip-path voor chevron pijl-naar-rechts: 12px-notch links + 12px-punt rechts.
// Eerste chevron krijgt geen notch links (vlak); laatste geen punt rechts (vlak).
const CHEVRON_CLIP_MID   = "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";
const CHEVRON_CLIP_FIRST = "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)";
const CHEVRON_CLIP_LAST  = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)";

function clipFor(idx, total) {
  if (total <= 1) return CHEVRON_CLIP_MID;
  if (idx === 0) return CHEVRON_CLIP_FIRST;
  if (idx === total - 1) return CHEVRON_CLIP_LAST;
  return CHEVRON_CLIP_MID;
}

function colorFor({ phase, painCount, isAsymmetrie }) {
  if (phase >= 2 && isAsymmetrie) return COLOR_ASYMMETRIE;
  if (phase >= 2 && painCount > 0) return COLOR_PAIN;
  return COLOR_NEUTRAL;
}

function hasAsymmetrieFlag(item) {
  const d = item.archetype_data || {};
  const mot   = d.is_moment_of_truth === true;
  const silnt = d.is_silent_period === true;
  const weight = typeof d.weight_multiplier === "number" ? d.weight_multiplier : 1;
  return mot || silnt || weight > 1.0;
}

export default function KlantreisChevronOverview({
  items = [],
  painPointCounts = new Map(),
  currentPhase = 1,
  highlightedItemId = null,
  onChevronClick,
}) {
  const { label: appLabel } = useAppConfig();
  const total = items.length;
  if (total === 0) return null;

  return (
    <div
      data-testid="klantreis-chevron-overview"
      className="sticky top-0 z-10 bg-white border-b border-slate-200 px-2 pt-2 pb-3 -mx-4 mb-3"
    >
      <div className="flex items-stretch overflow-x-auto pb-1">
        {items.map((item, idx) => {
          const nummer = idx + 1;
          const stapType = item.archetype_data?.stap_type || "";
          const shortName = stapType
            ? appLabel(`klanten.klantreis.stap_type.${stapType}.short`, item.name)
            : item.name;
          const fullName = stapType
            ? appLabel(`klanten.klantreis.stap_type.${stapType}`, item.name)
            : item.name;
          const painCount    = painPointCounts.get(item.id) || 0;
          const isAsymmetrie = hasAsymmetrieFlag(item);
          const background   = colorFor({ phase: currentPhase, painCount, isAsymmetrie });
          const isHighlighted = highlightedItemId === item.id;
          const clipPath = clipFor(idx, total);

          return (
            <div
              key={item.id}
              className={`relative shrink-0 ${idx === 0 ? "" : "-ml-3"}`}
              style={{ width: 88 }}
            >
              <button
                type="button"
                onClick={() => onChevronClick && onChevronClick(item.id)}
                data-testid={`chevron-${item.id}`}
                data-pain-count={painCount}
                data-asymmetrie={isAsymmetrie ? "true" : "false"}
                title={fullName}
                aria-label={`${nummer}. ${fullName}`}
                className={`flex items-center justify-center w-full h-10 text-white text-[11px] font-bold transition-all hover:brightness-110 ${
                  isHighlighted ? "ring-2 ring-purple-300 ring-offset-1" : ""
                }`}
                style={{ clipPath, backgroundColor: background }}
              >
                {nummer}
              </button>
              <div className="mt-1 text-center text-[9px] text-slate-700 truncate px-1" title={fullName}>
                {shortName}
              </div>
              {currentPhase >= 2 && painCount > 0 && (
                <span
                  data-testid={`chevron-pain-badge-${item.id}`}
                  className="absolute -top-1.5 right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm pointer-events-none"
                >
                  {painCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
