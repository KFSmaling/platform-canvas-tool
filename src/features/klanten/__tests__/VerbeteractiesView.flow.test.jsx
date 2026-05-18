/**
 * S4 RFC-007 C1 — VerbeteractiesView integration flow.
 *
 * Vervangt eerdere AnalyseView.flow.test.jsx + VerbeterrichtingenView.flow.test.jsx
 * (3-fase-architectuur — Analyse merged in Verbeteracties).
 *
 * Cases (≥ 8 per S4 instructie I):
 *   1. Drie-fase-tabs render (Inventarisatie / Pijnpunten / Verbeteracties)
 *   2. Activeer fase 3 → VerbeteractiesView rendert met counter + actionbar
 *   3. ActionBar: 4 AI-knoppen + Eigen actie-knop
 *   4. ConceptList rendert suggestions (open/edited/accepted/refined) + intents (concept)
 *   5. DefinitiefList rendert intents.status='verstuurd'
 *   6. "Maak definitief" op concept-suggestion → opent PromoteToIntentModal
 *   7. "Maak definitief" op concept-intent → window.confirm + handoverIntentToRoadmap
 *   8. Definitief-intent overflow → "Terug naar concept" → unsendIntent
 *   9. Geen Analyse-knop in werkblad-header (negative-assertion)
 *  10. Geen Werkruimte/Rapport-toggle (negative-assertion)
 *  11. Suggestions met status=promoted/rejected zijn verborgen (mapping §3.1)
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

const TEST_CANVAS_ID = "test-canvas-uuid-s4";

const sampleSuggestion = (overrides = {}) => ({
  id: "s-1",
  canvas_id: TEST_CANVAS_ID,
  pattern_type: "cluster",
  text_md: "AI-patroon: claim-fase voelt onveilig",
  current_status: "open",
  parent_id: null,
  created_at: "2026-05-14T08:00:00Z",
  ...overrides,
});

const sampleIntent = (overrides = {}) => ({
  id: "i-1",
  canvas_id: TEST_CANVAS_ID,
  title: "Claim-fase doorlooptijd halveren",
  intent_md: "We willen claim-doorlooptijd terugbrengen van 14 naar 7 dagen.",
  vanuit: null,
  source_suggestion_id: null,
  status: "concept",
  handover_to_roadmap_at: null,
  created_at: "2026-05-14T09:00:00Z",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPainPoints.mockResolvedValue({
    data: [{ id: "p-1", canvas_id: TEST_CANVAS_ID, text_md: "Pijnpunt-1", is_draft: false }],
    error: null,
  });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.listIntentsWithLinks.mockResolvedValue({ data: [], links: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({
    data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 },
    error: null,
  });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
  });
  await waitFor(() => expect(klantenService.listDimensions).toHaveBeenCalled());
  return result;
}

async function openFase3() {
  // Click fase 3-tab (Verbeteracties)
  const tab = await screen.findByTestId("werkblad-header-tab-3");
  await act(async () => { fireEvent.click(tab); });
  await screen.findByTestId("verbeteracties-view");
  // 11.U Block 2: default-modus = Doorloop. Voor de bestaande S4-tests
  // (concept-list/definitief-list) switchen we naar Overzicht zodat de
  // legacy-render zichtbaar is. Block 2b zal nieuwe Doorloop-specific
  // tests toevoegen.
  const overzichtBtn = screen.queryByTestId("verbeteracties-modus-toggle-option-overzicht");
  if (overzichtBtn) {
    await act(async () => { fireEvent.click(overzichtBtn); });
  }
}

describe("VerbeteractiesView — S4 RFC-007 C1", () => {
  test("1. Drie-fase-tabs render (Inventarisatie/Pijnpunten/Verbeteracties)", async () => {
    await renderWerkblad();
    expect(await screen.findByTestId("werkblad-header-tab-1")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-tab-2")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-tab-3")).toBeInTheDocument();
    // Geen 4e tab
    expect(screen.queryByTestId("werkblad-header-tab-4")).not.toBeInTheDocument();
  });

  test.skip("2. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] Activeer fase 3 → VerbeteractiesView + counter + actionbar zichtbaar", async () => {
    await renderWerkblad();
    await openFase3();
    expect(screen.getByTestId("verbeteracties-counter")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-actionbar")).toBeInTheDocument();
  });

  test.skip("3. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] ActionBar: 4 AI-knoppen + Eigen actie-knop", async () => {
    await renderWerkblad();
    await openFase3();
    expect(screen.getByTestId("verbeteracties-knop-cluster")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-paradox")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-positionering")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-overstijgend")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-eigen-actie")).toBeInTheDocument();
  });

  test.skip("4. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] ConceptList rendert suggestions (open) + concept-intents", async () => {
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestion({ id: "s-a", current_status: "open" })],
      error: null,
    });
    klantenService.listIntents.mockResolvedValue({
      data: [sampleIntent({ id: "i-a", status: "concept", title: "Concept-actie-1" })],
      error: null,
    });
    await renderWerkblad();
    await openFase3();
    const conceptList = screen.getByTestId("verbeteracties-concept-list");
    expect(within(conceptList).getByText(/Concept-actie-1/)).toBeInTheDocument();
    expect(within(conceptList).getByText(/claim-fase voelt onveilig/i)).toBeInTheDocument();
    expect(screen.getByTestId("counter-concept")).toHaveTextContent("2");
  });

  test.skip("5. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] DefinitiefList rendert intents met status=verstuurd", async () => {
    klantenService.listIntents.mockResolvedValue({
      data: [sampleIntent({ id: "i-def", status: "verstuurd", title: "Definitieve actie",
        handover_to_roadmap_at: "2026-05-14T10:00:00Z" })],
      error: null,
    });
    await renderWerkblad();
    await openFase3();
    const defList = screen.getByTestId("verbeteracties-definitief-list");
    expect(within(defList).getByText(/Definitieve actie/)).toBeInTheDocument();
    expect(screen.getByTestId("counter-definitief")).toHaveTextContent("1");
  });

  test.skip("6. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] Maak definitief op concept-suggestion → opent PromoteToIntentModal", async () => {
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestion({ id: "s-prom", current_status: "open" })],
      error: null,
    });
    await renderWerkblad();
    await openFase3();
    const btn = await screen.findByTestId("verbeteracties-maakdefinitief-suggestion-s-prom");
    await act(async () => { fireEvent.click(btn); });
    // PromoteToIntentModal toont titel-veld + opslaan-knop met testid
    expect(await screen.findByTestId("promote-veld-titel")).toBeInTheDocument();
    expect(screen.getByTestId("promote-modal-opslaan")).toBeInTheDocument();
  });

  // K-fix-2 Bev. 1: confirm-dialog weggehaald (was Roadmap-mention).
  // Test asserteert nu: GEEN confirm, direct handoverIntentToRoadmap-call.
  test.skip("7. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] Maak definitief op concept-intent → handoverIntentToRoadmap zonder confirm-dialog", async () => {
    klantenService.listIntents.mockResolvedValue({
      data: [sampleIntent({ id: "i-c", status: "concept" })],
      error: null,
    });
    klantenService.handoverIntentToRoadmap.mockResolvedValue({ data: { id: "i-c", status: "verstuurd" }, error: null });
    const origConfirm = window.confirm;
    window.confirm = jest.fn(() => true);
    try {
      await renderWerkblad();
      await openFase3();
      const handoverBtn = await screen.findByTestId("intent-actie-markeer-i-c");
      await act(async () => { fireEvent.click(handoverBtn); });
      // K-fix-2: geen confirm meer aangeroepen
      expect(window.confirm).not.toHaveBeenCalled();
      // Direct service-call
      expect(klantenService.handoverIntentToRoadmap).toHaveBeenCalledWith("i-c");
    } finally {
      window.confirm = origConfirm;
    }
  });

  test.skip("8. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] Definitief-intent overflow-menu → 'Terug naar concept' → unsendIntent", async () => {
    klantenService.listIntents.mockResolvedValue({
      data: [sampleIntent({ id: "i-def", status: "verstuurd" })],
      error: null,
    });
    klantenService.unsendIntent.mockResolvedValue({ data: { id: "i-def", status: "concept" }, error: null });
    await renderWerkblad();
    await openFase3();
    const overflow = await screen.findByTestId("verbeteracties-overflow-i-def");
    await act(async () => { fireEvent.click(overflow); });
    const terug = await screen.findByTestId("verbeteracties-terug-naar-concept-i-def");
    await act(async () => { fireEvent.click(terug); });
    expect(klantenService.unsendIntent).toHaveBeenCalledWith("i-def");
  });

  test("9. Geen Analyse-knop in werkblad-header (B1 negative-assertion)", async () => {
    await renderWerkblad();
    // WerkbladActieknoppen rendert Analyse alleen als onAnalyse-prop een functie is.
    // In KlantenWerkblad geven we onAnalyse niet door → testid mag niet bestaan.
    expect(screen.queryByTestId("werkblad-actie-analyse")).not.toBeInTheDocument();
  });

  test("10. Geen Werkruimte/Rapport-toggle in UI (B2 negative-assertion)", async () => {
    await renderWerkblad();
    // Rapport opent via WerkbladActieknoppen-Rapportage-knop, niet via toggle in body.
    // We checken dat er geen segmented-toggle-element met "Rapport"/"Werkruimte"-labels in de body staat.
    expect(screen.queryByRole("tab", { name: /Werkruimte/i })).not.toBeInTheDocument();
  });

  test.skip("11. [Block 3b obsolete — S4 RFC-007 C1 flow vervangen door OverzichtView matrix-tabel] Suggestions met status=promoted/rejected verborgen (mapping §3.1)", async () => {
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [
        sampleSuggestion({ id: "s-prom", current_status: "promoted", text_md: "AAN-promoted" }),
        sampleSuggestion({ id: "s-rej",  current_status: "rejected", text_md: "AAN-rejected" }),
        sampleSuggestion({ id: "s-open", current_status: "open",     text_md: "AAN-open" }),
      ],
      error: null,
    });
    await renderWerkblad();
    await openFase3();
    const conceptList = screen.getByTestId("verbeteracties-concept-list");
    expect(within(conceptList).getByText(/AAN-open/)).toBeInTheDocument();
    expect(within(conceptList).queryByText(/AAN-promoted/)).not.toBeInTheDocument();
    expect(within(conceptList).queryByText(/AAN-rejected/)).not.toBeInTheDocument();
    // rejected staat wel in Verwijderd-collapse
    expect(screen.getByText(/Verwijderd \(1\)/)).toBeInTheDocument();
  });
});
