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
import MotivatieInput from "./components/MotivatieInput";
import { suggestLens } from "./components/lensSuggestion";
import CoverageGauge from "./components/CoverageGauge";
import OverzichtView from "./components/OverzichtView";
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

  // 11.U Block 3 — F-retro-1 + Fix 3 + Fix 4
  const [dismissModalFor, setDismissModalFor] = useState(null);        // painPoint | null
  const [reopenConfirmFor, setReopenConfirmFor] = useState(null);      // { painPoint, linkCount } | null

  // 11.U Block 3b: coverage-tellingen real-time uit painPoints-prop (geen extra round-trip)
  const coverageCounts = useMemo(() => {
    const counts = { open: 0, addressed: 0, dismissed: 0, total: 0 };
    (painPoints || []).forEach(pp => {
      const status = pp.coverage_status || "open";
      counts.total += 1;
      if (status === "addressed") counts.addressed += 1;
      else if (status === "dismissed") counts.dismissed += 1;
      else counts.open += 1;
    });
    return counts;
  }, [painPoints]);

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
  // 11.U Block 2b retro: directe sprong vanuit PijnpuntenRail-klik. Reset inline-state
  // analoog moveFocus zodat LensPicker/AiDraft/EigenActie sluiten bij wisseling.
  function jumpToIdx(idx) {
    resetInlineState();
    setCurrentFocusIdx(Math.max(0, Math.min(sortedPainPoints.length - 1, idx)));
  }

  // 11.U Block 3 F-retro-2: findNextOpenIdx — idx van eerstvolgende coverage_status='open'
  // ná currentIdx (cyclisch: doorloop list, return null indien geen open meer).
  function findNextOpenIdx(currentIdx) {
    if (sortedPainPoints.length === 0) return null;
    // Zoek vooruit; wrap rond naar begin als nodig (maar skip currentIdx).
    for (let offset = 1; offset <= sortedPainPoints.length; offset++) {
      const candidateIdx = (currentIdx + offset) % sortedPainPoints.length;
      if (candidateIdx === currentIdx) continue;
      const pp = sortedPainPoints[candidateIdx];
      if ((pp.coverage_status || "open") === "open") return candidateIdx;
    }
    return null;
  }
  const nextOpenIdx = findNextOpenIdx(currentFocusIdx);

  // 11.U Block 3 F-retro-1: lens-suggestie voor huidig open pijnpunt
  const currentPainPoint = sortedPainPoints[currentFocusIdx];
  const recommendedLensFor = useMemo(() => {
    if (!currentPainPoint || (currentPainPoint.coverage_status || "open") !== "open") return null;
    const lens = suggestLens({
      painPoint: currentPainPoint,
      intents: intents || [],
      dimensions: dimensions || [],
    });
    return { painPointId: currentPainPoint.id, lens };
  }, [currentPainPoint, intents, dimensions]);

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
  function handleChooseDismiss(painPoint) {
    // 11.U Block 3 Fix 3: opent MotivatieInput-modal i.p.v. placeholder-alert
    resetInlineState();
    setDismissModalFor(painPoint);
  }
  // 11.U Block 3 F-retro-1: klik op SuggestedLensHint → opent LensPicker met
  // recommendedLens preselected.
  function handleClickLensHint(painPoint) {
    resetInlineState();
    setLensPickerOpenFor(painPoint.id);
  }
  // 11.U Block 3 F-retro-2: skip naar volgende open pijnpunt
  function handleJumpToNextOpen(/* painPoint */) {
    if (nextOpenIdx == null) return;
    jumpToIdx(nextOpenIdx);
  }
  // 11.U Block 3 Fix 3: MotivatieInput confirm-handler
  async function handleConfirmDismiss(motivation) {
    if (!dismissModalFor) return { error: new Error("dismiss-context ontbreekt") };
    const { error: dErr } = await klantenService.dismissPainPoint(dismissModalFor.id, motivation);
    if (dErr) { setGlobalError(dErr); return { error: dErr }; }
    const skipIdx = nextOpenIdx;
    setDismissModalFor(null);
    // Auto-skip naar volgende open (indien beschikbaar)
    if (skipIdx != null) jumpToIdx(skipIdx);
    // Reload painPoints via parent custom event (KlantenWerkblad listens — anker Block 2b)
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("klanten:reload-painpoints"));
    }
    reloadIntents();
    return { error: null };
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

  // 11.U Block 3 Fix 4: Reopen pijnpunt vanuit addressed OF dismissed.
  // - dismissed → restorePainPoint (zelfde als Block 2b)
  // - addressed: unlink alle intent-pain-links; coverage-trigger zet status='open'.
  //   Confirm-dialog bij ≥2 links (reviewer-instructie regel 141-144, "alle links verwijderen"-pad).
  async function handleReopenPain(painPoint) {
    if (painPoint.coverage_status === "dismissed") {
      const { error: rErr } = await klantenService.restorePainPoint(painPoint.id);
      if (rErr) { setGlobalError(rErr); return; }
      reloadIntents();
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("klanten:reload-painpoints"));
      }
      return;
    }
    if (painPoint.coverage_status === "addressed") {
      const linkedIntentLinks = (intentPainLinks || []).filter(l => l.pain_point_id === painPoint.id);
      if (linkedIntentLinks.length >= 2) {
        // Open confirm-dialog
        setReopenConfirmFor({ painPoint, linkCount: linkedIntentLinks.length });
        return;
      }
      // Direct unlink (single of 0 links — geen confirm)
      await performAddressedReopen(painPoint);
    }
  }
  async function performAddressedReopen(painPoint) {
    const linksToRemove = (intentPainLinks || []).filter(l => l.pain_point_id === painPoint.id);
    setReopenConfirmFor(null);
    for (const link of linksToRemove) {
      const { error: dErr } = await klantenService.deleteIntentPainPointLink(link.intent_id, painPoint.id);
      if (dErr) { setGlobalError(dErr); return; }
    }
    reloadIntents();
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("klanten:reload-painpoints"));
    }
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

      {/* 11.U Block 3b — sub-header met titel + dyn-subtitle + CoverageGauge + ModusToggle */}
      <div
        className="mb-5 flex flex-wrap items-center justify-between gap-3 px-2 py-3 border-b border-slate-200"
        data-testid="verbeteracties-sub-header"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900" data-testid="verbeteracties-sub-header-titel">
            {appLabel("klanten.verbeteracties.subheader.titel", "Verbeteracties · fase 3")}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5" data-testid="verbeteracties-sub-header-subtitle">
            {(() => {
              const { open: ovOpen, total: ovTotal } = coverageCounts;
              if (ovTotal === 0) {
                return appLabel("klanten.verbeteracties.subheader.subtitle.leeg", "Geen pijnpunten gedefinieerd");
              }
              if (ovOpen === 0) {
                return appLabel("klanten.verbeteracties.subheader.subtitle.alle_gedaan", "Alle pijnpunten geadresseerd ✓");
              }
              const plural = ovOpen === 1 ? "" : "en";
              return appLabel("klanten.verbeteracties.subheader.subtitle.open", "Nog {N} pijnpunt{plural} zonder actie")
                .replace("{N}", ovOpen)
                .replace("{plural}", plural);
            })()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CoverageGauge
            open={coverageCounts.open}
            addressed={coverageCounts.addressed}
            dismissed={coverageCounts.dismissed}
            total={coverageCounts.total}
            appLabel={appLabel}
          />
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
            dimensions={dimensions}
            intents={intents || []}
            links={intentPainLinks || []}
            currentIdx={currentFocusIdx}
            onPrev={() => moveFocus(-1)}
            onNext={() => moveFocus(+1)}
            onJumpToIdx={jumpToIdx}
            recommendedLensFor={recommendedLensFor}
            nextOpenIdxFor={nextOpenIdx}
            onClickLensHint={handleClickLensHint}
            onJumpToNextOpen={handleJumpToNextOpen}
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

      {/* 11.U Block 3b — Overzicht-modus: matrix-tabel + inline-expansion + Doorloop-jump */}
      {modus === "overzicht" && (
        <>
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
          <OverzichtView
            painPoints={sortedPainPoints}
            intents={intents || []}
            links={intentPainLinks || []}
            dimensions={dimensions}
            onDoorloopJump={(idx) => { setModus("doorloop"); jumpToIdx(idx); }}
            onChooseAi={(pp) => { setModus("doorloop"); jumpToIdx(sortedPainPoints.findIndex(p => p.id === pp.id)); handleChooseAi(pp); }}
            onChooseEigen={(pp) => { setModus("doorloop"); jumpToIdx(sortedPainPoints.findIndex(p => p.id === pp.id)); handleChooseEigen(pp); }}
            onChooseDismiss={(pp) => handleChooseDismiss(pp)}
            appLabel={appLabel}
          />
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

      {/* 11.U Block 3 Fix 3: MotivatieInput modal voor "Niet adresseren" */}
      <MotivatieInput
        open={!!dismissModalFor}
        painPoint={dismissModalFor}
        onClose={() => setDismissModalFor(null)}
        onConfirm={handleConfirmDismiss}
        appLabel={appLabel}
      />

      {/* 11.U Block 3 Fix 4: Reopen confirm-dialog bij ≥2 gekoppelde intents */}
      {reopenConfirmFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          data-testid="reopen-confirm-modal"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setReopenConfirmFor(null); }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {appLabel("klanten.verbeteracties.reopen.confirm.titel", "Pijnpunt opnieuw openzetten")}
            </h3>
            <p className="text-sm text-slate-600">
              {appLabel(
                "klanten.verbeteracties.reopen.confirm.body",
                "Dit verwijdert {N} gekoppelde verbeteracties. Doorgaan?",
              ).replace("{N}", reopenConfirmFor.linkCount)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReopenConfirmFor(null)}
                data-testid="reopen-confirm-cancel"
                className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-500 px-3 py-2 rounded"
              >
                {appLabel("klanten.verbeteracties.reopen.confirm.annuleer", "Annuleer")}
              </button>
              <button
                type="button"
                onClick={() => performAddressedReopen(reopenConfirmFor.painPoint)}
                data-testid="reopen-confirm-bevestig"
                className="text-xs font-bold uppercase tracking-widest text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] px-3 py-2 rounded"
              >
                {appLabel("klanten.verbeteracties.reopen.confirm.bevestig", "Ja, opnieuw openzetten")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
