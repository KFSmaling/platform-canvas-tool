/**
 * PijnpuntenView — fase 2 (11.M MVP, cross-cutting).
 *
 * RFC-005 §8: po_pain_points cross-cutting met polymorphic couplings naar
 * 5 entiteit-types uit fase 1 (pr_processes / org_departments /
 * vo_business_units / vo_value_teams / gov_control_processes).
 *
 * MVP-scope: pijnpunten-lijst + +Pijnpunt-flow. Multi-koppeling-UI + tag-render
 * deferred (vereist details over 5 entiteit-types tegelijk laden + tag-style).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check, X as XIcon } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";
import DossierAiButton from "./DossierAiButton";

export default function PijnpuntenView({ canvasId, hasUploads, hasIndexedChunks, uploadsProcessing }) {
  const { label: appLabel } = useAppConfig();
  const [pains, setPains] = useState([]);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const load = useCallback(async () => {
    if (!canvasId) return;
    setLoading(true);
    const { data } = await svc.listPainPoints(canvasId);
    setPains(data || []);
    setLoading(false);
  }, [canvasId]);

  useEffect(() => { load(); }, [load]);

  async function addPain() {
    if (!newText.trim()) return;
    await svc.createPainPoint({ canvas_id: canvasId, text_md: newText.trim() });
    setNewText(""); setAdding(false); load();
  }

  async function extractPainsAi() {
    if (aiBusy) return;
    setAiBusy(true); setAiNote(null);
    const { data, meta, error } = await svc.extractFromDossier(canvasId, "pain_points");
    setAiBusy(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (!data || data.length === 0) { setAiNote(meta?.note || "Geen pijnpunten in dossier"); return; }
    setAiNote(`${data.length} draft-pijnpunt${data.length === 1 ? "" : "en"} toegevoegd vanuit dossier`);
    load();
  }
  async function acceptPainDraft(id) {
    await svc.updatePainPoint(id, { is_draft: false });
    load();
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Laden…</div>;

  return (
    <div data-testid="processen-pijnpunten-view" className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Pijnpunten ({pains.length})</h3>
        <div className="flex items-center gap-3">
          <DossierAiButton
            onClick={extractPainsAi}
            busy={aiBusy}
            hasUploads={hasUploads}
            hasIndexedChunks={hasIndexedChunks}
            uploadsProcessing={uploadsProcessing}
            label="Genereer vanuit dossier"
            testIdSuffix="pain-points-extract"
          />
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            data-testid="pijnpunten-add-toggle"
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            <Plus size={12} />
            {appLabel("processen.knop.pijnpunt.toevoegen", "+ Pijnpunt")}
          </button>
        </div>
      </div>
      {aiNote && <div data-testid="pijnpunten-ai-note" className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">{aiNote}</div>}

      {adding && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 flex gap-2">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Beschrijf het pijnpunt…"
            rows={2}
            autoFocus
            data-testid="pijnpunten-add-input"
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button type="button" onClick={addPain} className="self-start px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded">
            Toevoegen
          </button>
        </div>
      )}

      {pains.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          {appLabel("processen.empty.geen_pijnpunten", "Nog geen pijnpunten geïdentificeerd. Voeg ze handmatig toe of genereer ze vanuit het dossier.")}
        </p>
      ) : (
        <div className="space-y-2">
          {pains.map((p, idx) => (
            <div
              key={p.id}
              data-testid={`pijnpunt-rij-${p.id}`}
              data-coverage={p.coverage_status}
              data-draft={p.is_draft ? "true" : "false"}
              className={`flex items-start gap-3 px-4 py-3 bg-white border border-slate-200 rounded hover:border-slate-300 ${p.is_draft ? "opacity-70" : ""}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800">{p.text_md}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    p.coverage_status === "covered" ? "bg-green-100 text-green-800" :
                    p.coverage_status === "motivated_no_action" ? "bg-amber-100 text-amber-800" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {appLabel(`processen.coverage.${p.coverage_status}`, p.coverage_status)}
                  </span>
                  {p.is_floating && (
                    <span className="text-[9px] text-slate-400">overstijgend (geen koppeling)</span>
                  )}
                  {p.is_draft && (
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">dossier-suggestie</span>
                  )}
                </div>
              </div>
              {p.is_draft ? (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => acceptPainDraft(p.id)} data-testid={`pijnpunt-accept-${p.id}`} className="text-emerald-600 hover:text-emerald-800" aria-label="Accepteer"><Check size={14} /></button>
                  <button type="button" onClick={async () => { await svc.deletePainPoint(p.id); load(); }} className="text-slate-400 hover:text-red-600" aria-label="Verwijder"><XIcon size={14} /></button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => { await svc.deletePainPoint(p.id); load(); }}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Verwijder"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 italic border-t border-slate-200 pt-3 mt-4">
        Multi-koppeling-UI naar fase 1 entiteit-types komt in 11.M follow-up. Coverage-banner zit op fase 3.
      </p>
    </div>
  );
}
