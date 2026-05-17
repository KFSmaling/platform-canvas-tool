/**
 * InzichtItem — één bevinding als lees-sectie (document-stijl)
 *
 * Visueel: geen card/border, geen gekleurde achtergrond per bevinding.
 * Bevindingen zijn lees-secties gescheiden door een subtiele border-bottom.
 * Gebaseerd op docs/prototypes/inzichten-prototype-v2.html.
 *
 * Color mapping: docs/inzichten-68-color-mapping.md
 *
 * RFC-008 §C — werkblad-agnostisch component in `src/shared/components/inzichten/`.
 * RFC-008 §4 — per-bevinding edit-mode + in_rapport-toggle:
 *   - Hover-only ✎ pencil-icon top-right opent inline-edit (2 textareas + Save/Cancel)
 *   - Pill-toggle top-right ("in rapport: aan/uit") — default false
 *   - "bewerkt"-label onder tekst als consultant edited_* heeft gevuld
 *   - Render-prio: edited_observation/edited_recommendation > AI-originelen
 *
 * Props:
 *   insight       — { id, category, type, title, observation, recommendation,
 *                     source_refs[], in_rapport?, edited_observation?,
 *                     edited_recommendation?, last_edited_at?, last_edited_by? }
 *   appLabel      — (key, fallback) => string
 *   onSave?       — async (insightId, { edited_observation, edited_recommendation })
 *                   => Promise<{ data, error }>
 *                   Optioneel: zonder onSave is component pure-read (geen pencil).
 *   onToggleRapport? — async (insightId, in_rapport_bool)
 *                       => Promise<{ data, error }>
 *                       Optioneel: zonder = geen toggle zichtbaar.
 *
 * Named exports:
 *   TYPE_CONFIG — gebruikt door InzichtenOverlay voor TOC-dots
 *   FALLBACK_TYPE
 */

import React, { useState } from "react";
import { Minus, AlertTriangle, TrendingUp, CheckCircle, Pencil } from "lucide-react";

// ── Type-configuratie ─────────────────────────────────────────────────────────
// Kleur-toewijzing via Tailwind semantic names — nooit hardcoded hex.
// dotColor = TOC-indicator (geëxporteerd voor gebruik in InzichtenOverlay).
// Kleuren per color-mapping doc: zwak → amber-700, kans → blue-600 (dichter bij proto).
export const TYPE_CONFIG = {
  ontbreekt: {
    Icon:       Minus,
    labelKey:   "analysis.type.ontbreekt",
    labelFb:    "Ontbreekt",
    color:      "text-red-700",
    bg:         "bg-red-50",
    dotColor:   "bg-red-700",
  },
  zwak: {
    Icon:       AlertTriangle,
    labelKey:   "analysis.type.zwak",
    labelFb:    "Zwak punt",
    color:      "text-amber-700",
    bg:         "bg-amber-50",
    dotColor:   "bg-amber-700",
  },
  kans: {
    Icon:       TrendingUp,
    labelKey:   "analysis.type.kans",
    labelFb:    "Kans",
    color:      "text-blue-600",
    bg:         "bg-blue-50",
    dotColor:   "bg-blue-600",
  },
  sterk: {
    Icon:       CheckCircle,
    labelKey:   "analysis.type.sterk",
    labelFb:    "Sterkte",
    color:      "text-green-700",
    bg:         "bg-green-50",
    dotColor:   "bg-green-700",
  },
};

export const FALLBACK_TYPE = TYPE_CONFIG.zwak;

// ── Bron-link ────────────────────────────────────────────────────────────────
function SourceLink({ source, isLast }) {
  const { label, exists } = source;
  return (
    <>
      {exists === false ? (
        <span className="inline border border-dashed border-red-400 text-red-600 text-[10px] px-1 rounded leading-normal">
          {label} (ontbreekt)
        </span>
      ) : (
        <span className="text-slate-600 underline decoration-slate-200 underline-offset-2 hover:decoration-slate-400 transition-colors cursor-default">
          {label}
        </span>
      )}
      {!isLast && (
        <span className="mx-2 text-slate-300 select-none" aria-hidden="true">·</span>
      )}
    </>
  );
}

