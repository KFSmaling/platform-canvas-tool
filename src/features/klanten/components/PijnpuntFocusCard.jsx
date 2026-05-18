/**
 * PijnpuntFocusCard — pijnpunt-card centraal in Doorloop-modus.
 *
 * 11.U Block 2b — RFC-007-rev2 Variant D.
 *
 * Renders 1 pijnpunt + status-badge + body afhankelijk van coverage_status:
 *  - 'open'      → ChoiceCards (3 paden) of inline LensPicker / AiResultDraft / Eigen-textarea
 *  - 'addressed' → lijst gekoppelde intents (read-only) + reopen-knop
 *  - 'dismissed' → motivatie-tekst + reopen-knop
 */

import React, { useState } from "react";
import { Circle, CheckCircle2, Slash, Loader2, X, Check } from "lucide-react";
import ChoiceCards from "./ChoiceCards";
import LensPicker from "./LensPicker";
import AiResultDraft from "./AiResultDraft";

const STATUS_STYLES = {
  open:      { bg: "bg-amber-100",   text: "text-amber-800",   icon: Circle },
  addressed: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2 },
  dismissed: { bg: "bg-slate-100",   text: "text-slate-600",   icon: Slash },
};

export default function PijnpuntFocusCard({
  painPoint,
  painIndex,
  linkedIntents = [],
  // Inline-state
  lensPickerOpen,
  lensLoading,
  aiDraft,
  eigenActieOpen,
  // Handlers
  onChooseAi,
  onChooseEigen,
  onChooseDismiss,
  onPickLens,
  onCancelLens,
  onAccepteerAi,
  onVerfijnAi,
  onWuifWegAi,
  onSaveEigenActie,
  onCancelEigenActie,
  onReopen,
  onEditIntent,
  appLabel,
}) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const coverageStatus = painPoint?.coverage_status || "open";
  const style = STATUS_STYLES[coverageStatus] || STATUS_STYLES.open;
  const StatusIcon = style.icon;
  const statusLabel = lbl(`klanten.verbeteracties.status.${coverageStatus}`,
    coverageStatus === "addressed" ? "Geadresseerd" :
    coverageStatus === "dismissed" ? "Genegeerd" : "Open");

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5"
      data-testid={`doorloop-focus-card-${painPoint?.id || "none"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${style.bg} ${style.text}`}
          data-testid={`doorloop-status-badge-${coverageStatus}`}
        >
          <StatusIcon size={12} />
          {statusLabel}
        </span>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
          {lbl("klanten.verbeteracties.focus.pijnpunt_label", "Pijnpunt")} #{painIndex + 1}
        </div>
        <p className="text-lg text-slate-900 leading-snug" data-testid="doorloop-focus-painpoint-text">
          {painPoint?.text_md || painPoint?.title || ""}
        </p>
      </div>

      <hr className="border-slate-200" />

      {/* Body — afhankelijk van coverage_status + inline-state */}
      {coverageStatus === "open" && (
        <OpenBody
          lensPickerOpen={lensPickerOpen}
          lensLoading={lensLoading}
          aiDraft={aiDraft}
          eigenActieOpen={eigenActieOpen}
          onChooseAi={onChooseAi}
          onChooseEigen={onChooseEigen}
          onChooseDismiss={onChooseDismiss}
          onPickLens={onPickLens}
          onCancelLens={onCancelLens}
          onAccepteerAi={onAccepteerAi}
          onVerfijnAi={onVerfijnAi}
          onWuifWegAi={onWuifWegAi}
          onSaveEigenActie={onSaveEigenActie}
          onCancelEigenActie={onCancelEigenActie}
          appLabel={appLabel}
        />
      )}

      {coverageStatus === "addressed" && (
        <AddressedBody
          linkedIntents={linkedIntents}
          onReopen={onReopen}
          onEditIntent={onEditIntent}
          appLabel={appLabel}
        />
      )}

      {coverageStatus === "dismissed" && (
        <DismissedBody
          motivation={painPoint?.dismissal_motivation || ""}
          onReopen={onReopen}
          appLabel={appLabel}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function OpenBody({
  lensPickerOpen, lensLoading, aiDraft, eigenActieOpen,
  onChooseAi, onChooseEigen, onChooseDismiss,
  onPickLens, onCancelLens, onAccepteerAi, onVerfijnAi, onWuifWegAi,
  onSaveEigenActie, onCancelEigenActie,
  appLabel,
}) {
  // Eén inline-state actief tegelijk — als lens/draft/eigen open is, geen ChoiceCards
  if (aiDraft) {
    return (
      <AiResultDraft
        draftIntent={aiDraft}
        onAccepteer={onAccepteerAi}
        onVerfijn={onVerfijnAi}
        onWuifWeg={onWuifWegAi}
        appLabel={appLabel}
      />
    );
  }
  if (lensPickerOpen || lensLoading) {
    return (
      <LensPicker
        loading={lensLoading}
        onPickLens={onPickLens}
        onCancel={onCancelLens}
        appLabel={appLabel}
      />
    );
  }
  if (eigenActieOpen) {
    return (
      <EigenActieInline
        onSave={onSaveEigenActie}
        onCancel={onCancelEigenActie}
        appLabel={appLabel}
      />
    );
  }
  return (
    <ChoiceCards
      onChooseAi={onChooseAi}
      onChooseEigen={onChooseEigen}
      onChooseDismiss={onChooseDismiss}
      appLabel={appLabel}
    />
  );
}

function EigenActieInline({ onSave, onCancel, appLabel }) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  const [title, setTitle] = useState("");
  const [intentMd, setIntentMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSave() {
    setErr(null);
    if (title.trim().length < 1 || title.trim().length > 100) {
      setErr(lbl("klanten.verbeteracties.eigen.error.titel", "Titel moet 1-100 tekens zijn"));
      return;
    }
    if (intentMd.trim().length < 50 || intentMd.trim().length > 2000) {
      setErr(lbl("klanten.verbeteracties.eigen.error.intent", "Tekst moet 50-2000 tekens zijn"));
      return;
    }
    setBusy(true);
    const r = await onSave({ title: title.trim(), intentMd: intentMd.trim() });
    setBusy(false);
    if (r?.error) setErr(r.error.message || lbl("klanten.verbeteracties.eigen.error.generic", "Opslaan mislukt"));
  }

  return (
    <div
      className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
      data-testid="doorloop-eigen-actie-form"
    >
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
        {lbl("klanten.verbeteracties.eigen.titel", "Eigen actie schrijven")}
      </h4>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
          {lbl("klanten.verbeteracties.eigen.titel_veld", "Titel")}
        </span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          disabled={busy}
          data-testid="doorloop-eigen-actie-title"
          className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
          {lbl("klanten.verbeteracties.eigen.intent_veld", "Tekst")}
        </span>
        <textarea
          rows={4}
          value={intentMd}
          onChange={e => setIntentMd(e.target.value)}
          maxLength={2000}
          disabled={busy}
          data-testid="doorloop-eigen-actie-intent-md"
          className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[var(--color-accent)] resize-y"
        />
      </label>
      {err && (
        <div className="text-xs text-red-600" data-testid="doorloop-eigen-actie-error">{err}</div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          data-testid="doorloop-eigen-actie-cancel"
          className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-500 px-3 py-2 rounded disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <X size={12} />
          {lbl("klanten.verbeteracties.eigen.annuleer", "Annuleer")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          data-testid="doorloop-eigen-actie-save"
          className="text-xs font-bold uppercase tracking-widest text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] px-3 py-2 rounded disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {lbl("klanten.verbeteracties.eigen.opslaan", "Opslaan")}
        </button>
      </div>
    </div>
  );
}

function AddressedBody({ linkedIntents, onReopen, onEditIntent, appLabel }) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  return (
    <div className="space-y-3" data-testid="doorloop-addressed-body">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
        {lbl("klanten.verbeteracties.addressed.titel", "Gekoppelde verbeteracties")}
      </h4>
      {linkedIntents.length === 0 ? (
        <p className="text-sm text-slate-400 italic">
          {lbl("klanten.verbeteracties.addressed.leeg", "(geen)")}
        </p>
      ) : (
        <ul className="space-y-2">
          {linkedIntents.map(intent => (
            <li
              key={intent.id}
              className="border border-slate-200 rounded p-3"
              data-testid={`doorloop-addressed-intent-${intent.id}`}
            >
              <div className="font-semibold text-sm text-slate-900">{intent.title}</div>
              <p className="text-xs text-slate-600 line-clamp-2 mt-1">{intent.intent_md}</p>
              {onEditIntent && (
                <button
                  type="button"
                  onClick={() => onEditIntent(intent)}
                  data-testid={`doorloop-addressed-intent-edit-${intent.id}`}
                  className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] mt-2"
                >
                  {lbl("klanten.verbeteracties.addressed.bewerk", "Bewerk intent")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onReopen}
        data-testid="doorloop-reopen-pain"
        className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-500 px-3 py-2 rounded inline-flex items-center gap-1.5"
      >
        {lbl("klanten.verbeteracties.actie.reopen", "Maak opnieuw open")}
      </button>
    </div>
  );
}

function DismissedBody({ motivation, onReopen, appLabel }) {
  const lbl = (key, fb) => (appLabel ? appLabel(key, fb) : fb);
  return (
    <div className="space-y-3" data-testid="doorloop-dismissed-body">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
        {lbl("klanten.verbeteracties.dismissed.titel", "Motivatie")}
      </h4>
      <p
        className="text-sm text-slate-700 italic bg-slate-50 border-l-2 border-slate-300 px-3 py-2"
        data-testid="doorloop-dismissed-motivation"
      >
        {motivation || lbl("klanten.verbeteracties.dismissed.geen_motivatie", "(geen motivatie opgegeven)")}
      </p>
      <button
        type="button"
        onClick={onReopen}
        data-testid="doorloop-reopen-pain"
        className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-500 px-3 py-2 rounded inline-flex items-center gap-1.5"
      >
        {lbl("klanten.verbeteracties.actie.reopen", "Maak opnieuw open")}
      </button>
    </div>
  );
}

