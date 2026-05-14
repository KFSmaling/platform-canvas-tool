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
  // T1 B1+B3: build-timestamp uit REACT_APP_BUILD_TIME (ingespoten in package.json
  // build-script). Fallback op REACT_APP_BUILD_DATE (legacy) of huidige datum.
  const buildRaw = process.env.REACT_APP_BUILD_TIME || process.env.REACT_APP_BUILD_DATE;
  let buildDisplay = new Date().toISOString().slice(0, 10);
  if (buildRaw) {
    try {
      const d = new Date(buildRaw);
      if (!isNaN(d.getTime())) {
        buildDisplay = new Intl.DateTimeFormat("nl-NL", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
          timeZone: "Europe/Amsterdam",
        }).format(d);
      } else {
        buildDisplay = buildRaw;
      }
    } catch (_e) { /* keep default */ }
  }

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

            <dt className="text-neutral-500">{appLabel("over.build.label", "Build")}</dt>
            <dd className="font-mono" data-testid="over-build-display" style={{ fontFamily: "var(--font-mono)" }}>{buildDisplay}</dd>

            <dt className="text-neutral-500">{appLabel("over.auteur.label", "Auteur")}</dt>
            <dd>{appLabel("over.auteur.naam", "Kees Smaling")}</dd>
          </dl>

          {/* T1 B3 — copyright-statement (Platform-default "© Smaling Holding"
              via app_config, override per tenant mogelijk). Jaar dynamisch. */}
          <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-100" data-testid="over-copyright">
            {appLabel("over.copyright", "© Smaling Holding")} · {new Date().getFullYear()} · v{versie}
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
