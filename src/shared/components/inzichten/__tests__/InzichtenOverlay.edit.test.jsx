/**
 * RFC-008 §4 — RTL voor InzichtenOverlay edit-mode + in_rapport-toggle + status-indicator.
 *
 * Block 1 minimaal-4 cases (zie instructie 11.S Block 1 §5):
 *  1. Hover-pencil zichtbaarheid (default: opacity-0; aanwezig in DOM voor focus-visible)
 *  2. Edit-flow save → onSave called with edited_observation + edited_recommendation
 *  3. Toggle-flow → onToggleRapport called with in_rapport bool
 *  4. Status-indicator-counter update na toggle
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc (consistent met
 * bestaande InzichtenOverlay.flow.test.jsx).
 */

import React, { useState, useRef } from "react";
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

import { supabase } from "../../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../../shared/context/AppConfigContext";
import InzichtenOverlay from "../InzichtenOverlay";

const rpcMock = supabase.rpc;

const insightOnderdeel = {
  id: "ins-1",
  category: "onderdeel",
  type: "zwak",
  title: "Missie is wollig",
  observation: "AI-observatie origineel",
  recommendation: "AI-aanbeveling origineel",
  source_refs: [],
  in_rapport: false,
};
const insightDwars = {
  id: "ins-2",
  category: "dwarsverband",
  type: "kans",
  title: "Visie sluit niet aan op klantsegmenten",
  observation: "Observatie 2",
  recommendation: "Aanbeveling 2",
  source_refs: [],
  in_rapport: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

/**
 * Test-harness die `insights` als lokale state houdt zodat de toggle-counter-test
 * (case 4) een echte herrender-cyclus na onToggleRapport kan observeren.
 *
 * onSave/onToggleRapport zijn jest.fn() die we als props lekken via callback-ref
 * (`leak`) zodat tests assertions kunnen doen.
 */
function Harness({ initial, leak }) {
  const [insights, setInsights] = useState(initial);

  // useRef houdt jest.fn()-instanties stabiel over re-renders heen,
  // anders krijgt `leak` na elke setState een nieuwe (lege) jest.fn() en
  // mist de assertion de eerste click. State-mutaties gebeuren in een
  // gesloten setInsights-aanroep dus geen stale-closure-issue.
  const onSaveRef = useRef(null);
  const onToggleRef = useRef(null);
  if (!onSaveRef.current) {
    onSaveRef.current = jest.fn(async (insightId, fields) => {
      setInsights(prev => prev.map(i => (i.id === insightId ? { ...i, ...fields } : i)));
      return { data: { id: insightId, ...fields }, error: null };
    });
  }
  if (!onToggleRef.current) {
    onToggleRef.current = jest.fn(async (insightId, inRapport) => {
      setInsights(prev => prev.map(i => (i.id === insightId ? { ...i, in_rapport: inRapport } : i)));
      return { data: { id: insightId, in_rapport: inRapport }, error: null };
    });
  }
  const onSave = onSaveRef.current;
  const onToggleRapport = onToggleRef.current;

  if (leak) leak({ onSave, onToggleRapport });

  return (
    <AppConfigProvider>
      <InzichtenOverlay
        insights={insights}
        loading={false}
        error={null}
        onClose={() => {}}
        appLabel={(k, fb) => fb}
        canvasName="TestCanvas"
        generatedAt={null}
        canvasId="cv-1"
        worksheetName="Strategie"
        onSave={onSave}
        onToggleRapport={onToggleRapport}
      />
    </AppConfigProvider>
  );
}

async function renderHarness(initial) {
  const handles = {};
  let result;
  await act(async () => {
    result = render(<Harness initial={initial} leak={(h) => Object.assign(handles, h)} />);
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return { ...result, handles };
}

describe("InzichtenOverlay — RFC-008 §4 edit + in_rapport + status-indicator", () => {
  test("1. hover-pencil is in DOM (renders bij canEdit), maar default opacity-0", async () => {
    await renderHarness([insightOnderdeel]);
    const pencil = screen.getByTestId("inzicht-edit-pencil-ins-1");
    expect(pencil).toBeInTheDocument();
    // Hover-only zichtbaarheid via Tailwind: default opacity-0, group-hover:opacity-100
    expect(pencil.className).toMatch(/opacity-0/);
    expect(pencil.className).toMatch(/group-hover:opacity-100/);
  });

  test("2. Edit-flow → onSave aangeroepen met edited_observation + edited_recommendation", async () => {
    const { handles } = await renderHarness([insightOnderdeel]);

    // Open edit-mode
    await act(async () => {
      fireEvent.click(screen.getByTestId("inzicht-edit-pencil-ins-1"));
    });
    expect(screen.getByTestId("inzicht-edit-form-ins-1")).toBeInTheDocument();

    // Wijzig beide textareas
    const obsTextarea = screen.getByTestId("inzicht-edit-observation-ins-1");
    const recTextarea = screen.getByTestId("inzicht-edit-recommendation-ins-1");
    fireEvent.change(obsTextarea, { target: { value: "Consultant-edit observatie" } });
    fireEvent.change(recTextarea, { target: { value: "Consultant-edit aanbeveling" } });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId("inzicht-edit-save-ins-1"));
    });

    expect(handles.onSave).toHaveBeenCalledTimes(1);
    expect(handles.onSave).toHaveBeenCalledWith("ins-1", {
      edited_observation: "Consultant-edit observatie",
      edited_recommendation: "Consultant-edit aanbeveling",
    });

    // Edit-form sluit na succesvolle save
    await waitFor(() => {
      expect(screen.queryByTestId("inzicht-edit-form-ins-1")).not.toBeInTheDocument();
    });
    // "bewerkt"-label rendert
    expect(screen.getByTestId("inzicht-bewerkt-label-ins-1")).toBeInTheDocument();
  });

  test("3. Toggle-flow → onToggleRapport aangeroepen met in_rapport bool (toggled)", async () => {
    const { handles } = await renderHarness([insightOnderdeel]); // in_rapport: false

    const toggle = screen.getByTestId("inzicht-inrapport-toggle-ins-1");
    expect(toggle).toHaveAttribute("data-active", "false");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(handles.onToggleRapport).toHaveBeenCalledTimes(1);
    expect(handles.onToggleRapport).toHaveBeenCalledWith("ins-1", true);

    // Na harness-state-update: data-active flipt naar true
    await waitFor(() => {
      expect(screen.getByTestId("inzicht-inrapport-toggle-ins-1")).toHaveAttribute("data-active", "true");
    });
  });

  test("4. Status-indicator-counter update na toggle", async () => {
    // Start: 1 van 2 in_rapport (insightDwars=true, insightOnderdeel=false)
    await renderHarness([insightOnderdeel, insightDwars]);

    const counter = screen.getByTestId("inzichten-status-counter");
    expect(counter).toHaveTextContent("1/2");

    // Toggle insightOnderdeel aan → 2/2
    await act(async () => {
      fireEvent.click(screen.getByTestId("inzicht-inrapport-toggle-ins-1"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("inzichten-status-counter")).toHaveTextContent("2/2");
    });

    // Toggle insightDwars uit → 1/2
    await act(async () => {
      fireEvent.click(screen.getByTestId("inzicht-inrapport-toggle-ins-2"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("inzichten-status-counter")).toHaveTextContent("1/2");
    });
  });
});
