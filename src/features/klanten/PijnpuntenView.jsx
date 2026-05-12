/**
 * PijnpuntenView — fase-2-content in WerkruimteView (RFC-001 §2.3 + §2.4).
 *
 * Layout (anker prototype regel 167-211):
 *   1. Compacte dimensie-grid bovenaan (read-only) met red-dot-markers per item
 *      dat een coupling heeft.
 *   2. Pijnpunten-lijst (cards met tekst + chips) — gegroepeerd in 2-kolom-grid,
 *      overstijgende pijnpunten span 2 kolommen.
 *   3. "+ pijnpunt"-CTA onderaan.
 *
 * Props:
 *   - dimensions, items (uit useCanvasDimensions)
 *   - painPoints, couplings (uit usePainPoints)
 *   - onAddPijnpunt()  — opent PijnpuntModal in create-mode
 *   - onEditPijnpunt(painPoint) — opent PijnpuntModal in edit-mode
 */

import React from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import PijnpuntCard from "./PijnpuntCard";
import KlantreisChevronOverview from "./KlantreisChevronOverview";
import PijnpuntChevronCard from "./PijnpuntChevronCard";

// Stap Bundle 3 F27 — gekoppelde pain_point_ids per item-id.
// Vervangt de oude `couplingCountByItem`-counts door arrays zodat ItemCard-
// indicator-bolletjes het volgnummer kan tonen (cross-referentie met
// PijnpuntCard-badge).
function painIdsByItem(couplings) {
  const map = new Map();
  for (const c of couplings) {
    if (c.target_table !== "cd_items") continue;
    if (!map.has(c.target_id)) map.set(c.target_id, []);
    map.get(c.target_id).push(c.pain_point_id);
  }
  return map;
}

