/**
 * Stap 11.E correctie — RTL integration-test voor lege-canvas-flow.
 *
 * Test-flow (vervangt Playwright E2E omdat we geen test-credentials /
 * service-role-key beschikbaar hebben voor login op productie):
 *  1. KlantenWerkblad mount met canvasId, mocked service retourneert
 *     dimensions=[] / items=[]
 *  2. Lege-state → CTA "+ Eerste dimensie aanmaken" zichtbaar
 *  3. Click CTA → DimensieCreateModal opent
 *  4. Submit-knop disabled bij geen archetype + geen naam
 *  5. Selecteer archetype + vul naam → submit-knop enabled
 *  6. Click submit → klantenService.createDimension aangeroepen met juiste
 *     params, modal sluit, reload() aangeroepen
 *  7. Mocked service retourneert nu 1 dimensie → DimensieKolom in grid +
 *     "+ dimensie"-knop in gevulde state zichtbaar
 *  8. Geen onverwachte console.errors (proxy voor "0 page-errors")
 *
 * Anker: package.json `@testing-library/react` + `@testing-library/user-event`
 * + `@testing-library/jest-dom` (al geïnstalleerd in CRA-config). React-
 * scripts test command (jest in jsdom-mode).
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import KlantenWerkblad from "../KlantenWerkblad";

// ── Mock klantenService ──
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
  // Stap 11.F — pijnpunten + couplings (default leeg in deze testfile)
  listPainPoints:           jest.fn(),
  listCouplingsForCanvas:   jest.fn(),
  createPainPoint:          jest.fn(),
  updatePainPoint:          jest.fn(),
  deletePainPoint:          jest.fn(),
  createCoupling:           jest.fn(),
  deleteCoupling:           jest.fn(),
  // Stap 11.G — pattern suggestions (KlantenWerkblad gebruikt usePatternSuggestions
  // sinds Vervolg-sessie B; default leeg, andere niet aangeroepen in deze testfile)
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

// ── Mock AppConfigContext.useAppConfig om Provider-roundtrip te vermijden ──
jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label: (key, fallback) => fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

// ── Mock useTheme (gebruikt in RapportView, defensief) ──
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform" }),
}));

// ── Mock AiIcon (lucide-react import is OK) ──
jest.mock("../../../shared/components/AiIcon", () => ({
  __esModule: true,
  default: () => null,
}));

const TEST_CANVAS_ID = "test-canvas-uuid-123";

beforeEach(() => {
  jest.clearAllMocks();
  // Default: leeg canvas
  klantenService.listDimensions.mockResolvedValue({ data: [], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  // Stap 11.F: pijnpunten ook leeg (usePainPoints wordt sinds 11.F altijd aangeroepen)
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  // Stap 11.G Vervolg-sessie B: pattern suggestions leeg (usePatternSuggestions
  // wordt nu in KlantenWerkblad geladen voor RapportView)
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({ data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 }, error: null });
});

describe("KlantenWerkblad — lege-canvas flow (stap 11.E correctie)", () => {
  test("toont lege-state CTA en opent DimensieCreateModal bij click", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);

    // Wacht tot loading-state weg is
    const cta = await screen.findByTestId("dimensie-cta-eerste");
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent(/Eerste dimensie aanmaken/i);

    // Click CTA → modal opent
    fireEvent.click(cta);
    expect(await screen.findByText("Nieuwe dimensie")).toBeInTheDocument();
  });

  test("submit disabled tot archetype + naam ingevuld; bij valid invoer slaat dimensie op", async () => {
    let resolvedDim = null;
    klantenService.createDimension.mockImplementation(async (args) => {
      resolvedDim = args;
      return {
        data: {
          id: "new-dim-1",
          archetype: args.archetype,
          name: args.name,
          description: args.description,
          canvas_id: TEST_CANVAS_ID,
          sort_order: args.sortOrder,
        },
        error: null,
      };
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);

    // Open modal
    fireEvent.click(await screen.findByTestId("dimensie-cta-eerste"));

    // Submit-knop initieel disabled (geen archetype + geen naam)
    const submitBtn = await screen.findByRole("button", { name: /^Opslaan$/i });
    expect(submitBtn).toBeDisabled();

    // Selecteer archetype "klantsegment"
    const select = screen.getByLabelText("Archetype");
    fireEvent.change(select, { target: { value: "klantsegment" } });

    // Submit-knop nog steeds disabled (geen naam)
    expect(submitBtn).toBeDisabled();

    // Vul naam in
    const nameInput = screen.getByLabelText("Naam");
    fireEvent.change(nameInput, { target: { value: "Test-segmenten" } });

    // Submit-knop nu enabled
    expect(submitBtn).not.toBeDisabled();

    // Vul ook omschrijving voor volledigheid
    fireEvent.change(screen.getByLabelText("Omschrijving (optioneel)"), {
      target: { value: "test-omschrijving" },
    });

    // Click submit
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // createDimension is aangeroepen met juiste params
    expect(klantenService.createDimension).toHaveBeenCalledTimes(1);
    expect(resolvedDim).toEqual({
      canvasId: TEST_CANVAS_ID,
      archetype: "klantsegment",
      name: "Test-segmenten",
      description: "test-omschrijving",
      isOrdered: false,  // klantsegment != klantreis
      sortOrder: 0,
    });

    // Modal sluit (titel verdwijnt)
    await waitFor(() => {
      expect(screen.queryByText("Nieuwe dimensie")).not.toBeInTheDocument();
    });
  });

  test("disabled archetypes (regio/behoefte/merk/gedrag/klantreis/anders) zijn zichtbaar in dropdown", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("dimensie-cta-eerste"));

    const select = await screen.findByLabelText("Archetype");
    const options = Array.from(select.querySelectorAll("option"));

    // 1 placeholder + 9 archetypes = 10 options
    expect(options).toHaveLength(10);

    // Drie enabled (klantsegment, propositie, kanaal)
    const enabledValues = options.filter(o => !o.disabled && o.value !== "").map(o => o.value);
    expect(enabledValues.sort()).toEqual(["kanaal", "klantsegment", "propositie"]);

    // Zes disabled
    const disabledValues = options.filter(o => o.disabled && o.value !== "").map(o => o.value);
    expect(disabledValues.sort()).toEqual(
      ["anders", "behoefte", "gedragspatroon", "klantreis", "merk", "regio"]
    );
  });

  test("gevulde state toont '+ dimensie'-knop én DimensieKolommen", async () => {
    klantenService.listDimensions.mockResolvedValue({
      data: [
        { id: "dim-1", archetype: "klantsegment", name: "Klantsegmenten", description: null, sort_order: 10, is_ordered: false },
      ],
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);

    // CTA-eerste afwezig, CTA-extra aanwezig
    expect(await screen.findByTestId("dimensie-cta-extra")).toBeInTheDocument();
    expect(screen.queryByTestId("dimensie-cta-eerste")).not.toBeInTheDocument();

    // DimensieKolom-titel zichtbaar
    expect(screen.getByText("Klantsegmenten")).toBeInTheDocument();
  });

  test("API-error in createDimension toont melding in modal en houdt 'm open", async () => {
    klantenService.createDimension.mockResolvedValue({
      data: null,
      error: new Error("RLS-policy weigerde insert"),
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    fireEvent.click(await screen.findByTestId("dimensie-cta-eerste"));

    fireEvent.change(screen.getByLabelText("Archetype"), { target: { value: "kanaal" } });
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "X" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i }));
    });

    // Error zichtbaar in modal-body
    expect(await screen.findByText(/RLS-policy weigerde insert/i)).toBeInTheDocument();

    // Modal nog steeds open (titel zichtbaar)
    expect(screen.getByText("Nieuwe dimensie")).toBeInTheDocument();
  });

  // ── Stap 11.K.2 F16 — canonical-delete-flow ────────────────────────────
  test("F16: ItemModal in edit-mode toont Verwijderen-knop; bevestigen → deleteItem called", async () => {
    const sampleDim = {
      id: "dim-1", archetype: "klantsegment", name: "Klantsegmenten",
      description: null, sort_order: 10, is_ordered: false,
    };
    const sampleItem = {
      id: "item-1", dimension_id: "dim-1", canvas_id: TEST_CANVAS_ID,
      name: "Bestaand item", description: "uit DB",
      archetype_data: {}, is_draft: false, sort_order: 10,
    };
    klantenService.listDimensions.mockResolvedValue({ data: [sampleDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [sampleItem], error: null });
    klantenService.deleteItem.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);

    // Klik op item-card → opent ItemModal in edit-mode
    const itemCard = await screen.findByText("Bestaand item");
    await act(async () => { fireEvent.click(itemCard); });

    // Verwijder-knop zichtbaar
    const deleteBtn = await screen.findByTestId("item-modal-delete");
    expect(deleteBtn).toBeInTheDocument();

    // Click → inline-confirm strook zichtbaar (Opslaan-knop verborgen)
    await act(async () => { fireEvent.click(deleteBtn); });
    expect(await screen.findByTestId("item-modal-delete-confirm")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Opslaan$/i })).not.toBeInTheDocument();

    // Annuleren → terug naar normale state
    await act(async () => { fireEvent.click(screen.getByTestId("item-modal-delete-confirm-nee")); });
    expect(screen.queryByTestId("item-modal-delete-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-modal-delete")).toBeInTheDocument();

    // Opnieuw verwijderen → bevestigen → deleteItem called
    await act(async () => { fireEvent.click(screen.getByTestId("item-modal-delete")); });
    await act(async () => { fireEvent.click(screen.getByTestId("item-modal-delete-confirm-ja")); });

    expect(klantenService.deleteItem).toHaveBeenCalledWith("item-1");
  });

  test("F16: ItemModal in create-mode toont GEEN Verwijderen-knop", async () => {
    const sampleDim = {
      id: "dim-1", archetype: "klantsegment", name: "Klantsegmenten",
      description: null, sort_order: 10, is_ordered: false,
    };
    klantenService.listDimensions.mockResolvedValue({ data: [sampleDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    // Open create-item modal via "+ item"-knop
    const addBtn = await screen.findByRole("button", { name: /\+ item$/i });
    await act(async () => { fireEvent.click(addBtn); });

    // Modal open, maar GEEN delete-knop in create-mode
    expect(await screen.findByText("Nieuw item")).toBeInTheDocument();
    expect(screen.queryByTestId("item-modal-delete")).not.toBeInTheDocument();
  });

  test("F16: PijnpuntModal in edit-mode toont Verwijderen-knop; bevestigen → deletePainPoint called", async () => {
    const samplePain = {
      id: "pain-1", canvas_id: TEST_CANVAS_ID,
      text_md: "Bestaand pijnpunt", is_floating: true, is_draft: false, sort_order: 10,
    };
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.deletePainPoint.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    // Switch naar fase 2
    const fase2 = await screen.findByRole("button", { name: /^2 · Pijnpunten$/i });
    await act(async () => { fireEvent.click(fase2); });

    // Klik op pijnpunt-card → opent PijnpuntModal in edit-mode
    const painCard = await screen.findByText("Bestaand pijnpunt");
    await act(async () => { fireEvent.click(painCard); });

    const deleteBtn = await screen.findByTestId("pijnpunt-modal-delete");
    expect(deleteBtn).toBeInTheDocument();

    await act(async () => { fireEvent.click(deleteBtn); });
    await act(async () => { fireEvent.click(screen.getByTestId("pijnpunt-modal-delete-confirm-ja")); });

    expect(klantenService.deletePainPoint).toHaveBeenCalledWith("pain-1");
  });
});
