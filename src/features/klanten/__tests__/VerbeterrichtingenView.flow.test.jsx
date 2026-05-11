/**
 * Stap 11.H — RTL integration-test voor fase-4 Verbeterrichtingen flow.
 *
 * Test-cases (10 cases, ≥8 per instructie):
 *  1. Fase-4-tab geactiveerd + VerbeterrichtingenView rendert met counter
 *  2. "+ verbeterrichting toevoegen" → IntentModal opent
 *  3. Valid invoer + opslaan → createIntent called, kaart verschijnt
 *  4. Status-badge "concept" zichtbaar bij nieuwe intent
 *  5. "Markeer als verstuurd" → confirm + handoverIntentToRoadmap, status update
 *  6. "Terugtrekken" → unsendIntent, status terug naar concept
 *  7. Edit-flow: click Bewerk → IntentModal in edit-mode met prefilled state
 *  8. Verwijder-flow: click Verwijder → deleteIntent called
 *  9. Promote-flow vanuit fase 3: knop in gemarkeerde collapse → PromoteToIntentModal
 *     → promotePatternSuggestionToIntent met body, intents reloaden
 * 10. Lege-state: geen intents → empty-state-tekst zichtbaar
 *
 * Anker-pattern: AnalyseView.flow.test.jsx (mock klantenService volledig,
 * mock useAppConfig/useTheme/AiIcon, gebruik testIds).
 */

import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import KlantenWerkblad from "../KlantenWerkblad";

// ── Mock klantenService — uitgebreid met intent-functies (stap 11.H) ──
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
  // Stap 11.H intents
  listIntents:                     jest.fn(),
  createIntent:                    jest.fn(),
  updateIntent:                    jest.fn(),
  deleteIntent:                    jest.fn(),
  handoverIntentToRoadmap:         jest.fn(),
  unsendIntent:                    jest.fn(),
  // Stap 11.K — dossier
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

jest.mock("../../../shared/components/AiIcon", () => ({
  __esModule: true,
  default: () => null,
}));

const TEST_CANVAS_ID = "test-canvas-uuid-h";

const sampleDimension = {
  id: "dim-1",
  archetype: "klantsegment",
  name: "Klantsegmenten",
  description: null,
  sort_order: 10,
  is_ordered: false,
};

const sampleConceptIntent = {
  id: "intent-1",
  canvas_id: TEST_CANVAS_ID,
  title: "SME-bediening structureel versterken",
  intent_md: "Bouw een gespecialiseerd SME-team met eigen propositie en bediening, gericht op het knelpunt rond conversie en activering.",
  status: "concept",
  vanuit: ["pp:pain-1"],
  source_suggestion_id: null,
  handover_to_roadmap_at: null,
  sort_order: 10,
};

const sampleVerstuurdIntent = {
  ...sampleConceptIntent,
  id: "intent-2",
  title: "Digitale kanalen herinrichten",
  status: "verstuurd",
  handover_to_roadmap_at: "2026-05-11T10:00:00Z",
  sort_order: 20,
};

const sampleMarkedSuggestion = {
  id: "sugg-marked-1",
  canvas_id: TEST_CANVAS_ID,
  pattern_type: "cluster",
  text_md: "Cluster: SME-conversie problemen rond onboarding en propositie",
  current_status: "accepted",
  is_user_edited: false,
  parent_id: null,
  scope: "canvas",
  vanuit: ["pp:pain-1"],
  original_ai_text_md: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [sampleDimension], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({ data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 }, error: null });
});

async function openFase4() {
  const fase4 = await screen.findByRole("button", { name: /^4 · Verbeterrichtingen$/i });
  await act(async () => {
    fireEvent.click(fase4);
  });
  await screen.findByTestId("verbeterrichting-counter");
}

async function openFase3() {
  const fase3 = await screen.findByRole("button", { name: /^3 · Analyse$/i });
  await act(async () => {
    fireEvent.click(fase3);
  });
  await screen.findByTestId("analyse-knop-cluster");
}

