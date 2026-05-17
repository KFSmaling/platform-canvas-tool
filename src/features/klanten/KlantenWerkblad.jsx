/**
 * KlantenWerkblad — root-component voor Klanten & Dienstverlening werkblad.
 *
 * Geactiveerd via DeepDiveOverlay's WERKBLAD_REGISTRY met blockId="customers".
 *
 * Props (registry-contract):
 *   - canvasId: UUID van actief canvas
 *   - onClose(): sluit overlay
 *   - onManualSaved(): callback na manual save (optioneel, niet gebruikt in MVP)
 *
 * Per CLAUDE.md sectie 4.1: feature-root krijgt key={canvasId} via
 * DeepDiveOverlay (al geïmplementeerd, regel 80). Lifecycle is daarmee
 * gegarandeerd schoon bij canvas-wissel.
 *
 * Werkruimte/Rapport-toggle (anker prototype regel 706-708).
 */

import React, { useState } from "react";
import { Users, Info, LogOut, Settings } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import { useAuth } from "../../shared/services/auth.service";
import { useLang } from "../../i18n";
import WerkbladHeader from "../../shared/components/WerkbladHeader";
import WerkbladActieknoppen from "../../shared/components/WerkbladActieknoppen";
import OverDialog from "../../shared/components/OverDialog";
import { useCanvasDimensions } from "./hooks/useCanvasDimensions";
import { usePainPoints } from "./hooks/usePainPoints";
import { usePatternSuggestions } from "./hooks/usePatternSuggestions";
import { useIntents } from "./hooks/useIntents";
import { useCanvasUploads } from "./hooks/useCanvasUploads";
import * as klantenService from "./services/klanten.service";
import WerkruimteView from "./WerkruimteView";
import RapportView from "./RapportView";
import ItemModal from "./ItemModal";
import DimensieModal from "./DimensieModal";
import PijnpuntModal from "./PijnpuntModal";
import PromoteToIntentModal from "./PromoteToIntentModal";

// S4 design-systeem — RFC-007 C1: 3 fase-tabs ipv 4. Analyse-fase merged in
// Verbeteracties (concept→definitief-flow). Pijnpunten blijft fase 2.
const FASE_TABS = [
  { id: 1, num: 1, labelKey: "klanten.fase.1.titel", fallback: "Inventarisatie", enabled: true },
  { id: 2, num: 2, labelKey: "klanten.fase.2.titel", fallback: "Pijnpunten",     enabled: true },
  { id: 3, num: 3, labelKey: "klanten.fase.3.titel", fallback: "Verbeteracties", enabled: true },
];

