/**
 * LijnorganisatieView — sub-tab 1.2 (11.M MVP).
 *
 * RFC-005 §5: doorsnede (4 enum) canvas-config + afdelingen-lijst +
 * proces×afdeling-matrix (M:N).
 *
 * MVP-scope: doorsnede-radio + afdelingen-lijst CRUD. Matrix-render
 * deferred naar 11.M-follow-up.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check, X as XIcon } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";
import DossierAiButton from "./DossierAiButton";

const DOORSNEDE_OPTS = [
  { id: "functioneel",    labelKey: "processen.doorsnede.functioneel",    fallback: "Functioneel" },
  { id: "productgericht", labelKey: "processen.doorsnede.productgericht", fallback: "Productgericht" },
  { id: "geografisch",    labelKey: "processen.doorsnede.geografisch",    fallback: "Geografisch" },
  { id: "marktgericht",   labelKey: "processen.doorsnede.marktgericht",   fallback: "Marktgericht" },
];

export default function LijnorganisatieView({ canvasId, hasUploads, hasIndexedChunks, uploadsProcessing }) {
  const { label: appLabel } = useAppConfig();
  const [doorsnede, setDoorsnede] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const loadAll = useCallback(async () => {
    if (!canvasId) return;
    const [{ data: dRow }, { data: deps }] = await Promise.all([
      svc.getStructuringDoorsnede(canvasId),
      svc.listDepartments(canvasId),
    ]);
    setDoorsnede(dRow?.doorsnede || null);
    setDepartments(deps || []);
  }, [canvasId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function pickDoorsnede(opt) {
    await svc.setStructuringDoorsnede(canvasId, opt);
    setDoorsnede(opt);
  }

  async function addDept() {
    if (!newName.trim()) return;
    await svc.createDepartment({ canvas_id: canvasId, name: newName.trim() });
    setNewName(""); setAdding(false); loadAll();
  }

  async function removeDept(id) {
    await svc.deleteDepartment(id);
    loadAll();
  }

  async function extractDepartmentsAi() {
    if (aiBusy) return;
    setAiBusy(true); setAiNote(null);
    const { data, meta, error } = await svc.extractFromDossier(canvasId, "departments");
    setAiBusy(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (!data || data.length === 0) { setAiNote(meta?.note || "Geen afdelingen in dossier"); return; }
    setAiNote(`${data.length} draft-afdeling${data.length === 1 ? "" : "en"} toegevoegd`);
    loadAll();
  }
  async function acceptDeptDraft(id) { await svc.updateDepartment(id, { is_draft: false }); loadAll(); }

  return (
    <div data-testid="lijnorganisatie-view" className="p-6 space-y-6">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Doorsnede</h3>
        <div className="flex gap-2">
          {DOORSNEDE_OPTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pickDoorsnede(opt.id)}
              data-testid={`lijn-doorsnede-${opt.id}`}
              data-active={doorsnede === opt.id ? "true" : "false"}
              className={`px-3 py-2 rounded border text-xs font-medium ${
                doorsnede === opt.id
                  ? "bg-category-processen text-white border-category-processen"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              {appLabel(opt.labelKey, opt.fallback)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Afdelingen ({departments.length})</h3>
          <div className="flex items-center gap-3">
            <DossierAiButton
              onClick={extractDepartmentsAi}
              busy={aiBusy}
              hasUploads={hasUploads}
              hasIndexedChunks={hasIndexedChunks}
              uploadsProcessing={uploadsProcessing}
              label="Genereer vanuit dossier"
              testIdSuffix="departments-extract"
            />
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              data-testid="lijn-dept-add-toggle"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              <Plus size={10} />
              {appLabel("processen.knop.afdeling.toevoegen", "+ Afdeling")}
            </button>
          </div>
        </div>
        {aiNote && <p data-testid="lijn-ai-note" className="text-[10px] text-emerald-700 mb-2">{aiNote}</p>}
        {adding && (
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addDept(); if (e.key === "Escape") setAdding(false); }}
              placeholder="Afdeling-naam…"
              autoFocus
              data-testid="lijn-dept-add-input"
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button type="button" onClick={addDept} className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded hover:bg-[var(--color-accent-hover)]">
              Toevoegen
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {departments.map((d) => (
            <div
              key={d.id}
              data-testid={`lijn-dept-${d.id}`}
              data-draft={d.is_draft ? "true" : "false"}
              className={`flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded text-sm ${d.is_draft ? "opacity-70" : "hover:border-slate-300"}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-slate-800 truncate">{d.name}</span>
                {d.is_draft && <span className="shrink-0 px-1.5 py-0.5 text-[9px] uppercase rounded bg-emerald-100 text-emerald-800">draft</span>}
              </div>
              {d.is_draft ? (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => acceptDeptDraft(d.id)} className="text-emerald-600 hover:text-emerald-800" aria-label="Accepteer"><Check size={14} /></button>
                  <button type="button" onClick={() => removeDept(d.id)} className="text-slate-400 hover:text-red-600" aria-label="Verwijder"><XIcon size={14} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => removeDept(d.id)} className="text-slate-400 hover:text-red-600" aria-label="Verwijder"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
        {departments.length === 0 && !adding && (
          <p className="text-xs text-slate-400 italic">Nog geen afdelingen toegevoegd.</p>
        )}
      </section>

      <section className="border-t border-slate-200 pt-4 text-xs text-slate-400 italic">
        Proces × Afdeling-matrix komt in 11.M follow-up.
      </section>
    </div>
  );
}
