/**
 * PromoteToIntentModal — promote-flow van gemarkeerde pattern_suggestion naar
 * cd_improvement_intents (RFC-001 §2.7, stap 11.H).
 *
 * Pre-vult `title` met eerste ~60 chars van suggestion-tekst (oneliner-tot-
 * eerste-zinseinde-of-newline), `intent_md` met volledige suggestion-tekst.
 * Consultant kan beide vrij bewerken. `vanuit` wordt automatisch gevuld met
 * suggestion-context aan server-zijde.
 *
 * Props:
 *   - suggestion: cd_pattern_suggestions-rij (current_status='accepted'/'promoted')
 *   - onClose()
 *   - onSubmit({ title, intentMd }) → async, retourneert { error: null|Error }
 *
 * UX-anker: SuggestionEditModal + IntentModal (kleur, knop-styling, validatie-
 * patroon). Validaties zelfde als IntentModal — server-side ook gevalideerd.
 */

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const TITLE_MIN = 1;
const TITLE_MAX = 100;
const INTENT_MIN = 50;
const INTENT_MAX = 2000;

function deriveTitle(text, max = 60) {
  if (!text) return "";
  const oneLine = String(text).split(/[\n.!?]/)[0].trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trim() + "…";
}

export default function PromoteToIntentModal({
  suggestion,
  onClose,
  onSubmit,
}) {
  const { label: appLabel } = useAppConfig();

  const initialTitle  = useMemo(() => deriveTitle(suggestion?.text_md), [suggestion]);
  const initialIntent = useMemo(() => (suggestion?.text_md || "").trim(), [suggestion]);

  const [title, setTitle]       = useState(initialTitle);
  const [intentMd, setIntentMd] = useState(initialIntent);
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState(null);

  const trimmedTitle  = title.trim();
  const trimmedIntent = intentMd.trim();
  const titleValid  = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX;
  const intentValid = trimmedIntent.length >= INTENT_MIN && intentMd.length <= INTENT_MAX;
  const canSubmit   = titleValid && intentValid && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrMsg(null);
    const { error } = await onSubmit({
      title:    trimmedTitle,
      intentMd: trimmedIntent,
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
          <h3 className="text-base font-bold text-[var(--color-primary)]">
            {appLabel("klanten.verbeterrichting.promote.titel", "Promote naar verbeterrichting")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <p className="text-[11px] text-slate-500 italic">
            {appLabel("klanten.verbeterrichting.promote.intro", "Verscherp dit gemarkeerde patroon tot een concrete verbeterrichting. Title en beschrijving zijn vooringevuld — bewerk waar nodig.")}
          </p>

          <div>
            <label
              htmlFor="promote-titel"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.verbeterrichting.veld.titel.label", "Titel")}
            </label>
            <input
              id="promote-titel"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder={appLabel("klanten.verbeterrichting.veld.titel.placeholder", "Korte titel")}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={TITLE_MAX}
              autoFocus
              data-testid="promote-veld-titel"
            />
            {!titleValid && title.length > 0 && (
              <p className="text-[10px] text-red-600 mt-1">
                {appLabel("klanten.verbeterrichting.error.titel_leeg", "Titel is verplicht (1-100 tekens)")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="promote-md"
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-1"
            >
              {appLabel("klanten.verbeterrichting.veld.intent.label", "Beschrijving")}
            </label>
            <textarea
              id="promote-md"
              rows={8}
              value={intentMd}
              onChange={e => setIntentMd(e.target.value.slice(0, INTENT_MAX))}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              maxLength={INTENT_MAX}
              data-testid="promote-veld-md"
            />
            <div className="flex items-center justify-between mt-1">
              {!intentValid && intentMd.length > 0 && intentMd.length < INTENT_MIN && (
                <p className="text-[10px] text-red-600">
                  {appLabel("klanten.verbeterrichting.error.intent_leeg", "Beschrijving is verplicht (minimaal 50 tekens)")}
                </p>
              )}
              <span className="text-[10px] text-slate-400 ml-auto">{intentMd.length}/{INTENT_MAX}</span>
            </div>
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
              {errMsg}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {appLabel("klanten.verbeterrichting.knop.annuleren", "Annuleren")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="promote-modal-opslaan"
            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Opslaan…" : appLabel("klanten.verbeterrichting.knop.opslaan", "Opslaan")}
          </button>
        </div>
      </div>
    </div>
  );
}
