/**
 * IntentCard — één kaart per cd_improvement_intents in VerbeteractiesView.
 *
 * Toont:
 *   - Status-badge (concept / verstuurd + datum)
 *   - Titel + intent_md (whitespace-pre-wrap render, conform andere werkbladen)
 *   - "Vanuit"-chips (jsonb-array)
 *   - 3 actie-knoppen:
 *       concept → Bewerk / Verwijder / Markeer als in roadmap
 *       verstuurd → Bewerk / Verwijder / Haal uit roadmap
 *
 * F9-rebrand-consistency: geen Accept/Reject-terminologie. Status-transities
 * concept ↔ verstuurd. F18-rebrand (stap 11.K.2): UI-labels gebruiken
 * "in roadmap" terminologie i.p.v. "verstuurd"; DB-enum blijft `'verstuurd'`
 * tot RFC-003 / 11.L Roadmap-werkblad (zie tech_debt.md F15 / ADR-004 §G).
 *
 * Props:
 *   - intent: cd_improvement_intents-rij
 *   - busy: boolean (true tijdens action-call → knoppen disabled)
 *   - onEdit(intent)
 *   - onDelete(intent)
 *   - onHandover(intent) — stub voor Roadmap, status→verstuurd
 *   - onUnsend(intent)   — terugtrekken, status→concept
 */

import React from "react";
import { useAppConfig } from "../../shared/context/AppConfigContext";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function IntentCard({
  intent,
  busy = false,
  onEdit,
  onDelete,
  onHandover,
  onUnsend,
}) {
  const { label: appLabel } = useAppConfig();
  // 11.U Block 1 (RFC-007-rev2): status='verstuurd' is gemigreerd naar
  // 'definitief'. Check beide voor backwards-compat met legacy-rows
  // (eigenlijk niet nodig na migratie maar defensive).
  const isVerstuurd = intent.status === "definitief" || intent.status === "verstuurd";
  const vanuit = Array.isArray(intent.vanuit) ? intent.vanuit : [];

  return (
    <div
      data-testid={`intent-card-${intent.id}`}
      data-status={intent.status}
      className="rounded-md p-4 border border-slate-200 border-l-[3px] bg-white"
      style={{ borderLeftColor: isVerstuurd ? "var(--color-primary)" : "#94a3b8" }}
    >
      {/* Header: status-badge + titel */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isVerstuurd ? (
              <span
                data-testid={`intent-status-${intent.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm text-white"
                style={{ background: "var(--color-primary)" }}
                title={appLabel("klanten.verbeterrichting.status.in_roadmap.tooltip", "Verbeteractie is definitief")}
              >
                {appLabel("klanten.verbeterrichting.status.verstuurd", "definitief")}
                {intent.handover_to_roadmap_at && (
                  <span className="font-normal opacity-80">
                    · {appLabel("klanten.verbeterrichting.handover.datum", "definitief sinds")} {formatDate(intent.handover_to_roadmap_at)}
                  </span>
                )}
              </span>
            ) : (
              <span
                data-testid={`intent-status-${intent.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm bg-slate-100 text-slate-700 border border-slate-300"
                title={appLabel("klanten.verbeterrichting.status.concept.tooltip", "Concept — verbeteractie staat in fase 4 maar is nog niet definitief gemaakt")}
              >
                {appLabel("klanten.verbeterrichting.status.concept", "concept")}
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-[var(--color-primary)]">{intent.title}</h4>
        </div>
      </div>

      {/* Beschrijving */}
      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-slate-700 mb-3">
        {intent.intent_md}
      </p>

      {/* Vanuit-chips */}
      {vanuit.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest mr-2 text-slate-500">
            {appLabel("klanten.verbeterrichting.veld.vanuit.label", "Vanuit")}:
          </span>
          <span className="inline-flex flex-wrap gap-1">
            {vanuit.map((v, i) => (
              <span
                key={i}
                className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200"
              >
                {String(v).length > 80 ? String(v).slice(0, 79) + "…" : v}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Acties */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/70">
        <button
          type="button"
          disabled={busy}
          onClick={() => onEdit(intent)}
          data-testid={`intent-actie-bewerk-${intent.id}`}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 disabled:opacity-50"
        >
          {appLabel("klanten.actie.bewerk", "Bewerk")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(intent)}
          data-testid={`intent-actie-verwijder-${intent.id}`}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors text-slate-500 hover:text-red-700 disabled:opacity-50"
        >
          {appLabel("klanten.actie.verwijder", "Verwijder")}
        </button>
        {/* S4 (RFC-007 C1): handover/unsend-acties zijn conditional zodat
            VerbeteractiesView ze kan onderdrukken voor de overflow-menu-pad
            op definitief-entries (RFC §3.3 — "Terug naar concept" overflow,
            niet primary). Concept-intents tonen handover als primary
            ("Maak definitief"). */}
        {isVerstuurd && typeof onUnsend === "function" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUnsend(intent)}
            data-testid={`intent-actie-terugtrekken-${intent.id}`}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-400 text-slate-700 hover:border-slate-600 disabled:opacity-50"
          >
            {appLabel("klanten.verbeterrichting.actie.terugtrekken", "Terug naar concept")}
          </button>
        )}
        {!isVerstuurd && typeof onHandover === "function" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onHandover(intent)}
            data-testid={`intent-actie-markeer-${intent.id}`}
            title={appLabel("klanten.verbeterrichting.actie.markeer.tooltip", "Maak deze verbeteractie definitief")}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {appLabel("klanten.verbeterrichting.actie.markeer", "Maak definitief")}
          </button>
        )}
      </div>
    </div>
  );
}
