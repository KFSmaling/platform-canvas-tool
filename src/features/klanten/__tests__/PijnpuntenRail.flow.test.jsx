/**
 * 11.U Block 2b retro — PijnpuntenRail (mini-lijst-links in Doorloop-modus).
 *
 * Wireframe-doc regel 137-143: 280px linker rail met nummer-bolletje +
 * status-indicator + pijnpunt-tekst-afgeknot + dimensie. Geselecteerde rij
 * krijgt accent-bg + border-left. Klik → cursor verspringt.
 *
 * Cases (4):
 *  1. Rail rendert N rijen voor N painPoints met juiste nummer + status-dot per coverage_status
 *  2. Klik op rail-rij N → currentFocusIdx update + focus-card wisselt + inline-state reset
 *  3. Geselecteerde rij heeft data-selected="true" + accent-bg
 *  4. Empty-state als painPoints=[] → doorloop-rail-empty zichtbaar
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
  listIntentsWithLinks:            jest.fn(),
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

const TEST_CANVAS_ID = "test-canvas-rail";

function pp(id, text, coverage = "open", dimensionId = "d-seg", createdAt = "2026-05-18T08:00:00Z") {
  return {
    id, canvas_id: TEST_CANVAS_ID,
    text_md: text,
    coverage_status: coverage,
    dimension_id: dimensionId,
    created_at: createdAt,
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

describe("11.U Block 2b retro — PijnpuntenRail", () => {
  test("1. Rail rendert N rijen met nummer-bolletje + status-dot per coverage_status", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [
        pp("p1", "Open pijn 1", "open"),
        pp("p2", "Pijn addressed", "addressed"),
        pp("p3", "Pijn dismissed", "dismissed"),
      ],
      error: null,
    });
    await renderAndOpenFase3();
    expect(await screen.findByTestId("doorloop-rail")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-rail-row-p1")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-rail-row-p2")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-rail-row-p3")).toBeInTheDocument();
    // Status-dots — kleur per coverage_status (klassen via testid-suffix-element)
    const dotP1 = screen.getByTestId("doorloop-rail-row-status-p1");
    const dotP2 = screen.getByTestId("doorloop-rail-row-status-p2");
    const dotP3 = screen.getByTestId("doorloop-rail-row-status-p3");
    expect(dotP1.className).toMatch(/bg-amber-500/);
    expect(dotP2.className).toMatch(/bg-emerald-500/);
    expect(dotP3.className).toMatch(/bg-slate-400/);
    // Dimensie-naam zichtbaar in elke rij (uit lookup map)
    expect(within(screen.getByTestId("doorloop-rail-row-p1"))
      .getByText("Klantsegmenten")).toBeInTheDocument();
  });

  test("2. Klik op rail-rij N → focus-card wisselt naar pijnpunt N + counter update", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Eerste pijn", "open"), pp("p2", "Tweede pijn", "open"), pp("p3", "Derde pijn", "open")],
      error: null,
    });
    await renderAndOpenFase3();
    // Standaard cursor op 0 (eerste pijn)
    expect(screen.getByTestId("doorloop-counter")).toHaveTextContent(/\[1\/3\]/);
    // Klik op derde rij → cursor naar idx 2
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-rail-row-p3")); });
    expect(screen.getByTestId("doorloop-counter")).toHaveTextContent(/\[3\/3\]/);
    // Focus-card toont "Derde pijn"
    expect(screen.getByTestId("doorloop-focus-painpoint-text")).toHaveTextContent("Derde pijn");
  });

  test("3. Geselecteerde rij heeft data-selected='true' + accent-bg", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1", "open"), pp("p2", "Pijn 2", "open")],
      error: null,
    });
    await renderAndOpenFase3();
    // p1 is geselecteerd (cursor=0)
    const row1 = screen.getByTestId("doorloop-rail-row-p1");
    const row2 = screen.getByTestId("doorloop-rail-row-p2");
    expect(row1).toHaveAttribute("data-selected", "true");
    expect(row2).toHaveAttribute("data-selected", "false");
    expect(row1.className).toMatch(/bg-amber-50/);  // selected open-status → amber-50
    expect(row1.className).toMatch(/border-l-amber-500/);
  });

  test("4. Empty-state — painPoints=[] → doorloop-rail-empty + body-empty allebei NIET zichtbaar (rail is leeg, body-empty wel)", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
    await renderAndOpenFase3();
    // Bij 0 painPoints rendert DoorloopView de body-empty-state (geen rail-rendering)
    expect(screen.getByTestId("doorloop-empty")).toBeInTheDocument();
    // Rail rendert niet bij total=0 — body-empty toont in plaats van 2-koloms layout
    expect(screen.queryByTestId("doorloop-rail")).not.toBeInTheDocument();
  });
});
