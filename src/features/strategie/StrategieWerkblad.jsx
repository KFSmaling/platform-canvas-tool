import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { Wand2, Trash2, Plus, X, ArrowLeft, Zap, Crosshair, Info, Settings, LogOut } from "lucide-react";
import AiIcon from "../../shared/components/AiIcon";
import WerkbladActieknoppen from "../../shared/components/WerkbladActieknoppen";
import WerkbladHeader from "../../shared/components/WerkbladHeader";
import WerkbladTipsModal from "../../shared/components/WerkbladTipsModal";
import OverDialog from "../../shared/components/OverDialog";
import { apiFetch } from "../../shared/services/apiClient";
import { useLang } from "../../i18n";
import { useAuth } from "../../shared/services/auth.service";
import { useAppConfig } from "../../shared/context/AppConfigContext";
import WandButton from "../../shared/components/WandButton";
import MagicResult from "../../shared/components/MagicResult";
import TagPill, { EXTERN_TAGS, INTERN_TAGS } from "../../shared/components/TagPill";
import InzichtenOverlay from "../../shared/components/inzichten/InzichtenOverlay";
import RapportageMenu from "../../shared/components/rapportage/RapportageMenu";
import OnepagerBuilder from "../../shared/components/rapportage/OnepagerBuilder";
import { buildStrategieRapportageConfig } from "./strategieRapportageConfig";
import { updateInsight } from "./services/insight.service";
import {
  loadStrategyCore,
  loadCanvasName,
  upsertStrategyCore,
  loadAnalysisItems,
  upsertAnalysisItem,
  changeAnalysisItemTag,
  deleteAnalysisItem,
  loadStrategicThemes,
  upsertStrategicTheme,
  deleteStrategicTheme,
  upsertKsfKpi,
  deleteKsfKpi,
} from "./services/strategy.service";
import { searchDocumentChunks } from "../../shared/services/embedding.service";

const StrategyOnePager = lazy(() => import("./StrategyOnePager"));

/** KSF/KPI tabel-rij — KSF heeft geen Huidig/Target */
const KsfKpiRow = React.memo(function KsfKpiRow({ item, type, onChange, onDelete }) {
  const isKsf = type === "ksf";
  return (
    <div className={`grid ${isKsf ? "grid-cols-[1fr_20px]" : "grid-cols-[1fr_90px_90px_20px]"} gap-1.5 items-center group`}>
      <input value={item.description} onChange={e => onChange({ ...item, description: e.target.value })}
        placeholder="Omschrijving…"
        className="text-sm bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-[var(--color-primary)]/40" />
      {!isKsf && (
        <input value={item.current_value} onChange={e => onChange({ ...item, current_value: e.target.value })}
          placeholder="Huidig"
          className="text-sm bg-white border border-slate-200 rounded px-2 py-2 text-slate-500 placeholder:text-slate-300 focus:outline-none focus:border-[var(--color-primary)]/40 text-center" />
      )}
      {!isKsf && (
        <input value={item.target_value} onChange={e => onChange({ ...item, target_value: e.target.value })}
          placeholder="Target"
          className="text-sm bg-white border border-slate-200 rounded px-2 py-2 text-[var(--color-success)] placeholder:text-slate-300 focus:outline-none focus:border-[var(--color-success)]/40 text-center font-semibold" />
      )}
      <button onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity">
        <X size={12} />
      </button>
    </div>
  );
});

const KSF_KPI_LOADING_MSGS = [
  "Balanced Scorecard aan het kalibreren…",
  "SMART-criteria toepassen op uw ambities…",
  "KPI's formuleren die de CFO ook begrijpt…",
  "Succescriteria uitvinden die niet alleen in theorie werken…",
  "McKinsey-kwaliteit benchmarken tegen eigen targets…",
];

