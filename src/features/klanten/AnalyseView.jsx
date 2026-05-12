/**
 * AnalyseView — fase 3 root-component (Klanten & Dienstverlening werkblad).
 *
 * Layout (anker prototype 2026-05-06 regel 217-240):
 *   1. Intro-tekst + 4 AI-affordance-knoppen (cluster/paradox/positionering/overstijgend)
 *   2. Counter "X geaccepteerd · Y weggewuifd"
 *   3. Suggestion-list (cards met current_status IN open/edited/refined),
 *      child-suggestions onder parent met indent
 *   4. "+ eigen patroon"-knop onderaan
 *
 * Modals (geconditioneerd op interne state):
 *   - SuggestionEditModal voor refine-edit
 *   - RefineDeeperModal voor refine-deeper
 *   - EigenPatroonModal voor consultant-eigen patroon
 *
 * State-discipline (CLAUDE.md §4):
 *   - suggestions/reload als props (Stap 11.G.4 F11-fix: single source of
 *     truth in KlantenWerkblad — AnalyseView heeft geen eigen hook-instance)
 *   - Acties checken `error` expliciet (4.2)
 *   - Geen optimistic update — wacht op service-bevestiging dan reload()
 *   - canvasIdRef voor async callbacks
 *
 * Props:
 *   - canvasId
 *   - dimensions, items, painPoints, couplings  (uit KlantenWerkblad)
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import AiIconButton from "../../shared/components/AiIconButton";
import * as klantenService from "./services/klanten.service";
import SuggestionCard from "./SuggestionCard";
import SuggestionEditModal from "./SuggestionEditModal";
import RefineDeeperModal from "./RefineDeeperModal";
import EigenPatroonModal from "./EigenPatroonModal";
import CollapseSection from "./CollapseSection";
import { AI_ACTION_TYPES } from "./patternTypeStyles";

const OPEN_STATUSES    = new Set(["open", "edited", "refined"]);
const MARKED_STATUSES  = new Set(["accepted", "promoted"]);
const DELETED_STATUSES = new Set(["rejected"]);

const AI_BUTTONS = [
  { action: "cluster",       labelKey: "klanten.analyse.knop.cluster",       labelFallback: "Cluster zoeken",       helperKey: "klanten.analyse.knop.cluster.helper",       helperFallback: "Groepen pijnpunten met gemeenschappelijke oorzaak" },
  { action: "paradox",       labelKey: "klanten.analyse.knop.paradox",       labelFallback: "Paradox zoeken",       helperKey: "klanten.analyse.knop.paradox.helper",       helperFallback: "Pijnpunten die elkaar tegenspreken" },
  { action: "positionering", labelKey: "klanten.analyse.knop.positionering", labelFallback: "Positionering toetsen", helperKey: "klanten.analyse.knop.positionering.helper", helperFallback: "Wie zijn we voor wie — zwakke plekken" },
  { action: "overstijgend",  labelKey: "klanten.analyse.knop.overstijgend",  labelFallback: "Overstijgend zoeken",  helperKey: "klanten.analyse.knop.overstijgend.helper",  helperFallback: "Capabilities die het hele werkblad raken" },
];

export default function AnalyseView({
  canvasId,
  dimensions = [],
  items = [],
  painPoints = [],
  couplings = [],
  // Stap 11.G.4 F11-fix: suggestions/loading/error/reload komen nu als props
  // van KlantenWerkblad (single source of truth). AnalyseView heeft GEEN eigen
  // hook-instance meer — voorkomt stale data in RapportView na edit-acties.
  suggestions,
  loading,
  error,
  reload,
  // Stap 11.H: intents alleen-lezen om gepromote suggestions te detecteren
  // + promote-callback naar parent (modal-state in KlantenWerkblad).
  intents = [],
  onPromoteSuggestion,
}) {
  const { label: appLabel } = useAppConfig();

  // canvasIdRef voor async callbacks (CLAUDE.md §4.4)
  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  // Action-state per suggestion (per-id om button-disable te kunnen tonen)
  const [busyAction, setBusyAction] = useState(null); // { action, id? } of null
  const [globalError, setGlobalError] = useState(null);

  // Modal-state
  const [editModalSuggestion, setEditModalSuggestion] = useState(null);
  const [deeperModalSuggestion, setDeeperModalSuggestion] = useState(null);
  const [eigenModalOpen, setEigenModalOpen] = useState(false);

  const hasPainPoints = (painPoints || []).length > 0;

  // Stap 11.G.3 F8: drie buckets — open (in lijst), gemarkeerd (collapse),
  // verwijderd (collapse). Counter blijft tonen totaal accepted + rejected
  // voor backwards-compat met bestaande UI-tekst.
  const { openList, markedList, deletedList, acceptedCount, rejectedCount } = useMemo(() => {
    const list = suggestions || [];
    const open    = list.filter(s => OPEN_STATUSES.has(s.current_status));
    const marked  = list.filter(s => MARKED_STATUSES.has(s.current_status));
    const deleted = list.filter(s => DELETED_STATUSES.has(s.current_status));
    return {
      openList:      open,
      markedList:    marked,
      deletedList:   deleted,
      acceptedCount: marked.length,
      rejectedCount: deleted.length,
    };
  }, [suggestions]);

  // Stap 11.H: set van suggestion-ids die al gepromoot zijn naar een intent
  // (1:1-relatie via source_suggestion_id). Gebruikt om "Promote"-knop te
  // verbergen op suggestions die al een intent hebben.
  const promotedSuggestionIds = useMemo(
    () => new Set((intents || []).map(i => i.source_suggestion_id).filter(Boolean)),
    [intents]
  );

  // Sorteer suggestions: parents eerst, kinderen direct erna onder hun parent.
  const sortedOpenList = useMemo(() => {
    const byId = new Map(openList.map(s => [s.id, s]));
    const parents = openList.filter(s => !s.parent_id || !byId.has(s.parent_id));
    const childrenByParent = new Map();
    for (const s of openList) {
      if (s.parent_id && byId.has(s.parent_id)) {
        if (!childrenByParent.has(s.parent_id)) childrenByParent.set(s.parent_id, []);
        childrenByParent.get(s.parent_id).push(s);
      }
    }
    const flat = [];
    for (const p of parents) {
      flat.push({ suggestion: p, hasParent: false });
      const kids = childrenByParent.get(p.id) || [];
      for (const k of kids) flat.push({ suggestion: k, hasParent: true });
    }
    return flat;
  }, [openList]);

  // ── AI-affordance-knop click ─────────────────────────────────────────────────
  async function handleAiClick(action) {
    if (!hasPainPoints || busyAction) return;
    setBusyAction({ action });
    setGlobalError(null);
    const { error: genErr } = await klantenService.generatePatternSuggestions({
      canvasId: canvasIdRef.current,
      action,
    });
    setBusyAction(null);
    if (genErr) {
      setGlobalError(genErr);
      return;
    }
    reload();
  }

  // ── Suggestion-card-acties ───────────────────────────────────────────────────
  async function handleAccept(suggestion) {
    if (busyAction) return;
    setBusyAction({ action: "accept", id: suggestion.id });
    setGlobalError(null);
    const { error: actErr } = await klantenService.acceptPatternSuggestion(suggestion.id);
    setBusyAction(null);
    if (actErr) { setGlobalError(actErr); return; }
    reload();
  }

  async function handleReject(suggestion) {
    if (busyAction) return;
    setBusyAction({ action: "reject", id: suggestion.id });
    setGlobalError(null);
    const { error: actErr } = await klantenService.rejectPatternSuggestion(suggestion.id);
    setBusyAction(null);
    if (actErr) { setGlobalError(actErr); return; }
    reload();
  }

  // Stap 11.G.3 F8: un-mark / restore — collapse-sectie-acties.
  async function handleUnMark(suggestion) {
    if (busyAction) return;
    setBusyAction({ action: "unmark", id: suggestion.id });
    setGlobalError(null);
    const { error: actErr } = await klantenService.unmarkPatternSuggestion(suggestion.id);
    setBusyAction(null);
    if (actErr) { setGlobalError(actErr); return; }
    reload();
  }

  async function handleRestore(suggestion) {
    if (busyAction) return;
    setBusyAction({ action: "restore", id: suggestion.id });
    setGlobalError(null);
    const { error: actErr } = await klantenService.restorePatternSuggestion(suggestion.id);
    setBusyAction(null);
    if (actErr) { setGlobalError(actErr); return; }
    reload();
  }

  function handleRefineEdit(suggestion) {
    if (busyAction) return;
    setEditModalSuggestion(suggestion);
  }

  function handleRefineDeeper(suggestion) {
    if (busyAction) return;
    setDeeperModalSuggestion(suggestion);
  }

  // ── Modal-save-handlers ──────────────────────────────────────────────────────
  async function handleEditSave({ textMd }) {
    if (!editModalSuggestion) return { error: new Error("modal context ontbreekt") };
    const { error: putErr } = await klantenService.updatePatternSuggestion(
      editModalSuggestion.id,
      { textMd },
    );
    if (putErr) return { error: putErr };
    reload();
    return { error: null };
  }

  async function handleDeeperSubmit({ refinementFocus }) {
    if (!deeperModalSuggestion) return { error: new Error("modal context ontbreekt") };
    // Kind erft type van parent — pattern_type=parent.pattern_type, behalve
    // bij parent.pattern_type='eigen' (dan default 'cluster' om de AI iets te geven).
    // Server-side validatie laat dit door (zie pattern_suggestions_generate.js
    // open-punt-4-comment).
    const action = deeperModalSuggestion.pattern_type === "eigen"
      ? "cluster"
      : deeperModalSuggestion.pattern_type;
    const { error: genErr } = await klantenService.generatePatternSuggestions({
      canvasId: canvasIdRef.current,
      action,
      parentId: deeperModalSuggestion.id,
      refinementFocus,
    });
    if (genErr) return { error: genErr };
    reload();
    return { error: null };
  }

  async function handleEigenSave({ patternType, textMd, vanuit }) {
    const { error: insErr } = await klantenService.createPatternSuggestion({
      canvasId: canvasIdRef.current,
      patternType,
      textMd,
      scope: "canvas",
      scopeTargetId: null,
      vanuit,
    });
    if (insErr) return { error: insErr };
    reload();
    return { error: null };
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  // Stap 11.G.2 F4-fix: onderscheid initial-load (geen state) van reload
  // (laatste state behouden via usePatternSuggestions). Bij reload tonen we
  // de UI normaal door + inline-spinner naast AI-knoppen i.p.v. spinner-only
  // dat alle UI verbergt.
  const isInitialLoad = loading && suggestions === null;
  const isReloading   = loading && suggestions !== null;

  if (isInitialLoad) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="max-w-md">
          <p className="text-sm text-red-700 font-bold mb-2">{appLabel("klanten.analyse.error.generic", "Genereren mislukt")}</p>
          <p className="text-xs text-slate-600 mb-4">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded"
          >
            {appLabel("klanten.analyse.error.retry", "Opnieuw")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Intro + AI-knoppen */}
      <div className="mb-6">
        <p className="text-[11px] text-slate-500 italic mb-4 max-w-3xl">
          {appLabel("klanten.analyse.helper.intro", "AI doet een eerste pas op je pijnpunten. Per suggestie kies je: markeer als richting, bewerk (eigen tekst), graaf dieper (AI verfijnt), of verwijder.")}
        </p>

        {!hasPainPoints && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded mb-4">
            {appLabel("klanten.analyse.empty.geen_data", "Voeg eerst pijnpunten toe in fase 2 voordat je analyse draait.")}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {AI_BUTTONS.map(btn => {
            const isLoading = busyAction?.action === btn.action;
            return (
              <AiIconButton
                key={btn.action}
                variant="generate"
                loading={isLoading}
                disabled={!hasPainPoints || (!!busyAction && !isLoading)}
                onClick={() => handleAiClick(btn.action)}
                tooltip={appLabel(btn.helperKey, btn.helperFallback)}
                data-testid={`analyse-knop-${btn.action}`}
                label={isLoading
                  ? appLabel("klanten.analyse.loading", "AI denkt na…")
                  : appLabel(btn.labelKey, btn.labelFallback)}
              />
            );
          })}
          {/* F4-fix: inline-spinner tijdens reload — UI blijft staan,
              alleen klein signaal dat vernieuwing loopt. */}
          {isReloading && (
            <Loader2
              size={14}
              data-testid="analyse-inline-spinner"
              className="animate-spin text-slate-400 ml-2"
            />
          )}
        </div>

        {/* F5: per-type helper-tekst onder de AI-knoppen-rij. Concrete uitleg
            wat elk type betekent — voorkomt dat consultant moet gokken. */}
        {hasPainPoints && (
          <ul className="mt-3 space-y-1 text-[11px] text-slate-500 max-w-3xl">
            <li>
              <span className="font-bold text-slate-700">{appLabel("klanten.analyse.type.cluster", "Cluster")}:</span>{" "}
              {appLabel("klanten.analyse.helper.cluster", "Groep pijnpunten die samen wijzen op een capability- of positionering-vraagstuk")}
            </li>
            <li>
              <span className="font-bold text-slate-700">{appLabel("klanten.analyse.type.paradox", "Paradox")}:</span>{" "}
              {appLabel("klanten.analyse.helper.paradox", "Pijnpunten die elkaar conceptueel tegenspreken of waar oplossing van A juist B verergert")}
            </li>
            <li>
              <span className="font-bold text-slate-700">{appLabel("klanten.analyse.type.positionering", "Positionering")}:</span>{" "}
              {appLabel("klanten.analyse.helper.positionering", "Propositie of segment waar pijnpunten wijzen op onduidelijke plek t.o.v. concurrenten")}
            </li>
            <li>
              <span className="font-bold text-slate-700">{appLabel("klanten.analyse.type.overstijgend", "Overstijgend")}:</span>{" "}
              {appLabel("klanten.analyse.helper.overstijgend", "Pijnpunten zonder specifieke koppeling die het hele werkblad raken")}
            </li>
          </ul>
        )}
      </div>

      {/* Counter */}
      <div className="text-[11px] text-slate-500 mb-4" data-testid="analyse-counter">
        <span data-testid="counter-geaccepteerd">{acceptedCount}</span>{" "}
        {appLabel("klanten.analyse.counter.geaccepteerd", "geaccepteerd")}
        {" "}<span className="text-slate-400">{appLabel("klanten.analyse.counter.separator", "·")}</span>{" "}
        <span data-testid="counter-weggewuifd">{rejectedCount}</span>{" "}
        {appLabel("klanten.analyse.counter.weggewuifd", "verwijderd")}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4 flex items-center justify-between">
          <span>{globalError.message || appLabel("klanten.analyse.error.generic", "Genereren mislukt")}</span>
          <button
            type="button"
            onClick={() => { setGlobalError(null); reload(); }}
            className="text-[10px] font-bold uppercase tracking-widest text-red-700 hover:text-red-900 ml-3"
          >
            {appLabel("klanten.analyse.error.retry", "Opnieuw")}
          </button>
        </div>
      )}

      {/* Suggestion-list */}
      <div className="mb-6">
        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-3">
          {appLabel("klanten.analyse.lijst.titel", "Suggesties")}
        </h3>
        {sortedOpenList.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic" data-testid="analyse-lijst-leeg">
            {appLabel("klanten.analyse.lijst.leeg", "Nog geen suggesties — klik een AI-knop hierboven of voeg een eigen patroon toe.")}
          </p>
        ) : (
          <div className="space-y-3">
            {sortedOpenList.map(({ suggestion, hasParent }) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                hasParent={hasParent}
                busy={!!busyAction && busyAction.id === suggestion.id}
                onAccept={handleAccept}
                onRefineEdit={handleRefineEdit}
                onRefineDeeper={handleRefineDeeper}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stap 11.G.3 F8: collapse-secties voor gemarkeerde + verwijderde
          patronen. Geeft consultant zicht op eigen werk + restore-pad.
          Stap 11.H: gemarkeerde patterns krijgen "Promote naar verbeterrichting"-
          knop wanneer ze nog niet gepromoot zijn (geen 1:1-intent bestaat). */}
      {(markedList.length > 0 || deletedList.length > 0) && (
        <div className="mb-6">
          {markedList.length > 0 && (
            <CollapseSection
              title={`${appLabel("klanten.analyse.gemarkeerd.titel", "Gemarkeerd voor verbeteracties")} (${markedList.length})`}
              items={markedList.filter(s => !promotedSuggestionIds.has(s.id))}
              emptyMessage={appLabel("klanten.analyse.gemarkeerd.leeg", "Nog niets gemarkeerd")}
              actionLabel={appLabel("klanten.analyse.gemarkeerd.terug", "Terug naar voorraad")}
              onAction={handleUnMark}
              secondaryActionLabel={onPromoteSuggestion
                ? appLabel("klanten.actie.promote", "Promote naar verbeteractie")
                : null}
              onSecondaryAction={onPromoteSuggestion || null}
              testIdPrefix="marked"
              busyId={busyAction?.action === "unmark" ? busyAction.id : null}
            />
          )}
          {deletedList.length > 0 && (
            <CollapseSection
              title={`${appLabel("klanten.analyse.verwijderd.titel", "Verwijderd")} (${deletedList.length})`}
              items={deletedList}
              emptyMessage={appLabel("klanten.analyse.verwijderd.leeg", "Niets verwijderd")}
              actionLabel={appLabel("klanten.analyse.verwijderd.herstel", "Herstellen")}
              onAction={handleRestore}
              testIdPrefix="deleted"
              busyId={busyAction?.action === "restore" ? busyAction.id : null}
            />
          )}
        </div>
      )}

      {/* Eigen-patroon CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEigenModalOpen(true)}
          disabled={!!busyAction}
          data-testid="analyse-knop-eigen-patroon"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-1.5 rounded-sm transition-colors disabled:opacity-50"
        >
          {appLabel("klanten.analyse.knop.eigen_patroon", "+ eigen patroon")}
        </button>
      </div>

      {/* Modals */}
      {editModalSuggestion && (
        <SuggestionEditModal
          suggestion={editModalSuggestion}
          onClose={() => setEditModalSuggestion(null)}
          onSave={handleEditSave}
        />
      )}

      {deeperModalSuggestion && (
        <RefineDeeperModal
          parentSuggestion={deeperModalSuggestion}
          onClose={() => setDeeperModalSuggestion(null)}
          onSubmit={handleDeeperSubmit}
        />
      )}

      {eigenModalOpen && (
        <EigenPatroonModal
          dimensions={dimensions}
          items={items}
          painPoints={painPoints}
          onClose={() => setEigenModalOpen(false)}
          onSave={handleEigenSave}
        />
      )}
    </div>
  );
}

// Re-export voor mogelijke externe consumers (rapport-laag in vervolg-sessie B)
export { AI_ACTION_TYPES };
