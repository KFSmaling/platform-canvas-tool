/**
 * InzichtenOverlay — document-layout voor Inzichten (sprint B rebuild, issue #68)
 *
 * Visueel conform docs/prototypes/inzichten-prototype-v2.html.
 * Color discipline: docs/inzichten-68-color-mapping.md
 *   - Brand-kleuren: var(--color-primary) — nooit hardcoded hex
 *   - Type-kleuren: via TYPE_CONFIG (Tailwind semantic names)
 *   - Neutrale grijzen: Tailwind utilities
 *
 * Props:
 *   insights    — array van insight-objecten of null
 *   loading     — boolean
 *   error       — string of null
 *   onClose     — () => void
 *   appLabel    — (key, fallback) => string
 *   canvasName  — string | null  (optioneel: toont "Strategie — {canvasName}" in h1)
 *   generatedAt — ISO-string | null  (updated_at uit strategy_core; null = datum weglaten)
 */

import React, { useState } from "react";
import { Minus, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import InzichtItem, { TYPE_CONFIG, FALLBACK_TYPE } from "./InzichtItem";
import AiIcon from "../../../shared/components/AiIcon";

// Datum formatteren als "22 april 2026, 14:08" (NL-locale)
function formatNlDate(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
    const timePart = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
  } catch {
    return null;
  }
}

// Filter-types — iconen en label-keys consistent met TYPE_CONFIG
const FILTER_TYPES = [
  { key: "ontbreekt", Icon: Minus },
  { key: "zwak",      Icon: AlertTriangle },
  { key: "kans",      Icon: TrendingUp },
  { key: "sterk",     Icon: CheckCircle },
];