// ── In-rapport pill-toggle ───────────────────────────────────────────────────
// RFC-008 §4b — pill rechts boven per bevinding ("in rapport: aan/uit").
// Aan: gevuld accent-bg, primary-tekst. Uit: outline, slate-tekst.
function InRapportPill({ active, onToggle, busy, appLabel, insightId }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const aanLabel = lbl("analysis.inrapport.aan", "in rapport: aan");
  const uitLabel = lbl("analysis.inrapport.uit", "in rapport: uit");
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      data-testid={`inzicht-inrapport-toggle-${insightId}`}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em]
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed border ${
          active
            ? "bg-[var(--color-accent)] text-[var(--color-primary)] border-[var(--color-accent)]"
            : "bg-white text-slate-500 border-slate-300 hover:border-slate-500 hover:text-slate-700"
        }`}
    >
      {active ? aanLabel : uitLabel}
    </button>
  );
}

// ── InzichtItem ───────────────────────────────────────────────────────────────
export default function InzichtItem({ insight, appLabel, onSave, onToggleRapport }) {
  const { id, type, title, observation, recommendation } = insight;
  const source_refs = Array.isArray(insight.source_refs) ? insight.source_refs : [];

  const cfg = TYPE_CONFIG[type] ?? FALLBACK_TYPE;
  const { Icon, labelKey, labelFb, bg, color } = cfg;

  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const typeLabel = lbl(labelKey, labelFb);
  const obsLabel  = lbl("analysis.section.observation",    "Observatie");
  const recLabel  = lbl("analysis.section.recommendation", "Aanbeveling");
  const refsLabel = lbl("analysis.section.references",     "Verwijst naar");

  // Render-prio: edited_* override AI-tekst
  const obsDisplay = insight.edited_observation ?? observation;
  const recDisplay = insight.edited_recommendation ?? recommendation;
  const isEdited   = !!(insight.edited_observation || insight.edited_recommendation);
  const inRapport  = insight.in_rapport === true;

  // ── Edit-mode state ───────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draftObs, setDraftObs] = useState("");
  const [draftRec, setDraftRec] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [togglingRapport, setTogglingRapport] = useState(false);

  function openEdit() {
    setDraftObs(insight.edited_observation ?? observation ?? "");
    setDraftRec(insight.edited_recommendation ?? recommendation ?? "");
    setSaveError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }
  async function commitEdit() {
    if (!onSave) return;
    setSaving(true);
    setSaveError(null);
    const res = await onSave(id, {
      edited_observation: draftObs,
      edited_recommendation: draftRec,
    });
    setSaving(false);
    if (res && res.error) {
      setSaveError(res.error.message || String(res.error));
      return;
    }
    setEditing(false);
  }
  async function handleToggleRapport() {
    if (!onToggleRapport) return;
    setTogglingRapport(true);
    setSaveError(null);
    const res = await onToggleRapport(id, !inRapport);
    setTogglingRapport(false);
    if (res && res.error) {
      setSaveError(res.error.message || String(res.error));
    }
  }

  const canEdit = typeof onSave === "function";
  const canToggle = typeof onToggleRapport === "function";

  return (
    <article
      id={`insight-${id}`}
      data-testid={`inzicht-item-${id}`}
      data-edited={isEdited ? "true" : "false"}
      data-in-rapport={inRapport ? "true" : "false"}
      className="group py-8 border-b border-slate-100 last:border-b-0 relative"
    >
      {/* ── Header-acties rechts boven: pill-toggle + hover-pencil ────────── */}
      {(canEdit || canToggle) && (
        <div className="absolute top-6 right-0 flex items-center gap-2">
          {canToggle && (
            <InRapportPill
              active={inRapport}
              onToggle={handleToggleRapport}
              busy={togglingRapport}
              appLabel={appLabel}
              insightId={id}
            />
          )}
          {canEdit && !editing && (
            <button
              type="button"
              onClick={openEdit}
              data-testid={`inzicht-edit-pencil-${id}`}
              aria-label={lbl("analysis.action.bewerk", "Bewerk bevinding")}
              title={lbl("analysis.action.bewerk", "Bewerk bevinding")}
              // RFC-008 §11 rij 5 — hover-only zichtbaarheid (opacity 0 → 100 op group-hover).
              // focus-visible:opacity-100 zodat keyboard-navigatie de knop óók ziet.
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity
                inline-flex items-center justify-center w-7 h-7 rounded-md
                text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Kop: 24px cirkel-marker + type-label kicker + h3 ─────────────── */}
      <div className="flex items-start gap-3.5 mb-4 pr-32">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${bg}`}
          aria-hidden="true"
        >
          <span className={color}><Icon size={13} /></span>
        </span>

        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1 ${color}`}>
            {typeLabel}
          </div>
          <h3 className="text-[18px] font-semibold text-[var(--color-primary)] leading-snug tracking-[-0.005em]">
            {title}
          </h3>
        </div>
      </div>

      {/* ── Body: ingesprongen 38px (= w-6 cirkel + gap-3.5) ─────────────── */}
      <div className="ml-[38px]">
        {editing ? (
          // ── Edit-mode: 2 textareas + Save/Cancel ──────────────────────────
          <div className="space-y-3" data-testid={`inzicht-edit-form-${id}`}>
            <div>
              <strong className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1 not-italic">
                {obsLabel}
              </strong>
              <textarea
                value={draftObs}
                onChange={(e) => setDraftObs(e.target.value)}
                rows={4}
                data-testid={`inzicht-edit-observation-${id}`}
                className="w-full text-[15px] leading-relaxed p-2 border border-slate-300 rounded
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            <div>
              <strong className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1 not-italic">
                {recLabel}
              </strong>
              <textarea
                value={draftRec}
                onChange={(e) => setDraftRec(e.target.value)}
                rows={4}
                data-testid={`inzicht-edit-recommendation-${id}`}
                className="w-full text-[15px] leading-relaxed p-2 border border-slate-300 rounded
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            {saveError && (
              <p className="text-red-600 text-xs">{saveError}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                data-testid={`inzicht-edit-cancel-${id}`}
                className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600
                  hover:border-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                {lbl("analysis.action.cancel", "Annuleer")}
              </button>
              <button
                type="button"
                onClick={commitEdit}
                disabled={saving}
                data-testid={`inzicht-edit-save-${id}`}
                className="px-3 py-1.5 text-xs rounded bg-[var(--color-primary)] text-white
                  hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving
                  ? lbl("analysis.action.saving", "Opslaan…")
                  : lbl("analysis.action.save", "Opslaan")}
              </button>
            </div>
          </div>
        ) : (
          // ── Lees-mode ────────────────────────────────────────────────────────
          <>
            {obsDisplay && (
              <div className="mb-3.5">
                <strong className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1 not-italic">
                  {obsLabel}
                </strong>
                <p className="text-[15px] text-slate-700 leading-relaxed m-0">
                  {obsDisplay}
                </p>
              </div>
            )}

            {recDisplay && (
              <div className="mb-3.5">
                <strong className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1 not-italic">
                  {recLabel}
                </strong>
                <p className="text-[15px] text-slate-700 leading-relaxed m-0">
                  {recDisplay}
                </p>
              </div>
            )}

            {isEdited && (
              <p
                data-testid={`inzicht-bewerkt-label-${id}`}
                className="text-[8px] uppercase tracking-[0.12em] text-slate-400 font-mono mt-1"
              >
                {lbl("analysis.label.bewerkt", "bewerkt")}
              </p>
            )}

            {source_refs.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mr-2">
                  {refsLabel}
                </span>
                {source_refs.map((ref, i) => (
                  <SourceLink key={i} source={ref} isLast={i === source_refs.length - 1} />
                ))}
              </div>
            )}
          </>
        )}

        {!editing && saveError && (
          <p className="text-red-600 text-xs mt-2">{saveError}</p>
        )}
      </div>
    </article>
  );
}
