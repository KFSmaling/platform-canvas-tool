/**
 * A4Preview — werkblad-agnostische A4-landschap-preview voor OnepagerBuilder.
 *
 * RFC-008 §C — directe shared/-extractie. Designer-spec:
 * platform/design/prototypes/2026-05-17-strategie-onepager-v2/rapportage-spec.md §2.
 *
 * Block 3 scope: **skelet-render-placeholder** — gekleurde rechthoeken met
 * blok-namen + placeholder-tekst, voldoende om live-preview-update te verifiëren
 * bij toggle/reorder/AI-toggle-acties. Block 4 vervangt skelet met
 * volledige StrategyOnePager v2-layout via `LayoutComponent`-prop.
 *
 * Vaste size: A4 landscape @ 96 dpi = 1190 × 842 CSS px (RFC-008 §11 rij 2).
 * Schaling: CSS `transform: scale(...)` via container — behoudt 1:1 print-
 * betrouwbaarheid (Block 4 print-CSS zet scale=1 + transform-origin: 0 0).
 *
 * Props:
 *   vasteBlokken      — [{ id, label, sub_label, data? }] altijd-zichtbaar
 *   selectedModels    — [{ id, label }] in volgorde gekozen modellen
 *   withAi            — boolean — AI-aandachtspunten-blok zichtbaar
 *   insights          — array van insight-objects, filtered op in_rapport=true
 *                       wanneer withAi=true
 *   data              — werkblad-data uit dataResolver per modelId
 *                       (per-model { ready, completeness_msg? })
 *   LayoutComponent?  — werkblad-specifieke v2-layout (Block 4 injecteert
 *                       StrategyOnePager v2); null = skelet-render
 *   appLabel          — (key, fb) => string
 *   scale?            — number — viewport-scale (default 0.65 voor responsive)
 */

import React from "react";

const A4_WIDTH_PX  = 1190;
const A4_HEIGHT_PX = 842;

// ── Skelet-blok (vaste-blok of geselecteerd model) ───────────────────────────
function SkeletBlok({ label, sub_label, tone = "neutral", warning = null, testId }) {
  const toneClasses = {
    neutral:  "bg-slate-50 border-slate-200 text-slate-700",
    fixed:    "bg-slate-100 border-slate-300 text-slate-700",
    selected: "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40 text-[var(--color-primary)]",
    ai:       "bg-[var(--color-ai-accent)]/10 border-[var(--color-ai-accent)]/40 text-[var(--color-primary)]",
    warning:  "bg-amber-50 border-amber-300 text-amber-900",
  };
  return (
    <div
      data-testid={testId}
      className={`rounded-md border px-3 py-2 ${toneClasses[tone]}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.08em]">{label}</div>
      {sub_label && (
        <div className="text-[10px] opacity-75 mt-0.5">{sub_label}</div>
      )}
      {warning && (
        <div className="text-[10px] text-amber-700 mt-1 italic">{warning}</div>
      )}
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function A4Preview({
  vasteBlokken = [],
  selectedModels = [],
  withAi = true,
  insights = [],
  data = {},
  LayoutComponent = null,
  appLabel,
  scale = 0.65,
}) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  // Filter insights op in_rapport=true wanneer AI-toggle aan
  const visibleInsights = withAi
    ? (Array.isArray(insights) ? insights : []).filter(i => i.in_rapport === true)
    : [];

  // Container fungeert als viewport — schaalt de 1190×842-canvas via transform.
  // Width/height na schaling = A4 * scale; we vullen die ruimte in de outer-container.
  const scaledWidth  = A4_WIDTH_PX  * scale;
  const scaledHeight = A4_HEIGHT_PX * scale;

  return (
    <div
      data-testid="a4-preview-viewport"
      className="relative bg-slate-100 flex items-start justify-center overflow-auto p-6"
      style={{ minHeight: scaledHeight + 48 }}
    >
      <div
        data-testid="a4-preview-canvas"
        // Schalings-wrapper: vaste 1190×842 met transform-scale.
        // transform-origin: top-left zodat scale van linksboven gaat.
        style={{
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <div
          // De échte 1:1 A4-canvas. Print-CSS (Block 4) zal scale=1 + visible houden
          // en de viewport-padding/bg verbergen.
          data-testid="a4-preview-page"
          className="bg-white shadow-lg origin-top-left"
          style={{
            width:  A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {LayoutComponent ? (
            <LayoutComponent
              vasteBlokken={vasteBlokken}
              selectedModels={selectedModels}
              withAi={withAi}
              insights={visibleInsights}
              data={data}
              appLabel={appLabel}
            />
          ) : (
            // ── Skelet-render (Block 3) ───────────────────────────────────────
            <div className="w-full h-full p-8 flex flex-col gap-3 box-border">
              {/* Title-strook (placeholder voor Block 4 H1-statement) */}
              <div className="border-b-2 border-[var(--color-primary)] pb-2 mb-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                  {lbl("onepager.preview.kicker", "One-pager · A4 landschap")}
                </p>
                <h1 className="text-2xl font-semibold text-[var(--color-primary)] tracking-[-0.01em]">
                  {data.samenvatting?.ready
                    ? (data.samenvatting.text || lbl("onepager.preview.h1.placeholder", "Strategische samenvatting"))
                    : lbl("onepager.preview.fallback.samenvatting", "Strategische samenvatting nog niet gegenereerd")}
                </h1>
              </div>

              {/* Vaste blokken */}
              {vasteBlokken.map(blok => {
                const blokData = data[blok.id] || {};
                const isReady = blokData.ready !== false;
                return (
                  <SkeletBlok
                    key={blok.id}
                    testId={`a4-preview-vaste-${blok.id}`}
                    label={blok.label}
                    sub_label={blok.sub_label}
                    tone="fixed"
                    warning={!isReady ? blokData.completeness_msg : null}
                  />
                );
              })}

              {/* Geselecteerde modellen-blokken in volgorde */}
              {selectedModels.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-slate-400 font-semibold">
                    {lbl("onepager.preview.selectie.titel", "Modellen")}
                  </p>
                  {selectedModels.map(m => (
                    <SkeletBlok
                      key={m.id}
                      testId={`a4-preview-model-${m.id}`}
                      label={m.label}
                      sub_label={lbl("onepager.preview.model.placeholder", "Block 4 vult dit blok met inhoud uit de werkblad-data.")}
                      tone="selected"
                    />
                  ))}
                </div>
              )}

              {/* AI-aandachtspunten-blok (alleen als withAi=true) */}
              {withAi && (
                <div className="mt-auto pt-3 border-t border-[var(--color-ai-accent)]/30">
                  {visibleInsights.length > 0 ? (
                    <SkeletBlok
                      testId="a4-preview-insights-block"
                      label={lbl("onepager.preview.insights.titel", "Aandachtspunten uit Inzichten")}
                      sub_label={`${visibleInsights.length} ${lbl("onepager.preview.insights.suffix", "bevindingen opgenomen — Block 4 vult de tekst in")}`}
                      tone="ai"
                    />
                  ) : (
                    <SkeletBlok
                      testId="a4-preview-insights-empty"
                      label={lbl("onepager.preview.insights.titel", "Aandachtspunten uit Inzichten")}
                      sub_label={lbl("onepager.preview.fallback.insights", "Geen bevindingen geselecteerd in Inzichten.")}
                      tone="warning"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export constants voor unit-tests + Block 4 print-CSS-coördinatie.
A4Preview.A4_WIDTH_PX  = A4_WIDTH_PX;
A4Preview.A4_HEIGHT_PX = A4_HEIGHT_PX;
