import React, { useState, useEffect, useRef } from "react";
import { LangProvider, useLang } from "./i18n";
import {
  Zap, X, LogOut, Save, AlertOctagon,
  SlidersHorizontal, Database, ShieldCheck, Lightbulb,
  Info, Languages, Settings, FolderClock, Trash2, FileText,
} from "lucide-react";
import AiIcon from "./shared/components/AiIcon";
import OverflowMenu from "./shared/components/OverflowMenu";
import OverDialog from "./shared/components/OverDialog";
import { AuthProvider, useAuth } from "./shared/services/auth.service";
import ThemeProvider from "./shared/context/ThemeProvider";
import LoginScreen from "./LoginScreen";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import LogoBrand from "./shared/components/LogoBrand";
import { useTheme } from "./shared/hooks/useTheme";
import { useDocumentTitle } from "./shared/hooks/useDocumentTitle";
import { AppConfigProvider, useAppConfig } from "./shared/context/AppConfigContext";
import AdminPage from "./features/admin/AdminPage";

// Canvas feature
import BlockCard, { BLOCKS, getBlockStatus } from "./features/canvas/components/BlockCard";
import BlockPanel from "./features/canvas/components/BlockPanel";
import TipsModal from "./features/canvas/components/TipsModal";
import ConsistencyModal from "./features/canvas/components/ConsistencyModal";
import CanvasMenu from "./features/canvas/components/CanvasMenu";
import ProjectInfoSidebar from "./features/canvas/components/ProjectInfoSidebar";
import StrategyStatusBlock from "./features/canvas/components/StrategyStatusBlock";
import PrinciplesStatusBlock from "./features/canvas/components/PrinciplesStatusBlock";
import DeepDiveOverlay from "./features/canvas/components/DeepDiveOverlay";
import { useCanvasState } from "./features/canvas/hooks/useCanvasState";

// Dossier feature
import MasterImporterPanel from "./features/dossier/components/MasterImporterPanel";

// T1 B1 — versie + build-timestamp helpers. REACT_APP_BUILD_TIME wordt in
// build-script (package.json) ingespoten als ISO-string (date -u +%Y...). Bij
// dev (geen env-var) tonen we alleen de versie zonder timestamp.
const APP_VERSION = process.env.REACT_APP_VERSION || "0.1.0";
function formatBuildTime() {
  const raw = process.env.REACT_APP_BUILD_TIME;
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    // DD-MM HH:MM in Europe/Amsterdam — leesbaar formaat voor versie-pill
    const fmt = new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });
    // Output is bv. "14-05 10:30" — Intl gebruikt al , als separator; strippen we
    return fmt.format(d).replace(",", "").trim();
  } catch (_e) {
    return "";
  }
}
const APP_BUILD_LABEL = formatBuildTime();

