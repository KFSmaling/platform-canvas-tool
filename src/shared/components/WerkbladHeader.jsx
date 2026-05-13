/**
 * WerkbladHeader — drie-lagen-hybride werkblad-header (Fase 2 design-systeem).
 *
 * Designer-output 2026-05-13 §3.7 + §5.1: consistent over alle werkbladen.
 *
 *   ┌─ Laag 1 — Platform-strip (charcoal 40px) ──────────────────────────┐
 *   │  ← back · breadcrumb (Canvas → Werkblad)            save-status    │
 *   ├─ Laag 2 — Werkblad-bar (wit 60px, categorie-kleur 3px bottom) ─────┤
 *   │  [icoon] WERKBLAD · Titel                Inzichten | Rapportage    │
 *   ├─ Laag 3 — Fase/sectie-tab-strip (wit 44px, optioneel) ─────────────┤
 *   │  [Tab 1] [Tab 2] [Tab 3]                                           │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Werkblad-eigenaar (StrategieWerkblad / RichtlijnenWerkblad / KlantenWerkblad)
 * geeft:
 *  - `categorie`           — bepaalt categorie-kleur (cat-klanten/strategie/etc.)
 *  - `icon`                — Lucide-icon-component voor laag 2
 *  - `titel`               — werkblad-titel-tekst (h2)
 *  - `capsLabel`           — caps-label boven titel ("WERKBLAD" of "DE WERKKAMER")
 *  - `breadcrumb`          — optionele JSX in laag 1 center (canvas → werkblad)
 *  - `actieknoppen`        — JSX-children rechts in laag 2 (typisch <WerkbladActieknoppen>)
 *  - `tabs`                — optionele array `[{ id, label, pillNum?, pillCount? }]`
 *  - `activeTabId`
 *  - `onTabClick(id)`
 *  - `saveStatus`          — optionele string in laag 1 rechts
 *  - `rightExtra`          — optionele JSX in laag 1 rechts (bv. Full Draft knop)
 *  - `onClose()`           — terug-knop laag 1 links
 *
 * Categorie-kleur-classes verwijzen naar tokens uit design-systeem Fase 1
 * (CSS-vars in `src/index.css` + Tailwind extend in `tailwind.config.js`).
 *
 * `tabs.id` mag string of nummer zijn. `pillNum` voor fase-volgorde-nummer
 * (1..N), `pillCount` voor sub-count (bv. items-aantal). Designer §3.6.
 */

import React from "react";
import { ArrowLeft, Languages } from "lucide-react";
import LogoBrand from "./LogoBrand";
import OverflowMenu from "./OverflowMenu";

const CATEGORY_BORDER = {
  klanten:     "border-b-category-klanten",
  processen:   "border-b-category-processen",
  mensen:      "border-b-category-mensen",
  it:          "border-b-category-it",
  strategie:   "border-b-category-strategie",
  richtlijnen: "border-b-category-richtlijnen",
};

const CATEGORY_ACTIVE_BORDER = {
  klanten:     "border-b-category-klanten",
  processen:   "border-b-category-processen",
  mensen:      "border-b-category-mensen",
  it:          "border-b-category-it",
  strategie:   "border-b-category-strategie",
  richtlijnen: "border-b-category-richtlijnen",
};

const CATEGORY_TILE_BG = {
  klanten:     "bg-category-klanten-light text-category-klanten",
  processen:   "bg-category-processen-light text-category-processen",
  mensen:      "bg-category-mensen-light text-category-mensen",
  it:          "bg-category-it-light text-category-it",
  strategie:   "bg-neutral-100 text-category-strategie",
  richtlijnen: "bg-neutral-100 text-category-richtlijnen",
};

const CATEGORY_PILL_ACTIVE = {
  klanten:     "bg-category-klanten text-white",
  processen:   "bg-category-processen text-white",
  mensen:      "bg-category-mensen text-white",
  it:          "bg-category-it text-white",
  strategie:   "bg-category-strategie text-white",
  richtlijnen: "bg-category-richtlijnen text-white",
};

