/**
 * RFC-008 §9 — RTL voor OnepagerBuilder + ModelLibrary + A4Preview integration.
 *
 * Block 3 minimaal-8 cases (zie instructie 11.S Block 3 §10):
 *  1. Render — open=true toont split-layout (320px linker / rest rechter)
 *  2. AI-toggle aan/uit — body verandert + count update
 *  3. Model toggle aan — selectedModels krijgt model erbij + A4Preview update
 *  4. Model toggle uit — selectedModels verliest model
 *  5. Reorder up/down — volgorde verandert in selectie-overzicht
 *  6. Remove uit selectie — model verwijderd
 *  7. Disabled model — checkbox disabled + AlertCircle-icon met title-tooltip
 *  8. Terug naar Rapportage / Close — Builder sluit
 *  9. AI-toggle + 0 insights in_rapport=true → fallback-blok rendert
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc (consistent met
 * Block 1+2-tests).
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
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
import OnepagerBuilder from "../OnepagerBuilder";

const rpcMock = supabase.rpc;

// Test-config: 1 vast blok, 1 groep met 1 enabled + 1 disabled model
const testConfig = {
  vasteBlokken: [
    { id: "identiteit", label: "Identiteits-band", sub_label: "Missie · Visie · Ambitie" },
  ],
  modelLib: [
    {
      id: "analyse",
      label: "Strategische analyse",
      models: [
        { id: "swot", label: "SWOT-analyse", enabled: true },
        { id: "porter", label: "Porter 5 Forces", enabled: false, disabled_reason: "Geen sector-analyse-velden in werkblad" },
        { id: "pestel", label: "PESTEL", enabled: true },
      ],
    },
  ],
  dataResolver: (id) => {
    if (id === "identiteit") return { ready: true };
    if (id === "samenvatting") return { ready: false, completeness_msg: "Genereer samenvatting" };
    return { ready: true };
  },
};

const insightsBaseline = [
  { id: "i-1", in_rapport: true,  observation: "A", recommendation: "B", category: "onderdeel", type: "zwak", title: "T1" },
  { id: "i-2", in_rapport: true,  observation: "C", recommendation: "D", category: "onderdeel", type: "kans", title: "T2" },
  { id: "i-3", in_rapport: false, observation: "E", recommendation: "F", category: "onderdeel", type: "sterk", title: "T3" },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderBuilder(overrides = {}) {
  const props = {
    open: true,
    onClose: jest.fn(),
    onBackToMenu: null,
    config: testConfig,
    insights: insightsBaseline,
    appLabel: (k, fb) => fb,
    ...overrides,
  };
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <OnepagerBuilder {...props} />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return { ...result, props };
}

describe("OnepagerBuilder — RFC-008 §9 builder-overlay", () => {
  test("1. Render — split-layout (linker 320px paneel + rechter A4-viewport)", async () => {
    await renderBuilder();
    expect(screen.getByTestId("onepager-builder-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("onepager-builder-header")).toBeInTheDocument();
    const left = screen.getByTestId("onepager-builder-leftpanel");
    expect(left).toBeInTheDocument();
    expect(left.className).toMatch(/w-\[320px\]/);
    expect(screen.getByTestId("onepager-builder-rightpanel")).toBeInTheDocument();
    expect(screen.getByTestId("a4-preview-viewport")).toBeInTheDocument();
    // Vaste-blokken-sectie en groups-sectie aanwezig
    expect(screen.getByTestId("modellib-vaste-blokken")).toBeInTheDocument();
    expect(screen.getByTestId("modellib-groups")).toBeInTheDocument();
    expect(screen.getByTestId("modellib-vast-identiteit")).toBeInTheDocument();
  });

  test("2. AI-toggle aan/uit → body verandert + count update", async () => {
    await renderBuilder(); // 2 insights met in_rapport=true
    const toggleBlock = screen.getByTestId("onepager-ai-toggle-block");
    const body = screen.getByTestId("onepager-ai-toggle-body");
    // Default aan → "{N}" vervangen met 2
    expect(toggleBlock).toHaveAttribute("data-ai-active", "true");
    expect(body.textContent).toMatch(/2 bevindingen/);
    // Klik toggle uit
    await act(async () => {
      fireEvent.click(screen.getByTestId("onepager-ai-toggle-switch"));
    });
    expect(toggleBlock).toHaveAttribute("data-ai-active", "false");
    expect(body.textContent).toMatch(/zonder AI-bevindingen/i);
  });

  test("3. Model toggle aan → selectie-overzicht + A4Preview update", async () => {
    await renderBuilder();
    // Voor selectie is leeg
    expect(screen.getByTestId("modellib-selectie-empty")).toBeInTheDocument();
    // Vink SWOT aan
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-model-swot-checkbox"));
    });
    expect(screen.queryByTestId("modellib-selectie-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("modellib-selectie-swot")).toBeInTheDocument();
    // A4Preview rendert het model-blok
    expect(screen.getByTestId("a4-preview-model-swot")).toBeInTheDocument();
  });

  test("4. Model toggle uit → selectedModels verliest model", async () => {
    await renderBuilder();
    // Eerst aan
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-model-swot-checkbox"));
    });
    expect(screen.getByTestId("modellib-selectie-swot")).toBeInTheDocument();
    // Dan uit
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-model-swot-checkbox"));
    });
    expect(screen.queryByTestId("modellib-selectie-swot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("a4-preview-model-swot")).not.toBeInTheDocument();
  });

  test("5. Reorder up/down → volgorde verandert in selectie-overzicht", async () => {
    await renderBuilder();
    // Selecteer SWOT eerst, dan PESTEL → volgorde [swot, pestel]
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-model-swot-checkbox"));
      fireEvent.click(screen.getByTestId("modellib-model-pestel-checkbox"));
    });
    expect(screen.getByTestId("modellib-selectie-swot")).toHaveAttribute("data-position", "0");
    expect(screen.getByTestId("modellib-selectie-pestel")).toHaveAttribute("data-position", "1");
    // Klik pestel omhoog → wisselt met swot → volgorde [pestel, swot]
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-selectie-pestel-up"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("modellib-selectie-pestel")).toHaveAttribute("data-position", "0");
      expect(screen.getByTestId("modellib-selectie-swot")).toHaveAttribute("data-position", "1");
    });
    // Klik pestel omlaag → terug naar [swot, pestel]
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-selectie-pestel-down"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("modellib-selectie-swot")).toHaveAttribute("data-position", "0");
      expect(screen.getByTestId("modellib-selectie-pestel")).toHaveAttribute("data-position", "1");
    });
  });

  test("6. Remove uit selectie → model verwijderd uit selectedModels en A4Preview", async () => {
    await renderBuilder();
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-model-swot-checkbox"));
    });
    expect(screen.getByTestId("modellib-selectie-swot")).toBeInTheDocument();
    // Klik × verwijder
    await act(async () => {
      fireEvent.click(screen.getByTestId("modellib-selectie-swot-remove"));
    });
    expect(screen.queryByTestId("modellib-selectie-swot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("a4-preview-model-swot")).not.toBeInTheDocument();
    // Checkbox is ook geen-selected meer
    expect(screen.getByTestId("modellib-model-swot-checkbox")).not.toBeChecked();
  });

  test("7. Disabled model → checkbox disabled + AlertCircle-icon met title-tooltip", async () => {
    await renderBuilder();
    const cb = screen.getByTestId("modellib-model-porter-checkbox");
    expect(cb).toBeDisabled();
    const icon = screen.getByTestId("modellib-model-porter-disabled-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("title", "Geen sector-analyse-velden in werkblad");
    // Klik op disabled checkbox doet niets (geen state-change)
    const porterRow = screen.getByTestId("modellib-model-porter");
    expect(porterRow).toHaveAttribute("data-enabled", "false");
  });

  test("8. Terug naar Rapportage / Close — Builder sluit (Escape + back-knop)", async () => {
    const { props } = await renderBuilder();
    // Escape sluit overlay → onClose
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    // Re-render met onBackToMenu prop: back-knop roept onBackToMenu i.p.v. onClose
    const onBackToMenu = jest.fn();
    const onClose = jest.fn();
    await act(async () => {
      render(
        <AppConfigProvider>
          <OnepagerBuilder
            open
            onClose={onClose}
            onBackToMenu={onBackToMenu}
            config={testConfig}
            insights={insightsBaseline}
            appLabel={(k, fb) => fb}
          />
        </AppConfigProvider>
      );
    });
    const backBtns = screen.getAllByTestId("onepager-builder-back");
    await act(async () => {
      fireEvent.click(backBtns[backBtns.length - 1]); // de nieuwe overlay (laatst gerendered)
    });
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("9. AI-toggle aan + 0 insights in_rapport=true → fallback-blok rendert", async () => {
    await renderBuilder({
      insights: [{ id: "i-x", in_rapport: false, observation: "...", recommendation: "...", category: "onderdeel", type: "kans", title: "X" }],
    });
    // AI-toggle is default aan; geen insights met in_rapport=true
    expect(screen.getByTestId("a4-preview-insights-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("a4-preview-insights-block")).not.toBeInTheDocument();
    // Fallback-tekst zichtbaar
    const fallback = screen.getByTestId("a4-preview-insights-empty");
    expect(within(fallback).getByText(/Geen bevindingen geselecteerd/i)).toBeInTheDocument();
  });
});
