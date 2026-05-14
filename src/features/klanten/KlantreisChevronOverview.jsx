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

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const COLOR_NEUTRAL    = "#7F77DD";
const COLOR_PAIN       = "#534AB7";
const COLOR_ASYMMETRIE = "#3C3489";

// Clip-path voor chevron pijl-naar-rechts: 12px-notch links + 12px-punt rechts.
// Eerste chevron krijgt geen notch links (vlak); laatste geen punt rechts (vlak).
// Exported voor hergebruik door F26-iteratie PijnpuntChevronCard (zelfde
// shape-geometrie, andere kleur-config).
export const CHEVRON_CLIP_MID   = "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";
export const CHEVRON_CLIP_FIRST = "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)";
export const CHEVRON_CLIP_LAST  = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)";

// `clipFor` retourneert clip-path-string voor chevron op positie idx van total.
// Voor pijnpunt-chevron-cards in F26-iteratie altijd MID gebruiken (zelfde
// vorm in continue flow — geen "eerste" of "laatste" semantiek).
export function clipFor(idx, total) {
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
  // F26-iteratie fix — bij `fullWidth=true` spreidden chevrons over volle
  // container-breedte (flex-1 ipv vaste 88px). Voor top-strip-render in
  // WerkruimteView + PijnpuntenView. Default false voor backwards-compat.
  fullWidth = false,
  // T4 A3: optionele stap-omschrijvingen per chevron, default collapsed.
  // Click op disclosure-icoon onder shortName toggelt expand. Bij `false`
  // (default) — backwards-compat, geen disclosure-icoon, geen expand-render.
  expandable = false,
}) {
  const { label: appLabel } = useAppConfig();
  const total = items.length;
  // T4 A3: per-item expand-state Set<id>
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpand = (id) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  if (total === 0) return null;

  return (
    <div
      data-testid="klantreis-chevron-overview"
      className={`sticky top-0 z-10 bg-white pt-3 pb-3 -mx-4 px-4 ${fullWidth ? "" : "border-b border-slate-200 mb-3"}`}
    >
      <div
        className={`flex items-stretch pb-1 ${fullWidth ? "overflow-x-hidden gap-1" : "overflow-x-auto"}`}
      >
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

          // In fullWidth-mode geen `-ml-3` overlap meer — bij brede chevrons
          // werd notch (12px) visueel verloren waardoor strip als één
          // paarse balk leek. Met `gap-1` (4px witte ruimte) op de flex-
          // container blijven chevron-vormen herkenbaar.
          return (
            <div
              key={item.id}
              className={`relative ${
                fullWidth ? "flex-1 min-w-[60px]" : `shrink-0 ${idx === 0 ? "" : "-ml-3"}`
              }`}
              style={fullWidth ? undefined : { width: 88 }}
            >
              <button
                type="button"
                onClick={() => onChevronClick && onChevronClick(item.id)}
                data-testid={`chevron-${item.id}`}
                data-pain-count={painCount}
                data-asymmetrie={isAsymmetrie ? "true" : "false"}
                title={fullName}
                aria-label={`${nummer}. ${fullName}`}
                className={`flex items-center justify-center w-full h-12 text-white text-[11px] font-bold transition-all hover:brightness-110 ${
                  isHighlighted ? "ring-2 ring-purple-300 ring-offset-1" : ""
                }`}
                style={{ clipPath, backgroundColor: background }}
              >
                {nummer}
              </button>
              <div className="mt-1 text-center text-[9px] text-slate-700 truncate px-1 flex items-center justify-center gap-1" title={fullName}>
                <span className="truncate">{shortName}</span>
                {expandable && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    data-testid={`chevron-disclosure-${item.id}`}
                    aria-expanded={expandedIds.has(item.id) ? "true" : "false"}
                    aria-label={`Toon omschrijving voor ${fullName}`}
                    className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                  >
                    {expandedIds.has(item.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                )}
              </div>
              {/* T4 A10+A11: pain-badge nu BINNEN chevron-shape (top-1 ipv -top-1.5)
                  + chevron-height verhoogd naar h-12 zodat halve-bolletjes-clip
                  niet meer optreedt. */}
              {currentPhase >= 2 && painCount > 0 && (
                <span
                  data-testid={`chevron-pain-badge-${item.id}`}
                  className="absolute top-1 right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm pointer-events-none"
                >
                  {painCount}
                </span>
              )}
              {/* T4 A3: stap-omschrijving conditioneel onder chevron */}
              {expandable && expandedIds.has(item.id) && (
                <div
                  data-testid={`chevron-omschrijving-${item.id}`}
                  className="mt-1.5 text-[10px] text-slate-600 leading-snug bg-slate-50 border border-slate-200 rounded px-2 py-1.5"
                >
                  {item.archetype_data?.customer_goal
                    || item.archetype_data?.insight
                    || item.description
                    || appLabel("klanten.klantreis.chevron.geen_omschrijving", "Geen omschrijving — open item voor details.")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
