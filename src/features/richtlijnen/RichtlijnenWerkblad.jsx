/**
 * RichtlijnenWerkblad — Premium swimlane dashboard voor Leidende Principes
 *
 * Vier verticale swimlanes · sticky headers · column-scroll
 * AI generatie per segment · Advies modal · Portrait onepager
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense,
} from "react";
import {
  ArrowLeft, Plus, Trash2, Wand2, X, RefreshCw,
  BookOpen, Link2, RotateCcw, ChevronDown, ChevronRight, Compass,
  Info, Settings, LogOut,
} from "lucide-react";
import AiIcon from "../../shared/components/AiIcon";
import WerkbladActieknoppen from "../../shared/components/WerkbladActieknoppen";
import WerkbladHeader from "../../shared/components/WerkbladHeader";
import OverDialog from "../../shared/components/OverDialog";
import { apiFetch } from "../../shared/services/apiClient";
import { useLang } from "../../i18n";
import { useAuth } from "../../shared/services/auth.service";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import {
  loadGuidelines, createGuideline, updateGuideline, deleteGuideline,
  loadGuidelineAnalysis, upsertGuidelineAnalysis,
} from "./services/guidelines.service";
import {
  loadStrategyCore, loadStrategicThemes,
} from "../strategie/services/strategy.service";
import { loadCanvasById } from "../../shared/services/canvas.service";

const GuidelinesOnePager = lazy(() => import("./GuidelinesOnePager"));

// ── Segment definities ────────────────────────────────────────────────────────
// T3: 5-segmenten-architectuur — gebruikt Fase-1 category-tokens. Kleur-CSS-vars
// via inline-style (Tailwind kent geen `border-l-[var(--category-X)]`-pattern).
// `colorVar` = CSS-variable-naam (e.g. "--category-klanten"), wordt in JSX als
// `style={{ borderLeftColor: 'var(' + colorVar + ')' }}` toegepast.
const SEGMENTS = [
  {
    key:      "generiek",
    label:    "Generiek",
    short:    "Generiek",
    sublabel: "Strategie & Governance",
    colorVar: "--color-primary",
    lightVar: "--neutral-100",
  },
  {
    key:      "klanten",
    label:    "Klanten & dienstverlening",
    short:    "Klanten",
    sublabel: "Markt & Dienstverlening",
    colorVar: "--category-klanten",
    lightVar: "--category-klanten-light",
  },
  {
    key:      "processen",
    label:    "Processen & organisatie",
    short:    "Processen",
    sublabel: "Werkstromen, governance, samenwerking",
    colorVar: "--category-processen",
    lightVar: "--category-processen-light",
  },
  {
    key:      "mensen",
    label:    "Mensen & competenties",
    short:    "Mensen",
    sublabel: "Leiderschap, cultuur, vaardigheden",
    colorVar: "--category-mensen",
    lightVar: "--category-mensen-light",
  },
  {
    key:      "it",
    label:    "Informatie & Technologie",
    short:    "IT",
    sublabel: "Technologie & Data",
    colorVar: "--category-it",
    lightVar: "--category-it-light",
  },
];

const GENERATE_MSGS = [
  "Strategie vertalen naar richtlijnen…",
  "Leidende principes formuleren…",
  "Organisatiegedrag uitkristalliseren…",
  "Principes kalibreren op ambities…",
  "Richtinggevende kaders opstellen…",
];

const EMPTY_IMPL = { stop: "", start: "", continue: "" };

// ── GuidelineKaart ─────────────────────────────────────────────────────────────
const GuidelineKaart = React.memo(function GuidelineKaart({
  guideline, themas, segment,
  onChangeField, onChangeImplication, onToggleTheme, onDelete,
  implLoading, onGenerateImplications,
}) {
  const [collapsed, setCollapsed] = useState(true);
  const linked = Array.isArray(guideline.linked_themes) ? guideline.linked_themes : [];
  const impl   = guideline.implications || EMPTY_IMPL;

  // Thema badge met custom tooltip
  // T3: badge-active-styling via inline-style met categorie-CSS-variabele
  // (segment.colorVar uit nieuwe SEGMENTS-shape).
  const ThemaBadge = ({ t, i }) => {
    const isActive = linked.includes(t.id);
    return (
      <div className="relative group/badge">
        <button
          onClick={() => onToggleTheme(t.id)}
          data-testid={`richtl-thema-badge-${guideline.id}-${t.id}`}
          data-active={isActive ? "true" : "false"}
          style={isActive && segment.colorVar
            ? { backgroundColor: `var(${segment.colorVar})`, color: "#fff" }
            : undefined}
          className={`text-xs font-black rounded-full w-7 h-7 flex items-center justify-center transition-all
            ${isActive
              ? "shadow-sm ring-2 ring-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          {i + 1}
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          {t.title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid={`richtl-card-${guideline.id}`}
      className="bg-white rounded-2xl border border-slate-200 border-l-4 shadow-sm overflow-hidden"
      style={segment.colorVar ? { borderLeftColor: `var(${segment.colorVar})` } : undefined}
    >

      {/* ── T3 B1+B2: Titel + collapse toggle (chevron-right collapsed,
          chevron-down expanded) + kleinere title-lettertype ── */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button
          onClick={() => setCollapsed(c => !c)}
          data-testid={`richtl-card-toggle-${guideline.id}`}
          aria-expanded={collapsed ? "false" : "true"}
          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          title={collapsed ? "Uitklappen" : "Inklappen"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <input
          value={guideline.title}
          onChange={e => onChangeField("title", e.target.value)}
          onFocus={() => setCollapsed(false)}
          placeholder="Principe titel…"
          className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300 leading-snug"
        />
        {/* Thema-badges altijd zichtbaar in de titelbalk */}
        {themas.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {themas.map((t, i) => <ThemaBadge key={t.id} t={t} i={i} />)}
          </div>
        )}
        <button
          onClick={onDelete}
          className="text-slate-200 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
          title="Principe verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Uitklapbaar deel ── */}
      {!collapsed && (
        <>
          <div className="mx-4 h-px bg-slate-100 mb-4" />

          {/* ── Toelichting & Motivatie ── */}
          <div className="px-4 pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Toelichting &amp; Motivatie
            </p>
            <textarea
              value={guideline.description || ""}
              onChange={e => onChangeField("description", e.target.value)}
              placeholder="Waarom dit principe? Wat is de strategische motivatie?"
              rows={4}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 resize-y focus:outline-none focus:border-slate-400 placeholder:text-slate-300 leading-relaxed"
            />
          </div>

          {/* ── Stop · Start · Continue ── */}
          <div className="px-4 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Stop · Start · Continue
              </p>
              {guideline.title?.trim() && (
                <button
                  onClick={onGenerateImplications}
                  disabled={implLoading}
                  className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-[var(--color-primary)] border border-slate-200 hover:border-[var(--color-primary)]/30 rounded-md px-2 py-1 transition-colors disabled:opacity-40"
                  title="AI Stop/Start/Continue genereren"
                >
                  <AiIcon variant="improve" size={9} />
                  {implLoading ? "…" : "AI"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "stop",     label: "Stop",     cls: "text-red-500",   bg: "bg-red-50",   border: "border-red-100",   focus: "focus:border-red-300"   },
                { key: "start",    label: "Start",    cls: "text-green-600", bg: "bg-green-50", border: "border-green-100", focus: "focus:border-green-300" },
                { key: "continue", label: "Continue", cls: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-100",  focus: "focus:border-blue-300"  },
              ].map(({ key, label, cls, bg, border, focus }) => (
                <div key={key}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${cls}`}>
                    {label}
                  </p>
                  <textarea
                    value={impl[key] || ""}
                    onChange={e => onChangeImplication(key, e.target.value)}
                    placeholder={`${label}…`}
                    className={`w-full text-sm text-slate-700 ${bg} border ${border} rounded-lg px-3 py-2 resize-y focus:outline-none ${focus} placeholder:text-slate-300 leading-relaxed`}
                    style={{ minHeight: "100px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

// ── Generate Draft Panel ───────────────────────────────────────────────────────
function GenerateDraftPanel({ draft, onAcceptOne, onAcceptAll, onReject }) {
  if (!draft) return null;
  return (
    <div className="mx-4 mt-4 border border-amber-300 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between bg-amber-50 px-4 py-2.5 border-b border-amber-200">
        <span className="text-xs font-black uppercase tracking-widest text-amber-700">
          {draft.loading
            ? `🪄 ${draft.msg}`
            : `🪄 ${(draft.guidelines || []).length} principes voorgesteld`}
        </span>
        {!draft.loading && (
          <div className="flex gap-1.5">
            <button onClick={onAcceptAll}
              className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md px-2.5 py-1 transition-colors">
              Alle toevoegen
            </button>
            <button onClick={onReject}
              className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md px-2.5 py-1 transition-colors">
              Weggooien
            </button>
          </div>
        )}
      </div>
      {draft.loading && (
        <div className="px-4 py-3 text-sm text-amber-700 animate-pulse bg-white">{draft.msg}</div>
      )}
      {!draft.loading && (draft.error
        ? <p className="px-4 py-3 text-sm text-red-500 bg-white">{draft.error}</p>
        : (draft.guidelines || []).map((g, i) => (
            <div key={i}
              className="group flex items-start gap-3 px-4 py-3 bg-white hover:bg-amber-50/40 border-b border-amber-100 last:border-0 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700 leading-snug">{g.title}</p>
                {g.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{g.description}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                <button onClick={() => onAcceptOne(i)}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md px-2 py-1 transition-colors">
                  ✓
                </button>
                <button onClick={() => onReject(i)}
                  className="text-xs text-slate-400 hover:text-red-400 bg-slate-50 hover:bg-red-50 rounded-md px-1.5 py-1 transition-colors">
                  ×
                </button>
              </div>
            </div>
          ))
      )}
    </div>
  );
}

// ── SwimLane — kolom met sticky header en column-scroll ────────────────────────
function SwimLane({
  segment, guidelines, themas,
  onAdd, onDelete, onChangeField, onChangeImplication, onToggleTheme,
  onGenerate, generateDraft, onAcceptOneDraft, onAcceptAllDraft, onRejectDraft,
  implLoadings, onGenerateImplications,
}) {
  return (
    <div className="rounded-2xl bg-white overflow-y-auto shadow-sm border border-slate-200/80">

      {/* T3: Sticky kolomheader verwijderd — categorie-naam + Genereer-knop
          zitten nu in werkblad-tab-balk (één laag hoger). SwimLane is body-only. */}

      {/* Draft panel */}
      <GenerateDraftPanel
        draft={generateDraft}
        onAcceptOne={onAcceptOneDraft}
        onAcceptAll={onAcceptAllDraft}
        onReject={onRejectDraft}
      />

      {/* Kaarten — natural height, geen flex-1 */}
      <div className="p-4 space-y-4">
        {guidelines.map(g => (
          <GuidelineKaart
            key={g.id}
            guideline={g}
            themas={themas}
            segment={segment}
            onChangeField={(field, val)   => onChangeField(g.id, field, val)}
            onChangeImplication={(sk, val) => onChangeImplication(g.id, sk, val)}
            onToggleTheme={themaId         => onToggleTheme(g.id, themaId)}
            onDelete={()                   => onDelete(g.id)}
            implLoading={!!implLoadings[g.id]}
            onGenerateImplications={()     => onGenerateImplications(g.id)}
          />
        ))}
        {guidelines.length === 0 && !generateDraft && (
          <div className="py-10 text-center">
            <div className="text-3xl mb-3 opacity-20">✦</div>
            <p className="text-sm text-slate-400 font-medium">Nog geen principes</p>
            <p className="text-xs text-slate-300 mt-1">
              Klik 🪄 Genereer voor AI-voorstellen<br />of voeg er handmatig een toe
            </p>
          </div>
        )}
      </div>

      {/* Toevoeg-knop — direct onder laatste kaart */}
      <div className="px-4 pb-6">
        <button
          onClick={onAdd}
          className="w-full py-3 text-sm font-semibold text-slate-400 hover:text-slate-600 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-2 transition-colors bg-white/80 hover:bg-white"
        >
          <Plus size={14} /> Principe toevoegen
        </button>
      </div>
    </div>
  );
}

// ── RichtlijnenWerkblad (main export) ─────────────────────────────────────────
export default function RichtlijnenWerkblad({ canvasId, onClose }) {
  const { t, lang, setLang }                   = useLang();
  const { user, signOut }                      = useAuth();
  const { prompt: appPrompt, label: appLabel } = useAppConfig();

  const [mounted,  setMounted]  = useState(false);
  // S3 design-systeem — Over Platform Workbench dialog via overflow-menu
  const [showOverDialog, setShowOverDialog] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Data state
  const [guidelines, setGuidelines] = useState([]);
  const [themas,     setThemas]     = useState([]);
  const [core,       setCore]       = useState({ missie: "", visie: "", ambitie: "", kernwaarden: [], samenvatting: "" });
  const [canvasName, setCanvasName] = useState("");

  // AI overlay state
  const [showAdvies,      setShowAdvies]      = useState(false);
  const [showOnePager,    setShowOnePager]    = useState(false);
  const [analysis,        setAnalysis]        = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError,   setAnalysisError]   = useState(null);

  // Per-segment generate drafts: { [segKey]: { loading, msg, guidelines[], error? } }
  const [generateDrafts, setGenerateDrafts] = useState({});

  // T3 — actief segment voor categorie-tabs-pattern (was: alle 4 segmenten
  // naast elkaar als kolommen). Default = generiek.
  const [activeSegment, setActiveSegment] = useState("generiek");

  // Per-guideline implications loading: { [id]: bool }
  const [implLoadings, setImplLoadings] = useState({});

  // Auto-link thema's loading
  const [linkingThemes, setLinkingThemes] = useState(false);

  // Debounce refs
  const guidelinesRef  = useRef([]);
  const pendingUpdates = useRef({});
  const saveTimers     = useRef({});

  useEffect(() => { guidelinesRef.current = guidelines; }, [guidelines]);

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Load all data — canoniek patroon (CLAUDE.md 4.3)
  useEffect(() => {
    const activeCanvasId = canvasId;   // capture vóór de async sprong
    let cancelled = false;             // race-guard 1: unmount / effect re-run

    // Reset vóór fetch — geen ghost data van vorig canvas
    setIsLoaded(false);
    setGuidelines([]);
    setThemas([]);
    setCore({ missie: "", visie: "", ambitie: "", kernwaarden: [], samenvatting: "" });
    setAnalysis(null);
    setCanvasName("");

    if (!activeCanvasId) { setIsLoaded(true); return; }

    Promise.all([
      loadGuidelines(activeCanvasId),
      loadStrategicThemes(activeCanvasId),
      loadStrategyCore(activeCanvasId),
      loadGuidelineAnalysis(activeCanvasId),
      loadCanvasById(activeCanvasId),
    ]).then(([
      { data: gl, error: glErr },
      { data: th, error: thErr },
      { data: co, error: coErr },
      { data: ga },
      { data: cv },
    ]) => {
      if (cancelled) return;                      // race-guard 1
      if (activeCanvasId !== canvasId) return;    // race-guard 2: canvas gewisseld tijdens fetch

      if (glErr) console.error("[RichtlijnenWerkblad] guidelines laden:", glErr.message);
      if (thErr) console.error("[RichtlijnenWerkblad] themas laden:",     thErr.message);
      if (coErr) console.error("[RichtlijnenWerkblad] core laden:",       coErr.message);

      setGuidelines(gl || []);
      setThemas(th || []);
      if (co) setCore({ missie: co.missie || "", visie: co.visie || "", ambitie: co.ambitie || "", kernwaarden: co.kernwaarden || [], samenvatting: co.samenvatting || "" });
      if (ga?.recommendations) setAnalysis(ga.recommendations);
      if (cv?.name) setCanvasName(cv.name);
      setIsLoaded(true);
    });

    return () => { cancelled = true; };           // cleanup: markeer als afgebroken
  }, [canvasId]);

  // ── Debounced save ────────────────────────────────────────────────────────
  const scheduleDbSave = useCallback((id, patch) => {
    pendingUpdates.current[id] = { ...(pendingUpdates.current[id] || {}), ...patch };
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      const updates = pendingUpdates.current[id];
      delete pendingUpdates.current[id];
      if (updates) await updateGuideline(id, updates);
    }, 800);
  }, []);

  // ── Field handlers ────────────────────────────────────────────────────────
  const handleChangeField = useCallback((id, field, value) => {
    setGuidelines(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    scheduleDbSave(id, { [field]: value });
  }, [scheduleDbSave]);

  const handleChangeImplication = useCallback((id, subKey, value) => {
    setGuidelines(prev => prev.map(g => {
      if (g.id !== id) return g;
      const newImpl = { ...(g.implications || EMPTY_IMPL), [subKey]: value };
      scheduleDbSave(id, { implications: newImpl });
      return { ...g, implications: newImpl };
    }));
  }, [scheduleDbSave]);

  const handleToggleTheme = useCallback((id, themaId) => {
    setGuidelines(prev => prev.map(g => {
      if (g.id !== id) return g;
      const current   = Array.isArray(g.linked_themes) ? g.linked_themes : [];
      const newLinked = current.includes(themaId)
        ? current.filter(x => x !== themaId)
        : [...current, themaId];
      scheduleDbSave(id, { linked_themes: newLinked });
      return { ...g, linked_themes: newLinked };
    }));
  }, [scheduleDbSave]);

  // ── Add / Delete ──────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (segment) => {
    // Gebruik huidige count als sort_order — NOOIT Date.now() (int overflow)
    const sortOrder = guidelinesRef.current.filter(g => g.segment === segment).length;
    const { data, error } = await createGuideline(canvasId, segment, sortOrder);
    if (error) { console.error("[handleAdd]", error.message || error); return; }
    if (data)  setGuidelines(prev => [...prev, data]);
  }, [canvasId]);

  const handleDelete = useCallback(async (id) => {
    clearTimeout(saveTimers.current[id]);
    delete pendingUpdates.current[id];
    await deleteGuideline(id);
    setGuidelines(prev => prev.filter(g => g.id !== id));
  }, []);

  // ── AI: Generate per segment ──────────────────────────────────────────────
  const handleGenerate = useCallback(async (segKey) => {
    const msg = GENERATE_MSGS[Math.floor(Math.random() * GENERATE_MSGS.length)];
    setGenerateDrafts(prev => ({ ...prev, [segKey]: { loading: true, msg, guidelines: [] } }));
    try {
      const res  = await apiFetch("/api/guidelines", {
        method: "POST",
        body: JSON.stringify({
          mode: "generate", segment: segKey, core, themas,
          systemPromptGenerate: appPrompt("guideline.generate") || undefined,
          languageInstruction: t("ai.language"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      setGenerateDrafts(prev => ({ ...prev, [segKey]: { loading: false, msg, guidelines: data.guidelines || [] } }));
    } catch (err) {
      setGenerateDrafts(prev => ({ ...prev, [segKey]: { loading: false, msg, guidelines: [], error: err.message } }));
    }
  }, [core, themas, appPrompt, t]);

  const handleAcceptOneDraft = useCallback(async (segKey, idx) => {
    const draft = generateDrafts[segKey];
    if (!draft) return;
    const g         = draft.guidelines[idx];
    const sortOrder = guidelinesRef.current.filter(x => x.segment === segKey).length;
    const { data, error } = await createGuideline(canvasId, segKey, sortOrder);
    if (error) { console.error("[acceptOne]", error.message || error); return; }
    if (data) {
      const patch = { title: g.title || "", description: g.description || "", implications: g.implications || EMPTY_IMPL };
      await updateGuideline(data.id, patch);
      setGuidelines(prev => [...prev, { ...data, ...patch }]);
    }
    setGenerateDrafts(prev => ({
      ...prev,
      [segKey]: { ...prev[segKey], guidelines: prev[segKey].guidelines.filter((_, i) => i !== idx) },
    }));
  }, [canvasId, generateDrafts]);

  const handleAcceptAllDraft = useCallback(async (segKey) => {
    const draft = generateDrafts[segKey];
    if (!draft) return;
    let count = guidelinesRef.current.filter(x => x.segment === segKey).length;
    for (const g of draft.guidelines) {
      const { data, error } = await createGuideline(canvasId, segKey, count);
      if (error) { console.error("[acceptAll]", error.message || error); continue; }
      if (data) {
        const patch = { title: g.title || "", description: g.description || "", implications: g.implications || EMPTY_IMPL };
        await updateGuideline(data.id, patch);
        setGuidelines(prev => [...prev, { ...data, ...patch }]);
        count++;
      }
    }
    setGenerateDrafts(prev => { const n = { ...prev }; delete n[segKey]; return n; });
  }, [canvasId, generateDrafts]);

  const handleRejectDraft = useCallback((segKey) => {
    setGenerateDrafts(prev => { const n = { ...prev }; delete n[segKey]; return n; });
  }, []);

  // ── AI: Implications per kaart ────────────────────────────────────────────
  const handleGenerateImplications = useCallback(async (id) => {
    const g = guidelinesRef.current.find(x => x.id === id);
    if (!g?.title?.trim()) return;
    setImplLoadings(prev => ({ ...prev, [id]: true }));
    try {
      const res  = await apiFetch("/api/guidelines", {
        method: "POST",
        body: JSON.stringify({
          mode: "implications", title: g.title, description: g.description, context: core.ambitie,
          systemPromptImplications: appPrompt("guideline.implications") || undefined,
          languageInstruction: t("ai.language"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      const newImpl = { stop: data.stop || "", start: data.start || "", continue: data.continue || "" };
      // Gebruik handleChangeImplication per subKey zodat debounce correct accumuleert
      setGuidelines(prev => prev.map(x => {
        if (x.id !== id) return x;
        scheduleDbSave(id, { implications: newImpl });
        return { ...x, implications: newImpl };
      }));
    } catch (err) {
      console.error("[impl AI]", err.message);
    } finally {
      setImplLoadings(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }, [core.ambitie, appPrompt, t, scheduleDbSave]);

  // ── AI: Advies modal ──────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res  = await apiFetch("/api/guidelines", {
        method: "POST",
        body: JSON.stringify({
          mode: "advies", guidelines, themas, core,
          systemPromptAdvies: appPrompt("guideline.advies") || undefined,
          languageInstruction: t("ai.language"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      const recs = data.recommendations || [];
      setAnalysis(recs);
      await upsertGuidelineAnalysis(canvasId, recs);
    } catch (e) {
      setAnalysisError(e.message);
    } finally {
      setAnalysisLoading(false);
    }
  }, [guidelines, themas, core, canvasId, appPrompt, t]);

  // ── AI: Auto-link principes aan strategische thema's ─────────────────────
  const handleLinkThemes = useCallback(async () => {
    if (!themas.length || !guidelines.length) return;
    setLinkingThemes(true);
    try {
      const res  = await apiFetch("/api/guidelines", {
        method: "POST",
        body: JSON.stringify({
          mode: "link_themes",
          guidelines: guidelines.map(g => ({ id: g.id, title: g.title, description: g.description, segment: g.segment })),
          themas: themas.map(th => ({ id: th.id, title: th.title })),
          systemPromptLinkThemes: appPrompt("guideline.link_themes") || undefined,
          languageInstruction: t("ai.language"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      const { links } = data;
      // Pas toe: voeg AI-links samen met bestaande (verwijder nooit bestaande koppelingen)
      setGuidelines(prev => prev.map(g => {
        const suggested = links[g.id];
        if (!suggested || suggested.length === 0) return g;
        const existing = Array.isArray(g.linked_themes) ? g.linked_themes : [];
        const merged   = [...new Set([...existing, ...suggested])];
        if (merged.length === existing.length && merged.every(id => existing.includes(id))) return g; // geen wijziging
        scheduleDbSave(g.id, { linked_themes: merged });
        return { ...g, linked_themes: merged };
      }));
    } catch (err) {
      console.error("[linkThemes]", err.message);
    } finally {
      setLinkingThemes(false);
    }
  }, [guidelines, themas, t, appPrompt, scheduleDbSave]);

  // ── Per-segment memoized handlers ─────────────────────────────────────────
  const segmentHandlers = useMemo(() =>
    SEGMENTS.reduce((acc, seg) => ({
      ...acc,
      [seg.key]: {
        onAdd:            ()    => handleAdd(seg.key),
        onGenerate:       ()    => handleGenerate(seg.key),
        onAcceptOneDraft: (idx) => handleAcceptOneDraft(seg.key, idx),
        onAcceptAllDraft: ()    => handleAcceptAllDraft(seg.key),
        onRejectDraft:    ()    => handleRejectDraft(seg.key),
      },
    }), {}),
  [handleAdd, handleGenerate, handleAcceptOneDraft, handleAcceptAllDraft, handleRejectDraft]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50 items-center justify-center">
        <Wand2 size={28} className="text-[var(--color-accent)] animate-pulse mx-auto" />
        <p className="text-sm text-slate-500 mt-3">Richtlijnen laden…</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-slate-50 transition-all duration-300 ease-out
      ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

      {/* S3 design-systeem — drie-lagen-WerkbladHeader (geen laag 3).
          Laag 1 vol-gevuld met logo + appTitle + versie-pill + lang-switch +
          overflow-menu (analoog aan S2 Strategie).
          Laag 2 categorie-leigrijs 3px bottom-border + Compass-tile + Inzichten
          + Rapportage (Analyse-knop verhuisd naar Inzichten-overlay per
          designer §7 punt 2 — `handleAnalyze` blijft in scope, gebruikt door
          inline-showAdvies-block onderaan deze component). */}
      <WerkbladHeader
        categorie="richtlijnen"
        icon={Compass}
        capsLabel="Werkblad"
        titel="Richtlijnen & Leidende Principes"
        onClose={onClose}
        showLogo
        appTitle={appLabel("app.title", "Business Transformation Workbench")}
        versie={process.env.REACT_APP_VERSION || "0.1.0"}
        lang={lang}
        onLangSwitch={() => setLang(lang === "nl" ? "en" : "nl")}
        overflowItems={[
          {
            id: "admin",
            label: "App config",
            icon: Settings,
            onClick: () => { window.location.href = "/admin"; },
            hidden: user?.email !== process.env.REACT_APP_ADMIN_EMAIL,
          },
          {
            id: "over",
            label: "Over Platform Workbench",
            icon: Info,
            onClick: () => setShowOverDialog(true),
            divider: true,
          },
          {
            id: "uitloggen",
            label: "Uitloggen",
            icon: LogOut,
            onClick: signOut,
            divider: true,
            danger: true,
          },
        ]}
        actieknoppen={
          <WerkbladActieknoppen
            onBekijken={() => setShowAdvies(true)}
            onRapportage={() => setShowOnePager(true)}
            bekijkenDisabled={false}
            appLabel={appLabel}
          />
        }
      />

      {/* ── Context strip — drie panelen ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-5">
        <div className="grid grid-cols-3 gap-4" style={{ height: "16rem" }}>

          {/* Paneel 1: Strategische samenvatting (max 2 zinnen, was "Stip op de Horizon" tot T3) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col overflow-hidden">
            <p
              data-testid="richtl-samenvatting-titel"
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-primary)] mb-2.5 flex-shrink-0"
            >
              {appLabel("richtl.samenvatting.titel", "Strategische samenvatting")}
            </p>
            {(core.samenvatting || core.ambitie) ? (
              <p className="text-sm font-semibold text-[var(--color-primary)] leading-snug flex-1 overflow-y-auto pr-1">
                {core.samenvatting || core.ambitie}
              </p>
            ) : (
              <p className="text-xs italic text-slate-300 flex-1">
                Vul de Strategische Samenvatting in het Strategie Werkblad in — max. 2 zinnen over waar de organisatie over 3 jaar staat.
              </p>
            )}
            {core.kernwaarden?.length > 0 && (
              <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 flex-shrink-0 truncate">
                {core.kernwaarden.slice(0, 4).join(" · ")}
              </p>
            )}
          </div>

          {/* Paneel 2: Strategische Thema's */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-primary)]">
                Strategische Thema's
              </p>
              {themas.length > 0 && guidelines.length > 0 && (
                <button
                  onClick={handleLinkThemes}
                  disabled={linkingThemes}
                  title="AI koppelt alle principes automatisch aan de meest passende thema's"
                  className="flex items-center gap-1 text-[9px] font-bold text-[var(--color-primary)]/50 hover:text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/40 rounded-md px-2 py-1 transition-colors disabled:opacity-40"
                >
                  <AiIcon variant="improve" size={9} />
                  {linkingThemes ? "Bezig…" : "Auto-link"}
                </button>
              )}
            </div>
            {themas.length === 0 ? (
              <p className="text-xs text-slate-300 italic">Geen thema's — voeg ze toe in het Strategie Werkblad</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {themas.map((th, i) => (
                  <div key={th.id} className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-700 font-medium leading-tight">{th.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paneel 3: Uitleg werkwijze */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col overflow-hidden">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-primary)] mb-2.5 flex-shrink-0">
              Werkwijze
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-2.5 flex-shrink-0">
              Leidende principes vertalen de strategie naar concreet dagelijks gedrag. Ze sturen keuzes
              en creëren consistentie. Schrijf ze in de volgende volgorde:
            </p>
            <div className="space-y-1.5 flex-1">
              {[
                { Icon: BookOpen,  color: "text-[var(--color-primary)]",  bg: "bg-[var(--color-primary)]/8",  title: "Formuleer principes",    desc: "Titel en strategische motivatie" },
                { Icon: Link2,     color: "text-[var(--color-accent)]",  bg: "bg-[var(--color-accent)]/10", title: "Koppel thema's",         desc: "Klik de nummerbadges"            },
                { Icon: RotateCcw, color: "text-orange-500", bg: "bg-orange-50",    title: "Stop · Start · Continue", desc: "Vertaal naar concreet gedrag"    },
              ].map(({ Icon, color, bg, title, desc }) => (
                <div key={title} className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={12} className={color} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-700">{title}</span>
                    <span className="text-xs text-slate-400 ml-1.5">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── T3: categorie-tabs-balk ────────────────────────────────────────
          5 tabs (Generiek/Klanten/Processen/Mensen/IT) + counter-pill per tab +
          actieve onderlijn in categorie-kleur. Rechts: Genereer-AI-knop voor
          het actieve segment (was tot T3 per-kolom in SwimLane-header). */}
      <div
        data-testid="richtl-tab-balk"
        className="flex-shrink-0 flex items-center bg-white border-b border-slate-200 px-6 pt-2 gap-1 overflow-x-auto"
      >
        {SEGMENTS.map(seg => {
          const label = appLabel(`richtl.segment.${seg.key}`, seg.label);
          const count = guidelines.filter(g => g.segment === seg.key).length;
          const isActive = activeSegment === seg.key;
          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => setActiveSegment(seg.key)}
              data-testid={`richtl-tab-${seg.key}`}
              data-active={isActive ? "true" : "false"}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "text-[var(--color-primary)] font-semibold"
                  : "text-neutral-500 hover:text-[var(--color-primary)]"
              }`}
              style={isActive ? { marginBottom: "-1px" } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: `var(${seg.colorVar})` }}
                aria-hidden="true"
              />
              <span>{label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-bold leading-none ${
                  isActive ? "text-white" : "bg-neutral-100 text-neutral-600"
                }`}
                style={isActive ? { backgroundColor: `var(${seg.colorVar})` } : undefined}
                data-testid={`richtl-tab-count-${seg.key}`}
              >
                {count}
              </span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 bottom-0 h-[2px]"
                  style={{ backgroundColor: `var(${seg.colorVar})` }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
        {/* Genereer-knop voor active-segment */}
        <div className="ml-auto pr-2">
          {(() => {
            const seg = SEGMENTS.find(s => s.key === activeSegment);
            const handlers = segmentHandlers[activeSegment];
            const draft = generateDrafts[activeSegment];
            return (
              <button
                type="button"
                onClick={handlers?.onGenerate}
                disabled={draft?.loading}
                data-testid={`richtl-tab-generate-${activeSegment}`}
                title={`AI principes genereren voor ${appLabel(`richtl.segment.${activeSegment}`, seg?.label)}`}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <AiIcon variant="generate" size={12} />
                {draft?.loading ? "Genereren…" : "Genereer principes"}
              </button>
            );
          })()}
        </div>
      </div>

      {/* T3: info-banner voor actief segment — contextuele uitleg + click-hint */}
      {(() => {
        const seg = SEGMENTS.find(s => s.key === activeSegment);
        if (!seg) return null;
        const info = appLabel(`tips.richtlijnen.${activeSegment}.info`, "");
        if (!info) return null;
        return (
          <div
            data-testid={`richtl-info-banner-${activeSegment}`}
            className="flex-shrink-0 px-6 py-3 text-xs leading-relaxed border-b border-slate-200"
            style={{
              backgroundColor: `var(${seg.lightVar})`,
              color: `var(${seg.colorVar})`,
            }}
          >
            {info}
          </div>
        );
      })()}

      {/* ── T3: body — alleen actieve segment renderen (was: alle 4 in grid) ── */}
      <div className="flex-1 overflow-auto p-4 bg-slate-100">
        {SEGMENTS.filter(seg => seg.key === activeSegment).map(seg => {
          const resolvedSeg = {
            ...seg,
            label:    appLabel(`richtl.segment.${seg.key}`,     seg.label),
            sublabel: appLabel(`richtl.segment.${seg.key}.sub`, seg.sublabel),
          };
          const segGuidelines = guidelines.filter(g => g.segment === seg.key);
          const handlers      = segmentHandlers[seg.key];
          return (
            <SwimLane
              key={seg.key}
              segment={resolvedSeg}
              guidelines={segGuidelines}
              themas={themas}
              generateDraft={generateDrafts[seg.key]}
              implLoadings={implLoadings}
              onAdd={handlers.onAdd}
              onDelete={handleDelete}
              onChangeField={handleChangeField}
              onChangeImplication={handleChangeImplication}
              onToggleTheme={handleToggleTheme}
              onGenerate={handlers.onGenerate}
              onAcceptOneDraft={handlers.onAcceptOneDraft}
              onAcceptAllDraft={handlers.onAcceptAllDraft}
              onRejectDraft={handlers.onRejectDraft}
              onGenerateImplications={handleGenerateImplications}
            />
          );
        })}
      </div>

      {/* ── ✨ Advies overlay ── */}
      {showAdvies && (
        <div className="fixed inset-0 z-[59] flex flex-col bg-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 bg-[var(--color-primary)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <AiIcon variant="generate" size={12} colorClass="text-[var(--color-accent)]" />
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                Richtlijnen Advies
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={analysisLoading}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] text-xs font-black uppercase tracking-widest rounded-md transition-colors disabled:opacity-50"
              >
                {analysisLoading ? <RefreshCw size={13} className="animate-spin" /> : <AiIcon variant="generate" size={13} />}
                {analysisLoading ? "Analyseren…" : analysis ? "Opnieuw analyseren" : "Analyseer richtlijnen"}
              </button>
              <button onClick={() => setShowAdvies(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <div className="w-full max-w-5xl">
              {analysisError && <p className="text-red-500 text-sm italic mb-4">{analysisError}</p>}
              {analysisLoading && (
                <p className="text-slate-400 text-sm italic animate-pulse pt-8 text-center">
                  AI analyseert coherentie, segment-balans en strategische dekking…
                </p>
              )}
              {!analysisLoading && analysis && analysis.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.map((rec, i) => {
                    const cm = {
                      warning: { border: "border-orange-200", title: "text-orange-700", text: "text-orange-800" },
                      info:    { border: "border-blue-200",   title: "text-blue-700",   text: "text-blue-800"   },
                      success: { border: "border-green-200",  title: "text-green-700",  text: "text-green-800"  },
                    };
                    const c = cm[rec.type] || cm.info;
                    return (
                      <div key={i} className={`rounded-xl border ${c.border} border-l-4 p-5 bg-white shadow-sm`}>
                        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${c.title}`}>
                          {rec.title}
                        </p>
                        <p className={`text-sm leading-relaxed ${c.text}`}>{rec.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {!analysisLoading && !analysis && !analysisError && (
                <div className="flex items-center justify-center h-64">
                  <p className="text-slate-400 text-sm italic text-center max-w-sm">
                    Klik "Analyseer richtlijnen" voor AI-inzichten over coherentie,
                    segment-balans en strategische dekking van uw thema's.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="text-center py-2 text-[9px] text-slate-400 uppercase tracking-widest flex-shrink-0">
            AI-analyse op basis van alle leidende principes · opgeslagen per canvas
          </div>
        </div>
      )}

      {/* ── 📄 OnePager overlay ── */}
      {showOnePager && (
        <Suspense fallback={null}>
          <GuidelinesOnePager
            guidelines={guidelines}
            themas={themas}
            core={core}
            canvasName={canvasName}
            onClose={() => setShowOnePager(false)}
          />
        </Suspense>
      )}

      {/* S3 — Over Platform Workbench dialog via WerkbladHeader-overflow-menu */}
      {showOverDialog && (
        <OverDialog onClose={() => setShowOverDialog(false)} />
      )}
    </div>
  );
}
