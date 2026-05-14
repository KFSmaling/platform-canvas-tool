import React from "react";
import {
  ChevronRight,
  Users, Route, HeartHandshake, Laptop, Crosshair, Compass, LayoutGrid,
} from "lucide-react";
import { useLang } from "../../../i18n";
import CanvasTegelSummary from "./CanvasTegelSummary";

// Fase 3 design-systeem §2.7 — Tabler-outline categorie-iconen.
// Lucide-equivalenten (Tabler-migratie kan in latere fase):
//   ti-users         → Users
//   ti-route         → Route
//   ti-user-heart    → HeartHandshake (Lucide heeft geen user-heart)
//   ti-device-laptop → Laptop
//   ti-target-arrow  → Crosshair
//   ti-compass       → Compass
// Portfolio krijgt LayoutGrid als overzicht-icoon (geen explicit categorie).
const BLOCK_ICON = {
  strategy:   Crosshair,
  principles: Compass,
  customers:  Users,
  processes:  Route,
  people:     HeartHandshake,
  technology: Laptop,
  portfolio:  LayoutGrid,
};

// Categorie-tile-styling per categorie-token uit Fase 1.
const BLOCK_ICON_STYLE = {
  strategy:   { bg: "var(--neutral-100)",          color: "var(--category-strategie)" },
  principles: { bg: "var(--neutral-100)",          color: "var(--category-richtlijnen)" },
  customers:  { bg: "var(--category-klanten-light)",   color: "var(--category-klanten)" },
  processes:  { bg: "var(--category-processen-light)", color: "var(--category-processen)" },
  people:     { bg: "var(--category-mensen-light)",    color: "var(--category-mensen)" },
  technology: { bg: "var(--category-it-light)",        color: "var(--category-it)" },
  portfolio:  { bg: "var(--neutral-100)",          color: "var(--neutral-700)" },
};

// Sub-tab sets — pillar blocks use Current/To-Be/Change
// Guiding Principles uses the 4 pillar names as subtabs
// Subtabs en blocks zijn ID-gebaseerd; labels worden via t() opgehaald
const PILLAR_SUBTABS = [
  { id: "current", labelKey: "subtab.current", dot: "bg-slate-400",    activeBg: "bg-slate-50 border-slate-300",    color: "border-slate-400 text-slate-600"    },
  { id: "tobe",    labelKey: "subtab.tobe",    dot: "bg-[var(--color-analysis)]",    activeBg: "bg-blue-50 border-[var(--color-primary)]",     color: "border-[var(--color-primary)] text-[var(--color-primary)]"    },
  { id: "change",  labelKey: "subtab.change",  dot: "bg-orange-400",   activeBg: "bg-orange-50 border-orange-300",  color: "border-orange-400 text-orange-500"  },
];

const PRINCIPLES_SUBTABS = [
  { id: "generic",    labelKey: "subtab.generic",         dot: "bg-[var(--color-primary)]",   activeBg: "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/30", color: "border-[var(--color-primary)] text-[var(--color-primary)]"    },
  { id: "customers",  labelKey: "block.customers.title",  dot: "bg-[var(--color-analysis)]",   activeBg: "bg-blue-50 border-blue-300",         color: "border-blue-400 text-blue-600"      },
  { id: "processes",  labelKey: "block.processes.title",  dot: "bg-violet-500",  activeBg: "bg-violet-50 border-violet-300",     color: "border-violet-500 text-violet-600"  },
  { id: "people",     labelKey: "block.people.title",     dot: "bg-green-500",   activeBg: "bg-green-50 border-green-300",       color: "border-green-500 text-green-600"    },
  { id: "technology", labelKey: "block.technology.title", dot: "bg-slate-500",   activeBg: "bg-slate-100 border-slate-400",      color: "border-slate-500 text-slate-600"    },
];

