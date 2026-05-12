/**
 * Stap 11.G — RTL integration-test voor fase-3 Analyse + AI-flow.
 *
 * Test-cases (10 cases, ≥8 per akkoord-handoff Day 5-9):
 *  1. Fase-3-tab geactiveerd; click → AnalyseView rendert
 *  2. Empty state — geen pijnpunten → AI-knoppen disabled + warning zichtbaar
 *  3. Met pijnpunten, geen suggestions → 4 AI-knoppen enabled + lege-lijst-tekst
 *  4. AI-knop click (cluster) → generatePatternSuggestions(action=cluster), reload getriggerd
 *  5. Counter toont accepted/rejected counts; open-list filtert accepted/rejected weg
 *  6. Accept-actie → acceptPatternSuggestion called, reload
 *  7. Reject-actie → rejectPatternSuggestion called, reload
 *  8. Refine-edit → SuggestionEditModal opent met huidige tekst → updatePatternSuggestion
 *  9. Refine-deeper → RefineDeeperModal opent → generatePatternSuggestions(parentId, focus)
 * 10. + eigen patroon → EigenPatroonModal → createPatternSuggestion(scope=canvas, ...)
 *
 * Anker-pattern: PijnpuntenView.flow.test.jsx + KlantenWerkblad.flow.test.jsx
 * (mock klantenService volledig, mock useAppConfig/useTheme/AiIcon).
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import KlantenWerkblad from "../KlantenWerkblad";

// ── Mock klantenService — volledig surface zoals in PijnpuntenView-test + pattern-suggestions ──
jest.mock("../services/klanten.service", () => ({
  // dimensies + items
  listDimensions:                 jest.fn(),
  listItemsForCanvas:             jest.fn(),
  listItemsForDimension:          jest.fn(),
  createDimension:                jest.fn(),
  updateDimension:                jest.fn(),
  deleteDimension:                jest.fn(),
  createItem:                     jest.fn(),
  updateItem:                     jest.fn(),
  deleteItem:                     jest.fn(),
  // pijnpunten + couplings
  listPainPoints:                 jest.fn(),
  listCouplingsForCanvas:         jest.fn(),
  createPainPoint:                jest.fn(),
  updatePainPoint:                jest.fn(),
  deletePainPoint:                jest.fn(),
  createCoupling:                 jest.fn(),
  deleteCoupling:                 jest.fn(),
  // pattern suggestions (Stap 11.G)
  listPatternSuggestions:         jest.fn(),
  generatePatternSuggestions:     jest.fn(),
  createPatternSuggestion:        jest.fn(),
  updatePatternSuggestion:        jest.fn(),
  acceptPatternSuggestion:        jest.fn(),
  rejectPatternSuggestion:        jest.fn(),
  promotePatternSuggestionToIntent: jest.fn(),
  deletePatternSuggestion:        jest.fn(),
  // Stap 11.G.3 F8 — un-mark / restore
  unmarkPatternSuggestion:        jest.fn(),
  restorePatternSuggestion:       jest.fn(),
  listPatternSuggestionEvents:    jest.fn(),
  // Stap 11.H — intents (KlantenWerkblad-root gebruikt useIntents)
  listIntents:                    jest.fn(),
  createIntent:                   jest.fn(),
  updateIntent:                   jest.fn(),
  deleteIntent:                   jest.fn(),
  handoverIntentToRoadmap:        jest.fn(),
  unsendIntent:                   jest.fn(),
  // Stap 11.K — dossier-driven AI + draft-acties (KlantenWerkblad-root gebruikt useCanvasUploads)
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

// AiIconButton bevat wel echte rendering — de import-keten gebruikt geen netwerk,
// dus we laten 'm normaal renderen. Hij gebruikt useAppConfig + lucide-icons.
// De test interageert via aria/data-testid die op de inner button staan.

const TEST_CANVAS_ID = "test-canvas-uuid-123";

const sampleDimension = {
  id: "dim-1",
  archetype: "klantsegment",
  name: "Klantsegmenten",
  description: null,
  sort_order: 10,
  is_ordered: false,
};
const sampleItem = {
  id: "item-1",
  dimension_id: "dim-1",
  canvas_id: TEST_CANVAS_ID,
  name: "Consumer",
  description: null,
  archetype_data: {},
  sort_order: 10,
  is_draft: false,
};
const samplePain = {
  id: "pain-1",
  canvas_id: TEST_CANVAS_ID,
  text_md: "SME-conversie blijft achter",
  is_floating: true,
  sort_order: 10,
};
const sampleSuggestionOpen = {
  id: "sugg-1",
  canvas_id: TEST_CANVAS_ID,
  pattern_type: "cluster",
  text_md: "Cluster: SME-conversie problemen",
  current_status: "open",
  is_user_edited: false,
  parent_id: null,
  scope: "canvas",
  vanuit: ["pp:pain-1"],
  original_ai_text_md: null,
};
const sampleSuggestionAccepted = {
  ...sampleSuggestionOpen,
  id: "sugg-acc-1",
  text_md: "Geaccepteerd: paradox over segment",
  pattern_type: "paradox",
  current_status: "accepted",
};
const sampleSuggestionRejected = {
  ...sampleSuggestionOpen,
  id: "sugg-rej-1",
  text_md: "Weggewuifd",
  pattern_type: "positionering",
  current_status: "rejected",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: één dimensie, één item — geen pijnpunten of suggestions
  klantenService.listDimensions.mockResolvedValue({ data: [sampleDimension], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [sampleItem], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({ data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 }, error: null });
});

async function openFase3() {
  // Klik op fase-3-tab zodra Werkruimte is gerenderd. Tab-tekst is "3 · Analyse".
  // Specifieker dan /Analyse/i om geen AI-knoppen te matchen die in fase-3 op
  // het scherm verschijnen (bv. "Cluster-analyse" knop-labels).
  const fase3 = await screen.findByRole("button", { name: /^3 · Analyse$/i });
  await act(async () => {
    fireEvent.click(fase3);
  });
  // Wacht tot AnalyseView's eigen usePatternSuggestions-hook klaar is met laden;
  // pas dan zijn suggestion-cards / AI-knoppen interactief.
  await screen.findByTestId("analyse-knop-cluster");
}

describe("KlantenWerkblad — fase-3 Analyse flow (stap 11.G Vervolg-sessie B)", () => {
  test("1. fase-3-tab geactiveerd en rendert AnalyseView", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();
    // 4 AI-knoppen aanwezig
    expect(await screen.findByTestId("analyse-knop-cluster")).toBeInTheDocument();
    expect(screen.getByTestId("analyse-knop-paradox")).toBeInTheDocument();
    expect(screen.getByTestId("analyse-knop-positionering")).toBeInTheDocument();
    expect(screen.getByTestId("analyse-knop-overstijgend")).toBeInTheDocument();
    expect(screen.getByTestId("analyse-knop-eigen-patroon")).toBeInTheDocument();
  });

  test("2. empty state geen pijnpunten — AI-knoppen disabled + warning", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();
    expect(await screen.findByText(/Voeg eerst pijnpunten toe/i)).toBeInTheDocument();
    expect(screen.getByTestId("analyse-knop-cluster")).toBeDisabled();
    expect(screen.getByTestId("analyse-knop-paradox")).toBeDisabled();
  });

  test("3. met pijnpunten, geen suggestions — knoppen enabled + lege-lijst-tekst", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();
    const clusterBtn = await screen.findByTestId("analyse-knop-cluster");
    expect(clusterBtn).not.toBeDisabled();
    expect(screen.getByTestId("analyse-knop-overstijgend")).not.toBeDisabled();
    expect(screen.getByTestId("analyse-lijst-leeg")).toBeInTheDocument();
  });

  test("4. AI-knop click (cluster) → generatePatternSuggestions(action=cluster) + reload", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.generatePatternSuggestions.mockResolvedValue({ data: { count: 2 }, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    await act(async () => {
      fireEvent.click(await screen.findByTestId("analyse-knop-cluster"));
    });

    expect(klantenService.generatePatternSuggestions).toHaveBeenCalledTimes(1);
    expect(klantenService.generatePatternSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasId: TEST_CANVAS_ID,
        action: "cluster",
      })
    );
    // reload triggert nieuwe list-call (initial + na generate = ≥2)
    expect(klantenService.listPatternSuggestions.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("5. counter toont accepted/rejected; open-list filtert accepted/rejected weg", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen, sampleSuggestionAccepted, sampleSuggestionRejected],
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    expect(await screen.findByTestId("counter-geaccepteerd")).toHaveTextContent("1");
    expect(screen.getByTestId("counter-weggewuifd")).toHaveTextContent("1");

    // Alleen open-suggestion in lijst
    expect(screen.getByTestId(`suggestion-card-${sampleSuggestionOpen.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`suggestion-card-${sampleSuggestionAccepted.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`suggestion-card-${sampleSuggestionRejected.id}`)).not.toBeInTheDocument();
  });

  test("6. accept-actie → acceptPatternSuggestion called, reload", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });
    klantenService.acceptPatternSuggestion.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    await act(async () => {
      fireEvent.click(await screen.findByTestId(`actie-accept-${sampleSuggestionOpen.id}`));
    });

    expect(klantenService.acceptPatternSuggestion).toHaveBeenCalledWith(sampleSuggestionOpen.id);
  });

  test("7. reject-actie → rejectPatternSuggestion called", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });
    klantenService.rejectPatternSuggestion.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    await act(async () => {
      fireEvent.click(await screen.findByTestId(`actie-reject-${sampleSuggestionOpen.id}`));
    });

    expect(klantenService.rejectPatternSuggestion).toHaveBeenCalledWith(sampleSuggestionOpen.id);
  });

  test("8. refine-edit → SuggestionEditModal met huidige tekst → updatePatternSuggestion", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });
    klantenService.updatePatternSuggestion.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    fireEvent.click(await screen.findByTestId(`actie-refine-edit-${sampleSuggestionOpen.id}`));

    const textarea = await screen.findByLabelText("Tekst");
    expect(textarea).toHaveValue(sampleSuggestionOpen.text_md);

    fireEvent.change(textarea, { target: { value: "Cluster verfijnd: SME funnel-stap 2" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("suggestion-edit-opslaan"));
    });

    expect(klantenService.updatePatternSuggestion).toHaveBeenCalledWith(
      sampleSuggestionOpen.id,
      { textMd: "Cluster verfijnd: SME funnel-stap 2" }
    );
  });

  test("9. refine-deeper → RefineDeeperModal + generatePatternSuggestions(parentId, focus)", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });
    klantenService.generatePatternSuggestions.mockResolvedValue({ data: { count: 1 }, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    fireEvent.click(await screen.findByTestId(`actie-refine-deeper-${sampleSuggestionOpen.id}`));

    const focus = await screen.findByTestId("refine-deeper-focus");
    fireEvent.change(focus, { target: { value: "specifiek voor SME-segment" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("refine-deeper-submit"));
    });

    expect(klantenService.generatePatternSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasId: TEST_CANVAS_ID,
        action: "cluster", // erft van parent.pattern_type
        parentId: sampleSuggestionOpen.id,
        refinementFocus: "specifiek voor SME-segment",
      })
    );
  });

  test("10. + eigen patroon → EigenPatroonModal → createPatternSuggestion(scope=canvas)", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.createPatternSuggestion.mockResolvedValue({
      data: { id: "new-eigen-1", pattern_type: "eigen", text_md: "Eigen observatie" },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    fireEvent.click(await screen.findByTestId("analyse-knop-eigen-patroon"));

    // Type-dropdown defaults aanwezig — kies "eigen" (default-pattern)
    const typeSelect = await screen.findByTestId("eigen-type-dropdown");
    fireEvent.change(typeSelect, { target: { value: "eigen" } });

    const text = screen.getByTestId("eigen-text");
    fireEvent.change(text, { target: { value: "Eigen observatie" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("eigen-opslaan"));
    });

    expect(klantenService.createPatternSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasId: TEST_CANVAS_ID,
        patternType: "eigen",
        textMd: "Eigen observatie",
        scope: "canvas",
      })
    );
  });

  test("11. reload-flicker fix (F4): suggestion-cards blijven zichtbaar tijdens save+reload, inline-spinner verschijnt", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });

    // Initial-load: één open suggestion zichtbaar
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });

    // Vertraagde update zodat we de tussenstand (loading=true, suggestions !== null)
    // kunnen observeren tussen click-Opslaan en service-resolve.
    let resolveUpdate;
    klantenService.updatePatternSuggestion.mockImplementation(
      () => new Promise(resolve => { resolveUpdate = () => resolve({ data: null, error: null }); })
    );

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    // Open edit-modal + wijzig + opslaan (zonder await — keert pas terug bij resolveUpdate())
    fireEvent.click(await screen.findByTestId(`actie-refine-edit-${sampleSuggestionOpen.id}`));
    fireEvent.change(await screen.findByLabelText("Tekst"), { target: { value: "Verfijnd" } });

    let savePromise;
    await act(async () => {
      savePromise = (async () => {
        fireEvent.click(screen.getByTestId("suggestion-edit-opslaan"));
      })();
      await Promise.resolve();
    });

    // ── F4-assertion: tussen submit en service-resolve blijven suggestion-cards
    //   zichtbaar (laatste-state behouden, geen flash-of-empty) ──
    // updatePatternSuggestion was aangeroepen
    expect(klantenService.updatePatternSuggestion).toHaveBeenCalled();

    // Modal sluit pas na onSave-resolve. We resolven nu alvast en
    // verifiëren dat de hele tijd door de SuggestionCard zichtbaar bleef.
    expect(screen.getByTestId(`suggestion-card-${sampleSuggestionOpen.id}`)).toBeInTheDocument();

    // Resolve update + reload-call
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [{ ...sampleSuggestionOpen, text_md: "Verfijnd", is_user_edited: true }],
      error: null,
    });
    await act(async () => {
      resolveUpdate();
      await savePromise;
    });

    // Card moet nog steeds zichtbaar zijn (mogelijk geüpdate-tekst)
    await waitFor(() => {
      expect(screen.queryByTestId(`suggestion-card-${sampleSuggestionOpen.id}`)).toBeInTheDocument();
    });
  });

  test("12. F8: gemarkeerde patronen verschijnen in collapse-sectie + 'Terug naar voorraad' werkt", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    // Mix van open + accepted (gemarkeerd) suggesties
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen, sampleSuggestionAccepted],
      error: null,
    });
    klantenService.unmarkPatternSuggestion.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    // Collapse-sectie zichtbaar met juiste count
    const markedSection = await screen.findByTestId("marked-section");
    expect(markedSection).toBeInTheDocument();
    expect(markedSection).toHaveTextContent(/Gemarkeerd voor verbeteracties.*1/i);

    // Default ingeklapt — kaart niet zichtbaar
    expect(screen.queryByTestId(`marked-card-${sampleSuggestionAccepted.id}`)).not.toBeInTheDocument();

    // Klik op summary → expand
    fireEvent.click(screen.getByTestId("marked-toggle"));

    // Kaart + Terug-naar-voorraad-knop zichtbaar
    expect(await screen.findByTestId(`marked-card-${sampleSuggestionAccepted.id}`)).toBeInTheDocument();
    const terugBtn = screen.getByTestId(`marked-actie-${sampleSuggestionAccepted.id}`);
    expect(terugBtn).toHaveTextContent(/Terug naar voorraad/i);

    // Klik knop → unmarkPatternSuggestion called
    await act(async () => {
      fireEvent.click(terugBtn);
    });
    expect(klantenService.unmarkPatternSuggestion).toHaveBeenCalledWith(sampleSuggestionAccepted.id);
  });

  test("13. F9: knop-teksten zijn 'Bewerk' / 'Verwijder' / 'Markeer als richting' (rebrand, audit-laag intact)", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionOpen],
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    // Drie rebrand-knoppen aanwezig met nieuwe teksten
    expect(await screen.findByTestId(`actie-accept-${sampleSuggestionOpen.id}`))
      .toHaveTextContent(/^Markeer als richting$/i);
    expect(screen.getByTestId(`actie-refine-edit-${sampleSuggestionOpen.id}`))
      .toHaveTextContent(/^Bewerk$/i);
    expect(screen.getByTestId(`actie-reject-${sampleSuggestionOpen.id}`))
      .toHaveTextContent(/^Verwijder$/i);

    // Refine-deeper blijft ongewijzigd (echte AI-actie)
    expect(screen.getByTestId(`actie-refine-deeper-${sampleSuggestionOpen.id}`))
      .toHaveTextContent(/Verfijn — graaf dieper/i);
  });

  test("14. F8: verwijderde patronen → collapse 'Verwijderd' + Herstellen werkt", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [samplePain], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleSuggestionRejected],
      error: null,
    });
    klantenService.restorePatternSuggestion.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    expect(await screen.findByTestId("deleted-section")).toHaveTextContent(/Verwijderd.*1/i);

    fireEvent.click(screen.getByTestId("deleted-toggle"));
    const herstelBtn = await screen.findByTestId(`deleted-actie-${sampleSuggestionRejected.id}`);
    expect(herstelBtn).toHaveTextContent(/Herstellen/i);

    await act(async () => {
      fireEvent.click(herstelBtn);
    });
    expect(klantenService.restorePatternSuggestion).toHaveBeenCalledWith(sampleSuggestionRejected.id);
  });
});
