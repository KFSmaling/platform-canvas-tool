/**
 * ProcesModal — archetype-velden-editor voor pr_processes (11.M.1 block-3a D2).
 *
 * RFC-005 §4.1 — pr_processes.archetype_data jsonb met 5 velden:
 *   - strategisch_label (text)
 *   - volwassenheid (text, vrij; consultant kan "1-5" of "Ad-hoc/Beheerst/Beheerd" etc.)
 *   - pijnpunten (textarea)
 *   - kritieke_afhankelijkheden (textarea)
 *   - bewuste_inrichting (textarea)
 *
 * Plus name + description als top-level kolommen + AI-knop (fillProcessFieldsFromDossier).
 *
 * Anker: KlantenWerkblad ItemModal (T4 + 11.K + U-cleanup A6).
 *
 * Per CLAUDE.md §4.2: await + error-check + loading-state. Geen optimistic updates.
 *
 * Props:
 *  - process: bestaand proces (edit-mode; create gebeurt via BedrijfsprocessenView inline-flow)
 *  - onClose(): sluit modal
 *  - onSave(patch): async → svc.updateProcess(id, patch) — caller verzorgt reload
 *  - onFillFieldsFromDossier(processId): async → fillProcessFieldsFromDossier
 *  - hasIndexedChunks, uploadsProcessing: voor AI-knop-state
 */

import React, { useState } from "react";
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";

const ARCHETYPE_FIELDS = [
  { key: "strategisch_label",       label: "Strategisch label",         type: "text",     helper: "Korte strategische karakterisering (bv. 'Kern-differentiatie' / 'Hygiene')" },
  { key: "volwassenheid",           label: "Volwassenheid",             type: "text",     helper: "Bv. 1-5 score of label (Ad-hoc / Beheerst / Geoptimaliseerd)" },
  { key: "pijnpunten",              label: "Pijnpunten",                type: "textarea", helper: "Kort: knelpunten in dit proces (uitgebreide fase 2 elders)" },
  { key: "kritieke_afhankelijkheden", label: "Kritieke afhankelijkheden", type: "textarea", helper: "Welke andere processen / afdelingen / systemen zijn onmisbaar?" },
  { key: "bewuste_inrichting",      label: "Bewuste inrichting",        type: "textarea", helper: "Beleidskeuze: 'we kiezen voor X omdat Y'" },
];

export default function ProcesModal({
  process,
  onClose,
  onSave,
  onFillFieldsFromDossier,
  hasUploads = false,
  hasIndexedChunks = false,
  uploadsProcessing = false,
}) {
  const { label: appLabel } = useAppConfig();
  const isEdit = !!process?.id;

  const [name, setName]               = useState(process?.name ?? "");
  const [description, setDescription] = useState(process?.description ?? "");
  const [archetypeData, setArchetypeData] = useState(process?.archetype_data ?? {});
  const [saving, setSaving]   = useState(false);
  const [filling, setFilling] = useState(false);
  const [errMsg, setErrMsg]   = useState(null);
  const [fillNote, setFillNote] = useState(null); // { type: success|empty, text }

  function setField(key, value) {
    setArchetypeData(d => ({ ...d, [key]: value }));
  }

  const aiDisabled = !isEdit || !hasIndexedChunks || uploadsProcessing || filling;
  const aiTooltip = !isEdit
    ? "Bewaar eerst het proces"
    : !hasUploads ? "Upload eerst documenten"
    : uploadsProcessing ? "Documenten worden nog verwerkt"
    : null;

  async function handleFillFromDossier() {
    if (!onFillFieldsFromDossier || !process?.id || filling) return;
    setFilling(true);
    setFillNote(null);
    setErrMsg(null);
    const { data: updated, meta, error } = await onFillFieldsFromDossier(process.id);
    setFilling(false);
    if (error) {
      setErrMsg(error.message || "Velden invullen mislukt");
      return;
    }
    if (updated?.archetype_data) {
      setArchetypeData(updated.archetype_data);
    }
    const proposed = meta?.proposed_fields || {};
    const count = Object.keys(proposed).length;
    setFillNote(count === 0
      ? { type: "empty",   text: meta?.note || "AI vond geen onderbouwing voor lege velden" }
      : { type: "success", text: `${count} veld${count === 1 ? "" : "en"} ingevuld vanuit dossier` });
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrMsg("Naam is verplicht");
      return;
    }
    setSaving(true);
    setErrMsg(null);
    const patch = {
      name: trimmedName,
      description: description.trim() || null,
      archetype_data: archetypeData,
    };
    const result = await onSave(patch);
    setSaving(false);
    if (result?.error) {
      setErrMsg(result.error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  return (
    <div
      data-testid="proces-modal"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {process?.archetype || "Proces"}
            </p>
            <h2 className="text-sm font-bold text-slate-800">
              {isEdit ? "Bewerk proces" : "Nieuw proces"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            data-testid="proces-modal-close"
            aria-label="Sluit"
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Naam + omschrijving */}
          <div>
            <label htmlFor="proces-name" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Naam</label>
            <input
              id="proces-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="proces-modal-name"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus required
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="proces-desc" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Omschrijving</label>
            <input
              id="proces-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="proces-modal-description"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="optioneel"
            />
          </div>

          {/* Archetype-velden header met AI-knop */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Archetype-velden</p>
              {onFillFieldsFromDossier && (
                <button
                  type="button"
                  onClick={handleFillFromDossier}
                  disabled={aiDisabled}
                  data-testid="proces-modal-fill-fields"
                  title={aiTooltip || undefined}
                  className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
                    aiDisabled
                      ? "text-slate-400 cursor-not-allowed opacity-60"
                      : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                  }`}
                >
                  {filling ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Velden invullen vanuit dossier
                </button>
              )}
            </div>

            {fillNote && (
              <div
                data-testid="proces-modal-fill-note"
                data-fill-type={fillNote.type}
                className={`flex items-start gap-2 px-3 py-2 mb-3 text-xs rounded border ${
                  fillNote.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                {fillNote.type === "success"
                  ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  : <AlertCircle  size={14} className="mt-0.5 shrink-0" />}
                <p className="flex-1">{fillNote.text}</p>
                <button
                  type="button"
                  onClick={() => setFillNote(null)}
                  aria-label="Sluit melding"
                  className="shrink-0 text-current opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* 5 jsonb-velden */}
            <div className="space-y-3">
              {ARCHETYPE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label
                    htmlFor={`proces-archetype-${f.key}`}
                    className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                  >
                    {f.label}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={`proces-archetype-${f.key}`}
                      value={archetypeData[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      rows={2}
                      placeholder={f.helper}
                      data-testid={`proces-archetype-${f.key}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  ) : (
                    <input
                      id={`proces-archetype-${f.key}`}
                      type="text"
                      value={archetypeData[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.helper}
                      data-testid={`proces-archetype-${f.key}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {errMsg && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {errMsg}
            </div>
          )}
        </form>

        <footer className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            data-testid="proces-modal-cancel"
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            data-testid="proces-modal-save"
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-colors ${
              saving || !name.trim()
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent-hover)]"
            }`}
          >
            {saving ? "Opslaan…" : "Bewaar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
