/**
 * PijnpuntenView — fase-2-content in WerkruimteView (RFC-001 §2.3 + §2.4).
 *
 * Layout (anker prototype regel 167-211):
 *   1. Compacte dimensie-grid bovenaan (read-only) met red-dot-markers per item
 *      dat een coupling heeft.
 *   2. Pijnpunten-lijst (cards met tekst + chips) — gegroepeerd in 2-kolom-grid,
 *      overstijgende pijnpunten span 2 kolommen.
 *   3. "+ pijnpunt"-CTA onderaan.
 *
 * Props:
 *   - dimensions, items (uit useCanvasDimensions)
 *   - painPoints, couplings (uit usePainPoints)
 *   - onAddPijnpunt()  — opent PijnpuntModal in create-mode
 *   - onEditPijnpunt(painPoint) — opent PijnpuntModal in edit-mode
 */

import React from "react";
import { Plus } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import PijnpuntCard from "./PijnpuntCard";

// Aantal couplings per item-id — voor red-dot-marker in inventaris-grid
function couplingCountByItem(couplings) {
  const counts = new Map();
  for (const c of couplings) {
    if (c.target_table !== "cd_items") continue;
    counts.set(c.target_id, (counts.get(c.target_id) || 0) + 1);
  }
  return counts;
}

function CompactDimensieKolom({ dimension, items, couplingCounts }) {
  const dimItems = items.filter(it => it.dimension_id === dimension.id);
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="font-medium text-[12px] mb-2">{dimension.name}</div>
      {dimItems.length === 0 ? (
        <p className="text-[10px] text-slate-400 italic">geen items</p>
      ) : (
        <div className="space-y-1.5">
          {dimItems.map(it => {
            const count = couplingCounts.get(it.id) || 0;
            return (
              <div key={it.id} className="bg-slate-50 px-3 py-1.5 rounded flex justify-between items-center">
                <div className="text-[12px]">{it.name}</div>
                {count > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(count, 5) }).map((_, idx) => (
                      <span key={idx} className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    ))}
                    {count > 5 && <span className="text-[9px] text-red-600 ml-1">+{count - 5}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PijnpuntenView({
  dimensions = [],
  items = [],
  painPoints = [],
  couplings = [],
  onAddPijnpunt,
  onEditPijnpunt,
}) {
  const { label: appLabel } = useAppConfig();
  const couplingCounts = couplingCountByItem(couplings);
  const couplingsByPain = new Map();
  for (const c of couplings) {
    if (!couplingsByPain.has(c.pain_point_id)) couplingsByPain.set(c.pain_point_id, []);
    couplingsByPain.get(c.pain_point_id).push(c);
  }

  return (
    <div className="px-8 py-6 overflow-auto">
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
        {appLabel("klanten.pijnpunt.intro", "verzamel waarnemingen en koppel aan items. multi-relationeel — een pijnpunt mag aan meerdere dimensies hangen, of nergens (overstijgend).")}
      </p>

      {/* Compacte inventaris-grid bovenaan */}
      {dimensions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {dimensions.map(dim => (
            <CompactDimensieKolom
              key={dim.id}
              dimension={dim}
              items={items}
              couplingCounts={couplingCounts}
            />
          ))}
        </div>
      )}

      {/* Pijnpunten-lijst */}
      <div className="flex justify-between items-baseline mb-3">
        <div className="font-medium text-sm text-[var(--color-primary)]">
          {appLabel("klanten.pijnpunt.lijst.titel", "Pijnpunten")}
        </div>
        <div className="text-[10px] text-slate-400">
          {painPoints.length} · {appLabel("klanten.pijnpunt.lijst.helper", "card laat koppelingen zien als chips")}
        </div>
      </div>

      {painPoints.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-300 rounded">
          <p className="text-sm text-slate-500 italic mb-3">
            {appLabel("klanten.pijnpunt.lijst.leeg", "Nog geen pijnpunten — voeg er één toe.")}
          </p>
          <button
            type="button"
            onClick={onAddPijnpunt}
            data-testid="pijnpunt-cta-eerste"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[11px] font-bold uppercase tracking-widest rounded-md transition-colors"
          >
            <Plus size={14} />
            {appLabel("klanten.pijnpunt.knop.toevoegen.eerste", "+ Eerste pijnpunt aanmaken")}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {painPoints.map(pp => (
              <PijnpuntCard
                key={pp.id}
                painPoint={pp}
                couplings={couplingsByPain.get(pp.id) || []}
                dimensions={dimensions}
                items={items}
                onClick={onEditPijnpunt}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAddPijnpunt}
              data-testid="pijnpunt-cta-extra"
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-1.5 rounded-sm transition-colors"
            >
              <Plus size={12} />
              {appLabel("klanten.pijnpunt.knop.toevoegen", "+ pijnpunt")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
