/**
 * 11.M.1 Block-3a — ProcesModal + Pijnpunt-completeness RTL.
 *
 * Cases (6 totaal):
 *  D2 ProcesModal:
 *    1. Edit-knop opent ProcesModal met 5 jsonb-velden bewerkbaar
 *    2. ProcesModal Velden-invullen-vanuit-dossier-knop roept fillProcessFieldsFromDossier
 *    3. ProcesModal save → svc.updateProcess called met archetype_data
 *  E1 Multi-tag-render:
 *    4. Pijnpunt met meerdere couplings (process + dept) toont multi-tag in juiste kleuren
 *  E2 3-nummer-varianten:
 *    5. is_strategic_anchor=true → donker-rood bolletje (data-variant=bepalend)
 *       is_floating=true → grijs bolletje (data-variant=overstijgend)
 *  E3 Bepalend-pill:
 *    6. is_strategic_anchor=true → Bepalend-pill zichtbaar
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

const CID = "canvas-block3a";
const CANONICAL_PROC = {
  id: "proc-1", name: "Klantonboarding", archetype: "primair",
  description: "Van eerste contact tot live", is_draft: false,
  archetype_data: { strategisch_label: "Kern-differentiatie", volwassenheid: "Beheerst" },
};

beforeEach(() => {
  jest.clearAllMocks();
  useCanvasUploads.mockReturnValue({
    hasUploads: true, hasIndexedChunks: true, uploadsProcessing: false,
    uploadCount: 3, indexedChunkCount: 12, loading: false, error: null, reload: jest.fn(),
  });
  svc.listProcesses.mockResolvedValue({ data: [CANONICAL_PROC], error: null });
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
  svc.updateProcess.mockResolvedValue({ data: CANONICAL_PROC, error: null });
  svc.fillProcessFieldsFromDossier.mockResolvedValue({
    data: { ...CANONICAL_PROC, archetype_data: { ...CANONICAL_PROC.archetype_data, pijnpunten: "AI-gevuld vanuit dossier" } },
    error: null,
    meta: { proposed_fields: { pijnpunten: "AI-gevuld vanuit dossier" } },
  });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<ProcessenWerkblad canvasId={CID} onClose={() => {}} />);
  });
  await waitFor(() => expect(screen.getByTestId("processen-werkblad")).toBeInTheDocument());
  return result;
}

describe("11.M.1 Block-3a — ProcesModal + Pijnpunt-completeness", () => {
  test("1. D2: Edit-knop opent ProcesModal met 5 jsonb-velden bewerkbaar", async () => {
    await renderWerkblad();
    const editBtn = await screen.findByTestId(`bp-edit-${CANONICAL_PROC.id}`);
    fireEvent.click(editBtn);

    expect(await screen.findByTestId("proces-modal")).toBeInTheDocument();
    // 5 archetype-velden
    expect(screen.getByTestId("proces-archetype-strategisch_label")).toBeInTheDocument();
    expect(screen.getByTestId("proces-archetype-volwassenheid")).toBeInTheDocument();
    expect(screen.getByTestId("proces-archetype-pijnpunten")).toBeInTheDocument();
    expect(screen.getByTestId("proces-archetype-kritieke_afhankelijkheden")).toBeInTheDocument();
    expect(screen.getByTestId("proces-archetype-bewuste_inrichting")).toBeInTheDocument();
    // Pre-filled: strategisch_label
    expect(screen.getByTestId("proces-archetype-strategisch_label")).toHaveValue("Kern-differentiatie");
  });

  test("2. D2: Velden-invullen-vanuit-dossier-knop roept fillProcessFieldsFromDossier", async () => {
    await renderWerkblad();
    fireEvent.click(await screen.findByTestId(`bp-edit-${CANONICAL_PROC.id}`));
    await screen.findByTestId("proces-modal");

    const fillBtn = screen.getByTestId("proces-modal-fill-fields");
    expect(fillBtn).not.toBeDisabled();
    await act(async () => { fireEvent.click(fillBtn); });

    expect(svc.fillProcessFieldsFromDossier).toHaveBeenCalledWith(CANONICAL_PROC.id);
    // Feedback-banner verschijnt
    expect(await screen.findByTestId("proces-modal-fill-note")).toHaveAttribute("data-fill-type", "success");
  });

  test("3. D2: ProcesModal save → updateProcess called met archetype_data", async () => {
    await renderWerkblad();
    fireEvent.click(await screen.findByTestId(`bp-edit-${CANONICAL_PROC.id}`));
    await screen.findByTestId("proces-modal");

    // Edit een veld
    const pijnpuntenField = screen.getByTestId("proces-archetype-pijnpunten");
    fireEvent.change(pijnpuntenField, { target: { value: "Manual entry pijnpunt" } });

    const saveBtn = screen.getByTestId("proces-modal-save");
    await act(async () => { fireEvent.click(saveBtn); });

    expect(svc.updateProcess).toHaveBeenCalled();
    const callArgs = svc.updateProcess.mock.calls[0];
    expect(callArgs[0]).toBe(CANONICAL_PROC.id);
    expect(callArgs[1].archetype_data.pijnpunten).toBe("Manual entry pijnpunt");
  });

  test("4. E1: Pijnpunt met meerdere couplings toont multi-tag-render in juiste kleuren", async () => {
    const pain = { id: "pp-1", text_md: "Doorlooptijd kost klanten", coverage_status: "open", is_floating: false, is_strategic_anchor: false, is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [pain], error: null });
    svc.listPainPointCouplings.mockResolvedValue({
      data: [
        { id: "c1", pain_point_id: "pp-1", target_table: "pr_processes", target_id: "proc-1" },
        { id: "c2", pain_point_id: "pp-1", target_table: "org_departments", target_id: "dept-1" },
        { id: "c3", pain_point_id: "pp-1", target_table: "vo_value_teams", target_id: "team-1" },
      ],
      error: null,
    });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    // Drie tags zichtbaar
    expect(await screen.findByTestId("pijnpunt-tag-pp-1-pr_processes")).toBeInTheDocument();
    expect(screen.getByTestId("pijnpunt-tag-pp-1-org_departments")).toBeInTheDocument();
    expect(screen.getByTestId("pijnpunt-tag-pp-1-vo_value_teams")).toBeInTheDocument();
    // Labels:
    expect(screen.getByTestId("pijnpunt-tag-pp-1-pr_processes")).toHaveTextContent(/Proces/);
    expect(screen.getByTestId("pijnpunt-tag-pp-1-org_departments")).toHaveTextContent(/Afdeling/);
    expect(screen.getByTestId("pijnpunt-tag-pp-1-vo_value_teams")).toHaveTextContent(/Team/);
  });

  test("5. E2: 3-nummer-varianten bolletjes (standaard / bepalend / overstijgend)", async () => {
    const standaardPain   = { id: "pp-std", text_md: "Standaard", is_floating: false, is_strategic_anchor: false, coverage_status: "open", is_draft: false };
    const bepalendPain    = { id: "pp-bep", text_md: "Bepalend",  is_floating: false, is_strategic_anchor: true,  coverage_status: "open", is_draft: false };
    const overstijgendPain = { id: "pp-over", text_md: "Overstijgend", is_floating: true, is_strategic_anchor: false, coverage_status: "open", is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [standaardPain, bepalendPain, overstijgendPain], error: null });
    svc.listPainPointCouplings.mockResolvedValue({ data: [], error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    expect(await screen.findByTestId("pijnpunt-bolletje-pp-std")).toHaveAttribute("data-variant", "standaard");
    expect(screen.getByTestId("pijnpunt-bolletje-pp-bep")).toHaveAttribute("data-variant", "bepalend");
    expect(screen.getByTestId("pijnpunt-bolletje-pp-over")).toHaveAttribute("data-variant", "overstijgend");
  });

  test("6. E3: is_strategic_anchor=true → Bepalend-pill zichtbaar", async () => {
    const bepalendPain = { id: "pp-bep", text_md: "Bepalend-pijnpunt", is_floating: false, is_strategic_anchor: true, coverage_status: "open", is_draft: false };
    svc.listPainPoints.mockResolvedValue({ data: [bepalendPain], error: null });
    svc.listPainPointCouplings.mockResolvedValue({ data: [], error: null });

    await renderWerkblad();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());

    const pill = await screen.findByTestId(`pijnpunt-bepalend-pill-${bepalendPain.id}`);
    expect(pill).toHaveTextContent(/Bepalend/);
  });
});
