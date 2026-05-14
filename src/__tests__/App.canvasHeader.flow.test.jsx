/**
 * Retro-fix RTL — canvas-header (App.js) integration suite voor:
 *  • Tools-zone-compositie: Dossier + Tips + Inzichten + Rapportage
 *    (Consistency-knop verwijderd uit tools-zone — werkblad-pattern op
 *    canvas-niveau, post-feedback Kees 13-mei avond)
 *  • Bev. 2 Canvas-delete OverflowMenu-item
 *  • Bev. 1 KF-logo Optie C login-pattern
 *
 * Optie A-pattern: mock auth.service + useCanvasState + AppConfig + LangProvider
 * + Theme + zware modals. Render <AppInner> via default export <App>; AuthGate
 * routeert via session-mock direct naar AppInner zonder LoginScreen.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock auth.service: AuthProvider als pass-through + useAuth-stub ──
jest.mock("../shared/services/auth.service", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: "u1", email: "kees@test" },
    session: { user: { id: "u1", email: "kees@test" } },
    signOut: jest.fn(),
    profileLoading: false,
    tenantId: "tenant-1",
    tenantTheme: { brand_name: "Platform", logo_url: "/platform-logo.svg", logo_white_url: "/platform-logo-white.svg" },
    userRole: "tenant_admin",
  }),
}));

// ── Mock ThemeProvider als pass-through ──
jest.mock("../shared/context/ThemeProvider", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

// ── Mock useAppConfig + provider ──
jest.mock("../shared/context/AppConfigContext", () => ({
  AppConfigProvider: ({ children }) => children,
  useAppConfig: () => ({
    label:  (k, fb) => fb ?? k,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

// ── Mock useDocumentTitle ──
jest.mock("../shared/hooks/useDocumentTitle", () => ({
  useDocumentTitle: jest.fn(),
}));

// ── Mock i18n LangProvider ──
jest.mock("../i18n", () => ({
  LangProvider: ({ children }) => children,
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

// ── Mock useCanvasState ──
const mockHandleDeleteCanvas = jest.fn().mockResolvedValue({ error: null });
jest.mock("../features/canvas/hooks/useCanvasState", () => ({
  useCanvasState: () => ({
    activeCanvasId:        "canvas-1",
    canvases:              [{ id: "canvas-1", name: "Test Canvas" }],
    scope:                 "Test Canvas",
    meta:                  {},
    docs:                  {},
    insights:              {},
    bullets:               {},
    strategyManual:        null,
    guidelineCounts:       {},
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
    handleDeleteCanvas:    mockHandleDeleteCanvas,
    handleLoadExample:     jest.fn(),
    handleDocsChange:      jest.fn(),
    handleInsightAccept:   jest.fn(),
    handleInsightReject:   jest.fn(),
    handleMoveToBullets:   jest.fn(),
    handleDeleteBullet:    jest.fn(),
    handleAddBullet:       jest.fn(),
  }),
}));

// ── Mock zware sidebars/modals — niet relevant voor header-test ──
jest.mock("../features/canvas/components/BlockPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/TipsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/ConsistencyModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/ProjectInfoSidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/StrategyStatusBlock", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/PrinciplesStatusBlock", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/DeepDiveOverlay", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/canvas/components/BlockCard", () => ({
  __esModule: true,
  default: () => null,
  BLOCKS: [],
  getBlockStatus: () => "empty",
}));
jest.mock("../features/dossier/components/MasterImporterPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../features/admin/AdminPage", () => ({ __esModule: true, default: () => null }));
jest.mock("../shared/components/ErrorBoundary", () => ({ __esModule: true, default: ({ children }) => children }));

// ── Mock canvas-menu (lichte stub voor delete-pad-flow in latere commits) ──
jest.mock("../features/canvas/components/CanvasMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="canvas-menu-stub" />,
}));

import App from "../App";

describe("Canvas-header — tools-zone werkblad-pattern (Inzichten + Rapportage)", () => {
  test("1. Tools-zone bevat Inzichten-knop met AiIcon (canvas-niveau werkflow-actie)", async () => {
    render(<App />);
    const btn = await screen.findByTestId("header-tool-inzichten");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Inzichten/i);
    expect(btn.className).toMatch(/border-white\/20/);
  });

  test("2. Tools-zone bevat Rapportage-knop, T1 A4 klikbaar met placeholder-modal", async () => {
    render(<App />);
    const btn = await screen.findByTestId("header-tool-rapportage");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Rapportage/i);
    // T1 A4: knop is NIET meer disabled — klik opent placeholder-modal
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/volgt|release|rapportage/i));
    fireEvent.click(btn);
    expect(await screen.findByTestId("rapport-placeholder-dialog")).toBeInTheDocument();
  });

  test("3. Consistency-knop (oude header-tool-consistency) is NIET meer in tools-zone", async () => {
    render(<App />);
    // Wacht tot header gerendered is via een wel-bestaande knop
    await screen.findByTestId("header-tool-inzichten");
    expect(screen.queryByTestId("header-tool-consistency")).not.toBeInTheDocument();
  });

  test("4. Inzichten-knop opent ConsistencyModal-trigger (showConsistency=true)", async () => {
    // Indirect via setShowConsistency — ConsistencyModal-mock is null in deze suite,
    // dus we testen dat de click niet crasht en testid blijft renderbaar.
    render(<App />);
    const btn = await screen.findByTestId("header-tool-inzichten");
    fireEvent.click(btn);
    // Knop blijft renderbaar (geen runtime-error)
    expect(btn).toBeInTheDocument();
  });
});

describe("Canvas-header — retro-fix Bev. 2 (Canvas-delete OverflowMenu-item)", () => {
  beforeEach(() => { mockHandleDeleteCanvas.mockClear(); });

  test("3. OverflowMenu bevat 'Canvas verwijderen'-item met danger-styling", async () => {
    render(<App />);
    // Open overflow-menu
    fireEvent.click(await screen.findByTestId("overflow-menu-trigger"));
    const item = await screen.findByTestId("overflow-menu-item-delete-canvas");
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent(/Canvas verwijderen/i);
    expect(item).toHaveAttribute("data-danger", "true");
  });

  test("4. Click op item opent inline-confirm-dialog met canvas-naam", async () => {
    render(<App />);
    fireEvent.click(await screen.findByTestId("overflow-menu-trigger"));
    fireEvent.click(await screen.findByTestId("overflow-menu-item-delete-canvas"));

    const dialog = await screen.findByTestId("delete-canvas-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Test Canvas/);
    expect(dialog).toHaveTextContent(/geüploade documenten en chunks/);
  });

  test("5. Confirm-knop roept handleDeleteCanvas met activeCanvasId aan en sluit dialog", async () => {
    render(<App />);
    fireEvent.click(await screen.findByTestId("overflow-menu-trigger"));
    fireEvent.click(await screen.findByTestId("overflow-menu-item-delete-canvas"));
    await screen.findByTestId("delete-canvas-confirm-dialog");

    await act(async () => {
      fireEvent.click(screen.getByTestId("delete-canvas-confirm"));
    });

    expect(mockHandleDeleteCanvas).toHaveBeenCalledWith("canvas-1");
    await waitFor(() =>
      expect(screen.queryByTestId("delete-canvas-confirm-dialog")).not.toBeInTheDocument()
    );
  });

  test("6. Annuleer-knop sluit dialog zonder delete-call", async () => {
    render(<App />);
    fireEvent.click(await screen.findByTestId("overflow-menu-trigger"));
    fireEvent.click(await screen.findByTestId("overflow-menu-item-delete-canvas"));
    await screen.findByTestId("delete-canvas-confirm-dialog");

    fireEvent.click(screen.getByTestId("delete-canvas-cancel"));

    expect(mockHandleDeleteCanvas).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId("delete-canvas-confirm-dialog")).not.toBeInTheDocument()
    );
  });
});

describe("Canvas-header — retro-fix Bev. 1 (KF-logo Optie C login-pattern)", () => {
  test("7. LogoBrand-img is gewrapt in witte tile (bg-white rounded) op canvas-header", async () => {
    render(<App />);
    // Header rendert (proxy via Inzichten-knop bestaan)
    await screen.findByTestId("header-tool-inzichten");

    // LogoBrand met variant="dark" gebruikt logoUrl (default '/kf-logo.png');
    // het <img> staat in een wrapper-div met bg-white rounded.
    const logoImg = document.querySelector("header img");
    expect(logoImg).not.toBeNull();
    // Closest ancestor met bg-white-class is de witte tile (Optie C).
    const tile = logoImg.closest('div.bg-white');
    expect(tile).not.toBeNull();
    expect(tile.className).toMatch(/rounded/);
  });
});