// ── Main App ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { t, lang, setLang }        = useLang();
  const { user, signOut, tenantId } = useAuth();
  const { label: appLabel }         = useAppConfig();
  const { brandName }               = useTheme();

  // ── UI-only state (panels, modals — geen business logic) ──────────────────
  const [activeBlockId,   setActiveBlockId]   = useState(null);
  const [deepDiveBlockId, setDeepDiveBlockId] = useState(null);
  const [showConsistency, setShowConsistency] = useState(false);
  const [showTips,        setShowTips]        = useState(false);
  const [showImporter,    setShowImporter]    = useState(false);
  const [tipsSection,     setTipsSection]     = useState("algemeen");
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showOverDialog,  setShowOverDialog]  = useState(false);

  // Retro-fix Bev. 2 — Canvas-verwijderen via OverflowMenu. Inline-confirm
  // pattern (hergebruik van CanvasMenu.jsx:99-133-stijl, geen nieuwe component).
  const [showDeleteCanvasConfirm, setShowDeleteCanvasConfirm] = useState(false);
  const [deletingCanvas, setDeletingCanvas] = useState(false);
  const [deleteCanvasError, setDeleteCanvasError] = useState(null);

  // T1 A4 — Rapportage placeholder-modal (klikbaar, opent simpele info-modal
  // tot canvas-brede print/PDF gebouwd is). Eigen state ipv WerkbladActieknoppen-
  // disabled-pattern omdat we wel een klik-feedback willen geven.
  const [showRapportPlaceholder, setShowRapportPlaceholder] = useState(false);

  // ── Canvas state + handlers (business logic in hook) ──────────────────────
  const {
    activeCanvasId, canvases, scope, meta, docs, insights, bullets,
    strategyManual, guidelineCounts, canvasSummary, saveStatus, multiTabWarning,
    setMeta, setMultiTabWarning, setStrategyManual, refreshGuidelineCounts, refreshCanvasSummary,
    handleNewCanvas, handleSelectCanvas, handleRenameCanvas, handleDeleteCanvas,
    handleLoadExample, handleDocsChange, handleInsightAccept, handleInsightReject,
    handleMoveToBullets, handleDeleteBullet, handleAddBullet,
  } = useCanvasState({
    user,
    tenantId,
    lang,
    onCanvasSwitch: () => {
      setActiveBlockId(null);
      setDeepDiveBlockId(null);
    },
  });

  useDocumentTitle();

  const activeBlock = BLOCKS.find(b => b.id === activeBlockId);
  const allDone     = BLOCKS.every(b => (bullets[b.id] || []).length > 0);
  // T1 B2: subtiele doc-count badge op Dossier-knop. Hergebruikt count-bron
  // uit CanvasMenu (canvases[].canvas_uploads.length). 0 → geen badge.
  const activeDocCount = (canvases.find(c => c.id === activeCanvasId)?.canvas_uploads?.length) || 0;

  // ── Herlaad guideline counts als gebruiker het richtlijnen werkblad sluit ────
  // + S1 design-systeem F12: herlaad canvas-summary na elke werkblad-close
  // zodat tegel-feedback up-to-date is na mutaties.
  const prevDeepDiveRef = useRef(null);
  useEffect(() => {
    if (prevDeepDiveRef.current !== null && deepDiveBlockId === null && activeCanvasId) {
      if (prevDeepDiveRef.current === "principles") {
        refreshGuidelineCounts(activeCanvasId);
      }
      refreshCanvasSummary(activeCanvasId);
    }
    prevDeepDiveRef.current = deepDiveBlockId;
  }, [deepDiveBlockId, activeCanvasId, refreshGuidelineCounts, refreshCanvasSummary]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[var(--color-primary)] font-sans flex flex-col">

      {/* Header — S1 design-systeem §3.7: 68px charcoal-strip op canvas-niveau
          (50px op werkblad). border-b-2 accent-line behouden voor brand-anker. */}
      <header className="h-[68px] bg-[var(--color-primary)] flex items-center justify-between z-20 border-b-2 border-[var(--color-accent)] shrink-0 shadow-lg">

        {/* Left: logo + app title + versie-pill (designer §7 punt 11).
            Retro-fix Bev. 1 — gebruik LoginScreen-pattern (dark logo in witte
            tile) zodat /kf-logo.png — bestaand asset — zichtbaar is op donkere
            charcoal-strip. variant="light" zonder tile faalde voor tenants
            zonder logo_white_url-asset (KF heeft NULL → fallback-pad
            /kf-logo-white.png bestaat niet → text-fallback). Witte tile
            werkt voor alle tenants met een donker-logo en is al consistent
            toegepast op LoginScreen.js:78-86. */}
        <div className="flex items-center h-full shrink-0">
          <div className="px-6 flex items-center justify-center h-full shrink-0 border-r border-white/10">
            <div className="bg-white rounded px-2 py-1">
              <LogoBrand
                variant="dark"
                imgClassName="h-8 w-auto object-contain"
                textClassName="text-[var(--color-primary)] font-bold text-base tracking-wide px-1"
              />
            </div>
          </div>
          <div className="px-6 border-r border-white/10 h-full flex flex-col justify-center">
            <div className="flex items-baseline gap-2">
              <h1 className="text-md tracking-tight text-white leading-none">
                {appLabel("app.title", "Business Transformation Workbench")}
              </h1>
              <span
                data-testid="header-versie-pill"
                className="font-mono text-xs px-1.5 py-0.5 rounded text-[var(--color-accent)]"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)" }}
                title={APP_BUILD_LABEL ? `v${APP_VERSION} — gebouwd ${APP_BUILD_LABEL}` : `Versie ${APP_VERSION}`}
              >
                v{APP_VERSION}{APP_BUILD_LABEL ? ` · ${APP_BUILD_LABEL}` : ""}
              </span>
            </div>
            <p className="text-xs tracking-wide text-[var(--color-accent)] mt-1.5">
              {appLabel("app.subtitle", "Platform voor strategie tot executie")}
            </p>
          </div>
        </div>

        {/* Centre: canvas selector */}
        <div className="flex-1 flex items-center justify-center px-8">
          <CanvasMenu
            currentName={scope}
            activeCanvasId={activeCanvasId}
            canvases={canvases}
            onNew={handleNewCanvas}
            onSelect={handleSelectCanvas}
            onRename={handleRenameCanvas}
            onLoadExample={handleLoadExample}
            onDelete={handleDeleteCanvas}
          />
        </div>

        {/* Right: save-status + Dossier + Tips + overflow-menu (designer §7 punt 9+10).
            Dossier + Tips zijn canvas-niveau-tools (niet werkblad-niveau).
            Lang-switch + Consistency-check + Project-info + Admin + Uitloggen + Over
            verhuizen naar overflow-menu (was 2x hamburger + losse logout). */}
        <div className="flex items-center gap-2 px-6 shrink-0">

          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Save size={10} className="animate-pulse" /> Opslaan…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-accent)]">
              <Zap size={10} /> Opgeslagen
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertOctagon size={10} /> Opslaan mislukt
            </span>
          )}

          {/* Dossier — canvas-niveau-tool. T1 B2: subtiel count-badge wanneer
              docs aanwezig (hergebruik canvases[].canvas_uploads.length-bron
              uit CanvasMenu-dropdown). */}
          <button
            onClick={() => setShowImporter(true)}
            data-testid="header-tool-dossier"
            className="relative flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
            title={activeDocCount > 0
              ? `Het Dossier — ${activeDocCount} ${activeDocCount === 1 ? "document" : "documenten"} geüpload`
              : "Het Dossier — documenten importeren"}
          >
            <Database size={14} /> Dossier
            {activeDocCount > 0 && (
              <span
                data-testid="header-dossier-count"
                className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[var(--color-accent)] text-[var(--color-primary)]"
              >
                {activeDocCount}
              </span>
            )}
          </button>

          {/* Tips — canvas-niveau-tool */}
          <button
            onClick={() => { setTipsSection("algemeen"); setShowTips(true); }}
            data-testid="header-tool-tips"
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
            title={t("tips.title")}
          >
            <Lightbulb size={14} /> {t("header.tips")}
          </button>

          {/* Inzichten — canvas-niveau-werkflow-knop. Spiegelt werkblad-
              WerkbladActieknoppen-pattern (Inzichten = AI-analyse). Opent
              ConsistencyModal die cross-block-coherentie-check doet — voor
              nu identiek aan de oude Consistency-check, in latere sprint
              uit te breiden naar volwaardige AI-driven canvas-inzichten. */}
          <button
            onClick={() => setShowConsistency(true)}
            data-testid="header-tool-inzichten"
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
            title={appLabel("header.inzichten.tooltip", "Canvas-brede inzichten en consistentie-check")}
          >
            <AiIcon variant="generate" size={14} colorClass="text-white/70" />
            {appLabel("header.inzichten", "Inzichten")}
          </button>

          {/* Rapportage — canvas-niveau-werkflow-knop. T1 A4: klikbaar met
              placeholder-modal tot canvas-brede print/PDF gebouwd is. */}
          <button
            type="button"
            onClick={() => setShowRapportPlaceholder(true)}
            data-testid="header-tool-rapportage"
            title={appLabel("header.rapportage.tooltip", "Canvas-rapportage volgt in volgende release")}
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
          >
            <FileText size={14} /> {appLabel("header.rapportage", "Rapportage")}
          </button>

          {/* Overflow-menu — vervangt 2x hamburger-icoon + losse logout */}
          <OverflowMenu
            items={[
              {
                id: "lang",
                label: lang === "nl" ? "Switch to English" : "Schakel naar Nederlands",
                icon: Languages,
                onClick: () => setLang(lang === "nl" ? "en" : "nl"),
              },
              {
                id: "project-details",
                label: showInfoSidebar ? "Verberg project-details" : "Project-details",
                icon: SlidersHorizontal,
                onClick: () => setShowInfoSidebar(s => !s),
                divider: true,
              },
              {
                id: "canvas-historie",
                label: "Canvas-historie",
                icon: FolderClock,
                onClick: () => {},  // placeholder — designer-spec, geen impl yet
                hidden: true,        // verborgen tot impl er is (latere fase)
              },
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
              // Retro-fix Bev. 2 — Canvas verwijderen-pad voor het ACTIEVE canvas.
              // Hidden als geen canvas open (anders niets om te verwijderen).
              {
                id: "delete-canvas",
                label: "Canvas verwijderen",
                icon: Trash2,
                onClick: () => {
                  setDeleteCanvasError(null);
                  setShowDeleteCanvasConfirm(true);
                },
                divider: true,
                danger: true,
                hidden: !activeCanvasId,
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
          />
        </div>
      </header>

      {/* Multi-tab waarschuwing */}
      {multiTabWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-6 py-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <X size={14} />
            De app is al geopend in een ander tabblad. Wijzigingen in dit tabblad kunnen overschreven worden.
          </span>
          <button onClick={() => setMultiTabWarning(false)} className="text-amber-500 hover:text-amber-800 ml-4">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dashboard + optionele sidebar */}
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 p-10 overflow-auto">

          {/* Canvas grid — BTC layout (12-col) */}
          <div className="grid grid-cols-12 gap-5">

            {/* Row 1: Strategy — full width status dashboard */}
            {BLOCKS.filter(b => b.id === "strategy").map(block => (
              <StrategyStatusBlock
                key={block.id}
                block={block}
                status={getBlockStatus(block.id, docs, insights, bullets)}
                bullets={bullets[block.id]}
                strategyManual={strategyManual}
                onClick={() => setDeepDiveBlockId(block.id)}
                onDeepDive={() => setDeepDiveBlockId(block.id)}
              />
            ))}

            {/* Row 2: Guiding Principles — full width status block */}
            {BLOCKS.filter(b => b.id === "principles").map(block => (
              <PrinciplesStatusBlock
                key={block.id}
                block={block}
                status={getBlockStatus(block.id, docs, insights, bullets)}
                bullets={bullets[block.id]}
                guidelineCounts={guidelineCounts}
                onClick={() => setDeepDiveBlockId(block.id)}
              />
            ))}

            {/* Row 3: 4 Pillars — equal quarters */}
            {BLOCKS.filter(b =>
              ["customers", "processes", "people", "technology"].includes(b.id)
            ).map(block => (
              <BlockCard
                key={block.id}
                block={block}
                status={getBlockStatus(block.id, docs, insights, bullets)}
                bullets={bullets[block.id]}
                insightCount={(insights[block.id] || []).filter(i => i.status === "pending").length}
                summary={canvasSummary}
                onClick={() => setDeepDiveBlockId(block.id)}
              />
            ))}

            {/* Row 4: Portfolio Roadmap — full width */}
            <BlockCard
              key="portfolio"
              block={BLOCKS.find(b => b.id === "portfolio")}
              status={getBlockStatus("portfolio", docs, insights, bullets)}
              bullets={bullets["portfolio"]}
              insightCount={(insights["portfolio"] || []).filter(i => i.status === "pending").length}
              summary={canvasSummary}
              onClick={() => setDeepDiveBlockId("portfolio")}
            />
          </div>

          {/* Footer row */}
          <div className="mt-8 flex items-center justify-between">
            {allDone ? (
              <button
                onClick={() => setShowConsistency(true)}
                className="flex items-center gap-2 bg-[var(--color-success)] hover:bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest shadow-sm transition-colors"
              >
                <ShieldCheck size={14} /> {t("progress.all.done")}
              </button>
            ) : <div />}
            {/* T1 A5: footer per tenant — "© {brandName} · v{versie}" pattern. */}
            <p
              data-testid="canvas-footer-tekst"
              className="text-[9px] text-slate-400 uppercase tracking-widest font-mono"
            >
              © {brandName} · v{APP_VERSION}{APP_BUILD_LABEL ? ` · ${APP_BUILD_LABEL}` : ""}
            </p>
          </div>
        </main>

        {/* Project Info Sidebar */}
        {showInfoSidebar && (
          <ProjectInfoSidebar meta={meta} onChange={setMeta} />
        )}
      </div>

      {/* Sliding block panel */}
      {activeBlockId && (
        <BlockPanel
          block={activeBlock}
          docs={docs}
          insights={insights}
          bullets={bullets}
          canvasId={activeCanvasId}
          userId={user?.id}
          onClose={() => setActiveBlockId(null)}
          onDocsChange={handleDocsChange}
          onInsightAccept={handleInsightAccept}
          onInsightReject={handleInsightReject}
          onMoveToBullets={handleMoveToBullets}
          onDeleteBullet={handleDeleteBullet}
          onAddBullet={handleAddBullet}
          onShowTips={(blockId) => { setTipsSection(blockId); setShowTips(true); }}
        />
      )}

      {/* Consistency modal */}
      {showConsistency && (
        <ConsistencyModal bullets={bullets} onClose={() => setShowConsistency(false)} />
      )}

      {/* Tips modal */}
      {showTips && (
        <TipsModal initialSection={tipsSection} onClose={() => setShowTips(false)} />
      )}

      {/* Master Importer (Het Dossier) */}
      {showImporter && (
        <MasterImporterPanel
          key={activeCanvasId}
          canvasId={activeCanvasId}
          userId={user?.id}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Over Platform Workbench dialog (Fase 3 design-systeem §7 punt 11) */}
      {showOverDialog && (
        <OverDialog onClose={() => setShowOverDialog(false)} />
      )}

      {/* T1 A4 — Canvas-rapportage placeholder-modal (klikbaar tot canvas-brede
          print/PDF gebouwd is). Eenvoudige info-modal met sluit-knop. */}
      {showRapportPlaceholder && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-6"
          onClick={() => setShowRapportPlaceholder(false)}
          data-testid="rapport-placeholder-overlay"
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            data-testid="rapport-placeholder-dialog"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-primary)] mb-1">
                  {appLabel("header.rapportage.placeholder.titel", "Canvas-rapportage")}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {appLabel(
                    "header.rapportage.placeholder.tekst",
                    "Canvas-brede rapportage (PDF / print over alle werkbladen heen) volgt in een volgende release. Voor nu kun je per werkblad een rapport draaien via de Rapportage-knop daar."
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowRapportPlaceholder(false)}
                className="text-xs font-bold text-[var(--color-primary)] bg-slate-100 hover:bg-slate-200 rounded px-4 py-2 transition-colors"
                data-testid="rapport-placeholder-sluiten"
              >
                {appLabel("header.rapportage.placeholder.sluiten", "Begrepen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retro-fix Bev. 2 — Canvas-verwijderen confirm-dialog (inline-pattern,
          hergebruik van CanvasMenu.jsx:99-133 red-bordered confirm-stijl). */}
      {showDeleteCanvasConfirm && activeCanvasId && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-6"
          onClick={() => !deletingCanvas && setShowDeleteCanvasConfirm(false)}
          data-testid="delete-canvas-confirm-overlay"
        >
          <div
            className="bg-red-50 border border-red-200 rounded-lg shadow-2xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            data-testid="delete-canvas-confirm-dialog"
          >
            <p className="text-sm font-semibold text-red-700 mb-2">
              Verwijder "{scope || "Naamloos"}"?
            </p>
            <p className="text-xs text-red-500 mb-3">
              Dit verwijdert ook alle geüploade documenten en chunks. Niet ongedaan te maken.
            </p>
            {deleteCanvasError && (
              <p className="text-xs text-red-600 font-semibold mb-3 bg-red-100 rounded px-2 py-1">
                {deleteCanvasError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteCanvasConfirm(false); setDeleteCanvasError(null); }}
                disabled={deletingCanvas}
                className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded px-3 py-1.5 transition-colors"
                data-testid="delete-canvas-cancel"
              >
                Annuleer
              </button>
              <button
                disabled={deletingCanvas}
                onClick={async () => {
                  setDeleteCanvasError(null);
                  setDeletingCanvas(true);
                  const result = await handleDeleteCanvas(activeCanvasId);
                  setDeletingCanvas(false);
                  if (result?.error) {
                    setDeleteCanvasError("Verwijderen mislukt. Probeer het opnieuw.");
                  } else {
                    setShowDeleteCanvasConfirm(false);
                  }
                }}
                className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded px-3 py-1.5 transition-colors"
                data-testid="delete-canvas-confirm"
              >
                {deletingCanvas ? "Bezig…" : "Ja, verwijder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Dive Overlay — werkblad per blok via registry */}
      {deepDiveBlockId && (
        <DeepDiveOverlay
          blockId={deepDiveBlockId}
          canvasId={activeCanvasId}
          onClose={() => setDeepDiveBlockId(null)}
          onManualSaved={m => {
            if (deepDiveBlockId === "strategy") setStrategyManual(m);
          }}
        />
      )}
    </div>
  );
}

// ── Auth-guard wrapper ────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || "";

function AuthGate() {
  const { session, signOut, profileLoading, tenantId } = useAuth();
  const isAdminRoute = window.location.pathname === "/admin";

  // Wacht tot sessie én user_profiles geladen zijn
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  // Ingelogd maar geen tenant-profiel gevonden
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-[var(--color-primary)] flex items-center justify-center">
        <div className="text-center text-white space-y-3 max-w-md px-6">
          <p className="text-lg font-bold">Account wacht op activatie</p>
          <p className="text-white/70 text-sm">
            Je account wacht nog op activatie. Neem contact op met je beheerder.
          </p>
          <button
            onClick={signOut}
            className="mt-4 text-[var(--color-accent)] text-sm hover:underline"
          >
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  // Admin route — alleen voor beheerder
  if (isAdminRoute) {
    if (session.user?.email !== ADMIN_EMAIL) {
      return (
        <div className="min-h-screen bg-[var(--color-primary)] flex items-center justify-center">
          <div className="text-center text-white space-y-3">
            <p className="text-lg font-bold">Geen toegang</p>
            <p className="text-white/60 text-sm">Deze pagina is alleen voor beheerders.</p>
            <a href="/" className="block text-[var(--color-accent)] text-sm hover:underline">← Terug naar app</a>
          </div>
        </div>
      );
    }
    return <AdminPage user={session.user} onSignOut={signOut} />;
  }

  // Normale app
  return <AppInner />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <LangProvider>
            <AppConfigProvider>
              <AuthGate />
            </AppConfigProvider>
          </LangProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
