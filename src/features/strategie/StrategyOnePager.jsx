/**
 * StrategyOnePager — visuele strategie-samenvatting voor boardpresentaties
 *
 * Templates:
 *   overview  — Missie/Visie/Kernwaarden + SWOT + Strategische Thema's
 *   swot      — Gedetailleerde SWOT-matrix
 *   scorecard — Balanced Scorecard: thema's × KSF / KPI / target
 *
 * Print: window.print() + @media print CSS → browser PDF
 */

import React, { useState, useEffect } from "react";
import { X, Printer, LayoutGrid, Target, TrendingUp } from "lucide-react";
import AiIcon from "../../shared/components/AiIcon";
import { supabase } from "../../shared/services/supabase.client";
import { useTheme } from "../../shared/hooks/useTheme";
import { useAppConfig } from "../../shared/context/AppConfigContext";

// ── Kleurendefinities ────────────────────────────────────────────────────────
const C = {
  navy:    "var(--color-primary)",
  green:   "var(--color-accent)",
  blue:    "#00AEEF",
  greenDk: "#2c7a4b",
  slate:   "#475569",
  light:   "#f8fafc",
};

const SWOT_DEF = [
  { tag: "kans",        title: "Kansen",        color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
  { tag: "sterkte",     title: "Sterkten",       color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  { tag: "bedreiging",  title: "Bedreigingen",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  { tag: "zwakte",      title: "Zwakten",        color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
];

// ── Gedeelde print-stijlen ───────────────────────────────────────────────────
const S = {
  page: {
    width: "100%", fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: "10px", lineHeight: 1.4, color: C.navy, background: "#ffffff",
  },
  sectionLabel: {
    fontSize: "7px", fontWeight: 800, letterSpacing: "0.2em",
    textTransform: "uppercase", marginBottom: "5px",
  },
  th: {
    padding: "5px 10px", textAlign: "left", fontWeight: 700,
    fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase",
    color: "white",
  },
  td: { padding: "4px 10px", fontSize: "9px", color: "#374151", verticalAlign: "top" },
};

// ── Helper: Datum ──────────────────────────────────────────────────────────
function today() {
  return new Date().toLocaleDateString("nl-NL", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Gedeelde header & footer ────────────────────────────────────────────────
function PageHeader({ canvasName, subtitle }) {
  const { brandName } = useTheme();
  const { label: appLabel } = useAppConfig();
  return (
    <div style={{ background: C.navy, color: "white", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.55 }}>{brandName}</div>
        <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "1px" }}>{subtitle}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: C.green }}>{canvasName || "Canvas"}</div>
        <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{appLabel("app.title", "Business Transformation Workbench")}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: "8px", opacity: 0.5 }}>{today()}</div>
    </div>
  );
}

