/**
 * IntentModal — create + edit voor cd_improvement_intents (RFC-001 §2.7).
 *
 * UX-consistency-anker: PijnpuntModal + DimensieModal (eenzelfde-component-
 * twee-modes-pattern uit findings F3). Bewerk/Verwijder/Markeer-paradigma
 * uit F9 — geen Accept/Reject-terminologie.
 *
 * Props:
 *   - mode: "create" | "edit"
 *   - intent: bestaand intent-object (verplicht voor edit)
 *   - onClose()
 *   - onSave({ title, intentMd, vanuit }) → async, retourneert { error: null|Error }
 *
 * Validaties (server-side ook):
 *   - title: 1-100 tekens
 *   - intent_md: 50-2000 tekens (markdown, whitespace-pre-wrap render)
 *
 * `vanuit` is read-only in modal — automatisch gevuld bij promote, niet bij
 * consultant-eigen create (chips weergeven uit prop indien aanwezig).
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const TITLE_MIN = 1;
const TITLE_MAX = 100;
const INTENT_MIN = 50;
const INTENT_MAX = 2000;

export default function IntentModal({
  mode = "create",
  intent = null,
  onClose,
  onSave,
}) {
  const { label: appLabel } = useAppConfig();
  const isEdit = mode === "edit";

  const [title, setTitle]       = useState(intent?.title ?? "");
  const [intentMd, setIntentMd] = useState(intent?.intent_md ?? "");
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState(null);

  const trimmedTitle  = title.trim();
  const trimmedIntent = intentMd.trim();
  const titleValid  = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX;
  const intentValid = trimmedIntent.length >= INTENT_MIN && intentMd.length <= INTENT_MAX;
  const canSubmit   = titleValid && intentValid && !saving;

  const vanuit = Array.isArray(intent?.vanuit) ? intent.vanuit : [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrMsg(null);
    const { error } = await onSave({
      title:    trimmedTitle,
      intentMd: trimmedIntent,
      vanuit:   intent?.vanuit ?? null,
    });
    setSaving(false);
    if (error) {
      setErrMsg(error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  const headerLabel = isEdit
    ? appLabel("klanten.verbeterrichting.modal.edit.titel", "Verbeterrichting bewerken")
    : appLabel("klanten.verbeterrichting.modal.create.titel", "Nieuwe verbeterrichting");

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-[var(--color-primary)]">{headerLabel}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label
              htmlFor="intent-titel"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.verbeterrichting.veld.titel.label", "Titel")}
            </label>
            <input
              id="intent-titel"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder={appLabel("klanten.verbeterrichting.veld.titel.placeholder", "Korte titel (\"SME-bediening structureel versterken\")")}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={TITLE_MAX}
              autoFocus
              data-testid="intent-veld-titel"
            />
            {!titleValid && title.length > 0 && (
              <p className="text-[10px] text-red-600 mt-1">
                {appLabel("klanten.verbeterrichting.error.titel_leeg", "Titel is verplicht (1-100 tekens)")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="intent-md"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.verbeterrichting.veld.intent.label", "Beschrijving")}
            </label>
            <textarea
              id="intent-md"
              rows={8}
              value={intentMd}
              onChange={e => setIntentMd(e.target.value.slice(0, INTENT_MAX))}
              placeholder={appLabel("klanten.verbeterrichting.veld.intent.placeholder", "Verscherp het patroon tot een concrete verbeterrichting. Wat moet er gebeuren en waarom?")}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={INTENT_MAX}
              data-testid="intent-veld-md"
            />
            <div className="flex items-center justify-between mt-1">
              {!intentValid && intentMd.length > 0 && intentMd.length < INTENT_MIN && (
                <p className="text-[10px] text-red-600">
                  {appLabel("klanten.verbeterrichting.error.intent_leeg", "Beschrijving is verplicht (minimaal 50 tekens)")}
                </p>
              )}
              <span className="text-[10px] text-slate-400 ml-auto">{intentMd.length}/{INTENT_MAX}</span>
            </div>
          </div>

          {vanuit.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">
                {appLabel("klanten.verbeterrichting.veld.vanuit.label", "Vanuit")}
              </p>
              <p className="text-[10px] text-slate-500 italic mb-2">
                {appLabel("klanten.verbeterrichting.veld.vanuit.helper", "Verwijst naar bron-patronen of context — automatisch gevuld bij promote.")}
              </p>
              <div className="flex flex-wrap gap-1">
                {vanuit.map((v, i) => (
                  <span
                    key={i}
                    className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {String(v).length > 80 ? String(v).slice(0, 79) + "…" : v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.verbeterrichting.knop.annuleren", "Annuleren")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="intent-modal-opslaan"
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan…" : appLabel("klanten.verbeterrichting.knop.opslaan", "Opslaan")}
          </button>
        </div>
      </div>
    </div>
  );
}
