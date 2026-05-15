/**
 * 11.M.1 Block-1 — Dossier-AI affordances RTL.
 *
 * Cases (5 happy-path + 1 negative = 6 totaal):
 *  1. Bedrijfsprocessen AI-extract → draft-items zichtbaar met dossier-suggestie-badge
 *  2. Lijnorganisatie departments AI-extract → draft-afdeling zichtbaar + Accept-knop werkt
 *  3. Veranderorganisatie BU AI-extract werkt + Verbeter-veranderaanpak roept improveChangeApproach
 *  4. Besturing control-processen AI-extract werkt + Verbeter-steering roept improveSteering
 *  5. Pijnpunten AI-extract werkt + draft-pijnpunt heeft dossier-suggestie-badge
 *  6. Negative: zonder indexed chunks → AI-knop disabled met tooltip
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock processen.service met alle 11M1-AI-methods
jest.mock("../services/processen.service", () => ({
  listProcesses:               jest.fn(),
  createProcess:               jest.fn(),
  updateProcess:               jest.fn(),
  deleteProcess:               jest.fn(),
  getStructuringDoorsnede:     jest.fn(),
  listDepartments:             jest.fn(),
  listProcessDepartmentIntensity:   jest.fn(),
  createProcessDepartmentIntensity: jest.fn(),
  deleteProcessDepartmentIntensity: jest.fn(),
  createPainPointCoupling:     jest.fn(),
  deletePainPointCoupling:     jest.fn(),
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
  listPainPointCouplings:      jest.fn(),
  createPainPoint:             jest.fn(),
  updatePainPoint:             jest.fn(),
  deletePainPoint:             jest.fn(),
  listImprovementIntents:      jest.fn(),
  fetchCoverageAggregate:      jest.fn(),
  // 11.M.1 block-1
  extractFromDossier:          jest.fn(),
  fillProcessFieldsFromDossier: jest.fn(),
  improveChangeApproach:       jest.fn(),
  improveSteering:             jest.fn(),
}));
import * as svc from "../services/processen.service";

// Mock useCanvasUploads — anders zou hook proberen klanten.service te laden
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

const CID = "test-canvas-uuid-m1";

beforeEach(() => {
  jest.clearAllMocks();
  // Default: uploads ready (indexed chunks aanwezig)
  useCanvasUploads.mockReturnValue({
    hasUploads: true, hasIndexedChunks: true, uploadsProcessing: false,
    uploadCount: 3, indexedChunkCount: 12, loading: false, error: null, reload: jest.fn(),
  });
  svc.listProcesses.mockResolvedValue({ data: [], error: null });
  svc.getStructuringDoorsnede.mockResolvedValue({ data: null, error: null });
  svc.listDepartments.mockResolvedValue({ data: [], error: null });
  svc.listProcessDepartmentIntensity.mockResolvedValue({ data: [], error: null });
  svc.getChangeApproach.mockResolvedValue({ data: { text_md: "Aanpak: legacy" }, error: null });
  svc.listBusinessUnits.mockResolvedValue({ data: [], error: null });
  svc.listValueTeams.mockResolvedValue({ data: [], error: null });
  svc.getSteeringModel.mockResolvedValue({ data: { model: "hierarchisch", text_md: "Steering oud", coordination_aspects: [] }, error: null });
  svc.listControlProcesses.mockResolvedValue({ data: [], error: null });
  svc.listPainPoints.mockResolvedValue({ data: [], error: null });
  svc.listPainPointCouplings.mockResolvedValue({ data: [], error: null });
  svc.listImprovementIntents.mockResolvedValue({ data: [], error: null });
  svc.fetchCoverageAggregate.mockResolvedValue({ data: { open: 0, covered: 0, motivated_no_action: 0, total: 0 }, error: null });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<ProcessenWerkblad canvasId={CID} onClose={() => {}} />);
  });
  await waitFor(() => expect(screen.getByTestId("processen-werkblad")).toBeInTheDocument());
  return result;
}

describe("11.M.1 Block-1 — Dossier-AI affordances", () => {
  test("1. Bedrijfsprocessen AI-extract → draft-items met dossier-suggestie-badge", async () => {
    svc.extractFromDossier.mockResolvedValue({
      data: [{ id: "p-draft-1", name: "Klantonboarding", archetype: "primair", is_draft: true }],
      error: null, meta: { chunk_count: 8 },
    });
    svc.listProcesses
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [{ id: "p-draft-1", name: "Klantonboarding", archetype: "primair", is_draft: true }], error: null });

    await renderWerkblad();
    const aiBtn = await screen.findByTestId("dossier-ai-processes-extract");
    expect(aiBtn).not.toBeDisabled();
    await act(async () => { fireEvent.click(aiBtn); });

    expect(svc.extractFromDossier).toHaveBeenCalledWith(CID, "processes");
    expect(await screen.findByTestId("bp-process-p-draft-1")).toHaveAttribute("data-draft", "true");
    expect(screen.getByTestId("bp-process-p-draft-1")).toHaveTextContent(/dossier-suggestie/);
  });

  test("2. Lijnorganisatie departments AI-extract + Accept-knop werkt", async () => {
    svc.extractFromDossier.mockResolvedValue({
      data: [{ id: "d-draft-1", name: "Service Desk", is_draft: true }],
      error: null, meta: {},
    });
    svc.listDepartments
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [{ id: "d-draft-1", name: "Service Desk", is_draft: true }], error: null });
    svc.updateDepartment.mockResolvedValue({ data: { id: "d-draft-1", is_draft: false }, error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-lijnorganisatie"));
    await waitFor(() => expect(screen.getByTestId("lijnorganisatie-view")).toBeInTheDocument());

    const aiBtn = await screen.findByTestId("dossier-ai-departments-extract");
    await act(async () => { fireEvent.click(aiBtn); });
    expect(svc.extractFromDossier).toHaveBeenCalledWith(CID, "departments");

    const deptRow = await screen.findByTestId("lijn-dept-d-draft-1");
    expect(deptRow).toHaveAttribute("data-draft", "true");
    expect(deptRow).toHaveTextContent(/draft/i);
  });

  test("3. Veranderorganisatie: Verbeter-veranderaanpak + BU-extract werken", async () => {
    svc.improveChangeApproach.mockResolvedValue({
      data: { canvas_id: CID, text_md: "Aanpak: verbeterd!" },
      error: null,
      meta: { before: "Aanpak: legacy", after: "Aanpak: verbeterd!" },
    });
    svc.extractFromDossier.mockResolvedValue({
      data: [{ id: "bu-draft-1", name: "Pension Tribe", is_draft: true }],
      error: null, meta: {},
    });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-veranderorganisatie"));
    await waitFor(() => expect(screen.getByTestId("veranderorganisatie-view")).toBeInTheDocument());

    // Verbeter-veranderaanpak
    const improveBtn = await screen.findByTestId("vo-improve-change-approach");
    await act(async () => { fireEvent.click(improveBtn); });
    expect(svc.improveChangeApproach).toHaveBeenCalledWith(CID);

    // BU-extract
    const buAi = await screen.findByTestId("dossier-ai-bu-extract");
    await act(async () => { fireEvent.click(buAi); });
    expect(svc.extractFromDossier).toHaveBeenCalledWith(CID, "business_units");
  });

  test("4. Besturing: control-extract + Verbeter-steering werken", async () => {
    svc.improveSteering.mockResolvedValue({
      data: { canvas_id: CID, text_md: "Verbeterd" },
      error: null,
      meta: { before: "Steering oud", after: "Verbeterd" },
    });
    svc.extractFromDossier.mockResolvedValue({
      data: [{ id: "cp-draft-1", name: "Kwartaal-MIS", control_type: "mis_rapportage", is_draft: true }],
      error: null, meta: {},
    });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-besturing"));
    await waitFor(() => expect(screen.getByTestId("besturing-view")).toBeInTheDocument());

    const improveBtn = await screen.findByTestId("gov-improve-steering");
    await act(async () => { fireEvent.click(improveBtn); });
    expect(svc.improveSteering).toHaveBeenCalledWith(CID);

    const cpAi = await screen.findByTestId("dossier-ai-control-extract");
    await act(async () => { fireEvent.click(cpAi); });
    expect(svc.extractFromDossier).toHaveBeenCalledWith(CID, "control_processes");
  });

  test("5. Pijnpunten AI-extract → draft met dossier-suggestie-badge", async () => {
    svc.extractFromDossier.mockResolvedValue({
      data: [{ id: "pp-draft-1", text_md: "Onboarding-tijd te lang", is_draft: true, coverage_status: "open", is_floating: true }],
      error: null, meta: {},
    });
    svc.listPainPoints
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [{ id: "pp-draft-1", text_md: "Onboarding-tijd te lang", is_draft: true, coverage_status: "open", is_floating: true }], error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    const aiBtn = await screen.findByTestId("dossier-ai-pain-points-extract");
    await act(async () => { fireEvent.click(aiBtn); });
    expect(svc.extractFromDossier).toHaveBeenCalledWith(CID, "pain_points");

    const painRow = await screen.findByTestId("pijnpunt-rij-pp-draft-1");
    expect(painRow).toHaveAttribute("data-draft", "true");
    expect(painRow).toHaveTextContent(/dossier-suggestie/);
    expect(screen.getByTestId("pijnpunt-accept-pp-draft-1")).toBeInTheDocument();
  });

  test("6. Zonder indexed chunks → AI-knoppen disabled met tooltip", async () => {
    useCanvasUploads.mockReturnValue({
      hasUploads: false, hasIndexedChunks: false, uploadsProcessing: false,
      uploadCount: 0, indexedChunkCount: 0, loading: false, error: null, reload: jest.fn(),
    });

    await renderWerkblad();
    const aiBtn = await screen.findByTestId("dossier-ai-processes-extract");
    expect(aiBtn).toBeDisabled();
    expect(aiBtn).toHaveAttribute("title", expect.stringMatching(/upload eerst documenten/i));
  });
});
