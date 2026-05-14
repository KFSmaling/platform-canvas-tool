/**
 * Stap 11.K — RTL integration-tests voor dossier-driven AI-affordances.
 *
 * Test-cases (8 cases, ≥6 per instructie):
 *  1. A1-knop disabled zonder uploads → tooltip + disabled-state
 *  2. A1 → extractItemsFromDossier called met canvasId+dimensionId, draft-items
 *     verschijnen (na reload) met opacity + badge
 *  3. Draft-item accept → acceptDraftItem called → canonical item zichtbaar
 *  4. Draft-item reject → rejectDraftItem called, row weg
 *  5. A2-knop in ItemModal disabled wanneer item nog niet bestaat (create-mode)
 *  6. A3-knop disabled zonder canonical items (alleen draft-items in canvas)
 *  7. A3 → extractPainPointsFromDossier called, draft-pain verschijnt met badge
 *  8. Draft-pain accept → acceptDraftPainPoint called met materialise-couplings
 *
 * Anker: VerbeterrichtingenView.flow.test.jsx + AnalyseView.flow.test.jsx.
 * Mock klantenService volledig + AppConfig/useTheme/AiIcon.
 */

import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import KlantenWerkblad from "../KlantenWerkblad";

jest.mock("../services/klanten.service", () => ({
  listDimensions:                  jest.fn(),
  listItemsForCanvas:              jest.fn(),
  listItemsForDimension:           jest.fn(),
  createDimension:                 jest.fn(),
  updateDimension:                 jest.fn(),
  deleteDimension:                 jest.fn(),
  createItem:                      jest.fn(),
  updateItem:                      jest.fn(),
  deleteItem:                      jest.fn(),
  listPainPoints:                  jest.fn(),
  listCouplingsForCanvas:          jest.fn(),
  createPainPoint:                 jest.fn(),
  updatePainPoint:                 jest.fn(),
  deletePainPoint:                 jest.fn(),
  createCoupling:                  jest.fn(),
  deleteCoupling:                  jest.fn(),
  listPatternSuggestions:          jest.fn(),
  generatePatternSuggestions:      jest.fn(),
  createPatternSuggestion:         jest.fn(),
  updatePatternSuggestion:         jest.fn(),
  acceptPatternSuggestion:         jest.fn(),
  rejectPatternSuggestion:         jest.fn(),
  promotePatternSuggestionToIntent: jest.fn(),
  deletePatternSuggestion:         jest.fn(),
  unmarkPatternSuggestion:         jest.fn(),
  restorePatternSuggestion:        jest.fn(),
  listPatternSuggestionEvents:     jest.fn(),
  listIntents:                     jest.fn(),
  createIntent:                    jest.fn(),
  updateIntent:                    jest.fn(),
  deleteIntent:                    jest.fn(),
  handoverIntentToRoadmap:         jest.fn(),
  unsendIntent:                    jest.fn(),
  // Stap 11.K
  fetchUploadsStatus:              jest.fn(),
  extractItemsFromDossier:         jest.fn(),
  fillFieldsFromDossier:           jest.fn(),
  extractPainPointsFromDossier:    jest.fn(),
  acceptDraftItem:                 jest.fn(),
  rejectDraftItem:                 jest.fn(),
  editDraftItem:                   jest.fn(),
  acceptDraftPainPoint:            jest.fn(),
  rejectDraftPainPoint:            jest.fn(),
  editDraftPainPoint:              jest.fn(),
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

// ── S4: useAuth + useLang gebruikt door KlantenWerkblad voor laag-1 ──
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));


const TEST_CANVAS_ID = "test-canvas-uuid-k";

const sampleDimension = {
  id: "dim-1",
  archetype: "klantsegment",
  name: "Klantsegmenten",
  description: "particulier + zakelijk",
  sort_order: 10,
  is_ordered: false,
};

const canonicalItem = {
  id: "item-canonical-1",
  dimension_id: "dim-1",
  canvas_id: TEST_CANVAS_ID,
  name: "SME-zaken",
  description: null,
  archetype_data: {},
  is_draft: false,
  sort_order: 10,
};

const draftItem = {
  id: "item-draft-1",
  dimension_id: "dim-1",
  canvas_id: TEST_CANVAS_ID,
  name: "Doelgroep Premium",
  description: "Vermogende klanten 65+",
  archetype_data: {},
  is_draft: true,
  sort_order: 20,
};

const draftPain = {
  id: "pain-draft-1",
  canvas_id: TEST_CANVAS_ID,
  text_md: "Conversie van SME-leads ligt 18% onder benchmark",
  is_floating: true,
  is_draft: true,
  sort_order: 10,
};

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [sampleDimension], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({
    data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 },
    error: null,
  });
});