function CompactDimensieKolom({ dimension, items, painsByItem, painNumberById }) {
  const dimItems = items.filter(it => it.dimension_id === dimension.id);
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="font-medium text-[12px] mb-2">{dimension.name}</div>
      {dimItems.length === 0 ? (
        <p className="text-[10px] text-slate-400 italic">geen items</p>
      ) : (
        <div className="space-y-1.5">
          {dimItems.map(it => {
            const painIds = painsByItem.get(it.id) || [];
            const visibleNums = painIds
              .map(pid => painNumberById.get(pid))
              .filter(Boolean)
              .sort((a, b) => a - b);
            const shown = visibleNums.slice(0, 5);
            const overflow = visibleNums.length - shown.length;
            return (
              <div key={it.id} className="bg-slate-50 px-3 py-1.5 rounded flex justify-between items-center">
                <div className="text-[12px]">{it.name}</div>
                {visibleNums.length > 0 && (
                  <div className="flex gap-1 items-center" data-testid={`item-pijn-indicators-${it.id}`}>
                    {shown.map(n => (
                      <span
                        key={n}
                        data-testid={`item-pijn-num-${it.id}-${n}`}
                        className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none"
                      >
                        {n}
                      </span>
                    ))}
                    {overflow > 0 && <span className="text-[9px] text-red-600 ml-1">+{overflow}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PijnpuntenView({
  dimensions = [],
  items = [],
  painPoints = [],
  couplings = [],
  onAddPijnpunt,
  onEditPijnpunt,
  // Stap 11.K — A3 dossier-extract + draft-acties
  onExtractFromDossier,
  onAcceptDraftPain,
  onRejectDraftPain,
  hasIndexedChunks = false,
  hasUploads = false,
  uploadsProcessing = false,
  busyAction = null,
  // F26-iteratie — klantreis volle-breedte-strip + pijnpunt-chevron-flow
  klantreisTopStripActive = false,
  klantreisItemsSorted = [],
  klantreisPainCounts = new Map(),
  klantreisDim = null,
  onKlantreisChevronClick,
}) {
  const { label: appLabel } = useAppConfig();
  const painsByItem = painIdsByItem(couplings);
  const couplingsByPain = new Map();
  for (const c of couplings) {
    if (!couplingsByPain.has(c.pain_point_id)) couplingsByPain.set(c.pain_point_id, []);
    couplingsByPain.get(c.pain_point_id).push(c);
  }

  // Stap Bundle 3 F27 — stabiele nummering per canonical-pijnpunt
  // (gesorteerd via service-laag op sort_order ASC). Index `i+1` voor 1-based
  // weergave. Drafts krijgen geen nummer — pas na accept-draft (canonical)
  // verschijnt het pijnpunt in de genummerde lijst.
  const canonicalSorted = painPoints.filter(pp => !pp.is_draft);
  const painNumberById = new Map(canonicalSorted.map((pp, i) => [pp.id, i + 1]));

  const canonicalItemCount = items.filter(it => !it.is_draft).length;
  const a3HasCallback = typeof onExtractFromDossier === "function";
  const a3Busy = busyAction?.action === "dossier_extract_pains";
  const a3Disabled = !hasIndexedChunks || canonicalItemCount === 0 || uploadsProcessing;
  const a3Tooltip = canonicalItemCount === 0
    ? appLabel("klanten.dossier.disabled_no_items", "Voeg eerst items toe")
    : !hasUploads
      ? appLabel("klanten.dossier.disabled_no_uploads", "Upload eerst documenten")
      : uploadsProcessing
        ? appLabel("klanten.dossier.disabled_processing", "Documenten worden nog verwerkt")
        : null;

  // Splits canonical en draft pijnpunten — render draft als aparte card-stijl
  const canonicalPains = painPoints.filter(pp => !pp.is_draft);
  const draftPains     = painPoints.filter(pp =>  pp.is_draft);

  // F26-iteratie — split canonical-pijnpunten in op-klantreis vs andere-dims.
  // Een pijnpunt is "op klantreis" als ≥1 coupling target is een klantreis-item.
  // Sortering: gegroepeerd op stage-volgorde (zelfde sort_order als klantreis-
  // items zelf — designer-spec Layout B doorlopend in leesrichting).
  const klantreisItemIds = klantreisTopStripActive
    ? new Set(klantreisItemsSorted.map(i => i.id))
    : new Set();
  const klantreisItemSortOrder = klantreisTopStripActive
    ? new Map(klantreisItemsSorted.map((it, idx) => [it.id, idx]))
    : new Map();
  const klantreisItemShortName = (it) => {
    const stapType = it?.archetype_data?.stap_type;
    return stapType
      ? appLabel(`klanten.klantreis.stap_type.${stapType}.short`, it.name)
      : (it?.name || "");
  };

  const isPainOnKlantreis = (pp) => {
    if (!klantreisTopStripActive) return false;
    const ppCouplings = couplingsByPain.get(pp.id) || [];
    return ppCouplings.some(c => c.target_table === "cd_items" && klantreisItemIds.has(c.target_id));
  };

  // Per pijnpunt: bepaal "primary stage" — eerste klantreis-item-koppeling
  // (op stage-volgorde) voor pill-tekst + voor flow-sortering.
  const primaryStageForPain = (pp) => {
    const ppCouplings = couplingsByPain.get(pp.id) || [];
    let best = null;
    let bestOrder = Infinity;
    for (const c of ppCouplings) {
      if (c.target_table !== "cd_items" || !klantreisItemIds.has(c.target_id)) continue;
      const ord = klantreisItemSortOrder.get(c.target_id);
      if (ord != null && ord < bestOrder) {
        bestOrder = ord;
        best = c.target_id;
      }
    }
    return best ? { itemId: best, order: bestOrder } : null;
  };

  // Per pijnpunt: count extra dimensies (= dimensies anders dan klantreis-dim
  // waarvan ≥1 item gekoppeld is).
  const extraDimensieCount = (pp) => {
    const ppCouplings = couplingsByPain.get(pp.id) || [];
    const dims = new Set();
    for (const c of ppCouplings) {
      if (c.target_table === "cd_dimensions" && c.target_id !== klantreisDim?.id) {
        dims.add(c.target_id);
      } else if (c.target_table === "cd_items") {
        const it = items.find(i => i.id === c.target_id);
        if (it && it.dimension_id !== klantreisDim?.id) dims.add(it.dimension_id);
      }
    }
    return dims.size;
  };

  const klantreisPains = canonicalPains
    .filter(isPainOnKlantreis)
    .map(pp => ({ pp, stage: primaryStageForPain(pp) }))
    .sort((a, b) => (a.stage?.order ?? 0) - (b.stage?.order ?? 0));
  const andereDimsPains = klantreisTopStripActive
    ? canonicalPains.filter(pp => !isPainOnKlantreis(pp))
    : canonicalPains;

  // Bij top-strip-active: andere-dims-grid filtert klantreis-dim weg
  // (klantreis-content zit al in top-strip + flow).
  const andereDimensies = klantreisTopStripActive
    ? dimensions.filter(d => d.id !== klantreisDim?.id)
    : dimensions;

  return (
    <div className="px-8 py-6 overflow-auto">
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
        {appLabel("klanten.pijnpunt.intro", "verzamel waarnemingen en koppel aan items. multi-relationeel — een pijnpunt mag aan meerdere dimensies hangen, of nergens (overstijgend).")}
      </p>

      {/* F26-iteratie — klantreis volle-breedte-strip top (fase 2 met pijn-
          overlay) + doorlopende horizontale flow met PijnpuntChevronCards
          eronder. Bij <3 stages valt klantreis terug naar reguliere
          inventaris-grid hieronder (geen top-strip). */}
      {klantreisTopStripActive && (
        <div
          data-testid="klantreis-top-strip-container"
          className="w-full mb-5 border border-slate-200 rounded-md bg-white p-4 shadow-sm"
        >
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-bold text-[var(--color-primary)]">{klantreisDim?.name}</h4>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest">
              {klantreisDim?.archetype} · {klantreisItemsSorted.length} stages
            </span>
          </div>
          <KlantreisChevronOverview
            items={klantreisItemsSorted}
            painPointCounts={klantreisPainCounts}
            currentPhase={2}
            onChevronClick={onKlantreisChevronClick}
            fullWidth
          />
          {/* Doorlopende horizontale flow van pijnpunt-chevron-cards
              (Layout B uit designer-result — gesorteerd op stage-volgorde,
              horizontale scroll-strook bij overflow). */}
          {klantreisPains.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                {appLabel(
                  "klanten.pijnpunten.klantreis.flow.titel",
                  "Pijnpunten op klantreis · {N} stuks"
                ).replace("{N}", String(klantreisPains.length))}
              </div>
              <div
                data-testid="klantreis-pijnpunten-flow"
                className="flex items-stretch gap-2 overflow-x-auto pb-2 pl-2"
              >
                {klantreisPains.map(({ pp, stage }, idx) => {
                  const stageItem = stage ? klantreisItemsSorted.find(i => i.id === stage.itemId) : null;
                  const stageNum  = stage ? stage.order + 1 : null;
                  const stageShort = stageItem ? klantreisItemShortName(stageItem) : "";
                  return (
                    <PijnpuntChevronCard
                      key={pp.id}
                      pijnpunt={pp}
                      nummer={painNumberById.get(pp.id)}
                      stageNummer={stageNum}
                      stageShortName={stageShort}
                      extraDimensieCount={extraDimensieCount(pp)}
                      clipIdx={idx}
                      clipTotal={klantreisPains.length}
                      onClick={onEditPijnpunt}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compacte inventaris-grid bovenaan (alleen andere dimensies bij
          top-strip-active — klantreis-content zit al boven) */}
      {andereDimensies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {klantreisTopStripActive && (
            <div className="col-span-full text-[10px] font-bold uppercase tracking-widest text-slate-500 -mb-1">
              {appLabel(
                "klanten.pijnpunten.andere_dims.titel",
                "Pijnpunten andere dimensies · {N} stuks"
              ).replace("{N}", String(andereDimsPains.length))}
            </div>
          )}
          {andereDimensies.map(dim => (
            <CompactDimensieKolom
              key={dim.id}
              dimension={dim}
              items={items}
              painsByItem={painsByItem}
              painNumberById={painNumberById}
            />
          ))}
        </div>
      )}

      {/* Pijnpunten-lijst */}
      <div className="flex justify-between items-baseline mb-3">
        <div className="font-medium text-sm text-[var(--color-primary)]">
          {appLabel("klanten.pijnpunt.lijst.titel", "Pijnpunten")}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-slate-400">
            {painPoints.length} · {appLabel("klanten.pijnpunt.lijst.helper", "card laat koppelingen zien als chips")}
          </div>
          {a3HasCallback && (
            <button
              type="button"
              onClick={onExtractFromDossier}
              disabled={a3Disabled || a3Busy}
              data-testid="dossier-pain-points-extract"
              title={a3Tooltip || undefined}
              className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
                a3Disabled
                  ? "text-slate-400 cursor-not-allowed opacity-60"
                  : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              }`}
            >
              {a3Busy ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {appLabel("klanten.dossier.pain_points_extract", "Pijnpunten extraheren vanuit dossier")}
            </button>
          )}
        </div>
      </div>

      {/* Draft-pijnpunten (uit dossier-extract A3) */}
      {draftPains.length > 0 && (
        <div className="mb-4 space-y-2" data-testid="draft-pains-section">
          {draftPains.map(pp => (
            <DraftPainCard
              key={pp.id}
              painPoint={pp}
              onClick={() => onEditPijnpunt && onEditPijnpunt(pp)}
              onAccept={() => onAcceptDraftPain && onAcceptDraftPain(pp)}
              onReject={() => onRejectDraftPain && onRejectDraftPain(pp)}
              busy={busyAction?.id === pp.id}
              appLabel={appLabel}
            />
          ))}
        </div>
      )}

      {painPoints.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-300 rounded">
          <p className="text-sm text-slate-500 italic mb-3">
            {appLabel("klanten.pijnpunt.lijst.leeg", "Nog geen pijnpunten — voeg er één toe.")}
          </p>
          <button
            type="button"
            onClick={onAddPijnpunt}
            data-testid="pijnpunt-cta-eerste"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[11px] font-bold uppercase tracking-widest rounded-md transition-colors"
          >
            <Plus size={14} />
            {appLabel("klanten.pijnpunt.knop.toevoegen.eerste", "+ Eerste pijnpunt aanmaken")}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {andereDimsPains.map(pp => (
              <PijnpuntCard
                key={pp.id}
                painPoint={pp}
                nummer={painNumberById.get(pp.id)}
                couplings={couplingsByPain.get(pp.id) || []}
                dimensions={dimensions}
                items={items}
                onClick={onEditPijnpunt}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAddPijnpunt}
              data-testid="pijnpunt-cta-extra"
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-1.5 rounded-sm transition-colors"
            >
              <Plus size={12} />
              {appLabel("klanten.pijnpunt.knop.toevoegen", "+ pijnpunt")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Stap 11.K — Draft-pijnpunt-card met opacity + badge + Markeer/Bewerk/Verwijder
function DraftPainCard({ painPoint, onClick, onAccept, onReject, busy, appLabel }) {
  return (
    <div
      data-testid={`draft-pain-${painPoint.id}`}
      data-is-draft="true"
      className="border border-dashed border-blue-300 rounded px-3 py-2.5 bg-blue-50/40"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-700">
          {appLabel("klanten.dossier.draft_badge", "dossier-suggestie")}
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <p className="text-[12.5px] text-slate-800 whitespace-pre-wrap leading-relaxed">
          {painPoint.text_md}
        </p>
      </button>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200/60">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          data-testid={`draft-pain-accept-${painPoint.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.markeer", "Markeer als richting")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClick}
          data-testid={`draft-pain-edit-${painPoint.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.bewerk", "Bewerk")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          data-testid={`draft-pain-reject-${painPoint.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors text-slate-500 hover:text-red-700 disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.verwijder", "Verwijder")}
        </button>
      </div>
    </div>
  );
}
