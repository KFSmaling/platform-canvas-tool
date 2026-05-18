/**
 * Bundle 5 F32 — RTL voor RapportView eindresultaat-onepager.
 *
 * Optie A-pattern (anker stap_type-fix 12 mei + Bundle 4 F26): echte
 * AppConfigProvider + mock-`supabase.rpc` met label-rijen ipv directe
 * useAppConfig-mock. Dekt label-resolver-pad zonder mock-blind-spots.
 *
 * Test-cases (6):
 *  1. Default zonder AI + zonder concepten + zonder verstuurd → toggle hidden,
 *     4 secties zichtbaar, leeg-state in Roadmap-sectie
 *  2. 2 verstuurd + 0 concept + 0 AI → toggle hidden (smart-disable),
 *     Roadmap-sectie toont 2 cards
 *  3. 2 verstuurd + 3 concept + 2 AI, toggle UIT → toggle zichtbaar,
 *     AI/concept-secties verborgen, alleen verstuurd zichtbaar
 *  4. Klik toggle → AI-sectie + concept-sectie verschijnen, samenvatting
 *     krijgt proces-info-aanvulling tussen haakjes
 *  5. 0 verstuurd + 3 concept → toggle zichtbaar, default leeg-state in Roadmap;
 *     toggle aan → concept-sectie toont 3
 *  6. Filter-test: verstuurd-intent NIET in concept-sectie; concept-intent NIET
 *     in Roadmap-sectie (geen kruisbestuiving)
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../../../shared/services/supabase.client", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform" }),
}));

jest.mock("../../../shared/components/AiIcon", () => ({
  __esModule: true,
  default: () => null,
}));

import { supabase } from "../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../shared/context/AppConfigContext";
import RapportView from "../RapportView";

const rpcMock = supabase.rpc;

// Minimal label-rijen — andere appLabel-calls vallen op LABEL_FALLBACKS/inline
const CONFIG_ROWS = [
  { key: "label.klanten.rapport.section.naar_roadmap",     value: "Verbeteracties → Roadmap",          category: "label", tenant_id: null },
  { key: "label.klanten.rapport.naar_roadmap.leeg",        value: "Nog geen verbeteracties naar Roadmap doorgezet.", category: "label", tenant_id: null },
  { key: "label.klanten.rapport.section.concept_intents",  value: "Concept-verbeteracties",            category: "label", tenant_id: null },
  { key: "label.klanten.rapport.section.patronen",         value: "Geaccepteerde patronen",            category: "label", tenant_id: null },
  { key: "label.klanten.rapport.toggle.label.uit",         value: "Toon proces-info",                  category: "label", tenant_id: null },
  { key: "label.klanten.rapport.toggle.label.aan",         value: "Proces-info zichtbaar ✓",           category: "label", tenant_id: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: CONFIG_ROWS, error: null });
});

const baseDim = { id: "dim-1", archetype: "klantsegment", name: "Klantsegmenten", sort_order: 10 };
const baseItem = { id: "it-1", dimension_id: "dim-1", canvas_id: "cv-1", name: "Particulier", sort_order: 10, is_draft: false };

function suggestion(id, status) {
  return {
    id, canvas_id: "cv-1",
    pattern_type: "cluster",
    text_md: `Pattern ${id}`,
    current_status: status, // "accepted" / "open" etc.
    is_user_edited: false, parent_id: null, scope: "canvas", vanuit: [],
  };
}

function intent(id, status, title) {
  // 11.U Block 1 (RFC-007-rev2): legacy "verstuurd" → "definitief". Helper accepteert
  // beide en normaliseert intern naar "definitief" voor consistente test-data.
  const normalized = status === "verstuurd" ? "definitief" : status;
  return {
    id, title: title || `Intent ${id}`,
    intent_md: `Beschrijving ${id} — voldoende lang om validatie te passeren — minstens 50 tekens hier.`,
    status: normalized, // "definitief" of "concept" of "dismissed"
    handover_to_roadmap_at: normalized === "definitief" ? "2026-05-12T12:00:00Z" : null,
  };
}

async function renderRapport(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <RapportView
          canvasName="Test Canvas"
          dimensions={[baseDim]}
          items={[baseItem]}
          painPoints={[]}
          couplings={[]}
          suggestions={[]}
          intents={[]}
          onClose={() => {}}
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("RapportView — F32 eindresultaat-onepager", () => {
  test("1. default zonder AI + concepten + verstuurd → toggle hidden, Roadmap leeg-state", async () => {
    await renderRapport();
    expect(screen.queryByTestId("rapport-toggle-proces-info")).not.toBeInTheDocument();
    expect(screen.getByTestId("rapport-section-naar-roadmap")).toHaveTextContent(/Nog geen verbeteracties naar Roadmap/i);
    expect(screen.queryByTestId("rapport-section-patronen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rapport-section-concept-intents")).not.toBeInTheDocument();
  });

  test("2. 2 verstuurd + 0 concept + 0 AI → toggle hidden, Roadmap-sectie toont 2 cards", async () => {
    const intents = [intent("i-1", "verstuurd"), intent("i-2", "verstuurd")];
    await renderRapport({ intents });
    expect(screen.queryByTestId("rapport-toggle-proces-info")).not.toBeInTheDocument();
    expect(screen.getByTestId("rapport-intent-card-i-1")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-intent-card-i-2")).toBeInTheDocument();
  });

  test("3. 2 verstuurd + 3 concept + 2 AI, toggle UIT default → AI/concept verborgen", async () => {
    const intents = [
      intent("i-1", "verstuurd"), intent("i-2", "verstuurd"),
      intent("c-1", "concept"),  intent("c-2", "concept"),  intent("c-3", "concept"),
    ];
    const suggestions = [suggestion("s-1", "accepted"), suggestion("s-2", "accepted")];
    await renderRapport({ intents, suggestions });

    // Toggle zichtbaar in uit-staat
    const toggle = screen.getByTestId("rapport-toggle-proces-info");
    expect(toggle).toHaveTextContent(/Toon proces-info/);

    // Roadmap-sectie toont alleen verstuurd
    expect(screen.getByTestId("rapport-intent-card-i-1")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-intent-card-i-2")).toBeInTheDocument();
    // Concept-intents niet in roadmap-grid
    expect(screen.queryByTestId("rapport-intent-card-c-1")).not.toBeInTheDocument();

    // AI + concept-secties verborgen
    expect(screen.queryByTestId("rapport-section-patronen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rapport-section-concept-intents")).not.toBeInTheDocument();
  });

  test("4. Toggle aan → AI-sectie + concept-sectie verschijnen", async () => {
    const intents = [intent("i-1", "verstuurd"), intent("c-1", "concept"), intent("c-2", "concept")];
    const suggestions = [suggestion("s-1", "accepted")];
    await renderRapport({ intents, suggestions });

    const toggle = screen.getByTestId("rapport-toggle-proces-info");
    await act(async () => { fireEvent.click(toggle); });

    expect(toggle).toHaveTextContent(/Proces-info zichtbaar/);
    expect(screen.getByTestId("rapport-section-patronen")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-section-concept-intents")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-concept-intent-card-c-1")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-concept-intent-card-c-2")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-pattern-card-s-1")).toBeInTheDocument();
  });

  test("5. 0 verstuurd + 3 concept → toggle zichtbaar, default leeg in Roadmap; toggle aan → 3 concepten", async () => {
    const intents = [intent("c-1", "concept"), intent("c-2", "concept"), intent("c-3", "concept")];
    await renderRapport({ intents });

    // Toggle zichtbaar (smart-disable triggert NIET want conceptIntents > 0)
    const toggle = screen.getByTestId("rapport-toggle-proces-info");
    expect(toggle).toBeInTheDocument();

    // Roadmap-sectie toont leeg-state (geen verstuurd)
    expect(screen.getByTestId("rapport-section-naar-roadmap")).toHaveTextContent(/Nog geen verbeteracties naar Roadmap/i);

    // Toggle aan
    await act(async () => { fireEvent.click(toggle); });
    expect(screen.getByTestId("rapport-concept-intent-card-c-1")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-concept-intent-card-c-2")).toBeInTheDocument();
    expect(screen.getByTestId("rapport-concept-intent-card-c-3")).toBeInTheDocument();
  });

  test("6. Filter-test: verstuurd NIET in concept-sectie + concept NIET in roadmap-sectie", async () => {
    const intents = [
      intent("i-1", "verstuurd", "Verstuurd-intent"),
      intent("c-1", "concept",   "Concept-intent"),
    ];
    await renderRapport({ intents });

    // Roadmap-sectie bevat alleen "Verstuurd-intent"
    const roadmap = screen.getByTestId("rapport-section-naar-roadmap");
    expect(roadmap).toHaveTextContent("Verstuurd-intent");
    expect(roadmap).not.toHaveTextContent("Concept-intent");

    // Toggle aan om concept-sectie te tonen
    await act(async () => { fireEvent.click(screen.getByTestId("rapport-toggle-proces-info")); });

    // Concept-sectie bevat alleen "Concept-intent"
    const conceptSection = screen.getByTestId("rapport-section-concept-intents");
    expect(conceptSection).toHaveTextContent("Concept-intent");
    expect(conceptSection).not.toHaveTextContent("Verstuurd-intent");
  });
});
