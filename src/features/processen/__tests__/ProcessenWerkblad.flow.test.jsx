/**
 * 11.M ProcessenWerkblad — RTL flow-tests.
 *
 * Cases (8):
 *  1. Drie fase-tabs zichtbaar (Inventarisatie/Pijnpunten/Verbeteracties)
 *  2. Default actieve tab = Inventarisatie + sub-tab-strip zichtbaar
 *  3. 4 sub-tabs render (Bedrijfsprocessen/Lijnorganisatie/Veranderorganisatie/Besturing)
 *  4. Sub-tab klik → ander archetype/dataset zichtbaar
 *  5. Switch naar fase 2 → sub-tab-strip verdwijnt (Variant A)
 *  6. Switch naar fase 3 → coverage-banner zichtbaar + pull-model info
 *  7. Coverage-banner verbergt bij 0 pijnpunten + empty-state-tekst
 *  8. GEEN "Naar Roadmap"-knop ergens (negative-assertion pull-model)
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock service voor alle 4 sub-views + fase 2/3
jest.mock("../services/processen.service", () => ({
  listProcesses:               jest.fn(),
  createProcess:               jest.fn(),
  deleteProcess:               jest.fn(),
  getStructuringDoorsnede:     jest.fn(),
  setStructuringDoorsnede:     jest.fn(),
  listDepartments:             jest.fn(),
  listProcessDepartmentIntensity:   jest.fn(),
  createProcessDepartmentIntensity: jest.fn(),
  deleteProcessDepartmentIntensity: jest.fn(),
  createPainPointCoupling:     jest.fn(),
  deletePainPointCoupling:     jest.fn(),
  listDepartments:             jest.fn(),
  createDepartment:            jest.fn(),
  deleteDepartment:            jest.fn(),
  getChangeApproach:           jest.fn(),
  setChangeApproach:           jest.fn(),
  listBusinessUnits:           jest.fn(),
  createBusinessUnit:          jest.fn(),
  deleteBusinessUnit:          jest.fn(),
  listValueTeams:              jest.fn(),
  listSchetsUploads:           jest.fn(),
  createValueTeam:             jest.fn(),
  deleteValueTeam:             jest.fn(),
  getSteeringModel:            jest.fn(),
  setSteeringModel:            jest.fn(),
  listControlProcesses:        jest.fn(),
  createControlProcess:        jest.fn(),
  deleteControlProcess:        jest.fn(),
  listPainPoints:              jest.fn(),
  listPainPointCouplings:      jest.fn(),
  createPainPoint:             jest.fn(),
  deletePainPoint:             jest.fn(),
  listImprovementIntents:      jest.fn(),
  createImprovementIntent:     jest.fn(),
  fetchCoverageAggregate:      jest.fn(),
  transitionIntentState:       jest.fn(),
}));
import * as svc from "../services/processen.service";

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

const CID = "test-canvas-uuid-m";

beforeEach(() => {
  jest.clearAllMocks();
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

describe("11.M — ProcessenWerkblad flow", () => {
  test("1. Drie fase-tabs zichtbaar", async () => {
    await renderWerkblad();
    expect(screen.getByText("Inventarisatie")).toBeInTheDocument();
    expect(screen.getByText("Pijnpunten")).toBeInTheDocument();
    expect(screen.getByText("Verbeteracties")).toBeInTheDocument();
  });

  test("2. Default actieve tab = Inventarisatie + sub-tab-strip zichtbaar", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("processen-subtab-strip")).toBeInTheDocument();
    expect(screen.getByTestId("bedrijfsprocessen-view")).toBeInTheDocument();
  });

  test("3. 4 sub-tabs render (Bedrijfsprocessen/Lijnorganisatie/Veranderorganisatie/Besturing)", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("processen-subtab-bedrijfsprocessen")).toBeInTheDocument();
    expect(screen.getByTestId("processen-subtab-lijnorganisatie")).toBeInTheDocument();
    expect(screen.getByTestId("processen-subtab-veranderorganisatie")).toBeInTheDocument();
    expect(screen.getByTestId("processen-subtab-besturing")).toBeInTheDocument();
  });

  test("4. Sub-tab klik → andere view zichtbaar", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("bedrijfsprocessen-view")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("processen-subtab-lijnorganisatie"));
    await waitFor(() => expect(screen.getByTestId("lijnorganisatie-view")).toBeInTheDocument());
    expect(screen.queryByTestId("bedrijfsprocessen-view")).not.toBeInTheDocument();
  });

  test("5. Switch naar fase 2 → sub-tab-strip verdwijnt (Variant A)", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("processen-subtab-strip")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Pijnpunten"));
    await waitFor(() => expect(screen.getByTestId("processen-pijnpunten-view")).toBeInTheDocument());
    expect(screen.queryByTestId("processen-subtab-strip")).not.toBeInTheDocument();
  });

  test("6. Switch naar fase 3 met pijnpunten → coverage-banner zichtbaar", async () => {
    svc.fetchCoverageAggregate.mockResolvedValue({
      data: { open: 2, covered: 1, motivated_no_action: 0, total: 3 },
      error: null,
    });
    await renderWerkblad();
    fireEvent.click(screen.getByText("Verbeteracties"));
    await waitFor(() => expect(screen.getByTestId("processen-verbeteracties-view")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("processen-coverage-banner")).toBeInTheDocument());
    expect(screen.getByTestId("processen-coverage-banner")).toHaveTextContent(/2 open/);
  });

  test("7. Coverage-banner verbergt bij 0 pijnpunten + empty-state-tekst (Designer #3)", async () => {
    svc.fetchCoverageAggregate.mockResolvedValue({
      data: { open: 0, covered: 0, motivated_no_action: 0, total: 0 },
      error: null,
    });
    await renderWerkblad();
    fireEvent.click(screen.getByText("Verbeteracties"));
    await waitFor(() => expect(screen.getByTestId("processen-verbeteracties-view")).toBeInTheDocument());
    expect(screen.queryByTestId("processen-coverage-banner")).not.toBeInTheDocument();
    expect(screen.getByText(/Voeg eerst pijnpunten toe/i)).toBeInTheDocument();
  });

  test("8. GEEN 'Naar Roadmap'-knop ergens (pull-model negative-assertion)", async () => {
    await renderWerkblad();
    // Switch door alle fasen heen
    fireEvent.click(screen.getByText("Verbeteracties"));
    await waitFor(() => expect(screen.getByTestId("processen-verbeteracties-view")).toBeInTheDocument());
    // negative-assertion: nergens een "Naar Roadmap" of "Verstuur naar Roadmap"
    expect(screen.queryByText(/Naar Roadmap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verstuur.*Roadmap/i)).not.toBeInTheDocument();
  });
});
