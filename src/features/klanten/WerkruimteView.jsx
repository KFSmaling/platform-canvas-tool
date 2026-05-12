/**
 * WerkruimteView — fase-tabs + dimensie-grid (fase 1 actief in MVP).
 *
 * Props:
 *   - canvasId
 *   - dimensions, items
 *   - onItemClick(item)
 *   - onAddItem(dimension)
 *
 * Fase-tabs 2-4 zijn disabled met tooltip per instructie sectie 53.
 */

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import DimensieKolom from "./DimensieKolom";
import KlantreisChevronOverview from "./KlantreisChevronOverview";
import PijnpuntenView from "./PijnpuntenView";
import AnalyseView from "./AnalyseView";
import VerbeterrichtingenView from "./VerbeterrichtingenView";

// Stap 11.H: fase 4 enabled.
const FASE_TABS = [
  { num: 1, key: "label.klanten.fase.1.titel", fallback: "Inventarisatie", enabled: true },
  { num: 2, key: "label.klanten.fase.2.titel", fallback: "Pijnpunten",     enabled: true },
  { num: 3, key: "label.klanten.fase.3.titel", fallback: "Analyse",        enabled: true },
  { num: 4, key: "label.klanten.fase.4.titel", fallback: "Verbeteracties", enabled: true },
];

