/**
 * ItemModal — archetype-velden formulier voor cd_items create/edit.
 *
 * Props:
 *   - item: bestaand item (edit) of null (create)
 *   - dimension: { id, archetype, name }
 *   - onClose()
 *   - onSave(itemData) — async, retourneert { error? }
 *
 * Per CLAUDE.md sectie 4.2: await + error-check + loading state tot
 * server-bevestiging. Geen optimistic update.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import { getSchemaFor } from "./archetypeSchemas";

export default function ItemModal({ item, dimension, onClose, onSave }) {
  const { label: appLabel } = useAppConfig();
  const isEdit = !!item;
  const schema = getSchemaFor(dimension?.archetype);

  const [name, setName]               = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [archetypeData, setArchetypeData] = useState(item?.archetype_data ?? {});
  const [saving, setSaving]   = useState(false);
  const [errMsg, setErrMsg]   = useState(null);

  function setField(key, value) {
    setArchetypeData(d => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErrMsg("Naam is verplicht");
      return;
    }
    setSaving(true);
    setErrMsg(null);
    const { error } = await onSave({
      name: name.trim(),
      description: description.trim() || null,
      archetype_data: archetypeData,
    });
    setSaving(false);
    if (error) {
      setErrMsg(error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-[var(--color-primary)]">
              {isEdit
                ? appLabel("klanten.modal.item.titel.edit", "Item bewerken")
                : appLabel("klanten.modal.item.titel.add", "Nieuw item")}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">
              {dimension?.name} · archetype: {dimension?.archetype}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label htmlFor="item-naam" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Naam</label>
            <input
              id="item-naam"
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus required
            />
          </div>
          <div>
            <label htmlFor="item-omschrijving" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Korte omschrijving</label>
            <input
              id="item-omschrijving"
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="optioneel"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Archetype-velden</p>
            {schema.length === 0 && (
              <p className="text-xs text-slate-500 italic">Geen velden gedefinieerd voor archetype "{dimension?.archetype}"</p>
            )}
            {schema.map(field => (
              <div key={field.key}>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {appLabel(field.labelKey, field.fallback)}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={archetypeData[field.key] ?? ""}
                    onChange={e => setField(field.key, e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  />
                ) : (
                  <input
                    type="text"
                    value={archetypeData[field.key] ?? ""}
                    onChange={e => setField(field.key, e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  />
                )}
              </div>
            ))}
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
          <button
            type="button" onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.knop.item.annuleren", "Annuleren")}
          </button>
          <button
            type="button" onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
          >
            {saving ? "Opslaan…" : appLabel("klanten.knop.item.opslaan", "Opslaan")}
          </button>
        </div>
      </div>
    </div>
  );
}
