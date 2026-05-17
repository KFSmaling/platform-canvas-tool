/**
 * RapportageMenu — werkblad-agnostische export-keuze-dialog.
 *
 * RFC-008 §C — directe shared/-extractie (analoog Block 1 inzichten/).
 * Designer-spec: platform/design/prototypes/2026-05-17-strategie-onepager-v2/rapportage-spec.md §1.
 *
 * Tiles:
 *   1. One-pager · A4 landschap (klikbaar, "Populair"-badge)
 *      → roept onSelectOnepager() aan. In Block 2 dood-href + TODO Block 3.
 *   2. PowerPoint-export · 8–12 slides (disabled, "Beschikbaar fase 2"-badge)
 *      → toont info-dialog met multi-line spec + CTA "Open one-pager".
 *
 * Mockup-conformiteit-gate (RFC-008 §11):
 *   - Rij 8: 40%-overlay (rgba(0,0,0,0.4))
 *   - Rij 9: Tile 1 "Populair"-badge rechts boven
 *   - Rij 10: Tile 2 "Beschikbaar fase 2" + info-dialog
 *   - Rij 13: Tip-strip onderaan
 *   - Rij 14: Footer-strip "Binnenkort" decoratieve chips
 *
 * Iconen: lucide-react conform Kees-besluit 17 mei (geen @tabler/icons-react).
 *
 * Props:
 *   open               — boolean — dialog-zichtbaarheid
 *   onClose            — () => void — sluit dialog (X-knop, Escape, klik buiten)
 *   onSelectOnepager   — () => void — Tile 1 klik (Block 2: dood-href + TODO)
 *   headerLabel?       — string — werkblad-context-string (default: appLabel)
 *   appLabel           — (key, fb) => string — config-resolver
 */

import React, { useState, useEffect } from "react";
import { X, FileText, Presentation, Lightbulb, Star } from "lucide-react";

