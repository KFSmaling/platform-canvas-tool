/**
 * BedrijfsprocessenView — sub-tab 1.1 (11.M MVP).
 *
 * RFC-005 §4: 3 archetypes (Besturend/Primair/Ondersteunend),
 * naam + omschrijving + archetype_data jsonb (5 velden) + processtappen (max 7).
 *
 * MVP-scope: lijst per archetype + +Proces-knop met inline naam-input.
 * Volledige archetype-velden-editor + processtappen-chevron komt in
 * 11.M-follow-up (C8 detail-uitwerking).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check, X as XIcon } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";
import DossierAiButton from "./DossierAiButton";

const ARCHETYPES = [
  { id: "besturend",     labelKey: "processen.archetype.besturend",     fallback: "Besturend",     color: "bg-green-100 text-green-800" },
  { id: "primair",       labelKey: "processen.archetype.primair",       fallback: "Primair",       color: "bg-emerald-100 text-emerald-800" },
  { id: "ondersteunend", labelKey: "processen.archetype.ondersteunend", fallback: "Ondersteunend", color: "bg-lime-100 text-lime-800" },
];

export default function BedrijfsprocessenView({ canvasId, hasUploads, hasIndexedChunks, uploadsProcessing }) {
  const { label: appLabel } = useAppConfig();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingFor, setAddingFor] = useState(null);
  const [newName, setNewName] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const load = useCallback(async () => {
    if (!canvasId) return;
    setLoading(true);
    const { data, error: err } = await svc.listProcesses(canvasId);
    setLoading(false);
    if (err) { setError(err); return; }
    setProcesses(data || []);
  }, [canvasId]);

  useEffect(() => {
    const activeCanvasId = canvasId;
    let cancelled = false;
    setProcesses([]);
    (async () => {
      const { data, error: err } = await svc.listProcesses(activeCanvasId);
      if (cancelled || activeCanvasId !== canvasId) return;
      if (err) setError(err); else setProcesses(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canvasId]);

  async function handleAdd(archetype) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { error: err } = await svc.createProcess({
      canvas_id: canvasId, archetype, name: trimmed,
    });
    if (err) { setError(err); return; }
    setNewName(""); setAddingFor(null);
    load();
  }

  async function handleDelete(id) {
    const { error: err } = await svc.deleteProcess(id);
    if (err) { setError(err); return; }
    load();
  }

  async function handleAiExtract() {
    if (aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    const { data, meta, error: err } = await svc.extractFromDossier(canvasId, "processes");
    setAiBusy(false);
    if (err) { setError(err); return; }
    if (!data || data.length === 0) {
      setAiNote(meta?.note || "AI vond geen processen in dossier");
      return;
    }
    setAiNote(`${data.length} draft-proces${data.length === 1 ? "" : "sen"} toegevoegd vanuit dossier`);
    load();
  }

  async function handleAcceptDraft(id) {
    // Eenvoudig: update is_draft=false via standaard updateProcess
    const { error: err } = await svc.updateProcess(id, { is_draft: false });
    if (err) { setError(err); return; }
    load();
  }
  async function handleRejectDraft(id) {
    const { error: err } = await svc.deleteProcess(id);
    if (err) { setError(err); return; }
    load();
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Laden…</div>;

  return (
    <div data-testid="bedrijfsprocessen-view" className="p-6 space-y-4">
      <div className="flex items-center justify-end">
        <DossierAiButton
          onClick={handleAiExtract}
          busy={aiBusy}
          hasUploads={hasUploads}
          hasIndexedChunks={hasIndexedChunks}
          uploadsProcessing={uploadsProcessing}
          label="Genereer processen vanuit dossier"
          testIdSuffix="processes-extract"
        />
      </div>
      {aiNote && (
        <div data-testid="bp-ai-note" className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          {aiNote}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error.message}
        </div>
      )}
      {processes.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          {appLabel("processen.empty.geen_processen", "Nog geen bedrijfsprocessen toegevoegd. Begin met een primair klant-tot-klant-proces.")}
        </p>
      )}

      {ARCHETYPES.map((arch) => {
        const procsInArch = processes.filter(p => p.archetype === arch.id);
        return (
          <div
            key={arch.id}
            data-testid={`bp-archetype-${arch.id}`}
            className="border border-slate-200 rounded-lg bg-white"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${arch.color}`}>
                  {appLabel(arch.labelKey, arch.fallback)}
                </span>
                <span className="text-[10px] text-slate-400">{procsInArch.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setAddingFor(addingFor === arch.id ? null : arch.id)}
                data-testid={`bp-add-${arch.id}`}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              >
                <Plus size={10} />
                {appLabel("processen.knop.proces.toevoegen", "+ Proces")}
              </button>
            </div>

            {addingFor === arch.id && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(arch.id); if (e.key === "Escape") setAddingFor(null); }}
                  placeholder="Naam van proces…"
                  autoFocus
                  data-testid={`bp-add-input-${arch.id}`}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={() => handleAdd(arch.id)}
                  data-testid={`bp-add-submit-${arch.id}`}
                  className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded hover:bg-[var(--color-accent-hover)]"
                >
                  Toevoegen
                </button>
              </div>
            )}

            <div className="p-2">
              {procsInArch.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-2 py-1">Geen processen in deze categorie</p>
              ) : (
                procsInArch.map((p) => (
                  <div
                    key={p.id}
                    data-testid={`bp-process-${p.id}`}
                    data-draft={p.is_draft ? "true" : "false"}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded text-sm ${
                      p.is_draft ? "opacity-70 bg-slate-50/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="flex-1 text-slate-800 truncate">{p.name}</span>
                      {p.is_draft && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          dossier-suggestie
                        </span>
                      )}
                    </div>
                    {p.is_draft ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAcceptDraft(p.id)}
                          data-testid={`bp-accept-draft-${p.id}`}
                          className="text-emerald-600 hover:text-emerald-800"
                          aria-label="Accepteer draft"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectDraft(p.id)}
                          data-testid={`bp-reject-draft-${p.id}`}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Verwijder draft"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        data-testid={`bp-delete-${p.id}`}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Verwijder"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
