/**
 * CanvasTegelSummary — F12 canvas-tegel-feedback (S1 design-systeem).
 *
 * Per pijler-tegel een compacte 2-regel-samenvatting:
 *   Regel 1: counts ("9 dimensies · 12 items · 7 pijnpunten · 3 in roadmap")
 *   Regel 2: laatste quote of empty-state-tekst
 *
 * Voor pijlers waarvoor het werkblad nog niet bestaat (Processen/Mensen/IT/
 * Portfolio): stub-tekst per pijler. Bestaande BlockCard `bullets`-render
 * blijft daarnaast werken — deze component vult/vervangt summary alleen voor
 * pijlers met een eigen data-bron (klanten/strategie/richtlijnen).
 *
 * Designer §1.10 + findings F12 Optie B: counts + kwalitatieve quote.
 *
 * Props:
 *   - blockId — block.id ("customers"/"strategy"/"principles"/etc.)
 *   - summary — object uit `get_canvas_summary`-RPC (klanten/strategie/richtlijnen-buckets)
 *               of null/undefined wanneer nog niet geladen
 *   - appLabel — config-resolver (optioneel — fallbacks zijn inline)
 *
 * Render: 2 regels onder de bestaande BlockCard-bullets-area. Geen knoppen.
 */

import React from "react";

const QUOTE_MAX = 100;

function truncate(text, max = QUOTE_MAX) {
  if (!text) return "";
  const t = String(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + "…";
}

function plural(n, singular, pluralWord) {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

export default function CanvasTegelSummary({ blockId, summary, appLabel }) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);

  // ── Klanten ─────────────────────────────────────────────────────────────
  if (blockId === "customers") {
    const k = summary?.klanten || {};
    const totalCounts = (k.dimensies || 0) + (k.items || 0) + (k.pijnpunten || 0) + (k.verbeteracties_roadmap || 0);
    if (totalCounts === 0) {
      return (
        <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
          <p className="text-xs italic text-neutral-500">
            {lbl("canvas.tegel.klanten.leeg", "Nog leeg — start met '+ Eerste dimensie aanmaken'")}
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
        <p className="text-xs text-neutral-600">
          {plural(k.dimensies || 0, "dimensie", "dimensies")} · {plural(k.items || 0, "item", "items")} ·{" "}
          {plural(k.pijnpunten || 0, "pijnpunt", "pijnpunten")}
          {k.verbeteracties_roadmap > 0 && (
            <> · <span className="text-category-klanten">{k.verbeteracties_roadmap} in roadmap</span></>
          )}
        </p>
        {k.last_pattern_text && (
          <p className="text-xs text-neutral-500 italic mt-1 line-clamp-2">
            "{truncate(k.last_pattern_text)}"
          </p>
        )}
      </div>
    );
  }

  // ── Strategie ───────────────────────────────────────────────────────────
  if (blockId === "strategy") {
    const s = summary?.strategie || {};
    const filledFields = [s.missie_filled, s.visie_filled, s.ambitie_filled, s.samenvatting_filled].filter(Boolean).length;
    const totalContent = filledFields + (s.themas || 0);
    if (totalContent === 0) {
      return (
        <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
          <p className="text-xs italic text-neutral-500">
            {lbl("canvas.tegel.strategie.leeg", "Nog leeg — open werkblad om missie/visie te vullen")}
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
        <p className="text-xs text-neutral-600">
          {filledFields}/4 identiteit · {plural(s.themas || 0, "thema", "thema's")}
        </p>
        {s.last_thema_title && (
          <p className="text-xs text-neutral-500 italic mt-1 line-clamp-2">
            "{truncate(s.last_thema_title)}"
          </p>
        )}
      </div>
    );
  }

  // ── Richtlijnen ────────────────────────────────────────────────────────
  if (blockId === "principles") {
    const r = summary?.richtlijnen || {};
    if (!r.count || r.count === 0) {
      return (
        <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
          <p className="text-xs italic text-neutral-500">
            {lbl("canvas.tegel.richtlijnen.leeg", "Nog leeg — open werkblad om richtlijnen te vullen")}
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
        <p className="text-xs text-neutral-600">
          {plural(r.count, "richtlijn", "richtlijnen")}
        </p>
        {r.last_title && (
          <p className="text-xs text-neutral-500 italic mt-1 line-clamp-2">
            "{truncate(r.last_title)}"
          </p>
        )}
      </div>
    );
  }

  // ── Werkbladen nog niet gebouwd (processes/people/technology/portfolio) ──
  if (["processes", "people", "technology", "portfolio"].includes(blockId)) {
    return (
      <div className="mt-3 pt-2 border-t border-neutral-100" data-testid={`tegel-summary-${blockId}`}>
        <p className="text-xs italic text-neutral-400">
          {lbl(`canvas.tegel.${blockId}.stub`, "Werkblad komt later")}
        </p>
      </div>
    );
  }

  return null;
}
