/**
 * VeranderorganisatieView — sub-tab 1.3 (11.M MVP).
 *
 * RFC-005 §6: rich-text canvas-config (vo_change_approach) +
 * business_units + value_teams + schets-upload PNG/JPG.
 *
 * MVP-scope: rich-text textarea + BU + VT-lijsten. Schets-upload-flow
 * deferred (vereist Supabase Storage-bucket-config).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";
import DossierAiButton from "./DossierAiButton";

export default function VeranderorganisatieView({ canvasId, hasUploads, hasIndexedChunks, uploadsProcessing }) {
  const { label: appLabel } = useAppConfig();
  const [changeApproach, setChangeApproach] = useState("");
  const [businessUnits, setBusinessUnits] = useState([]);
  const [valueTeams, setValueTeams] = useState([]);
  const [newBuName, setNewBuName] = useState("");
  const [newVtName, setNewVtName] = useState("");
  const [savingApproach, setSavingApproach] = useState(false);
  const [improvingCa, setImprovingCa] = useState(false);
  const [buAiBusy, setBuAiBusy] = useState(false);
  const [vtAiBusy, setVtAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const loadAll = useCallback(async () => {
    if (!canvasId) return;
    const [{ data: ca }, { data: bus }, { data: vts }] = await Promise.all([
      svc.getChangeApproach(canvasId),
      svc.listBusinessUnits(canvasId),
      svc.listValueTeams(canvasId),
    ]);
    setChangeApproach(ca?.text_md || "");
    setBusinessUnits(bus || []);
    setValueTeams(vts || []);
  }, [canvasId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveApproach() {
    setSavingApproach(true);
    await svc.setChangeApproach(canvasId, changeApproach);
    setSavingApproach(false);
  }

  async function addBu() {
    if (!newBuName.trim()) return;
    await svc.createBusinessUnit({ canvas_id: canvasId, name: newBuName.trim() });
    setNewBuName(""); loadAll();
  }
  async function addVt() {
    if (!newVtName.trim()) return;
    await svc.createValueTeam({ canvas_id: canvasId, name: newVtName.trim() });
    setNewVtName(""); loadAll();
  }

  async function improveChangeApproachAi() {
    if (improvingCa || !changeApproach.trim()) return;
    setImprovingCa(true); setAiNote(null);
    const { data, meta, error } = await svc.improveChangeApproach(canvasId);
    setImprovingCa(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (meta?.after) { setChangeApproach(meta.after); setAiNote("Veranderaanpak verbeterd door AI"); }
  }

  async function extractBusinessUnitsAi() {
    if (buAiBusy) return;
    setBuAiBusy(true); setAiNote(null);
    const { data, meta, error } = await svc.extractFromDossier(canvasId, "business_units");
    setBuAiBusy(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (!data || data.length === 0) { setAiNote(meta?.note || "Geen BU's in dossier"); return; }
    setAiNote(`${data.length} draft business unit${data.length === 1 ? "" : "s"} toegevoegd`);
    loadAll();
  }
  async function extractValueTeamsAi() {
    if (vtAiBusy) return;
    setVtAiBusy(true); setAiNote(null);
    const { data, meta, error } = await svc.extractFromDossier(canvasId, "value_teams");
    setVtAiBusy(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (!data || data.length === 0) { setAiNote(meta?.note || "Geen value teams in dossier"); return; }
    setAiNote(`${data.length} draft value team${data.length === 1 ? "" : "s"} toegevoegd`);
    loadAll();
  }
  async function acceptBuDraft(id) { await svc.updateBusinessUnit(id, { is_draft: false }); loadAll(); }
  async function acceptVtDraft(id) { await svc.updateValueTeam(id, { is_draft: false }); loadAll(); }

  return (
    <div data-testid="veranderorganisatie-view" className="p-6 space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Veranderaanpak</h3>
          <button
            type="button"
            onClick={improveChangeApproachAi}
            disabled={improvingCa || !changeApproach.trim()}
            data-testid="vo-improve-change-approach"
            className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
              improvingCa || !changeApproach.trim()
                ? "text-slate-400 cursor-not-allowed opacity-60"
                : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            }`}
            title={!changeApproach.trim() ? "Vul eerst initiële tekst in" : undefined}
          >
            {improvingCa ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            Verbeter met AI
          </button>
        </div>
        <textarea
          value={changeApproach}
          onChange={(e) => setChangeApproach(e.target.value)}
          onBlur={saveApproach}
          rows={5}
          placeholder="Beschrijf de veranderaanpak in ~400 tekens…"
          data-testid="vo-change-approach"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
        />
        {savingApproach && <p className="text-[10px] text-slate-400 mt-1">opslaan…</p>}
      </section>
      {aiNote && <div data-testid="vo-ai-note" className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">{aiNote}</div>}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Business units ({businessUnits.length})</h3>
          <DossierAiButton
            onClick={extractBusinessUnitsAi}
            busy={buAiBusy}
            hasUploads={hasUploads}
            hasIndexedChunks={hasIndexedChunks}
            uploadsProcessing={uploadsProcessing}
            label="Genereer BU's vanuit dossier"
            testIdSuffix="bu-extract"
          />
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newBuName}
            onChange={(e) => setNewBuName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addBu(); }}
            placeholder="Business unit naam…"
            data-testid="vo-bu-add-input"
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button type="button" onClick={addBu} className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded">
            {appLabel("processen.knop.bu.toevoegen", "+ Business unit")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {businessUnits.map((b) => (
            <div key={b.id} data-testid={`vo-bu-${b.id}`} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded text-sm">
              <span className="flex-1 text-slate-800">{b.name}</span>
              <button type="button" onClick={async () => { await svc.deleteBusinessUnit(b.id); loadAll(); }} className="text-slate-400 hover:text-red-600" aria-label="Verwijder">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Value teams ({valueTeams.length})</h3>
          <DossierAiButton
            onClick={extractValueTeamsAi}
            busy={vtAiBusy}
            hasUploads={hasUploads}
            hasIndexedChunks={hasIndexedChunks}
            uploadsProcessing={uploadsProcessing}
            label="Genereer teams vanuit dossier"
            testIdSuffix="vt-extract"
          />
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newVtName}
            onChange={(e) => setNewVtName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addVt(); }}
            placeholder="Value team naam…"
            data-testid="vo-vt-add-input"
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button type="button" onClick={addVt} className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded">
            {appLabel("processen.knop.team.toevoegen", "+ Value team")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {valueTeams.map((v) => (
            <div key={v.id} data-testid={`vo-vt-${v.id}`} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded text-sm">
              <span className="flex-1 text-slate-800">{v.name}</span>
              <button type="button" onClick={async () => { await svc.deleteValueTeam(v.id); loadAll(); }} className="text-slate-400 hover:text-red-600" aria-label="Verwijder">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-4 text-xs text-slate-400 italic">
        Schets-upload (PNG/JPG max 5MB) komt in 11.M follow-up (Supabase Storage bucket-config).
      </section>
    </div>
  );
}
