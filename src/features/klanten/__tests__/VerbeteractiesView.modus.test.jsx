/**
 * 11.U Block 2 — VerbeteractiesView ModusToggle + Doorloop-placeholder.
 *
 * 5 cases:
 *  1. Default modus = "doorloop" → placeholder + CTA zichtbaar; geen actionbar/concept-list
 *  2. Klik "Ga naar Overzicht"-CTA → switch naar Overzicht-modus, actionbar zichtbaar
 *  3. ModusToggle bevat 2 opties (Doorloop + Overzicht), beide gerendered
 *  4. Klik toggle-optie Overzicht → modus switcht
 *  5. Inzichten-knop verborgen op fase 3 (KlantenWerkblad header-extensie)
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
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
  listIntentsWithLinks:            jest.fn(),
  createIntentPainPointLink:       jest.fn(),
  deleteIntentPainPointLink:       jest.fn(),
  restorePainPoint:                jest.fn(),
  dismissPainPoint:                jest.fn(),
  createIntent:                    jest.fn(),
  updateIntent:                    jest.fn(),
  deleteIntent:                    jest.fn(),
  handoverIntentToRoadmap:         jest.fn(),
  unsendIntent:                    jest.fn(),
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

const TEST_CANVAS_ID = "test-canvas-uuid-modus";

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], links: [], error: null });
  klantenService.listIntentsWithLinks.mockResolvedValue({ data: [], links: [], error: null });
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

describe("11.U Block 2 — VerbeteractiesView ModusToggle + Doorloop (volledig in 2b)", () => {
  test("1. Default modus = doorloop → DoorloopView (empty-state want geen pijnpunten), geen actionbar", async () => {
    await renderAndOpenFase3();
    // Block 2b: Doorloop-modus rendert DoorloopView (empty-state want geen pijnpunten in mock).
    expect(screen.getByTestId("doorloop-empty")).toBeInTheDocument();
    // Overzicht-only content niet zichtbaar
    expect(screen.queryByTestId("verbeteracties-actionbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("verbeteracties-concept-list")).not.toBeInTheDocument();
  });

  test("2. Toggle naar Overzicht → OverzichtView empty-state (geen pijnpunten gemockt)", async () => {
    await renderAndOpenFase3();
    const overzichtBtn = screen.getByTestId("verbeteracties-modus-toggle-option-overzicht");
    await act(async () => { fireEvent.click(overzichtBtn); });
    expect(screen.queryByTestId("doorloop-view")).not.toBeInTheDocument();
    // 11.U Block 3b: Overzicht-modus rendert nu OverzichtView matrix-tabel (S4-flow obsolete)
    expect(screen.getByTestId("overzicht-empty")).toBeInTheDocument();
  });

  test("3. ModusToggle rendert beide opties", async () => {
    await renderAndOpenFase3();
    expect(screen.getByTestId("verbeteracties-modus-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-doorloop")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-overzicht")).toBeInTheDocument();
    // Doorloop is actief (aria-selected)
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-doorloop")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-overzicht")).toHaveAttribute("aria-selected", "false");
  });

  test("4. Klik Overzicht-toggle-optie → aria-selected wisselt + matrix-view of empty zichtbaar", async () => {
    await renderAndOpenFase3();
    const overzichtBtn = screen.getByTestId("verbeteracties-modus-toggle-option-overzicht");
    await act(async () => { fireEvent.click(overzichtBtn); });
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-overzicht")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("verbeteracties-modus-toggle-option-doorloop")).toHaveAttribute("aria-selected", "false");
    // 11.U Block 3b: matrix-tabel of empty-state ipv S4-actionbar
    expect(screen.getByTestId("overzicht-empty")).toBeInTheDocument();
  });

  test("5. Inzichten-knop verborgen op fase 3 (KlantenWerkblad header-extensie)", async () => {
    await renderAndOpenFase3();
    // WerkbladActieknoppen rendert nu de Inzichten-knop niet (onBekijken=null)
    expect(screen.queryByTestId("werkblad-actie-inzichten")).not.toBeInTheDocument();
    // Rapportage-knop wel zichtbaar
    expect(screen.getByTestId("werkblad-actie-rapportage")).toBeInTheDocument();
  });
});
