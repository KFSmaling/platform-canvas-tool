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
import { X, Layout, FileText } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import { useCanvasDimensions } from "./hooks/useCanvasDimensions";
import { usePainPoints } from "./hooks/usePainPoints";
import { usePatternSuggestions } from "./hooks/usePatternSuggestions";
import * as klantenService from "./services/klanten.service";
import WerkruimteView from "./WerkruimteView";
import RapportView from "./RapportView";
import ItemModal from "./ItemModal";
import DimensieModal from "./DimensieModal";
import PijnpuntModal from "./PijnpuntModal";

export default function KlantenWerkblad({ canvasId, onClose }) {
  const { label: appLabel } = useAppConfig();
  const { loading, error, dimensions, items, reload } = useCanvasDimensions(canvasId);
  const { painPoints, couplings, reload: reloadPains } = usePainPoints(canvasId);
  // Stap 11.G Vervolg-sessie B: KlantenWerkblad-niveau suggestions-load voor
  // RapportView. AnalyseView houdt eigen hook-instance (live reload na actions).
  const { suggestions } = usePatternSuggestions(canvasId);

  const [view, setView] = useState("werkruimte"); // "werkruimte" | "rapport"
  const [modalCtx, setModalCtx] = useState(null); // { dimension, item } of null
  // dimModalState: { mode: "create" | "edit", dimension?: object } of null
  const [dimModalState, setDimModalState] = useState(null);
  // pijnModalState: { mode, painPoint?, initialCouplings? } of null
  const [pijnModalState, setPijnModalState] = useState(null);

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

  // Canvas-naam afleiden uit eerste item/dimensie of fallback.
  // (MVP: geen aparte canvas-meta-fetch; voor rapport-header laat ik
  // canvasName leeg zodat default "Canvas" zichtbaar is.)
  const canvasName = "";

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
        <div className="flex items-center gap-3 px-8 py-4 bg-[var(--color-primary)]">
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
          <h2 className="text-lg font-bold text-white">{appLabel("klanten.werkblad.titel", "Klanten & Dienstverlening")}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
        <div className="flex items-center gap-3 px-8 py-4 bg-[var(--color-primary)]">
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
          <h2 className="text-lg font-bold text-white">{appLabel("klanten.werkblad.titel", "Klanten & Dienstverlening")}</h2>
        </div>
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
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-4 bg-[var(--color-primary)] flex-shrink-0">
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        <h2 className="text-lg font-bold text-white">{appLabel("klanten.werkblad.titel", "Klanten & Dienstverlening")}</h2>

        {/* Werkruimte/Rapport-toggle */}
        <div className="ml-6 flex items-center gap-1 bg-white/10 rounded-md p-0.5">
          <button
            onClick={() => setView("werkruimte")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${
              view === "werkruimte" ? "bg-white text-[var(--color-primary)]" : "text-white/70 hover:text-white"
            }`}
          >
            <Layout size={12} /> {appLabel("klanten.section.werkruimte", "Werkruimte")}
          </button>
          <button
            onClick={() => setView("rapport")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${
              view === "rapport" ? "bg-white text-[var(--color-primary)]" : "text-white/70 hover:text-white"
            }`}
          >
            <FileText size={12} /> {appLabel("klanten.section.rapport", "Rapport")}
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "werkruimte" ? (
        <WerkruimteView
          canvasId={canvasId}
          dimensions={dimensions}
          items={items}
          painPoints={painPoints || []}
          couplings={couplings || []}
          onItemClick={openEditItem}
          onAddItem={openCreateItem}
          onAddDimensie={openCreateDimensie}
          onEditDimensie={openEditDimensie}
          onAddPijnpunt={openCreatePijnpunt}
          onEditPijnpunt={openEditPijnpunt}
        />
      ) : (
        <RapportView
          canvasName={canvasName}
          dimensions={dimensions}
          items={items}
          painPoints={painPoints || []}
          couplings={couplings || []}
          suggestions={suggestions || []}
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
        />
      )}

      {/* Dimensie-modal (create + edit, stap 11.E + 11.F boy-scout) */}
      {dimModalState && (
        <DimensieModal
          mode={dimModalState.mode}
          dimension={dimModalState.dimension}
          onClose={closeDimModal}
          onSave={handleSaveDimensie}
        />
      )}

      {/* Pijnpunt-modal (create + edit, stap 11.F fase 2) */}
      {pijnModalState && (
        <PijnpuntModal
          mode={pijnModalState.mode}
          painPoint={pijnModalState.painPoint}
          initialCouplings={pijnModalState.initialCouplings || []}
          dimensions={dimensions || []}
          items={items || []}
          onClose={closePijnModal}
          onSave={handleSavePijnpunt}
        />
      )}
    </div>
  );
}
