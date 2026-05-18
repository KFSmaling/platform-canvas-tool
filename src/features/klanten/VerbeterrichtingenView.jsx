/**
 * @deprecated Sinds RFC-007 C1 (S4-cyclus, mei 2026): `VerbeteractiesView`
 * combineert AnalyseView + VerbeterrichtingenView. Dit bestand is dead-code;
 * behouden voor git-history + regressie-protection op evt. legacy-paden.
 * NIET meer importeren in nieuwe code. Inplannen voor verwijdering in volgende
 * cleanup-sprint (verifieer eerst geen tests/imports meer hangen).
 *
 * --- ORIGINELE DOC (behouden voor context) ---
 *
 * VerbeterrichtingenView — fase-4 root-component (RFC-001 §2.7, ADR-003 §B).
 *
 * Layout:
 *   1. Intro-tekst + counter "X concept · Y verstuurd"
 *   2. Concept-intents (lijst) + collapse "Verstuurd (M)" eronder
 *   3. "+ verbeterrichting toevoegen"-knop onderaan (consultant-eigen)
 *
 * State-discipline (CLAUDE.md §4):
 *   - intents/reload als props (single source of truth in KlantenWerkblad —
 *     zelfde pattern als 11.G.4 voor suggestions zodat RapportView altijd
 *     fresh data heeft)
 *   - Acties checken `error` expliciet (4.2)
 *   - Geen optimistic update — wacht op service-bevestiging dan reload()
 *   - canvasIdRef voor async callbacks (4.4)
 *
 * Props:
 *   - canvasId
 *   - intents, loading, error, reload  (van useIntents in KlantenWerkblad)
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, Plus } from "lucide-react";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import * as klantenService from "./services/klanten.service";
import IntentCard from "./IntentCard";
import IntentModal from "./IntentModal";
import CollapseSection from "./CollapseSection";

export default function VerbeterrichtingenView({
  canvasId,
  intents,
  loading,
  error,
  reload,
}) {
  const { label: appLabel } = useAppConfig();

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const [busyAction, setBusyAction] = useState(null); // { action, id? } of null
  const [globalError, setGlobalError] = useState(null);
  const [modalState, setModalState] = useState(null); // { mode: "create"|"edit", intent? } of null

  const { conceptList, verstuurdList, conceptCount, verstuurdCount } = useMemo(() => {
    const list = intents || [];
    // 11.U Block 1 (RFC-007-rev2): status='verstuurd' → 'definitief' via migratie.
    const concept   = list.filter(i => i.status === "concept");
    const verstuurd = list.filter(i => i.status === "definitief" || i.status === "verstuurd");
    return {
      conceptList:   concept,
      verstuurdList: verstuurd,
      conceptCount:  concept.length,
      verstuurdCount: verstuurd.length,
    };
  }, [intents]);

  function openCreate() {
    setModalState({ mode: "create", intent: null });
  }
  function openEdit(intent) {
    setModalState({ mode: "edit", intent });
  }
  function closeModal() {
    setModalState(null);
  }

  async function handleSaveModal({ title, intentMd, vanuit }) {
    if (!modalState) return { error: new Error("modal context ontbreekt") };
    let res;
    if (modalState.mode === "edit") {
      res = await klantenService.updateIntent(modalState.intent.id, { title, intentMd });
    } else {
      res = await klantenService.createIntent({
        canvasId: canvasIdRef.current,
        title,
        intentMd,
        vanuit,
        sortOrder: (intents || []).length * 10,
      });
    }
    if (res.error) return { error: res.error };
    reload();
    return { error: null };
  }

  async function handleDelete(intent) {
    if (busyAction) return;
    setBusyAction({ action: "delete", id: intent.id });
    setGlobalError(null);
    const { error: delErr } = await klantenService.deleteIntent(intent.id);
    setBusyAction(null);
    if (delErr) { setGlobalError(delErr); return; }
    reload();
  }

  async function handleHandover(intent) {
    if (busyAction) return;
    // K-fix bevinding 3a: confirm-dialoog weggehaald. "Maak definitief" is
    // reversible via "Terug naar concept" (unsendIntent) — geen waarschuwing nodig.
    setBusyAction({ action: "handover", id: intent.id });
    setGlobalError(null);
    const { error: hoErr } = await klantenService.handoverIntentToRoadmap(intent.id);
    setBusyAction(null);
    if (hoErr) { setGlobalError(hoErr); return; }
    reload();
  }

  async function handleUnsend(intent) {
    if (busyAction) return;
    setBusyAction({ action: "unsend", id: intent.id });
    setGlobalError(null);
    const { error: unsErr } = await klantenService.unsendIntent(intent.id);
    setBusyAction(null);
    if (unsErr) { setGlobalError(unsErr); return; }
    reload();
  }

  const isInitialLoad = loading && intents === null;

  if (isInitialLoad) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="max-w-md">
          <p className="text-sm text-red-700 font-bold mb-2">Laden mislukt</p>
          <p className="text-xs text-slate-600 mb-4">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest rounded"
          >
            Opnieuw proberen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Intro + counter */}
      <div className="mb-6">
        <p className="text-[11px] text-slate-500 italic mb-3 max-w-3xl">
          {appLabel("klanten.verbeterrichting.intro", "Verscherp geaccepteerde patronen tot intent.")}
        </p>
        <div className="text-[11px] text-slate-500" data-testid="verbeterrichting-counter">
          <span data-testid="counter-concept">{conceptCount}</span>{" "}
          {appLabel("klanten.verbeterrichting.counter.concept", "concept")}
          {" "}<span className="text-slate-400">{appLabel("klanten.verbeterrichting.counter.separator", "·")}</span>{" "}
          <span data-testid="counter-verstuurd">{verstuurdCount}</span>{" "}
          {appLabel("klanten.verbeterrichting.counter.verstuurd", "definitief")}
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-4 flex items-center justify-between">
          <span>{globalError.message || "Actie mislukt"}</span>
          <button
            type="button"
            onClick={() => { setGlobalError(null); reload(); }}
            className="text-[10px] font-bold uppercase tracking-widest text-red-700 hover:text-red-900 ml-3"
          >
            Opnieuw
          </button>
        </div>
      )}

      {/* Concept-lijst (hoofdcontent) */}
      <div className="mb-6">
        {conceptCount === 0 && verstuurdCount === 0 ? (
          <p className="text-[12px] text-slate-400 italic" data-testid="verbeterrichting-lijst-leeg">
            {appLabel("klanten.verbeterrichting.lijst.leeg", "Nog geen verbeteracties — promoot een gemarkeerd patroon vanuit fase 3 of voeg een eigen verbeteractie toe.")}
          </p>
        ) : conceptList.length === 0 ? null : (
          <div className="space-y-3" data-testid="verbeterrichting-lijst-concept">
            {conceptList.map(intent => (
              <IntentCard
                key={intent.id}
                intent={intent}
                busy={!!busyAction && busyAction.id === intent.id}
                onEdit={openEdit}
                onDelete={handleDelete}
                onHandover={handleHandover}
                onUnsend={handleUnsend}
              />
            ))}
          </div>
        )}
      </div>

      {/* Verstuurd-collapse */}
      {verstuurdList.length > 0 && (
        <div className="mb-6" data-testid="verbeterrichting-lijst-verstuurd">
          <CollapseSection
            title={`${appLabel("klanten.verbeterrichting.status.verstuurd", "Definitief")} (${verstuurdCount})`}
            items={verstuurdList}
            emptyMessage=""
            actionLabel={appLabel("klanten.verbeterrichting.actie.terugtrekken", "Haal uit roadmap")}
            onAction={handleUnsend}
            testIdPrefix="verstuurd"
            busyId={busyAction?.action === "unsend" ? busyAction.id : null}
          />
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          disabled={!!busyAction}
          data-testid="verbeterrichting-knop-toevoegen"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:text-[var(--color-primary)] border border-slate-300 hover:border-slate-500 px-3 py-1.5 rounded-sm transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          {appLabel("klanten.verbeterrichting.knop.toevoegen", "+ verbeteractie toevoegen")}
        </button>
      </div>

      {/* Modal */}
      {modalState && (
        <IntentModal
          mode={modalState.mode}
          intent={modalState.intent}
          onClose={closeModal}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
}
