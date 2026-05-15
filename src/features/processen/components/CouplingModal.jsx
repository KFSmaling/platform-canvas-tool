/**
 * CouplingModal — multi-koppeling-UI voor pijnpunten naar 5 entiteit-types
 * (11.M.1 block-3b D3).
 *
 * RFC-005 §8.2: po_pain_point_couplings polymorphic met 5 target-tables:
 *   pr_processes / org_departments / vo_business_units / vo_value_teams /
 *   gov_control_processes
 *
 * Server-endpoint `pain_point_couplings` bestaat al uit 11.M MVP. Trigger
 * `validate_po_pain_point_coupling` doet cross-canvas/tenant-validatie + UNIQUE
 * constraint (pain_point_id, target_table, target_id) voorkomt duplicaten.
 *
 * UX:
 *  - Lijst van alle entity-types met counter (huidige + selectie)
 *  - Click op type-header → expand sectie met multi-select items
 *  - Items pre-checked als al gekoppeld; uncheck → DELETE coupling
 *  - Save → INSERT nieuwe couplings + DELETE verwijderde (diff-based)
 *
 * Props:
 *  - painPoint: { id, text_md }
 *  - canvasId
 *  - existingCouplings: array van po_pain_point_couplings-rijen voor deze pain
 *  - entityLists: { pr_processes, org_departments, vo_business_units, vo_value_teams, gov_control_processes }
 *    elk een array van { id, name }
 *  - onClose()
 *  - onSave(diff): async → diff = { adds: [{target_table, target_id}], removes: [coupling_id] }
 */

import React, { useState, useMemo } from "react";
import { X, Check } from "lucide-react";

// Hergebruik COUPLING_TAG_STYLES uit block-3a — geïmporteerd locaal voor visual-consistency
const ENTITY_TYPES = [
  { table: "pr_processes",          label: "Processen",      cls: "bg-green-100 text-green-800 border-green-200"     },
  { table: "org_departments",       label: "Afdelingen",     cls: "bg-slate-100 text-slate-700 border-slate-300"     },
  { table: "vo_business_units",     label: "Business units", cls: "bg-amber-100 text-amber-800 border-amber-200"     },
  { table: "vo_value_teams",        label: "Value teams",    cls: "bg-purple-100 text-purple-800 border-purple-200"  },
  { table: "gov_control_processes", label: "Control-processen", cls: "bg-blue-100 text-blue-800 border-blue-200"     },
];

export default function CouplingModal({
  painPoint,
  existingCouplings = [],
  entityLists = {},
  onClose,
  onSave,
}) {
  // selectedSet[target_table] = Set van target_id's die GESELECTEERD zijn
  // Initialiseer met existing couplings.
  const initialSelected = useMemo(() => {
    const m = {};
    for (const t of ENTITY_TYPES) m[t.table] = new Set();
    for (const c of existingCouplings) {
      if (m[c.target_table]) m[c.target_table].add(c.target_id);
    }
    return m;
  }, [existingCouplings]);

  const [selected, setSelected] = useState(initialSelected);
  const [expanded, setExpanded] = useState(null); // table-id
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function toggle(table, id) {
    setSelected(prev => {
      const next = { ...prev };
      const newSet = new Set(next[table]);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      next[table] = newSet;
      return next;
    });
  }

  function countForType(table) {
    return selected[table]?.size || 0;
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);

    // Diff: adds = nieuwe (in selected, niet in existing); removes = coupling_ids van existing die niet meer in selected
    const adds = [];
    const removes = [];
    const existingByKey = new Map();
    for (const c of existingCouplings) {
      existingByKey.set(`${c.target_table}::${c.target_id}`, c.id);
    }
    for (const type of ENTITY_TYPES) {
      const sel = selected[type.table];
      for (const id of sel) {
        if (!existingByKey.has(`${type.table}::${id}`)) {
          adds.push({ target_table: type.table, target_id: id });
        }
      }
    }
    for (const c of existingCouplings) {
      const stillSelected = selected[c.target_table]?.has(c.target_id);
      if (!stillSelected) removes.push(c.id);
    }

    const result = await onSave({ adds, removes });
    setSaving(false);
    if (result?.error) {
      setError(result.error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  const totalSelected = Object.values(selected).reduce((acc, s) => acc + s.size, 0);

  return (
    <div
      data-testid="coupling-modal"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Multi-koppeling</p>
            <h2 className="text-sm font-bold text-slate-800 truncate">Koppel pijnpunt</h2>
            <p className="text-xs text-slate-600 mt-1 truncate">{painPoint?.text_md}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            data-testid="coupling-modal-close"
            aria-label="Sluit"
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50 ml-2"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          {ENTITY_TYPES.map((type) => {
            const items = entityLists[type.table] || [];
            const count = countForType(type.table);
            const isExpanded = expanded === type.table;
            return (
              <div key={type.table} className="border border-slate-200 rounded">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : type.table)}
                  data-testid={`coupling-modal-type-${type.table}`}
                  data-expanded={isExpanded ? "true" : "false"}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded border ${type.cls}`}>
                      {type.label}
                    </span>
                    <span className="text-xs text-slate-500">{count} / {items.length}</span>
                  </div>
                  <span className="text-slate-400 text-xs">{isExpanded ? "−" : "+"}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic px-2 py-1">Geen items in canvas</p>
                    ) : (
                      items.map((item) => {
                        const isSelected = selected[type.table]?.has(item.id);
                        return (
                          <label
                            key={item.id}
                            data-testid={`coupling-item-${type.table}-${item.id}`}
                            data-selected={isSelected ? "true" : "false"}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${
                              isSelected ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => toggle(type.table, item.id)}
                              className="rounded"
                            />
                            <span className="flex-1 truncate">{item.name}</span>
                            {isSelected && <Check size={12} className="text-emerald-600" />}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500">
            <strong>{totalSelected}</strong> koppeling{totalSelected === 1 ? "" : "en"} geselecteerd
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              data-testid="coupling-modal-cancel"
              className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Annuleer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-testid="coupling-modal-save"
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-colors ${
                saving
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent-hover)]"
              }`}
            >
              {saving ? "Opslaan…" : "Bewaar koppelingen"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
