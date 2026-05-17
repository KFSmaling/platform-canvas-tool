/**
 * S2 design-systeem — RTL voor InzichtenOverlay Analyse-knop-hoofdactie.
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc.
 *
 * Cases:
 *  1. Geen onAnalyse-prop → geen Analyse-knop (backwards-compat default)
 *  2. onAnalyse-prop aanwezig → Analyse-knop rendert met label
 *  3. Klik knop → onAnalyse callback aangeroepen
 *  4. analysing=true → knop disabled
 *  5. analyseLabel-prop respecteerd
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../../../../shared/services/supabase.client", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// InzichtItem heavy dependency — mock pure render
jest.mock("../InzichtItem", () => ({
  __esModule: true,
  default: () => null,
  TYPE_CONFIG: { ontbreekt: {}, zwak: {}, kans: {}, sterk: {} },
  FALLBACK_TYPE: "ontbreekt",
}));

import { supabase } from "../../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../../shared/context/AppConfigContext";
import InzichtenOverlay from "../InzichtenOverlay";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderOverlay(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <InzichtenOverlay
          insights={[]}
          loading={false}
          error={null}
          onClose={() => {}}
          appLabel={(k, fb) => fb}
          canvasName="Test"
          generatedAt={null}
          canvasId="cv-1"
          worksheetName="Strategie"
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("InzichtenOverlay — S2 Analyse-knop hoofdactie", () => {
  test("1. zonder onAnalyse-prop → geen Analyse-knop (backwards-compat)", async () => {
    await renderOverlay();
    expect(screen.queryByTestId("inzichten-actie-analyse")).not.toBeInTheDocument();
  });

  test("2. met onAnalyse-prop → Analyse-knop rendert", async () => {
    await renderOverlay({ onAnalyse: () => {}, analyseLabel: "Analyse draaien" });
    const knop = screen.getByTestId("inzichten-actie-analyse");
    expect(knop).toBeInTheDocument();
    expect(knop).toHaveTextContent(/Analyse draaien/i);
  });

  test("3. klik knop → onAnalyse callback", async () => {
    const onAnalyse = jest.fn();
    await renderOverlay({ onAnalyse, analyseLabel: "Analyse draaien" });
    fireEvent.click(screen.getByTestId("inzichten-actie-analyse"));
    expect(onAnalyse).toHaveBeenCalledTimes(1);
  });

  test("4. analysing=true → knop disabled, callback niet aangeroepen", async () => {
    const onAnalyse = jest.fn();
    await renderOverlay({ onAnalyse, analysing: true, analyseLabel: "Analyseren…" });
    const knop = screen.getByTestId("inzichten-actie-analyse");
    expect(knop).toBeDisabled();
    fireEvent.click(knop);
    expect(onAnalyse).not.toHaveBeenCalled();
  });

  test("5. analyseLabel-prop respecteerd in knop-tekst", async () => {
    await renderOverlay({ onAnalyse: () => {}, analyseLabel: "Opnieuw analyseren" });
    expect(screen.getByTestId("inzichten-actie-analyse")).toHaveTextContent(/Opnieuw analyseren/i);
  });
});