// ── Tile-component ────────────────────────────────────────────────────────────
function Tile({
  Icon, title, body, badge, badgeKind, disabled, onClick, testId,
}) {
  const isPopular = badgeKind === "popular";
  const isPhase2  = badgeKind === "phase2";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
      data-disabled={disabled ? "true" : "false"}
      className={`relative text-left p-5 rounded-lg border transition-colors w-full
        ${disabled
          ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-70"
          : "bg-white border-slate-300 hover:border-[var(--color-primary)]/40 hover:shadow-sm cursor-pointer"
        }`}
    >
      {badge && (
        <span
          data-testid={`${testId}-badge`}
          className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em] ${
            isPopular
              ? "bg-[var(--color-accent)] text-[var(--color-primary)]"
              : isPhase2
                ? "bg-slate-200 text-slate-600"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {isPopular && <Star size={10} aria-hidden="true" />}
          {badge}
        </span>
      )}

      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${
            disabled ? "bg-slate-100 text-slate-400" : "bg-[var(--color-accent)]/10 text-[var(--color-primary)]"
          }`}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
        <div className="flex-1 pr-16">
          <h3 className={`text-sm font-semibold mb-1 ${disabled ? "text-slate-500" : "text-[var(--color-primary)]"}`}>
            {title}
          </h3>
          <p className={`text-xs leading-relaxed ${disabled ? "text-slate-500" : "text-slate-600"}`}>
            {body}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── PPT info-dialog (sub-component) ───────────────────────────────────────────
// Bij klik op PPT-tile. Toont multi-line spec + CTA "Open one-pager"
// (sluit info-dialog + roept onSelectOnepager aan).
function PptInfoDialog({ onClose, onOpenOnepager, appLabel }) {
  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);
  // ESC-handler binnen sub-dialog
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const body = lbl(
    "rapportage.ppt.info.body",
    "Beschikbaar in fase 2.\n\nGenereert een volledig deck:\n- Titel-slide + executive samenvatting\n- Eén slide per strategisch thema (KSF/KPI)\n- Eén slide per model (SWOT, etc.)\n- Appendix met aandachtspunten\n\nWil je nu al een one-pager?"
  );

  return (
    <div
      data-testid="rapportage-ppt-info-dialog"
      className="fixed inset-0 z-[71] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={lbl("rapportage.action.close", "Sluit")}
          data-testid="rapportage-ppt-info-close"
          className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100"
        >
          <X size={14} />
        </button>
        <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
          {lbl("rapportage.ppt.info.titel", "PowerPoint-export")}
        </h2>
        <p className="text-xs text-slate-700 whitespace-pre-line mb-4">{body}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenOnepager}
            data-testid="rapportage-ppt-info-cta-onepager"
            className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 transition-opacity font-semibold"
          >
            → {lbl("rapportage.ppt.info.cta", "Open one-pager")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function RapportageMenu({
  open,
  onClose,
  onSelectOnepager,
  headerLabel = null,
  appLabel,
}) {
  const [pptInfoOpen, setPptInfoOpen] = useState(false);

  // Escape-key sluit hoofdmenu (PPT-sub-dialog vangt zijn eigen ESC af).
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape" && !pptInfoOpen) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, pptInfoOpen]);

  if (!open) return null;

  const lbl = (k, fb) => (appLabel ? appLabel(k, fb) : fb);

  function handleSelectOnepager() {
    setPptInfoOpen(false);
    if (typeof onSelectOnepager === "function") onSelectOnepager();
  }

  return (
    <div
      data-testid="rapportage-menu"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      // RFC-008 §11 rij 8 — 40%-overlay conform mockup
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close × */}
        <button
          type="button"
          onClick={onClose}
          aria-label={lbl("rapportage.action.close", "Sluit")}
          data-testid="rapportage-menu-close"
          className="absolute top-4 right-4 w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold text-[var(--color-primary)] tracking-[-0.01em] mb-1.5 pr-8">
          {lbl("rapportage.menu.header", "Wat wil je delen met de klant?")}
        </h2>
        {headerLabel && (
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
            {headerLabel}
          </p>
        )}
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {lbl(
            "rapportage.menu.subtekst",
            "Kies een export-vorm. Elke vorm gebruikt de huisstijl van het canvas of de klant en pakt de actuele data van dit werkblad."
          )}
        </p>

        {/* Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <Tile
            testId="rapportage-tile-onepager"
            Icon={FileText}
            title={lbl("rapportage.tile.onepager.titel", "One-pager · A4 landschap")}
            body={lbl(
              "rapportage.tile.onepager.body",
              "Kies welke modellen op de pagina komen. Toggle voor met/zonder AI-inzichten. Print of PDF."
            )}
            badge={lbl("rapportage.tile.onepager.badge", "Populair")}
            badgeKind="popular"
            disabled={false}
            onClick={handleSelectOnepager}
          />
          <Tile
            testId="rapportage-tile-ppt"
            Icon={Presentation}
            title={lbl("rapportage.tile.ppt.titel", "PowerPoint-export · 8–12 slides")}
            body={lbl(
              "rapportage.tile.ppt.body",
              "Genereert een volledig deck met titel, executive summary, één slide per model, en aandachtspunten als appendix. Bewerkbaar in PowerPoint."
            )}
            badge={lbl("rapportage.tile.ppt.badge", "Beschikbaar fase 2")}
            badgeKind="phase2"
            // PPT-tile is **niet** HTML-disabled (we willen wel klik om info-dialog
            // te openen). Disabled-styling via badgeKind + visual-cue.
            disabled={false}
            onClick={() => setPptInfoOpen(true)}
          />
        </div>

        {/* Tip-strip (RFC-008 §11 rij 13) */}
        <div
          data-testid="rapportage-tip"
          className="flex items-start gap-2.5 p-3 mb-4 rounded-md bg-amber-50 border border-amber-100"
        >
          <Lightbulb size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            {lbl(
              "rapportage.tip",
              "Tip: open Inzichten eerst — daar krijg je AI-advies dat je kan opnemen in deze exports."
            )}
          </p>
        </div>

        {/* Footer-strip "Binnenkort" decoratieve disabled chips (RFC-008 §11 rij 14) */}
        <div
          data-testid="rapportage-footer-binnenkort"
          className="flex items-center flex-wrap gap-2 pt-3 border-t border-slate-200"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {lbl("rapportage.footer.label", "Binnenkort")}:
          </span>
          {lbl("rapportage.footer.chips", "Gamma · Word-rapport · PDF compleet · E-mail-samenvatting")
            .split("·")
            .map((chip, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]"
              >
                {chip.trim()}
              </span>
            ))}
        </div>
      </div>

      {/* PPT info-dialog (overlay binnen-overlay) */}
      {pptInfoOpen && (
        <PptInfoDialog
          appLabel={appLabel}
          onClose={() => setPptInfoOpen(false)}
          onOpenOnepager={handleSelectOnepager}
        />
      )}
    </div>
  );
}
