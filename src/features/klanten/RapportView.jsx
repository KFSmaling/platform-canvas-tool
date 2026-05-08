/**
 * RapportView — Type A tekstueel rapport (A4-landscape).
 *
 * Anker: StrategyOnePager.jsx regel 60-87 (PageHeader/PageFooter
 * letterlijk overgenomen voor consistentie). Per ADR-003 §D + PLATFORM_
 * REQUIREMENTS eis #8 — bij P13 wordt dit een gedeelde laag, tot dan
 * exact dezelfde waardes om refactor-werk te vermijden.
 *
 * Leest dezelfde data als WerkruimteView via useCanvasDimensions +
 * usePainPoints + usePatternSuggestions.
 *
 * Stap 11.G Vervolg-sessie B: AI-sectie actief — toont accepted patterns
 * (max 6 cards: eerste 2 per type) in 3-koloms grid wanneer
 * `includeInPrint=true`. TYPE_STYLES via patternTypeStyles.js (PLATFORM_
 * REQUIREMENTS #8: hergebruik StrategyOnePager-mapping voor cluster/
 * paradox/positionering, custom-purple/slate voor overstijgend/eigen).
 *
 * AI-print-toggle: button-met-state-pattern (StrategyOnePager regel
 * 540-553), enabled wanneer ≥1 accepted pattern.
 */

import React, { useState, useMemo } from "react";
import { Printer, X } from "lucide-react";
import AiIcon from "../../shared/components/AiIcon";
import { useTheme } from "../../shared/hooks/useTheme";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import {
  PATTERN_TYPE_STYLES,
  PATTERN_TYPES,
  getPatternTypeLabelKey,
  getPatternTypeLabelFallback,
} from "./patternTypeStyles";

const C = {
  navy:  "var(--color-primary)",
  green: "var(--color-accent)",
};

function today() {
  return new Date().toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

// PageHeader — letterlijk uit StrategyOnePager.jsx regel 60-76
function PageHeader({ canvasName, subtitle, brandName, appLabel }) {
  return (
    <div style={{ background: C.navy, color: "white", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.55 }}>{brandName}</div>
        <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "1px" }}>{subtitle}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: C.green }}>{canvasName || "Canvas"}</div>
        <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{appLabel("app.title", "Strategy Platform")}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: "8px", opacity: 0.5 }}>{today()}</div>
    </div>
  );
}