const BLOCKS = [
  { id: "strategy",   titleKey: "block.strategy.title",   subKey: "block.strategy.sub",   layout: "wide",    hasSubs: false, subTabs: null           },
  { id: "principles", titleKey: "block.principles.title", subKey: "block.principles.sub", layout: "wide",    hasSubs: true,  subTabs: PRINCIPLES_SUBTABS },
  { id: "customers",  titleKey: "block.customers.title",  subKey: "block.customers.sub",  layout: "quarter", hasSubs: true,  subTabs: PILLAR_SUBTABS },
  { id: "processes",  titleKey: "block.processes.title",  subKey: "block.processes.sub",  layout: "quarter", hasSubs: true,  subTabs: PILLAR_SUBTABS },
  { id: "people",     titleKey: "block.people.title",     subKey: "block.people.sub",     layout: "quarter", hasSubs: true,  subTabs: PILLAR_SUBTABS },
  { id: "technology", titleKey: "block.technology.title", subKey: "block.technology.sub", layout: "quarter", hasSubs: true,  subTabs: PILLAR_SUBTABS },
  { id: "portfolio",  titleKey: "block.portfolio.title",  subKey: "block.portfolio.sub",  layout: "wide",    hasSubs: false, subTabs: null           },
];


// Helper to convert string arrays to bullet objects
const eb  = (texts, source) => texts.map(text => ({ text, source }));
const ebs = (texts, source, subtab) => texts.map(text => ({ text, source, subtab }));

const EXAMPLE_BULLETS = {
  strategy:   eb(["Vision: marktleider in segment X tegen 2030","Pivot: van product-gedreven naar klant-gedreven model","Driver A: klantgerichtheid — consistente ervaring over alle kanalen","Driver B: product-differentiatie — nieuwe proposities binnen 6 maanden","Goal: verdubbeling van waarde-creatie binnen 5 jaar"], "example-strategy.pdf"),
  principles: [
    ...ebs(["Klant centraal: segmenteren op klantwaarde, geen one-size-fits-all","Consistentie over kanalen — zelfde vraag, zelfde uitkomst, ongeacht ingang"], "example-principles.pdf", "customers"),
    ...ebs(["Standaardiseer ondersteunende processen, maatwerk op onderscheidende 20%","Agile by default — multidisciplinaire teams boven functionele silo's"], "example-principles.pdf", "processes"),
    ...ebs(["Digitale vaardigheid is basis-eis, geen optie","Talent intern ontwikkelen voor extern werven"], "example-principles.pdf", "people"),
    ...ebs(["API-first: geen point solutions die niet kunnen verbinden","Data is een gedeeld asset — geen afdelings-eilanden"], "example-principles.pdf", "technology"),
  ],
  customers: [
    ...ebs(["Hoofdsegment levert 70% van omzet — focus op behoud en uitbouw","Distributie via 3 hoofdkanalen (direct, partner, indirect)"], "example-customers.pdf", "current"),
    ...ebs(["Omnichannel-propositie: naadloze overgang tussen kanalen","Uitbreiding naar nieuwe geografische markt of nieuw klant-segment"], "example-customers.pdf", "tobe"),
    ...ebs(["Klantreis-redesign voor hoofdsegment","Lancering verbeterd partner-portaal in H1"], "example-customers.pdf", "change"),
  ],
  processes: [
    ...ebs(["Handmatige verwerking: 60% van zaken nog papier-gebaseerd","Gescheiden front-/back-office — geen real-time zicht op zaak-status"], "example-processes.pdf", "current"),
    ...ebs(["Straight-through processing voor standaard-zaken","Agile operating model: multidisciplinaire squads"], "example-processes.pdf", "tobe"),
    ...ebs(["Standaardiseer en automatiseer: AI, OCR, workflow-tooling","Ontkoppel front (klantbeleving) van back (administratie)"], "example-processes.pdf", "change"),
  ],
  people: [
    ...ebs(["Performance-management: inconsistent tussen business-units","Digital skills gap: beperkte AI- en data-geletterdheid"], "example-people.pdf", "current"),
    ...ebs(["Helder accountability-model, doel-gedreven cultuur","Digitaal-vaardig personeel op alle niveaus"], "example-people.pdf", "tobe"),
    ...ebs(["Talent-programma + opvolgingsplanning","Digital-literacy-traject: AI/data-training voor alle medewerkers"], "example-people.pdf", "change"),
  ],
  technology: [
    ...ebs(["Legacy core-systeem: beperkte API-toegang","Versnipperd data-landschap — geen 360°-klantbeeld"], "example-technology.pdf", "current"),
    ...ebs(["Cloud-native platform: modulair, API-first, schaalbaar","Eén klant-data-platform over alle business-functies"], "example-technology.pdf", "tobe"),
    ...ebs(["Core-systeem upgrade + API-laag fase 1","CRM-platform uitrol — fase 1 in primaire markt"], "example-technology.pdf", "change"),
  ],
  portfolio:  eb(["Hygiene: merk-positionering, prijs-benchmark, core-systeem upgrade","Scenario I: lancering nieuwe propositie in primaire markt","Scenario I: uitbouw verkoop-organisatie, klantreis-redesign","Scenario II: nieuwe regio betreden, CRM-platform invoeren"], "example-portfolio.pdf"),
};

