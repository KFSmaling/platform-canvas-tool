/**
 * ModelLibrary — werkblad-agnostische modellen-bibliotheek voor OnepagerBuilder.
 *
 * RFC-008 §C — shared/. Designer-spec: rapportage-spec.md §2 regel 62-93.
 *
 * Layout (linker paneel OnepagerBuilder, vaste 320px breed):
 *   - 3a Vast-zichtbare blokken (grijze "altijd zichtbaar"-rijen, geen checkbox)
 *   - 3b Configureerbare modellen, gegroepeerd (checkbox + disabled-state met
 *        tooltip op AlertCircle-icon)
 *   - 3c Selectie-overzicht onderaan ("Volgorde op A4 · {N} gekozen" + lijst
 *        met ↑↓ reorder + × remove per item)
 *
 * Props:
 *   vasteBlokken      — [{ id, label, sub_label }]
 *   groups            — [{ id, label, models: [{ id, label, enabled, disabled_reason? }] }]
 *   selectedModels    — [{ id }] in volgorde
 *   onToggleModel     — (modelId, enabled_bool) => void
 *   onReorder         — (modelId, direction: 'up'|'down') => void
 *   onRemove          — (modelId) => void
 *   appLabel          — (key, fb) => string
 */

import React from "react";
import { ChevronUp, ChevronDown, X, AlertCircle, GripVertical } from "lucide-react";

// ── Vast-zichtbaar blok (geen checkbox, alleen visual) ───────────────────────
function VastBlok({ blok }) {
  return (
    <div
      data-testid={`modellib-vast-${blok.id}`}
      className="flex items-start gap-2 px-3 py-2 rounded-md bg-slate-100 border border-slate-200"
    >
      <GripVertical size={12} className="text-slate-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-slate-700 leading-tight">{blok.label}</div>
        {blok.sub_label && (
          <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{blok.sub_label}</div>
        )}
      </div>
    </div>
  );
}

// ── Model-checkbox (configureerbaar) ─────────────────────────────────────────
function ModelCheckbox({ model, selected, onToggle, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const disabled = !model.enabled;
  return (
    <label
      data-testid={`modellib-model-${model.id}`}
      data-enabled={model.enabled ? "true" : "false"}
      className={`flex items-start gap-2 px-3 py-2 rounded-md transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-70 bg-slate-50/50"
          : "cursor-pointer hover:bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={!!selected}
        disabled={disabled}
        onChange={(e) => !disabled && onToggle(model.id, e.target.checked)}
        data-testid={`modellib-model-${model.id}-checkbox`}
        className="mt-0.5 flex-shrink-0 accent-[var(--color-primary)]"
      />
      <span className={`flex-1 min-w-0 text-[12px] leading-snug ${disabled ? "text-slate-500" : "text-slate-700"}`}>
        {model.label}
      </span>
      {disabled && model.disabled_reason && (
        <span
          data-testid={`modellib-model-${model.id}-disabled-icon`}
          className="flex-shrink-0 text-red-500"
          title={model.disabled_reason}
          aria-label={`${lbl("onepager.modellib.disabled.reason.prefix", "Disabled: ")}${model.disabled_reason}`}
        >
          <AlertCircle size={13} />
        </span>
      )}
    </label>
  );
}

// ── Selectie-overzicht-item ──────────────────────────────────────────────────
function SelectieItem({ model, index, total, onReorder, onRemove, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const canUp   = index > 0;
  const canDown = index < total - 1;
  return (
    <div
      data-testid={`modellib-selectie-${model.id}`}
      data-position={index}
      className="flex items-center gap-1 px-2 py-1.5 rounded bg-white border border-slate-200"
    >
      <span className="text-[10px] font-bold text-slate-400 w-4 text-center">{index + 1}</span>
      <span className="flex-1 min-w-0 text-[11px] text-slate-700 truncate">{model.label}</span>
      <button
        type="button"
        onClick={() => canUp && onReorder(model.id, "up")}
        disabled={!canUp}
        data-testid={`modellib-selectie-${model.id}-up`}
        aria-label={lbl("onepager.modellib.action.up", "Omhoog")}
        title={lbl("onepager.modellib.action.up", "Omhoog")}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => canDown && onReorder(model.id, "down")}
        disabled={!canDown}
        data-testid={`modellib-selectie-${model.id}-down`}
        aria-label={lbl("onepager.modellib.action.down", "Omlaag")}
        title={lbl("onepager.modellib.action.down", "Omlaag")}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(model.id)}
        data-testid={`modellib-selectie-${model.id}-remove`}
        aria-label={lbl("onepager.modellib.action.remove", "Verwijder")}
        title={lbl("onepager.modellib.action.remove", "Verwijder")}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function ModelLibrary({
  vasteBlokken = [],
  groups = [],
  selectedModels = [],
  onToggleModel,
  onReorder,
  onRemove,
  appLabel,
}) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const selectedIds = new Set(selectedModels.map(m => m.id));

  return (
    <div
      data-testid="modellib-panel"
      className="flex flex-col gap-4 p-4 overflow-y-auto h-full"
    >
      {/* ── 3a Vaste-blokken ─────────────────────────────────────────────── */}
      {vasteBlokken.length > 0 && (
        <section data-testid="modellib-vaste-blokken">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            {lbl("onepager.modellib.vaste_blokken.titel", "Altijd zichtbaar")}
          </h3>
          <div className="flex flex-col gap-1.5">
            {vasteBlokken.map(blok => (
              <VastBlok key={blok.id} blok={blok} />
            ))}
          </div>
        </section>
      )}

      {/* ── 3b Configureerbare groepen ───────────────────────────────────── */}
      {groups.length > 0 && (
        <section data-testid="modellib-groups">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            {lbl("onepager.modellib.groups.titel", "Kies modellen")}
          </h3>
          {groups.map(group => (
            <div key={group.id} className="mb-3" data-testid={`modellib-group-${group.id}`}>
              <p className="text-[11px] font-semibold text-[var(--color-primary)] mb-1 px-1">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.models.map(model => (
                  <ModelCheckbox
                    key={model.id}
                    model={model}
                    selected={selectedIds.has(model.id)}
                    onToggle={onToggleModel}
                    appLabel={appLabel}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── 3c Selectie-overzicht ────────────────────────────────────────── */}
      <section data-testid="modellib-selectie">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
          {(lbl(
            "onepager.modellib.selectie.titel",
            "Volgorde op A4 · {N} gekozen"
          ) || "").replace("{N}", selectedModels.length)}
        </h3>
        {selectedModels.length === 0 ? (
          <p
            data-testid="modellib-selectie-empty"
            className="text-[11px] text-slate-400 italic px-2 py-3 text-center border border-dashed border-slate-200 rounded"
          >
            {lbl(
              "onepager.modellib.selectie.empty",
              "Nog geen modellen gekozen — vink hierboven aan."
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {selectedModels.map((model, i) => (
              <SelectieItem
                key={model.id}
                model={model}
                index={i}
                total={selectedModels.length}
                onReorder={onReorder}
                onRemove={onRemove}
                appLabel={appLabel}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
