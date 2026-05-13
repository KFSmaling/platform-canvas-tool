/**
 * OverDialog — "Over Platform Workbench"-dialog (Fase 3 design-systeem).
 *
 * Designer-output 2026-05-13 §7 punt 11: kleine info-modal met auteur,
 * datum, versie, korte over-tekst. Lichte modal, geen route.
 *
 * Props:
 *   onClose() — sluit dialog
 *
 * Inhoud:
 * - App-naam (uit brandName/appLabel)
 * - Versie + build-nummer (process.env.REACT_APP_VERSION)
 * - Korte over-tekst
 * - Auteur + jaartal-stempel
 * - Sluit-knop
 */

import React, { useEffect } from "react";
import { X, Info } from "lucide-react";
import { useAppConfig } from "../context/AppConfigContext";

export default function OverDialog({ onClose }) {
  const { label: appLabel } = useAppConfig();
  const versie = process.env.REACT_APP_VERSION || "0.1.0";
  const buildDate = process.env.REACT_APP_BUILD_DATE || new Date().toISOString().slice(0, 10);

  // Esc-toets-sluiten
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-6"
      data-testid="over-dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-modal max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h3 className="text-md flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <Info size={18} className="text-[var(--color-accent)]" />
            {appLabel("over.titel", "Over Platform Workbench")}
          </h3>
          <button
            onClick={onClose}
            data-testid="over-dialog-close"
            className="text-neutral-500 hover:text-neutral-900"
            aria-label="Sluit dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-neutral-700">
          <p>
            {appLabel(
              "over.beschrijving",
              "Platform Workbench is een strategisch consultancy-platform voor het iteratief uitwerken van canvas-werkbladen (Strategie, Richtlijnen, Klanten, en latere modules)."
            )}
          </p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-500">{appLabel("over.versie.label", "Versie")}</dt>
            <dd className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>v{versie}</dd>

            <dt className="text-neutral-500">{appLabel("over.build.label", "Build-datum")}</dt>
            <dd className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>{buildDate}</dd>

            <dt className="text-neutral-500">{appLabel("over.auteur.label", "Auteur")}</dt>
            <dd>{appLabel("over.auteur.naam", "Kees Smaling")}</dd>
          </dl>

          <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-100">
            {appLabel(
              "over.copyright",
              `© ${new Date().getFullYear()} Platform Workbench. Alle rechten voorbehouden.`
            )}
          </p>
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-neutral-200">
          <button
            onClick={onClose}
            data-testid="over-dialog-ok"
            className="px-4 py-2 text-sm rounded-md transition-colors"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-primary)",
            }}
          >
            {appLabel("over.knop.sluit", "Sluit")}
          </button>
        </div>
      </div>
    </div>
  );
}
