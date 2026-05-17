/**
 * StrategyOnePager v2 — werkblad-specifieke A4-landscape-layout voor Strategie.
 *
 * 11.S Block 4 — vervangt v1 volledig (v1 in git-history beschikbaar via blame).
 * Geïnjecteerd in shared/A4Preview via `LayoutComponent`-prop (OnepagerBuilder).
 *
 * RFC-008 §F + designer-spec
 * `platform/design/prototypes/2026-05-17-strategie-onepager-v2/`:
 *   - data-mapping.md autoritatief voor blok-content
 *   - screenshots/overview.png + 01-artboard.png voor visuele referentie
 *
 * Layout (top→bottom in 1190 × 842 px frame):
 *   1. Brand-strip (50px dark bg + accent-line)
 *   2. Titel-block (eyebrow + H1 samenvatting)
 *   3. Identiteits-band (3-kolom Missie/Visie/Ambitie+Kernwaarden)
 *   4. KPI-strip (4-kolom mono-waarden, fallback BHAG+Horizon)
 *   5. Strategische thema's (responsief 4 of N-kolommen)
 *   6. Body-zone (selectie-modellen + AI-aandachtspunten naast/onder)
 *   7. Footer (vertrouwelijk-strip + paginanummer)
 *
 * Font-stack (lokaal via StrategyOnePagerFonts.css):
 *   - InterStrategy (body)
 *   - SourceSerifStrategy (display, H1 + Ambitie)
 *   - JetBrainsStrategy (mono, KPI-waarden + source-tags)
 *
 * Source-tags (`.strategie-onepager-source-tag`) tonen DB-bron per kolom in
 * builder-preview als debug-affordance. Verborgen in print via PrintStyles.css.
 */

import React from "react";
import "./StrategyOnePagerFonts.css";