// PageFooter — letterlijk uit StrategyOnePager.jsx regel 78-87
function PageFooter({ brandName, appLabel }) {
  return (
    <div style={{ background: C.navy, padding: "5px 20px", display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{brandName} — {appLabel("onepager.confidential", "Vertrouwelijk")}</span>
      <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)" }}>{appLabel("app.subtitle", "From strategy to execution")}</span>
    </div>
  );
}

// Sectie-label
const sectionLabelStyle = {
  fontSize: "7px", fontWeight: 800, letterSpacing: "0.2em",
  textTransform: "uppercase", color: C.navy, marginBottom: "5px",
};

function DimensionGroup({ dimension, items, appLabel }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ ...sectionLabelStyle }}>{dimension.name} · {dimension.archetype}</div>
      {items.length === 0 ? (
        <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>geen items</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map(it => (
            <li key={it.id} style={{ marginBottom: "6px", paddingLeft: "8px", borderLeft: `2px solid ${C.green}30` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#1e293b" }}>{it.name}</div>
              {it.description && (
                <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>{it.description}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RapportView({
  canvasName,
  dimensions,
  items,
  painPoints = [],
  couplings = [],
  suggestions = [],
  onClose,
}) {
  const { brandName } = useTheme();
  const { label: appLabel } = useAppConfig();

  // Geaccepteerde patronen voor AI-sectie (Stap 11.G Vervolg-sessie B).
  // Per type max 2 cards, 5 types × 2 = max 10, getrimd tot 6 (eerste 2 van
  // de eerste 3 types die voorkomen) per instructie 11.G akkoord-handoff
  // sectie 52: "3-koloms grid van max 6 cards (eerste 2 per type)".
  const acceptedByType = useMemo(() => {
    const grouped = new Map();
    for (const t of PATTERN_TYPES) grouped.set(t, []);
    for (const s of suggestions) {
      if (s.current_status !== "accepted") continue;
      const arr = grouped.get(s.pattern_type) || grouped.get("eigen");
      if (arr.length < 2) arr.push(s);
    }
    return grouped;
  }, [suggestions]);

  const acceptedCount = useMemo(
    () => suggestions.filter(s => s.current_status === "accepted").length,
    [suggestions]
  );

  const acceptedFlat = useMemo(() => {
    const flat = [];
    for (const t of PATTERN_TYPES) {
      for (const s of acceptedByType.get(t) || []) {
        flat.push(s);
        if (flat.length >= 6) return flat;
      }
    }
    return flat;
  }, [acceptedByType]);

  // AI-print-toggle button-met-state pattern (StrategyOnePager regel 540-553).
  // Enabled wanneer ≥1 accepted pattern; toggle bepaalt of AI-sectie zichtbaar
  // is in print én preview.
  const analysisAvailable = acceptedCount > 0;
  const [includeInPrint, setIncludeInPrint] = useState(false);

  const handlePrint = () => window.print();
  const itemsByDim = (dimId) => items.filter(i => i.dimension_id === dimId);

  // Pijnpunten gegroepeerd per dimensie + apart "overstijgend" blok.
  // Een pijnpunt hoort bij een dimensie als één van zijn couplings naar een
  // item van die dimensie wijst (of naar de dimensie zelf).
  const dimIdSet = new Set(dimensions.map(d => d.id));
  const itemDim  = new Map(items.map(it => [it.id, it.dimension_id]));
  const painsByDim = new Map();
  const overstijgendPains = [];
  for (const pp of painPoints) {
    const ppCouplings = couplings.filter(c => c.pain_point_id === pp.id);
    if (ppCouplings.length === 0) {
      overstijgendPains.push(pp);
      continue;
    }
    const dims = new Set();
    for (const c of ppCouplings) {
      if (c.target_table === "cd_dimensions" && dimIdSet.has(c.target_id)) dims.add(c.target_id);
      if (c.target_table === "cd_items") {
        const did = itemDim.get(c.target_id);
        if (did) dims.add(did);
      }
    }
    for (const did of dims) {
      if (!painsByDim.has(did)) painsByDim.set(did, []);
      painsByDim.get(did).push(pp);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] bg-slate-200 flex flex-col">
      {/* Toolbar */}
      <div className="bg-[var(--color-primary)] text-white flex items-center justify-between px-6 py-3 no-print">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
          <h2 className="text-sm font-bold uppercase tracking-widest">
            {appLabel("klanten.rapport.titel", "Klanten & Dienstverlening — overzicht")}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* AI-print-toggle (button-met-state, anker StrategyOnePager 540-553) */}
          <button
            type="button"
            onClick={() => analysisAvailable && setIncludeInPrint(v => !v)}
            disabled={!analysisAvailable}
            data-testid="rapport-toggle-advies"
            title={
              !analysisAvailable
                ? appLabel("klanten.rapport.toggle.disabled", "Geen geaccepteerde patronen — accepteer er minstens één")
                : (includeInPrint
                    ? appLabel("klanten.rapport.toggle.uit", "Klik om AI-advies uit print te verwijderen")
                    : appLabel("klanten.rapport.toggle.aan", "Klik om AI-advies toe te voegen aan print"))
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-colors
              ${!analysisAvailable
                ? "opacity-30 cursor-not-allowed text-white/40 border-white/20"
                : includeInPrint
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/30"
                  : "text-white/40 border-white/20 hover:text-white/70 hover:border-white/40"}`}
          >
            <AiIcon variant="generate" size={10} />
            {includeInPrint
              ? appLabel("klanten.rapport.toggle.label.aan", "Advies in print ✓")
              : appLabel("klanten.rapport.toggle.label.uit", "Advies in print")}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[10px] font-black uppercase tracking-widest rounded-md transition-colors"
          >
            <Printer size={13} /> {appLabel("klanten.rapport.knop.print", "PDF / Printen")}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-6 flex justify-center">
        <div
          id="klanten-print-area"
          className="bg-white shadow-2xl rounded-sm overflow-hidden flex flex-col"
          style={{ width: "297mm", minHeight: "210mm" }}
        >
          <PageHeader
            canvasName={canvasName}
            subtitle={appLabel("klanten.werkblad.titel", "Klanten & Dienstverlening")}
            brandName={brandName}
            appLabel={appLabel}
          />

          <div style={{ flex: 1, padding: "14px 20px", color: "#1e293b", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
            {/* Samenvatting */}
            <section style={{ marginBottom: "16px" }}>
              <div style={sectionLabelStyle}>{appLabel("klanten.rapport.section.samenvatting", "Samenvatting")}</div>
              <p style={{ fontSize: "10px", color: "#475569", lineHeight: 1.55 }}>
                {dimensions.length} dimensie{dimensions.length === 1 ? "" : "s"}, {items.length} item{items.length === 1 ? "" : "s"},{" "}
                {painPoints.length} pijnpunt{painPoints.length === 1 ? "" : "en"} ({overstijgendPains.length} overstijgend),{" "}
                {acceptedCount} geaccepteerde patron{acceptedCount === 1 ? "" : "en"} vastgelegd.
                {acceptedCount === 0
                  ? " Werkblad in inventarisatie + pijnpunten-fase. Verbeterrichtingen volgen in latere sprints."
                  : " Werkblad in inventarisatie + pijnpunten + analyse-fase. Verbeterrichtingen volgen in latere sprints."}
              </p>
            </section>

            {/* Huidige situatie — alle dimensies + items */}
            <section style={{ marginBottom: "16px" }}>
              <div style={sectionLabelStyle}>{appLabel("klanten.rapport.section.huidig", "Huidige situatie")}</div>
              {dimensions.length === 0 && (
                <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>Nog geen dimensies in dit canvas.</p>
              )}
              {dimensions.map(dim => (
                <DimensionGroup key={dim.id} dimension={dim} items={itemsByDim(dim.id)} appLabel={appLabel} />
              ))}
            </section>

            {/* Pijnpunten — gegroepeerd per dimensie + overstijgend-blok */}
            <section style={{ marginBottom: "16px" }}>
              <div style={sectionLabelStyle}>{appLabel("klanten.rapport.section.pijnpunten", "Pijnpunten")}</div>
              {painPoints.length === 0 && (
                <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>
                  {appLabel("klanten.rapport.pijnpunten.leeg", "Nog geen pijnpunten vastgelegd.")}
                </p>
              )}
              {dimensions.map(dim => {
                const dimPains = painsByDim.get(dim.id) || [];
                if (dimPains.length === 0) return null;
                return (
                  <div key={dim.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: C.navy, marginBottom: "3px", opacity: 0.7 }}>
                      {dim.name} · {dim.archetype}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {dimPains.map(pp => (
                        <li key={pp.id} style={{ marginBottom: "4px", paddingLeft: "8px", borderLeft: `2px solid #fca5a5` }}>
                          <p style={{ margin: 0, fontSize: "9.5px", color: "#1e293b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{pp.text_md}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {overstijgendPains.length > 0 && (
                <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: `1px dashed #94a3b8` }}>
                  <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569", marginBottom: "3px", opacity: 0.7 }}>
                    {appLabel("klanten.pijnpunt.overstijgend.section", "Overstijgend (geen koppeling)")}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {overstijgendPains.map(pp => (
                      <li key={pp.id} style={{ marginBottom: "4px", paddingLeft: "8px", borderLeft: `2px dashed #94a3b8` }}>
                        <p style={{ margin: 0, fontSize: "9.5px", color: "#1e293b", lineHeight: 1.5, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{pp.text_md}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Geaccepteerde patronen (Stap 11.G Vervolg-sessie B) */}
            <section style={{ marginBottom: "16px" }} data-testid="rapport-section-patronen">
              <div style={sectionLabelStyle}>
                {appLabel("klanten.rapport.section.patronen", "Geaccepteerde patronen")}
              </div>
              {acceptedCount === 0 ? (
                <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>
                  {appLabel("klanten.rapport.patronen.leeg", "Nog geen geaccepteerde patronen — accepteer suggesties in fase 3 (Analyse).")}
                </p>
              ) : !includeInPrint ? (
                <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>
                  {appLabel(
                    "klanten.rapport.patronen.uit",
                    "AI-advies staat uit voor deze print — klik 'Advies in print' bovenin om te tonen."
                  )}
                </p>
              ) : (
                <div
                  data-testid="rapport-patronen-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "6px",
                  }}
                >
                  {acceptedFlat.map(s => {
                    const style = PATTERN_TYPE_STYLES[s.pattern_type] || PATTERN_TYPE_STYLES.eigen;
                    const typeLabel = appLabel(
                      getPatternTypeLabelKey(s.pattern_type),
                      getPatternTypeLabelFallback(s.pattern_type)
                    );
                    return (
                      <div
                        key={s.id}
                        data-testid={`rapport-pattern-card-${s.id}`}
                        style={{
                          background: style.bg,
                          borderLeft: `3px solid ${style.border}`,
                          borderRadius: "3px",
                          padding: "6px 8px",
                        }}
                      >
                        <div style={{
                          fontSize: "7px",
                          fontWeight: 800,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: style.label,
                          marginBottom: "3px",
                        }}>
                          <span style={{ marginRight: "4px" }}>{style.icon}</span>{typeLabel}
                        </div>
                        <p style={{
                          margin: 0,
                          fontSize: "9px",
                          color: style.text,
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                        }}>
                          {s.text_md}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              {acceptedCount > acceptedFlat.length && includeInPrint && (
                <p style={{ fontSize: "8px", color: "#94a3b8", fontStyle: "italic", marginTop: "4px" }}>
                  {appLabel(
                    "klanten.rapport.patronen.meer",
                    `+ ${acceptedCount - acceptedFlat.length} meer geaccepteerd, niet getoond in deze print-samenvatting.`
                  )}
                </p>
              )}
            </section>

            {/* Verbeterrichtingen — placeholder */}
            <section>
              <div style={sectionLabelStyle}>{appLabel("klanten.rapport.section.richtingen", "Verbeterrichtingen")}</div>
              <p style={{ fontSize: "9px", color: "#94a3b8", fontStyle: "italic" }}>komt in fase 4 (Verbeterrichtingen)</p>
            </section>
          </div>

          <PageFooter brandName={brandName} appLabel={appLabel} />
        </div>
      </div>

      <div className="no-print text-center py-2 text-[9px] text-slate-400 uppercase tracking-widest bg-slate-100">
        PDF / Printen → kies "Liggend (Landscape)" + "Aanpassen aan pagina" in je printdialoog
      </div>
    </div>
  );
}
