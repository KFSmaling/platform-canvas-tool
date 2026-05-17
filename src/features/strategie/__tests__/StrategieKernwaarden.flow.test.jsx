/**
 * Retro-fix Bev. 4 — RTL voor Strategie kernwaardes toevoegen-affordance.
 *
 * Optie A-pattern: echte AppConfigProvider-stub + mocked service-layer.
 *
 * Cases:
 *  1. Identiteit-tab toont expliciete "+ Toevoegen"-knop naast input
 *  2. Toevoegen-knop disabled bij lege input
 *  3. Toevoegen-knop enabled bij gevulde input
 *  4. Click Toevoegen met waarde → chip verschijnt + input geleegd
 *  5. Enter in input → chip verschijnt + input geleegd (power-user-pad)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock strategy.service ──
jest.mock("../services/strategy.service", () => ({
  loadStrategyCore:        jest.fn(),
  loadCanvasName:          jest.fn(),
  upsertStrategyCore:      jest.fn(),
  loadAnalysisItems:       jest.fn(),
  upsertAnalysisItem:      jest.fn(),
  changeAnalysisItemTag:   jest.fn(),
  deleteAnalysisItem:      jest.fn(),
  loadStrategicThemes:     jest.fn(),
  upsertStrategicTheme:    jest.fn(),
  deleteStrategicTheme:    jest.fn(),
  upsertKsfKpi:            jest.fn(),
  deleteKsfKpi:            jest.fn(),
}));
import * as strategyService from "../services/strategy.service";

// ── Mock AppConfigContext (zelfde pattern als KlantenWerkblad-suite) ──
jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label:  (key, fallback) => fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

// ── Mock useAuth — werkblad gebruikt user/signOut alleen voor overflow-menu ──
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));

// ── Mock useLang ──
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

// ── Mock useTheme (gebruikt door LogoBrand in WerkbladHeader laag-1) ──
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({
    brandName: "Platform",
    logoUrl: null,
    logoWhiteUrl: null,
  }),
}));

// ── Mock embedding.service (callWerkbladMagic dependency, niet relevant hier) ──
jest.mock("../../../shared/services/embedding.service", () => ({
  searchDocumentChunks: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

// ── Mock apiFetch (niet gebruikt in kernwaarden-pad) ──
jest.mock("../../../shared/services/apiClient", () => ({
  apiFetch: jest.fn(),
}));

// ── Mock InzichtenOverlay zwaar component, niet relevant ──
jest.mock("../../../shared/components/inzichten/InzichtenOverlay", () => ({
  __esModule: true,
  default: () => null,
}));

// ── Mock StrategyOnePager (lazy import) ──
jest.mock("../StrategyOnePager", () => ({
  __esModule: true,
  default: () => null,
}));

import StrategieWerkblad from "../StrategieWerkblad";

const TEST_CANVAS_ID = "test-canvas-kernwaarden-uuid";

beforeEach(() => {
  jest.clearAllMocks();
  strategyService.loadStrategyCore.mockResolvedValue({
    data: { missie: "", visie: "", ambitie: "", kernwaarden: [], samenvatting: "" },
    error: null,
  });
  strategyService.loadAnalysisItems.mockResolvedValue({ data: [], error: null });
  strategyService.loadStrategicThemes.mockResolvedValue({ data: [], error: null });
  strategyService.loadCanvasName.mockResolvedValue({ data: "Test Canvas", error: null });
  strategyService.upsertStrategyCore.mockResolvedValue({ data: null, error: null });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(
      <StrategieWerkblad
        canvasId={TEST_CANVAS_ID}
        onClose={() => {}}
        onManualSaved={() => {}}
      />
    );
  });
  // Wacht tot core-load is voltooid
  await waitFor(() => expect(strategyService.loadStrategyCore).toHaveBeenCalled());
  return result;
}

describe("Strategie kernwaarden — retro-fix Bev. 4", () => {
  test("1. Identiteit-tab toont expliciete Toevoegen-knop naast input", async () => {
    await renderWerkblad();
    const btn   = await screen.findByTestId("strat-kernwaarde-toevoegen");
    const input = await screen.findByTestId("strat-kernwaarde-input");
    expect(btn).toBeInTheDocument();
    expect(input).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Toevoegen/i);
  });

  test("2. Toevoegen-knop disabled bij lege input", async () => {
    await renderWerkblad();
    const btn = await screen.findByTestId("strat-kernwaarde-toevoegen");
    expect(btn).toBeDisabled();
  });

  test("3. Toevoegen-knop enabled bij gevulde input", async () => {
    await renderWerkblad();
    const input = await screen.findByTestId("strat-kernwaarde-input");
    fireEvent.change(input, { target: { value: "Innovatie" } });
    const btn = await screen.findByTestId("strat-kernwaarde-toevoegen");
    expect(btn).not.toBeDisabled();
  });

  test("4. Click Toevoegen voegt chip toe en leegt input", async () => {
    await renderWerkblad();
    const input = await screen.findByTestId("strat-kernwaarde-input");
    fireEvent.change(input, { target: { value: "Klantgericht" } });
    fireEvent.click(screen.getByTestId("strat-kernwaarde-toevoegen"));

    // Chip "Klantgericht" verschijnt
    await waitFor(() => expect(screen.getByText("Klantgericht")).toBeInTheDocument());
    // Input is geleegd
    expect(input).toHaveValue("");
  });

  test("5. Enter-toets voegt chip toe (power-user-pad)", async () => {
    await renderWerkblad();
    const input = await screen.findByTestId("strat-kernwaarde-input");
    fireEvent.change(input, { target: { value: "Integriteit" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("Integriteit")).toBeInTheDocument());
    expect(input).toHaveValue("");
  });
});
