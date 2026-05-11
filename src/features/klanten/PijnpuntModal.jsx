/**
 * PijnpuntModal — create + edit voor cd_pain_points met multi-select-
 * koppelingen aan items binnen het canvas (RFC-001 §2.3 + §2.4).
 *
 * UX-consistency-principe (findings F3): wat via UI-dialoog gemaakt is,
 * moet ook via UI-dialoog gewijzigd kunnen worden — eén component, twee modes.
 *
 * Props:
 *   - mode: "create" | "edit"
 *   - painPoint: bestaand pain-object (verplicht voor edit)
 *   - initialCouplings: array van { target_table, target_id } (verplicht voor edit, default [])
 *   - dimensions: array van { id, name, archetype, ... } voor het hele canvas
 *   - items: array van { id, dimension_id, name, ... } voor het hele canvas
 *   - onClose()
 *   - onSave({ textMd, couplings: [{target_table, target_id}] }) → async, returnt { error: null|Error }
 *
 * Géén koppeling aanvinken → pijnpunt wordt overstijgend (`is_floating`
 * via DB-trigger).
 */

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const TEXT_MAX = 5000;

function couplingKey(c) {
  return `${c.target_table}:${c.target_id}`;
}

export default function PijnpuntModal({
  mode = "create",
  painPoint = null,
  initialCouplings = [],
  dimensions = [],
  items = [],
  onClose,
  onSave,
  // Stap 11.K.2 F16 — canonical-delete: alleen in edit-mode getoond.
  onDelete,
}) {
  const { label: appLabel } = useAppConfig();
  const isEdit = mode === "edit";

  const [textMd, setTextMd] = useState(painPoint?.text_md ?? "");
  // Set van "target_table:target_id" strings voor de huidige selectie
  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(initialCouplings.map(couplingKey))
  );
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  // F16: inline-bevestiging-state.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!isEdit || !onDelete || !painPoint?.id || deleting) return;
    setDeleting(true);
    setErrMsg(null);
    const { error } = await onDelete(painPoint.id);
    setDeleting(false);
    if (error) {
      setErrMsg(error.message || "Verwijderen mislukt");
      setConfirmingDelete(false);
      return;
    }
    onClose();
  }

  const trimmed = textMd.trim();
  const textValid = trimmed.length > 0 && trimmed.length <= TEXT_MAX;
  const canSubmit = textValid && !saving;

  // Items gegroepeerd per dimensie voor de checkbox-lijst
  const dimensionsWithItems = useMemo(() => {
    return dimensions.map(dim => ({
      dimension: dim,
      items: items.filter(it => it.dimension_id === dim.id),
    }));
  }, [dimensions, items]);

  function toggleKey(table, id) {
    setSelectedKeys(prev => {
      const key = couplingKey({ target_table: table, target_id: id });
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isChecked(table, id) {
    return selectedKeys.has(couplingKey({ target_table: table, target_id: id }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrMsg(null);
    const couplings = Array.from(selectedKeys).map(key => {
      const [target_table, target_id] = key.split(":");
      return { target_table, target_id };
    });
    const { error } = await onSave({ textMd: trimmed, couplings });
    setSaving(false);
    if (error) {
      setErrMsg(error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  const headerLabel = isEdit
    ? appLabel("klanten.pijnpunt.edit.titel", "Pijnpunt bewerken")
    : appLabel("klanten.pijnpunt.create.titel", "Nieuw pijnpunt");

  const isFloating = selectedKeys.size === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-[var(--color-primary)]">{headerLabel}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label
              htmlFor="pijn-text"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.pijnpunt.create.tekst.label", "Pijnpunt-tekst")}
            </label>
            <textarea
              id="pijn-text"
              rows={4}
              value={textMd}
              onChange={e => setTextMd(e.target.value.slice(0, TEXT_MAX))}
              placeholder={appLabel("klanten.pijnpunt.create.tekst.placeholder", "Beschrijf de waarneming of het pijnpunt — bron mag in de tekst (markdown)")}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={TEXT_MAX}
              autoFocus
            />
            {!textValid && textMd.length > 0 && (
              <p className="text-[10px] text-red-600 mt-1">{appLabel("klanten.pijnpunt.create.error.tekst_leeg", "Tekst is verplicht")}</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-2">
              {appLabel("klanten.pijnpunt.create.koppelingen.label", "Koppelingen aan items (optioneel)")}
            </p>
            <p className="text-[10px] text-slate-500 italic mb-3">
              {appLabel("klanten.pijnpunt.create.koppelingen.helper", "Géén selectie = overstijgend pijnpunt (geen specifieke item-koppeling)")}
            </p>

            {dimensions.length === 0 && (
              <p className="text-xs text-slate-400 italic">Nog geen dimensies of items in dit canvas — pijnpunt wordt overstijgend.</p>
            )}

            <div className="space-y-3 max-h-72 overflow-auto border border-slate-200 rounded p-3 bg-slate-50">
              {dimensionsWithItems.map(({ dimension, items: dimItems }) => (
                <div key={dimension.id}>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    {dimension.name} · {dimension.archetype}
                  </p>
                  {dimItems.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic ml-3">geen items</p>
                  ) : (
                    <div className="space-y-1">
                      {dimItems.map(it => {
                        const checked = isChecked("cd_items", it.id);
                        return (
                          <label
                            key={it.id}
                            className="flex items-center gap-2 ml-3 text-[12px] cursor-pointer hover:text-[var(--color-primary)]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleKey("cd_items", it.id)}
                              data-testid={`koppeling-${it.id}`}
                              className="accent-[var(--color-accent)]"
                            />
                            <span>{it.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {isFloating && trimmed.length > 0 && (
              <p className="text-[10px] text-amber-700 italic mt-2">
                {appLabel("klanten.pijnpunt.create.overstijgend.warning", "Wordt opgeslagen als overstijgend pijnpunt (geen koppeling)")}
              </p>
            )}
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        {/* Footer: F16 inline-bevestigingsdialog vervangt normale knoppen-rij
            wanneer confirmingDelete=true. */}
        {confirmingDelete ? (
          <div
            data-testid="pijnpunt-modal-delete-confirm"
            className="flex items-center gap-3 px-6 py-3 border-t border-red-200 bg-red-50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-800">
                {appLabel("klanten.modal.delete.confirm.titel", "Permanent verwijderen?")}
              </p>
              <p className="text-[11px] text-red-700">
                {appLabel("klanten.modal.delete.confirm.tekst", "Dit kan niet ongedaan gemaakt worden.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              data-testid="pijnpunt-modal-delete-confirm-nee"
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              {appLabel("klanten.modal.delete.confirm.nee", "Annuleer")}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              data-testid="pijnpunt-modal-delete-confirm-ja"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
            >
              {deleting ? "Bezig…" : appLabel("klanten.modal.delete.confirm.ja", "Verwijder definitief")}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                data-testid="pijnpunt-modal-delete"
                className="mr-auto px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {appLabel("klanten.knop.pijnpunt.verwijderen", "Verwijderen")}
              </button>
            )}
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
        )}
      </div>
    </div>
  );
}
