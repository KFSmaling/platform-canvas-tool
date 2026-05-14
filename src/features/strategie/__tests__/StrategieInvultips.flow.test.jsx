/**
 * T2 A2 — Strategie-werkblad invultips: Tips-knop + WerkbladTipsModal.
 *
 * Cases (6 — overstijgt 4+ instructie):
 *   1. Strategie-werkblad rendert Tips-knop in laag-2 tools-zone met Lightbulb-icoon
 *   2. Click Tips-knop → WerkbladTipsModal opent met "Invultips Strategie"-header
 *      + alle 5 sectie-titels
 *   3. TipsModal toont voorbeeld-blok voor Missie/Visie/Ambitie
 *   4. TipsModal toont GEEN voorbeeld-blok voor Kernwaarden/Samenvatting (negative)
 *   5. Helper-tekst zichtbaar onder Missie/Visie/Ambitie/Samenvatting (kort-keys)
 *      + Kernwaarden-blok eigen helper
 *   6. **Platform-pattern-discipline**: WerkbladTipsModal is shared component
 *      (kan met andere sections-prop hergebruikt worden door T3/T4)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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

// ── AppConfig-mock met realistische tips-keys ──
// Fallback bevat de DB-waarde voor Missie/Visie/Ambitie-voorbeelden zodat
// die echt in de modal verschijnen. Voor Kernwaarden/Samenvatting: lege string
// als fallback om "geen voorbeeld"-pad te verifiëren (negative-assertion).
const TIPS_FIXTURE = {
  "tips.strategie.missie.kort":      "Waarom bestaat de organisatie? Tijdloos.",
  "tips.strategie.visie.kort":       "Hoe ziet de wereld eruit als de missie slaagt?",
  "tips.strategie.ambitie.kort":     "Waar wil je concreet naartoe? Tijdsgebonden.",
  "tips.strategie.kernwaarden.kort": "Welke principes sturen gedrag?",
  "tips.strategie.samenvatting.kort":"Vat de vier elementen samen.",
  "tips.strategie.missie.uitgebreid":     "De missie is de bestaansreden van de organisatie. Tijdloos.",
  "tips.strategie.visie.uitgebreid":      "De visie is het beeld van de toekomst dat je nastreeft.",
  "tips.strategie.ambitie.uitgebreid":    "De ambitie is waar je naartoe wilt binnen afzienbare termijn.",
  "tips.strategie.kernwaarden.uitgebreid":"Kernwaarden sturen gedrag en keuzes — ook als niemand kijkt.",
  "tips.strategie.samenvatting.uitgebreid":"De samenvatting brengt de vier elementen samen.",
  "tips.strategie.missie.voorbeeld":   "Wij maken financiële zekerheid toegankelijk voor iedereen.",
  "tips.strategie.visie.voorbeeld":    "Een wereld waarin niemand wakker ligt van financiële tegenslagen.",
  "tips.strategie.ambitie.voorbeeld":  "Binnen vijf jaar de meest aanbevolen verzekeraar van de Benelux.",
  // GEEN voorbeeld voor kernwaarden + samenvatting (Kees-keuze)
  "tips.strategie.modal.titel":       "Invultips Strategie",
};

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label:  (key, fallback) => {
      // eslint-disable-next-line global-require
      const fixtures = global.__TIPS_FIXTURE__ || {};
      if (key in fixtures) return fixtures[key];
      return fallback ?? key;
    },
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform", logoUrl: null, logoWhiteUrl: null }),
}));
jest.mock("../../../shared/services/embedding.service", () => ({
  searchDocumentChunks: jest.fn().mockResolvedValue({ data: [], error: null }),
}));
jest.mock("../../../shared/services/apiClient", () => ({
  apiFetch: jest.fn(),
}));
jest.mock("../components/InzichtenOverlay", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../StrategyOnePager", () => ({
  __esModule: true,
  default: () => null,
}));

import StrategieWerkblad from "../StrategieWerkblad";

const TEST_CANVAS_ID = "test-canvas-strategie-tips";

beforeEach(() => {
  jest.clearAllMocks();
  // eslint-disable-next-line no-undef
  global.__TIPS_FIXTURE__ = TIPS_FIXTURE;
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
  await waitFor(() => expect(strategyService.loadStrategyCore).toHaveBeenCalled());
  return result;
}

describe("T2 — Strategie invultips (Tips-knop + WerkbladTipsModal)", () => {
  test("1. Tips-knop zichtbaar in werkblad-tools-zone met Lightbulb-icoon", async () => {
    await renderWerkblad();
    const btn = await screen.findByTestId("werkblad-actie-tips");
    expect(btn).toBeInTheDocument();
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toMatch(/lucide-lightbulb/i);
  });

  test("2. Click Tips → modal opent met titel + 5 sectie-titels", async () => {
    await renderWerkblad();
    fireEvent.click(await screen.findByTestId("werkblad-actie-tips"));
    const dialog = await screen.findByTestId("strat-tips-dialog");
    expect(dialog).toBeInTheDocument();
    // Modal-header
    expect(within(dialog).getByText("Invultips Strategie")).toBeInTheDocument();
    // 5 secties
    expect(screen.getByTestId("strat-tips-section-missie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-section-visie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-section-ambitie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-section-kernwaarden")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-section-samenvatting")).toBeInTheDocument();
  });

  test("3. TipsModal toont voorbeeld-blok voor Missie/Visie/Ambitie", async () => {
    await renderWerkblad();
    fireEvent.click(await screen.findByTestId("werkblad-actie-tips"));
    await screen.findByTestId("strat-tips-dialog");
    expect(screen.getByTestId("strat-tips-voorbeeld-missie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-voorbeeld-visie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-tips-voorbeeld-ambitie")).toBeInTheDocument();
  });

  test("4. TipsModal toont GEEN voorbeeld-blok voor Kernwaarden/Samenvatting (negative)", async () => {
    await renderWerkblad();
    fireEvent.click(await screen.findByTestId("werkblad-actie-tips"));
    await screen.findByTestId("strat-tips-dialog");
    expect(screen.queryByTestId("strat-tips-voorbeeld-kernwaarden")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strat-tips-voorbeeld-samenvatting")).not.toBeInTheDocument();
  });

  test("5. Helper-tekst zichtbaar onder alle 5 velden (kort-keys)", async () => {
    await renderWerkblad();
    expect(await screen.findByTestId("strat-helper-missie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-helper-visie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-helper-ambitie")).toBeInTheDocument();
    expect(screen.getByTestId("strat-helper-kernwaarden")).toBeInTheDocument();
    expect(screen.getByTestId("strat-helper-samenvatting")).toBeInTheDocument();
  });

  test("6. WerkbladTipsModal is shared component — hergebruikbaar met eigen sections-prop", () => {
    // Direct-render-test om platform-pattern-discipline te valideren.
    // eslint-disable-next-line global-require
    const WerkbladTipsModal = require("../../../shared/components/WerkbladTipsModal").default;
    render(
      <WerkbladTipsModal
        title="T3 Richtlijnen-invultips"
        testIdPrefix="other-werkblad-tips"
        sections={[
          { id: "scope", titel: "Scope", tekst: "Andere werkblad-content." },
        ]}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId("other-werkblad-tips-dialog")).toBeInTheDocument();
    expect(screen.getByText("T3 Richtlijnen-invultips")).toBeInTheDocument();
    expect(screen.getByTestId("other-werkblad-tips-section-scope")).toBeInTheDocument();
  });
});
