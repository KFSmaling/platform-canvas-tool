/**
 * GuidelinesOnePager — Portrait A4 2×2 grid print-export
 *
 * Layout:
 *   ┌────────────┬────────────┐
 *   │  Generiek  │  Klanten   │
 *   ├────────────┼────────────┤
 *   │ Organisatie│     IT     │
 *   └────────────┴────────────┘
 */

import React, { useEffect } from "react";
import { X, Printer } from "lucide-react";
import { useTheme } from "../../shared/hooks/useTheme";
import { useAppConfig } from "../../shared/context/AppConfigContext";

const SEGMENTS = [
  { key: "generiek",    label: "Generiek",     sublabel: "Strategie & Governance",  color: "var(--color-primary)", lightColor: "#eef2ff" },
  { key: "klanten",     label: "Klanten",       sublabel: "Markt & Dienstverlening", color: "#c2410c", lightColor: "#fff7ed" },
  { key: "organisatie", label: "Organisatie",   sublabel: "Mens & Proces",           color: "#166534", lightColor: "#f0fdf4" },
  { key: "it",          label: "IT",            sublabel: "Technologie & Data",      color: "#6b21a8", lightColor: "#faf5ff" },
];

function ThemeBadge({ number, active, label, accentColor }) {
  return (
    <span
      title={label}
      style={active ? { backgroundColor: accentColor, color: "#fff" } : {}}
      className={`inline-flex items-center justify-center text-[7px] font-black rounded-full w-4 h-4 flex-shrink-0
        ${active ? "" : "bg-slate-200 text-slate-400"}`}
    >
      {number}
    </span>
  );
}

function PrintQuadrant({ segment, guidelines, themas }) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderLeft: `3px solid ${segment.color}`, backgroundColor: segment.lightColor }}
    >
      {/* Segment header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ backgroundColor: segment.color }}>
        <p className="text-[8px] font-black uppercase tracking-widest text-white">{segment.label}</p>
        <p className="text-[6px] text-white/60 font-medium">{segment.sublabel}</p>
      </div>

      {/* Principles */}
      <div className="flex-1 overflow-hidden p-2 space-y-2">
        {guidelines.length === 0 && (
          <p className="text-[7px] text-slate-400 italic">(geen principes)</p>
        )}
        {guidelines.map((g) => {
          const linked = Array.isArray(g.linked_themes) ? g.linked_themes : [];
          const impl   = g.implications || {};
          return (
            <div key={g.id} className="bg-white rounded border border-white/80 p-1.5 space-y-1">
              {/* Title + theme badges */}
              <div className="flex items-start gap-1.5">
                <p className="text-[8px] font-bold text-slate-800 flex-1 leading-tight">{g.title || "(geen titel)"}</p>
                <div className="flex gap-0.5 flex-shrink-0 flex-wrap justify-end max-w-[40px]">
                  {themas.map((t, i) => (
                    <ThemeBadge
                      key={t.id}
                      number={i + 1}
                      active={linked.includes(t.id)}
                      label={t.title}
                      accentColor={segment.color}
                    />
                  ))}
                </div>
              </div>

              {/* Stop / Start / Continue */}
              {(impl.stop || impl.start || impl.continue) && (
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { key: "stop",     label: "Stop",     dot: "bg-red-400"   },
                    { key: "start",    label: "Start",    dot: "bg-green-500" },
                    { key: "continue", label: "Continue", dot: "bg-blue-400"  },
                  ].map(({ key, label, dot }) =>
                    impl[key] ? (
                      <div key={key}>
                        <div className="flex items-center gap-0.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                          <span className="text-[6px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                        </div>
                        <p className="text-[6.5px] text-slate-600 leading-tight">{impl[key]}</p>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GuidelinesOnePager({ guidelines, themas, core, canvasName, onClose }) {
  const { brandName } = useTheme();
  const { label: appLabel } = useAppConfig();
  // Inject print CSS: hide everything except this component when printing
  useEffect(() => {
    const style = document.createElement("style");
    style.id    = "guidelines-print-style";
    style.innerHTML = `
      @media print {
        @page { size: A4 portrait; margin: 0; }
        body > * { display: none !important; }
        .guidelines-print-root { display: flex !important; position: fixed !important; inset: 0 !important; z-index: 9999 !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("guidelines-print-style");
      if (el) el.remove();
    };
  }, []);

  const bySegment = (key) => guidelines.filter((g) => g.segment === key);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-700 guidelines-print-root">

      {/* ── Toolbar (niet zichtbaar bij print) ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--color-primary)] flex-shrink-0 print:hidden">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
          Richtlijnen Onepager — A4 Portrait preview
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[10px] font-black uppercase tracking-widest rounded-md transition-colors"
          >
            <Printer size={13} /> PDF Printen
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── A4 Preview (scrollable op scherm, volledige pagina bij print) ── */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6 print:p-0 print:overflow-hidden">
        <div
          className="bg-white shadow-2xl print:shadow-none"
          style={{ width: "794px", minHeight: "1123px" }}
        >
          {/* Document header */}
          <div className="px-8 pt-8 pb-4 border-b-2" style={{ borderColor: "var(--color-accent)" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-1">
                  Richtlijnen & Leidende Principes
                </p>
                <h1 className="text-xl font-black text-[var(--color-primary)] leading-tight">{canvasName || "Canvas"}</h1>
              </div>
              <div className="text-right max-w-xs">
                <p className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Strategische samenvatting</p>
                <p className="text-[9px] font-semibold text-[var(--color-primary)] leading-snug">{core.ambitie || "(geen ambitie)"}</p>
              </div>
            </div>

            {/* Theme legend */}
            {themas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {themas.map((t, i) => (
                  <span key={t.id} className="inline-flex items-center gap-1 text-[7px] font-semibold bg-[var(--color-accent)]/10 text-[var(--color-success)] border border-[var(--color-accent)]/30 rounded-full px-1.5 py-0.5">
                    <span className="font-black text-[6px]">{i + 1}</span>
                    {t.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2×2 Grid */}
          <div className="grid grid-cols-2 gap-0" style={{ height: "calc(1123px - 140px)" }}>
            {SEGMENTS.map((seg) => (
              <PrintQuadrant
                key={seg.key}
                segment={seg}
                guidelines={bySegment(seg.key)}
                themas={themas}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-8 py-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[6px] text-slate-300 uppercase tracking-widest">{brandName} · {appLabel("guidelines.title", "Richtlijnen & Leidende Principes")}</span>
            <span className="text-[6px] text-slate-300">{new Date().toLocaleDateString("nl-NL")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