describe("KlantenWerkblad — fase-4 Verbeterrichtingen flow (stap 11.H)", () => {
  test("1. fase-4-tab geactiveerd + counter 0 concept · 0 verstuurd", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();
    expect(screen.getByTestId("counter-concept")).toHaveTextContent("0");
    expect(screen.getByTestId("counter-verstuurd")).toHaveTextContent("0");
    expect(screen.getByTestId("verbeterrichting-lijst-leeg")).toBeInTheDocument();
  });

  test("2. + verbeterrichting toevoegen → IntentModal opent", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();
    await act(async () => {
      fireEvent.click(screen.getByTestId("verbeterrichting-knop-toevoegen"));
    });
    expect(screen.getByTestId("intent-veld-titel")).toBeInTheDocument();
    expect(screen.getByTestId("intent-veld-md")).toBeInTheDocument();
  });

  test("3. valid invoer + opslaan → createIntent + kaart verschijnt", async () => {
    klantenService.createIntent.mockResolvedValue({ data: sampleConceptIntent, error: null });
    // Na reload: intent in lijst
    klantenService.listIntents
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [sampleConceptIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    await act(async () => {
      fireEvent.click(screen.getByTestId("verbeterrichting-knop-toevoegen"));
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("intent-veld-titel"), {
        target: { value: "SME-bediening structureel versterken" },
      });
      fireEvent.change(screen.getByTestId("intent-veld-md"), {
        target: { value: "Bouw een gespecialiseerd SME-team met eigen propositie en bediening om conversie te verhogen." },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("intent-modal-opslaan"));
    });

    expect(klantenService.createIntent).toHaveBeenCalledTimes(1);
    expect(klantenService.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasId: TEST_CANVAS_ID,
        title: "SME-bediening structureel versterken",
      })
    );
    // Kaart in lijst na reload
    expect(await screen.findByTestId(`intent-card-${sampleConceptIntent.id}`)).toBeInTheDocument();
  });

  test("4. status-badge concept zichtbaar bij nieuwe intent", async () => {
    klantenService.listIntents.mockResolvedValue({ data: [sampleConceptIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    const badge = await screen.findByTestId(`intent-status-${sampleConceptIntent.id}`);
    expect(badge).toHaveTextContent(/concept/i);
  });

  test("5. Markeer als verstuurd → confirm + handover + status update", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    klantenService.handoverIntentToRoadmap.mockResolvedValue({
      data: { ...sampleConceptIntent, status: "verstuurd", handover_to_roadmap_at: "2026-05-11T10:00:00Z" },
      error: null,
    });
    klantenService.listIntents
      .mockResolvedValueOnce({ data: [sampleConceptIntent], error: null })
      .mockResolvedValue({
        data: [{ ...sampleConceptIntent, status: "verstuurd", handover_to_roadmap_at: "2026-05-11T10:00:00Z" }],
        error: null,
      });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    await act(async () => {
      fireEvent.click(await screen.findByTestId(`intent-actie-markeer-${sampleConceptIntent.id}`));
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(klantenService.handoverIntentToRoadmap).toHaveBeenCalledWith(sampleConceptIntent.id);
    confirmSpy.mockRestore();
  });

  test("6. Terugtrekken → unsendIntent called", async () => {
    klantenService.unsendIntent.mockResolvedValue({
      data: { ...sampleVerstuurdIntent, status: "concept", handover_to_roadmap_at: null },
      error: null,
    });
    klantenService.listIntents.mockResolvedValue({ data: [sampleVerstuurdIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    // Verstuurde intent zit in collapse-sectie — open en klik Terugtrekken
    const verstuurdSection = await screen.findByTestId("verbeterrichting-lijst-verstuurd");
    const toggle = within(verstuurdSection).getByTestId("verstuurd-toggle");
    await act(async () => {
      fireEvent.click(toggle);
    });
    await act(async () => {
      fireEvent.click(within(verstuurdSection).getByTestId(`verstuurd-actie-${sampleVerstuurdIntent.id}`));
    });

    expect(klantenService.unsendIntent).toHaveBeenCalledWith(sampleVerstuurdIntent.id);
  });

  test("7. Bewerk-flow: IntentModal in edit-mode met prefilled state", async () => {
    klantenService.listIntents.mockResolvedValue({ data: [sampleConceptIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    await act(async () => {
      fireEvent.click(await screen.findByTestId(`intent-actie-bewerk-${sampleConceptIntent.id}`));
    });

    const titleInput = screen.getByTestId("intent-veld-titel");
    expect(titleInput).toHaveValue(sampleConceptIntent.title);
    const mdInput = screen.getByTestId("intent-veld-md");
    expect(mdInput).toHaveValue(sampleConceptIntent.intent_md);
  });

  test("8. Verwijder-flow → deleteIntent called", async () => {
    klantenService.listIntents.mockResolvedValue({ data: [sampleConceptIntent], error: null });
    klantenService.deleteIntent.mockResolvedValue({ data: null, error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    await act(async () => {
      fireEvent.click(await screen.findByTestId(`intent-actie-verwijder-${sampleConceptIntent.id}`));
    });
    expect(klantenService.deleteIntent).toHaveBeenCalledWith(sampleConceptIntent.id);
  });

  test("9. Promote-flow vanuit fase 3 → PromoteToIntentModal + service-call met body", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
    klantenService.listPatternSuggestions.mockResolvedValue({
      data: [sampleMarkedSuggestion],
      error: null,
    });
    klantenService.promotePatternSuggestionToIntent.mockResolvedValue({
      data: { ...sampleMarkedSuggestion, current_status: "promoted" },
      intent: { ...sampleConceptIntent, source_suggestion_id: sampleMarkedSuggestion.id },
      error: null,
    });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase3();

    // Open collapse "Gemarkeerd"
    const markedSection = await screen.findByTestId("marked-section");
    await act(async () => {
      fireEvent.click(within(markedSection).getByTestId("marked-toggle"));
    });

    // Promote-knop in collapse
    const promoteBtn = await within(markedSection).findByTestId(
      `marked-actie-promote-${sampleMarkedSuggestion.id}`
    );
    await act(async () => {
      fireEvent.click(promoteBtn);
    });

    // PromoteToIntentModal opent met pre-vulling
    const titleInput = await screen.findByTestId("promote-veld-titel");
    expect(titleInput.value.length).toBeGreaterThan(0);
    const mdInput = screen.getByTestId("promote-veld-md");
    expect(mdInput).toHaveValue(sampleMarkedSuggestion.text_md);

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByTestId("promote-modal-opslaan"));
    });

    expect(klantenService.promotePatternSuggestionToIntent).toHaveBeenCalledTimes(1);
    const [calledId, calledBody] = klantenService.promotePatternSuggestionToIntent.mock.calls[0];
    expect(calledId).toBe(sampleMarkedSuggestion.id);
    expect(calledBody).toHaveProperty("title");
    expect(calledBody).toHaveProperty("intentMd");
  });

  test("10. lege-state: empty-tekst zichtbaar wanneer geen intents", async () => {
    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();
    expect(screen.getByTestId("verbeterrichting-lijst-leeg")).toBeInTheDocument();
  });

  // ── Stap 11.K.2 F18 — UI-rebrand 'verstuurd' → 'in roadmap' ────────────
  test("11. F18: concept-intent toont 'Markeer als in roadmap'-knop (rebrand)", async () => {
    klantenService.listIntents.mockResolvedValue({ data: [sampleConceptIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    // Markeer-knop bestaat met nieuwe rebrand-fallback (label-mock retourneert fallback)
    const markeerBtn = await screen.findByTestId(`intent-actie-markeer-${sampleConceptIntent.id}`);
    expect(markeerBtn).toHaveTextContent(/markeer als in roadmap/i);
    expect(markeerBtn).not.toHaveTextContent(/verstuurd/i);
  });

  test("12. F18: verstuurd-intent toont 'In roadmap'-badge + 'in roadmap sinds {date}' + 'Haal uit roadmap'-knop", async () => {
    klantenService.listIntents.mockResolvedValue({ data: [sampleVerstuurdIntent], error: null });

    render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
    await openFase4();

    // Verstuurd-intent zit in collapse-sectie — open en check knop-tekst
    const verstuurdSection = await screen.findByTestId("verbeterrichting-lijst-verstuurd");
    expect(verstuurdSection).toHaveTextContent(/in roadmap/i);
    expect(verstuurdSection).not.toHaveTextContent(/^Verstuurd \(/m);

    // Open collapse en check terugtrekken-knop heeft nieuwe label
    const toggle = within(verstuurdSection).getByTestId("verstuurd-toggle");
    await act(async () => { fireEvent.click(toggle); });
    const terugtrekBtn = within(verstuurdSection).getByTestId(`verstuurd-actie-${sampleVerstuurdIntent.id}`);
    expect(terugtrekBtn).toHaveTextContent(/haal uit roadmap/i);
    expect(terugtrekBtn).not.toHaveTextContent(/^Terugtrekken$/i);
  });
});
