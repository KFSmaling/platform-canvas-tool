/**
 * 11.U Block 3b — CoverageGauge + sub-header + OverzichtView matrix-tabel.
 *
 * Cases (8):
 *  1. Sub-header rendert titel + dyn-subtitle "Nog 2 pijnpunten zonder actie"
 *  2. Sub-header rendert "Alle pijnpunten geadresseerd ✓" wanneer geen open meer
 *  3. CoverageGauge bar-segmenten + monospaced telling correct per painPoints-status-mix
 *  4. OverzichtView matrix-tabel rendert 5 kolommen + 3 status-rijen
 *  5. OverzichtView "Doorloop"-knop op open-rij → modus switcht + jumpToIdx
 *  6. OverzichtView rij-klik op open → inline-expansion met ChoiceCards
 *  7. OverzichtView empty-state als painPoints=[]
 *  8. OverzichtView addressed-rij "Bekijken"-knop (geen "Doorloop")
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../services/klanten.service", () => ({
  listDimensions:                  jest.fn(),
  listItemsForCanvas:              jest.fn(),
  listPainPoints:                  jest.fn(),
  listCouplingsForCanvas:          jest.fn(),
  listPatternSuggestions:          jest.fn(),
  generatePatternSuggestions:      jest.fn(),
  createPatternSuggestion:         jest.fn(),
  updatePatternSuggestion:         jest.fn(),
  acceptPatternSuggestion:         jest.fn(),
  rejectPatternSuggestion:         jest.fn(),
  promotePatternSuggestionToIntent: jest.fn(),
  unmarkPatternSuggestion:         jest.fn(),
  restorePatternSuggestion:        jest.fn(),
  listIntents:                     jest.fn(),
  createIntent:                    jest.fn(),
  updateIntent:                    jest.fn(),
  deleteIntent:                    jest.fn(),
  handoverIntentToRoadmap:         jest.fn(),
  unsendIntent:                    jest.fn(),
  createIntentPainPointLink:       jest.fn(),
  deleteIntentPainPointLink:       jest.fn(),
  restorePainPoint:                jest.fn(),
  dismissPainPoint:                jest.fn(),
  fetchUploadsStatus:              jest.fn(),
  createDimension:                 jest.fn(),
  updateDimension:                 jest.fn(),
  deleteDimension:                 jest.fn(),
  createItem:                      jest.fn(),
  updateItem:                      jest.fn(),
  deleteItem:                      jest.fn(),
  createPainPoint:                 jest.fn(),
  updatePainPoint:                 jest.fn(),
  deletePainPoint:                 jest.fn(),
  createCoupling:                  jest.fn(),
  deleteCoupling:                  jest.fn(),
}));
import * as klantenService from "../services/klanten.service";

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label: (key, fallback) => fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform" }),
}));
jest.mock("../../../shared/components/AiIcon", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../shared/components/AiIconButton", () => ({
  __esModule: true,
  default: ({ onClick, disabled, label, "data-testid": tid }) => (
    <button onClick={onClick} disabled={disabled} data-testid={tid}>{label}</button>
  ),
}));
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

import KlantenWerkblad from "../KlantenWerkblad";

const TEST_CANVAS_ID = "test-canvas-block3b";

function pp(id, text, coverage = "open", dimensionId = null) {
  return {
    id, canvas_id: TEST_CANVAS_ID,
    text_md: text,
    coverage_status: coverage,
    dimension_id: dimensionId,
    created_at: "2026-05-18T08:00:00Z",
  };
}

const SEG_DIM = { id: "d-seg", canvas_id: TEST_CANVAS_ID, archetype: "klantsegment", name: "Klantsegmenten", sort_order: 10 };

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [SEG_DIM], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], links: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({
    data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 },
    error: null,
  });
});

async function renderAndOpenFase3() {
  let result;
  await act(async () => {
    result = render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
  });
  await waitFor(() => expect(klantenService.listDimensions).toHaveBeenCalled());
  const tab = await screen.findByTestId("werkblad-header-tab-3");
  await act(async () => { fireEvent.click(tab); });
  await screen.findByTestId("verbeteracties-view");
  return result;
}

async function switchToOverzicht() {
  const btn = screen.getByTestId("verbeteracties-modus-toggle-option-overzicht");
  await act(async () => { fireEvent.click(btn); });
}

describe("11.U Block 3b — Sub-header + CoverageGauge + OverzichtView", () => {
  test("1. Sub-header rendert titel + 'Nog X pijnpunten' subtitle bij open-status", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1"), pp("p2", "Pijn 2", "addressed")],
      error: null,
    });
    await renderAndOpenFase3();
    expect(await screen.findByTestId("verbeteracties-sub-header")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-sub-header-titel")).toHaveTextContent(/Verbeteracties · fase 3/);
    expect(screen.getByTestId("verbeteracties-sub-header-subtitle"))
      .toHaveTextContent(/Nog 1 pijnpunt zonder actie/i);
  });

  test("2. Sub-header 'Alle geadresseerd ✓' wanneer geen open pijnpunten meer", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1", "addressed"), pp("p2", "Pijn 2", "dismissed")],
      error: null,
    });
    await renderAndOpenFase3();
    expect(screen.getByTestId("verbeteracties-sub-header-subtitle"))
      .toHaveTextContent(/Alle pijnpunten geadresseerd/i);
  });

  test("3. CoverageGauge bar-segmenten + monospaced telling per painPoints-status-mix", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [
        pp("p1", "open 1"), pp("p2", "open 2"),
        pp("p3", "addressed 1", "addressed"),
        pp("p4", "dismissed 1", "dismissed"),
      ],
      error: null,
    });
    await renderAndOpenFase3();
    expect(screen.getByTestId("coverage-gauge")).toBeInTheDocument();
    // 2 open, 1 addressed, 1 dismissed = 1+1/4 covered
    expect(screen.getByTestId("coverage-gauge-count")).toHaveTextContent("2/4");
    expect(screen.getByTestId("coverage-gauge-addressed")).toBeInTheDocument();
    expect(screen.getByTestId("coverage-gauge-dismissed")).toBeInTheDocument();
    expect(screen.getByTestId("coverage-gauge-open")).toBeInTheDocument();
  });

  test("4. OverzichtView matrix-tabel: 5 kolommen + 3 status-rijen", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [
        pp("p1", "Open pijn", "open"),
        pp("p2", "Addressed pijn", "addressed"),
        pp("p3", "Dismissed pijn", "dismissed"),
      ],
      error: null,
    });
    await renderAndOpenFase3();
    await switchToOverzicht();
    expect(screen.getByTestId("overzicht-view")).toBeInTheDocument();
    expect(screen.getByTestId("overzicht-row-p1")).toHaveAttribute("data-status", "open");
    expect(screen.getByTestId("overzicht-row-p2")).toHaveAttribute("data-status", "addressed");
    expect(screen.getByTestId("overzicht-row-p3")).toHaveAttribute("data-status", "dismissed");
    // Kolom-headers — "Pijnpunt" komt meermaals voor (header + per-rij), zoek op kolomnaam in <th>
    const table = screen.getByTestId("overzicht-view").querySelector("table");
    const headers = table.querySelectorAll("th");
    const headerTexts = Array.from(headers).map(h => h.textContent.trim());
    expect(headerTexts).toContain("Pijnpunt");
    expect(headerTexts).toContain("Gekoppelde acties");
  });

  test("5. OverzichtView 'Doorloop'-knop op open-rij → modus switcht naar doorloop + focus juist", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Open pijn", "open"), pp("p2", "Andere open pijn", "open")],
      error: null,
    });
    await renderAndOpenFase3();
    await switchToOverzicht();
    expect(screen.queryByTestId("doorloop-view")).not.toBeInTheDocument();
    // Klik Doorloop-knop op p2
    await act(async () => { fireEvent.click(screen.getByTestId("overzicht-row-doorloop-p2")); });
    expect(screen.getByTestId("doorloop-view")).toBeInTheDocument();
    // Focus-card moet "Andere open pijn" tonen (idx 1)
    expect(screen.getByTestId("doorloop-focus-painpoint-text")).toHaveTextContent("Andere open pijn");
  });

  test("6. OverzichtView open-rij-klik → inline-expansion met ChoiceCards", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Klikbare open pijn", "open")],
      error: null,
    });
    await renderAndOpenFase3();
    await switchToOverzicht();
    // Klik op rij (niet op de Actie-knop)
    await act(async () => { fireEvent.click(screen.getByTestId("overzicht-row-p1")); });
    expect(screen.getByTestId("overzicht-row-expansion-p1")).toBeInTheDocument();
    const exp = screen.getByTestId("overzicht-row-expansion-p1");
    expect(within(exp).getByTestId("doorloop-choice-cards")).toBeInTheDocument();
  });

  test("7. OverzichtView empty-state als painPoints=[]", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
    await renderAndOpenFase3();
    await switchToOverzicht();
    expect(screen.getByTestId("overzicht-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("overzicht-view")).not.toBeInTheDocument();
  });

  test("8. OverzichtView addressed-rij toont 'Bekijken'-knop (geen Doorloop)", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Addressed pijn", "addressed"), pp("p2", "Dismissed pijn", "dismissed")],
      error: null,
    });
    await renderAndOpenFase3();
    await switchToOverzicht();
    expect(screen.getByTestId("overzicht-row-bekijken-p1")).toBeInTheDocument();
    expect(screen.getByTestId("overzicht-row-bekijken-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("overzicht-row-doorloop-p1")).not.toBeInTheDocument();
  });
});