export default function WerkbladHeader({
  categorie = "strategie",
  icon: IconComp = null,
  titel,
  capsLabel = "Werkblad",
  breadcrumb = null,
  actieknoppen = null,
  tabs = null,
  activeTabId = null,
  onTabClick,
  saveStatus = null,
  rightExtra = null,
  onClose,
  // S2 design-systeem laag 1 vol-vullen — designer §3.7 charcoal-strip met
  // logo + brandName + versie-pill links, lang-switch + overflow rechts.
  // Werkblad-laag-1 vervangt visueel de hoofdcanvas-header (DeepDiveOverlay
  // rendert `fixed inset-0 z-50` over de canvas-header heen) — daarom
  // moet de werkblad-strip dezelfde branding bevatten.
  showLogo = false,
  appTitle = null,           // optionele app-titel naast logo (bv. "Strategy Platform")
  versie = null,             // optionele versie-string voor mono-pill
  lang = null,               // "nl" | "en" | null (geen lang-switch)
  onLangSwitch = null,       // () => void
  overflowItems = null,      // Array<{ id, label, icon?, onClick, divider?, danger?, hidden? }>
}) {
  const borderClass = CATEGORY_BORDER[categorie] || CATEGORY_BORDER.strategie;
  const tileClass   = CATEGORY_TILE_BG[categorie] || CATEGORY_TILE_BG.strategie;
  const activeUnderlineClass = CATEGORY_ACTIVE_BORDER[categorie] || CATEGORY_ACTIVE_BORDER.strategie;
  const activePillClass      = CATEGORY_PILL_ACTIVE[categorie] || CATEGORY_PILL_ACTIVE.strategie;

  return (
    <div data-testid="werkblad-header" className="flex-shrink-0">
      {/* ── Laag 1 — Platform-strip ─────────────────────────────────────────
          Designer §3.7: charcoal-strip 50px met logo + brandName + versie-pill
          links, breadcrumb center, save-status + lang + overflow rechts.
          Werkblad-strip vervangt visueel hoofdcanvas-header (DeepDiveOverlay
          rendert fixed inset-0 z-50). showLogo=false → minimal pre-S2-modus. */}
      <div
        data-testid="werkblad-header-laag-1"
        className={`flex items-center justify-between gap-3 px-6 ${showLogo ? "h-[50px]" : "h-10"} bg-primary text-white`}
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Terug naar canvas"
              data-testid="werkblad-header-back"
              className="text-white/60 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {showLogo && (
            <>
              <div className="flex items-center h-full">
                <LogoBrand
                  variant="light"
                  imgClassName="h-7 w-auto object-contain object-center"
                  textClassName="text-white font-medium text-sm tracking-wide"
                />
              </div>
              {appTitle && (
                <div className="flex items-baseline gap-2 border-l border-white/10 pl-3">
                  <span className="text-sm tracking-tight text-white leading-none">{appTitle}</span>
                  {versie && (
                    <span
                      data-testid="werkblad-header-versie-pill"
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded text-[var(--color-accent)]"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)" }}
                      title={`Versie ${versie}`}
                    >
                      v{versie}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {breadcrumb && (
            <div className="text-xs text-white/70 truncate border-l border-white/10 pl-3 ml-1">
              {breadcrumb}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saveStatus && (
            <span className="text-[10px] font-medium text-white/60">{saveStatus}</span>
          )}
          {lang && typeof onLangSwitch === "function" && (
            <button
              type="button"
              onClick={onLangSwitch}
              data-testid="werkblad-header-lang-switch"
              title="Switch language"
              className="flex items-center gap-1 text-white/60 hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 rounded-md text-xs transition-colors"
            >
              <Languages size={12} />
              <span className={lang === "nl" ? "text-white" : "text-white/40"}>NL</span>
              <span className="text-white/20">|</span>
              <span className={lang === "en" ? "text-white" : "text-white/40"}>EN</span>
            </button>
          )}
          {rightExtra}
          {overflowItems && overflowItems.length > 0 && (
            <OverflowMenu
              items={overflowItems}
              triggerClassName="text-white/60 hover:text-white"
              size={16}
            />
          )}
        </div>
      </div>

      {/* ── Laag 2 — Werkblad-bar ───────────────────────────────────────── */}
      <div
        data-testid="werkblad-header-laag-2"
        className={`flex items-center justify-between gap-4 px-6 h-[60px] bg-white border-b-[3px] ${borderClass}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {IconComp && (
            <span
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${tileClass}`}
              aria-hidden="true"
            >
              <IconComp size={18} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 leading-none mb-1">
              {capsLabel}
            </p>
            <h2 className="text-md text-primary truncate" style={{ color: "var(--color-primary)" }}>
              {titel}
            </h2>
          </div>
        </div>
        {actieknoppen && (
          <div className="flex items-center gap-2 shrink-0">{actieknoppen}</div>
        )}
      </div>

      {/* ── Laag 3 — Fase/sectie-tab-strip (optioneel) ──────────────────── */}
      {tabs && tabs.length > 0 && (
        <div
          data-testid="werkblad-header-laag-3"
          className="flex items-center gap-1 px-6 h-11 bg-white border-b border-neutral-200"
        >
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            // Accessible-name "N · Label" houdt backwards-compat met bestaande
            // RTL-tests (`findByRole("button", { name: /^3 · Analyse$/i })`)
            // ondanks visuele pill-rendering.
            const ariaLabel = tab.pillNum != null
              ? `${tab.pillNum} · ${tab.label}`
              : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabClick && onTabClick(tab.id)}
                data-testid={`werkblad-header-tab-${tab.id}`}
                data-active={isActive ? "true" : "false"}
                aria-label={ariaLabel}
                className={`relative flex items-center gap-2 px-4 h-full text-sm transition-colors ${
                  isActive
                    ? `text-primary border-b-2 ${activeUnderlineClass}`
                    : "text-neutral-600 hover:text-primary"
                }`}
                style={isActive ? { color: "var(--color-primary)", marginBottom: "-1px" } : undefined}
              >
                {tab.pillNum != null && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium leading-none ${
                      isActive ? activePillClass : "bg-neutral-100 text-neutral-600"
                    }`}
                    aria-hidden="true"
                  >
                    {tab.pillNum}
                  </span>
                )}
                <span aria-hidden={tab.pillNum != null ? "true" : undefined}>{tab.label}</span>
                {tab.pillCount != null && (
                  <span className="text-[10px] text-neutral-500 ml-0.5" aria-hidden="true">({tab.pillCount})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
