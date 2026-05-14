/**
 * WerkbladTipsModal — shared component voor werkblad-specifieke invultips.
 *
 * T2 A2 + platform-pattern voor T3/T4/toekomstige werkbladen: één modal-shell,
 * werkblad geeft eigen content via `sections`-prop. Content komt uit
 * `app_config`-keys met namespace `tips.<werkblad>.<onderdeel>.{uitgebreid,voorbeeld}`.
 *
 * Bestaande `features/canvas/components/TipsModal.jsx` blijft canvas-niveau-tips
 * met BLOCKS-tabs — andere rol, ander pattern, niet hergebruikt.
 *
 * Props:
 *   - title              — modal-header-titel ("Invultips Strategie", etc.)
 *   - sections           — Array<{ id, titel, tekst, voorbeeld? }>
 *                          tekst = uitgebreide invultip; voorbeeld = optioneel
 *                          quote-box (alleen renderen als waarde niet-leeg)
 *   - onClose()          — sluit-modal-handler
 *   - testIdPrefix       — optional voor unieke testids (default "werkblad-tips")
 */

import React, { useEffect } from "react";
import { X, Lightbulb } from "lucide-react";

export default function WerkbladTipsModal({
  title,
  sections = [],
  onClose,
  testIdPrefix = "werkblad-tips",
}) {
  // Esc-sluit + klik-buiten-sluit
  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/40 flex items-center justify-center p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid={`${testIdPrefix}-overlay`}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        data-testid={`${testIdPrefix}-dialog`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 shrink-0">
          <h3
            className="text-md flex items-center gap-2 font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            <Lightbulb size={18} className="text-[var(--color-accent)]" />
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testIdPrefix}-close`}
            aria-label="Sluit invultips"
            className="text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {sections.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">Geen invultips beschikbaar.</p>
          ) : sections.map((section) => (
            <section
              key={section.id}
              data-testid={`${testIdPrefix}-section-${section.id}`}
              className="space-y-2"
            >
              <h4 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">
                {section.titel}
              </h4>
              {section.tekst && (
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {section.tekst}
                </p>
              )}
              {/* Voorbeeld-box: alleen renderen als waarde aanwezig + niet-leeg */}
              {section.voorbeeld && section.voorbeeld.trim() && (
                <blockquote
                  data-testid={`${testIdPrefix}-voorbeeld-${section.id}`}
                  className="border-l-3 border-[var(--color-accent)] bg-neutral-50 text-sm text-neutral-700 italic px-4 py-2 rounded-r"
                  style={{ borderLeftWidth: "3px" }}
                >
                  <span className="not-italic text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">
                    Voorbeeld
                  </span>
                  "{section.voorbeeld.trim()}"
                </blockquote>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-neutral-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testIdPrefix}-ok`}
            className="px-4 py-2 text-sm rounded-md transition-colors"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-primary)",
            }}
          >
            Sluit
          </button>
        </div>
      </div>
    </div>
  );
}