/** Strategisch Thema accordeon met KSF/KPI tabel */
const ThemaAccordeon = React.memo(function ThemaAccordeon({ thema, index, onTitleChange, onDelete, onAddKsfKpi, onUpdateKsfKpi, onDeleteKsfKpi, onGenerateKsfKpi, ksfKpiDraft, onAcceptKsfKpiDraft, onRejectKsfKpiDraft, onRemoveDraftItem }) {
  const [open, setOpen] = useState(index === 0);
  const ksfs = (thema.ksf_kpi || []).filter(k => k.type === "ksf").sort((a,b) => a.sort_order - b.sort_order);
  const kpis = (thema.ksf_kpi || []).filter(k => k.type === "kpi").sort((a,b) => a.sort_order - b.sort_order);
  const loadingMsg = ksfKpiDraft?.loadingMsg || KSF_KPI_LOADING_MSGS[0];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-black text-[var(--color-primary)]/60 uppercase tracking-widest w-5 flex-shrink-0">{index + 1}</span>
        <input
          value={thema.title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder={`Strategisch Thema ${index + 1}…`}
          className="flex-1 text-base font-semibold text-slate-700 bg-transparent border-none focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
        />
        {/* KSF/KPI genereren knop */}
        {onGenerateKsfKpi && thema.title?.trim() && (
          <button
            onClick={() => { if (!ksfKpiDraft?.loading) { setOpen(true); onGenerateKsfKpi(); } }}
            disabled={ksfKpiDraft?.loading}
            title="KSF & KPI genereren op basis van dit thema"
            className="flex items-center gap-1 text-[9px] font-bold text-[var(--color-accent)] hover:text-[var(--color-success)] border border-[var(--color-accent)]/40 hover:border-[var(--color-success)]/60 rounded-md px-2 py-1 transition-colors disabled:opacity-50 flex-shrink-0">
            <AiIcon variant="improve" size={10} />
            {ksfKpiDraft?.loading ? "…" : "KSF & KPI"}
          </button>
        )}
        <button onClick={() => setOpen(o => !o)}
          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"
            className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2 4l5 6 5-6H2z" />
          </svg>
        </button>
        <button onClick={onDelete}
          className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="px-8 py-6 space-y-6">

          {/* KSF/KPI Draft panel — volle breedte */}
          {ksfKpiDraft && (
            <div className="border border-amber-300 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-amber-50 px-3 py-2 border-b border-amber-200">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                  {ksfKpiDraft.loading ? "🪄 " + loadingMsg : `🪄 AI Voorstel — ${(ksfKpiDraft.ksf||[]).length} KSF's + ${(ksfKpiDraft.kpi||[]).length} KPI's`}
                </span>
                {!ksfKpiDraft.loading && (
                  <div className="flex gap-2">
                    <button onClick={onAcceptKsfKpiDraft}
                      className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded px-2 py-0.5 transition-colors">
                      Alles toevoegen
                    </button>
                    <button onClick={onRejectKsfKpiDraft}
                      className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors">
                      Weggooien
                    </button>
                  </div>
                )}
              </div>
              {ksfKpiDraft.loading && (
                <div className="px-4 py-3 text-xs text-amber-700 animate-pulse">
                  {loadingMsg}
                </div>
              )}
              {!ksfKpiDraft.loading && (
                <div className="divide-y divide-amber-100">
                  {/* KSF preview */}
                  {(ksfKpiDraft.ksf || []).map((k, i) => (
                    <div key={`ksf-${i}`} className="group grid grid-cols-[20px_1fr_20px] gap-2 items-center px-3 py-2 bg-white hover:bg-amber-50/30 transition-colors">
                      <span className="text-[8px] font-black text-[var(--color-primary)]/50 uppercase">KSF</span>
                      <span className="text-xs text-slate-700">{k.description}</span>
                      <button onClick={() => onRemoveDraftItem?.("ksf", i)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {/* KPI preview */}
                  {(ksfKpiDraft.kpi || []).map((k, i) => (
                    <div key={`kpi-${i}`} className="group grid grid-cols-[20px_1fr_90px_90px_20px] gap-2 items-center px-3 py-2 bg-white hover:bg-amber-50/30 transition-colors">
                      <span className="text-[8px] font-black text-[var(--color-success)]/70 uppercase">KPI</span>
                      <span className="text-xs text-slate-700">{k.description}</span>
                      <span className="text-xs text-slate-400 text-center">{k.current_value || "—"}</span>
                      <span className="text-xs text-[var(--color-success)] font-semibold text-center">{k.target_value || "—"}</span>
                      <button onClick={() => onRemoveDraftItem?.("kpi", i)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {(ksfKpiDraft.ksf || []).length === 0 && (ksfKpiDraft.kpi || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic px-4 py-3">Alle items verwijderd — klik Annuleer of genereer opnieuw.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* KSF + KPI naast elkaar */}
          <div className="grid grid-cols-2 gap-8">

            {/* KSF kolom */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-sm font-black uppercase tracking-widest text-[var(--color-primary)]">
                  KSF — Succesfactoren <span className="font-normal text-slate-400">({ksfs.length}/3)</span>
                </h5>
                {ksfs.length < 3 && (
                  <button onClick={() => onAddKsfKpi("ksf")}
                    className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-primary)]/70 flex items-center gap-1">
                    <Plus size={10} /> Toevoegen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_20px] gap-1.5 pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Omschrijving</span>
                <span />
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-60">
                {ksfs.map(k => (
                  <KsfKpiRow key={k.id} item={k} type="ksf"
                    onChange={updated => onUpdateKsfKpi(updated)}
                    onDelete={() => onDeleteKsfKpi(k.id)} />
                ))}
                {ksfs.length === 0 && <p className="text-[11px] text-slate-300 italic">Nog geen KSF's — klik Toevoegen of gebruik 🪄 KSF &amp; KPI</p>}
              </div>
            </div>

            {/* KPI kolom */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-sm font-black uppercase tracking-widest text-[var(--color-success)]">
                  KPI — Indicatoren <span className="font-normal text-slate-400">({kpis.length}/3)</span>
                </h5>
                {kpis.length < 3 && (
                  <button onClick={() => onAddKsfKpi("kpi")}
                    className="text-xs font-bold text-[var(--color-success)] hover:text-[var(--color-success)]/70 flex items-center gap-1">
                    <Plus size={10} /> Toevoegen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_90px_90px_20px] gap-1.5 pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Omschrijving</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Huidig</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-success)] text-center">Target</span>
                <span />
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-60">
                {kpis.map(k => (
                  <KsfKpiRow key={k.id} item={k} type="kpi"
                    onChange={updated => onUpdateKsfKpi(updated)}
                    onDelete={() => onDeleteKsfKpi(k.id)} />
                ))}
                {kpis.length === 0 && <p className="text-[11px] text-slate-300 italic">Nog geen KPI's — klik Toevoegen of gebruik 🪄 KSF &amp; KPI</p>}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
});

/** Analyse-lijst (extern of intern) met tagging */
function AnalyseSection({ title, type, items, onAdd, onDelete, onTagChange, onMagic, magicResult, onRejectMagic }) {
  const allowedTagKeys = type === "extern" ? EXTERN_TAGS : type === "intern" ? INTERN_TAGS : undefined;
  const [draft, setDraft] = useState("");
  const [proposedLines, setProposedLines] = useState([]);

  // Patroon voor paginaverwijzingen en losse kopjes die we willen wegfilteren
  const isNoise = (line) => {
    if (/^\[(slide|pagina|page|notes)\s+\d+\]/i.test(line)) return true;  // [Slide 7]
    if (/\[(slide|pagina|page|notes)\s+\d+\]$/i.test(line)) return true;  // tekst [Slide 7]
    if (/^(slide|pagina|page)\s+\d+$/i.test(line)) return true;           // "Slide 7"
    if (line.length < 12) return true;                                     // te kort = kopje
    if (/^[A-Z][A-Z\s&/–-]{8,}$/.test(line)) return true;                 // ALL CAPS kopje
    if (/^\d+[.)]\s/.test(line) && line.length < 20) return true;           // "1. Titel"
    return false;
  };

  // Zodra er een nieuwe magic suggestion binnenkomt: split op regels
  useEffect(() => {
    if (magicResult?.suggestion && !magicResult.loading) {
      const lines = magicResult.suggestion
        .split("\n")
        .map(l => l.trim().replace(/^[-•*]\s*/, ""))  // strip leading bullets
        .filter(l => l.length > 4 && !isNoise(l));
      setProposedLines(lines);
    } else if (!magicResult || magicResult.loading) {
      setProposedLines([]);
    }
  }, [magicResult?.suggestion, magicResult?.loading, magicResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const val = draft.trim();
    if (val) { onAdd(val); setDraft(""); }
  };

  const acceptLine = (i) => {
    onAdd(proposedLines[i]);
    setProposedLines(prev => prev.filter((_, j) => j !== i));
  };
  const acceptAll = () => {
    proposedLines.forEach(l => onAdd(l));
    setProposedLines([]);
    onRejectMagic?.();
  };
  const dismissAll = () => {
    setProposedLines([]);
    onRejectMagic?.();
  };

  const tagColors = {
    kans:          "border-l-emerald-400",
    sterkte:       "border-l-blue-400",
    bedreiging:    "border-l-red-400",
    zwakte:        "border-l-orange-400",
    niet_relevant: "border-l-slate-200",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-2 z-10">
        <h4 className="text-base font-semibold text-slate-700">{title}</h4>
        {onMagic && <WandButton onClick={onMagic} loading={magicResult?.loading} disabled={proposedLines.length > 0} />}
      </div>

      {/* Laden */}
      {magicResult?.loading && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 animate-pulse">
          Analyseren…
        </div>
      )}

      {/* Geen chunks */}
      {magicResult?.noChunks && (
        <div className="text-xs text-slate-400 italic px-1">Geen documenten gevonden voor dit veld.</div>
      )}

      {/* Voorgestelde items (regel-voor-regel) */}
      {proposedLines.length > 0 && (() => {
        const isGK = magicResult?.isGeneralKnowledge;
        const borderCls   = isGK ? "border-[var(--color-analysis)]/50"   : "border-amber-300";
        const headerBg    = isGK ? "bg-[var(--color-analysis)]/8"        : "bg-amber-50";
        const headerBdr   = isGK ? "border-[var(--color-analysis)]/30"   : "border-amber-200";
        const labelCls    = isGK ? "text-[var(--color-analysis)]"        : "text-amber-700";
        const dividerCls  = isGK ? "divide-[var(--color-analysis)]/15"   : "divide-amber-100";
        const hoverRowCls = isGK ? "hover:bg-[var(--color-analysis)]/5"  : "hover:bg-amber-50/40";
        return (
          <div className={`border ${borderCls} rounded-xl overflow-hidden`}>
            <div className={`flex items-center justify-between ${headerBg} px-3 py-2 border-b ${headerBdr}`}>
              <span className={`text-[9px] font-black uppercase tracking-widest ${labelCls}`}>
                {isGK ? "🌐 Algemene kennis" : "🪄 Voorstel"} — {proposedLines.length} item{proposedLines.length !== 1 ? "s" : ""}
                {isGK && <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">· geen Dossier gevonden</span>}
              </span>
              <div className="flex gap-1.5">
                <button onClick={acceptAll}
                  className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded px-2 py-0.5 transition-colors">
                  Alle toevoegen
                </button>
                <button onClick={dismissAll}
                  className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors">
                  Weggooien
                </button>
              </div>
            </div>
            <div className={`divide-y ${dividerCls}`}>
              {proposedLines.map((line, i) => (
                <div key={i} className={`group flex items-start gap-2 bg-white ${hoverRowCls} px-3 py-2 transition-colors`}>
                  <p className="flex-1 text-xs text-slate-700 leading-relaxed">{line}</p>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => acceptLine(i)}
                      title="Toevoegen"
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded px-1.5 py-0.5 transition-colors">
                      ✓
                    </button>
                    <button onClick={() => setProposedLines(prev => prev.filter((_, j) => j !== i))}
                      title="Overslaan"
                      className="text-xs text-slate-400 hover:text-red-400 bg-slate-50 hover:bg-red-50 rounded px-1.5 py-0.5 transition-colors">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bestaande items */}
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id}
            className={`group flex items-start gap-2 border-l-4 rounded-r-lg px-4 py-3 bg-white shadow-sm ${tagColors[item.tag] || tagColors.niet_relevant}`}>
            <p className="flex-1 text-sm text-slate-700 leading-relaxed">{item.content}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <TagPill tag={item.tag} onChange={tag => onTagChange(item.id, tag)} allowedKeys={allowedTagKeys} />
              <button onClick={() => onDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={`+ Nieuwe ${title.toLowerCase()}…`}
          className="flex-1 text-sm bg-white border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-[var(--color-primary)]/40"
        />
        <button onClick={commit}
          className="text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 rounded-lg px-3 py-2 transition-colors">
          +
        </button>
      </div>
    </div>
  );
}

/** Tekstveld met Draft-modus, Magic Staff en Improve-menu.
 *  T2-retro-fix Bev. 2: invultips uit `tips.strategie.<blok>.kort` worden nu
 *  als `placeholder`-attribuut doorgegeven (verdwijnt bij typen). De eerdere
 *  `helper`-prop (onder-veld-tekst) is verwijderd — placeholder-in-veld is
 *  Kees-keuze + platform-pattern voor T3/T4. */
function WerkbladTextField({ label, fieldKey, value, draft, onChange, onMagic, onImprove, onAcceptDraft, onEditDraft, onRejectDraft, placeholder, multiline = true, rows = 5, magicResult }) {
  const hasDraft = draft !== null && draft !== undefined;
  const [improveOpen, setImproveOpen] = useState(false);
  const IMPROVE_PRESETS = [
    { key: "inspirerender", icon: "✨", label: "Inspirerender"    },
    { key: "mckinsey",      icon: "📊", label: "McKinsey-stijl"  },
    { key: "beknopter",     icon: "✂️", label: "Beknopter"       },
    { key: "financieel",    icon: "💶", label: "Focus Financieel" },
  ];

  return (
    <div className="space-y-1.5">
      {/* Label + knoppen */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-base font-semibold text-slate-700">{label}</label>
        <div className="flex items-center gap-1.5">
          {/* Improve dropdown — alleen als er tekst is */}
          {value && onImprove && (
            <div className="relative">
              <button onClick={() => setImproveOpen(o => !o)}
                className="text-[9px] font-bold text-slate-400 hover:text-[var(--color-primary)] px-2 py-0.5 rounded border border-slate-200 hover:border-[var(--color-primary)]/40 transition-colors flex items-center gap-1"
                title="Tekst verbeteren">
                <span>✨</span> Improve
              </button>
              {improveOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setImproveOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]">
                    {IMPROVE_PRESETS.map(p => (
                      <button key={p.key} onClick={() => { onImprove(p.key); setImproveOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-600 flex items-center gap-2">
                        <span>{p.icon}</span>{p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Magic Staff */}
          {onMagic && <WandButton onClick={onMagic} loading={magicResult?.loading} disabled={hasDraft} />}
        </div>
      </div>

      {/* Tekstveld */}
      {multiline ? (
        <textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `${label}…`}
          rows={rows}
          className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-4 py-3 resize-y focus:outline-none focus:border-[var(--color-primary)]/40 placeholder:text-slate-300 leading-relaxed"
        />
      ) : (
        <input
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `${label}…`}
          className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--color-primary)]/40 placeholder:text-slate-300"
        />
      )}

      {/* Magic Staff result — alleen bij error of geen chunks */}
      {(magicResult?.error || magicResult?.noChunks) && <MagicResult result={magicResult} onAccept={() => { onChange(magicResult.suggestion); onRejectDraft && onRejectDraft(); }} onReject={() => onRejectDraft && onRejectDraft()} />}

      {/* Draft overlay */}
      {hasDraft && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
              <span>✨</span> AI Voorstel — Concept
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onAcceptDraft}
                className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                <span>✓</span> Accepteren
              </button>
              <button onClick={onEditDraft}
                className="text-[9px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary)]/70 flex items-center gap-1">
                <span>✏️</span> Bewerken
              </button>
              <button onClick={onRejectDraft}
                className="text-[9px] font-bold text-slate-500 hover:text-red-500 flex items-center gap-1">
                <span>✕</span> Negeren
              </button>
            </div>
          </div>
          <p className="px-3 py-2.5 text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{draft}</p>
        </div>
      )}
    </div>
  );
}

export default function StrategieWerkblad({ canvasId, onClose, onManualSaved }) {
  const { t, lang, setLang } = useLang();
  const { user, signOut } = useAuth();
  const [showOverDialog, setShowOverDialog] = useState(false);
  // S2 instructie C — content-filtering sectie-tabs.
  // Eén actieve sectie tegelijk; default "identiteit" bij canvas-load.
  const [activeSectie, setActiveSectie] = useState("identiteit");
  const { prompt: appPrompt, label: appLabel } = useAppConfig();
  const [mounted, setMounted]   = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");

  // Data state
  const [core, setCore]         = useState({ missie: "", visie: "", ambitie: "", kernwaarden: [], samenvatting: "" });
  const [items, setItems]       = useState([]);   // analysis_items
  const [themas, setThemas]     = useState([]);   // strategic_themes incl. ksf_kpi

  // Draft state (fieldKey → string)
  const [drafts, setDrafts]     = useState({});

  // Magic Staff state
  const [magic, setMagic]       = useState({});
  const [autoDraftRunning, setAutoDraftRunning] = useState(false);
  const [autoDraftOpen, setAutoDraftOpen]       = useState(false);
  const [showOnePager,   setShowOnePager]       = useState(false);
  // 11.S Block 2 — RapportageMenu dialog-zichtbaarheid
  const [rapportageMenuOpen, setRapportageMenuOpen] = useState(false);
  // 11.S Block 3 — OnepagerBuilder overlay-zichtbaarheid
  const [onepagerBuilderOpen, setOnepagerBuilderOpen] = useState(false);
  const [showAdvies,       setShowAdvies]       = useState(false);
  // T2 A2 — invultips-modal voor Strategie-werkblad
  const [showInvultips,  setShowInvultips]      = useState(false);
  const [analysis,         setAnalysis]         = useState(null);
  const [analysisLoading,  setAnalysisLoading]  = useState(false);
  const [analysisError,    setAnalysisError]    = useState(null);
  const [canvasName,       setCanvasName]       = useState(null);
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState(null);

  // Executie Magic state
  const [themaDraft, setThemaDraft]     = useState(null); // { loading, loadingMsg, lines }
  const [ksfKpiDrafts, setKsfKpiDrafts] = useState({});   // { [themaId]: { loading, loadingMsg, ksf, kpi } }

  // Kernwaarden input state (controlled)
  const [newKernwaardeInput, setNewKernwaardeInput] = useState("");

  const addKernwaarde = () => {
    const v = newKernwaardeInput.trim();
    if (!v) return;
    setCore(prev => ({ ...prev, kernwaarden: [...prev.kernwaarden, v] }));
    setNewKernwaardeInput("");
  };

  const coreDebounceRef  = useRef(null); // autosave strategy_core
  const titleDebounceRef = useRef(null); // updateThemaTitle
  const kpiDebounceRef   = useRef(null); // updateKsfKpiItem

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Load data from DB — canoniek patroon (CLAUDE.md 4.3)
  useEffect(() => {
    const activeCanvasId = canvasId;   // capture vóór de async sprong
    let cancelled = false;             // race-guard 1: unmount / effect re-run

    // Reset vóór fetch — geen ghost data van vorig canvas
    setIsLoaded(false);
    setCore({ missie: "", visie: "", ambitie: "", kernwaarden: [], samenvatting: "" });
    setItems([]);
    setThemas([]);
    setAnalysis(null);
    setAnalysisUpdatedAt(null);
    setCanvasName(null);

    if (!activeCanvasId) { setIsLoaded(true); return; }

    Promise.all([
      loadStrategyCore(activeCanvasId),
      loadAnalysisItems(activeCanvasId),
      loadStrategicThemes(activeCanvasId),
      loadCanvasName(activeCanvasId),
    ]).then(([
      { data: coreData,   error: coreErr   },
      { data: itemsData,  error: itemsErr  },
      { data: themasData, error: themasErr },
      { data: nameData,   error: nameErr   },
    ]) => {
      if (cancelled) return;                      // race-guard 1
      if (activeCanvasId !== canvasId) return;    // race-guard 2: canvas gewisseld tijdens fetch

      if (coreErr)   console.error("[StrategieWerkblad] core laden:",   coreErr.message);
      if (itemsErr)  console.error("[StrategieWerkblad] items laden:",  itemsErr.message);
      if (themasErr) console.error("[StrategieWerkblad] themas laden:", themasErr.message);
      if (nameErr)   console.error("[StrategieWerkblad] naam laden:",   nameErr.message);

      if (coreData) {
        setCore({ missie: coreData.missie || "", visie: coreData.visie || "", ambitie: coreData.ambitie || "", kernwaarden: coreData.kernwaarden || [], samenvatting: coreData.samenvatting || "" });
        setAnalysis(coreData.insights || null);
        setAnalysisUpdatedAt(coreData.updated_at || null);
      }
      if (nameData)   setCanvasName(nameData);
      if (itemsData)  setItems(itemsData);
      if (themasData) setThemas(themasData);
      setIsLoaded(true);
    });

    return () => { cancelled = true; };           // cleanup: markeer als afgebroken
  }, [canvasId]);

  // Debounced autosave van strategy_core
  useEffect(() => {
    if (!isLoaded || !canvasId) return;
    clearTimeout(coreDebounceRef.current);
    setSaveStatus("saving");
    coreDebounceRef.current = setTimeout(async () => {
      const { error } = await upsertStrategyCore(canvasId, core);
      if (error) {
        console.error("[StrategieWerkblad] autosave mislukt:", error?.message || error);
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    }, 800);
    return () => clearTimeout(coreDebounceRef.current);
  }, [core, isLoaded, canvasId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dashboard-sync: stuurt themaCount + swotCount mee zodat checkmarks kloppen
  useEffect(() => {
    if (!isLoaded) return;
    const swotCount = items.filter(i => i.tag && i.tag !== "niet_relevant").length;
    onManualSaved?.({ ...core, themaCount: themas.length, swotCount, samenvatting: core.samenvatting || "" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, themas.length, items, isLoaded]);

  // ── Core field handlers ──────────────────────────────────────────────────────
  const updateCore = (field, value) => setCore(prev => ({ ...prev, [field]: value }));

  // ── Draft handlers ───────────────────────────────────────────────────────────
  const setDraftFor  = (key, text) => setDrafts(prev => ({ ...prev, [key]: text }));
  const clearDraft   = (key) => setDrafts(prev => { const n = { ...prev }; delete n[key]; return n; });
  const acceptDraft  = (key) => { updateCore(key, drafts[key]); clearDraft(key); };
  const editDraft    = (key) => { updateCore(key, drafts[key]); clearDraft(key); };

  // ── Magic Staff ──────────────────────────────────────────────────────────────
  const setMagicFor = (key, patch) =>
    setMagic(prev => ({ ...prev, [key]: patch === null ? undefined : { ...(prev[key] || {}), ...patch } }));

  const FIELD_QUERIES = {
    missie:    "mission statement missie purpose why we exist organizational purpose reason for being",
    visie:     "vision statement visie future ambition long-term goal where we want to be",
    ambitie:   "ambition strategic ambition BHAG aspirations growth targets what we strive for",
    kernwaarden: "core values kernwaarden principles culture beliefs guiding principles what we stand for",
    extern:    "external developments trends marktomgeving macro-economisch sector trends opportunities threats",
    intern:    "internal strengths weaknesses capabilities resources internal developments organizational",
    themas:    "strategic themes priorities strategic pillars focus areas key initiatives transformation themes",
  };

  // Hulpfunctie: roep magic aan met general knowledge fallback (geen dossier)
  // Stuurt missie/visie/ambitie mee als organisatiecontext zodat Claude specifiek kan zijn
  const callGeneralKnowledgeMagic = async (fieldKey, isArray) => {
    const resolvedFieldInstruction = appPrompt(`magic.field.${fieldKey}`) || undefined;

    // Bouw organisatiecontext op uit ingevulde core-velden
    const contextParts = [];
    if (core.missie?.trim())   contextParts.push(`Missie: ${core.missie.trim()}`);
    if (core.visie?.trim())    contextParts.push(`Visie: ${core.visie.trim()}`);
    if (core.ambitie?.trim())  contextParts.push(`Ambitie: ${core.ambitie.trim()}`);
    if (core.kernwaarden?.length) contextParts.push(`Kernwaarden: ${Array.isArray(core.kernwaarden) ? core.kernwaarden.join(", ") : core.kernwaarden}`);
    const organizationContext = contextParts.length > 0 ? contextParts.join("\n") : undefined;

    const res = await apiFetch("/api/magic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: fieldKey, chunks: [], isArray, heavy: false,
        useGeneralKnowledge: true,
        organizationContext,
        systemPromptGeneralKnowledge: appPrompt("magic.system_general_knowledge") || undefined,
        languageInstruction: t("ai.language"),
        fieldInstruction: resolvedFieldInstruction,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI fout");
    return data.suggestion || "";
  };

  const callWerkbladMagic = async (fieldKey, isArray = false) => {
    if (!canvasId) { setMagicFor(fieldKey, { error: "Sla het canvas eerst op." }); return; }
    const isHeavy = ["extern","intern","themas"].includes(fieldKey);
    const isAnalysisField = ["extern","intern"].includes(fieldKey);
    const matchCount = isHeavy ? 30 : 12;
    setMagicFor(fieldKey, { loading: true, suggestion: null, error: null });
    try {
      const query = FIELD_QUERIES[fieldKey] || fieldKey;
      const embRes = await apiFetch("/api/documents?_subpath=embed", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ texts: [query] }) });
      if (!embRes.ok) throw new Error("Embedding mislukt");
      const { embeddings } = await embRes.json();
      const { data: chunks, error: searchErr } = await searchDocumentChunks(embeddings[0], canvasId, matchCount);
      if (searchErr) console.warn("[werkblad magic] RPC fout:", searchErr);

      const hasChunks = chunks && chunks.length > 0;

      // Geen documenten: voor analyse-velden en kernwaarden fallback op algemene kennis, anders stoppen
      if (!hasChunks) {
        if (!isAnalysisField && fieldKey !== "kernwaarden") {
          setMagicFor(fieldKey, { loading: false, noChunks: true, suggestion: null });
          return;
        }
        // Extern/intern/kernwaarden zonder dossier → general knowledge
        const suggestion = await callGeneralKnowledgeMagic(fieldKey, isArray);
        setMagicFor(fieldKey, { loading: false, suggestion, citations: [], isGeneralKnowledge: true });
        if (suggestion) setDraftFor(fieldKey, suggestion);
        return;
      }

      // Normale RAG aanroep
      const citations = [...new Set(chunks.map(c => c.file_name).filter(Boolean))];
      const resolvedFieldInstruction = appPrompt(`magic.field.${fieldKey}`) || undefined;
      const magicRes = await apiFetch("/api/magic", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          field: fieldKey, chunks, isArray, heavy: isHeavy,
          languageInstruction: t("ai.language"),
          fieldInstruction: resolvedFieldInstruction,
          systemPromptStandard: appPrompt("magic.system_standard") || undefined,
          systemPromptHeavy: appPrompt("magic.system_heavy") || undefined,
        }),
      });
      const magicData = await magicRes.json();
      if (!magicRes.ok) throw new Error(magicData.error || "AI fout");
      const suggestion = magicData.suggestion || "";
      const isNoInfo = suggestion.toLowerCase().includes("geen relevante informatie") || suggestion.toLowerCase().includes("onvoldoende");

      // Dossier heeft onvoldoende info voor analyse-velden → fallback op algemene kennis
      if (isNoInfo && isAnalysisField) {
        const fbSuggestion = await callGeneralKnowledgeMagic(fieldKey, isArray);
        setMagicFor(fieldKey, { loading: false, suggestion: fbSuggestion, citations: [], isGeneralKnowledge: true });
        if (fbSuggestion) setDraftFor(fieldKey, fbSuggestion);
        return;
      }

      setMagicFor(fieldKey, { loading: false, suggestion, citations, isNoInfo });
      if (!isNoInfo) setDraftFor(fieldKey, suggestion);
    } catch (err) {
      setMagicFor(fieldKey, { loading: false, error: err.message });
    }
  };

  // ── Improve ──────────────────────────────────────────────────────────────────
  const callImprove = async (fieldKey, text, preset) => {
    if (!text) return;
    setMagicFor(fieldKey, { loading: true });
    try {
      const res = await apiFetch("/api/improve", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text, preset, field: fieldKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Improve mislukt");
      setDraftFor(fieldKey, data.suggestion);
      setMagicFor(fieldKey, { loading: false, suggestion: null });
    } catch (err) {
      setMagicFor(fieldKey, { loading: false, error: err.message });
    }
  };

  // ── Strategisch Advies — AI analyse ─────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await apiFetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "analysis", core, items, themas,
          systemPromptAnalysis: appPrompt("strategy.analysis") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      const insights = data.insights || [];
      setAnalysis(insights);
      // Sla op in DB (strategy_core.insights) — updated_at wordt door upsert gezet
      const now = new Date().toISOString();
      const { error: saveError } = await upsertStrategyCore(canvasId, { insights });
      if (saveError) {
        console.error("[handleAnalyze] opslaan mislukt:", saveError.message);
      } else {
        setAnalysisUpdatedAt(now); // upsert zet updated_at op server; gebruik client-now als benadering
      }
    } catch (e) {
      setAnalysisError(e.message);
    } finally {
      setAnalysisLoading(false);
    }
  }, [core, items, themas, canvasId, appPrompt]);

  // ── RFC-008 §4 — InzichtenOverlay service-injectie ──────────────────────────
  // updateInsight retourneert het volledige insight-object (jsonb met merged fields);
  // we mergen in-place in lokale `analysis`-state zodat de UI direct rerendert
  // zonder full reload. Foutpad: error bubble-up naar InzichtItem (toont rood label).
  const applyInsightUpdate = useCallback((insightId, updated) => {
    setAnalysis(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(i => (i.id === insightId ? { ...i, ...updated } : i));
    });
  }, []);

  const handleInsightSave = useCallback(async (insightId, fields) => {
    const { data, error } = await updateInsight(canvasId, insightId, fields);
    if (!error && data) applyInsightUpdate(insightId, data);
    return { data, error };
  }, [canvasId, applyInsightUpdate]);

  const handleInsightToggleRapport = useCallback(async (insightId, inRapport) => {
    const { data, error } = await updateInsight(canvasId, insightId, { in_rapport: inRapport });
    if (!error && data) applyInsightUpdate(insightId, data);
    return { data, error };
  }, [canvasId, applyInsightUpdate]);

  // RFC-008 §4b — status-indicator-klik opent Rapportage.
  // Block 2 wires de TODO uit Block 1: sluit Inzichten + opent RapportageMenu.
  const handleOpenRapportage = useCallback(() => {
    setShowAdvies(false);
    setRapportageMenuOpen(true);
  }, []);

  // ── Samenvatting genereren — direct toepassen (geen draft-stap) ─────────────
  const handleGenerateSamenvatting = async () => {
    setMagicFor("samenvatting", { loading: true, suggestion: null, error: null });
    try {
      const res = await apiFetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "samenvatting", core, themas,
          languageInstruction: t("ai.language"),
          systemPromptSamenvatting: appPrompt("strategy.samenvatting") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      // Direct toepassen zodat het direct opgeslagen wordt via de debounce
      updateCore("samenvatting", data.samenvatting || "");
      setMagicFor("samenvatting", { loading: false });
    } catch (err) {
      setMagicFor("samenvatting", { loading: false, error: err.message });
    }
  };

  // ── Flush-save bij sluiten: debounce direct uitvoeren ───────────────────────
  const handleClose = useCallback(() => {
    // Annuleer de debounce en sla direct op zodat samenvatting zeker in DB staat
    // voordat RichtlijnenWerkblad laadt
    clearTimeout(coreDebounceRef.current);
    if (isLoaded && canvasId) {
      upsertStrategyCore(canvasId, core).catch(() => {}); // fire-and-forget, fout al gelogd
    }
    onClose();
  }, [canvasId, core, isLoaded, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Full Draft ───────────────────────────────────────────────────────────────
  const handleFullDraft = async () => {
    setAutoDraftOpen(false);
    setAutoDraftRunning(true);
    const fields = ["missie","visie","ambitie","kernwaarden","extern","intern"];
    for (let i = 0; i < fields.length; i++) {
      await callWerkbladMagic(fields[i], ["kernwaarden"].includes(fields[i]));
      if (i < fields.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    setAutoDraftRunning(false);
  };

  // ── Analysis item handlers ────────────────────────────────────────────────────
  const addAnalysisItem = useCallback(async (type, content) => {
    const newItem = { canvas_id: canvasId, type, content, tag: "niet_relevant", sort_order: items.filter(i => i.type === type).length };
    const { data } = await upsertAnalysisItem(newItem);
    if (data) setItems(prev => [...prev, data]);
  }, [canvasId, items]);

  const removeAnalysisItem = useCallback(async (id) => {
    await deleteAnalysisItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const changeAnalysisTag = useCallback(async (id, tag) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, tag } : i));
    await changeAnalysisItemTag(id, tag);
  }, []);

  // ── AI: Auto-tag externe/interne items met SWOT-classificatie ────────────
  const [autoTagLoading, setAutoTagLoading] = useState(false);
  const handleAutoTag = useCallback(async () => {
    const untagged = items.filter(i => !i.tag || i.tag === "niet_relevant");
    if (untagged.length === 0) return;
    setAutoTagLoading(true);
    try {
      const res = await apiFetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "auto_tag",
          core,
          items: untagged,
          systemPromptAutoTag: appPrompt("strategy.auto_tag") || undefined,
          languageInstruction: t("ai.language"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      const tags = data.tags || {};
      // Pas lokaal toe + persisteer per item
      const updates = Object.entries(tags);
      if (updates.length === 0) return;
      setItems(prev => prev.map(i => tags[i.id] ? { ...i, tag: tags[i.id] } : i));
      await Promise.all(updates.map(([id, tag]) => changeAnalysisItemTag(id, tag)));
    } catch (err) {
      console.error("[autoTag]", err.message);
    } finally {
      setAutoTagLoading(false);
    }
  }, [items, core, appPrompt, t]);

  // ── Thema handlers ────────────────────────────────────────────────────────────
  const addThema = useCallback(async () => {
    if (themas.length >= 7) return;
    const { data } = await upsertStrategicTheme({ canvas_id: canvasId, title: "", sort_order: themas.length });
    if (data) setThemas(prev => [...prev, { ...data, ksf_kpi: [] }]);
  }, [canvasId, themas.length]);

  const removeThema = useCallback(async (id) => {
    await deleteStrategicTheme(id);
    setThemas(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateThemaTitle = useCallback(async (id, title) => {
    setThemas(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    clearTimeout(titleDebounceRef.current);
    // canvas_id meesturen zodat de INSERT-path van upsert de RLS-check doorstaat
    titleDebounceRef.current = setTimeout(() => upsertStrategicTheme({ id, canvas_id: canvasId, title }), 500);
  }, [canvasId]);

  const addKsfKpi = useCallback(async (themaId, type, initialData = {}) => {
    const thema = themas.find(t => t.id === themaId);
    const existing = (thema?.ksf_kpi || []).filter(k => k.type === type);
    if (existing.length >= 3) return null;
    const { data } = await upsertKsfKpi({
      theme_id: themaId, type,
      description:   initialData.description   || "",
      current_value: initialData.current_value || "",
      target_value:  initialData.target_value  || "",
      sort_order: existing.length,
    });
    if (data) setThemas(prev => prev.map(t => t.id === themaId ? { ...t, ksf_kpi: [...(t.ksf_kpi||[]), data] } : t));
    return data;
  }, [themas]);

  const updateKsfKpiItem = useCallback(async (themaId, item) => {
    setThemas(prev => prev.map(t => t.id === themaId ? { ...t, ksf_kpi: t.ksf_kpi.map(k => k.id === item.id ? item : k) } : t));
    clearTimeout(kpiDebounceRef.current);
    kpiDebounceRef.current = setTimeout(() => upsertKsfKpi(item), 500);
  }, []);

  const removeKsfKpi = useCallback(async (themaId, id) => {
    await deleteKsfKpi(id);
    setThemas(prev => prev.map(t => t.id === themaId ? { ...t, ksf_kpi: t.ksf_kpi.filter(k => k.id !== id) } : t));
  }, []);

  // ── Executie Magic handlers ───────────────────────────────────────────────────
  const THEME_LOADING_MSGS = [
    "Bezig met het vertalen van dromen naar spreadsheets…",
    "De raad van bestuur simuleren voor kritische feedback…",
    "Zeven thema's destilleren uit de strategische ruis…",
    "Strategische ambities omzetten naar werkbare richting…",
    "Coherente koerslijnen uitstippelen voor de komende 3-5 jaar…",
  ];

  const generateThemas = async () => {
    const loadingMsg = THEME_LOADING_MSGS[Math.floor(Math.random() * THEME_LOADING_MSGS.length)];
    setThemaDraft({ loading: true, loadingMsg, lines: [] });
    try {
      const res = await apiFetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "themes", core, items,
          languageInstruction: t("ai.language"),
          systemPromptThemes: appPrompt("strategy.themes") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      setThemaDraft({ loading: false, loadingMsg, lines: data.themes || [] });
    } catch (err) {
      setThemaDraft({ loading: false, loadingMsg, lines: [], error: err.message });
    }
  };

  const acceptThemaDraftLine = useCallback(async (line) => {
    if (themas.length >= 7) return;
    const { data } = await upsertStrategicTheme({ canvas_id: canvasId, title: line, sort_order: themas.length });
    if (data) setThemas(prev => [...prev, { ...data, ksf_kpi: [] }]);
    setThemaDraft(prev => ({ ...prev, lines: prev.lines.filter(l => l !== line) }));
  }, [canvasId, themas.length]);

  const acceptAllThemaDraft = useCallback(async () => {
    const toAdd = (themaDraft?.lines || []).slice(0, 7 - themas.length);
    const newThemas = [];
    for (const line of toAdd) {
      const { data } = await upsertStrategicTheme({ canvas_id: canvasId, title: line, sort_order: themas.length + newThemas.length });
      if (data) newThemas.push({ ...data, ksf_kpi: [] });
    }
    setThemas(prev => [...prev, ...newThemas]);
    setThemaDraft(null);

    // Auto-genereer KSF/KPI voor elk nieuw thema (400ms pauze)
    for (let i = 0; i < newThemas.length; i++) {
      const thema = newThemas[i];
      if (!thema.title?.trim()) continue;
      if (i > 0) await new Promise(r => setTimeout(r, 400));
      const loadingMsg = KSF_KPI_LOADING_MSGS[Math.floor(Math.random() * KSF_KPI_LOADING_MSGS.length)];
      setKsfKpiDrafts(prev => ({ ...prev, [thema.id]: { loading: true, loadingMsg } }));
      try {
        const res = await apiFetch("/api/strategy", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ksf_kpi", thema: thema.title, core, items,
            languageInstruction: t("ai.language"),
            systemPromptKsfKpi: appPrompt("strategy.ksf_kpi") || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setKsfKpiDrafts(prev => ({ ...prev, [thema.id]: { loading: false, loadingMsg, ksf: data.ksf || [], kpi: data.kpi || [] } }));
        }
      } catch (_) {
        setKsfKpiDrafts(prev => { const n = { ...prev }; delete n[thema.id]; return n; });
      }
    }
  }, [canvasId, themaDraft, themas.length, core, items, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateKsfKpiForThema = useCallback(async (themaId) => {
    const thema = themas.find(t => t.id === themaId);
    if (!thema?.title?.trim()) return;
    const loadingMsg = KSF_KPI_LOADING_MSGS[Math.floor(Math.random() * KSF_KPI_LOADING_MSGS.length)];
    setKsfKpiDrafts(prev => ({ ...prev, [themaId]: { loading: true, loadingMsg } }));
    try {
      const res = await apiFetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ksf_kpi", thema: thema.title, core, items,
          languageInstruction: t("ai.language"),
          systemPromptKsfKpi: appPrompt("strategy.ksf_kpi") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fout");
      setKsfKpiDrafts(prev => ({ ...prev, [themaId]: { loading: false, loadingMsg, ksf: data.ksf || [], kpi: data.kpi || [] } }));
    } catch (err) {
      setKsfKpiDrafts(prev => ({ ...prev, [themaId]: { loading: false, loadingMsg, error: err.message } }));
    }
  }, [themas, core, items, t, appPrompt]);

  const acceptKsfKpiDraft = useCallback(async (themaId) => {
    const draft = ksfKpiDrafts[themaId];
    if (!draft) return;
    const thema = themas.find(t => t.id === themaId);
    const existingKsf = (thema?.ksf_kpi || []).filter(k => k.type === "ksf");
    const existingKpi = (thema?.ksf_kpi || []).filter(k => k.type === "kpi");
    for (const ksf of (draft.ksf || []).slice(0, 3 - existingKsf.length)) {
      await addKsfKpi(themaId, "ksf", ksf);
    }
    for (const kpi of (draft.kpi || []).slice(0, 3 - existingKpi.length)) {
      await addKsfKpi(themaId, "kpi", kpi);
    }
    setKsfKpiDrafts(prev => { const n = { ...prev }; delete n[themaId]; return n; });
  }, [ksfKpiDrafts, themas, addKsfKpi]);

  const rejectKsfKpiDraft = useCallback((themaId) => {
    setKsfKpiDrafts(prev => { const n = { ...prev }; delete n[themaId]; return n; });
  }, []);

  // Verwijder één item uit een KSF/KPI draft (hover × knop)
  const removeKsfKpiDraftItem = useCallback((themaId, type, idx) => {
    setKsfKpiDrafts(prev => {
      const draft = prev[themaId];
      if (!draft) return prev;
      return {
        ...prev,
        [themaId]: {
          ...draft,
          [type]: (draft[type] || []).filter((_, i) => i !== idx),
        },
      };
    });
  }, []);

  // ── Memoized per-thema handlers ──────────────────────────────────────────────
  const themaHandlers = useMemo(() =>
    themas.reduce((acc, t) => ({
      ...acc,
      [t.id]: {
        onTitleChange: (title) => updateThemaTitle(t.id, title),
        onDelete:      ()      => removeThema(t.id),
        onAddKsfKpi:   (type)  => addKsfKpi(t.id, type),
        onUpdateKsfKpi:(item)  => updateKsfKpiItem(t.id, item),
        onDeleteKsfKpi:(id)    => removeKsfKpi(t.id, id),
        onGenerateKsfKpi: ()   => generateKsfKpiForThema(t.id),
        onAcceptKsfKpiDraft: () => acceptKsfKpiDraft(t.id),
        onRejectKsfKpiDraft: () => rejectKsfKpiDraft(t.id),
      }
    }), {}),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [themas.map(t => t.id).join(',')]
  );

  const externItems = items.filter(i => i.type === "extern");
  const internItems = items.filter(i => i.type === "intern");
  const saveLabel   = { idle: "", saving: "Opslaan…", saved: "Opgeslagen ✓", error: "Fout" }[saveStatus];
  const saveColor   = { saving: "text-slate-400", saved: "text-[var(--color-success)]", error: "text-red-500", idle: "" }[saveStatus];

  if (!isLoaded) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Wand2 size={28} className="text-[var(--color-accent)] animate-pulse mx-auto" />
        <p className="text-sm text-slate-500">Strategie laden…</p>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-slate-50 transition-all duration-300 ease-out
      ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>

      {/* S2 design-systeem — drie-lagen-WerkbladHeader vol-vullen (designer §3.7).
          Laag 1 met LogoBrand + appTitle + versie-pill + lang-switch + overflow.
          Laag 2 werkblad-bar met Crosshair-tile + Inzichten + Rapportage + Full Draft
          (Analyse-knop verhuisd naar InzichtenOverlay per instructie B).
          Laag 3 sectie-tabs met content-filtering (instructie C). */}
      <WerkbladHeader
        categorie="strategie"
        icon={Crosshair}
        capsLabel="Werkblad"
        titel="Strategie Werkblad"
        onClose={handleClose}
        saveStatus={saveLabel || null}
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
        tabs={[
          { id: "identiteit", label: "Identiteit" },
          { id: "analyse",    label: "Analyse · SWOT" },
          { id: "executie",   label: "Executie · 7·3·3" },
        ]}
        activeTabId={activeSectie}
        onTabClick={(id) => setActiveSectie(id)}
        actieknoppen={
          <>
            <WerkbladActieknoppen
              onTips={() => setShowInvultips(true)}
              onBekijken={() => setShowAdvies(true)}
              // 11.S Block 2 — Rapportage-knop opent RapportageMenu i.p.v. direct
              // StrategyOnePager. Tile 1 (One-pager) is in Block 2 dood-href; Block 3
              // wire't OnepagerBuilder. Bestaande StrategyOnePager-render hieronder
              // blijft tijdelijk dead-code tot Block 3/4 deze vervangt.
              onRapportage={() => setRapportageMenuOpen(true)}
              bekijkenDisabled={false}
              appLabel={appLabel}
            />
            <button
              onClick={() => setAutoDraftOpen(true)}
              disabled={autoDraftRunning}
              data-testid="strategie-full-draft"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-primary)" }}
            >
              <Zap size={13} />
              {autoDraftRunning ? "Bezig…" : "Full Draft"}
            </button>
          </>
        }
      />

      {/* Full Draft bevestiging */}
      {autoDraftOpen && (
        <div className="flex-shrink-0 mx-8 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-800">🚀 Full Draft starten?</p>
            <p className="text-xs text-amber-600 mt-0.5">Vult alle velden met AI-concepten op basis van Het Dossier. Bestaande tekst wordt niet overschreven.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleFullDraft} className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg px-4 py-2">Start</button>
            <button onClick={() => setAutoDraftOpen(false)} className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">Annuleer</button>
          </div>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-8 py-12 space-y-10">

        {/* SECTIE 1: IDENTITEIT */}
        {activeSectie === "identiteit" && (
        <section id="strat-section-identiteit" className="space-y-6 scroll-mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-xs font-black flex items-center justify-center flex-shrink-0">1</div>
            <h3 className="text-2xl font-bold text-[var(--color-primary)]">{appLabel("strat.section.identiteit", "Identiteit")}</h3>
            <div className="flex-1 h-px bg-[var(--color-primary)]/15" />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <WerkbladTextField
              label={appLabel("strat.field.missie", "Missie")}
              fieldKey="missie"
              value={core.missie}
              draft={drafts.missie}
              onChange={v => updateCore("missie", v)}
              onMagic={() => callWerkbladMagic("missie")}
              onImprove={(preset) => callImprove("missie", core.missie, preset)}
              onAcceptDraft={() => acceptDraft("missie")}
              onEditDraft={() => editDraft("missie")}
              onRejectDraft={() => clearDraft("missie")}
              magicResult={magic.missie}
              placeholder={appLabel("tips.strategie.missie.kort", "Waarom bestaat de organisatie? Tijdloos, verandert niet bij een nieuwe strategie.")}
            />
            <WerkbladTextField
              label={appLabel("strat.field.visie", "Visie")}
              fieldKey="visie"
              value={core.visie}
              draft={drafts.visie}
              onChange={v => updateCore("visie", v)}
              onMagic={() => callWerkbladMagic("visie")}
              onImprove={(preset) => callImprove("visie", core.visie, preset)}
              onAcceptDraft={() => acceptDraft("visie")}
              onEditDraft={() => editDraft("visie")}
              onRejectDraft={() => clearDraft("visie")}
              magicResult={magic.visie}
              placeholder={appLabel("tips.strategie.visie.kort", "Hoe ziet de wereld — of jullie rol daarin — eruit als de missie slaagt? Een beeld, geen doel.")}
            />
            <WerkbladTextField
              label={appLabel("strat.field.ambitie", "Ambitie (BHAG)")}
              fieldKey="ambitie"
              value={core.ambitie}
              draft={drafts.ambitie}
              onChange={v => updateCore("ambitie", v)}
              onMagic={() => callWerkbladMagic("ambitie")}
              onImprove={(preset) => callImprove("ambitie", core.ambitie, preset)}
              onAcceptDraft={() => acceptDraft("ambitie")}
              onEditDraft={() => editDraft("ambitie")}
              onRejectDraft={() => clearDraft("ambitie")}
              magicResult={magic.ambitie}
              placeholder={appLabel("tips.strategie.ambitie.kort", "Waar wil de organisatie concreet naartoe? Tijdsgebonden, met horizon, in principe toetsbaar.")}
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-base font-semibold text-slate-700">{appLabel("strat.field.kernwaarden", "Kernwaarden")}</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addKernwaarde}
                    disabled={!newKernwaardeInput.trim()}
                    data-testid="strat-kernwaarde-toevoegen"
                    className="text-xs font-bold text-[var(--color-primary)] hover:text-[var(--color-primary)]/70 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1">
                    <Plus size={10} /> Toevoegen
                  </button>
                  <WandButton onClick={() => callWerkbladMagic("kernwaarden", true)} loading={magic.kernwaarden?.loading} disabled={!!drafts.kernwaarden} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[60px] bg-white border border-slate-200 rounded-lg p-2.5">
                {core.kernwaarden.map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20 rounded-full px-2.5 py-1">
                    {kw}
                    <button onClick={() => setCore(prev => ({ ...prev, kernwaarden: prev.kernwaarden.filter((_,j) => j !== i) }))}
                      className="text-[var(--color-primary)]/40 hover:text-red-400 transition-colors"><X size={10} /></button>
                  </span>
                ))}
                <input
                  value={newKernwaardeInput}
                  onChange={e => setNewKernwaardeInput(e.target.value)}
                  placeholder={appLabel("tips.strategie.kernwaarden.kort", "Welke principes sturen gedrag en keuzes? Niet wat je doet, maar hoe je het doet.")}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKernwaarde();
                    }
                  }}
                  data-testid="strat-kernwaarde-input"
                  className="text-sm bg-transparent border-none focus:outline-none placeholder:text-slate-300 text-slate-600 min-w-[260px] flex-1"
                />
              </div>
              {/* Draft voor kernwaarden */}
              {drafts.kernwaarden && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">✨ AI Voorstel — Concept</span>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const vals = drafts.kernwaarden.split("\n").map(s=>s.trim()).filter(Boolean);
                        setCore(prev => ({ ...prev, kernwaarden: [...new Set([...prev.kernwaarden, ...vals])] }));
                        clearDraft("kernwaarden");
                      }} className="text-[9px] font-bold text-emerald-700">✓ Accepteren</button>
                      <button onClick={() => clearDraft("kernwaarden")} className="text-[9px] font-bold text-slate-500">✕ Negeren</button>
                    </div>
                  </div>
                  <p className="px-3 py-2 text-xs text-amber-900 whitespace-pre-wrap">{drafts.kernwaarden}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Strategische Samenvatting — 2 zinnen, zichtbaar op canvas + richtlijnen ── */}
          <div className="pt-2">
            <WerkbladTextField
              label={appLabel("strat.field.samenvatting", "Strategische Samenvatting")}
              fieldKey="samenvatting"
              value={core.samenvatting}
              draft={drafts.samenvatting}
              onChange={v => updateCore("samenvatting", v)}
              onMagic={handleGenerateSamenvatting}
              onImprove={(preset) => callImprove("samenvatting", core.samenvatting, preset)}
              onAcceptDraft={() => acceptDraft("samenvatting")}
              onEditDraft={() => editDraft("samenvatting")}
              onRejectDraft={() => clearDraft("samenvatting")}
              magicResult={magic.samenvatting}
              rows={3}
              placeholder={appLabel("tips.strategie.samenvatting.kort", "Vat missie, visie, ambitie en kernwaarden samen in een paar zinnen die als geheel kloppen.")}
            />
          </div>
        </section>
        )}

        {/* SECTIE 2: ANALYSE */}
        {activeSectie === "analyse" && (
        <section id="strat-section-analyse" className="space-y-6 pb-6 scroll-mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-analysis)] text-white text-xs font-black flex items-center justify-center flex-shrink-0">2</div>
            <h3 className="text-2xl font-bold text-[var(--color-analysis)]">{appLabel("strat.section.analyse", "Analyse")}</h3>
            <div className="flex-1 h-px bg-[var(--color-analysis)]/20" />
            {items.some(i => !i.tag || i.tag === "niet_relevant") && (
              <button
                onClick={handleAutoTag}
                disabled={autoTagLoading}
                title="AI classificeert externe items als kans/bedreiging en interne items als sterkte/zwakte — alleen bij zekerheid"
                className="flex items-center gap-1 text-xs font-bold text-[var(--color-analysis)]/60 hover:text-[var(--color-analysis)] border border-[var(--color-analysis)]/30 hover:border-[var(--color-analysis)]/60 rounded-md px-2 py-1 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <AiIcon variant="improve" size={10} />
                {autoTagLoading ? "Bezig…" : appLabel("strat.autotag.button", "Auto-tag")}
              </button>
            )}
            <p className="text-xs text-slate-400 flex-shrink-0">Tag elk item voor de SWOT-rapportage</p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <AnalyseSection
              title={appLabel("strat.field.extern", "Externe Ontwikkelingen")}
              type="extern"
              items={externItems}
              onAdd={content => addAnalysisItem("extern", content)}
              onDelete={removeAnalysisItem}
              onTagChange={changeAnalysisTag}
              onMagic={() => callWerkbladMagic("extern", true)}
              magicResult={magic.extern}
              onRejectMagic={() => setMagicFor("extern", null)}
            />
            <AnalyseSection
              title={appLabel("strat.field.intern", "Interne Ontwikkelingen")}
              type="intern"
              items={internItems}
              onAdd={content => addAnalysisItem("intern", content)}
              onDelete={removeAnalysisItem}
              onTagChange={changeAnalysisTag}
              onMagic={() => callWerkbladMagic("intern", true)}
              magicResult={magic.intern}
              onRejectMagic={() => setMagicFor("intern", null)}
            />
          </div>
        </section>
        )}

        {/* SECTIE 3: EXECUTIE 7-3-3 */}
        {activeSectie === "executie" && (
        <section id="strat-section-executie" className="space-y-6 pb-8 scroll-mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] text-white text-xs font-black flex items-center justify-center flex-shrink-0">3</div>
            <h3 className="text-2xl font-bold text-[var(--color-success)]">{appLabel("strat.section.executie", "Executie — 7·3·3 Regel")}</h3>
            <div className="flex-1 h-px bg-[var(--color-accent)]/30" />
            <p className="text-xs text-slate-400 flex-shrink-0">{themas.length}/7 thema's</p>
            {themas.length < 7 && (
              <button
                onClick={generateThemas}
                disabled={themaDraft?.loading}
                className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--color-accent)] hover:text-[var(--color-success)] border border-[var(--color-accent)]/40 hover:border-[var(--color-success)]/60 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50 flex-shrink-0">
                <AiIcon variant="improve" size={10} />
                {themaDraft?.loading ? "Genereren…" : "Genereer Thema's"}
              </button>
            )}
          </div>

          {/* Thema draft panel */}
          {themaDraft && (
            <div className="border border-amber-300 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-amber-50 px-3 py-2 border-b border-amber-200">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                  {themaDraft.loading
                    ? `🪄 ${themaDraft.loadingMsg}`
                    : `🪄 ${themaDraft.lines.length} thema's voorgesteld — review en selecteer`}
                </span>
                {!themaDraft.loading && (
                  <div className="flex gap-2">
                    <button onClick={acceptAllThemaDraft}
                      disabled={themas.length >= 7}
                      className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded px-2 py-0.5 transition-colors disabled:opacity-40">
                      Alle toevoegen
                    </button>
                    <button onClick={() => setThemaDraft(null)}
                      className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 transition-colors">
                      Weggooien
                    </button>
                  </div>
                )}
              </div>
              {themaDraft.loading && (
                <div className="px-4 py-3 text-xs text-amber-700 animate-pulse">{themaDraft.loadingMsg}</div>
              )}
              {!themaDraft.loading && themaDraft.error && (
                <div className="px-4 py-3 text-xs text-red-600">{themaDraft.error}</div>
              )}
              {!themaDraft.loading && (themaDraft.lines || []).map((line, i) => (
                <div key={i} className="group flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-amber-50/30 border-b border-amber-100 last:border-0 transition-colors">
                  <span className="text-[9px] font-black text-[var(--color-accent)]/70 w-4 flex-shrink-0">{i + 1}</span>
                  <p className="flex-1 text-sm font-semibold text-slate-700">{line}</p>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => acceptThemaDraftLine(line)}
                      disabled={themas.length >= 7}
                      className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded px-2 py-0.5 transition-colors disabled:opacity-40">
                      ✓ Toevoegen
                    </button>
                    <button
                      onClick={() => setThemaDraft(prev => ({ ...prev, lines: prev.lines.filter((_, j) => j !== i) }))}
                      className="text-xs text-slate-400 hover:text-red-400 bg-slate-50 hover:bg-red-50 rounded px-2 py-0.5 transition-colors">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {themas.map((thema, i) => {
              const handlers = themaHandlers[thema.id] || {};
              return (
                <ThemaAccordeon
                  key={thema.id}
                  thema={thema}
                  index={i}
                  onTitleChange={handlers.onTitleChange || (title => updateThemaTitle(thema.id, title))}
                  onDelete={handlers.onDelete || (() => removeThema(thema.id))}
                  onAddKsfKpi={handlers.onAddKsfKpi || (type => addKsfKpi(thema.id, type))}
                  onUpdateKsfKpi={handlers.onUpdateKsfKpi || (item => updateKsfKpiItem(thema.id, item))}
                  onDeleteKsfKpi={handlers.onDeleteKsfKpi || (id => removeKsfKpi(thema.id, id))}
                  onGenerateKsfKpi={handlers.onGenerateKsfKpi || (() => generateKsfKpiForThema(thema.id))}
                  ksfKpiDraft={ksfKpiDrafts[thema.id]}
                  onAcceptKsfKpiDraft={() => acceptKsfKpiDraft(thema.id)}
                  onRejectKsfKpiDraft={() => rejectKsfKpiDraft(thema.id)}
                  onRemoveDraftItem={(type, idx) => removeKsfKpiDraftItem(thema.id, type, idx)}
                />
              );
            })}
            {themas.length < 7 && (
              <button onClick={addThema}
                className="w-full border-2 border-dashed border-slate-200 hover:border-[var(--color-accent)]/50 rounded-lg py-3 text-xs font-semibold text-slate-400 hover:text-[var(--color-success)] transition-colors flex items-center justify-center gap-2">
                <Plus size={14} />
                Strategisch Thema handmatig toevoegen {themas.length > 0 ? `(${themas.length}/7)` : ""}
              </button>
            )}
            {themas.length === 0 && !themaDraft && (
              <p className="text-center text-xs text-slate-300 italic py-4">
                Gebruik 🪄 Genereer Thema's of voeg een thema handmatig toe
              </p>
            )}
          </div>
        </section>
        )}
      </div>

      {/* ── Strategie OnePager overlay ── */}
      {showOnePager && (
        <Suspense fallback={null}>
          <StrategyOnePager
            core={core}
            items={items}
            themas={themas}
            canvasId={canvasId}
            onClose={() => setShowOnePager(false)}
            analysis={analysis}
          />
        </Suspense>
      )}

      {/* ── Inzichten overlay — S2 instructie B: Analyse-handler verhuist hier
            als hoofdactie zodat werkblad-header alleen Inzichten + Rapportage
            + Full Draft heeft (geen Analyse-knop meer). ── */}
      {showAdvies && (
        <InzichtenOverlay
          key={canvasId}
          canvasId={canvasId}
          insights={analysis}
          loading={analysisLoading}
          error={analysisError}
          onClose={() => setShowAdvies(false)}
          appLabel={appLabel}
          canvasName={canvasName}
          generatedAt={analysisUpdatedAt}
          worksheetName={appLabel("werkblad.strategie.title", "Strategie")}
          onAnalyse={handleAnalyze}
          analysing={analysisLoading}
          analyseLabel={
            analysisLoading
              ? appLabel("werkblad.action.analyseert", "Analyseren…")
              : analysis
                ? appLabel("werkblad.action.analyseer_opnieuw", "Opnieuw analyseren")
                : appLabel("werkblad.action.analyseer", "Analyse draaien")
          }
          // RFC-008 §4 service-injectie
          onSave={handleInsightSave}
          onToggleRapport={handleInsightToggleRapport}
          onOpenRapportage={handleOpenRapportage}
          headerLabel={
            canvasName
              ? `${appLabel("werkblad.strategie.inzichten.header", "Inzichten — Strategie")} — ${canvasName}`
              : appLabel("werkblad.strategie.inzichten.header", "Inzichten — Strategie")
          }
        />
      )}

      {/* ── 11.S Block 2 — Rapportage-menu (RFC-008 §6). Tile 1 (One-pager) is in
            Block 2 dood-href + TODO Block 3 — Block 3 wire't OnepagerBuilder. ── */}
      {rapportageMenuOpen && (
        <RapportageMenu
          open={rapportageMenuOpen}
          onClose={() => setRapportageMenuOpen(false)}
          // 11.S Block 3 — opent nieuwe OnepagerBuilder-overlay
          onSelectOnepager={() => {
            setRapportageMenuOpen(false);
            setOnepagerBuilderOpen(true);
          }}
          appLabel={appLabel}
          headerLabel={appLabel("werkblad.strategie.title", "Strategie")}
        />
      )}

      {/* ── 11.S Block 3 — OnepagerBuilder overlay. Werkblad-agnostisch via
            buildStrategieRapportageConfig (vasteBlokken + modelLib +
            dataResolver per blok). LayoutComponent=null → A4Preview rendert
            skelet-placeholder (Block 4 injecteert StrategyOnePager v2). ── */}
      {onepagerBuilderOpen && (
        <OnepagerBuilder
          open={onepagerBuilderOpen}
          onClose={() => setOnepagerBuilderOpen(false)}
          onBackToMenu={() => {
            setOnepagerBuilderOpen(false);
            setRapportageMenuOpen(true);
          }}
          config={buildStrategieRapportageConfig({
            strategyCore: core,
            themas,
            analysisItems: items,
            appLabel,
          })}
          insights={Array.isArray(analysis) ? analysis : []}
          appLabel={appLabel}
        />
      )}

      {/* Over Platform Workbench dialog — via OverflowMenu in WerkbladHeader laag 1 */}
      {showOverDialog && (
        <OverDialog onClose={() => setShowOverDialog(false)} />
      )}

      {/* T2 A2 — Strategie-invultips modal. Sections-prop bouwt 5 blokken op
          uit DB-keys; voorbeeld-keys mogen leeg zijn (alleen Missie/Visie/
          Ambitie hebben voorbeelden, Kernwaarden/Samenvatting niet — Kees-keuze).
          WerkbladTipsModal rendert voorbeeld-blok alleen als value niet-leeg. */}
      {showInvultips && (
        <WerkbladTipsModal
          title={appLabel("tips.strategie.modal.titel", "Invultips Strategie")}
          testIdPrefix="strat-tips"
          onClose={() => setShowInvultips(false)}
          sections={[
            { id: "missie",      titel: appLabel("strat.field.missie", "Missie"),
              tekst: appLabel("tips.strategie.missie.uitgebreid", ""),
              voorbeeld: appLabel("tips.strategie.missie.voorbeeld", "") },
            { id: "visie",       titel: appLabel("strat.field.visie", "Visie"),
              tekst: appLabel("tips.strategie.visie.uitgebreid", ""),
              voorbeeld: appLabel("tips.strategie.visie.voorbeeld", "") },
            { id: "ambitie",     titel: appLabel("strat.field.ambitie", "Ambitie (BHAG)"),
              tekst: appLabel("tips.strategie.ambitie.uitgebreid", ""),
              voorbeeld: appLabel("tips.strategie.ambitie.voorbeeld", "") },
            { id: "kernwaarden", titel: appLabel("strat.field.kernwaarden", "Kernwaarden"),
              tekst: appLabel("tips.strategie.kernwaarden.uitgebreid", ""),
              voorbeeld: appLabel("tips.strategie.kernwaarden.voorbeeld", "") },
            { id: "samenvatting",titel: appLabel("strat.field.samenvatting", "Strategische Samenvatting"),
              tekst: appLabel("tips.strategie.samenvatting.uitgebreid", ""),
              voorbeeld: appLabel("tips.strategie.samenvatting.voorbeeld", "") },
          ]}
        />
      )}
    </div>
  );
}
