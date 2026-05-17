/**
 * OnepagerBuilder — werkblad-agnostische one-pager-builder-overlay.
 *
 * RFC-008 §C — shared/ + designer-spec rapportage-spec.md §2.
 * Block 3: skelet-implementatie. Block 4 vervangt A4Preview-skelet met
 * StrategyOnePager v2-layout (via `LayoutComponent`-prop) + print-CSS.
 *
 * Layout (mockup-conformiteit-gate RFC-008 §11 rij 11):
 *   Overlay-header: ← terug naar Rapportage    [↓ Print / PDF]
 *   ├─ ModelLibrary (320px linker paneel)
 *   │   ├─ AI-toggle (boven)
 *   │   ├─ Vaste blokken (rij 12)
 *   │   ├─ Groepen
 *   │   └─ Selectie-overzicht
 *   └─ A4Preview (rest, live-update)
 *
 * Props:
 *   open              — boolean
 *   onClose           — () => void — sluit overlay (← terug, Escape, X)
 *   onBackToMenu?     — () => void — optioneel: sluit Builder + heropent RapportageMenu
 *   config            — { vasteBlokken, modelLib, dataResolver } uit
 *                       buildStrategieRapportageConfig (of equivalent voor andere werkbladen)
 *   insights          — jsonb-array uit werkblad voor AI-toggle
 *   PreviewComponent? — default A4Preview; injecteerbaar voor testing
 *   LayoutComponent?  — Block 4 levert StrategyOnePager v2; null = skelet-render
 *   appLabel          — (key, fb) => string
 */

import React, { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Printer, Sparkles } from "lucide-react";
import A4Preview from "./A4Preview";
import ModelLibrary from "./ModelLibrary";