async function openFase2() {
  const fase2 = await screen.findByRole("button", { name: /^2 · Pijnpunten$/i });
  await act(async () => {
    fireEvent.click(fase2);
  });
}

describe("KlantenWerkblad — dossier-driven AI-affordances (stap 11.K)", () => {
  test("1. A1-knop disabled zonder geïndexeerde chunks", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 },
      error: null,
    });
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    const btn = await screen.findByTestId(`dossier-items-extract-${sampleDimension.id}`);
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/upload eerst documenten/i));
  });

  test("2. A1 → extractItemsFromDossier called met juiste args; draft-items verschijnen na reload", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.extractItemsFromDossier.mockResolvedValue({
      data: [draftItem],
      error: null,
      meta: { ai_model: "claude-haiku-4-5-20251001", chunk_count: 6 },
    });
    // 2e listItemsForCanvas-call na reload geeft draft terug
    klantenService.listItemsForCanvas
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [draftItem], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    const btn = await screen.findByTestId(`dossier-items-extract-${sampleDimension.id}`);
    expect(btn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(klantenService.extractItemsFromDossier).toHaveBeenCalledWith(TEST_CANVAS_ID, sampleDimension.id);
    expect(await screen.findByTestId(`draft-item-${draftItem.id}`)).toBeInTheDocument();
  });

  test("3. Draft-item accept → acceptDraftItem called met item-id", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [draftItem], error: null });
    klantenService.acceptDraftItem.mockResolvedValue({ data: { ...draftItem, is_draft: false }, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    const acceptBtn = await screen.findByTestId(`draft-item-accept-${draftItem.id}`);
    await act(async () => {
      fireEvent.click(acceptBtn);
    });
    expect(klantenService.acceptDraftItem).toHaveBeenCalledWith(draftItem.id);
  });

  test("4. Draft-item reject → rejectDraftItem called", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [draftItem], error: null });
    klantenService.rejectDraftItem.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    const rejectBtn = await screen.findByTestId(`draft-item-reject-${draftItem.id}`);
    await act(async () => {
      fireEvent.click(rejectBtn);
    });
    expect(klantenService.rejectDraftItem).toHaveBeenCalledWith(draftItem.id);
  });

  test("5. A2-knop in ItemModal disabled wanneer item nog niet bestaat (create-mode)", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    // Open create-item modal via "+ item"-knop
    const addItemBtn = await screen.findByRole("button", { name: /\+ item$/i });
    await act(async () => {
      fireEvent.click(addItemBtn);
    });
    const fillBtn = await screen.findByTestId("dossier-fields-fill");
    expect(fillBtn).toBeDisabled();
    expect(fillBtn).toHaveAttribute("title", expect.stringMatching(/bewaar eerst het item/i));
  });

  test("6. A3-knop disabled zonder canonical items (alleen draft-items aanwezig)", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [draftItem], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    const a3Btn = await screen.findByTestId("dossier-pain-points-extract");
    expect(a3Btn).toBeDisabled();
    expect(a3Btn).toHaveAttribute("title", expect.stringMatching(/voeg eerst items toe/i));
  });

  test("7. A3 → extractPainPointsFromDossier called; draft-pain met badge zichtbaar", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [canonicalItem], error: null });
    klantenService.listPainPoints
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [draftPain], error: null });
    klantenService.extractPainPointsFromDossier.mockResolvedValue({
      data: [draftPain],
      error: null,
      meta: { ai_model: "claude-haiku-4-5-20251001", chunk_count: 6 },
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    const a3Btn = await screen.findByTestId("dossier-pain-points-extract");
    expect(a3Btn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(a3Btn);
    });
    expect(klantenService.extractPainPointsFromDossier).toHaveBeenCalledWith(TEST_CANVAS_ID);
    expect(await screen.findByTestId(`draft-pain-${draftPain.id}`)).toBeInTheDocument();
  });

  test("8. Draft-pain accept → acceptDraftPainPoint called (couplings materialisatie server-side)", async () => {
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 1, indexedChunkCount: 6 },
      error: null,
    });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [canonicalItem], error: null });
    klantenService.listPainPoints.mockResolvedValue({ data: [draftPain], error: null });
    klantenService.acceptDraftPainPoint.mockResolvedValue({
      data: { ...draftPain, is_draft: false },
      meta: { created_couplings: 1, skipped_couplings: 0 },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase2();
    const draftSection = await screen.findByTestId("draft-pains-section");
    const acceptBtn = within(draftSection).getByTestId(`draft-pain-accept-${draftPain.id}`);
    await act(async () => {
      fireEvent.click(acceptBtn);
    });
    expect(klantenService.acceptDraftPainPoint).toHaveBeenCalledWith(draftPain.id);
  });

});
