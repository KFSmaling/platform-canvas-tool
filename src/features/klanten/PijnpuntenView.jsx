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

// Aantal couplings per item-id — voor red-dot-marker in inventaris-grid
function couplingCountByItem(couplings) {
  const counts = new Map();
  for (const c of couplings) {
    if (c.target_table !== "cd_items") continue;
    counts.set(c.target_id, (counts.get(c.target_id) || 0) + 1);
  }
  return counts;
}

function CompactDimensieKolom({ dimension, items, couplingCounts }) {
  const dimItems = items.filter(it => it.dimension_id === dimension.id);
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="font-medium text-[12px] mb-2">{dimension.name}</div>
      {dimItems.length === 0 ? (
        <p className="text-[10px] text-slate-400 italic">geen items</p>
      ) : (
        <div className="space-y-1.5">
          {dimItems.map(it => {
            const count = couplingCounts.get(it.id) || 0;
            return (
              <div key={it.id} className="bg-slate-50 px-3 py-1.5 rounded flex justify-between items-center">
                <div className="text-[12px]">{it.name}</div>
                {count > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(count, 5) }).map((_, idx) => (
                      <span key={idx} className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    ))}
                    {count > 5 && <span className="text-[9px] text-red-600 ml-1">+{count - 5}</span>}
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
}) {
  const { label: appLabel } = useAppConfig();
  const couplingCounts = couplingCountByItem(couplings);
  const couplingsByPain = new Map();
  for (const c of couplings) {
    if (!couplingsByPain.has(c.pain_point_id)) couplingsByPain.set(c.pain_point_id, []);
    couplingsByPain.get(c.pain_point_id).push(c);
  }

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

  return (
    <div className="px-8 py-6 overflow-auto">
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
        {appLabel("klanten.pijnpunt.intro", "verzamel waarnemingen en koppel aan items. multi-relationeel — een pijnpunt mag aan meerdere dimensies hangen, of nergens (overstijgend).")}
      </p>

      {/* Compacte inventaris-grid bovenaan */}
      {dimensions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {dimensions.map(dim => (
            <CompactDimensieKolom
              key={dim.id}
              dimension={dim}
              items={items}
              couplingCounts={couplingCounts}
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
            {canonicalPains.map(pp => (
              <PijnpuntCard
                key={pp.id}
                painPoint={pp}
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