// ── AI-toggle (boven linker paneel) ──────────────────────────────────────────
// RFC-008 §11 rij 4 — kleur-tokens AI-accent.
function AiToggle({ withAi, onChange, insightsCount, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  const bodyAan = (lbl(
    "onepager.ai_toggle.body.aan",
    "De one-pager bevat de {N} bevindingen die je in Inzichten markeerde voor het rapport."
  ) || "").replace("{N}", insightsCount);
  const bodyUit = lbl(
    "onepager.ai_toggle.body.uit",
    "One-pager toont alleen jouw eigen inhoud — zonder AI-bevindingen."
  );

  return (
    <div
      data-testid="onepager-ai-toggle-block"
      data-ai-active={withAi ? "true" : "false"}
      className="rounded-md border p-3"
      style={{
        background: "var(--color-ai-accent-bg, rgba(249,115,22,0.08))",
        borderColor: "var(--color-ai-accent, var(--color-accent))",
      }}
    >
      <div className="flex items-start gap-2.5">
        <Sparkles size={14} className="text-[var(--color-ai-accent,var(--color-accent))] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--color-primary)]">
              {lbl("onepager.ai_toggle.titel", "Met AI-inzichten")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={withAi}
              onClick={() => onChange(!withAi)}
              data-testid="onepager-ai-toggle-switch"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                withAi ? "bg-[var(--color-ai-accent,var(--color-accent))]" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform ${
                  withAi ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p
            data-testid="onepager-ai-toggle-body"
            className="text-[10px] text-slate-600 leading-relaxed mt-1"
          >
            {withAi ? bodyAan : bodyUit}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function OnepagerBuilder({
  open,
  onClose,
  onBackToMenu = null,
  config,
  insights = [],
  PreviewComponent = A4Preview,
  LayoutComponent = null,
  appLabel,
}) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  // ── Component-state (RFC-008 §E — geen DB-persistentie v1) ───────────────
  const [withAi, setWithAi] = useState(true);
  // selectedModels: [{ id, label }] in volgorde — label cached zodat
  // A4Preview labels kan tonen zonder config-lookup.
  const [selectedModels, setSelectedModels] = useState([]);

  // Escape sluit overlay
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Flatten modelLib voor lookup
  const modelById = useMemo(() => {
    const map = new Map();
    (config?.modelLib || []).forEach(g => {
      (g.models || []).forEach(m => map.set(m.id, m));
    });
    return map;
  }, [config]);

  // Filtered insights (count voor AI-toggle body-tekst)
  const inRapportCount = (Array.isArray(insights) ? insights : [])
    .filter(i => i.in_rapport === true).length;

  // Per-blok data via dataResolver (vaste blokken)
  const blokData = useMemo(() => {
    const data = {};
    if (typeof config?.dataResolver === "function") {
      (config.vasteBlokken || []).forEach(b => {
        data[b.id] = config.dataResolver(b.id);
      });
      // Samenvatting is geen vast blok maar wel data-resolved voor H1
      data.samenvatting = config.dataResolver("samenvatting");
    }
    return data;
  }, [config]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleToggleModel(modelId, enabled) {
    setSelectedModels(prev => {
      if (enabled) {
        if (prev.some(m => m.id === modelId)) return prev; // al geselecteerd
        const model = modelById.get(modelId);
        if (!model) return prev;
        return [...prev, { id: modelId, label: model.label }];
      } else {
        return prev.filter(m => m.id !== modelId);
      }
    });
  }
  function handleReorder(modelId, direction) {
    setSelectedModels(prev => {
      const idx = prev.findIndex(m => m.id === modelId);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
      return copy;
    });
  }
  function handleRemove(modelId) {
    setSelectedModels(prev => prev.filter(m => m.id !== modelId));
  }

  if (!open) return null;

  return (
    <div
      data-testid="onepager-builder-overlay"
      className="fixed inset-0 z-[80] bg-slate-100 flex flex-col"
    >
      {/* ── Overlay-header ──────────────────────────────────────────────── */}
      <header
        data-testid="onepager-builder-header"
        className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200"
      >
        <button
          type="button"
          onClick={onBackToMenu || onClose}
          data-testid="onepager-builder-back"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={14} />
          {lbl("onepager.builder.header.back", "← terug naar Rapportage")}
        </button>
        <h1 className="text-sm font-semibold text-[var(--color-primary)]">
          {lbl("onepager.builder.header.titel", "One-pager builder")}
        </h1>
        <button
          type="button"
          // Block 3 dood-href + TODO Block 4 — window.print() met print-CSS
          onClick={() => {
            // TODO Block 4 — window.print() + print-CSS hides app-chrome/builder-paneel/builder-knoppen
          }}
          data-testid="onepager-builder-print"
          title={lbl("onepager.builder.action.print.tooltip", "Print of opslaan als PDF (komt in Block 4)")}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 transition-opacity"
        >
          <Printer size={14} />
          {lbl("onepager.builder.action.print", "Print / PDF")}
        </button>
      </header>

      {/* ── Split-layout: linker 320px + rechter rest ───────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Linker paneel — RFC-008 §11 rij 11 */}
        <aside
          data-testid="onepager-builder-leftpanel"
          className="flex-shrink-0 w-[320px] bg-white border-r border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="flex-shrink-0 p-4 border-b border-slate-200">
            <AiToggle
              withAi={withAi}
              onChange={setWithAi}
              insightsCount={inRapportCount}
              appLabel={appLabel}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ModelLibrary
              vasteBlokken={config?.vasteBlokken || []}
              groups={config?.modelLib || []}
              selectedModels={selectedModels}
              onToggleModel={handleToggleModel}
              onReorder={handleReorder}
              onRemove={handleRemove}
              appLabel={appLabel}
            />
          </div>
        </aside>

        {/* Rechter paneel — A4Preview live */}
        <main
          data-testid="onepager-builder-rightpanel"
          className="flex-1 min-w-0 overflow-auto"
        >
          <PreviewComponent
            vasteBlokken={config?.vasteBlokken || []}
            selectedModels={selectedModels}
            withAi={withAi}
            insights={insights}
            data={blokData}
            LayoutComponent={LayoutComponent}
            appLabel={appLabel}
          />
        </main>
      </div>
    </div>
  );
}
