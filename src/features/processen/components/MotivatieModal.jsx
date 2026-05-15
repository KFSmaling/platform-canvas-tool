/**
 * MotivatieModal — "Bewust niet adresseren"-flow voor po_pain_points (11.M.1 block-2 C10).
 *
 * Server-side endpoint pain_point_coverage_toggle werkt al + DB-CHECK po_pp_motivation_required
 * dwingt min 20 chars af. Deze modal voegt UX toe:
 *  - Textarea met live-char-counter
 *  - Submit disabled bij <20 chars (frontend-validatie pre-empt server-CHECK)
 *  - Annuleer-knop
 *
 * Props:
 *  - painId: uuid van pijnpunt
 *  - painText: text_md voor context-tonen
 *  - onConfirm(motivation): async → roept svc.toggleCoverageStatus(id, "motivated_no_action", motivation)
 *  - onCancel(): close modal
 */

import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useAppConfig } from "../../../shared/context/AppConfigContext";

const MIN_CHARS = 20;
const MAX_CHARS = 1000;

export default function MotivatieModal({ painId, painText, onConfirm, onCancel }) {
  const { label: appLabel } = useAppConfig();
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmedLen = motivation.trim().length;
  const isValid = trimmedLen >= MIN_CHARS && trimmedLen <= MAX_CHARS;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onConfirm(motivation.trim());
      if (result?.error) {
        setError(result.error.message || "Opslaan mislukt");
        setSubmitting(false);
        return;
      }
      // Caller sluit modal na succes
    } catch (err) {
      setError(err.message || "Onverwachte fout");
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="motivatie-modal"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">
              {appLabel("processen.coverage.motivatie_modal.titel", "Bewust niet adresseren")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            data-testid="motivatie-modal-close"
            aria-label="Sluit"
            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          {/* Context: pijnpunt-tekst */}
          <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pijnpunt</p>
            <p className="text-xs text-slate-700">{painText}</p>
          </div>

          <p className="text-xs text-slate-600">
            {appLabel("processen.coverage.motivatie_modal.helper", "Geef minimaal 20 tekens motivatie waarom dit pijnpunt niet wordt geadresseerd.")}
          </p>

          {/* Textarea + live char-counter */}
          <div>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              maxLength={MAX_CHARS}
              rows={4}
              placeholder="Bijvoorbeeld: 'Strategisch besluit om te accepteren — uitgewerkt in jaarplan 2027.'"
              autoFocus
              data-testid="motivatie-modal-textarea"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p
                data-testid="motivatie-modal-char-counter"
                className={`text-[10px] ${
                  trimmedLen < MIN_CHARS ? "text-amber-600" :
                  trimmedLen > MAX_CHARS ? "text-red-600" :
                  "text-emerald-600"
                }`}
              >
                {trimmedLen} / min {MIN_CHARS} tekens
              </p>
              <p className="text-[10px] text-slate-400">{MAX_CHARS - trimmedLen} resterend</p>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            data-testid="motivatie-modal-cancel"
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            data-testid="motivatie-modal-submit"
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-colors ${
              !isValid || submitting
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            {submitting ? "Opslaan…" : "Bevestig"}
          </button>
        </footer>
      </div>
    </div>
  );
}