// ── Brand-strip top ──────────────────────────────────────────────────────────
function BrandStrip({ tenantBrand, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  return (
    <>
      <header
        data-testid="strategie-onepager-brand-strip"
        className="flex items-center justify-between px-6"
        style={{
          height: 50,
          background: "var(--color-primary)",
          color: "white",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {tenantBrand || lbl("strategie.onepager.brand.fallback", "Platform")}
          </span>
          <span className="text-[9px] uppercase tracking-[0.18em] opacity-70">
            {lbl("strategie.onepager.brand.kicker", "Business Transformation Canvas")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] uppercase tracking-[0.18em] opacity-70">
            {lbl("strategie.onepager.werkblad.label", "WERKBLAD")}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            {lbl("strategie.onepager.werkblad.naam", "STRATEGIE")}
          </span>
        </div>
      </header>
      <div style={{ height: 2, background: "var(--color-accent)" }} aria-hidden="true" />
    </>
  );
}

// ── Titel-block ──────────────────────────────────────────────────────────────
function TitelBlock({ samenvatting, canvasName, tenantBrand, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const ready = !!samenvatting;
  return (
    <section data-testid="strategie-onepager-titel-block" className="px-6 pt-3 pb-3">
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-1"
        style={{ color: "var(--color-accent)" }}
      >
        {lbl("strategie.onepager.titel.eyebrow", "STRATEGIE · EXECUTIVE SUMMARY")}
      </p>
      <div className="flex items-start justify-between gap-6">
        <h1
          data-testid="strategie-onepager-h1"
          className={`flex-1 leading-tight m-0 ${ready ? "" : "text-slate-400 italic"}`}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 600,
            color: ready ? "var(--color-primary)" : "#94a3b8",
            letterSpacing: "-0.01em",
          }}
        >
          {ready
            ? samenvatting
            : lbl("strategie.onepager.titel.fallback", "Strategische samenvatting nog niet gegenereerd")}
        </h1>
        {(canvasName || tenantBrand) && (
          <div className="text-right flex-shrink-0">
            {canvasName && (
              <div className="text-[11px] font-medium text-slate-700">{canvasName}</div>
            )}
            {tenantBrand && (
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 mt-0.5">{tenantBrand}</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Source-tag (debug-only, hidden in print) ─────────────────────────────────
function SourceTag({ name }) {
  return (
    <span
      className="strategie-onepager-source-tag"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 7,
        color: "#cbd5e1",
        letterSpacing: "0.02em",
      }}
    >
      {name}
    </span>
  );
}

// ── Identiteits-band ─────────────────────────────────────────────────────────
function IdentiteitsBand({ data, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const missie  = data?.missie;
  const visie   = data?.visie;
  const ambitie = data?.ambitie;
  const kernwaarden = Array.isArray(data?.kernwaarden) ? data.kernwaarden : [];

  const Kolom = ({ label, source, value, fallback, italic, eyebrow }) => (
    <div className="flex flex-col" style={{ minHeight: 90 }}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        <SourceTag name={source} />
      </div>
      {eyebrow && (
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] mb-1"
              style={{ color: "var(--color-accent)" }}>
          {eyebrow}
        </span>
      )}
      <p
        className="m-0 leading-snug"
        style={{
          fontFamily: italic ? "var(--font-display)" : "var(--font-body)",
          fontStyle: italic ? "italic" : "normal",
          fontSize: italic ? 12 : 10.5,
          color: value ? "var(--color-primary)" : "#94a3b8",
        }}
      >
        {value || fallback}
      </p>
    </div>
  );

  return (
    <section
      data-testid="strategie-onepager-identiteit-band"
      className="px-6 pb-2"
    >
      <div
        className="grid gap-4 p-3 rounded"
        style={{
          gridTemplateColumns: "1fr 1fr 1.1fr",
          background: "#FAF8F2",
          borderLeft: "3px solid var(--color-accent)",
        }}
      >
        <Kolom
          label={lbl("strategie.onepager.identiteit.missie.label", "MISSIE")}
          source="strategy_core.missie"
          value={missie}
          fallback={lbl("strategie.onepager.identiteit.missie.fallback", "Missie nog niet ingevuld")}
        />
        <Kolom
          label={lbl("strategie.onepager.identiteit.visie.label", "VISIE")}
          source="strategy_core.visie"
          value={visie}
          fallback={lbl("strategie.onepager.identiteit.visie.fallback", "Visie nog niet ingevuld")}
        />
        <div className="flex flex-col" style={{ minHeight: 90 }}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {lbl("strategie.onepager.identiteit.ambitie.label", "AMBITIE")}
            </span>
            <SourceTag name="strategy_core.ambitie" />
          </div>
          <span
            className="text-[8px] font-bold uppercase tracking-[0.18em] mb-1"
            style={{ color: "var(--color-accent)" }}
          >
            {lbl("strategie.onepager.identiteit.ambitie.eyebrow", "BHAG")}
          </span>
          <p
            className="m-0 leading-snug"
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 12,
              color: ambitie ? "var(--color-primary)" : "#94a3b8",
            }}
          >
            {ambitie || lbl("strategie.onepager.identiteit.ambitie.fallback", "Ambitie nog niet ingevuld")}
          </p>
          {kernwaarden.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200/60">
              <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500 block mb-0.5">
                {lbl("strategie.onepager.identiteit.kernwaarden.label", "KERNWAARDEN")}
              </span>
              <p
                data-testid="strategie-onepager-kernwaarden-inline"
                className="m-0 text-[10px] text-slate-700 leading-snug"
              >
                {kernwaarden.join(" · ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── KPI-strip ────────────────────────────────────────────────────────────────
function KpiStrip({ data, appLabel }) {
  const kpis = Array.isArray(data?.kpis) ? data.kpis : [];
  return (
    <section data-testid="strategie-onepager-kpi-strip" className="px-6 pb-2">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => (
          <div
            key={kpi.id || idx}
            data-testid={`strategie-onepager-kpi-cell-${idx}`}
            data-fallback={kpi.isFallback ? "true" : "false"}
            className="p-2 rounded border"
            style={{
              borderColor: kpi.isFallback ? "#e2e8f0" : "var(--color-primary)",
              background: kpi.isFallback ? "#f8fafc" : "white",
            }}
          >
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
              {kpi._themaCode}{kpi._themaTitle && kpi._themaCode !== kpi._themaTitle ? ` · ${kpi._themaTitle}` : ""}
            </p>
            <p
              className="m-0 leading-none"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                fontWeight: 500,
                color: "var(--color-primary)",
              }}
            >
              {kpi.target_value || "—"}
            </p>
            <p
              className="m-0 text-[9px] text-slate-500 mt-0.5"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {kpi.current_value
                ? `nu ${kpi.current_value} → ${kpi.target_value || "?"}`
                : kpi.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Strategische thema's ─────────────────────────────────────────────────────
function ThemasGrid({ data, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const themas = Array.isArray(data?.themas) ? data.themas : [];

  if (themas.length === 0) {
    return (
      <section
        data-testid="strategie-onepager-themas-empty"
        className="px-6 pb-2"
      >
        <p className="text-[10px] italic text-amber-700 p-2 bg-amber-50 border border-amber-200 rounded">
          {lbl("strategie.onepager.themas.fallback", "Geen strategische thema's gedefinieerd — voeg eerst toe")}
        </p>
      </section>
    );
  }

  const compact = themas.length > 4;
  const cols = compact ? Math.min(themas.length, 7) : 4;

  return (
    <section data-testid="strategie-onepager-themas-grid" className="px-6 pb-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
        {lbl("strategie.onepager.themas.titel", "01 · STRATEGISCHE THEMA'S · KSF & KPI")}
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {themas.slice(0, 7).map((thema) => {
          const ksfKpi = Array.isArray(thema.ksf_kpi) ? thema.ksf_kpi : [];
          const ksfs = ksfKpi.filter(k => k.type === "ksf").sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const kpis = ksfKpi.filter(k => k.type === "kpi").sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const showKsfs = compact ? ksfs.slice(0, 1) : ksfs;
          const showKpis = compact ? kpis.slice(0, 2) : kpis;
          return (
            <div
              key={thema.id || thema._code}
              data-testid={`strategie-onepager-thema-${thema._code}`}
              className="p-2 rounded border border-slate-200 bg-white flex flex-col"
            >
              <div className="flex items-baseline gap-1.5 mb-1">
                <span
                  className="text-[8px] font-bold uppercase tracking-[0.14em] flex-shrink-0"
                  style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
                >
                  {thema._code}
                </span>
                <span className="text-[10px] font-semibold text-[var(--color-primary)] leading-tight truncate">
                  {thema.title || thema.titel || ""}
                </span>
              </div>
              {showKsfs.length > 0 && (
                <div className="mb-1 pl-1.5" style={{ borderLeft: "2px solid var(--color-success, #16a34a)" }}>
                  {showKsfs.map((ksf, i) => (
                    <p key={i} className="text-[9px] text-slate-700 leading-snug m-0">
                      {ksf.description}
                    </p>
                  ))}
                </div>
              )}
              {showKpis.length > 0 && (
                <div className="mt-auto flex flex-col gap-0.5">
                  {showKpis.map((kpi, i) => (
                    <div key={i}>
                      <p className="text-[9px] text-slate-600 leading-tight m-0">
                        {kpi.description}
                      </p>
                      <p
                        className="text-[9px] m-0"
                        style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}
                      >
                        {kpi.current_value || "—"} → {kpi.target_value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── SWOT-model (configureerbaar) ─────────────────────────────────────────────
function SwotModel({ data, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const sterkten     = Array.isArray(data?.sterkten) ? data.sterkten : [];
  const zwakten      = Array.isArray(data?.zwakten) ? data.zwakten : [];
  const kansen       = Array.isArray(data?.kansen) ? data.kansen : [];
  const bedreigingen = Array.isArray(data?.bedreigingen) ? data.bedreigingen : [];

  const Quadrant = ({ titel, items, tone, testIdSuffix }) => (
    <div
      data-testid={`strategie-onepager-swot-${testIdSuffix}`}
      className={`p-2 rounded border ${tone}`}
    >
      <p className="text-[8px] font-bold uppercase tracking-[0.14em] mb-1">{titel}</p>
      {items.length === 0 ? (
        <p className="text-[9px] italic text-slate-400 m-0">—</p>
      ) : (
        <ul className="m-0 pl-3 list-disc">
          {items.slice(0, 4).map((it, i) => (
            <li key={i} className="text-[9px] leading-snug text-slate-700">
              {it.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="strategie-onepager-model-block" data-testid="strategie-onepager-model-swot">
      <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
        {lbl("strategie.onepager.swot.titel", "SWOT-analyse — intern en extern")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Quadrant
          titel={lbl("strategie.onepager.swot.sterkten", "Sterkten")}
          items={sterkten}
          tone="border-green-300 bg-green-50/40 text-green-900"
          testIdSuffix="sterkten"
        />
        <Quadrant
          titel={lbl("strategie.onepager.swot.kansen", "Kansen")}
          items={kansen}
          tone="border-blue-300 bg-blue-50/40 text-blue-900"
          testIdSuffix="kansen"
        />
        <Quadrant
          titel={lbl("strategie.onepager.swot.zwakten", "Zwakten")}
          items={zwakten}
          tone="border-amber-300 bg-amber-50/40 text-amber-900"
          testIdSuffix="zwakten"
        />
        <Quadrant
          titel={lbl("strategie.onepager.swot.bedreigingen", "Bedreigingen")}
          items={bedreigingen}
          tone="border-red-300 bg-red-50/40 text-red-900"
          testIdSuffix="bedreigingen"
        />
      </div>
    </div>
  );
}

// ── Kernwaarden-bord-model (configureerbaar) ─────────────────────────────────
function KernwaardenBordModel({ data, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const kernwaarden = Array.isArray(data?.kernwaarden) ? data.kernwaarden : [];
  return (
    <div className="strategie-onepager-model-block" data-testid="strategie-onepager-model-kernwaarden">
      <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
        {lbl("strategie.onepager.identiteit.kernwaarden.label", "KERNWAARDEN")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {kernwaarden.map((kw, i) => (
          <div
            key={i}
            data-testid={`strategie-onepager-kernwaarde-${i}`}
            className="p-2 rounded text-center"
            style={{
              background: "#FAF8F2",
              borderLeft: "3px solid var(--color-accent)",
            }}
          >
            <p
              className="m-0 text-[11px] font-semibold"
              style={{ color: "var(--color-primary)", fontFamily: "var(--font-display)" }}
            >
              {kw}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI-aandachtspunten-blok ──────────────────────────────────────────────────
function AiBlock({ insights, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  const filtered = (Array.isArray(insights) ? insights : []).filter(i => i.in_rapport === true);

  if (filtered.length === 0) {
    return (
      <div
        data-testid="strategie-onepager-ai-empty"
        className="p-2 rounded border text-[9px] italic text-slate-500"
        style={{
          borderColor: "var(--color-ai-accent, var(--color-accent))",
          background: "var(--color-ai-accent-bg, rgba(249,115,22,0.04))",
        }}
      >
        {lbl("strategie.onepager.ai.fallback.empty", "AI-inzichten uit voor dit rapport")}
      </div>
    );
  }

  return (
    <aside
      data-testid="strategie-onepager-ai-block"
      className="strategie-onepager-model-block p-2 rounded border h-full overflow-hidden"
      style={{
        borderColor: "var(--color-ai-accent, var(--color-accent))",
        background: "var(--color-ai-accent-bg, rgba(249,115,22,0.04))",
      }}
    >
      <p
        className="text-[8px] font-bold uppercase tracking-[0.18em] mb-1.5"
        style={{ color: "var(--color-ai-accent, var(--color-accent))" }}
      >
        {lbl("strategie.onepager.ai.titel", "AI · Aandachtspunten")}
      </p>
      <div className="flex flex-col gap-2">
        {filtered.slice(0, 4).map((ins) => {
          const obs = ins.edited_observation ?? ins.observation;
          const rec = ins.edited_recommendation ?? ins.recommendation;
          return (
            <div key={ins.id} data-testid={`strategie-onepager-ai-insight-${ins.id}`}>
              <p
                className="text-[8px] font-bold uppercase tracking-[0.14em] m-0 mb-0.5"
                style={{ color: "var(--color-ai-accent, var(--color-accent))" }}
              >
                {(ins.category || "")} · {(ins.type || "")}
              </p>
              {obs && (
                <p className="m-0 text-[9px] leading-snug text-slate-700">{obs}</p>
              )}
              {rec && (
                <p className="m-0 text-[9px] italic leading-snug text-slate-600 mt-0.5">
                  → {rec}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer({ tenantBrand, appLabel, pageNum = 1, totalPages = 1 }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  return (
    <footer
      data-testid="strategie-onepager-footer"
      data-page-num={pageNum}
      className="flex items-center justify-between px-6 text-[8px]"
      style={{
        height: 24,
        background: "var(--color-primary)",
        color: "white",
        opacity: 0.95,
      }}
    >
      <span className="opacity-80">
        {lbl("strategie.onepager.footer.classification", "Vertrouwelijk — alleen voor genoemde klant")}
      </span>
      <span className="opacity-80">
        {tenantBrand || lbl("strategie.onepager.brand.fallback", "Platform")}
        {" · "}
        {lbl("strategie.onepager.werkblad.naam", "STRATEGIE")}
      </span>
      <span className="opacity-60" style={{ fontFamily: "var(--font-mono)" }}>
        {totalPages > 1 ? `${pageNum} / ${totalPages}` : pageNum}
      </span>
    </footer>
  );
}

// ── BodyZone (page-2 content wanneer modellen of AI geselecteerd) ───────────
// Extractie uit Block 4 v2-monolith zodat 11.S-retro multi-page-split mogelijk
// is. Wanneer pageCount=1 (geen body-content) wordt deze NIET gerenderd.
function BodyZone({ selectedModels, withAi, insights, data, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  function renderModel(modelId) {
    const payload = data?.[modelId]?.data;
    switch (modelId) {
      case "swot":
        return <SwotModel key="swot" data={payload} appLabel={appLabel} />;
      case "kernwaarden":
        return <KernwaardenBordModel key="kernwaarden" data={payload} appLabel={appLabel} />;
      default:
        return null;
    }
  }

  const modelComponents = (selectedModels || [])
    .map(m => renderModel(m.id))
    .filter(Boolean);

  const showAi = withAi && Array.isArray(insights);
  const bodyGridCols = showAi ? "1fr 280px" : "1fr";

  return (
    <section
      data-testid="strategie-onepager-body"
      className="flex-1 px-6 py-3 min-h-0"
    >
      <div className="grid gap-3 h-full" style={{ gridTemplateColumns: bodyGridCols }}>
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {modelComponents.length === 0 ? (
            <p className="text-[9px] italic text-slate-400">
              {lbl("strategie.onepager.body.empty", "Geen modellen geselecteerd — kies in linker paneel.")}
            </p>
          ) : (
            modelComponents
          )}
        </div>
        {showAi && (
          <AiBlock insights={insights} appLabel={appLabel} />
        )}
      </div>
    </section>
  );
}

// ── Page-content wrappers ────────────────────────────────────────────────────
// Elke pagina krijgt zijn eigen `.strategie-onepager`-class-scope zodat de
// font-family CSS-variables (--font-body/display/mono) per pagina werken.
// Vaste 100% width/height vult de A4Page (1190×842 CSS px).
function PageShell({ children }) {
  return (
    <div
      className="strategie-onepager w-full h-full flex flex-col"
      style={{
        background: "white",
        fontFamily: "var(--font-body)",
        color: "var(--color-primary)",
      }}
    >
      {children}
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
// 11.S-retro (18 mei): multi-page builder-preview via Page-slot uit A4Preview.
// Optie B2 — logische page-distribution:
//   Page 1: BrandStrip + TitelBlock + IdentiteitsBand + KpiStrip + ThemasGrid + Footer(1/N)
//   Page 2 (alleen als hasBodyContent): BrandStrip + BodyZone + Footer(2/N)
//
// `hasBodyContent` = ≥1 selectedModel OR (withAi AND ≥1 in_rapport-insight).
// Geen body-content → 1 pagina. Page-prop fallback voor backwards-compat-tests
// (default: <div>-passthrough zonder shadow/counter).
export default function StrategyOnePager({
  vasteBlokken = [],   // [{id, label, sub_label}] — meta van Block 3 (niet direct gebruikt)
  selectedModels = [], // [{id, label}] in volgorde
  withAi = true,
  insights = [],       // bij multi-page-distribution: filtered op in_rapport via BodyZone
  data = {},           // per-id payload uit strategieRapportageConfig.dataResolver
  appLabel,
  tenantBrand = null,
  canvasName = null,
  // 11.S-retro: Page-slot uit A4Preview. Default = passthrough <div> zonder
  // shadow/counter — handig voor RTL-tests zonder A4Preview-wrapper.
  Page = ({ children }) => <div data-testid="strategie-onepager-page-fallback">{children}</div>,
}) {
  // Bepaal page-distributie: 1 pagina default, 2 pagina's als body-content.
  // hasBodyContent = ≥1 selectedModel OR withAi=true.
  // withAi=true reserveert altijd page 2 — zelfs bij 0 in_rapport-insights —
  // zodat de "AI-inzichten uit voor dit rapport"-fallback expliciet zichtbaar
  // blijft (Block 4 §2g + Kees-test-feedback: user moet zien dat AI aan/uit is).
  const hasSelectedModels = Array.isArray(selectedModels) && selectedModels.length > 0;
  const hasBodyContent = hasSelectedModels || !!withAi;
  const totalPages = hasBodyContent ? 2 : 1;

  return (
    <div data-testid="strategie-onepager-v2" data-total-pages={totalPages}>
      {/* ── Page 1 — identiteit + KPI + thema's (vaste-blokken) ─────────── */}
      <Page pageNum={1} totalPages={totalPages} appLabel={appLabel}>
        <PageShell>
          <BrandStrip tenantBrand={tenantBrand} appLabel={appLabel} />

          <TitelBlock
            samenvatting={data?.samenvatting?.data?.samenvatting || data?.samenvatting?.text}
            canvasName={canvasName}
            tenantBrand={tenantBrand}
            appLabel={appLabel}
          />

          {/* Vaste-blokken — render-volgorde gefixeerd: identiteit, kpi-strip, themas */}
          <IdentiteitsBand data={data?.identiteit?.data} appLabel={appLabel} />
          <KpiStrip        data={data?.["kpi-strip"]?.data} appLabel={appLabel} />
          <ThemasGrid      data={data?.themas?.data} appLabel={appLabel} />

          {/* Spacer-flex pakt resterende verticale ruimte tot Footer.
              Bij body-content op pagina 2 zou anders een grote leegte tussen
              ThemasGrid en Footer ontstaan zonder mooie verticale verdeling. */}
          <div className="flex-1" />

          <Footer
            tenantBrand={tenantBrand}
            appLabel={appLabel}
            pageNum={1}
            totalPages={totalPages}
          />
        </PageShell>
      </Page>

      {/* ── Page 2 — body-zone (alleen wanneer hasBodyContent) ──────────── */}
      {totalPages > 1 && (
        <Page pageNum={2} totalPages={totalPages} appLabel={appLabel}>
          <PageShell>
            <BrandStrip tenantBrand={tenantBrand} appLabel={appLabel} />

            <BodyZone
              selectedModels={selectedModels}
              withAi={withAi}
              insights={insights}
              data={data}
              appLabel={appLabel}
            />

            <Footer
              tenantBrand={tenantBrand}
              appLabel={appLabel}
              pageNum={2}
              totalPages={totalPages}
            />
          </PageShell>
        </Page>
      )}
    </div>
  );
}
