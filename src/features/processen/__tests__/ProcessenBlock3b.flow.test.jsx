/**
 * 11.M.1 Block-3b — Multi-koppeling-modal + Matrix-render Lijnorganisatie RTL.
 *
 * Cases (6 totaal):
 *  D3:
 *    1. Coupling-modal opent + 5 entity-type-keuzes zichtbaar
 *    2. Expand type → multi-select items + selected state
 *    3. Save → createPainPointCoupling + deletePainPointCoupling diff-based
 *  D1:
 *    4. Matrix-grid render proces × afdeling met intensity-cellen
 *    5. Cross-functional-chip zichtbaar bij ≥3 betrokken afdelingen
 *    6. Proceseigenaar inline-edit + save via updateProcess.archetype_data
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
  setStructuringDoorsnede:     jest.fn(),
  listDepartments:             jest.fn(),
  listProcessDepartmentIntensity:   jest.fn(),
  createProcessDepartmentIntensity: jest.fn(),
  deleteProcessDepartmentIntensity: jest.fn(),
  createPainPointCoupling:     jest.fn(),
  deletePainPointCoupling:     jest.fn(),
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
  listSchetsUploads:           jest.fn(),
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
  createImprovementIntent:     jest.fn(),
  fetchCoverageAggregate:      jest.fn(),
  transitionIntentState:       jest.fn(),
  extractFromDossier:          jest.fn(),
  fillProcessFieldsFromDossier: jest.fn(),
  improveChangeApproach:       jest.fn(),
  improveSteering:             jest.fn(),
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

const CID = "canvas-block3b";

beforeEach(() => {
  jest.clearAllMocks();
  useCanvasUploads.mockReturnValue({
    hasUploads: true, hasIndexedChunks: true, uploadsProcessing: false,
    uploadCount: 1, indexedChunkCount: 1, loading: false, error: null, reload: jest.fn(),
  });
  svc.listProcesses.mockResolvedValue({ data: [], error: null });
  svc.getStructuringDoorsnede.mockResolvedValue({ data: null, error: null });
  svc.listDepartments.mockResolvedValue({ data: [], error: null });
  svc.listProcessDepartmentIntensity.mockResolvedValue({ data: [], error: null });
  svc.getChangeApproach.mockResolvedValue({ data: null, error: null });
  svc.listBusinessUnits.mockResolvedValue({ data: [], error: null });
  svc.listValueTeams.mockResolvedValue({ data: [], error: null });
  svc.listSchetsUploads.mockResolvedValue({ data: [], error: null });
  svc.getSteeringModel.mockResolvedValue({ data: null, error: null });
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

describe("11.M.1 Block-3b — Multi-koppeling-modal D3 + Matrix-render D1", () => {
  test("1. D3: Coupling-modal opent met 5 entity-type-keuzes", async () => {
    const PAIN = { id: "pp-1", text_md: "Pijnpunt 1", is_floating: true, is_strategic_anchor: false, coverage_status: "open", is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [PAIN], error: null });
    svc.listProcesses.mockResolvedValue({
      data: [{ id: "proc-1", name: "Klantonboarding", archetype: "primair", is_draft: false }],
      error: null,
    });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    fireEvent.click(await screen.findByTestId(`pijnpunt-koppel-${PAIN.id}`));
    expect(await screen.findByTestId("coupling-modal")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-modal-type-pr_processes")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-modal-type-org_departments")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-modal-type-vo_business_units")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-modal-type-vo_value_teams")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-modal-type-gov_control_processes")).toBeInTheDocument();
  });

  test("2. D3: Expand type → multi-select items zichtbaar", async () => {
    const PAIN = { id: "pp-2", text_md: "Pijnpunt 2", is_floating: true, is_strategic_anchor: false, coverage_status: "open", is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [PAIN], error: null });
    svc.listProcesses.mockResolvedValue({
      data: [
        { id: "proc-1", name: "Klantonboarding", archetype: "primair", is_draft: false },
        { id: "proc-2", name: "Facturatie",       archetype: "ondersteunend", is_draft: false },
      ],
      error: null,
    });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());
    fireEvent.click(await screen.findByTestId(`pijnpunt-koppel-${PAIN.id}`));

    // Expand pr_processes-sectie
    fireEvent.click(screen.getByTestId("coupling-modal-type-pr_processes"));
    expect(screen.getByTestId("coupling-modal-type-pr_processes")).toHaveAttribute("data-expanded", "true");
    expect(await screen.findByTestId("coupling-item-pr_processes-proc-1")).toBeInTheDocument();
    expect(screen.getByTestId("coupling-item-pr_processes-proc-2")).toBeInTheDocument();
  });

  test("3. D3: Save → createPainPointCoupling called met juiste args", async () => {
    const PAIN = { id: "pp-3", text_md: "Pijnpunt 3", is_floating: true, is_strategic_anchor: false, coverage_status: "open", is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [PAIN], error: null });
    svc.listProcesses.mockResolvedValue({
      data: [{ id: "proc-1", name: "Klantonboarding", archetype: "primair", is_draft: false }],
      error: null,
    });
    svc.createPainPointCoupling.mockResolvedValue({ data: { id: "new-c-1" }, error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());
    fireEvent.click(await screen.findByTestId(`pijnpunt-koppel-${PAIN.id}`));

    // Expand + select item
    fireEvent.click(screen.getByTestId("coupling-modal-type-pr_processes"));
    const item = await screen.findByTestId("coupling-item-pr_processes-proc-1");
    fireEvent.click(item.querySelector("input"));

    // Save
    await act(async () => { fireEvent.click(screen.getByTestId("coupling-modal-save")); });

    expect(svc.createPainPointCoupling).toHaveBeenCalledWith({
      pain_point_id: PAIN.id,
      target_table: "pr_processes",
      target_id: "proc-1",
      canvas_id: CID,
    });
  });

  test("4. D1: Matrix-grid render proces × afdeling met intensity-cellen", async () => {
    svc.listProcesses.mockResolvedValue({
      data: [
        { id: "proc-1", name: "Klantonboarding", archetype: "primair", is_draft: false, archetype_data: {} },
      ],
      error: null,
    });
    svc.listDepartments.mockResolvedValue({
      data: [
        { id: "dept-A", name: "Service", is_draft: false },
        { id: "dept-B", name: "IT",      is_draft: false },
      ],
      error: null,
    });
    svc.listProcessDepartmentIntensity.mockResolvedValue({
      data: [{ id: "pdi-1", process_id: "proc-1", department_id: "dept-A", intensity: "involved" }],
      error: null,
    });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-lijnorganisatie"));
    await waitFor(() => expect(screen.getByTestId("lijnorganisatie-view")).toBeInTheDocument());

    expect(await screen.findByTestId("pdi-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("pdi-row-proc-1")).toBeInTheDocument();
    expect(screen.getByTestId("pdi-cell-proc-1-dept-A")).toHaveAttribute("data-involved", "true");
    expect(screen.getByTestId("pdi-cell-proc-1-dept-B")).toHaveAttribute("data-involved", "false");
  });

  test("5. D1: Cross-functional-chip bij ≥3 betrokken afdelingen", async () => {
    svc.listProcesses.mockResolvedValue({
      data: [
        { id: "proc-1", name: "P1", archetype: "primair", is_draft: false, archetype_data: {} },
        { id: "proc-2", name: "P2", archetype: "primair", is_draft: false, archetype_data: {} },
      ],
      error: null,
    });
    svc.listDepartments.mockResolvedValue({
      data: [
        { id: "dA", name: "A", is_draft: false },
        { id: "dB", name: "B", is_draft: false },
        { id: "dC", name: "C", is_draft: false },
      ],
      error: null,
    });
    svc.listProcessDepartmentIntensity.mockResolvedValue({
      data: [
        { id: "pdi-1", process_id: "proc-1", department_id: "dA", intensity: "involved" },
        { id: "pdi-2", process_id: "proc-1", department_id: "dB", intensity: "involved" },
        { id: "pdi-3", process_id: "proc-1", department_id: "dC", intensity: "involved" },
        // proc-2 maar 1 afdeling → geen chip
        { id: "pdi-4", process_id: "proc-2", department_id: "dA", intensity: "involved" },
      ],
      error: null,
    });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-lijnorganisatie"));
    await waitFor(() => expect(screen.getByTestId("lijnorganisatie-view")).toBeInTheDocument());

    expect(await screen.findByTestId("pdi-cross-functional-proc-1")).toBeInTheDocument();
    expect(screen.queryByTestId("pdi-cross-functional-proc-2")).not.toBeInTheDocument();
  });

  test("6. D1: Proceseigenaar inline-edit → updateProcess called met archetype_data.proces_eigenaar", async () => {
    svc.listProcesses.mockResolvedValue({
      data: [
        { id: "proc-1", name: "Klantonboarding", archetype: "primair", is_draft: false, archetype_data: {} },
      ],
      error: null,
    });
    svc.listDepartments.mockResolvedValue({ data: [{ id: "dA", name: "A", is_draft: false }], error: null });
    svc.listProcessDepartmentIntensity.mockResolvedValue({ data: [], error: null });
    svc.updateProcess.mockResolvedValue({ data: {}, error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByTestId("processen-subtab-lijnorganisatie"));
    await waitFor(() => expect(screen.getByTestId("lijnorganisatie-view")).toBeInTheDocument());

    fireEvent.click(await screen.findByTestId("pdi-owner-edit-proc-1"));
    const input = screen.getByTestId("pdi-owner-input-proc-1");
    fireEvent.change(input, { target: { value: "Jan de Vries" } });
    await act(async () => { fireEvent.blur(input); });

    expect(svc.updateProcess).toHaveBeenCalled();
    const args = svc.updateProcess.mock.calls[0];
    expect(args[0]).toBe("proc-1");
    expect(args[1].archetype_data.proces_eigenaar).toBe("Jan de Vries");
  });
});
