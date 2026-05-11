/**
 * DimensieKolom — één kolom in de dimensie-grid van WerkruimteView.
 *
 * Stap 11.K: A1 dossier-extract AI-knop + draft-row-rendering. Draft-items
 * krijgen opacity-60 + "dossier-suggestie"-badge + Bewerk/Verwijder/Markeer-
 * acties (per F13 werkblad-onderdeel-prefix: dossier.actie.*-keys).
 *
 * Props:
 *   - dimension: { id, archetype, name, description }
 *   - items: array filtered op deze dimensie (incl. draft-items)
 *   - onItemClick(item)        — opent ItemModal (canonical of draft-bewerk)
 *   - onAddItem()              — opent ItemModal in create-mode
 *   - onEditDimensie(dim)
 *   - onExtractFromDossier(dim) — A1, KlantenWerkblad-level
 *   - onAcceptDraft(item)      — draft → canonical
 *   - onRejectDraft(item)      — draft → delete
 *   - hasIndexedChunks, hasUploads, uploadsProcessing  (via useCanvasUploads)
 *   - busyAction: { action, id? } of null
 */

import React from "react";
import { Sparkles, Plus, Pencil, Loader2 } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

export default function DimensieKolom({
  dimension,
  items,
  onItemClick,
  onAddItem,
  onEditDimensie,
  onExtractFromDossier,
  onAcceptDraft,
  onRejectDraft,
  hasIndexedChunks = false,
  hasUploads = false,
  uploadsProcessing = false,
  busyAction = null,
}) {
  const { label: appLabel } = useAppConfig();

  const headerClickable = typeof onEditDimensie === "function";
  const hasExtractCallback = typeof onExtractFromDossier === "function";
  const extractDisabled = !hasIndexedChunks || uploadsProcessing;
  const extractBusy = busyAction?.action === "dossier_extract_items" && busyAction?.dimensionId === dimension.id;

  const extractTooltip = !hasUploads
    ? appLabel("klanten.dossier.disabled_no_uploads", "Upload eerst documenten")
    : uploadsProcessing
      ? appLabel("klanten.dossier.disabled_processing", "Documenten worden nog verwerkt")
      : null;

  return (
    <div className="bg-white border border-slate-200 rounded-md flex flex-col min-h-[400px]">
      {/* Header — klikbaar voor edit-modal */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-baseline justify-between">
          {headerClickable ? (
            <button
              type="button"
              onClick={() => onEditDimensie(dimension)}
              data-testid={`dimensie-edit-${dimension.id}`}
              className="group flex items-center gap-1.5 text-left hover:text-[var(--color-accent)] transition-colors"
              title={appLabel("klanten.dimensie.edit.tooltip", "Klik om te bewerken")}
            >
              <h4 className="text-sm font-bold text-[var(--color-primary)] group-hover:text-[var(--color-accent)]">{dimension.name}</h4>
              <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          ) : (
            <h4 className="text-sm font-bold text-[var(--color-primary)]">{dimension.name}</h4>
          )}
          <span className="text-[9px] text-slate-400 uppercase tracking-widest">{dimension.archetype}</span>
        </div>
        {dimension.description && (
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{dimension.description}</p>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-2 overflow-auto">
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">Nog geen items — voeg er één toe.</p>
        )}
        {items.map(item => (
          item.is_draft ? (
            <DraftItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
              onAccept={() => onAcceptDraft && onAcceptDraft(item)}
              onReject={() => onRejectDraft && onRejectDraft(item)}
              busy={busyAction?.id === item.id}
              appLabel={appLabel}
            />
          ) : (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className="w-full text-left border border-slate-200 rounded px-3 py-2 hover:border-[var(--color-accent)] hover:bg-slate-50 transition-colors"
            >
              <div className="text-sm font-medium text-slate-800">{item.name}</div>
              {item.description && (
                <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
              )}
            </button>
          )
        ))}
      </div>

      {/* Footer: add + AI-affordance (Stap 11.K — A1) */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] hover:text-[var(--color-accent)] uppercase tracking-widest"
        >
          <Plus size={12} />
          {appLabel("klanten.knop.item.toevoegen", "+ item")}
        </button>
        {hasExtractCallback ? (
          <button
            type="button"
            onClick={() => onExtractFromDossier(dimension)}
            disabled={extractDisabled || extractBusy}
            data-testid={`dossier-items-extract-${dimension.id}`}
            title={extractTooltip || undefined}
            className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
              extractDisabled
                ? "text-slate-400 cursor-not-allowed opacity-60"
                : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            }`}
          >
            {extractBusy ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            {appLabel("klanten.dossier.items_extract", "Items vanuit dossier")}
          </button>
        ) : (
          <button
            type="button"
            disabled
            title={appLabel("klanten.ai.disabled.tooltip", "AI komt in fase 3")}
            className="flex items-center gap-1 text-[10px] text-slate-400 cursor-not-allowed opacity-60"
          >
            <Sparkles size={10} />
            {appLabel("klanten.ai.cluster", "Cluster-analyse")}
          </button>
        )}
      </div>
    </div>
  );
}

function DraftItemCard({ item, onClick, onAccept, onReject, busy, appLabel }) {
  return (
    <div
      data-testid={`draft-item-${item.id}`}
      data-is-draft="true"
      className="w-full border border-dashed border-blue-300 rounded px-3 py-2 bg-blue-50/40 opacity-90"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-700">
          {appLabel("klanten.dossier.draft_badge", "dossier-suggestie")}
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="text-sm font-medium text-slate-800">{item.name}</div>
        {item.description && (
          <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
        )}
      </button>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200/60">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          data-testid={`draft-item-accept-${item.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.markeer", "Markeer als richting")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClick}
          data-testid={`draft-item-edit-${item.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.bewerk", "Bewerk")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          data-testid={`draft-item-reject-${item.id}`}
          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-colors text-slate-500 hover:text-red-700 disabled:opacity-50"
        >
          {appLabel("klanten.dossier.actie.verwijder", "Verwijder")}
        </button>
      </div>
    </div>
  );
}
