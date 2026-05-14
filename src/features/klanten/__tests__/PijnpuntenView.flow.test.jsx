/**
 * Stap 11.F — RTL integration-test voor fase-2 pijnpunten-flow.
 *
 * Test-cases:
 *  1. Fase-2-tab geactiveerd; click → PijnpuntenView rendert
 *  2. Lege pijnpunten-state → CTA "+ Eerste pijnpunt aanmaken" zichtbaar
 *  3. Click CTA → PijnpuntModal opent met titel "Nieuw pijnpunt"
 *  4. Submit disabled bij lege tekst; valid invoer + 1 koppeling → createPainPoint
 *     + createCoupling aangeroepen, modal sluit, reload aangeroepen
 *  5. Geen koppeling = overstijgend pijnpunt → warning zichtbaar
 *  6. Edit-flow: click op PijnpuntCard → modal opent met bestaande tekst,
 *     wijzigen + save → updatePainPoint aangeroepen
 *  7. Boy-scout dimensie-edit: click op DimensieKolom-header → DimensieModal
 *     opent in edit-mode (archetype disabled)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import KlantenWerkblad from "../KlantenWerkblad";

jest.mock("../services/klanten.service", () => ({
  listDimensions:           jest.fn(),
  listItemsForCanvas:       jest.fn(),
  listItemsForDimension:    jest.fn(),
  createDimension:          jest.fn(),
  updateDimension:          jest.fn(),
  deleteDimension:          jest.fn(),
  createItem:               jest.fn(),
  updateItem:               jest.fn(),
  deleteItem:               jest.fn(),
  listPainPoints:           jest.fn(),
  listCouplingsForCanvas:   jest.fn(),
  createPainPoint:          jest.fn(),
  updatePainPoint:          jest.fn(),
  deletePainPoint:          jest.fn(),
  createCoupling:           jest.fn(),
  deleteCoupling:           jest.fn(),
  // Stap 11.G — pattern suggestions (KlantenWerkblad-niveau hook)
  listPatternSuggestions:         jest.fn(),
  generatePatternSuggestions:     jest.fn(),
  createPatternSuggestion:        jest.fn(),
  updatePatternSuggestion:        jest.fn(),
  acceptPatternSuggestion:        jest.fn(),
  rejectPatternSuggestion:        jest.fn(),
  promotePatternSuggestionToIntent: jest.fn(),
  deletePatternSuggestion:        jest.fn(),
  unmarkPatternSuggestion:        jest.fn(),
  restorePatternSuggestion:       jest.fn(),
  listPatternSuggestionEvents:    jest.fn(),
  // Stap 11.H — intents
  listIntents:                    jest.fn(),
  createIntent:                   jest.fn(),
  updateIntent:                   jest.fn(),
  deleteIntent:                   jest.fn(),
  handoverIntentToRoadmap:        jest.fn(),
  unsendIntent:                   jest.fn(),
  // Stap 11.K — dossier
  fetchUploadsStatus:             jest.fn(),
  extractItemsFromDossier:        jest.fn(),
  fillFieldsFromDossier:          jest.fn(),
  extractPainPointsFromDossier:   jest.fn(),
  acceptDraftItem:                jest.fn(),
  rejectDraftItem:                jest.fn(),
  editDraftItem:                  jest.fn(),
  acceptDraftPainPoint:           jest.fn(),
  rejectDraftPainPoint:           jest.fn(),
  editDraftPainPoint:             jest.fn(),
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

jest.mock("../../../shared/components/AiIcon", () => ({
  __esModule: true,
  default: () => null,
}));

// ── S4: useAuth + useLang gebruikt door KlantenWerkblad voor laag-1 ──
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));


const TEST_CANVAS_ID = "test-canvas-uuid-123";

const sampleDimension = {
  id: "dim-1",
  archetype: "klantsegment",
  name: "Klantsegmenten",
  description: "particuliere + zakelijke",
  sort_order: 10,
  is_ordered: false,
};
const sampleItem = {
  id: "item-1",
  dimension_id: "dim-1",
  canvas_id: TEST_CANVAS_ID,
  name: "Consumer",
  description: null,
  archetype_data: { omvang: "2.4M klanten" },
  sort_order: 10,
  is_draft: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [sampleDimension], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [sampleItem], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({ data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 }, error: null });
});

async function openFase2() {
  // Klik op fase-2-tab zodra Werkruimte is gerenderd
  const fase2 = await screen.findByRole("button", { name: /Pijnpunten/i });
  fireEvent.click(fase2);
}

describe("KlantenWerkblad — fase-2 Pijnpunten flow (stap 11.F)", () => {
  test("fase-2-tab is geactiveerd en rendert PijnpuntenView met lege CTA", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    expect(await screen.findByTestId("pijnpunt-cta-eerste")).toBeInTheDocument();
  });

  test("create-flow: lege tekst → submit disabled; valid + 1 koppeling → createPainPoint + createCoupling", async () => {
    klantenService.createPainPoint.mockResolvedValue({
      data: { id: "new-pain-1", text_md: "Test", canvas_id: TEST_CANVAS_ID },
      error: null,
    });
    klantenService.createCoupling.mockResolvedValue({
      data: { id: "new-coup-1" },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    fireEvent.click(await screen.findByTestId("pijnpunt-cta-eerste"));

    // Modal open
    expect(await screen.findByText("Nieuw pijnpunt")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /^Opslaan$/i });
    expect(submitBtn).toBeDisabled();

    // Vul tekst
    fireEvent.change(screen.getByLabelText("Pijnpunt-tekst"), {
      target: { value: "SME-conversie blijft achter" },
    });
    expect(submitBtn).not.toBeDisabled();

    // Vink één koppeling aan
    fireEvent.click(screen.getByTestId(`koppeling-${sampleItem.id}`));

    // Submit
    await act(async () => { fireEvent.click(submitBtn); });

    expect(klantenService.createPainPoint).toHaveBeenCalledWith({
      canvasId: TEST_CANVAS_ID,
      textMd: "SME-conversie blijft achter",
      sortOrder: 0,
    });
    expect(klantenService.createCoupling).toHaveBeenCalledWith({
      painPointId: "new-pain-1",
      targetTable: "cd_items",
      targetId: sampleItem.id,
    });

    await waitFor(() => {
      expect(screen.queryByText("Nieuw pijnpunt")).not.toBeInTheDocument();
    });
  });

  test("overstijgend warning verschijnt bij tekst zonder koppeling", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    fireEvent.click(await screen.findByTestId("pijnpunt-cta-eerste"));

    fireEvent.change(await screen.findByLabelText("Pijnpunt-tekst"), {
      target: { value: "Klantervaring fragmentarisch" },
    });

    expect(await screen.findByText(/Wordt opgeslagen als overstijgend pijnpunt/i)).toBeInTheDocument();
  });

  test("edit-flow: click op PijnpuntCard → modal opent met bestaande tekst → updatePainPoint", async () => {
    const existingPain = {
      id: "pain-1",
      text_md: "Bestaand pijnpunt",
      is_floating: true,
      canvas_id: TEST_CANVAS_ID,
      sort_order: 10,
    };
    klantenService.listPainPoints.mockResolvedValue({ data: [existingPain], error: null });
    klantenService.updatePainPoint.mockResolvedValue({
      data: { ...existingPain, text_md: "Bewerkt pijnpunt" },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();

    // Card zichtbaar — click opent modal
    fireEvent.click(await screen.findByTestId(`pijnpunt-card-${existingPain.id}`));

    expect(await screen.findByText("Pijnpunt bewerken")).toBeInTheDocument();
    const textArea = screen.getByLabelText("Pijnpunt-tekst");
    expect(textArea).toHaveValue("Bestaand pijnpunt");

    // Wijzig tekst + opslaan
    fireEvent.change(textArea, { target: { value: "Bewerkt pijnpunt" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i }));
    });

    expect(klantenService.updatePainPoint).toHaveBeenCalledWith(existingPain.id, {
      textMd: "Bewerkt pijnpunt",
    });
  });

  test("boy-scout dimensie-edit: click op dimensie-naam-header → DimensieModal opent in edit-mode", async () => {
    klantenService.updateDimension.mockResolvedValue({
      data: { ...sampleDimension, name: "Doelgroepen" },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    // Fase 1 (default) toont DimensieKolom met naam-header
    const editBtn = await screen.findByTestId(`dimensie-edit-${sampleDimension.id}`);
    fireEvent.click(editBtn);

    // Modal opent in edit-mode
    expect(await screen.findByText("Dimensie bewerken")).toBeInTheDocument();

    // Archetype is disabled
    const select = screen.getByLabelText(/Archetype/i);
    expect(select).toBeDisabled();
    expect(select).toHaveValue("klantsegment");

    // Naam is prefilled
    const nameInput = screen.getByLabelText("Naam");
    expect(nameInput).toHaveValue("Klantsegmenten");

    // Wijzig naam + save → updateDimension (NIET createDimension)
    fireEvent.change(nameInput, { target: { value: "Doelgroepen" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i }));
    });

    expect(klantenService.updateDimension).toHaveBeenCalledWith(sampleDimension.id, {
      name: "Doelgroepen",
      description: sampleDimension.description,
    });
    expect(klantenService.createDimension).not.toHaveBeenCalled();
  });

  // ── Bundle 3 F27 — genummerde pijnpunt-bolletjes cross-referentie ────────
  test("F27: drie pijnpunten gesorteerd → cards genummerd 1/2/3 + ItemCard rode-bolletjes tonen nummers", async () => {
    const pains = [
      { id: "pp-1", canvas_id: TEST_CANVAS_ID, text_md: "Eerste pain", is_floating: false, sort_order: 10, is_draft: false },
      { id: "pp-2", canvas_id: TEST_CANVAS_ID, text_md: "Tweede pain", is_floating: false, sort_order: 20, is_draft: false },
      { id: "pp-3", canvas_id: TEST_CANVAS_ID, text_md: "Derde pain",  is_floating: true,  sort_order: 30, is_draft: false },
    ];
    const couplings = [
      { id: "c-1", pain_point_id: "pp-1", target_table: "cd_items", target_id: "item-1" },
      { id: "c-2", pain_point_id: "pp-2", target_table: "cd_items", target_id: "item-1" },
    ];
    klantenService.listPainPoints.mockResolvedValue({ data: pains, error: null });
    klantenService.listCouplingsForCanvas.mockResolvedValue({ data: couplings, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();

    // PijnpuntCards tonen nummer-badges 1/2/3 in sort_order-volgorde
    expect(await screen.findByTestId("pijnpunt-nummer-pp-1")).toHaveTextContent("1");
    expect(screen.getByTestId("pijnpunt-nummer-pp-2")).toHaveTextContent("2");
    expect(screen.getByTestId("pijnpunt-nummer-pp-3")).toHaveTextContent("3");

    // CompactDimensieKolom indicator op item-1 toont nummers 1 + 2 (twee couplings)
    const indicators = screen.getByTestId("item-pijn-indicators-item-1");
    expect(indicators).toHaveTextContent("1");
    expect(indicators).toHaveTextContent("2");
    // Niet 3 — pp-3 koppelt nergens (overstijgend)
    expect(indicators).not.toHaveTextContent("3");
  });
});
