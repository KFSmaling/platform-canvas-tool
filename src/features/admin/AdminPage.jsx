/**
 * AdminPage — beheer prompts + UI labels zonder deploy
 *
 * Tabs: AI Prompts | Labels | Instellingen | Blok Titels
 * Binnen elke tab: collapsible groepen per werkblad / functie
 *
 * Toegankelijk via /admin — alleen voor REACT_APP_ADMIN_EMAIL
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Save, RefreshCw, LogOut, ChevronDown, ChevronUp,
  Check, AlertOctagon, Wand2, Tag, Settings2, Layers,
} from "lucide-react";
import { supabase } from "../../shared/services/supabase.client";
import LogoBrand from "../../shared/components/LogoBrand";

// ── Groep-definities per tab ─────────────────────────────────────────────────

const PROMPT_GROUPS = [
  {
    id: "magic",
    label: "Magic Staff",
    icon: Wand2,
    desc: "RAG-gebaseerde AI-suggesties in het Canvas dashboard",
    headerCls: "bg-blue-50 border-blue-200 text-blue-800",
    match: k => k.startsWith("prompt.magic.") || k === "prompt.validate",
  },
  {
    id: "improve",
    label: "Verbeteren",
    icon: Wand2,
    desc: "Herschrijf-presets (McKinsey, beknopter, financieel…)",
    headerCls: "bg-slate-100 border-slate-300 text-slate-600",
    match: k => k.startsWith("prompt.improve."),
  },
  {
    id: "strategy",
    label: "Strategie Werkblad",
    icon: Layers,
    desc: "Thema's, KSF/KPI en strategisch advies",
    headerCls: "bg-[var(--color-primary)]/8 border-[var(--color-primary)]/25 text-[var(--color-primary)]",
    match: k => k.startsWith("prompt.strategy."),
  },
  {
    id: "guideline",
    label: "Richtlijnen Werkblad",
    icon: Layers,
    desc: "Genereren, advies en Stop/Start/Continue per principe",
    headerCls: "bg-purple-50 border-purple-200 text-purple-800",
    match: k => k.startsWith("prompt.guideline."),
  },
  {
    id: "klanten",
    label: "Klanten & Dienstverlening",
    icon: Layers,
    desc: "AI-prompts voor analyse (cluster/paradox/positionering/overstijgend) + (post-11.K) dossier-extractie",
    headerCls: "bg-amber-50 border-amber-200 text-amber-800",
    match: k => k.startsWith("prompt.klanten."),
  },
  {
    id: "prompts-other",
    label: "Overig",
    icon: Wand2,
    desc: "Overige prompts (fallback)",
    headerCls: "bg-slate-50 border-slate-200 text-slate-600",
    match: () => true,
  },
];

const LABEL_GROUPS = [
  {
    id: "app",
    label: "Applicatie",
    icon: Tag,
    desc: "App-titel, subtitel en voettekst",
    headerCls: "bg-green-50 border-green-200 text-green-800",
    match: k => k.startsWith("label.app.") || k.startsWith("label.footer."),
  },
  {
    id: "strategy",
    label: "Strategie Werkblad",
    icon: Layers,
    desc: "Sectiekoppen, veldnamen en werkbladnaam",
    headerCls: "bg-[var(--color-primary)]/8 border-[var(--color-primary)]/25 text-[var(--color-primary)]",
    match: k =>
      k === "label.werkblad.strategie" ||
      k.startsWith("label.strat.") ||
      k.startsWith("label.section."),
  },
  {
    // T2 A3 — Strategie-werkblad invultips (5 kort + 5 uitgebreid + 3 voorbeeld)
    // Eigen groep voor zichtbaarheid; volgorde direct onder Strategie Werkblad-
    // groep zodat consultants ze visueel samen vinden.
    id: "strategy-tips",
    label: "Strategie — Invultips",
    icon: Layers,
    desc: "Helper-teksten en uitgebreide tips per blok (Missie / Visie / Ambitie / Kernwaarden / Samenvatting)",
    headerCls: "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/15 text-[var(--color-primary)]",
    match: k => k.startsWith("label.tips.strategie."),
  },
  {
    id: "guideline",
    label: "Richtlijnen Werkblad",
    icon: Layers,
    desc: "Segment namen, subtitels en werkbladnaam",
    headerCls: "bg-purple-50 border-purple-200 text-purple-800",
    match: k =>
      k === "label.werkblad.richtlijnen" ||
      k.startsWith("label.richtl."),
  },
  {
    id: "werkblad-klanten",
    label: "Werkblad Klanten",
    icon: Layers,
    desc: "Sectiekoppen, veldnamen, dimensies, pijnpunten, analyse, verbeterrichtingen, rapport",
    headerCls: "bg-amber-50 border-amber-200 text-amber-800",
    match: k => k === "label.werkblad.klanten" || k.startsWith("label.klanten."),
  },
  {
    id: "other",
    label: "Overig",
    icon: Tag,
    desc: "Overige labels",
    headerCls: "bg-slate-50 border-slate-200 text-slate-600",
    match: () => true, // catch-all
  },
];

const SETTING_GROUPS = [
  {
    id: "all",
    label: "Instellingen",
    icon: Settings2,
    desc: "Technische instellingen",
    headerCls: "bg-slate-50 border-slate-200 text-slate-600",
    match: () => true,
  },
];

// ── Groepeer rijen op volgorde van de group-definities ───────────────────────
function groupRows(rows, groups) {
  const used = new Set();
  return groups.map(g => {
    const matched = rows.filter(r => !used.has(r.key) && g.match(r.key));
    matched.forEach(r => used.add(r.key));
    return { ...g, rows: matched };
  }).filter(g => g.rows.length > 0);
}

// ── Collapsible groep-sectie ─────────────────────────────────────────────────
function GroupSection({ group, children }) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;
  return (
    <div className="border border-slate-200 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 border-b ${group.headerCls} transition-colors`}
      >
        <Icon size={13} />
        <span className="text-[11px] font-black uppercase tracking-widest flex-1 text-left">{group.label}</span>
        {group.desc && (
          <span className="text-[10px] font-normal opacity-70 hidden sm:block">{group.desc}</span>
        )}
        <span className="text-[10px] font-bold bg-white/50 rounded-full px-2 py-0.5 ml-2">
          {React.Children.count(children)}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Één bewerkbaar config-rij ────────────────────────────────────────────────
function ConfigRow({ row, onSave }) {
  const [value, setValue]   = useState(row.value);
  const [status, setStatus] = useState("idle");
  const [open, setOpen]     = useState(false);

  const isLong  = row.category === "prompt";
  const isDirty = value !== row.value;

  const handleSave = async () => {
    setStatus("saving");
    const { error } = await supabase
      .from("app_config")
      .upsert(
        { key: row.key, category: row.category, description: row.description, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("saved");
      onSave(row.key, value);
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <div className={`${isDirty ? "bg-amber-50/50" : "bg-white"} transition-colors`}>
      {/* Header rij */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <code className="text-xs font-mono text-[var(--color-primary)] font-semibold">{row.key}</code>
          {row.description && (
            <p className="text-[11px] text-slate-400 mt-0.5">{row.description}</p>
          )}
        </div>
        {!open && (
          <p className="text-xs text-slate-500 truncate max-w-xs shrink-0 mt-0.5 italic">
            {value || <span className="text-slate-300">leeg</span>}
          </p>
        )}
        {isDirty && <span className="text-[9px] text-amber-600 font-bold uppercase shrink-0 mt-1">●</span>}
        <button className="text-slate-400 shrink-0 mt-0.5">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Edit gebied */}
      {open && (
        <div className="px-4 pb-4 space-y-2 bg-slate-50/50">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={isLong ? 12 : 2}
            className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 font-mono
                       focus:outline-none focus:border-[var(--color-accent)] resize-y leading-relaxed bg-white"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400">
              {isDirty ? "⚠ Niet opgeslagen" : "Geen wijzigingen"}
            </p>
            <button
              onClick={handleSave}
              disabled={!isDirty || status === "saving"}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-all
                ${isDirty && status === "idle"
                  ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] shadow-sm"
                  : status === "saved"  ? "bg-green-100 text-green-700"
                  : status === "error"  ? "bg-red-100 text-red-600"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
            >
              {status === "saving" && <RefreshCw size={11} className="animate-spin" />}
              {status === "saved"  && <Check size={11} />}
              {status === "error"  && <AlertOctagon size={11} />}
              {(status === "idle" || status === "saving") && <Save size={11} />}
              {status === "saving" ? "Opslaan…"
               : status === "saved"  ? "Opgeslagen"
               : status === "error"  ? "Fout"
               : "Opslaan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Blok definitie rij (block_definitions tabel) ────────────────────────────
function BlockDefRow({ row, onSave }) {
  const [nlVal,  setNlVal]  = useState(row.label_nl  || "");
  const [enVal,  setEnVal]  = useState(row.label_en  || "");
  const [status, setStatus] = useState("idle");

  const isDirty = nlVal !== (row.label_nl || "") || enVal !== (row.label_en || "");

  const handleSave = async () => {
    setStatus("saving");
    const { error } = await supabase
      .from("block_definitions")
      .update({ label_nl: nlVal, label_en: enVal })
      .eq("key", row.key);
    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("saved");
      onSave(row.key, { label_nl: nlVal, label_en: enVal });
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <div className={`border-b border-slate-100 last:border-0 ${isDirty ? "bg-amber-50/50" : "bg-white"}`}>
      <div className="grid grid-cols-[180px_1fr_1fr_auto] gap-3 items-center px-4 py-3">
        <code className="text-xs font-mono text-[var(--color-primary)] font-semibold">{row.key}</code>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">NL</span>
          <input
            value={nlVal}
            onChange={e => setNlVal(e.target.value)}
            className="text-sm border border-slate-200 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-[var(--color-accent)] text-slate-700 bg-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">EN</span>
          <input
            value={enVal}
            onChange={e => setEnVal(e.target.value)}
            className="text-sm border border-slate-200 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-[var(--color-accent)] text-slate-700 bg-white"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || status === "saving"}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-all self-end
            ${isDirty && status === "idle"
              ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] shadow-sm"
              : status === "saved"  ? "bg-green-100 text-green-700"
              : status === "error"  ? "bg-red-100 text-red-600"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
        >
          {status === "saving" && <RefreshCw size={11} className="animate-spin" />}
          {status === "saved"  && <Check size={11} />}
          {status === "error"  && <AlertOctagon size={11} />}
          {(status === "idle" || status === "saving") && <Save size={11} />}
          {status === "saving" ? "Opslaan…" : status === "saved" ? "Opgeslagen" : status === "error" ? "Fout" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

// ── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "prompt",  label: "AI Prompts",    groups: PROMPT_GROUPS  },
  { id: "label",   label: "Labels",        groups: LABEL_GROUPS   },
  { id: "setting", label: "Instellingen",  groups: SETTING_GROUPS },
  { id: "blocks",  label: "Blok Titels",   groups: null           },
];

// ── Standaard labels — worden automatisch geseed als ze ontbreken in de DB ───
// Dit is de enige bron van waarheid voor label-defaults; migrations zijn een backup.
const DEFAULT_LABELS = [
  // Applicatie
  { key: "label.app.title",                    description: "App-titel in de header",                        value: "Business Transformation Workbench"                                },
  { key: "label.app.subtitle",                 description: "App-subtitel in de header",                     value: "Platform voor strategie tot executie"                      },
  { key: "label.footer.tagline",               description: "Voettekst onderaan het canvas",                 value: "Platform voor strategie tot executie"                       },
  // Werkblad namen
  { key: "label.werkblad.strategie",           description: "Naam van het Strategie Werkblad",               value: "Strategie Werkblad"                               },
  { key: "label.werkblad.richtlijnen",         description: "Naam van het Richtlijnen Werkblad",             value: "Richtlijnen & Leidende Principes"                 },
  // Strategie Werkblad — sectiekoppen
  { key: "label.strat.section.identiteit",     description: "Sectienaam Identiteit (h3)",                    value: "Identiteit"                                       },
  { key: "label.strat.section.analyse",        description: "Sectienaam Analyse (h3)",                       value: "Analyse"                                          },
  { key: "label.strat.section.executie",       description: "Sectienaam Executie (h3)",                      value: "Executie — 7·3·3 Regel"                           },
  // Strategie Werkblad — veldnamen
  { key: "label.strat.field.missie",           description: "Veldnaam Missie",                               value: "Missie"                                           },
  { key: "label.strat.field.visie",            description: "Veldnaam Visie",                                value: "Visie"                                            },
  { key: "label.strat.field.ambitie",          description: "Veldnaam Ambitie (BHAG)",                       value: "Ambitie (BHAG)"                                   },
  { key: "label.strat.field.kernwaarden",      description: "Veldnaam Kernwaarden",                          value: "Kernwaarden"                                      },
  { key: "label.strat.field.samenvatting",     description: "Veldnaam Strategische Samenvatting (max 2 zinnen)", value: "Strategische Samenvatting"                   },
  { key: "label.strat.field.extern",           description: "Kolomnaam Externe analyse",                     value: "Externe Ontwikkelingen"                           },
  { key: "label.strat.field.intern",           description: "Kolomnaam Interne analyse",                     value: "Interne Ontwikkelingen"                           },
  // Richtlijnen Werkblad — segment namen + subtitels
  { key: "label.richtl.segment.generiek",      description: "Segment naam Generiek",                         value: "Generiek"                                         },
  { key: "label.richtl.segment.generiek.sub",  description: "Segment subtitel Generiek",                     value: "Strategie & Governance"                           },
  { key: "label.richtl.segment.klanten",       description: "Segment naam Klanten",                          value: "Klanten"                                          },
  { key: "label.richtl.segment.klanten.sub",   description: "Segment subtitel Klanten",                      value: "Markt & Dienstverlening"                          },
  { key: "label.richtl.segment.organisatie",   description: "Segment naam Organisatie",                      value: "Organisatie"                                      },
  { key: "label.richtl.segment.organisatie.sub",description:"Segment subtitel Organisatie",                  value: "Mens & Proces"                                    },
  { key: "label.richtl.segment.it",            description: "Segment naam IT",                               value: "IT"                                               },
  { key: "label.richtl.segment.it.sub",        description: "Segment subtitel IT",                           value: "Technologie & Data"                               },
];

// ── Hoofd AdminPage ──────────────────────────────────────────────────────────
export default function AdminPage({ user, onSignOut }) {
  const [rows, setRows]           = useState([]);
  const [blockDefs, setBlockDefs] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("prompt");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const [{ data: configData }, { data: defsData }] = await Promise.all([
      supabase.from("app_config").select("key, value, category, description, updated_at").order("key"),
      supabase.from("block_definitions").select("key, label_nl, label_en").order("key"),
    ]);

    if (configData) {
      // Merge: DB-rijen + DEFAULT_LABELS die nog niet in DB staan.
      // DB-waarde wint altijd; ontbrekende labels worden als lokale rij getoond
      // zodat de admin ze kan zien en opslaan (vereist INSERT-policy in Supabase).
      const dbMap = new Map(configData.map(r => [r.key, r]));
      const syntheticLabels = DEFAULT_LABELS
        .filter(l => !dbMap.has(l.key))
        .map(l => ({ key: l.key, category: "label", description: l.description, value: l.value, _notInDb: true }));
      const merged = [...configData, ...syntheticLabels].sort((a, b) => a.key.localeCompare(b.key));
      setRows(merged);
    }

    if (defsData) setBlockDefs(defsData);
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave        = (key, newValue)  => setRows(prev => prev.map(r => r.key === key ? { ...r, value: newValue } : r));
  const handleBlockDefSave = (key, patch)    => setBlockDefs(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));

  const tab = TABS.find(t => t.id === activeTab);

  // Groepeer rijen voor huidige tab
  const grouped = tab?.groups
    ? groupRows(rows.filter(r => r.category === activeTab), tab.groups)
    : [];

  const tabCount = (t) => {
    if (t.id === "blocks") return blockDefs.length;
    return rows.filter(r => r.category === t.id).length;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[var(--color-primary)] font-sans">

      {/* Header */}
      <header className="h-16 bg-[var(--color-primary)] flex items-center justify-between px-8 border-b-2 border-[var(--color-accent)] shadow-lg">
        <div className="flex items-center gap-4">
          <LogoBrand
            variant="light"
            imgClassName="h-8 w-auto object-contain"
            textClassName="text-white font-bold text-base tracking-wide"
          />
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-white">App Config</h1>
            <p className="text-[10px] text-[var(--color-accent)] uppercase tracking-widest">Admin — {user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadConfig}
            className="flex items-center gap-1.5 text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all">
            <RefreshCw size={11} /> Vernieuwen
          </button>
          <a href="/"
            className="text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all">
            ← Naar App
          </a>
          <button onClick={onSignOut}
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors ml-1">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm px-5 py-3 text-sm text-blue-800">
          <strong>Wijzigingen zijn direct actief</strong> — prompts gelden bij de volgende API-aanroep,
          labels bij de volgende pagina-refresh. Geen deploy nodig.
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all -mb-px
                ${activeTab === t.id
                  ? "border-[var(--color-accent)] text-[var(--color-primary)]"
                  : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              {t.label}
              <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                {loading ? "…" : tabCount(t)}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Config laden…</span>
          </div>

        ) : activeTab === "blocks" ? (
          /* ── Blok Titels ── */
          <div className="space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded-sm px-5 py-3 text-sm text-blue-800">
              Wijzigingen zijn direct actief na de volgende pagina-refresh in de app.
              De sleutel (key) is niet aanpasbaar.
            </div>
            <div className="border border-slate-200 rounded-sm overflow-hidden">
              {blockDefs.length === 0
                ? <p className="text-slate-400 text-sm text-center py-12">Geen blok definities gevonden</p>
                : blockDefs.map(row => (
                    <BlockDefRow key={row.key} row={row} onSave={handleBlockDefSave} />
                  ))
              }
            </div>
          </div>

        ) : grouped.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-12">Geen rijen gevonden</p>

        ) : (
          /* ── Gegroepeerde rijen ── */
          <div className="space-y-4">
            {grouped.map(group => (
              <GroupSection key={group.id} group={group}>
                {group.rows.map(row => (
                  <ConfigRow key={row.key} row={row} onSave={handleSave} />
                ))}
              </GroupSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
