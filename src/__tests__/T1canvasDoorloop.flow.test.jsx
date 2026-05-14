/**
 * T1 Canvas-doorloop — RTL voor Kees-test-bevindingen 14 mei.
 *
 * Cases (8 — overstijgt 6+ instructie):
 *   1. LogoBrand op Platform-tenant toont Platform-asset (img met /platform-logo.svg)
 *   2. useTheme retourneert null voor logoUrl bij ontbrekende tenant-config
 *      (negative-assertion KF-hardcoded-fallback weg — OBS-14)
 *   3. Tips-knop rendert Lightbulb-icoon (data-lucide attribute)
 *   4. Rapportage-knop op canvas is klikbaar → opent placeholder-modal
 *   5. Footer-tekst gebruikt "© {brand_name} · v{versie}"-pattern
 *   6. Leidende-principes-canvas-tegel rendert 5 categorieën
 *   7. Dossier-icoon toont count-badge wanneer canvas docs heeft
 *   8. Dossier-icoon GEEN badge wanneer canvas 0 docs heeft (negative)
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Auth/Theme-mock (laagt configurabel per case via beforeEach-reset) ──
const mockTenantTheme = {
  brand_name: "Platform",
  logo_url: "/platform-logo.svg",
  logo_white_url: "/platform-logo-white.svg",
};
const mockCanvases = [{ id: "canvas-1", name: "Test Canvas", canvas_uploads: [] }];
const mockActiveCanvasId = "canvas-1";

jest.mock("../shared/services/auth.service", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: "u1", email: "kees@test" },
    session: { user: { id: "u1", email: "kees@test" } },
    signOut: jest.fn(),
    profileLoading: false,
    tenantId: "tenant-1",
    get tenantTheme() { return mockTenantTheme; },
    userRole: "tenant_admin",
  }),
}));

jest.mock("../shared/context/ThemeProvider", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../shared/context/AppConfigContext", () => ({
  AppConfigProvider: ({ children }) => children,
  useAppConfig: () => ({
    label:  (k, fb) => fb ?? k,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));
jest.mock("../shared/hooks/useDocumentTitle", () => ({ useDocumentTitle: jest.fn() }));
jest.mock("../i18n", () => ({
  LangProvider: ({ children }) => children,
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

jest.mock("../features/canvas/hooks/useCanvasState", () => ({
  useCanvasState: () => ({
    activeCanvasId:        mockActiveCanvasId,
    canvases:              mockCanvases,
    scope:                 "Test Canvas",
    meta:                  {},
    docs:                  {},
    insights:              {},
    bullets:               {},
    strategyManual:        null,
    guidelineCounts:       { generiek: 3, klanten: 2 },
    canvasSummary:         null,
    saveStatus:            "idle",
    multiTabWarning:       false,
    setMeta:               jest.fn(),
    setMultiTabWarning:    jest.fn(),
    setStrategyManual:     jest.fn(),
    refreshGuidelineCounts: jest.fn(),
    refreshCanvasSummary:  jest.fn(),
    handleNewCanvas:       jest.fn(),
    handleSelectCanvas:    jest.fn(),
    handleRenameCanvas:    jest.fn(),
    handleDeleteCanvas:    jest.fn(),
    handleLoadExample:     jest.fn(),
    handleDocsChange:      jest.fn(),
    handleInsightAccept:   jest.fn(),
    handleInsightReject:   jest.fn(),
    handleMoveToBullets:   jest.fn(),
    handleDeleteBullet:    jest.fn(),
    handleAddBullet:       jest.fn(),
  }),
}));

// Mock zware sub-rendering — focus op header + footer + tegel-render.
jest.mock("../features/canvas/components/BlockPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/TipsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/ConsistencyModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/ProjectInfoSidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/StrategyStatusBlock", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/DeepDiveOverlay", () => ({ __esModule: true, default: () => null }));
// BlockCard mocken — leeg default-component, maar wel STATUS_COLORS/STATUS_BADGE_KEYS
// doorgeven want PrinciplesStatusBlock importeert die direct (test 6).
jest.mock("../features/canvas/components/BlockCard", () => ({
  __esModule: true,
  default: () => null,
  BLOCKS: [],
  getBlockStatus: () => "empty",
  STATUS_COLORS: { empty: "bg-white" },
  STATUS_BADGE_KEYS: { empty: { labelKey: "status.empty", color: "bg-slate-100" } },
  PILLAR_SUBTABS: [],
  PRINCIPLES_SUBTABS: [],
}));
jest.mock("../features/dossier/components/MasterImporterPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/admin/AdminPage", () => ({ __esModule: true, default: () => null }));
jest.mock("../shared/components/ErrorBoundary", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("../features/canvas/components/CanvasMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="canvas-menu-stub" />,
}));

import App from "../App";

describe("T1 — Platform-logo + useTheme-fix (A1, OBS-14)", () => {
  test("1. Header rendert Platform-logo-img met /platform-logo.svg (variant=dark in witte tile)", () => {
    render(<App />);
    const img = document.querySelector("header img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("/platform-logo.svg");
    // Witte tile-wrapper
    const tile = img.closest("div.bg-white");
    expect(tile).not.toBeNull();
    expect(tile.className).toMatch(/rounded/);
  });

  test("2. useTheme retourneert null voor logoUrl bij ontbrekende tenant-config (OBS-14 fix — static-check)", () => {
    // Statisch verifiëren — useTheme.js bevat geen KF-hardcoded fallback meer.
    // Hier doen we content-assertion: de oude `?? "/kf-logo.png"`-fallback is weg
    // en vervangen door `?? null`. Runtime-isolation faalt op react-internal-errors
    // (jest.isolateModules + module-mock-resync), dus pragmatisch source-grep.
    // eslint-disable-next-line global-require
    const fs = require("fs");
    // eslint-disable-next-line global-require
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "../shared/hooks/useTheme.js"), "utf8");
    // Negative assertions: geen KF-hardcoded fallbacks
    expect(src).not.toMatch(/\?\?\s*["']\/kf-logo\.png["']/);
    expect(src).not.toMatch(/\?\?\s*["']\/kf-logo-white\.png["']/);
    // Positive: nieuwe null-fallbacks aanwezig op logoUrl + logoWhiteUrl
    expect(src).toMatch(/logoUrl[\s\S]*?tenantTheme\?\.logo_url\s+\?\?\s+null/);
    expect(src).toMatch(/logoWhiteUrl[\s\S]*?tenantTheme\?\.logo_white_url\s+\?\?\s+null/);
  });
});

describe("T1 — Tips Lightbulb-icoon (A3)", () => {
  test("3. Tips-knop rendert Lightbulb-icoon (lucide-react svg)", () => {
    render(<App />);
    const tipsBtn = screen.getByTestId("header-tool-tips");
    // Lucide-React rendert svg met `lucide-lightbulb`-class
    const svg = tipsBtn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toMatch(/lucide-lightbulb/i);
  });
});

describe("T1 — Rapportage placeholder-modal (A4)", () => {
  test("4. Rapportage-knop klikbaar → opent placeholder-modal", async () => {
    render(<App />);
    const btn = screen.getByTestId("header-tool-rapportage");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(await screen.findByTestId("rapport-placeholder-dialog")).toBeInTheDocument();
    // Sluit-knop werkt
    fireEvent.click(screen.getByTestId("rapport-placeholder-sluiten"));
    expect(screen.queryByTestId("rapport-placeholder-dialog")).not.toBeInTheDocument();
  });
});

describe("T1 — Footer (A5)", () => {
  test("5. Footer-tekst gebruikt '© {brand_name} · v{versie}'-pattern", () => {
    render(<App />);
    const footer = screen.getByTestId("canvas-footer-tekst");
    expect(footer).toHaveTextContent(/© Platform/);
    expect(footer).toHaveTextContent(/v0\.1\.0|v\d+\.\d+/);
  });
});

describe("T1 — Leidende-principes 5 categorieën (A9)", () => {
  test("6. PrinciplesStatusBlock rendert 5 categorieën-labels", async () => {
    // Render direct (niet via App.js BlockCard-mock).
    const PrinciplesStatusBlock = require("../features/canvas/components/PrinciplesStatusBlock").default;
    const { container } = render(
      <PrinciplesStatusBlock
        block={{ id: "principles", titleKey: "block.principles.title" }}
        status="empty"
        bullets={[]}
        guidelineCounts={{ generiek: 1 }}
        onClick={() => {}}
      />
    );
    // Verifieer 5 segment-labels (generiek, klanten, processen, mensen, it).
    // Labels worden upper-cased via CSS — textContent geeft Title-Case terug.
    const text = container.textContent;
    expect(text).toMatch(/Generiek/);
    expect(text).toMatch(/Klanten/);
    expect(text).toMatch(/Processen/);
    expect(text).toMatch(/Mensen/);
    // "IT"-label staat direct na "Mensen" zonder spacer (textContent joint kinderen)
    expect(text).toMatch(/IT/);
    // Negative-assert: oude 4-categorie-staat ("Organisatie"-label) niet meer aanwezig.
    expect(text).not.toMatch(/Organisatie/);
  });
});

describe("T1 — Dossier-doc-count badge (B2)", () => {
  test("7. Dossier-icoon toont count-badge bij N docs", () => {
    mockCanvases[0].canvas_uploads = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
    render(<App />);
    const badge = screen.getByTestId("header-dossier-count");
    expect(badge).toHaveTextContent("3");
    // Cleanup voor case 8
    mockCanvases[0].canvas_uploads = [];
  });

  test("8. Dossier-icoon GEEN badge bij 0 docs (negative)", () => {
    mockCanvases[0].canvas_uploads = [];
    render(<App />);
    expect(screen.queryByTestId("header-dossier-count")).not.toBeInTheDocument();
  });
});