// ── Local scoring engine ─────────────────────────────────────────────────────
function scoreBlock(bullets) {
  const texts = (bullets || []).map(b => typeof b === "string" ? b : b.text);
  const filled = texts.filter(b => b.trim().length > 3);
  if (filled.length === 0) return 0;
  let score = 30;
  score += Math.min(filled.length * 8, 40);
  const specific = filled.filter(b => /\d|%|KPI|goal|target|owner|budget|Q[1-4]|\$|€/i.test(b));
  score += Math.min(specific.length * 5, 20);
  const vague = filled.filter(b => b.trim().length < 15);
  score -= vague.length * 5;
  return Math.max(10, Math.min(100, score));
}

function getBlockStatus(blockId, docs, insights, bullets) {
  if (bullets[blockId]?.length > 0) return "done";
  if (insights[blockId]?.length > 0) return "insights";
  if (docs[blockId]?.length > 0) return "uploaded";
  return "empty";
}

// ── Consistency analysis ─────────────────────────────────────────────────────
function runConsistencyCheck(bullets) {
  const scores = {};
  BLOCKS.forEach(b => { scores[b.id] = scoreBlock(bullets[b.id] || []); });

  const issues = [];
  const filled = id => (bullets[id] || []).filter(b => (typeof b === "string" ? b : b.text).trim()).length;

  if (filled("strategy") >= 3 && filled("portfolio") < 2)
    issues.push({ severity: "high", blocks: ["strategy", "portfolio"], issueKey: "check.issue.strategy_portfolio" });
  if (filled("people") < 2 && filled("technology") >= 3)
    issues.push({ severity: "medium", blocks: ["people", "technology"], issueKey: "check.issue.people_technology" });
  if (filled("principles") < 2)
    issues.push({ severity: "medium", blocks: ["principles"], issueKey: "check.issue.principles" });
  if (filled("customers") >= 3 && filled("processes") < 2)
    issues.push({ severity: "low", blocks: ["customers", "processes"], issueKey: "check.issue.customers_processes" });
  if (issues.length === 0)
    issues.push({ severity: "low", blocks: ["strategy", "principles"], issueKey: "check.issue.default" });

  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / BLOCKS.length);

  return { scores, issues, overall };
}

// ── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  empty:    "border-l-4 border-l-transparent border border-slate-100 bg-white",
  uploaded: "border-l-4 border-l-[var(--color-primary)] border border-slate-100 bg-white",
  insights: "border-l-4 border-l-amber-400 border border-slate-100 bg-white",
  done:     "border-l-4 border-l-[var(--color-accent)] border border-slate-100 bg-white",
};

