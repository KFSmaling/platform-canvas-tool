/**
 * BesturingView — sub-tab 1.4 (11.M MVP).
 *
 * RFC-005 §7: sturingsmodel (4 enum) + toelichting + coordination_aspects
 * (multi-select) + control-processen-lijst met 3 types.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";
import DossierAiButton from "./DossierAiButton";

const STEERING_OPTS = [
  { id: "hierarchisch",           labelKey: "processen.steering.hierarchisch",           fallback: "Hiërarchisch" },
  { id: "functioneel",            labelKey: "processen.steering.functioneel",            fallback: "Functioneel" },
  { id: "klant_leverancier",      labelKey: "processen.steering.klant_leverancier",      fallback: "Klant-leverancier" },
  { id: "tijdelijke_coordinatie", labelKey: "processen.steering.tijdelijke_coordinatie", fallback: "Tijdelijke coördinatie" },
];

const COORD_ASPECTS = ["input", "output", "werkwijzen", "kennis", "vaardigheden", "technieken"];

const CONTROL_TYPES = [
  { id: "jaarplan",       labelKey: "processen.control_type.jaarplan",       fallback: "Jaarplan",       color: "bg-amber-100 text-amber-800 border-amber-300" },
  { id: "mis_rapportage", labelKey: "processen.control_type.mis_rapportage", fallback: "MIS-rapportage", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { id: "bijsturing",     labelKey: "processen.control_type.bijsturing",     fallback: "Bijsturing",     color: "bg-red-100 text-red-800 border-red-300" },
];

export default function BesturingView({ canvasId, hasUploads, hasIndexedChunks, uploadsProcessing }) {
  const { label: appLabel } = useAppConfig();
  const [steering, setSteering] = useState({ model: null, text_md: "", coordination_aspects: [] });
  const [controlProcesses, setControlProcesses] = useState([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("jaarplan");
  const [improvingSteering, setImprovingSteering] = useState(false);
  const [cpAiBusy, setCpAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const loadAll = useCallback(async () => {
    if (!canvasId) return;
    const [{ data: s }, { data: cps }] = await Promise.all([
      svc.getSteeringModel(canvasId),
      svc.listControlProcesses(canvasId),
    ]);
    if (s) setSteering({ model: s.model, text_md: s.text_md || "", coordination_aspects: s.coordination_aspects || [] });
    setControlProcesses(cps || []);
  }, [canvasId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function pickModel(model) {
    const next = { ...steering, model };
    setSteering(next);
    await svc.setSteeringModel(canvasId, next);
  }
  async function saveText() {
    if (!steering.model) return; // CHECK-constraint vereist model
    await svc.setSteeringModel(canvasId, steering);
  }
  async function toggleAspect(asp) {
    const has = steering.coordination_aspects.includes(asp);
    const next = {
      ...steering,
      coordination_aspects: has
        ? steering.coordination_aspects.filter(a => a !== asp)
        : [...steering.coordination_aspects, asp],
    };
    setSteering(next);
    if (next.model) await svc.setSteeringModel(canvasId, next);
  }
  async function addControl() {
    if (!newName.trim()) return;
    await svc.createControlProcess({ canvas_id: canvasId, name: newName.trim(), control_type: newType });
    setNewName(""); loadAll();
  }

  async function improveSteeringAi() {
    if (improvingSteering || !steering.text_md.trim()) return;
    setImprovingSteering(true); setAiNote(null);
    const { data, meta, error } = await svc.improveSteering(canvasId);
    setImprovingSteering(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (meta?.after) { setSteering({ ...steering, text_md: meta.after }); setAiNote("Toelichting verbeterd door AI"); }
  }
  async function extractControlAi() {
    if (cpAiBusy) return;
    setCpAiBusy(true); setAiNote(null);
    const { data, meta, error } = await svc.extractFromDossier(canvasId, "control_processes");
    setCpAiBusy(false);
    if (error) { setAiNote(`Fout: ${error.message}`); return; }
    if (!data || data.length === 0) { setAiNote(meta?.note || "Geen control-processen in dossier"); return; }
    setAiNote(`${data.length} draft control-proces${data.length === 1 ? "" : "sen"} toegevoegd`);
    loadAll();
  }
  async function acceptCpDraft(id) { await svc.updateControlProcess(id, { is_draft: false }); loadAll(); }

  return (
    <div data-testid="besturing-view" className="p-6 space-y-6">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sturingsmodel</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STEERING_OPTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pickModel(opt.id)}
              data-testid={`gov-steering-${opt.id}`}
              data-active={steering.model === opt.id ? "true" : "false"}
              className={`px-3 py-3 rounded border text-xs font-medium text-left ${
                steering.model === opt.id
                  ? "bg-category-processen text-white border-category-processen"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              {appLabel(opt.labelKey, opt.fallback)}
            </button>
          ))}
        </div>
      </section>

      {steering.model && (
        <>
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Toelichting</h3>
              <button
                type="button"
                onClick={improveSteeringAi}
                disabled={improvingSteering || !steering.text_md.trim()}
                data-testid="gov-improve-steering"
                className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
                  improvingSteering || !steering.text_md.trim()
                    ? "text-slate-400 cursor-not-allowed opacity-60"
                    : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                }`}
              >
                {improvingSteering ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                Verbeter met AI
              </button>
            </div>
            <textarea
              value={steering.text_md}
              onChange={(e) => setSteering({ ...steering, text_md: e.target.value })}
              onBlur={saveText}
              rows={3}
              placeholder="Korte toelichting bij het gekozen sturingsmodel…"
              data-testid="gov-text"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
            />
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coördinatie-aspecten</h3>
            <div className="flex flex-wrap gap-2">
              {COORD_ASPECTS.map((asp) => {
                const active = steering.coordination_aspects.includes(asp);
                return (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => toggleAspect(asp)}
                    data-testid={`gov-aspect-${asp}`}
                    data-active={active ? "true" : "false"}
                    className={`px-3 py-1 rounded-full border text-xs capitalize ${
                      active
                        ? "bg-category-processen text-white border-category-processen"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {asp}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Control-processen ({controlProcesses.length})</h3>
          <DossierAiButton
            onClick={extractControlAi}
            busy={cpAiBusy}
            hasUploads={hasUploads}
            hasIndexedChunks={hasIndexedChunks}
            uploadsProcessing={uploadsProcessing}
            label="Genereer vanuit dossier"
            testIdSuffix="control-extract"
          />
        </div>
        {aiNote && <p data-testid="gov-ai-note" className="text-[10px] text-emerald-700 mb-2">{aiNote}</p>}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Control-proces naam…"
            data-testid="gov-control-add-input"
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            data-testid="gov-control-add-type"
            className="px-2 py-1 text-sm border border-slate-300 rounded"
          >
            {CONTROL_TYPES.map(t => (
              <option key={t.id} value={t.id}>{appLabel(t.labelKey, t.fallback)}</option>
            ))}
          </select>
          <button type="button" onClick={addControl} className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded">
            {appLabel("processen.knop.control.toevoegen", "+ Control-proces")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {controlProcesses.map((c) => {
            const type = CONTROL_TYPES.find(t => t.id === c.control_type);
            return (
              <div key={c.id} data-testid={`gov-control-${c.id}`} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 truncate">{c.name}</p>
                  {type && <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[9px] uppercase ${type.color}`}>{appLabel(type.labelKey, type.fallback)}</span>}
                </div>
                <button type="button" onClick={async () => { await svc.deleteControlProcess(c.id); loadAll(); }} className="text-slate-400 hover:text-red-600 ml-2" aria-label="Verwijder">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
