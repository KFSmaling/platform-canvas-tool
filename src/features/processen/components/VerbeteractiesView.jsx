/**
 * VerbeteractiesView — fase 3 (11.M MVP + 11.M.1 block-2).
 *
 * RFC-005 §9: po_improvement_intents 2-staps state-machine (concept/definitief
 * + dismissed-flag) via append-only audit-events (po_improvement_intent_events).
 *
 * Coverage-banner bovenaan body (Designer-Principe 5, RFC-005 §9.3):
 *   - 0 pijnpunten → banner verbergen + empty-state
 *   - ≥1 pijnpunt → toon open/covered/motivated_no_action-counters
 *
 * Pull-model (Designer-Principe 7): GEEN "Naar Roadmap"-knop. Roadmap-werkblad
 * (RFC-003 / 11.L) queryt zelf current_status='definitief'.
 *
 * 11.M.1 block-2: 6-tab-pattern (5 AI-generaties + Eigen) — analoog Klanten
 * RFC-007. Per AI-tab een genereer-knop die generateImprovementsAi belt.
 * Bron-pijnpunten-tags onder elke AI-gegenereerde verbeteractie.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, ArrowUp, ArrowDown, X, Sparkles, Loader2 } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";
import * as svc from "../services/processen.service";

const SOURCE_TABS = [
  { id: "ai_algemeen",      labelKey: "processen.source.ai_algemeen",      fallback: "Algemeen",       isAi: true },
  { id: "ai_cluster",       labelKey: "processen.source.ai_cluster",       fallback: "Cluster",        isAi: true },
  { id: "ai_paradox",       labelKey: "processen.source.ai_paradox",       fallback: "Paradox",        isAi: true },
  { id: "ai_positionering", labelKey: "processen.source.ai_positionering", fallback: "Positionering",  isAi: true },
  { id: "ai_overstijgend",  labelKey: "processen.source.ai_overstijgend",  fallback: "Overstijgend",   isAi: true },
  { id: "eigen",            labelKey: "processen.source.eigen",            fallback: "Eigen",          isAi: false },
];

export default function VerbeteractiesView({ canvasId }) {
  const { label: appLabel } = useAppConfig();
  const [intents, setIntents] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [pains, setPains] = useState([]);
  const [intentLinks, setIntentLinks] = useState({}); // intent_id → [pain_point_id]
  const [activeSource, setActiveSource] = useState("ai_algemeen");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIntent, setNewIntent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const load = useCallback(async () => {
    if (!canvasId) return;
    setLoading(true);
    const [{ data: intentsData }, { data: counts }, { data: painsData }] = await Promise.all([
      svc.listImprovementIntents(canvasId),
      svc.fetchCoverageAggregate(canvasId),
      svc.listPainPoints(canvasId),
    ]);
    setIntents(intentsData || []);
    setCoverage(counts || null);
    setPains(painsData || []);
    // Note: link-loading via aparte service-call zou ideaal zijn — for MVP block-2
    // gebruiken we de pain-list voor naam-resolutie en latere expand.
    setLoading(false);
  }, [canvasId]);

  useEffect(() => { load(); }, [load]);

  async function addEigen() {
    if (!newTitle.trim() || newIntent.trim().length < 50) {
      setError(new Error("Titel + intent_md (min 50 tekens) verplicht"));
      return;
    }
    const { error: err } = await svc.createImprovementIntent({
      canvas_id: canvasId,
      title: newTitle.trim(),
      intent_md: newIntent.trim(),
      source_type: "eigen",
    });
    if (err) { setError(err); return; }
    setNewTitle(""); setNewIntent(""); setAdding(false); setError(null);
    load();
  }

  async function transition(intentId, eventType) {
    await svc.transitionIntentState(intentId, eventType);
    load();
  }

  async function generateAiForSource(sourceType) {
    if (aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    setError(null);
    const { data, meta, error: err } = await svc.generateImprovementsAi(canvasId, sourceType);
    setAiBusy(false);
    if (err) { setError(err); return; }
    if (!data || data.length === 0) {
      setAiNote(meta?.note || "AI vond geen verbeteracties voor deze generatie");
      return;
    }
    setAiNote(`${data.length} verbeteractie${data.length === 1 ? "" : "s"} gegenereerd · ${meta?.bron_pain_point_links || 0} bron-koppeling${(meta?.bron_pain_point_links || 0) === 1 ? "" : "en"}`);
    load();
  }

  const concepts   = intents.filter(i => i.current_status === "concept");
  const definitief = intents.filter(i => i.current_status === "definitief");

  // Filter per actieve source-tab
  const filterBySource = (list) =>
    activeSource === "eigen"
      ? list.filter(i => i.source_type === "eigen")
      : list.filter(i => i.source_type === activeSource);

  const conceptsForTab   = filterBySource(concepts);
  const definitiefForTab = filterBySource(definitief);

  if (loading) return <div className="p-6 text-sm text-slate-500">Laden…</div>;

  // Per source: count voor pill
  const countsPerSource = {};
  for (const tab of SOURCE_TABS) {
    countsPerSource[tab.id] = intents.filter(i => i.source_type === tab.id).length;
  }

  const activeIsAi = SOURCE_TABS.find(t => t.id === activeSource)?.isAi;

  return (
    <div data-testid="processen-verbeteracties-view" className="p-6 space-y-4">
      {/* Coverage-banner: verbergen bij 0 pijnpunten (Designer-keuze §11 #3) */}
      {coverage && coverage.total > 0 ? (
        <div
          data-testid="processen-coverage-banner"
          className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between"
        >
          <div className="text-xs">
            <p className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">
              {appLabel("processen.coverage.banner.titel", "Coverage-overzicht")}
            </p>
            <p className="text-slate-600 mt-1">
              {coverage.open} open · {coverage.covered} geadresseerd · {coverage.motivated_no_action} bewust niet
            </p>
          </div>
          {coverage.open > 0 && (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
              {coverage.open} OPEN
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-400 italic px-3 py-2">
          {appLabel("processen.coverage.banner.empty", "Voeg eerst pijnpunten toe of genereer concepten op basis van inventaris-data")}
        </div>
      )}

      {/* 6-tab-pattern source-types */}
      <div
        data-testid="verbeteracties-source-tabs"
        className="flex items-center gap-1 border-b border-slate-200 -mx-6 px-6"
      >
        {SOURCE_TABS.map((tab, idx) => {
          // Visueel scheidingslijn vóór Eigen-tab (na 5 AI-tabs)
          const separator = !tab.isAi && idx > 0;
          return (
            <React.Fragment key={tab.id}>
              {separator && <span className="text-slate-300 mx-1" aria-hidden="true">|</span>}
              <button
                type="button"
                onClick={() => { setActiveSource(tab.id); setAiNote(null); setError(null); }}
                data-testid={`verbeteracties-tab-${tab.id}`}
                data-active={activeSource === tab.id ? "true" : "false"}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSource === tab.id
                    ? "border-category-processen text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.isAi && <Sparkles size={10} />}
                {appLabel(tab.labelKey, tab.fallback)}
                {countsPerSource[tab.id] > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600">
                    {countsPerSource[tab.id]}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Action-bar: AI-tabs → genereer-knop; Eigen-tab → +Verbeteractie */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span><strong className="text-slate-800">{conceptsForTab.length}</strong> concept</span>
          <span>·</span>
          <span><strong className="text-slate-800">{definitiefForTab.length}</strong> definitief</span>
        </div>
        {activeIsAi ? (
          <button
            type="button"
            onClick={() => generateAiForSource(activeSource)}
            disabled={aiBusy || pains.length === 0}
            data-testid={`verbeteracties-generate-${activeSource}`}
            title={pains.length === 0 ? "Voeg eerst pijnpunten toe" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
              aiBusy || pains.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-[var(--color-accent)] text-[var(--color-primary)] hover:bg-[var(--color-accent-hover)]"
            }`}
          >
            {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Genereer met AI
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            data-testid="verbeteracties-add-toggle"
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            <Plus size={12} />
            {appLabel("processen.knop.intent.toevoegen", "+ Verbeteractie")}
          </button>
        )}
      </div>

      {aiNote && (
        <div data-testid="verbeteracties-ai-note" className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          {aiNote}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error.message}
        </div>
      )}

      {/* Inline-form voor eigen-actie (alleen op Eigen-tab) */}
      {!activeIsAi && adding && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titel (1-100 tekens)"
            maxLength={100}
            autoFocus
            data-testid="verbeteracties-add-titel"
            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
          />
          <textarea
            value={newIntent}
            onChange={(e) => setNewIntent(e.target.value)}
            placeholder="Beschrijving (50-2000 tekens, markdown ondersteund)"
            rows={4}
            data-testid="verbeteracties-add-intent"
            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900">
              Annuleer
            </button>
            <button type="button" onClick={addEigen} data-testid="verbeteracties-add-submit" className="px-3 py-1 text-xs font-bold bg-[var(--color-accent)] text-[var(--color-primary)] rounded">
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {/* Concept-lijst */}
      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          {appLabel("processen.intent.status.concept", "Concept")} ({conceptsForTab.length})
        </h4>
        {conceptsForTab.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Geen concepten in deze categorie</p>
        ) : (
          <div className="space-y-2">
            {conceptsForTab.map((i) => (
              <IntentCard key={i.id} intent={i} pains={pains}
                onMakeDefinitief={() => transition(i.id, "made_definitief")}
                onDismiss={() => transition(i.id, "dismissed")}
                appLabel={appLabel}
              />
            ))}
          </div>
        )}
      </section>

      {/* Definitief-lijst */}
      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          {appLabel("processen.intent.status.definitief", "Definitief")} ({definitiefForTab.length})
        </h4>
        {definitiefForTab.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Geen definitieve verbeteracties in deze categorie</p>
        ) : (
          <div className="space-y-2">
            {definitiefForTab.map((i) => (
              <IntentCard key={i.id} intent={i} pains={pains}
                variant="definitief"
                onBackToConcept={() => transition(i.id, "back_to_concept")}
                appLabel={appLabel}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pull-model info: GEEN "Naar Roadmap"-knop */}
      {definitiefForTab.length > 0 && (
        <p data-testid="processen-pull-model-info" className="text-[10px] text-slate-400 italic border-t border-slate-200 pt-3 mt-4">
          {appLabel("processen.info.pull_model", "Roadmap-werkblad haalt definitieve acties op uit alle werkbladen")}
        </p>
      )}
    </div>
  );
}

// ─── IntentCard sub-component ─────────────────────────────────────────────
function IntentCard({ intent, pains, variant = "concept", onMakeDefinitief, onDismiss, onBackToConcept, appLabel }) {
  const isAi = intent.source_type !== "eigen";
  const bgBorder = variant === "concept" ? "border-amber-200" : "border-blue-200";
  const pillCls  = variant === "concept" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800";

  return (
    <div data-testid={`intent-${variant}-${intent.id}`} className={`bg-white border ${bgBorder} rounded p-3`}>
      <div className="flex items-start justify-between mb-1 gap-2">
        <p className="text-sm font-bold text-slate-800 flex-1 min-w-0">{intent.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {isAi && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] uppercase tracking-wider rounded border border-emerald-200">
              <Sparkles size={8} />
              {appLabel(`processen.source.${intent.source_type}`, intent.source_type.replace("ai_", ""))}
            </span>
          )}
          <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded ${pillCls}`}>
            {appLabel(`processen.intent.status.${variant}`, variant)}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-600 whitespace-pre-line">{intent.intent_md}</p>
      {/* Bron-pijnpunten-tags (block-2 B6) — visueel hint dat er bron-pijnpunten zijn.
          Volledige lijst via aparte fetch zou ideaal zijn; voor MVP-block-2 tonen we
          alleen aan dat AI-bron met counter is. */}
      {isAi && (
        <p data-testid={`intent-${intent.id}-ai-meta`} className="mt-1 text-[10px] text-slate-400 italic">
          AI-gegenereerd · bron uit pijnpunten-analyse
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {variant === "concept" ? (
          <>
            <button type="button" onClick={onMakeDefinitief}
              data-testid={`intent-make-definitief-${intent.id}`}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700">
              <ArrowUp size={10} />
              {appLabel("processen.knop.maak_definitief", "Maak definitief")}
            </button>
            <button type="button" onClick={onDismiss}
              data-testid={`intent-dismiss-${intent.id}`}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-red-600">
              <X size={10} />
              {appLabel("processen.knop.wuif_weg", "Wuif weg")}
            </button>
          </>
        ) : (
          <button type="button" onClick={onBackToConcept}
            data-testid={`intent-back-concept-${intent.id}`}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-800">
            <ArrowDown size={10} />
            {appLabel("processen.knop.terug_naar_concept", "Terug naar concept")}
          </button>
        )}
      </div>
    </div>
  );
}