const STATUS_BADGE_KEYS = {
  empty:    null,
  uploaded: { labelKey: "status.uploaded", color: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" },
  insights: { labelKey: "status.insights", color: "bg-amber-50 text-amber-700" },
  done:     { labelKey: "status.done",     color: "bg-[var(--color-accent)]/20 text-[#4a7c1f]" },
};

const SEV_COLOR = { high: "border-l-red-400 bg-red-50", medium: "border-l-amber-400 bg-amber-50", low: "border-l-slate-300 bg-slate-50" };
const SEV_TEXT  = { high: "text-red-600", medium: "text-amber-700", low: "text-slate-500" };

// ── Block Card (dashboard) ───────────────────────────────────────────────────
function BlockCard({ block, status, bullets, insightCount, summary, onClick }) {
  const { t } = useLang();
  const badgeDef = STATUS_BADGE_KEYS[status];
  const badge = badgeDef ? { label: t(badgeDef.labelKey), color: badgeDef.color } : null;
  const isWide    = block.layout === "wide";
  const isHalf    = block.layout === "half";
  const isQuarter = block.layout === "quarter";
  const title = t(block.titleKey);
  const sub   = t(block.subKey);

  return (
    <div
      onClick={onClick}
      className={`
        p-6 rounded shadow-md hover:shadow-xl cursor-pointer transition-all group relative flex flex-col justify-between min-h-[160px]
        ${STATUS_COLORS[status]}
        ${isWide ? "col-span-12" : isHalf ? "col-span-6" : isQuarter ? "col-span-3" : "col-span-4"}
      `}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Fase 3 design-systeem §2.7 — categorie-icoon-tile per pijler */}
            {BLOCK_ICON[block.id] && (
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                style={BLOCK_ICON_STYLE[block.id]}
                aria-hidden="true"
                data-testid={`block-card-icon-${block.id}`}
              >
                {React.createElement(BLOCK_ICON[block.id], { size: 18 })}
              </span>
            )}
            <div>
              <h3 className="text-[var(--color-primary)] font-bold text-base uppercase tracking-[0.12em] leading-tight" style={{fontFamily:"'Montserrat','Inter',sans-serif"}}>{title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 tracking-wide">{sub}</p>
            </div>
          </div>
          {badge && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider shrink-0 ml-2 ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Bullet preview */}
        {block.hasSubs ? (
          <div className="space-y-1 mt-3">
            {(block.subTabs || PILLAR_SUBTABS).map(st => {
              const stBullets = (bullets || []).filter(b => b.subtab === st.id);
              if (stBullets.length === 0) return null;
              return (
                <div key={st.id}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${st.color.split(" ")[1]}`}>{t(st.labelKey)}</span>
                  {stBullets.slice(0, 2).map((b, i) => (
                    <div key={i} className="flex items-start gap-2 mt-0.5">
                      <div className={`mt-1.5 w-1 h-1 rotate-45 shrink-0 ${st.dot}`} />
                      <span className="text-base text-slate-700 leading-snug">{b.text}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* T1 A8: "Leeg"-tekst verwijderd; CanvasTegelSummary (hieronder)
                rendert al een passende lege-state-tekst per pijler ("Werkblad
                komt later" of "Nog leeg — start met …"). */}
          </div>
        ) : (
          <div className="space-y-1.5 mt-3">
            {(bullets || []).slice(0, isWide ? 4 : 3).map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rotate-45 shrink-0" />
                <span className="text-base text-slate-700 leading-snug">{typeof b === "string" ? b : b.text}</span>
              </div>
            ))}
            {/* T1 A8: zelfde — "Leeg"-tekst weg, CanvasTegelSummary doet stub-tekst */}
          </div>
        )}

        {/* S1 design-systeem F12 — canvas-tegel-feedback (counts + quote per
            pijler). summary-prop uit useCanvasState.canvasSummary; component
            kiest zelf per blockId welke buckets te tonen + stub voor niet-
            gebouwde werkbladen. */}
        <CanvasTegelSummary blockId={block.id} summary={summary} appLabel={null} />
      </div>

      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
        {/* T1 A7: As-is/To-be/Change-actions-pills verwijderd uit tegel-footer.
            Subtab-state blijft intact (BlockPanel gebruikt het); alleen de
            visuele labels onder aan de pijler-tegels zijn weg per Kees-test. */}
        {insightCount > 0 ? (
          <span className="text-[9px] font-bold text-orange-500 uppercase">{insightCount} {t("status.insights")}</span>
        ) : <span />}
        <ChevronRight size={18} className="text-slate-200 group-hover:text-[var(--color-accent)] transition-colors" />
      </div>
    </div>
  );
}

export { BLOCKS, PILLAR_SUBTABS, PRINCIPLES_SUBTABS, EXAMPLE_BULLETS, STATUS_COLORS, STATUS_BADGE_KEYS, SEV_COLOR, SEV_TEXT, scoreBlock, getBlockStatus, runConsistencyCheck };
export default BlockCard;
