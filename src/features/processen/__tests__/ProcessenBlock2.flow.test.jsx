/**
 * 11.M.1 Block-2 — Verbeteracties-AI + Motivatie-modal RTL.
 *
 * Cases (7 totaal):
 *  1. 6 source-tabs render (5 AI + Eigen) in juiste volgorde
 *  2. AI-tab "Algemeen" click → genereer-knop zichtbaar (niet +Verbeteractie)
 *  3. AI-generate flow: click "Genereer met AI" → service-call + ai-note feedback
 *  4. Eigen-tab → +Verbeteractie-flow zichtbaar (geen genereer-knop)
 *  5. AI-gegenereerde concept toont AI-bron-pill met source-type-label
 *  6. Motivatie-modal opent + submit disabled bij <20 chars + werkt bij ≥20
 *  7. motivated_no_action toggle → reset-knop verschijnt + reset werkt
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../services/processen.service", () => ({
  listProcesses:               jest.fn(),
  createProcess:               jest.fn(),
  updateProcess:               jest.fn(),
  deleteProcess:               jest.fn(),
  getStructuringDoorsnede:     jest.fn(),
  listDepartments:             jest.fn(),
  createDepartment:            jest.fn(),
  updateDepartment:            jest.fn(),
  deleteDepartment:            jest.fn(),
  getChangeApproach:           jest.fn(),
  setChangeApproach:           jest.fn(),
  listBusinessUnits:           jest.fn(),
  createBusinessUnit:          jest.fn(),
  updateBusinessUnit:          jest.fn(),
  deleteBusinessUnit:          jest.fn(),
  listValueTeams:              jest.fn(),
  createValueTeam:             jest.fn(),
  updateValueTeam:             jest.fn(),
  deleteValueTeam:             jest.fn(),
  getSteeringModel:            jest.fn(),
  setSteeringModel:            jest.fn(),
  listControlProcesses:        jest.fn(),
  createControlProcess:        jest.fn(),
  updateControlProcess:        jest.fn(),
  deleteControlProcess:        jest.fn(),
  listPainPoints:              jest.fn(),
  createPainPoint:             jest.fn(),
  updatePainPoint:             jest.fn(),
  deletePainPoint:             jest.fn(),
  listImprovementIntents:      jest.fn(),
  createImprovementIntent:     jest.fn(),
  fetchCoverageAggregate:      jest.fn(),
  transitionIntentState:       jest.fn(),
  extractFromDossier:          jest.fn(),
  fillProcessFieldsFromDossier: jest.fn(),
  improveChangeApproach:       jest.fn(),
  improveSteering:             jest.fn(),
  // Block-2
  generateImprovementsAi:      jest.fn(),
  toggleCoverageStatus:        jest.fn(),
}));
import * as svc from "../services/processen.service";

jest.mock("../../klanten/hooks/useCanvasUploads", () => ({
  useCanvasUploads: jest.fn(),
}));
import { useCanvasUploads } from "../../klanten/hooks/useCanvasUploads";

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
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

import ProcessenWerkblad from "../ProcessenWerkblad";

const CID = "canvas-block2";
const PAIN = { id: "pp-1", text_md: "Doorlooptijd te lang", coverage_status: "open", is_floating: true, is_draft: false };

beforeEach(() => {
  jest.clearAllMocks();
  useCanvasUploads.mockReturnValue({
    hasUploads: true, hasIndexedChunks: true, uploadsProcessing: false,
    uploadCount: 3, indexedChunkCount: 12, loading: false, error: null, reload: jest.fn(),
  });
  svc.listProcesses.mockResolvedValue({ data: [], error: null });
  svc.getStructuringDoorsnede.mockResolvedValue({ data: null, error: null });
  svc.listDepartments.mockResolvedValue({ data: [], error: null });
  svc.getChangeApproach.mockResolvedValue({ data: null, error: null });
  svc.listBusinessUnits.mockResolvedValue({ data: [], error: null });
  svc.listValueTeams.mockResolvedValue({ data: [], error: null });
  svc.getSteeringModel.mockResolvedValue({ data: null, error: null });
  svc.listControlProcesses.mockResolvedValue({ data: [], error: null });
  svc.listPainPoints.mockResolvedValue({ data: [PAIN], error: null });
  svc.listImprovementIntents.mockResolvedValue({ data: [], error: null });
  svc.fetchCoverageAggregate.mockResolvedValue({ data: { open: 1, covered: 0, motivated_no_action: 0, total: 1 }, error: null });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<ProcessenWerkblad canvasId={CID} onClose={() => {}} />);
  });
  await waitFor(() => expect(screen.getByTestId("processen-werkblad")).toBeInTheDocument());
  return result;
}

async function switchToVerbeteracties() {
  fireEvent.click(screen.getByText("Verbeteracties"));
  await waitFor(() => expect(screen.getByTestId("processen-verbeteracties-view")).toBeInTheDocument());
}

describe("11.M.1 Block-2 — Verbeteracties-AI + Motivatie-modal", () => {
  test("1. 6 source-tabs render in juiste volgorde (5 AI + Eigen)", async () => {
    await renderWerkblad();
    await switchToVerbeteracties();
    expect(screen.getByTestId("verbeteracties-tab-ai_algemeen")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-tab-ai_cluster")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-tab-ai_paradox")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-tab-ai_positionering")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-tab-ai_overstijgend")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-tab-eigen")).toBeInTheDocument();
    // Default tab: ai_algemeen
    expect(screen.getByTestId("verbeteracties-tab-ai_algemeen")).toHaveAttribute("data-active", "true");
  });

  test("2. AI-tab click → Genereer-knop zichtbaar, geen +Verbeteractie", async () => {
    await renderWerkblad();
    await switchToVerbeteracties();
    expect(screen.getByTestId("verbeteracties-generate-ai_algemeen")).toBeInTheDocument();
    expect(screen.queryByTestId("verbeteracties-add-toggle")).not.toBeInTheDocument();
  });

  test("3. AI-generate flow: click → generateImprovementsAi called → ai-note feedback", async () => {
    svc.generateImprovementsAi.mockResolvedValue({
      data: [
        { id: "i-ai-1", title: "Snel-onboarding-flow", intent_md: "Doel: doorlooptijd 50% reduceren via gestandaardiseerd onboarding-template + digitale ondertekening.", source_type: "ai_cluster", current_status: "concept", ai_generated_at: new Date().toISOString() },
      ],
      error: null,
      meta: { source_type: "ai_cluster", bron_pain_point_links: 1, chunk_count: 6 },
    });
    svc.listImprovementIntents
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [{ id: "i-ai-1", title: "Snel-onboarding-flow", intent_md: "Doel: doorlooptijd 50% reduceren.", source_type: "ai_cluster", current_status: "concept", ai_generated_at: new Date().toISOString() }], error: null });

    await renderWerkblad();
    await switchToVerbeteracties();
    fireEvent.click(screen.getByTestId("verbeteracties-tab-ai_cluster"));
    await waitFor(() => expect(screen.getByTestId("verbeteracties-tab-ai_cluster")).toHaveAttribute("data-active", "true"));

    const generateBtn = screen.getByTestId("verbeteracties-generate-ai_cluster");
    await act(async () => { fireEvent.click(generateBtn); });

    expect(svc.generateImprovementsAi).toHaveBeenCalledWith(CID, "ai_cluster");
    expect(await screen.findByTestId("verbeteracties-ai-note")).toHaveTextContent(/1 verbeteractie/);
  });

  test("4. Eigen-tab → +Verbeteractie-flow zichtbaar, geen Genereer-knop", async () => {
    await renderWerkblad();
    await switchToVerbeteracties();
    fireEvent.click(screen.getByTestId("verbeteracties-tab-eigen"));
    await waitFor(() => expect(screen.getByTestId("verbeteracties-tab-eigen")).toHaveAttribute("data-active", "true"));
    expect(screen.getByTestId("verbeteracties-add-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("verbeteracties-generate-ai_algemeen")).not.toBeInTheDocument();
  });

  test("5. AI-gegenereerde concept toont AI-bron-pill met source-type-label + ai-meta", async () => {
    svc.listImprovementIntents.mockResolvedValue({
      data: [
        { id: "i-1", title: "AI-actie", intent_md: "Beschrijving van AI-gegenereerde verbeteractie...", source_type: "ai_paradox", current_status: "concept", ai_generated_at: new Date().toISOString() },
      ],
      error: null,
    });
    await renderWerkblad();
    await switchToVerbeteracties();
    fireEvent.click(screen.getByTestId("verbeteracties-tab-ai_paradox"));
    await waitFor(() => expect(screen.getByTestId("intent-concept-i-1")).toBeInTheDocument());
    const card = screen.getByTestId("intent-concept-i-1");
    expect(card).toHaveTextContent(/Paradox/i);
    expect(screen.getByTestId("intent-i-1-ai-meta")).toHaveTextContent(/AI-gegenereerd/i);
  });

  test("6. Motivatie-modal: opent + submit disabled <20 chars + werkt ≥20 chars", async () => {
    svc.toggleCoverageStatus.mockResolvedValue({ data: { ...PAIN, coverage_status: "motivated_no_action" }, error: null });
    await renderWerkblad();
    // Switch naar fase 2
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    // Click Bewust-niet-adresseren-knop
    const bewustBtn = await screen.findByTestId(`pijnpunt-bewust-niet-${PAIN.id}`);
    fireEvent.click(bewustBtn);

    // Modal-rendering
    expect(await screen.findByTestId("motivatie-modal")).toBeInTheDocument();
    const textarea = screen.getByTestId("motivatie-modal-textarea");
    const submitBtn = screen.getByTestId("motivatie-modal-submit");

    // Initial: submit disabled (0 chars)
    expect(submitBtn).toBeDisabled();

    // Type 10 chars: still disabled
    fireEvent.change(textarea, { target: { value: "Te kort" } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId("motivatie-modal-char-counter")).toHaveTextContent(/7 \/ min 20/);

    // Type ≥20 chars: enabled
    const motivation = "Strategisch besluit om te accepteren — uitgewerkt in jaarplan 2027 conform Kees-input";
    fireEvent.change(textarea, { target: { value: motivation } });
    expect(submitBtn).not.toBeDisabled();

    // Submit
    await act(async () => { fireEvent.click(submitBtn); });
    expect(svc.toggleCoverageStatus).toHaveBeenCalledWith(PAIN.id, "motivated_no_action", motivation);
  });

  test("7. motivated_no_action pijnpunt toont reset-knop, reset werkt", async () => {
    const motivatedPain = { ...PAIN, coverage_status: "motivated_no_action", no_action_motivation: "Behandeld in jaarplan" };
    svc.listPainPoints.mockResolvedValue({ data: [motivatedPain], error: null });
    svc.toggleCoverageStatus.mockResolvedValue({ data: { ...motivatedPain, coverage_status: "open" }, error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    const resetBtn = await screen.findByTestId(`pijnpunt-reset-coverage-${PAIN.id}`);
    expect(resetBtn).toBeInTheDocument();
    expect(screen.queryByTestId(`pijnpunt-bewust-niet-${PAIN.id}`)).not.toBeInTheDocument();

    await act(async () => { fireEvent.click(resetBtn); });
    expect(svc.toggleCoverageStatus).toHaveBeenCalledWith(PAIN.id, "open", null);
  });
});