function PageFooter() {
  const { brandName } = useTheme();
  const { label: appLabel } = useAppConfig();
  return (
    <div style={{ background: C.navy, padding: "5px 20px", display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{brandName} — {appLabel("onepager.confidential", "Vertrouwelijk")}</span>
      <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)" }}>{appLabel("app.subtitle", "Platform voor strategie tot executie")}</span>
    </div>
  );
}

// ── AI Analyse sectie (gedeeld door alle templates, print-compatible) ──────────
const TYPE_STYLES = {
  warning: { icon: "⚠", bg: "#fff7ed", border: "#f97316", text: "#9a3412", label: "#ea580c" },
  info:    { icon: "ℹ", bg: "#eff6ff", border: "#3b82f6", text: "#1e3a8a", label: "#2563eb" },
  success: { icon: "✓", bg: "#f0fdf4", border: "#22c55e", text: "#14532d", label: "#16a34a" },
};

function AnalysisPrintSection({ recommendations }) {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div style={{ margin: "0 16px 10px", borderTop: `2px solid ${C.navy}15`, paddingTop: "10px" }}>
      <div style={{ ...S.sectionLabel, color: C.navy, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "10px" }}>✦</span> AI Strategische Analyse &amp; Aanbevelingen
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
        {recommendations.map((rec, i) => {
          const s = TYPE_STYLES[rec.type] || TYPE_STYLES.info;
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}40`, borderLeft: `3px solid ${s.border}`, borderRadius: "4px", padding: "7px 9px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
                <span style={{ fontSize: "8px", color: s.label, fontWeight: 900 }}>{s.icon}</span>
                <span style={{ fontSize: "7.5px", fontWeight: 800, color: s.label, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {rec.title}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "8.5px", color: s.text, lineHeight: 1.4 }}>{rec.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Strategie Overzicht
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTemplate({ core, items, themas, canvasName, analysis }) {
  const grouped = {};
  SWOT_DEF.forEach(d => { grouped[d.tag] = items.filter(i => i.tag === d.tag); });

  return (
    <div style={S.page}>
      <PageHeader canvasName={canvasName} subtitle="Strategie Overzicht" />

      {/* ── Identiteit: Missie / Visie / Kernwaarden ── */}
      <div style={{ background: "#f0f9ff", borderBottom: `3px solid ${C.green}`, padding: "10px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>

          {/* Missie */}
          <div>
            <div style={{ ...S.sectionLabel, color: C.blue, display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "10px" }}>🚀</span> Missie
            </div>
            <p style={{ margin: 0, fontSize: "10px", color: "#374151", lineHeight: 1.5 }}>
              {core.missie || <em style={{ color: "#9ca3af" }}>Nog niet ingevuld</em>}
            </p>
          </div>

          {/* Visie */}
          <div style={{ borderLeft: `1px solid ${C.blue}20`, paddingLeft: "14px" }}>
            <div style={{ ...S.sectionLabel, color: C.blue, display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "10px" }}>💡</span> Visie
            </div>
            <p style={{ margin: 0, fontSize: "10px", color: "#374151", lineHeight: 1.5 }}>
              {core.visie || <em style={{ color: "#9ca3af" }}>Nog niet ingevuld</em>}
            </p>
          </div>

          {/* Kernwaarden + Ambitie */}
          <div style={{ borderLeft: `1px solid ${C.blue}20`, paddingLeft: "14px" }}>
            <div style={{ ...S.sectionLabel, color: C.blue, display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "10px" }}>💎</span> Kernwaarden
            </div>
            {(core.kernwaarden || []).length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {core.kernwaarden.slice(0, 6).map((kw, i) => (
                  <li key={i} style={{ fontSize: "9.5px", color: "#374151", marginBottom: "2px" }}>
                    <span style={{ color: C.green, fontWeight: 800, marginRight: "4px" }}>·</span>{kw}
                  </li>
                ))}
              </ul>
            ) : <em style={{ fontSize: "9px", color: "#9ca3af" }}>Nog niet ingevuld</em>}
            {core.ambitie && (
              <div style={{ marginTop: "7px", borderTop: `1px dashed ${C.blue}30`, paddingTop: "5px" }}>
                <div style={{ ...S.sectionLabel, color: C.blue }}>🎯 Ambitie (BHAG)</div>
                <p style={{ margin: 0, fontSize: "9px", color: "#374151", lineHeight: 1.4, fontStyle: "italic" }}>
                  {core.ambitie.slice(0, 160)}{core.ambitie.length > 160 ? "…" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SWOT ── */}
      <div style={{ padding: "8px 16px 6px" }}>
        <div style={{ ...S.sectionLabel, color: C.navy, borderBottom: `1px solid #e2e8f0`, paddingBottom: "4px", marginBottom: "7px" }}>
          Analyse &amp; SWOT
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "7px" }}>
          {SWOT_DEF.map(({ tag, title, color, bg, border }) => {
            const swotItems = grouped[tag] || [];
            return (
              <div key={tag} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ background: color, padding: "4px 8px" }}>
                  <span style={{ fontSize: "7.5px", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "white" }}>{title}</span>
                </div>
                <div style={{ padding: "5px 8px" }}>
                  {swotItems.length > 0 ? (
                    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {swotItems.slice(0, 5).map((item, i) => (
                        <li key={item.id} style={{ fontSize: "8.5px", color: "#374151", marginBottom: "2.5px", display: "flex", gap: "4px", lineHeight: 1.35 }}>
                          <span style={{ fontWeight: 800, color, flexShrink: 0, minWidth: "10px" }}>{i + 1}</span>
                          <span>{item.content}</span>
                        </li>
                      ))}
                    </ol>
                  ) : <em style={{ fontSize: "8px", color: "#9ca3af" }}>—</em>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Thema's & Doelstellingen ── */}
      {themas.length > 0 && (
        <div style={{ padding: "6px 16px 10px" }}>
          <div style={{ ...S.sectionLabel, color: C.navy, borderBottom: `1px solid #e2e8f0`, paddingBottom: "4px", marginBottom: "6px" }}>
            Strategische Thema's &amp; Doelstellingen
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.navy }}>
                <th style={{ ...S.th, width: "22%", borderRight: `1px solid ${C.green}40` }}>Thema</th>
                <th style={{ ...S.th, width: "32%" }}>KSF — Kritieke Succesfactoren</th>
                <th style={{ ...S.th, width: "28%" }}>KPI</th>
                <th style={{ ...S.th, width: "18%", color: C.green }}>Target</th>
              </tr>
            </thead>
            <tbody>
              {themas.map((thema, tIdx) => {
                const ksfs = (thema.ksf_kpi || []).filter(k => k.type === "ksf");
                const kpis = (thema.ksf_kpi || []).filter(k => k.type === "kpi");
                const rows = Math.max(ksfs.length, kpis.length, 1);
                const rowBg = tIdx % 2 === 0 ? "#f8fafc" : "#ffffff";
                return Array.from({ length: rows }, (_, i) => (
                  <tr key={`${thema.id}-${i}`} style={{ background: rowBg, borderBottom: "1px solid #e2e8f0" }}>
                    {i === 0 && (
                      <td rowSpan={rows} style={{ ...S.td, fontWeight: 700, color: C.navy, borderLeft: `3px solid ${C.green}`, borderRight: "1px solid #e2e8f0" }}>
                        {thema.title || `Thema ${tIdx + 1}`}
                      </td>
                    )}
                    <td style={S.td}>{ksfs[i]?.description || ""}</td>
                    <td style={S.td}>{kpis[i]?.description || ""}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: C.greenDk }}>{kpis[i]?.target_value || ""}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnalysisPrintSection recommendations={analysis} />
      <PageFooter />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — SWOT Analyse (uitgebreid, groot formaat)
// ══════════════════════════════════════════════════════════════════════════════
function SwotTemplate({ core, items, canvasName, analysis }) {
  const grouped = {};
  SWOT_DEF.forEach(d => { grouped[d.tag] = items.filter(i => i.tag === d.tag); });

  return (
    <div style={S.page}>
      <PageHeader canvasName={canvasName} subtitle="SWOT Analyse" />

      {/* Missie + Visie compact strip */}
      {(core.missie || core.visie) && (
        <div style={{ background: "#f0f9ff", borderBottom: `2px solid ${C.green}`, padding: "8px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {core.missie && (
            <div>
              <span style={{ ...S.sectionLabel, color: C.blue }}>Missie &nbsp;</span>
              <span style={{ fontSize: "9.5px", color: "#374151" }}>{core.missie.slice(0, 200)}{core.missie.length > 200 ? "…" : ""}</span>
            </div>
          )}
          {core.visie && (
            <div style={{ borderLeft: `1px solid ${C.blue}25`, paddingLeft: "16px" }}>
              <span style={{ ...S.sectionLabel, color: C.blue }}>Visie &nbsp;</span>
              <span style={{ fontSize: "9.5px", color: "#374151" }}>{core.visie.slice(0, 200)}{core.visie.length > 200 ? "…" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* SWOT 2×2 grid — groot */}
      <div style={{ padding: "10px 16px", flex: 1 }}>
        <div style={{ ...S.sectionLabel, color: C.navy, marginBottom: "8px" }}>SWOT Matrix</div>

        {/* Labels Intern/Extern */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ textAlign: "center", fontSize: "7.5px", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.blue, marginBottom: "3px", paddingBottom: "3px", borderBottom: `2px solid ${C.blue}40` }}>
            Externe factoren
          </div>
          <div style={{ textAlign: "center", fontSize: "7.5px", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.navy, marginBottom: "3px", paddingBottom: "3px", borderBottom: `2px solid ${C.navy}40` }}>
            Interne factoren
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {SWOT_DEF.map(({ tag, title, color, bg, border }) => {
            const swotItems = grouped[tag] || [];
            return (
              <div key={tag} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: "6px", overflow: "hidden", minHeight: "130px" }}>
                <div style={{ background: color, padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "white" }}>{title}</span>
                  <span style={{ marginLeft: "auto", fontSize: "7.5px", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                    {swotItems.length} item{swotItems.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  {swotItems.length > 0 ? (
                    <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {swotItems.map((item, i) => (
                        <li key={item.id} style={{ fontSize: "9px", color: "#1e293b", marginBottom: "4px", display: "flex", gap: "5px", lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 800, color, flexShrink: 0, minWidth: "12px" }}>{i + 1}</span>
                          <span>{item.content}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <em style={{ fontSize: "9px", color: "#9ca3af" }}>Nog geen items getagd als {title.toLowerCase()}</em>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Kernwaarden footer strip */}
        {(core.kernwaarden || []).length > 0 && (
          <div style={{ marginTop: "10px", padding: "7px 12px", background: "#f8fafc", border: `1px solid ${C.green}40`, borderRadius: "4px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ ...S.sectionLabel, color: C.greenDk, margin: 0, flexShrink: 0 }}>Kernwaarden:</span>
            {core.kernwaarden.map((kw, i) => (
              <span key={i} style={{ fontSize: "9px", color: C.navy, background: `${C.green}20`, border: `1px solid ${C.green}50`, borderRadius: "20px", padding: "1px 8px", fontWeight: 600 }}>
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      <AnalysisPrintSection recommendations={analysis} />
      <PageFooter />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — Balanced Scorecard
// ══════════════════════════════════════════════════════════════════════════════
function ScorecardTemplate({ core, themas, canvasName, analysis }) {
  return (
    <div style={S.page}>
      <PageHeader canvasName={canvasName} subtitle="Balanced Scorecard" />

      {/* Ambitie banner */}
      {core.ambitie && (
        <div style={{ background: `${C.green}18`, borderBottom: `2px solid ${C.green}`, padding: "7px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ ...S.sectionLabel, color: C.greenDk, margin: 0, flexShrink: 0 }}>🎯 Strategische Ambitie:</span>
          <span style={{ fontSize: "10px", color: C.navy, fontStyle: "italic", lineHeight: 1.4 }}>
            {core.ambitie.slice(0, 260)}{core.ambitie.length > 260 ? "…" : ""}
          </span>
        </div>
      )}

      {/* Scorecard tabel */}
      <div style={{ padding: "10px 16px" }}>
        {themas.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", fontStyle: "italic", padding: "40px" }}>
            Nog geen strategische thema's aangemaakt.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.navy }}>
                <th style={{ ...S.th, width: "18%", borderRight: `1px solid ${C.green}40` }}>Strategisch Thema</th>
                <th style={{ ...S.th, width: "22%", background: "#1e4080" }}>KSF — Kritieke Succesfactor</th>
                <th style={{ ...S.th, width: "24%" }}>KPI — Indicator</th>
                <th style={{ ...S.th, width: "14%", background: "#1c5e3a", textAlign: "center" }}>Huidig</th>
                <th style={{ ...S.th, width: "14%", background: C.greenDk, textAlign: "center", color: C.green }}>Target</th>
                <th style={{ ...S.th, width: "8%", background: "#374151", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {themas.map((thema, tIdx) => {
                const ksfs = (thema.ksf_kpi || []).filter(k => k.type === "ksf");
                const kpis = (thema.ksf_kpi || []).filter(k => k.type === "kpi");
                const rows = Math.max(ksfs.length, kpis.length, 1);
                const rowBg = tIdx % 2 === 0 ? "#f8fafc" : "#ffffff";
                const accent = [C.blue, C.green, "#7c3aed", "#ea580c", "#0891b2", "#be185d", "#16a34a"][tIdx % 7];

                return Array.from({ length: rows }, (_, i) => (
                  <tr key={`${thema.id}-${i}`} style={{ background: rowBg, borderBottom: `1px solid ${i === rows - 1 ? "#cbd5e1" : "#f1f5f9"}` }}>
                    {i === 0 && (
                      <td rowSpan={rows} style={{ ...S.td, fontWeight: 700, color: C.navy, borderLeft: `3px solid ${accent}`, borderRight: "1px solid #e2e8f0", paddingTop: "8px" }}>
                        {thema.title || `Thema ${tIdx + 1}`}
                      </td>
                    )}
                    <td style={{ ...S.td, borderRight: "1px solid #f1f5f9", color: "#1e40af" }}>
                      {ksfs[i]?.description || ""}
                    </td>
                    <td style={{ ...S.td, borderRight: "1px solid #f1f5f9" }}>
                      {kpis[i]?.description || ""}
                    </td>
                    <td style={{ ...S.td, textAlign: "center", color: "#64748b" }}>
                      {kpis[i]?.current_value || ""}
                    </td>
                    <td style={{ ...S.td, textAlign: "center", fontWeight: 700, color: C.greenDk }}>
                      {kpis[i]?.target_value || ""}
                    </td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      {kpis[i]?.current_value && kpis[i]?.target_value ? (
                        <span style={{ fontSize: "8px", color: accent }}>●</span>
                      ) : (
                        <span style={{ fontSize: "8px", color: "#d1d5db" }}>○</span>
                      )}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Kernwaarden + Missie footer */}
      <div style={{ margin: "0 16px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {core.missie && (
          <div style={{ padding: "7px 10px", background: "#f0f9ff", border: `1px solid ${C.blue}30`, borderRadius: "4px" }}>
            <div style={{ ...S.sectionLabel, color: C.blue, marginBottom: "3px" }}>Missie</div>
            <p style={{ margin: 0, fontSize: "9px", color: "#374151", lineHeight: 1.4 }}>
              {core.missie.slice(0, 180)}{core.missie.length > 180 ? "…" : ""}
            </p>
          </div>
        )}
        {(core.kernwaarden || []).length > 0 && (
          <div style={{ padding: "7px 10px", background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: "4px" }}>
            <div style={{ ...S.sectionLabel, color: C.greenDk, marginBottom: "3px" }}>Kernwaarden</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {core.kernwaarden.map((kw, i) => (
                <span key={i} style={{ fontSize: "8.5px", color: C.navy, background: `${C.green}25`, border: `1px solid ${C.green}50`, borderRadius: "20px", padding: "1px 7px", fontWeight: 600 }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnalysisPrintSection recommendations={analysis} />
      <PageFooter />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// HOOFD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "overview",  label: "Strategie Overzicht", icon: LayoutGrid  },
  { id: "swot",      label: "SWOT Analyse",        icon: Target       },
  { id: "scorecard", label: "Balanced Scorecard",  icon: TrendingUp   },
];

export default function StrategyOnePager({ core, items, themas, canvasId, onClose, analysis = null }) {
  const [activeTab,      setActiveTab]      = useState("overview");
  const [includeInPrint, setIncludeInPrint] = useState(false);
  const [canvasName,     setCanvasName]     = useState("");

  // Laad canvasnaam
  useEffect(() => {
    if (!canvasId || !supabase) return;
    supabase.from("canvases").select("name").eq("id", canvasId).maybeSingle()
      .then(({ data }) => { if (data?.name) setCanvasName(data.name); });
  }, [canvasId]);

  const handlePrint = () => window.print();

  // Analyseresultaten meenemen in print alleen als toggle aan staat
  const analysisForPrint = includeInPrint ? analysis : null;
  const props = { core, items, themas, canvasName, analysis: analysisForPrint };

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body > * { visibility: hidden !important; }
          #strategy-print-area,
          #strategy-print-area * { visibility: visible !important; }
          #strategy-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div className="no-print fixed inset-0 z-[58] bg-black/50" />

      {/* ── Full-screen overlay ── */}
      <div className="fixed inset-0 z-[59] flex flex-col bg-slate-100 overflow-hidden">

        {/* Controls (no-print) */}
        <div className="no-print flex items-center justify-between px-6 py-3 bg-[var(--color-primary)] border-b border-white/10 flex-shrink-0">

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all
                  ${activeTab === id
                    ? "bg-[var(--color-accent)] text-[var(--color-primary)]"
                    : "text-white/50 hover:text-white hover:bg-white/10"}`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Print-toggle + Print + Sluiten */}
          <div className="flex items-center gap-3">
            {/* Toggle: altijd zichtbaar; disabled/uitgegrijsd als er nog geen analyse is */}
            <button
              onClick={() => analysis && setIncludeInPrint(v => !v)}
              disabled={!analysis}
              title={!analysis ? "Genereer eerst Strategisch Advies via het werkblad" : includeInPrint ? "Klik om AI-advies uit print te verwijderen" : "Klik om AI-advies toe te voegen aan print"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-colors
                ${!analysis
                  ? "opacity-30 cursor-not-allowed text-white/40 border-white/20"
                  : includeInPrint
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/30"
                    : "text-white/40 border-white/20 hover:text-white/70 hover:border-white/40"}`}
            >
              <AiIcon variant="generate" size={10} />
              {includeInPrint ? "Advies in print ✓" : "Advies in print"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-[10px] font-black uppercase tracking-widest rounded-md transition-colors"
            >
              <Printer size={13} /> PDF / Printen
            </button>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview area (scrollable) */}
        <div className="flex-1 overflow-auto p-6 flex justify-center">
          <div
            id="strategy-print-area"
            className="bg-white shadow-2xl rounded-sm overflow-hidden"
            style={{ width: "297mm", minHeight: "210mm" }}
          >
            {activeTab === "overview"  && <OverviewTemplate  {...props} />}
            {activeTab === "swot"      && <SwotTemplate      {...props} />}
            {activeTab === "scorecard" && <ScorecardTemplate {...props} />}
          </div>
        </div>

        {/* Hint */}
        <div className="no-print text-center py-2 text-[9px] text-slate-400 uppercase tracking-widest flex-shrink-0 bg-slate-100">
          PDF / Printen → kies "Liggend (Landscape)" + "Aanpassen aan pagina" in je printdialoog
        </div>
      </div>
    </>
  );
}