// ── Filter-pill ───────────────────────────────────────────────────────────────
// Actief: volledige opacity, type-tekst-kleur
// Inactief: opacity-40 (prototype: .type-toggle.off { opacity: 0.4 })
// Vorm: pill (rounded-full), wit bg, border-slate-200
function FilterPill({ cfg, active, typeLabel, onClick }) {
  const { key, Icon } = cfg;
  const colorClass = (TYPE_CONFIG[key] ?? FALLBACK_TYPE).color;
  return (
    <button
      onClick={() => onClick(key)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-200
        bg-white text-[11px] font-medium transition-opacity select-none cursor-pointer
        ${colorClass} ${active ? "opacity-100" : "opacity-40"}`}
    >
      <span aria-hidden="true" className="flex items-center"><Icon size={11} /></span>
      {typeLabel}
    </button>
  );
}

// ── TOC-item ─────────────────────────────────────────────────────────────────
// 7px ronde dot in type-kleur (dotColor uit TYPE_CONFIG)
// Volledige titel — GEEN truncate (besluit V1 herzien conform prototype)
// Geen scroll-spy (besluit V1 behouden — eenvoudige anker-links)
function TocEntry({ insight }) {
  const cfg = TYPE_CONFIG[insight.type] ?? FALLBACK_TYPE;
  return (
    <a
      href={`#insight-${insight.id}`}
      className="flex items-start gap-2 py-1.5 text-slate-600 hover:text-[var(--color-primary)] transition-colors group"
    >
      {/* 7px ronde dot — bg via TYPE_CONFIG.dotColor (Tailwind semantic) */}
      <span
        className={`w-[7px] h-[7px] rounded-full flex-shrink-0 mt-1.5 opacity-70 group-hover:opacity-100 transition-opacity ${cfg.dotColor}`}
        aria-hidden="true"
      />
      {/* Volledige titel — geen truncate */}
      <span className="text-xs leading-snug">{insight.title}</span>
    </a>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function InzichtenOverlay({
  insights, loading, error, onClose, appLabel, canvasName, generatedAt, canvasId, worksheetName,
  // S2 instructie B — Analyse-knop verhuisd van werkblad-header naar
  // Inzichten-scherm als hoofdactie. Optionele props (default null → geen
  // knop) zodat Richtlijnen/andere overlays niet-breaking blijven tot S3.
  onAnalyse = null,
  analysing = false,
  analyseLabel = null,
}) {
  // Alle filters standaard actief
  const [activeFilters, setActiveFilters] = useState(
    new Set(["ontbreekt", "zwak", "kans", "sterk"])
  );

  const toggleFilter = (key) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // minimaal 1 filter actief houden
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Labels
  const lbl = (key, fb) => appLabel ? appLabel(key, fb) : fb;

  // Data
  const allInsights = Array.isArray(insights) ? insights : [];
  const visible     = allInsights.filter(i => activeFilters.has(i.type));
  const onderdelen  = visible.filter(i => i.category === "onderdeel");
  const dwarsverb   = visible.filter(i => i.category === "dwarsverband");

  const isEmpty     = !loading && !error && allInsights.length === 0;
  const noVisible   = !loading && !isEmpty && visible.length === 0;

  // Document-h1: "{werkbladNaam}" of "{werkbladNaam} — {canvasNaam}"
  const wName   = worksheetName ?? lbl("werkblad.strategie.title", "Strategie");
  const docTitle = canvasName ? `${wName} — ${canvasName}` : wName;

  // Outer: vol scherm, bg-slate-100, document scrollt als geheel
  return (
    <div className="fixed inset-0 z-[59] bg-slate-100 overflow-y-auto">

      {/* ── Terug-knop: fixed — altijd bereikbaar ongeacht scroll-positie ── */}
      <button
        onClick={onClose}
        aria-label={lbl("analysis.action.terug", "← Terug naar werkblad")}
        className="fixed top-4 right-4 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600
          hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors shadow-sm"
      >
        {lbl("analysis.action.terug", "← Terug naar werkblad")}
      </button>

      {/* ── Wit document-frame: zweeft op grijs papier ── */}
      {/* Geen overflow-hidden hier — dat breekt position:sticky op de TOC */}
      <div className="max-w-[960px] mx-auto my-8 bg-white shadow-xl rounded-xl">
        <div className="grid grid-cols-[240px_1fr]">

          {/* ── TOC sidebar: sticky binnen outer scroll-container ── */}
          {/* top-8 = 32px = my-8 op de card → sluit aan op bovenkant kaart */}
          <aside className="sticky top-8 self-start max-h-[calc(100vh-4rem)] overflow-y-auto py-10 pl-8 pr-6">
          {!loading && !isEmpty && visible.length > 0 && (
            <>
              {/* "Inhoud" label */}
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3.5">
                {lbl("analysis.toc.label", "Inhoud")}
              </p>

              {/* Onderdelen-sectie */}
              {onderdelen.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--color-primary)] mb-1.5 tracking-[0.01em]">
                    {lbl("analysis.chapter.onderdelen", "Onderdelen")}
                  </p>
                  {onderdelen.map(i => <TocEntry key={i.id} insight={i} />)}
                </div>
              )}

              {/* Dwarsverbanden-sectie */}
              {dwarsverb.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-primary)] mb-1.5 tracking-[0.01em]">
                    {lbl("analysis.chapter.dwarsverbanden", "Dwarsverbanden")}
                  </p>
                  {dwarsverb.map(i => <TocEntry key={i.id} insight={i} />)}
                </div>
              )}
            </>
          )}
        </aside>

        {/* ── Document-kolom: vloeit mee met outer scroll ── */}
        {/* max-w weggelaten — card (960px - 240px TOC = 720px) bepaalt breedte */}
        <article className="px-14 pt-10 pb-28">

            {/* ── Document-header: eyebrow + h1 + Analyse-knop + meta + filters ── */}
            <header className="pb-6 mb-10 border-b border-slate-200">

              {/* Eyebrow: text-slate-500 (var(--muted) in proto) — bewust neutraal, niet brand */}
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                {lbl("analysis.kicker", "Inzichten")}
              </p>

              {/* H1 + Analyse-hoofdactie naast elkaar — S2 instructie B */}
              <div className="flex items-start justify-between gap-4 mb-2.5">
                <h1 className="text-[28px] font-semibold text-[var(--color-primary)] tracking-[-0.015em] leading-tight m-0">
                  {docTitle}
                </h1>
                {typeof onAnalyse === "function" && (
                  <button
                    type="button"
                    onClick={analysing ? undefined : onAnalyse}
                    disabled={analysing}
                    data-testid="inzichten-actie-analyse"
                    className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "var(--color-accent)", color: "var(--color-primary)" }}
                  >
                    <AiIcon variant="generate" size={14} colorClass="text-[var(--color-primary)]" />
                    {analyseLabel || lbl("werkblad.action.analyseer", "Analyse draaien")}
                  </button>
                )}
              </div>

              {/* Meta-regel: canvas · gegenereerd datum · n bevindingen
                  Als generatedAt null: datum weglaten, alleen count tonen.
                  Als canvasName null: canvas-span weglaten. */}
              {!loading && !isEmpty && (
                <p className="text-xs text-slate-500 m-0 mb-5">
                  {canvasName && (
                    <><span>{lbl("analysis.meta.canvas", "Canvas:")} {canvasName}</span>
                    <span className="mx-2 opacity-50">·</span></>
                  )}
                  {generatedAt && formatNlDate(generatedAt) && (
                    <><span>{lbl("analysis.meta.generated", "Gegenereerd")} {formatNlDate(generatedAt)}</span>
                    <span className="mx-2 opacity-50">·</span></>
                  )}
                  <span>{allInsights.length} {lbl("analysis.meta.findings", "bevindingen")}</span>
                </p>
              )}

              {/* Filters: inline in header, pill-vorm, opacity-40 inactief */}
              {!loading && !isEmpty && (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {lbl("analysis.filter.type", "Filter type")}
                  </span>
                  {FILTER_TYPES.map(cfg => (
                    <FilterPill
                      key={cfg.key}
                      cfg={cfg}
                      active={activeFilters.has(cfg.key)}
                      typeLabel={lbl(`analysis.type.${cfg.key}`,
                        cfg.key === "ontbreekt" ? "Ontbreekt"
                        : cfg.key === "zwak"    ? "Zwak punt"
                        : cfg.key === "kans"    ? "Kans"
                        : "Sterkte"
                      )}
                      onClick={toggleFilter}
                    />
                  ))}
                </div>
              )}
            </header>

            {/* ── Loading ── */}
            {loading && (
              <p className="text-slate-400 text-sm italic animate-pulse text-center pt-12">
                {lbl("analysis.loading", "AI analyseert uw strategie…")}
              </p>
            )}

            {/* ── Error ── */}
            {!loading && error && (
              <p className="text-red-500 text-sm italic">{error}</p>
            )}

            {/* ── Lege staat ── */}
            {isEmpty && (
              <div className="flex items-center justify-center h-64">
                <p className="text-slate-400 text-sm italic text-center max-w-sm">
                  {lbl("analysis.empty", "Nog geen analyse. Klik 'Analyseer strategie' in het werkblad.")}
                </p>
              </div>
            )}

            {/* ── Geen resultaten na filteren ── */}
            {noVisible && (
              <div className="flex items-center justify-center h-48">
                <p className="text-slate-400 text-sm italic text-center">
                  {lbl("analysis.empty.filtered", "Geen bevindingen zichtbaar met de huidige filters.")}
                </p>
              </div>
            )}

            {/* ── Hoofdstuk 1: Onderdelen ── */}
            {onderdelen.length > 0 && (
              <section className="mt-0 mb-2" id="ch-onderdeel">
                <header className="pb-3 mb-2 border-b border-[var(--color-primary)]">
                  {/* "Hoofdstuk 1" kicker */}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1 m-0">
                    {lbl("analysis.chapter.number.onderdelen", "Hoofdstuk 1")}
                  </p>
                  {/* H2: 22px, brand-primair */}
                  <h2 className="text-[22px] font-semibold text-[var(--color-primary)] tracking-[-0.01em] leading-tight m-0">
                    {lbl("analysis.chapter.onderdelen", "Onderdelen")}
                  </h2>
                </header>
                {/* Intro-paragraaf */}
                <p className="text-sm text-slate-600 mt-2.5 mb-0 leading-relaxed max-w-[620px]">
                  {lbl("analysis.chapter.intro.onderdelen",
                    "Observaties over losse elementen van de strategie: wat ontbreekt, wat is zwak, waar liggen kansen, waar zit kracht."
                  )}
                </p>
                {onderdelen.map(insight => (
                  <InzichtItem key={insight.id} insight={insight} appLabel={appLabel} />
                ))}
              </section>
            )}

            {/* ── Hoofdstuk 2: Dwarsverbanden ── */}
            {dwarsverb.length > 0 && (
              <section className="mt-12 mb-2" id="ch-dwarsverband">
                <header className="pb-3 mb-2 border-b border-[var(--color-primary)]">
                  {/* "Hoofdstuk 2" kicker */}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1 m-0">
                    {lbl("analysis.chapter.number.dwarsverbanden", "Hoofdstuk 2")}
                  </p>
                  {/* H2: 22px, brand-primair */}
                  <h2 className="text-[22px] font-semibold text-[var(--color-primary)] tracking-[-0.01em] leading-tight m-0">
                    {lbl("analysis.chapter.dwarsverbanden", "Dwarsverbanden")}
                  </h2>
                </header>
                {/* Intro-paragraaf */}
                <p className="text-sm text-slate-600 mt-2.5 mb-0 leading-relaxed max-w-[620px]">
                  {lbl("analysis.chapter.intro.dwarsverbanden",
                    "Observaties over samenhang: overlap tussen thema's, consistentie tussen visie en ambitie, en verbanden met andere werkbladen van het canvas."
                  )}
                </p>
                {dwarsverb.map(insight => (
                  <InzichtItem key={insight.id} insight={insight} appLabel={appLabel} />
                ))}
              </section>
            )}

        </article>
        </div>{/* grid */}
      </div>{/* white card */}
    </div>
  ); // outer
}