export default function WerkruimteView({
  canvasId,
  dimensions,
  items,
  painPoints,
  couplings,
  // Stap 11.G.4 F11-fix: suggestions/loading/error/reload-pass-through
  // van KlantenWerkblad naar AnalyseView (single source of truth).
  suggestions,
  suggestionsLoading,
  suggestionsError,
  reloadSuggestions,
  // Stap 11.H: intents single source of truth (pass-through via KlantenWerkblad)
  intents,
  intentsLoading,
  intentsError,
  reloadIntents,
  // Stap 11.K: dossier-affordance-context (single source of truth via useCanvasUploads)
  hasUploads,
  hasIndexedChunks,
  uploadsProcessing,
  dossierBusy,
  onExtractItemsFromDossier,
  onExtractPainsFromDossier,
  onAcceptDraftItem,
  onRejectDraftItem,
  onAcceptDraftPain,
  onRejectDraftPain,
  onItemClick,
  onAddItem,
  onAddDimensie,
  onEditDimensie,
  onAddPijnpunt,
  onEditPijnpunt,
  onPromoteSuggestion,
}) {
  const { label: appLabel } = useAppConfig();
  const [activeFase, setActiveFase] = useState(1);

  const itemsByDim = (dimId) => items.filter(i => i.dimension_id === dimId);

  // F26-iteratie — klantreis-top-strip-logica.
  // Conditional: klantreis-dim aanwezig + ≥3 canonical items (designer-spec
  // — chevron-flow niet zinvol bij <3 stages, val terug naar grid).
  const klantreisDim = dimensions.find(d => d.archetype === "klantreis");
  const klantreisItemsSorted = klantreisDim
    ? items
        .filter(i => i.dimension_id === klantreisDim.id && !i.is_draft)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];
  const showKlantreisTopStrip = klantreisDim && klantreisItemsSorted.length >= 3;
  const otherDimensions = showKlantreisTopStrip
    ? dimensions.filter(d => d.id !== klantreisDim.id)
    : dimensions;

  // Pijn-counts voor top-strip (fase 2+).
  const klantreisPainCounts = (() => {
    if (!showKlantreisTopStrip) return new Map();
    const klantreisItemIds = new Set(klantreisItemsSorted.map(i => i.id));
    const map = new Map();
    for (const c of (couplings || [])) {
      if (c.target_table !== "cd_items" || !klantreisItemIds.has(c.target_id)) continue;
      map.set(c.target_id, (map.get(c.target_id) || 0) + 1);
    }
    return map;
  })();

  // Klik op chevron in top-strip → open modal (geen scroll-to-card meer want
  // klantreis-cards bestaan niet in grid bij showKlantreisTopStrip).
  const handleTopStripChevronClick = (itemId) => {
    const item = klantreisItemsSorted.find(i => i.id === itemId);
    if (item) onItemClick(item);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Fase-tabs */}
      <div className="px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {FASE_TABS.map(tab => {
              const isActive = activeFase === tab.num;
              const tooltip = tab.enabled ? null : appLabel("klanten.fase.disabled.tooltip", "komt in latere sprint");
              return (
                <button
                  key={tab.num}
                  type="button"
                  onClick={() => tab.enabled && setActiveFase(tab.num)}
                  disabled={!tab.enabled}
                  title={tooltip || undefined}
                  className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : tab.enabled
                        ? "border-slate-300 text-slate-600 hover:border-slate-500"
                        : "border-slate-200 text-slate-300 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span className="mr-1.5">{tab.num} ·</span>
                  {appLabel(tab.key, tab.fallback)}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-400 italic uppercase tracking-widest">
            {appLabel("klanten.helper.fase.geen_volgorde", "geen verplichte volgorde")}
          </span>
        </div>
      </div>

      {/* Fase-content */}
      {activeFase === 4 ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <VerbeterrichtingenView
            canvasId={canvasId}
            intents={intents}
            loading={intentsLoading}
            error={intentsError}
            reload={reloadIntents}
          />
        </div>
      ) : activeFase === 3 ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnalyseView
            canvasId={canvasId}
            dimensions={dimensions}
            items={items}
            painPoints={painPoints || []}
            couplings={couplings || []}
            suggestions={suggestions}
            loading={suggestionsLoading}
            error={suggestionsError}
            reload={reloadSuggestions}
            onPromoteSuggestion={onPromoteSuggestion}
            intents={intents}
          />
        </div>
      ) : activeFase === 2 ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <PijnpuntenView
            dimensions={dimensions}
            items={items}
            painPoints={painPoints || []}
            couplings={couplings || []}
            onAddPijnpunt={onAddPijnpunt}
            onEditPijnpunt={onEditPijnpunt}
            onExtractFromDossier={onExtractPainsFromDossier}
            onAcceptDraftPain={onAcceptDraftPain}
            onRejectDraftPain={onRejectDraftPain}
            hasUploads={hasUploads}
            hasIndexedChunks={hasIndexedChunks}
            uploadsProcessing={uploadsProcessing}
            busyAction={dossierBusy}
            klantreisTopStripActive={showKlantreisTopStrip}
            klantreisItemsSorted={klantreisItemsSorted}
            klantreisPainCounts={klantreisPainCounts}
            klantreisDim={klantreisDim}
            onKlantreisChevronClick={handleTopStripChevronClick}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-auto p-8">
        {/* Fase 1 — Inventarisatie (dimensie-grid) */}
        {dimensions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 italic mb-1">Nog geen dimensies in dit canvas.</p>
            <p className="text-[11px] text-slate-400 mb-6">
              {appLabel("klanten.helper.iteratief", "werk in uitvoering — geen 'klaar' status")}
            </p>
            <button
              type="button"
              onClick={onAddDimensie}
              data-testid="dimensie-cta-eerste"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[11px] font-bold uppercase tracking-widest rounded-md transition-colors"
            >
              <Plus size={14} />
              {appLabel("klanten.knop.dimensie.toevoegen.eerste", "+ Eerste dimensie aanmaken")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={onAddDimensie}
                data-testid="dimensie-cta-extra"
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-1.5 rounded-sm transition-colors"
              >
                <Plus size={12} />
                {appLabel("klanten.knop.dimensie.toevoegen", "+ dimensie")}
              </button>
            </div>
            {/* F26-iteratie — klantreis volle-breedte-strip top (alleen bij
                ≥3 stages — anders val klantreis terug naar reguliere grid). */}
            {showKlantreisTopStrip && (
              <div
                data-testid="klantreis-top-strip-container"
                className="w-full mb-5 border border-slate-200 rounded-md bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="text-sm font-bold text-[var(--color-primary)]">{klantreisDim.name}</h4>
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest">
                    {klantreisDim.archetype} · {klantreisItemsSorted.length} stages
                  </span>
                </div>
                <KlantreisChevronOverview
                  items={klantreisItemsSorted}
                  painPointCounts={klantreisPainCounts}
                  currentPhase={activeFase}
                  onChevronClick={handleTopStripChevronClick}
                  fullWidth
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {otherDimensions.map(dim => (
                <DimensieKolom
                  key={dim.id}
                  dimension={dim}
                  items={itemsByDim(dim.id)}
                  couplings={couplings || []}
                  currentPhase={activeFase}
                  onItemClick={onItemClick}
                  onAddItem={() => onAddItem(dim)}
                  onEditDimensie={onEditDimensie}
                  onExtractFromDossier={onExtractItemsFromDossier}
                  onAcceptDraft={onAcceptDraftItem}
                  onRejectDraft={onRejectDraftItem}
                  hasUploads={hasUploads}
                  hasIndexedChunks={hasIndexedChunks}
                  uploadsProcessing={uploadsProcessing}
                  busyAction={dossierBusy}
                />
              ))}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
