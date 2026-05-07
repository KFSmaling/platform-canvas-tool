/**
 * DimensieKolom — één kolom in de dimensie-grid van WerkruimteView.
 *
 * Toont:
 *   - dimensie-naam + archetype-label
 *   - lijst items (klikbaar → opent ItemModal)
 *   - "+ item"-knop onderaan
 *   - disabled AI-knop met tooltip "AI komt in fase 3"
 *
 * Props:
 *   - dimension: { id, archetype, name, description }
 *   - items: array filtered op deze dimensie
 *   - onItemClick(item)
 *   - onAddItem()
 */

import React from "react";
import { Sparkles, Plus, Pencil } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

export default function DimensieKolom({ dimension, items, onItemClick, onAddItem, onEditDimensie }) {
  const { label: appLabel } = useAppConfig();

  // Click op naam-header → edit-modal (UX-consistency-principe F3)
  const headerClickable = typeof onEditDimensie === "function";

  return (
    <div className="bg-white border border-slate-200 rounded-md flex flex-col min-h-[400px]">
      {/* Header — klikbaar voor edit-modal */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-baseline justify-between">
          {headerClickable ? (
            <button
              type="button"
              onClick={() => onEditDimensie(dimension)}
              data-testid={`dimensie-edit-${dimension.id}`}
              className="group flex items-center gap-1.5 text-left hover:text-[var(--color-accent)] transition-colors"
              title={appLabel("klanten.dimensie.edit.tooltip", "Klik om te bewerken")}
            >
              <h4 className="text-sm font-bold text-[var(--color-primary)] group-hover:text-[var(--color-accent)]">{dimension.name}</h4>
              <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          ) : (
            <h4 className="text-sm font-bold text-[var(--color-primary)]">{dimension.name}</h4>
          )}
          <span className="text-[9px] text-slate-400 uppercase tracking-widest">{dimension.archetype}</span>
        </div>
        {dimension.description && (
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{dimension.description}</p>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-2 overflow-auto">
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">Nog geen items — voeg er één toe.</p>
        )}
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className={`w-full text-left border border-slate-200 rounded px-3 py-2 hover:border-[var(--color-accent)] hover:bg-slate-50 transition-colors ${item.is_draft ? "opacity-60" : ""}`}
          >
            <div className="text-sm font-medium text-slate-800">{item.name}</div>
            {item.description && (
              <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
            )}
          </button>
        ))}
      </div>

      {/* Footer: add + AI-affordance (disabled MVP) */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] hover:text-[var(--color-accent)] uppercase tracking-widest"
        >
          <Plus size={12} />
          {appLabel("klanten.knop.item.toevoegen", "+ item")}
        </button>
        <button
          type="button"
          disabled
          title={appLabel("klanten.ai.disabled.tooltip", "AI komt in fase 3")}
          className="flex items-center gap-1 text-[10px] text-slate-400 cursor-not-allowed opacity-60"
        >
          <Sparkles size={10} />
          {appLabel("klanten.ai.cluster", "Cluster-analyse")}
        </button>
      </div>
    </div>
  );
}
