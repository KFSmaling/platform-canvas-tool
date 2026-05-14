/**
 * ItemModal — archetype-velden formulier voor cd_items create/edit.
 *
 * Props:
 *   - item: bestaand item (edit) of null (create)
 *   - dimension: { id, archetype, name }
 *   - onClose()
 *   - onSave(itemData) — async, retourneert { error? }
 *
 * Per CLAUDE.md sectie 4.2: await + error-check + loading state tot
 * server-bevestiging. Geen optimistic update.
 */

import React, { useState } from "react";
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, Zap, MoonStar } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import { getSchemaFor } from "./archetypeSchemas";
import CustomPairsField from "./CustomPairsField";

/** Stap 11.I.2 — tag_list helpers: array ↔ comma-separated string */
function tagsToText(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(", ");
}
function textToTags(text) {
  if (typeof text !== "string") return [];
  return text.split(",").map(s => s.trim()).filter(Boolean);
}

export default function ItemModal({
  item,
  dimension,
  onClose,
  onSave,
  // Stap 11.K — A2 dossier-extract velden-invuller. Optionele callback +
  // upload-status uit useCanvasUploads (KlantenWerkblad-niveau).
  onFillFieldsFromDossier,
  // A6 (U-cleanup) — 0-items-flow: combineer extract + INSERT met fields.
  // Wordt aangeroepen in create-mode wanneer dimensie nog 0 items heeft.
  onCreateWithFieldsFromDossier,
  hasIndexedChunks = false,
  hasUploads = false,
  uploadsProcessing = false,
  // T4 A9: client-side duplicate-name-validatie. KlantenWerkblad geeft hier
  // de bestaande items in deze dimensie zodat we vóór submit een vriendelijke
  // inline-error kunnen tonen i.p.v. 500-INSERT-error.
  existingItemsInDimension = [],
  // Stap 11.K.2 F16 — canonical-delete: alleen in edit-mode getoond,
  // inline-bevestiging vóór hard-delete. KlantenWerkblad handelt de service-call af.
  onDelete,
}) {
  const { label: appLabel, enum: appEnum } = useAppConfig();
  const isEdit = !!item;
  const schema = getSchemaFor(dimension?.archetype);

  const [name, setName]               = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [archetypeData, setArchetypeData] = useState(item?.archetype_data ?? {});
  const [saving, setSaving]   = useState(false);
  const [errMsg, setErrMsg]   = useState(null);
  const [filling, setFilling] = useState(false);
  // F17: fillNote-shape is { type: "success" | "empty", text: string } i.p.v. plain string,
  // zodat we visueel onderscheid kunnen maken (groene vs. amber banner met passend icoon).
  const [fillNote, setFillNote] = useState(null);
  // F16: inline-bevestiging-state. Toont confirm-strook in footer i.p.v. browser-confirm.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setField(key, value) {
    setArchetypeData(d => ({ ...d, [key]: value }));
  }

  // A2: vul archetype-velden via AI uit dossier. Server merge't proposed_fields
  // in archetype_data + zet is_draft=true wanneer item canonical was; daarna
  // syncen we lokaal de form-state met de updated item.
  async function handleFillFromDossier() {
    if (!onFillFieldsFromDossier || !item?.id || filling) return;
    setFilling(true);
    setFillNote(null);
    setErrMsg(null);
    const { data: updatedItem, meta, error } = await onFillFieldsFromDossier(item.id);
    setFilling(false);
    if (error) {
      setErrMsg(error.message || "Velden invullen mislukt");
      return;
    }
    if (updatedItem?.archetype_data) {
      setArchetypeData(updatedItem.archetype_data);
    }
    const proposed = meta?.proposed_fields || {};
    const count = Object.keys(proposed).length;
    if (count === 0) {
      setFillNote({
        type: "empty",
        text: meta?.note || "AI vond geen onderbouwing voor lege velden",
      });
    } else {
      setFillNote({
        type: "success",
        text: `${count} veld${count === 1 ? "" : "en"} ingevuld vanuit dossier`,
      });
    }
  }

  // A6 (U-cleanup): in create-mode + 0 items in dimensie, gebruik nieuwe
  // server-flow die direct een draft item met fields INSERTed. In edit-mode
  // of bij ≥1 bestaand item blijft de A2-flow (fill fields op bestaand item).
  const isZeroItemsCreate =
    !isEdit && !item?.id && existingItemsInDimension.length === 0 && !!onCreateWithFieldsFromDossier;

  const a2Disabled = isZeroItemsCreate
    ? (!hasIndexedChunks || uploadsProcessing || filling)
    : (!item?.id || !hasIndexedChunks || uploadsProcessing || filling);
  const a2Tooltip = (!item?.id && !isZeroItemsCreate)
    ? "Bewaar eerst het item — A2 vult velden voor een bestaand item"
    : !hasUploads
      ? appLabel("klanten.dossier.disabled_no_uploads", "Upload eerst documenten")
      : uploadsProcessing
        ? appLabel("klanten.dossier.disabled_processing", "Documenten worden nog verwerkt")
        : null;

  // A6: in 0-items-create-mode roept de knop een ander callback. Server creëert
  // een draft + KlantenWerkblad reload + we sluiten de modal. Geen form-merge
  // omdat de modal nu een gebruiker-bevestigings-step is — draft staat in lijst
  // met Markeer/Bewerk/Verwijder-affordances.
  async function handleCreateWithFields() {
    if (!onCreateWithFieldsFromDossier || !dimension?.id || filling) return;
    setFilling(true);
    setFillNote(null);
    setErrMsg(null);
    const { data: newItem, error } = await onCreateWithFieldsFromDossier(dimension.id);
    setFilling(false);
    if (error) {
      setErrMsg(error.message || "Aanmaken vanuit dossier mislukt");
      return;
    }
    if (!newItem) {
      // 200 met item=null + note: AI vond geen items
      setFillNote({ type: "empty", text: "AI vond geen item in dossier voor deze dimensie" });
      return;
    }
    // Draft staat in lijst — modal sluiten zodat de gebruiker direct kan
    // accepteren / bewerken / verwijderen.
    onClose();
  }

  const a2OnClick = isZeroItemsCreate ? handleCreateWithFields : handleFillFromDossier;

  async function handleConfirmDelete() {
    if (!isEdit || !onDelete || !item?.id || deleting) return;
    setDeleting(true);
    setErrMsg(null);
    const { error } = await onDelete(item.id);
    setDeleting(false);
    if (error) {
      setErrMsg(error.message || "Verwijderen mislukt");
      setConfirmingDelete(false);
      return;
    }
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrMsg("Naam is verplicht");
      return;
    }
    // T4 A9: client-side duplicate-name-validatie. Voorkomt 500-INSERT-error
    // bij twee items met dezelfde naam in zelfde dimensie. Case-insensitive
    // vergelijking; in edit-mode (item.id bestaat) sluiten we zelf-id uit.
    const lowerName = trimmedName.toLowerCase();
    const duplicate = (existingItemsInDimension || []).some(it =>
      it.id !== item?.id && (it.name || "").trim().toLowerCase() === lowerName
    );
    if (duplicate) {
      setErrMsg(`Een item met de naam "${trimmedName}" bestaat al in deze dimensie. Kies een andere naam.`);
      return;
    }
    setSaving(true);
    setErrMsg(null);
    const { error } = await onSave({
      name: trimmedName,
      description: description.trim() || null,
      archetype_data: archetypeData,
    });
    setSaving(false);
    if (error) {
      setErrMsg(error.message || "Opslaan mislukt");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-[var(--color-primary)]">
              {isEdit
                ? appLabel("klanten.modal.item.titel.edit", "Item bewerken")
                : appLabel("klanten.modal.item.titel.add", "Nieuw item")}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">
              {dimension?.name} · archetype: {dimension?.archetype}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label htmlFor="item-naam" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Naam</label>
            <input
              id="item-naam"
              type="text" value={name} onChange={e => setName(e.target.value)}
              name="item-naam"
              autoComplete="off"
              data-1p-ignore=""
              data-form-type="other"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus required
            />
          </div>
          <div>
            <label htmlFor="item-omschrijving" className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1">Korte omschrijving</label>
            <input
              id="item-omschrijving"
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="optioneel"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Archetype-velden</p>
              {(onFillFieldsFromDossier || isZeroItemsCreate) && (
                <button
                  type="button"
                  onClick={a2OnClick}
                  disabled={a2Disabled}
                  data-testid="dossier-fields-fill"
                  data-variant={isZeroItemsCreate ? "create_with_fields" : "fill_fields"}
                  title={a2Tooltip || undefined}
                  className={`flex items-center gap-1 text-[10px] uppercase tracking-widest transition-colors ${
                    a2Disabled
                      ? "text-slate-400 cursor-not-allowed opacity-60"
                      : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                  }`}
                >
                  {filling ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  {isZeroItemsCreate
                    ? appLabel("klanten.dossier.create_with_fields", "Item maken vanuit dossier")
                    : appLabel("klanten.dossier.fields_fill", "Velden invullen vanuit dossier")}
                </button>
              )}
            </div>
            {/* F17: banner-stijl feedback ipv klein-tekst — onderscheid succes/empty
                via groene/amber kleuren + passend icoon. Sluitbaar via X-icon. */}
            {fillNote && (
              <div
                data-testid="dossier-fields-fill-note"
                data-fill-type={fillNote.type}
                className={`flex items-start gap-2 px-3 py-2 text-xs rounded border ${
                  fillNote.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                {fillNote.type === "success"
                  ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  : <AlertCircle  size={14} className="mt-0.5 shrink-0" />}
                <p className="flex-1">{fillNote.text}</p>
                <button
                  type="button"
                  onClick={() => setFillNote(null)}
                  aria-label="Sluit"
                  data-testid="dossier-fields-fill-note-sluit"
                  className="shrink-0 text-current opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {schema.length === 0 && (
              <p className="text-xs text-slate-500 italic">Geen velden gedefinieerd voor archetype "{dimension?.archetype}"</p>
            )}
            {renderSchema({ schema, archetypeData, setField, appLabel, appEnum })}
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        {/* Footer: F16 inline-bevestigingsdialog vervangt normale knoppen-rij wanneer
            confirmingDelete=true. Stijl is "strook in footer" om binnen de modal te blijven
            (geen browser-confirm — wel stijlbaar en testbaar). */}
        {confirmingDelete ? (
          <div
            data-testid="item-modal-delete-confirm"
            className="flex items-center gap-3 px-6 py-3 border-t border-red-200 bg-red-50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-800">
                {appLabel("klanten.modal.delete.confirm.titel", "Permanent verwijderen?")}
              </p>
              <p className="text-[11px] text-red-700">
                {appLabel("klanten.modal.delete.confirm.tekst", "Dit kan niet ongedaan gemaakt worden.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              data-testid="item-modal-delete-confirm-nee"
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              {appLabel("klanten.modal.delete.confirm.nee", "Annuleer")}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              data-testid="item-modal-delete-confirm-ja"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
            >
              {deleting ? "Bezig…" : appLabel("klanten.modal.delete.confirm.ja", "Verwijder definitief")}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
            {/* F16: Verwijder-knop links — alleen in edit-mode + wanneer onDelete-callback bestaat */}
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                data-testid="item-modal-delete"
                className="mr-auto px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {appLabel("klanten.knop.item.verwijderen", "Verwijderen")}
              </button>
            )}
            <button
              type="button" onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              {appLabel("klanten.knop.item.annuleren", "Annuleren")}
            </button>
            <button
              type="button" onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
            >
              {saving ? "Opslaan…" : appLabel("klanten.knop.item.opslaan", "Opslaan")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stap 11.I.2 — schema-aware veld-renderer ─────────────────────────────────
//
// Itereert door schema en rendert per veld op basis van field.type. Speciale
// gevallen:
//  - custom_pairs (11.I.1)  → CustomPairsField-component (anders.vrije_velden)
//  - boolean met group="strategische_weging" → eigen blok "Strategische weging"
//    met visual emphasis (80/20-denkdwang asymmetrie, klantreis MoT/Silent/weight)
//  - conditionalOn: alleen renderen wanneer archetypeData[conditionalOn] truthy
//
// 80/20-denkdwang-principe (zie inputs/2026-05-12-design-principle-80-20-denkdwang.md):
// MoT + Silent Period + weight_multiplier zijn DE strategische functie van
// klantreis-archetype. Niet ondergeschikt aan andere velden, dus eigen blok
// met prominent visual styling (amber MoT-toggle, slate Silent-toggle, weight-numeric).
function renderSchema({ schema, archetypeData, setField, appLabel, appEnum }) {
  const groupRendered = new Set();
  return schema.map(field => {
    if (field.group && groupRendered.has(field.group)) return null;
    if (field.group === "strategische_weging") {
      groupRendered.add(field.group);
      const groupFields = schema.filter(f => f.group === "strategische_weging");
      return (
        <StrategischeWegingBlok
          key="strategische_weging"
          fields={groupFields}
          archetypeData={archetypeData}
          setField={setField}
          appLabel={appLabel}
        />
      );
    }
    if (field.conditionalOn && !archetypeData?.[field.conditionalOn]) {
      return null;
    }
    return (
      <FieldRenderer
        key={field.key}
        field={field}
        archetypeData={archetypeData}
        setField={setField}
        appLabel={appLabel}
        appEnum={appEnum}
      />
    );
  });
}

function FieldRenderer({ field, archetypeData, setField, appLabel, appEnum }) {
  // custom_pairs (11.I.1)
  if (field.type === "custom_pairs") {
    return (
      <CustomPairsField
        fieldKey={field.key}
        value={archetypeData[field.key] ?? {}}
        onChange={next => setField(field.key, next)}
        labelKey={field.labelKey}
        fallback={field.fallback}
        helperKey={field.helperKey || "klanten.veld.anders.helper"}
        helperFallback="Definieer maximaal 4 eigen sleutels en waarden voor deze dimensie."
        appLabel={appLabel}
        keyPlaceholder={field.placeholder?.key}
        valuePlaceholder={field.placeholder?.value}
      />
    );
  }
  const labelEl = (
    <label className="block text-[11px] font-medium text-slate-600 mb-1">
      {appLabel(field.labelKey, field.fallback)}
    </label>
  );
  const helperEl = field.helperKey ? (
    <p className="text-[10px] text-slate-500 italic mb-1.5">
      {appLabel(field.helperKey, "")}
    </p>
  ) : null;

  if (field.type === "dropdown") {
    const opts = appEnum ? appEnum(field.enumKey, []) : [];
    return (
      <div data-testid={`field-${field.key}`}>
        {labelEl}
        {helperEl}
        <select
          value={archetypeData[field.key] ?? ""}
          onChange={e => setField(field.key, e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)] bg-white"
        >
          <option value="">{field.placeholder || "— kies —"}</option>
          {opts.map(opt => (
            <option key={opt} value={opt}>
              {appLabel(`${field.enumLabelPrefix || ""}${opt}`, opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "tag_list") {
    return (
      <div data-testid={`field-${field.key}`}>
        {labelEl}
        {helperEl}
        <input
          type="text"
          value={tagsToText(archetypeData[field.key])}
          onChange={e => setField(field.key, textToTags(e.target.value))}
          placeholder={field.placeholder || "comma-separated"}
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div data-testid={`field-${field.key}`}>
        {labelEl}
        {helperEl}
        <textarea
          rows={2}
          value={archetypeData[field.key] ?? ""}
          onChange={e => setField(field.key, e.target.value)}
          placeholder={field.placeholder || ""}
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    );
  }

  // Default: text
  return (
    <div data-testid={`field-${field.key}`}>
      {labelEl}
      {helperEl}
      <input
        type="text"
        value={archetypeData[field.key] ?? ""}
        onChange={e => setField(field.key, e.target.value)}
        placeholder={field.placeholder || ""}
        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

/**
 * StrategischeWegingBlok — eigen visueel blok voor MoT + Silent Period +
 * weight_multiplier. 80/20-denkdwang in categorie "asymmetrie-erkenning"
 * (inputs/2026-05-12-design-principle-80-20-denkdwang.md). Bewuste keuze
 * om deze drie velden niet ondergeschikt te maken aan andere veld-input.
 *
 * Visual emphasis: toggle-buttons met kleur-accent (amber voor MoT,
 * slate voor Silent Period) i.p.v. standaard-checkboxes. Numeric weight
 * met sensible defaults via helper-tekst (1.0 normaal, 3.0 claim-niveau).
 */
function StrategischeWegingBlok({ fields, archetypeData, setField, appLabel }) {
  const motField    = fields.find(f => f.key === "is_moment_of_truth");
  const silentField = fields.find(f => f.key === "is_silent_period");
  const weightField = fields.find(f => f.key === "weight_multiplier");

  const isMoT    = archetypeData?.is_moment_of_truth === true;
  const isSilent = archetypeData?.is_silent_period === true;
  const weight   = archetypeData?.weight_multiplier;
  const weightDisplay = weight == null || weight === "" ? (weightField?.defaultValue ?? 1.0) : weight;

  return (
    <div
      data-testid="strategische-weging-blok"
      data-denkdwang="asymmetrie"
      className="rounded-md border border-amber-200/70 bg-amber-50/30 p-3"
    >
      <div className="mb-2">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-800 mb-1.5">
          {appLabel("klanten.veld.klantreis.strategische_weging_titel", "Strategische weging")}
        </h4>
        <p className="text-[10px] text-amber-800/80 leading-relaxed">
          {appLabel(
            "klanten.veld.klantreis.strategische_weging.uitleg",
            "Niet elke stap weegt even zwaar. Markeer Moments of Truth (kritische ervaringsmomenten waar de klant \"wakker wordt\") en Silent periods (stille fases waar de klant uit zicht is — risico op churn). Pas de weging aan om strategisch belang in de rapport- en analyse-laag zichtbaar te maken."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {/* MoT toggle */}
        {motField && (
          <button
            type="button"
            onClick={() => setField("is_moment_of_truth", !isMoT)}
            data-testid="toggle-is_moment_of_truth"
            data-active={isMoT ? "true" : "false"}
            className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold transition-colors ${
              isMoT
                ? "bg-amber-500 border-amber-600 text-white"
                : "bg-white border-slate-300 text-slate-600 hover:border-amber-400"
            }`}
          >
            <Zap size={14} className={isMoT ? "text-white" : "text-amber-500"} />
            <span>{appLabel(motField.labelKey, motField.fallback)}</span>
          </button>
        )}

        {/* Silent Period toggle */}
        {silentField && (
          <button
            type="button"
            onClick={() => setField("is_silent_period", !isSilent)}
            data-testid="toggle-is_silent_period"
            data-active={isSilent ? "true" : "false"}
            className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold transition-colors ${
              isSilent
                ? "bg-slate-600 border-slate-700 text-white"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-500"
            }`}
          >
            <MoonStar size={14} className={isSilent ? "text-white" : "text-slate-500"} />
            <span>{appLabel(silentField.labelKey, silentField.fallback)}</span>
          </button>
        )}
      </div>

      {/* Weight multiplier */}
      {weightField && (
        <div data-testid="field-weight_multiplier">
          <label className="block text-[10px] font-medium text-amber-800 mb-1">
            {appLabel(weightField.labelKey, weightField.fallback)}
          </label>
          {weightField.helperKey && (
            <p className="text-[10px] text-amber-700/80 italic mb-1.5">
              {appLabel(weightField.helperKey, "")}
            </p>
          )}
          <input
            type="number"
            step={weightField.step || 0.1}
            min={weightField.min || 0}
            max={weightField.max || 10}
            value={weightDisplay}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setField("weight_multiplier", isNaN(v) ? weightField.defaultValue ?? 1.0 : v);
            }}
            className="w-32 border border-amber-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
          />
        </div>
      )}
    </div>
  );
}
