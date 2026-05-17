/**
 * A4Preview — werkblad-agnostische A4-landschap-preview voor OnepagerBuilder.
 *
 * RFC-008 §C — directe shared/-extractie. Designer-spec:
 * platform/design/prototypes/2026-05-17-strategie-onepager-v2/rapportage-spec.md §2.
 *
 * 11.S Block 3: skelet-render. 11.S Block 4: LayoutComponent-pad voor v2.
 * 11.S retro (18 mei): dynamische scaling via ResizeObserver (Kees-test-feedback
 * "past niet op scherm") + multi-page builder-preview support (Kees-akkoord
 * "mag best twee pagina's worden als het niet past"). LayoutComponent krijgt
 * `Page`-slot doorgegeven; rendert N A4Page-children = N pagina's stacked
 * verticaal in builder-preview. Print-CSS regelt eigen pagina-splitsing.
 *
 * Architectuur:
 *   - A4Preview = viewport-wrapper met ResizeObserver-scale + scroll-container
 *   - A4Page (sub-component, geëxporteerd via Page-slot-prop) = één A4-frame
 *     (1190×842 CSS px) met shadow + page-counter top-right
 *   - LayoutComponent (werkblad-specifiek, bv StrategyOnePager v2) krijgt
 *     `Page`-prop en bepaalt zelf 1-of-N pagina's
 *
 * Vaste size: A4 landscape @ 96 dpi = 1190 × 842 CSS px (RFC-008 §11 rij 2).
 * Schaling: ResizeObserver berekent `scale = (viewport_w - padding) / 1190`,
 * geclamped op [0.4, 1.0]. Inner content blijft 1:1 A4 via
 * `transform: scale(...)` + `transform-origin: top left`.
 *
 * Props:
 *   vasteBlokken      — [{ id, label, sub_label, data? }] altijd-zichtbaar
 *   selectedModels    — [{ id, label }] in volgorde gekozen modellen
 *   withAi            — boolean — AI-aandachtspunten-blok zichtbaar
 *   insights          — array van insight-objects, filtered op in_rapport=true
 *                       wanneer withAi=true
 *   data              — werkblad-data uit dataResolver per modelId
 *   LayoutComponent?  — werkblad-specifieke v2-layout (Block 4 injecteert
 *                       StrategyOnePager v2); null = skelet-render
 *   appLabel          — (key, fb) => string
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const A4_WIDTH_PX  = 1190;
const A4_HEIGHT_PX = 842;
const VIEWPORT_PADDING = 48; // p-6 op viewport-container (24px elke kant)
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.0;
const INITIAL_SCALE = 0.65;

// ── A4Page sub-component (geëxporteerd via Page-slot-prop) ───────────────────
// Eén A4-frame: vaste 1190×842 CSS px, witte bg, subtle shadow, page-counter
// rechtsboven (alleen in builder zichtbaar — print-CSS verbergt via
// `.strategie-onepager-source-tag`-class die ook page-counter krijgt).
export function A4Page({ pageNum = 1, totalPages = 1, children, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const counterLabel = (lbl("onepager.page_counter", "Pagina {N} / {Total}") || "")
    .replace("{N}", pageNum)
    .replace("{Total}", totalPages);
  return (
    <div
      data-testid={`a4-page-${pageNum}`}
      data-page-num={pageNum}
      data-total-pages={totalPages}
      className="bg-white shadow-md mb-4 relative overflow-hidden"
      style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
    >
      {children}
      {totalPages > 1 && (
        <span
          // strategie-onepager-source-tag → automatisch hidden in print-CSS
          // (Block 4 PrintStyles.css regel "display: none !important").
          className="strategie-onepager-source-tag absolute top-2 right-3 z-10"
          data-testid={`a4-page-counter-${pageNum}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            color: "#94a3b8",
            letterSpacing: "0.04em",
          }}
        >
          {counterLabel}
        </span>
      )}
    </div>
  );
}

// ── Skelet-blok (Block 3 fallback wanneer geen LayoutComponent) ──────────────
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
      {sub_label && <div className="text-[10px] opacity-75 mt-0.5">{sub_label}</div>}
      {warning && <div className="text-[10px] text-amber-700 mt-1 italic">{warning}</div>}
    </div>
  );
}

// Skelet-render (Block 3 backwards-compat, alleen actief als LayoutComponent=null).
// Rendert binnen één A4Page (skelet ondersteunt geen multi-page).
function SkeletLayout({ vasteBlokken, selectedModels, visibleInsights, data, withAi, appLabel, Page }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  return (
    <Page pageNum={1} totalPages={1} appLabel={appLabel}>
      <div className="w-full h-full p-8 flex flex-col gap-3 box-border">
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
    </Page>
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
}) {
  // ── Refs + state voor dynamische scaling ──────────────────────────────────
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT_PX);

  // ResizeObserver op viewport → scale-berekening (Kees-test-fix 18 mei).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width || 0;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, (w - VIEWPORT_PADDING) / A4_WIDTH_PX)
      );
      setScale(newScale);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ResizeObserver op content → tracking van totale rendered hoogte
  // (multi-page → contentHeight = N * A4_HEIGHT_PX + (N-1) * gap).
  // useLayoutEffect zodat we vóór de paint de juiste wrapper-hoogte zetten
  // en flickering voorkomen.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height || A4_HEIGHT_PX;
      setContentHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter insights op in_rapport=true wanneer AI-toggle aan
  const visibleInsights = withAi
    ? (Array.isArray(insights) ? insights : []).filter(i => i.in_rapport === true)
    : [];

  // Outer-wrapper-hoogte = visuele schaling van content
  const scaledHeight = contentHeight * scale;

  return (
    <div
      ref={viewportRef}
      data-testid="a4-preview-viewport"
      data-scale={scale.toFixed(2)}
      className="relative bg-slate-100 overflow-auto p-6 flex justify-center"
      style={{ minHeight: scaledHeight + VIEWPORT_PADDING }}
    >
      {/* Scaled-wrapper houdt de visuele bounding-box vast zodat scroll werkt. */}
      <div
        data-testid="a4-preview-scaled-wrapper"
        style={{
          width: A4_WIDTH_PX * scale,
          height: scaledHeight,
        }}
      >
        {/* Echte 1:1-content container met transform-scale. Print-CSS reset
            transform via [data-testid="a4-preview-page"]-selector — daarvoor
            elke A4Page-child houdt zijn eigen data-testid. */}
        <div
          ref={contentRef}
          data-testid="a4-preview-page"
          className="origin-top-left"
          style={{
            width:  A4_WIDTH_PX,
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
              Page={A4Page}
            />
          ) : (
            <SkeletLayout
              vasteBlokken={vasteBlokken}
              selectedModels={selectedModels}
              visibleInsights={visibleInsights}
              data={data}
              withAi={withAi}
              appLabel={appLabel}
              Page={A4Page}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Export constants voor unit-tests + Block 4 print-CSS-coördinatie.
A4Preview.A4_WIDTH_PX  = A4_WIDTH_PX;
A4Preview.A4_HEIGHT_PX = A4_HEIGHT_PX;
A4Preview.MIN_SCALE    = MIN_SCALE;
A4Preview.MAX_SCALE    = MAX_SCALE;
