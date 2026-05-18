/**
 * 11.U Block 2b — DoorloopView + PijnpuntFocusCard + ChoiceCards + LensPicker + AiResultDraft.
 *
 * 8 cases:
 *  1. Empty-state als painPoints=[] → doorloop-empty zichtbaar
 *  2. Counter "[1/3]" + Vorige disabled / Volgende enabled
 *  3. Volgende-klik → counter wisselt naar [2/3]
 *  4. PijnpuntFocusCard rendert status-badge "Open" + ChoiceCards (3 paths)
 *  5. Klik "Genereer met AI" → LensPicker met 5 lens-cards
 *  6. Klik lens-card → loading-state + AI-call + AiResultDraft verschijnt
 *  7. AiResultDraft "Wuif weg" → draft sluit, intent gedeletet
 *  8. ChoiceCards "Niet adresseren" → error-banner met Block 3-placeholder-tekst
 *  9. Pijnpunt met coverage_status='dismissed' → motivation-text + reopen-knop
 * 10. Vorige/Volgende reset inline-state (lens-picker close bij wisseling)
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

const TEST_CANVAS_ID = "test-canvas-doorloop";

function pp(id, text, coverage = "open", motivation = null, createdAt = "2026-05-18T08:00:00Z") {
  return {
    id, canvas_id: TEST_CANVAS_ID,
    text_md: text,
    coverage_status: coverage,
    dismissal_motivation: motivation,
    created_at: createdAt,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntentsWithLinks.mockResolvedValue({ data: [], links: [], error: null });
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

describe("11.U Block 2b — DoorloopView volledig functioneel", () => {
  test("1. Empty-state als painPoints=[] → doorloop-empty zichtbaar", async () => {
    klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
    await renderAndOpenFase3();
    expect(screen.getByTestId("doorloop-empty")).toBeInTheDocument();
  });

  test("2. Counter [1/3] + Vorige disabled + Volgende enabled", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1"), pp("p2", "Pijn 2"), pp("p3", "Pijn 3")],
      error: null,
    });
    await renderAndOpenFase3();
    expect(await screen.findByTestId("doorloop-counter")).toHaveTextContent(/\[1\/3\]/);
    expect(screen.getByTestId("doorloop-prev")).toBeDisabled();
    expect(screen.getByTestId("doorloop-next")).not.toBeDisabled();
  });

  test("3. Volgende-klik → counter naar [2/3]", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1"), pp("p2", "Pijn 2"), pp("p3", "Pijn 3")],
      error: null,
    });
    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-next")); });
    expect(screen.getByTestId("doorloop-counter")).toHaveTextContent(/\[2\/3\]/);
  });

  test("4. PijnpuntFocusCard rendert Open-status-badge + ChoiceCards (3)", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijnpunt over claim-fase")],
      error: null,
    });
    await renderAndOpenFase3();
    expect(await screen.findByTestId("doorloop-status-badge-open")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-focus-painpoint-text")).toHaveTextContent("claim-fase");
    expect(screen.getByTestId("doorloop-choice-cards")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-choice-ai")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-choice-eigen")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-choice-dismiss")).toBeInTheDocument();
  });

  test("5. Klik 'Genereer met AI' → LensPicker met 5 lens-cards", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijnpunt")],
      error: null,
    });
    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-choice-ai")); });
    expect(screen.getByTestId("doorloop-lens-picker")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-lens-cluster")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-lens-paradox")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-lens-positionering")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-lens-overstijgend")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-lens-algemeen")).toBeInTheDocument();
  });

  test("6. Klik lens-card → AI-call resolve → AiResultDraft verschijnt", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijnpunt")],
      error: null,
    });
    const fakeIntent = {
      id: "draft-1", title: "AI Title", intent_md: "AI body...",
      source_type: "ai_cluster", original_ai_text_md: "AI body...", status: "concept",
    };
    klantenService.generatePatternSuggestions.mockResolvedValue({ data: [fakeIntent], error: null });
    klantenService.createIntentPainPointLink.mockResolvedValue({ data: { id: "lnk-1" }, error: null });

    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-choice-ai")); });
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-lens-cluster")); });
    // generatePatternSuggestions wordt aangeroepen met action='cluster'
    await waitFor(() =>
      expect(klantenService.generatePatternSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ action: "cluster" }),
      ),
    );
    expect(await screen.findByTestId("doorloop-ai-result-draft")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-ai-draft-title")).toHaveValue("AI Title");
  });

  test("7. AiResultDraft 'Wuif weg' → draft sluit + deleteIntent called", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijnpunt")],
      error: null,
    });
    const fakeIntent = {
      id: "draft-2", title: "Draft", intent_md: "draft body...",
      source_type: "ai_algemeen", original_ai_text_md: "draft body...", status: "concept",
    };
    klantenService.generatePatternSuggestions.mockResolvedValue({ data: [fakeIntent], error: null });
    klantenService.createIntentPainPointLink.mockResolvedValue({ data: {}, error: null });
    klantenService.deleteIntent.mockResolvedValue({ data: null, error: null });

    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-choice-ai")); });
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-lens-algemeen")); });
    await screen.findByTestId("doorloop-ai-result-draft");
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-ai-wuif")); });
    expect(klantenService.deleteIntent).toHaveBeenCalledWith("draft-2");
    expect(screen.queryByTestId("doorloop-ai-result-draft")).not.toBeInTheDocument();
  });

  test("8. ChoiceCards 'Niet adresseren' → error-banner met Block 3 placeholder", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijnpunt")],
      error: null,
    });
    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-choice-dismiss")); });
    expect(screen.getByTestId("doorloop-error-dismiss")).toBeInTheDocument();
    expect(screen.getByText(/Motivatie-modal komt/i)).toBeInTheDocument();
  });

  test("9. Pijnpunt met coverage='dismissed' → motivation + reopen-knop", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn", "dismissed", "Niet relevant na herfasering — strategisch besluit.")],
      error: null,
    });
    klantenService.restorePainPoint.mockResolvedValue({ data: {}, error: null });
    await renderAndOpenFase3();
    expect(await screen.findByTestId("doorloop-status-badge-dismissed")).toBeInTheDocument();
    expect(screen.getByTestId("doorloop-dismissed-motivation")).toHaveTextContent(/Niet relevant na herfasering/);
    const reopenBtn = screen.getByTestId("doorloop-reopen-pain");
    await act(async () => { fireEvent.click(reopenBtn); });
    expect(klantenService.restorePainPoint).toHaveBeenCalledWith("p1");
  });

  test("10. Volgende sluit lens-picker (inline-state reset)", async () => {
    klantenService.listPainPoints.mockResolvedValue({
      data: [pp("p1", "Pijn 1"), pp("p2", "Pijn 2")],
      error: null,
    });
    await renderAndOpenFase3();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-choice-ai")); });
    expect(screen.getByTestId("doorloop-lens-picker")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByTestId("doorloop-next")); });
    // LensPicker dicht na focus-wisseling
    expect(screen.queryByTestId("doorloop-lens-picker")).not.toBeInTheDocument();
    // En ChoiceCards van pijnpunt 2 zichtbaar
    expect(screen.getByTestId("doorloop-choice-cards")).toBeInTheDocument();
  });
});
