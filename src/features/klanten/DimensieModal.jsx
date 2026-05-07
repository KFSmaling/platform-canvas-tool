/**
 * DimensieModal — create + edit voor cd_dimensions.
 *
 * Mode-prop:
 *   - "create" → archetype-dropdown actief, naam + omschrijving leeg
 *   - "edit"   → archetype-dropdown DISABLED (datamodel-impact, zie F3 finding),
 *                naam + omschrijving prefilled, header-titel "Dimensie bewerken"
 *
 * UX-consistency-principe (findings F3): wat via UI-dialoog gemaakt is, moet
 * ook via UI-dialoog gewijzigd kunnen worden — niet via Admin.
 *
 * Props:
 *   - mode: "create" | "edit"
 *   - dimension: bestaand dimension-object (verplicht voor edit)
 *   - onClose()
 *   - onSave({ archetype, name, description }) → async, returnt { error: null|Error }
 *
 * In edit-mode bevat de payload nog steeds archetype (read-only door
 * disabled-input) zodat de save-handler één signature heeft.
 */

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

// Archetype-opties: enabled (MVP) + disabled (later)
const ARCHETYPE_OPTIONS = [
  { value: "klantsegment", label: "Klantsegment", enabled: true,
    placeholder: "bijv. Klantsegmenten of Doelgroepen of Markten" },
  { value: "propositie",   label: "Propositie",   enabled: true,
    placeholder: "bijv. Proposities of Diensten of Productlijnen" },
  { value: "kanaal",       label: "Kanaal",       enabled: true,
    placeholder: "bijv. Kanalen of Distributie of Touchpoints" },
  { value: "regio",          label: "Regio",          enabled: false },
  { value: "behoefte",       label: "Behoefte (JTBD)", enabled: false },
  { value: "merk",           label: "Merk",           enabled: false },
  { value: "gedragspatroon", label: "Gedragspatroon", enabled: false },
  { value: "klantreis",      label: "Klantreis",      enabled: false },
  { value: "anders",         label: "Anders, namelijk…", enabled: false },
];

const NAME_MAX = 100;
const DESC_MAX = 500;

export default function DimensieModal({ mode = "create", dimension = null, onClose, onSave }) {
  const { label: appLabel } = useAppConfig();
  const isEdit = mode === "edit";

  const [archetype, setArchetype]     = useState(dimension?.archetype ?? "");
  const [name, setName]               = useState(dimension?.name ?? "");
  const [description, setDescription] = useState(dimension?.description ?? "");
  const [saving, setSaving]           = useState(false);
  const [errMsg, setErrMsg]           = useState(null);

  const selectedOption = useMemo(
    () => ARCHETYPE_OPTIONS.find(o => o.value === archetype),
    [archetype]
  );

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX;
  const archetypeValid = archetype && selectedOption?.enabled;
  const canSubmit = nameValid && archetypeValid && !saving;

  const disabledTooltip = appLabel("klanten.archetype.disabled.tooltip", "komt in latere sprint");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrMsg(null);
    const { error } = await onSave({
      archetype,
      name: trimmedName,
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErrMsg(error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  const headerLabel = isEdit
    ? appLabel("klanten.dimensie.edit.titel", "Dimensie bewerken")
    : appLabel("klanten.dimensie.create.titel", "Nieuwe dimensie");

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-[var(--color-primary)]">{headerLabel}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label
              htmlFor="dim-create-archetype"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.dimensie.create.archetype.label", "Archetype")}
              {isEdit && (
                <span className="ml-2 text-[9px] font-normal text-slate-400 italic normal-case">
                  {appLabel("klanten.dimensie.edit.archetype.locked", "(niet wijzigbaar — datamodel-impact)")}
                </span>
              )}
            </label>
            <select
              id="dim-create-archetype"
              value={archetype}
              onChange={e => setArchetype(e.target.value)}
              disabled={isEdit}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--color-accent)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              autoFocus={!isEdit}
            >
              <option value="">{appLabel("klanten.dimensie.create.archetype.placeholder", "Kies een archetype…")}</option>
              {ARCHETYPE_OPTIONS.map(opt => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={!opt.enabled}
                  title={opt.enabled ? undefined : disabledTooltip}
                >
                  {opt.label}{opt.enabled ? "" : " (komt in latere sprint)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="dim-create-naam"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.dimensie.create.naam.label", "Naam")}
            </label>
            <input
              id="dim-create-naam"
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, NAME_MAX))}
              placeholder={selectedOption?.placeholder || appLabel("klanten.dimensie.create.naam.placeholder", "bijv. Klantsegmenten of Doelgroepen")}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={NAME_MAX}
              autoFocus={isEdit}
            />
            {!nameValid && name.length > 0 && (
              <p className="text-[10px] text-red-600 mt-1">{appLabel("klanten.dimensie.create.error.naam_leeg", "Naam is verplicht")}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="dim-create-omschrijving"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.dimensie.create.omschrijving.label", "Omschrijving (optioneel)")}
            </label>
            <textarea
              id="dim-create-omschrijving"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, DESC_MAX))}
              placeholder={appLabel("klanten.dimensie.create.omschrijving.placeholder", "korte tenant-beschrijving van deze dimensie")}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={DESC_MAX}
            />
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.knop.item.annuleren", "Annuleren")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan…" : appLabel("klanten.knop.item.opslaan", "Opslaan")}
          </button>
        </div>
      </div>
    </div>
  );
}
