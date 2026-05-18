/**
 * VerbeteractiesView — S4 RFC-007 C1: combineert AnalyseView + VerbeterrichtingenView
 * tot één fase 3-tab met concept→definitief-flow.
 *
 * Mapping (RFC-007 §3.1):
 *   • pattern_suggestion (open/edited/accepted/refined, niet-gepromoot) → concept
 *   • pattern_suggestion rejected                                       → collapse "Verwijderd"
 *   • improvement_intent status='concept'                               → concept
 *   • improvement_intent status='verstuurd'                             → definitief
 *
 * Layout (RFC-007 §5.1 + designer-anker 3):
 *   1. Intro + ActionBar (4 AI-knoppen + "Eigen actie"-knop)
 *   2. Counter "X concept · Y definitief"
 *   3. ConceptList (gemengde suggestions + concept-intents, nieuwste eerst)
 *   4. DefinitiefList (intents verstuurd, handover_at DESC)
 *   5. Collapse "Verwijderd" (rejected-patterns met restore-pad)
 *
 * Acties (RFC-007 §5.4):
 *   • Op concept-suggestion:
 *       Bewerk           → SuggestionEditModal
 *       Refine met AI    → RefineDeeperModal
 *       Verwijder        → reject-event (soft-delete; restore-pad in Verwijderd-collapse)
 *       Maak definitief  → PromoteToIntentModal → promote + handover (2 service-calls)
 *   • Op concept-intent:
 *       Bewerk           → IntentModal edit
 *       Verwijder        → DELETE intent
 *       Maak definitief  → handoverIntentToRoadmap (K-fix-2: confirm-dialog weggehaald)
 *   • Op definitief-intent (verstuurd):
 *       Bewerk           → IntentModal edit
 *       Verwijder        → DELETE intent (architect-aanbeveling RFC §7 open vraag #2)
 *       Terug naar concept → overflow-menu (unsent-event)
 *
 * Bouwer-keuzes op RFC §7 open vragen (motivatie in result-file):
 *   #1 DefinitiefList sortering: handover_to_roadmap_at DESC (architect-aanbeveling)
 *   #2 Verwijder definitief-intent: direct DELETE (RFC-007 §5.4 + §7-aanbeveling)
 *   #3 Terug naar concept-zichtbaarheid: overflow-menu (RFC §3.3-aanbeveling)
 *   #5 Eigen actie: opent IntentModal direct (geen pattern_type='eigen' meer)
 *
 * Single source of truth: suggestions + intents via props uit KlantenWerkblad.
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, Plus, MoreVertical } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import AiIconButton from "../../shared/components/AiIconButton";
import ModusToggle from "../../shared/components/ModusToggle";
import DoorloopView from "./components/DoorloopView";
import * as klantenService from "./services/klanten.service";
import SuggestionCard from "./SuggestionCard";
import IntentCard from "./IntentCard";
import SuggestionEditModal from "./SuggestionEditModal";
import RefineDeeperModal from "./RefineDeeperModal";
import EigenPatroonModal from "./EigenPatroonModal";
import IntentModal from "./IntentModal";
import PromoteToIntentModal from "./PromoteToIntentModal";
import CollapseSection from "./CollapseSection";
import { useVerbeteracties } from "./hooks/useVerbeteracties";

// T4 B2.3: 5 AI-generaties (was 4). 'Algemeen' is open lens — geen vooraf
// bepaalde Cluster/Paradox/Positionering/Overstijgend-frame.
const AI_BUTTONS = [
  { action: "algemeen",      labelKey: "klanten.analyse.knop.algemeen",      labelFallback: "Algemeen patroon",      helperKey: "klanten.analyse.knop.algemeen.helper",      helperFallback: "Open analyse — AI kiest zelf welke lens past bij de pijnpunten" },
  { action: "cluster",       labelKey: "klanten.analyse.knop.cluster",       labelFallback: "Cluster zoeken",       helperKey: "klanten.analyse.knop.cluster.helper",       helperFallback: "Groepen pijnpunten met gemeenschappelijke oorzaak" },
  { action: "paradox",       labelKey: "klanten.analyse.knop.paradox",       labelFallback: "Paradox zoeken",       helperKey: "klanten.analyse.knop.paradox.helper",       helperFallback: "Pijnpunten die elkaar tegenspreken" },
  { action: "positionering", labelKey: "klanten.analyse.knop.positionering", labelFallback: "Positionering toetsen", helperKey: "klanten.analyse.knop.positionering.helper", helperFallback: "Wie zijn we voor wie — zwakke plekken" },
  { action: "overstijgend",  labelKey: "klanten.analyse.knop.overstijgend",  labelFallback: "Overstijgend zoeken",  helperKey: "klanten.analyse.knop.overstijgend.helper",  helperFallback: "Capabilities die het hele werkblad raken" },
];

export default function VerbeteractiesView({
  canvasId,
  dimensions = [],
  items = [],
  painPoints = [],
  couplings = [],
  suggestions,
  suggestionsLoading,
  suggestionsError,
  reloadSuggestions,
  intents,
  intentPainLinks = [],
  intentsLoading,
  intentsError,
  reloadIntents,
}) {
  const { label: appLabel } = useAppConfig();

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const {
    conceptEntries,
    definitiefEntries,
    deletedSuggestions,
    loading,
    error,
    reload,
  } = useVerbeteracties({
    suggestions, intents,
    suggestionsLoading, intentsLoading,
    suggestionsError, intentsError,
    reloadSuggestions, reloadIntents,
  });

  const hasPainPoints = (painPoints || []).length > 0;

  const [busyAction, setBusyAction] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [editSuggestion,   setEditSuggestion]   = useState(null);
  const [deeperSuggestion, setDeeperSuggestion] = useState(null);
  const [eigenModalOpen,   setEigenModalOpen]   = useState(false);
  const [intentModalState, setIntentModalState] = useState(null); // { mode, intent? }
  const [promoteSuggestion, setPromoteSuggestion] = useState(null);
  const [overflowOpenId,   setOverflowOpenId]   = useState(null);

  // 11.U Block 2: ModusToggle Doorloop/Overzicht. Default = doorloop
  // (per Kees-akkoord 17 mei design-prototype).
  const [modus, setModus] = useState("doorloop");

  // 11.U Block 2b — Doorloop-state
  const [currentFocusIdx, setCurrentFocusIdx] = useState(0);
  const [lensPickerOpenFor, setLensPickerOpenFor] = useState(null);   // pp.id of null
  const [lensLoading, setLensLoading] = useState(null);               // { painPointId, phase }
  const [aiDraftFor, setAiDraftFor] = useState(null);                 // { painPointId, draftIntent }
  const [eigenActieEditFor, setEigenActieEditFor] = useState(null);   // pp.id of null

  // Sortering pijnpunten voor Doorloop: open eerst, dan addressed, dan dismissed;
  // binnen elke groep op created_at ASC.
  const sortedPainPoints = useMemo(() => {
    const STATUS_ORDER = { open: 0, addressed: 1, dismissed: 2 };
    return [...(painPoints || [])].sort((a, b) => {
      const sa = STATUS_ORDER[a.coverage_status || "open"] ?? 0;
      const sb = STATUS_ORDER[b.coverage_status || "open"] ?? 0;
      if (sa !== sb) return sa - sb;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });
  }, [painPoints]);

  // Reset inline-state bij focus-wisseling
  function resetInlineState() {
    setLensPickerOpenFor(null);
    setLensLoading(null);
    setAiDraftFor(null);
    setEigenActieEditFor(null);
  }
  function moveFocus(delta) {
    resetInlineState();
    setCurrentFocusIdx(i => Math.max(0, Math.min(sortedPainPoints.length - 1, i + delta)));
  }

  // ── 11.U Block 2b — Doorloop-handlers ──────────────────────────────────────
  // Choice-cards
  function handleChooseAi(painPoint) {
    resetInlineState();
    setLensPickerOpenFor(painPoint.id);
  }
  function handleChooseEigen(painPoint) {
    resetInlineState();
    setEigenActieEditFor(painPoint.id);
  }
  function handleChooseDismiss(/* painPoint */) {
    // Block 3 wires MotivatieModal. Block 2b: placeholder-alert.
    setGlobalError({
      message: appLabel(
        "klanten.verbeteracties.actie.dismiss_block3_pending",
        "Motivatie-modal komt in volgende release — gebruik voor nu Overzicht-modus.",
      ),
    });
  }
  // Lens-picker → AI-call
  async function handlePickLens(painPoint, lens) {
    setLensLoading({ painPointId: painPoint.id, phase: "collecting" });
    // korte fase-overgang voor UX-feedback
    setTimeout(() => setLensLoading(prev =>
      prev?.painPointId === painPoint.id ? { painPointId: painPoint.id, phase: "ai_running" } : prev,
    ), 500);

    const { data, error: genErr } = await klantenService.generatePatternSuggestions({
      canvasId: canvasIdRef.current,
      action: lens,
    });
    setLensLoading(null);
    setLensPickerOpenFor(null);
    if (genErr) { setGlobalError(genErr); return; }

    // generatePatternSuggestions returnt `data` = array of created intents (Block 2a refactor).
    // Take first as draft; eventuele extra intents blijven als concept in DB (consultant ziet
    // ze in Overzicht-modus). MVP-keuze.
    const intentsArr = Array.isArray(data) ? data : (data?.intents || data?.pattern_suggestions || []);
    const first = intentsArr[0];
    if (!first) {
      setGlobalError(new Error(appLabel("klanten.verbeteracties.ai_draft.error.no_result", "AI leverde geen suggestie")));
      return;
    }
    // Link the draft-intent direct aan dit pijnpunt (alleen voor preview).
    // Wuif-weg verwijdert intent + link. Accepteer behoudt de link.
    await klantenService.createIntentPainPointLink(first.id, painPoint.id);
    setAiDraftFor({ painPointId: painPoint.id, draftIntent: first });
    reloadIntents();
  }
  function handleCancelLens() {
    setLensLoading(null);
    setLensPickerOpenFor(null);
  }

  // AiResultDraft acties
  async function handleAccepteerAi(painPoint, { title, intentMd, isEdited }) {
    if (!aiDraftFor) return { error: new Error("draft-context ontbreekt") };
    if (isEdited) {
      const { error: upErr } = await klantenService.updateIntent(aiDraftFor.draftIntent.id, {
        title, intentMd,
      });
      if (upErr) { setGlobalError(upErr); return { error: upErr }; }
    }
    setAiDraftFor(null);
    reloadIntents();
    return { error: null };
  }
  async function handleVerfijnAi(painPoint) {
    if (!aiDraftFor) return;
    // Delete current draft (cascade verwijdert link via FK) + open lens-picker opnieuw.
    const draftId = aiDraftFor.draftIntent.id;
    setAiDraftFor(null);
    const lens = (aiDraftFor.draftIntent.source_type || "ai_algemeen").replace(/^ai_/, "") || "algemeen";
    await klantenService.deleteIntent(draftId);
    reloadIntents();
    // Regenerate met zelfde lens — sneller UX dan terug naar LensPicker
    await handlePickLens(painPoint, lens);
  }
  async function handleWuifWegAi(/* painPoint */) {
    if (!aiDraftFor) return;
    const draftId = aiDraftFor.draftIntent.id;
    setAiDraftFor(null);
    const { error: delErr } = await klantenService.deleteIntent(draftId);
    if (delErr) setGlobalError(delErr);
    reloadIntents();
  }

  // Eigen-actie inline
  async function handleSaveEigenActie(painPoint, { title, intentMd }) {
    const { data: created, error: insErr } = await klantenService.createIntent({
      canvasId: canvasIdRef.current,
      title,
      intentMd,
    });
    if (insErr || !created?.id) {
      const err = insErr || new Error(appLabel("klanten.verbeteracties.eigen.error.generic", "Opslaan mislukt"));
      setGlobalError(err);
      return { error: err };
    }
    const { error: linkErr } = await klantenService.createIntentPainPointLink(created.id, painPoint.id);
    if (linkErr) { setGlobalError(linkErr); return { error: linkErr }; }
    setEigenActieEditFor(null);
    reloadIntents();
    return { error: null };
  }
  function handleCancelEigenActie() {
    setEigenActieEditFor(null);
  }

  // Reopen pijnpunt (vanuit addressed of dismissed)
  async function handleReopenPain(painPoint) {
    if (painPoint.coverage_status === "dismissed") {
      const { error: rErr } = await klantenService.restorePainPoint(painPoint.id);
      if (rErr) { setGlobalError(rErr); return; }
    }
    // Voor 'addressed': unlink alle gekoppelde intents zou pain weer open maken (trigger);
    // Block 3 wires complete reopen-flow. Voor 2b: alleen dismissed → open functioneel.
    // Reload via parent
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("klanten:reload-painpoints"));
    }
    reloadIntents();
  }

  // ── AI-affordance-knop click (Overzicht-modus) ─────────────────────────────
  async function handleAiClick(action) {
    if (!hasPainPoints || busyAction) return;
    setBusyAction({ action });
    setGlobalError(null);
    const { error: genErr } = await klantenService.generatePatternSuggestions({
      canvasId: canvasIdRef.current,
      action,
    });
    setBusyAction(null);
    if (genErr) { setGlobalError(genErr); return; }
    reload();
  }

  // ── Concept-suggestion-acties ───────────────────────────────────────────────
  async function handleReject(suggestion) {
    if (busyAction) return;
    setBusyAction({ action: "reject", id: suggestion.id });
    setGlobalError(null);
    const { error: actErr } = await klantenService.rejectPatternSuggestion(suggestion.id);
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

  // "Maak definitief" op concept-suggestion → opent PromoteToIntentModal
  // (consultant kan title + intent_md tunen) → bij save: promote+handover.
  function openPromoteFromSuggestion(suggestion) {
    if (busyAction) return;
    setPromoteSuggestion(suggestion);
  }
  async function handlePromoteSubmit({ title, intentMd }) {
    if (!promoteSuggestion) return { error: new Error("modal context ontbreekt") };
    const { intent, error: promErr } = await klantenService.promotePatternSuggestionToIntent(
      promoteSuggestion.id,
      { title, intentMd },
    );
    if (promErr) return { error: promErr };
    if (!intent?.id) return { error: new Error("promote zonder intent-id geretourneerd") };
    const { error: hoErr } = await klantenService.handoverIntentToRoadmap(intent.id);
    if (hoErr) return { error: hoErr };
    reload();
    return { error: null };
  }

  // ── Concept-intent-acties ───────────────────────────────────────────────────
  function openEditIntent(intent) {
    if (busyAction) return;
    setIntentModalState({ mode: "edit", intent });
  }
  async function handleDeleteIntent(intent) {
    if (busyAction) return;
    setBusyAction({ action: "delete", id: intent.id });
    setGlobalError(null);
    const { error: delErr } = await klantenService.deleteIntent(intent.id);
    setBusyAction(null);
    if (delErr) { setGlobalError(delErr); return; }
    reload();
  }
  async function handleHandoverIntent(intent) {
    if (busyAction) return;
    // K-fix-2 bevinding 1: confirm-dialog weggehaald (analoog K-fix 3a).
    // Definitief maken is reversible via "Terug naar concept" → geen waarschuwing-stap nodig.
    setBusyAction({ action: "handover", id: intent.id });
    setGlobalError(null);
    const { error: hoErr } = await klantenService.handoverIntentToRoadmap(intent.id);
    setBusyAction(null);
    if (hoErr) { setGlobalError(hoErr); return; }
    reload();
  }

  // ── Definitief-intent acties (overflow-menu Terug naar concept) ─────────────
  async function handleUnsendIntent(intent) {
    if (busyAction) return;
    setBusyAction({ action: "unsend", id: intent.id });
    setGlobalError(null);
    setOverflowOpenId(null);
    const { error: unErr } = await klantenService.unsendIntent(intent.id);
    setBusyAction(null);
    if (unErr) { setGlobalError(unErr); return; }
    reload();
  }

  // ── Refine-modals ───────────────────────────────────────────────────────────
  function openEditSuggestion(suggestion) { if (!busyAction) setEditSuggestion(suggestion); }
  function openDeeperSuggestion(suggestion) { if (!busyAction) setDeeperSuggestion(suggestion); }

  async function handleEditSuggestionSave({ textMd }) {
    if (!editSuggestion) return { error: new Error("modal context ontbreekt") };
    const { error: putErr } = await klantenService.updatePatternSuggestion(editSuggestion.id, { textMd });
    if (putErr) return { error: putErr };
    reload();
    return { error: null };
  }

  async function handleDeeperSubmit({ refinementFocus }) {
    if (!deeperSuggestion) return { error: new Error("modal context ontbreekt") };
    const action = deeperSuggestion.pattern_type === "eigen"
      ? "cluster"
      : deeperSuggestion.pattern_type;
    const { error: genErr } = await klantenService.generatePatternSuggestions({
      canvasId: canvasIdRef.current,
      action,
      parentId: deeperSuggestion.id,
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

  // ── Eigen actie modal (intent) — RFC §7 open vraag #5: direct INSERT in intents ─
  function openCreateIntent() { if (!busyAction) setIntentModalState({ mode: "create", intent: null }); }
  async function handleSaveIntent({ title, intentMd, vanuit }) {
    if (!intentModalState) return { error: new Error("modal context ontbreekt") };
    let res;
    if (intentModalState.mode === "edit") {
      res = await klantenService.updateIntent(intentModalState.intent.id, { title, intentMd });
    } else {
      res = await klantenService.createIntent({
        canvasId: canvasIdRef.current,
        title,
        intentMd,
        vanuit,
        sortOrder: (intents || []).length * 10,
      });
    }
    if (res.error) return { error: res.error };
    reload();
    return { error: null };
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const isInitialLoad = loading && suggestions === null && intents === null;
  const isReloading   = loading && (suggestions !== null || intents !== null);

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
          <p className="text-sm text-red-700 font-bold mb-2">{appLabel("klanten.verbeteractie.error.generic", "Laden mislukt")}</p>
          <p className="text-xs text-slate-600 mb-4">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded"
          >
            {appLabel("klanten.verbeteractie.error.retry", "Opnieuw")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8" data-testid="verbeteracties-view">
      {/* T4 B2.2: info-banner bovenin Verbeteracties-tab — uitleg
          concept→definitief-flow + verwijzing naar Veranderprogramma-werkblad */}
      <div
        data-testid="klanten-fase3-info-banner"
        className="mb-5 px-4 py-3 text-xs leading-relaxed border border-category-klanten/20 rounded-md"
        style={{
          backgroundColor: "var(--category-klanten-light)",
          color: "var(--category-klanten)",
        }}
      >
        {appLabel("tips.klanten.fase3.info",
          "Acties starten als Concept en kunnen Definitief gemaakt worden. Plan en uitvoering volgt in het Veranderprogramma-werkblad.")}
      </div>

      {/* 11.U Block 2: ModusToggle Doorloop/Overzicht */}
      <div className="mb-5 flex items-center justify-between">
        <ModusToggle
          value={modus}
          onChange={setModus}
          options={[
            { value: "doorloop",  label: appLabel("klanten.verbeteractie.modus.doorloop",  "Doorloop") },
            { value: "overzicht", label: appLabel("klanten.verbeteractie.modus.overzicht", "Overzicht") },
          ]}
          testIdPrefix="verbeteracties-modus-toggle"
        />
      </div>

      {/* Doorloop-modus — Block 2b: volledig functioneel */}
      {modus === "doorloop" && (
        <>
          {globalError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded mb-4 flex items-center justify-between">
              <span>{globalError.message || appLabel("klanten.verbeteractie.error.generic", "Actie mislukt")}</span>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900 ml-3"
                data-testid="doorloop-error-dismiss"
              >
                {appLabel("klanten.verbeteractie.error.sluit", "Sluit")}
              </button>
            </div>
          )}
          <DoorloopView
            painPoints={sortedPainPoints}
            intents={intents || []}
            links={intentPainLinks || []}
            currentIdx={currentFocusIdx}
            onPrev={() => moveFocus(-1)}
            onNext={() => moveFocus(+1)}
            lensPickerOpenFor={lensPickerOpenFor}
            lensLoading={lensLoading}
            aiDraftFor={aiDraftFor}
            eigenActieEditFor={eigenActieEditFor}
            onChooseAi={handleChooseAi}
            onChooseEigen={handleChooseEigen}
            onChooseDismiss={handleChooseDismiss}
            onPickLens={handlePickLens}
            onCancelLens={handleCancelLens}
            onAccepteerAi={handleAccepteerAi}
            onVerfijnAi={handleVerfijnAi}
            onWuifWegAi={handleWuifWegAi}
            onSaveEigenActie={handleSaveEigenActie}
            onCancelEigenActie={handleCancelEigenActie}
            onReopen={handleReopenPain}
            onEditIntent={openEditIntent}
            appLabel={appLabel}
          />
        </>
      )}

      {/* Intro — alleen in Overzicht-modus */}
      {modus === "overzicht" && (
      <>
      <div className="mb-6">
        <p className="text-sm text-slate-500 italic mb-4 max-w-3xl">
          {appLabel("klanten.verbeteractie.intro", "Verbeteracties starten als concept — vanuit AI-patroonherkenning of als eigen actie. Bewerk wat moet, verwijder wat niet klopt, maak definitief wat blijft.")}
        </p>

        {!hasPainPoints && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded mb-4">
            {appLabel("klanten.verbeteractie.empty.geen_pijnpunten", "Voeg eerst pijnpunten toe in fase 2 voordat je AI-analyse draait. Een eigen actie toevoegen kan altijd.")}
          </div>
        )}

        {/* ActionBar — 4 AI-knoppen + Eigen actie (F6 spacing-tokens via gap-2) */}
        <div className="flex flex-wrap items-center gap-2" data-testid="verbeteracties-actionbar">
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
                data-testid={`verbeteracties-knop-${btn.action}`}
                label={isLoading
                  ? appLabel("klanten.analyse.loading", "AI denkt na…")
                  : appLabel(btn.labelKey, btn.labelFallback)}
              />
            );
          })}
          <button
            type="button"
            onClick={openCreateIntent}
            disabled={!!busyAction}
            data-testid="verbeteracties-knop-eigen-actie"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-2 rounded-sm transition-colors disabled:opacity-50 ml-2"
          >
            <Plus size={12} />
            {appLabel("klanten.verbeteractie.knop.eigen_actie", "Eigen actie")}
          </button>
          {isReloading && (
            <Loader2 size={14} className="animate-spin text-slate-400 ml-2" data-testid="verbeteracties-inline-spinner" />
          )}
        </div>
      </div>

      {/* Counter */}
      <div className="text-xs text-slate-500 mb-4" data-testid="verbeteracties-counter">
        <span data-testid="counter-concept">{conceptEntries.length}</span>{" "}
        {appLabel("klanten.verbeteractie.counter.concept", "concept")}
        {" "}<span className="text-slate-400">·</span>{" "}
        <span data-testid="counter-definitief">{definitiefEntries.length}</span>{" "}
        {appLabel("klanten.verbeteractie.counter.definitief", "definitief")}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4 flex items-center justify-between">
          <span>{globalError.message || appLabel("klanten.verbeteractie.error.generic", "Actie mislukt")}</span>
          <button
            type="button"
            onClick={() => { setGlobalError(null); reload(); }}
            className="text-[10px] font-bold uppercase tracking-widest text-red-700 hover:text-red-900 ml-3"
          >
            {appLabel("klanten.verbeteractie.error.retry", "Opnieuw")}
          </button>
        </div>
      )}

      {/* Concept-lijst */}
      <section className="mb-8" data-testid="verbeteracties-concept-list">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">
          {appLabel("klanten.verbeteractie.sectie.concept", "Concept")}
        </h3>
        {conceptEntries.length === 0 ? (
          <p className="text-sm text-slate-400 italic" data-testid="verbeteracties-concept-leeg">
            {appLabel("klanten.verbeteractie.concept.leeg", "Nog geen concept-verbeteracties — klik een AI-knop of voeg een eigen actie toe.")}
          </p>
        ) : (
          <div className="space-y-3">
            {conceptEntries.map(entry => entry._type === "suggestion" ? (
              <div key={`s-${entry.id}`} className="space-y-1">
                <SuggestionCard
                  suggestion={entry}
                  hasParent={!!entry.parent_id}
                  busy={!!busyAction && busyAction.id === entry.id}
                  onAccept={null}             /* "Markeer" obsoleet binnen concept-bucket — vervangen door Maak definitief */
                  onRefineEdit={openEditSuggestion}
                  onRefineDeeper={openDeeperSuggestion}
                  onReject={handleReject}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openPromoteFromSuggestion(entry)}
                    disabled={!!busyAction}
                    data-testid={`verbeteracties-maakdefinitief-suggestion-${entry.id}`}
                    className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-accent-hover)] border border-[var(--color-primary)]/30 hover:border-[var(--color-primary)] px-3 py-1.5 rounded-sm transition-colors disabled:opacity-50"
                  >
                    {appLabel("klanten.verbeteractie.actie.maak_definitief", "Maak definitief")}
                  </button>
                </div>
              </div>
            ) : (
              <IntentCard
                key={`i-${entry.id}`}
                intent={entry}
                busy={!!busyAction && busyAction.id === entry.id}
                onEdit={openEditIntent}
                onDelete={handleDeleteIntent}
                onHandover={handleHandoverIntent}
                onUnsend={handleUnsendIntent}
              />
            ))}
          </div>
        )}
      </section>

      {/* Definitief-lijst */}
      <section className="mb-8" data-testid="verbeteracties-definitief-list">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">
          {appLabel("klanten.verbeteractie.sectie.definitief", "Definitief")}
        </h3>
        {definitiefEntries.length === 0 ? (
          <p className="text-sm text-slate-400 italic" data-testid="verbeteracties-definitief-leeg">
            {appLabel("klanten.verbeteractie.definitief.leeg", "Nog geen definitieve verbeteracties.")}
          </p>
        ) : (
          <div className="space-y-3">
            {definitiefEntries.map(entry => (
              <div key={`def-${entry.id}`} className="relative">
                <IntentCard
                  intent={entry}
                  busy={!!busyAction && busyAction.id === entry.id}
                  onEdit={openEditIntent}
                  onDelete={handleDeleteIntent}
                  /* "Terug naar concept" zit niet meer op de card-primary — zie overflow hieronder */
                  onUnsend={null}
                  onHandover={null}
                />
                {/* Overflow-menu (RFC §3.3 + C1.6) — "Terug naar concept" niet primary */}
                <div className="absolute top-2 right-2">
                  <button
                    type="button"
                    aria-label={appLabel("klanten.verbeteractie.actie.overflow", "Meer opties")}
                    onClick={() => setOverflowOpenId(overflowOpenId === entry.id ? null : entry.id)}
                    data-testid={`verbeteracties-overflow-${entry.id}`}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-100 transition-colors"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {overflowOpenId === entry.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setOverflowOpenId(null)} />
                      <div
                        className="absolute right-0 mt-1 min-w-[180px] bg-white border border-slate-200 rounded-md shadow-lg z-40 py-1"
                        role="menu"
                        data-testid={`verbeteracties-overflow-menu-${entry.id}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleUnsendIntent(entry)}
                          disabled={!!busyAction}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          data-testid={`verbeteracties-terug-naar-concept-${entry.id}`}
                        >
                          {appLabel("klanten.verbeteractie.actie.terug_naar_concept", "Terug naar concept")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Verwijderd-collapse (rejected-patterns) */}
      {deletedSuggestions.length > 0 && (
        <div className="mb-6">
          <CollapseSection
            title={`${appLabel("klanten.verbeteractie.verwijderd.titel", "Verwijderd")} (${deletedSuggestions.length})`}
            items={deletedSuggestions}
            emptyMessage={appLabel("klanten.verbeteractie.verwijderd.leeg", "Niets verwijderd")}
            actionLabel={appLabel("klanten.verbeteractie.verwijderd.herstel", "Herstellen")}
            onAction={handleRestore}
            testIdPrefix="verbeteracties-deleted"
            busyId={busyAction?.action === "restore" ? busyAction.id : null}
          />
        </div>
      )}
      </>
      )}

      {/* Modals */}
      {editSuggestion && (
        <SuggestionEditModal
          suggestion={editSuggestion}
          onClose={() => setEditSuggestion(null)}
          onSave={handleEditSuggestionSave}
        />
      )}
      {deeperSuggestion && (
        <RefineDeeperModal
          parentSuggestion={deeperSuggestion}
          onClose={() => setDeeperSuggestion(null)}
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
      {intentModalState && (
        <IntentModal
          mode={intentModalState.mode}
          intent={intentModalState.intent}
          onClose={() => setIntentModalState(null)}
          onSave={handleSaveIntent}
        />
      )}
      {promoteSuggestion && (
        <PromoteToIntentModal
          suggestion={promoteSuggestion}
          onClose={() => setPromoteSuggestion(null)}
          onSubmit={handlePromoteSubmit}
        />
      )}
    </div>
  );
}