export default function KlantenWerkblad({ canvasId, onClose }) {
  const { label: appLabel } = useAppConfig();
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLang();
  const [showOverDialog, setShowOverDialog] = useState(false);
  const { loading, error, dimensions, items, reload } = useCanvasDimensions(canvasId);
  const { painPoints, couplings, reload: reloadPains } = usePainPoints(canvasId);
  // Stap 11.G.4 F11-fix: single source of truth voor suggestions. AnalyseView
  // krijgt suggestions/loading/error/reload als props (geen eigen hook-instance
  // meer) zodat edit-acties in fase 3 onmiddellijk doorslaan naar RapportView.
  const {
    suggestions,
    loading: suggestionsLoading,
    error:   suggestionsError,
    reload:  reloadSuggestions,
  } = usePatternSuggestions(canvasId);
  // Stap 11.H: intents single source of truth in KlantenWerkblad — anker
  // 11.G.4 F11-fix. VerbeteractiesView + RapportView krijgen beide
  // dezelfde data zonder eigen hook-instance.
  const {
    intents,
    loading: intentsLoading,
    error:   intentsError,
    reload:  reloadIntents,
  } = useIntents(canvasId);
  // Stap 11.K: useCanvasUploads — single source of truth voor dossier-affordance-
  // activering (hasUploads / hasIndexedChunks / uploadsProcessing) over DimensieKolom
  // + ItemModal + PijnpuntenView. Lift-state-up-pattern uit 11.G.4 / 11.H.
  const {
    hasUploads,
    hasIndexedChunks,
    uploadsProcessing,
    reload: reloadUploads,
  } = useCanvasUploads(canvasId);

  const [view, setView] = useState("werkruimte"); // "werkruimte" | "rapport"
  // Fase 2 — activeFase state gelift van WerkruimteView naar root zodat
  // WerkbladHeader laag 3 de fase-tabs kan renderen (single source of truth).
  const [activeFase, setActiveFase] = useState(1);
  const [modalCtx, setModalCtx] = useState(null); // { dimension, item } of null
  // dimModalState: { mode: "create" | "edit", dimension?: object } of null
  const [dimModalState, setDimModalState] = useState(null);
  // pijnModalState: { mode, painPoint?, initialCouplings? } of null
  const [pijnModalState, setPijnModalState] = useState(null);
  // Stap 11.H: promote-modal-state geactiveerd vanuit AnalyseView (collapse-
  // sectie van gemarkeerde patterns). Bij opslaan creëert server de intent-
  // rij; we reloaden intents + suggestions zodat beide views syncen.
  const [promoteSuggestion, setPromoteSuggestion] = useState(null);
  // Stap 11.K: busyAction voor dossier-affordance-knoppen (A1/A2/A3 + draft-acties)
  const [dossierBusy, setDossierBusy] = useState(null);
  const [dossierError, setDossierError] = useState(null);
  // T4 A7: "geen match"-melding ipv stille flicker bij empty dossier-result
  const [dossierInfo, setDossierInfo] = useState(null);

  function openCreateItem(dimension) {
    setModalCtx({ dimension, item: null });
  }
  function openEditItem(item) {
    const dim = dimensions?.find(d => d.id === item.dimension_id);
    setModalCtx({ dimension: dim, item });
  }
  function closeModal() {
    setModalCtx(null);
  }
  function openCreateDimensie() {
    setDimModalState({ mode: "create", dimension: null });
  }
  function openEditDimensie(dimension) {
    setDimModalState({ mode: "edit", dimension });
  }
  function closeDimModal() {
    setDimModalState(null);
  }
  function openCreatePijnpunt() {
    setPijnModalState({ mode: "create", painPoint: null, initialCouplings: [] });
  }
  function openEditPijnpunt(painPoint) {
    const initial = (couplings || []).filter(c => c.pain_point_id === painPoint.id);
    setPijnModalState({ mode: "edit", painPoint, initialCouplings: initial });
  }
  function closePijnModal() {
    setPijnModalState(null);
  }
  function openPromoteModal(suggestion) {
    setPromoteSuggestion(suggestion);
  }
  function closePromoteModal() {
    setPromoteSuggestion(null);
  }

  async function handlePromoteSave({ title, intentMd }) {
    if (!promoteSuggestion) return { error: new Error("modal context ontbreekt") };
    const { error } = await klantenService.promotePatternSuggestionToIntent(
      promoteSuggestion.id,
      { title, intentMd },
    );
    if (error) return { error };
    reloadIntents();
    reloadSuggestions();
    return { error: null };
  }

  // ── Stap 11.K — Dossier-driven AI-affordances + draft-acties ──────────────

  async function handleExtractItemsFromDossier(dimension) {
    if (dossierBusy) return;
    setDossierBusy({ action: "dossier_extract_items", dimensionId: dimension.id });
    setDossierError(null);
    setDossierInfo(null);
    const { data, error } = await klantenService.extractItemsFromDossier(canvasId, dimension.id);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    // T4 A7: bij 0-results géén stille flicker maar duidelijke "geen match"-melding
    if (!data || data.length === 0) {
      setDossierInfo({ scope: "items", dimensionId: dimension.id,
        text: appLabel("klanten.dossier.geen_match.items",
          "Geen match in dossier voor deze dimensie — typ handmatig of upload meer documenten.") });
      return;
    }
    reload();
  }

  async function handleExtractPainsFromDossier() {
    if (dossierBusy) return;
    setDossierBusy({ action: "dossier_extract_pains" });
    setDossierError(null);
    setDossierInfo(null);
    const { data, error } = await klantenService.extractPainPointsFromDossier(canvasId);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    // T4 A7: idem voor pijnpunten — empty result toont melding ipv stille flicker
    if (!data || data.length === 0) {
      setDossierInfo({ scope: "pains",
        text: appLabel("klanten.dossier.geen_match.pains",
          "Geen pijnpunten gevonden in het dossier — typ handmatig of upload meer documenten.") });
      return;
    }
    reloadPains();
  }

  async function handleFillFieldsFromDossier(itemId) {
    // Wordt aangeroepen vanuit ItemModal — direct retourneren zodat de modal
    // de updated item + meta kan tonen. Trigger achteraf reload zodat parent-
    // lijst ook is_draft=true ziet.
    const result = await klantenService.fillFieldsFromDossier(itemId);
    if (!result.error) reload();
    return result;
  }

  // A6 (U-cleanup): server-flow voor 0-items-scenario. ItemModal in create-
  // mode roept dit aan; server INSERTed direct een draft item met fields
  // gevuld. Daarna reload + modal sluiten in caller (ItemModal).
  async function handleCreateWithFieldsFromDossier(dimensionId) {
    if (!canvasId || !dimensionId) return { data: null, error: new Error("canvasId + dimensionId required") };
    const result = await klantenService.createItemWithFieldsFromDossier(canvasId, dimensionId);
    if (!result.error) reload();
    return result;
  }

  async function handleAcceptDraftItem(item) {
    if (dossierBusy) return;
    setDossierBusy({ action: "accept_item", id: item.id });
    setDossierError(null);
    const { error } = await klantenService.acceptDraftItem(item.id);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    reload();
  }

  async function handleRejectDraftItem(item) {
    if (dossierBusy) return;
    setDossierBusy({ action: "reject_item", id: item.id });
    setDossierError(null);
    const { error } = await klantenService.rejectDraftItem(item.id);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    reload();
  }

  async function handleAcceptDraftPain(pp) {
    if (dossierBusy) return;
    setDossierBusy({ action: "accept_pain", id: pp.id });
    setDossierError(null);
    const { error } = await klantenService.acceptDraftPainPoint(pp.id);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    reloadPains();
  }

  async function handleRejectDraftPain(pp) {
    if (dossierBusy) return;
    setDossierBusy({ action: "reject_pain", id: pp.id });
    setDossierError(null);
    const { error } = await klantenService.rejectDraftPainPoint(pp.id);
    setDossierBusy(null);
    if (error) { setDossierError(error); return; }
    reloadPains();
  }

  // Save-handler doorgegeven aan PijnpuntModal — { error } contract.
  // Doet diff-and-mutate op couplings: verwijdert weggevallen, voegt nieuwe toe.
  async function handleSavePijnpunt({ textMd, couplings: nextCouplings }) {
    if (!pijnModalState) return { error: new Error("modal context ontbreekt") };
    let painPointId = pijnModalState.painPoint?.id;

    if (pijnModalState.mode === "edit") {
      const upd = await klantenService.updatePainPoint(painPointId, { textMd });
      if (upd.error) return { error: upd.error };
    } else {
      const ins = await klantenService.createPainPoint({
        canvasId,
        textMd,
        sortOrder: painPoints ? painPoints.length * 10 : 0,
      });
      if (ins.error) return { error: ins.error };
      painPointId = ins.data?.id;
    }

    // Diff couplings: bestaand vs gewenst
    const initial = pijnModalState.initialCouplings || [];
    const initialKeys = new Set(initial.map(c => `${c.target_table}:${c.target_id}`));
    const nextKeys   = new Set(nextCouplings.map(c => `${c.target_table}:${c.target_id}`));

    const toRemove = initial.filter(c => !nextKeys.has(`${c.target_table}:${c.target_id}`));
    const toAdd    = nextCouplings.filter(c => !initialKeys.has(`${c.target_table}:${c.target_id}`));

    for (const c of toRemove) {
      const del = await klantenService.deleteCoupling(c.id);
      if (del.error) return { error: del.error };
    }
    for (const c of toAdd) {
      const ins = await klantenService.createCoupling({
        painPointId,
        targetTable: c.target_table,
        targetId: c.target_id,
      });
      if (ins.error) return { error: ins.error };
    }

    reloadPains();
    return { error: null };
  }

  // Save-handler doorgegeven aan DimensieModal — { error } contract.
  // Onderscheidt create vs edit op basis van dimModalState.mode.
  async function handleSaveDimensie({ archetype, name, description }) {
    if (!dimModalState) return { error: new Error("modal context ontbreekt") };
    let result;
    if (dimModalState.mode === "edit") {
      // Archetype niet wijzigbaar in edit-mode (datamodel-impact, F3 finding)
      result = await klantenService.updateDimension(dimModalState.dimension.id, {
        name,
        description,
      });
    } else {
      result = await klantenService.createDimension({
        canvasId,
        archetype,
        name,
        description,
        isOrdered: archetype === "klantreis",
        sortOrder: dimensions ? dimensions.length * 10 : 0,
      });
    }
    if (result.error) return { error: result.error };
    reload();
    return { error: null };
  }

  // Save-handler doorgegeven aan ItemModal — { error } contract.
  async function handleSaveItem(itemData) {
    if (!modalCtx) return { error: new Error("modal context ontbreekt") };
    const { dimension, item } = modalCtx;
    const result = item
      ? await klantenService.updateItem(item.id, itemData)
      : await klantenService.createItem({
          dimensionId: dimension.id,
          name: itemData.name,
          description: itemData.description,
          archetypeData: itemData.archetype_data,
        });
    if (result.error) return { error: result.error };
    reload();
    return { error: null };
  }

  // Stap 11.K.2 F16 — canonical-delete callbacks voor ItemModal + PijnpuntModal.
  // Hard-delete via bestaande service-functies; geen audit-event (consultant-
  // eigendom, niet AI-output). Reload na succes.
  async function handleDeleteItem(itemId) {
    const { error } = await klantenService.deleteItem(itemId);
    if (error) return { error };
    reload();
    return { error: null };
  }

  async function handleDeletePijnpunt(painId) {
    const { error } = await klantenService.deletePainPoint(painId);
    if (error) return { error };
    reloadPains();
    return { error: null };
  }

  // Stap Bundle 3 F21 — dimensie-delete met cascade (cd_items + cd_pain_point_couplings
  // via DB-FK ON DELETE CASCADE). Geen audit-event (consultant-eigendom).
  async function handleDeleteDimensie(dimensionId) {
    const { error } = await klantenService.deleteDimension(dimensionId);
    if (error) return { error };
    reload();
    reloadPains();
    return { error: null };
  }

  // Canvas-naam afleiden uit eerste item/dimensie of fallback.
  // (MVP: geen aparte canvas-meta-fetch; voor rapport-header laat ik
  // canvasName leeg zodat default "Canvas" zichtbaar is.)
  const canvasName = "";

  // Fase 2 design-systeem — drie-lagen-header. Shared component over alle
  // werkbladen. WERKRUIMTE/RAPPORT-toggle vervalt — Rapportage is een
  // aparte knop in WerkbladActieknoppen (designer §7 punt 1).
  const klantenTitel = appLabel("klanten.werkblad.titel", "Klanten & Dienstverlening");
  const fasenTabs = FASE_TABS.map(t => ({
    id: t.id,
    label: appLabel(t.labelKey, t.fallback),
    pillNum: t.num,
  }));

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
        <WerkbladHeader
          categorie="klanten"
          icon={Users}
          capsLabel="Werkblad"
          titel={klantenTitel}
          onClose={onClose}
          showLogo
          appTitle={appLabel("app.title", "Business Transformation Workbench")}
          versie={process.env.REACT_APP_VERSION || "0.1.0"}
          lang={lang}
          onLangSwitch={() => setLang(lang === "nl" ? "en" : "nl")}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
        <WerkbladHeader
          categorie="klanten"
          icon={Users}
          capsLabel="Werkblad"
          titel={klantenTitel}
          onClose={onClose}
          showLogo
          appTitle={appLabel("app.title", "Business Transformation Workbench")}
          versie={process.env.REACT_APP_VERSION || "0.1.0"}
          lang={lang}
          onLangSwitch={() => setLang(lang === "nl" ? "en" : "nl")}
        />
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="max-w-md">
            <p className="text-sm text-red-700 font-bold mb-2">Laden mislukt</p>
            <p className="text-xs text-slate-600 mb-4">{error.message}</p>
            <button onClick={reload} className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded">
              Opnieuw proberen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
      <WerkbladHeader
        categorie="klanten"
        icon={Users}
        capsLabel="Werkblad"
        titel={klantenTitel}
        onClose={onClose}
        showLogo
        appTitle={appLabel("app.title", "Business Transformation Workbench")}
        versie={process.env.REACT_APP_VERSION || "0.1.0"}
        lang={lang}
        onLangSwitch={() => setLang(lang === "nl" ? "en" : "nl")}
        overflowItems={[
          {
            id: "admin",
            label: "App config",
            icon: Settings,
            onClick: () => { window.location.href = "/admin"; },
            hidden: user?.email !== process.env.REACT_APP_ADMIN_EMAIL,
          },
          {
            id: "over",
            label: "Over Platform Workbench",
            icon: Info,
            onClick: () => setShowOverDialog(true),
            divider: true,
          },
          {
            id: "uitloggen",
            label: "Uitloggen",
            icon: LogOut,
            onClick: signOut,
            divider: true,
            danger: true,
          },
        ]}
        tabs={view === "werkruimte" ? fasenTabs : null}
        activeTabId={activeFase}
        onTabClick={(id) => setActiveFase(id)}
        actieknoppen={
          <WerkbladActieknoppen
            onBekijken={() => setActiveFase(3)}
            onRapportage={() => setView("rapport")}
            bekijkenDisabled={false}
            appLabel={appLabel}
          />
        }
      />

      {/* Stap 11.K dossier-actie-error-banner */}
      {dossierError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-xs px-6 py-2 flex items-center justify-between">
          <span>{dossierError.message || "Dossier-actie mislukt"}</span>
          <button
            type="button"
            onClick={() => setDossierError(null)}
            className="text-[10px] font-bold uppercase tracking-widest text-red-700 hover:text-red-900 ml-3"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* T4 A7: dossier "geen match"-info-banner (geen flicker meer) */}
      {dossierInfo && (
        <div
          data-testid={`klanten-dossier-info-banner-${dossierInfo.scope}`}
          className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-6 py-2 flex items-center justify-between"
        >
          <span>{dossierInfo.text}</span>
          <button
            type="button"
            onClick={() => setDossierInfo(null)}
            className="text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900 ml-3"
          >
            Sluiten
          </button>
        </div>
      )}

      {/* Body */}
      {view === "werkruimte" ? (
        <WerkruimteView
          canvasId={canvasId}
          activeFase={activeFase}
          onFaseChange={setActiveFase}
          dimensions={dimensions}
          items={items}
          painPoints={painPoints || []}
          couplings={couplings || []}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
          suggestionsError={suggestionsError}
          reloadSuggestions={reloadSuggestions}
          intents={intents}
          intentsLoading={intentsLoading}
          intentsError={intentsError}
          reloadIntents={reloadIntents}
          hasUploads={hasUploads}
          hasIndexedChunks={hasIndexedChunks}
          uploadsProcessing={uploadsProcessing}
          dossierBusy={dossierBusy}
          onExtractItemsFromDossier={handleExtractItemsFromDossier}
          onExtractPainsFromDossier={handleExtractPainsFromDossier}
          onAcceptDraftItem={handleAcceptDraftItem}
          onRejectDraftItem={handleRejectDraftItem}
          onAcceptDraftPain={handleAcceptDraftPain}
          onRejectDraftPain={handleRejectDraftPain}
          onItemClick={openEditItem}
          onAddItem={openCreateItem}
          onAddDimensie={openCreateDimensie}
          onEditDimensie={openEditDimensie}
          onAddPijnpunt={openCreatePijnpunt}
          onEditPijnpunt={openEditPijnpunt}
          onPromoteSuggestion={openPromoteModal}
        />
      ) : (
        <RapportView
          canvasName={canvasName}
          dimensions={dimensions}
          items={items}
          painPoints={painPoints || []}
          couplings={couplings || []}
          suggestions={suggestions || []}
          intents={intents || []}
          onClose={() => setView("werkruimte")}
        />
      )}

      {/* Item-modal */}
      {modalCtx && (
        <ItemModal
          item={modalCtx.item}
          dimension={modalCtx.dimension}
          onClose={closeModal}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
          onFillFieldsFromDossier={handleFillFieldsFromDossier}
          /* A6 (U-cleanup): 0-items-flow — create item met fields uit dossier */
          onCreateWithFieldsFromDossier={handleCreateWithFieldsFromDossier}
          hasUploads={hasUploads}
          hasIndexedChunks={hasIndexedChunks}
          uploadsProcessing={uploadsProcessing}
          /* T4 A9: items in zelfde dimensie voor client-side duplicate-name-validatie */
          existingItemsInDimension={(items || []).filter(it => it.dimension_id === modalCtx.dimension?.id)}
        />
      )}

      {/* Dimensie-modal (create + edit, stap 11.E + 11.F boy-scout; F21 delete-cascade) */}
      {dimModalState && (() => {
        const dim = dimModalState.dimension;
        const dimItemIds = (items || [])
          .filter(it => it.dimension_id === dim?.id)
          .map(it => it.id);
        const dimItemCount = dimItemIds.length;
        const dimCouplingCount = (couplings || []).filter(
          c => c.target_table === "cd_items" && dimItemIds.includes(c.target_id)
        ).length;
        return (
          <DimensieModal
            mode={dimModalState.mode}
            dimension={dim}
            onClose={closeDimModal}
            onSave={handleSaveDimensie}
            onDelete={handleDeleteDimensie}
            itemCount={dimItemCount}
            couplingCount={dimCouplingCount}
          />
        );
      })()}

      {/* Pijnpunt-modal (create + edit, stap 11.F fase 2; canonical-delete stap 11.K.2 F16) */}
      {pijnModalState && (
        <PijnpuntModal
          mode={pijnModalState.mode}
          painPoint={pijnModalState.painPoint}
          initialCouplings={pijnModalState.initialCouplings || []}
          dimensions={dimensions || []}
          items={items || []}
          onClose={closePijnModal}
          onSave={handleSavePijnpunt}
          onDelete={handleDeletePijnpunt}
        />
      )}

      {/* Promote-naar-intent modal (stap 11.H, vanuit AnalyseView collapse) */}
      {promoteSuggestion && (
        <PromoteToIntentModal
          suggestion={promoteSuggestion}
          onClose={closePromoteModal}
          onSubmit={handlePromoteSave}
        />
      )}

      {/* S4 — OverDialog vanuit laag-1 overflow-menu */}
      {showOverDialog && (
        <OverDialog onClose={() => setShowOverDialog(false)} />
      )}
    </div>
  );
}
