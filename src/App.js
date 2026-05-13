import React, { useState, useEffect, useRef } from "react";
import { LangProvider, useLang } from "./i18n";
import {
  Zap, X, LogOut, Save, AlertOctagon,
  SlidersHorizontal, Database, ShieldCheck, Maximize2,
  Info, Languages, Settings, FolderClock,
} from "lucide-react";
import OverflowMenu from "./shared/components/OverflowMenu";
import OverDialog from "./shared/components/OverDialog";
import { AuthProvider, useAuth } from "./shared/services/auth.service";
import ThemeProvider from "./shared/context/ThemeProvider";
import LoginScreen from "./LoginScreen";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import LogoBrand from "./shared/components/LogoBrand";
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

// ── Main App ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { t, lang, setLang }        = useLang();
  const { user, signOut, tenantId } = useAuth();
  const { label: appLabel }         = useAppConfig();

  // ── UI-only state (panels, modals — geen business logic) ──────────────────
  const [activeBlockId,   setActiveBlockId]   = useState(null);
  const [deepDiveBlockId, setDeepDiveBlockId] = useState(null);
  const [showConsistency, setShowConsistency] = useState(false);
  const [showTips,        setShowTips]        = useState(false);
  const [showImporter,    setShowImporter]    = useState(false);
  const [tipsSection,     setTipsSection]     = useState("algemeen");
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showOverDialog,  setShowOverDialog]  = useState(false);

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

        {/* Left: logo + app title + versie-pill (designer §7 punt 11) */}
        <div className="flex items-center h-full shrink-0">
          <div className="px-6 flex items-center justify-center h-full shrink-0 border-r border-white/10">
            <LogoBrand
              variant="light"
              imgClassName="h-10 w-auto object-contain object-center"
              textClassName="text-white font-bold text-lg tracking-wide"
            />
          </div>
          <div className="px-6 border-r border-white/10 h-full flex flex-col justify-center">
            <div className="flex items-baseline gap-2">
              <h1 className="text-md tracking-tight text-white leading-none">
                {appLabel("app.title", "Strategy Platform")}
              </h1>
              <span
                data-testid="header-versie-pill"
                className="font-mono text-xs px-1.5 py-0.5 rounded text-[var(--color-accent)]"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)" }}
                title={`Versie ${process.env.REACT_APP_VERSION || "0.1.0"}`}
              >
                v{process.env.REACT_APP_VERSION || "0.1.0"}
              </span>
            </div>
            <p className="text-xs tracking-wide text-[var(--color-accent)] mt-1.5">
              {appLabel("app.subtitle", "From strategy to execution")}
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

          {/* Dossier — canvas-niveau-tool */}
          <button
            onClick={() => setShowImporter(true)}
            data-testid="header-tool-dossier"
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
            title="Het Dossier — documenten importeren"
          >
            <Database size={14} /> Dossier
          </button>

          {/* Tips — canvas-niveau-tool */}
          <button
            onClick={() => { setTipsSection("algemeen"); setShowTips(true); }}
            data-testid="header-tool-tips"
            className="flex items-center gap-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-md text-sm transition-all"
            title={t("tips.title")}
          >
            <Maximize2 size={14} /> {t("header.tips")}
          </button>

          {/* Consistency-check — primary action, behoudt prominentie */}
          <button
            onClick={() => setShowConsistency(true)}
            data-testid="header-tool-consistency"
            className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] px-3 py-2 rounded-md text-sm transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            <ShieldCheck size={14} /> {t("header.consistency")}
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
            <p className="text-[9px] text-slate-300 uppercase tracking-widest">
              {appLabel("footer.tagline", "From strategy to execution")}
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
