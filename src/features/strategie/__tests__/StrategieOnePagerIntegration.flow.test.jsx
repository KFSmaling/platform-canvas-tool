/**
 * 11.S Block 5 (FINAL) — RTL-integration voor Strategie OnePager-flow.
 *
 * Anker-doel: bewijst end-to-end wire-up tussen alle 11.S-componenten zonder
 * StrategieWerkblad-mount (te zwaar, Supabase-services). Test-wrapper
 * `<RapportageStack>` reproduceert de StrategieWerkblad-relevante state-flow:
 *
 *   onRapportage → RapportageMenu open → klik One-pager-tile →
 *     onSelectOnepager → OnepagerBuilder open met StrategyOnePager-v2-layout
 *
 * Plus separate test voor Inzichten status-counter → Rapportage-wire-up
 * (Block 1 onOpenRapportage TODO is in Block 2 wired aan setRapportageMenuOpen).
 *
 * 3 cases conform Block 5 instructie §1:
 *  1. End-to-end Rapportage-flow: Rapportage-knop → menu → tile → builder + v2
 *  2. AI-toggle flow end-to-end: builder open → toggle aan/uit → AiBlock zichtbaar/weg
 *  3. Inzichten status-counter → Rapportage-flow (Block 1 + Block 2 wire-up)
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc.
 * Geen StrategieWerkblad-mount; getest via mini-wrapper die state-management
 * 1-op-1 spiegelt aan StrategieWerkblad (zonder lazy-imports + Supabase-fetches).
 */

import React, { useState, useCallback } from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
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

import { supabase } from "../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../shared/context/AppConfigContext";
import RapportageMenu from "../../../shared/components/rapportage/RapportageMenu";
import OnepagerBuilder from "../../../shared/components/rapportage/OnepagerBuilder";
import InzichtenOverlay from "../../../shared/components/inzichten/InzichtenOverlay";
import StrategyOnePager from "../StrategyOnePager";
import { buildStrategieRapportageConfig } from "../strategieRapportageConfig";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

// ── Realistische test-data ──────────────────────────────────────────────────
const realisticCore = {
  missie: "Wij maken complexe data toegankelijk voor middelgrote bedrijven",
  visie: "In 2030 zijn we Europa's vertrouwde data-platform voor MKB",
  ambitie: "10x groei in 5 jaar; 50M ARR in 2030",
  kernwaarden: ["Eerlijk", "Onbevangen", "Mee-denkend"],
  samenvatting: "Onze strategie verschuift van product naar dienstverlening",
};

const realisticThemas = [
  { id: "t1", title: "Klantvertrouwen", sort_order: 1, ksf_kpi: [
    { id: "k1", type: "ksf", description: "NPS > 50", sort_order: 1 },
    { id: "k2", type: "kpi", description: "NPS", target_value: "+18", current_value: "+4", sort_order: 1 },
  ]},
  { id: "t2", title: "Operationele excellentie", sort_order: 2, ksf_kpi: [
    { id: "k3", type: "kpi", description: "Doorlooptijd", target_value: "3 dgn", current_value: "7 dgn", sort_order: 1 },
  ]},
];

const realisticAnalysis = [
  { id: "a1", type: "intern", tag: "sterkte",    content: "Sterke merk-reputatie" },
  { id: "a2", type: "intern", tag: "zwakte",     content: "Verouderd IT-landschap" },
];

const realisticInsights = [
  { id: "i1", in_rapport: true,  category: "onderdeel", type: "zwak", title: "Missie wollig", observation: "Te abstract", recommendation: "Concretiseer" },
  { id: "i2", in_rapport: true,  category: "dwarsverband", type: "kans", title: "Visie + klant", observation: "Verbinden", recommendation: null },
  { id: "i3", in_rapport: false, category: "onderdeel", type: "sterk", title: "Niet meegenomen", observation: "X", recommendation: "Y" },
];

const appLabel = (k, fb) => fb;

// ── Mini-wrapper die StrategieWerkblad-state-flow 1-op-1 reproduceert ───────
function RapportageStack() {
  const [rapportageMenuOpen, setRapportageMenuOpen] = useState(false);
  const [onepagerBuilderOpen, setOnepagerBuilderOpen] = useState(false);

  const config = buildStrategieRapportageConfig({
    strategyCore: realisticCore,
    themas: realisticThemas,
    analysisItems: realisticAnalysis,
    appLabel,
  });

  return (
    <div>
      <button
        data-testid="trigger-rapportage"
        onClick={() => setRapportageMenuOpen(true)}
      >
        Rapportage
      </button>
      {rapportageMenuOpen && (
        <RapportageMenu
          open={rapportageMenuOpen}
          onClose={() => setRapportageMenuOpen(false)}
          onSelectOnepager={() => {
            setRapportageMenuOpen(false);
            setOnepagerBuilderOpen(true);
          }}
          appLabel={appLabel}
          headerLabel="Strategie"
        />
      )}
      {onepagerBuilderOpen && (
        <OnepagerBuilder
          open={onepagerBuilderOpen}
          onClose={() => setOnepagerBuilderOpen(false)}
          onBackToMenu={() => {
            setOnepagerBuilderOpen(false);
            setRapportageMenuOpen(true);
          }}
          config={config}
          insights={realisticInsights}
          appLabel={appLabel}
          LayoutComponent={(layoutProps) => (
            <StrategyOnePager
              {...layoutProps}
              tenantBrand="Kingfisher"
              canvasName="Test Canvas"
            />
          )}
        />
      )}
    </div>
  );
}

// ── Inzichten + Rapportage-wire-up mini-wrapper (case 3) ─────────────────────
function InzichtenRapportageStack() {
  const [showAdvies, setShowAdvies] = useState(true); // start met Inzichten open
  const [rapportageMenuOpen, setRapportageMenuOpen] = useState(false);

  const handleOpenRapportage = useCallback(() => {
    setShowAdvies(false);
    setRapportageMenuOpen(true);
  }, []);

  return (
    <div>
      {showAdvies && (
        <InzichtenOverlay
          insights={realisticInsights}
          loading={false}
          error={null}
          onClose={() => setShowAdvies(false)}
          appLabel={appLabel}
          canvasName="Test"
          generatedAt={null}
          canvasId="cv-1"
          worksheetName="Strategie"
          onSave={async () => ({ data: null, error: null })}
          onToggleRapport={async () => ({ data: null, error: null })}
          onOpenRapportage={handleOpenRapportage}
        />
      )}
      {rapportageMenuOpen && (
        <RapportageMenu
          open={rapportageMenuOpen}
          onClose={() => setRapportageMenuOpen(false)}
          onSelectOnepager={() => {}}
          appLabel={appLabel}
          headerLabel="Strategie"
        />
      )}
    </div>
  );
}

async function renderRapportageStack() {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <RapportageStack />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

async function renderInzichtenStack() {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <InzichtenRapportageStack />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("11.S Block 5 — Strategie OnePager integration", () => {
  test("1. End-to-end Rapportage-flow: knop → menu → tile → Builder + v2 layout zichtbaar", async () => {
    await renderRapportageStack();

    // Rapportage-knop zichtbaar; klik
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-rapportage"));
    });

    // RapportageMenu open
    expect(screen.getByTestId("rapportage-menu")).toBeInTheDocument();
    expect(screen.getByText(/Wat wil je delen met de klant/i)).toBeInTheDocument();

    // Klik One-pager-tile
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-tile-onepager"));
    });

    // RapportageMenu gesloten, OnepagerBuilder open
    await waitFor(() => {
      expect(screen.queryByTestId("rapportage-menu")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("onepager-builder-overlay")).toBeInTheDocument();

    // ModelLibrary panel zichtbaar
    expect(screen.getByTestId("onepager-builder-leftpanel")).toBeInTheDocument();
    expect(screen.getByTestId("modellib-vaste-blokken")).toBeInTheDocument();
    expect(screen.getByTestId("modellib-groups")).toBeInTheDocument();

    // A4Preview met v2-layout aanwezig
    expect(screen.getByTestId("a4-preview-viewport")).toBeInTheDocument();
    expect(screen.getByTestId("a4-preview-page-flow")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-v2")).toBeInTheDocument();

    // v2 blokken zichtbaar
    expect(screen.getByTestId("strategie-onepager-brand-strip")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-h1")).toHaveTextContent(/Samenvatting Strategie/i);
    expect(screen.getByTestId("strategie-onepager-identiteit-band")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-kpi-strip")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-themas-grid")).toBeInTheDocument();
    // 2 thema's zichtbaar
    expect(screen.getByTestId("strategie-onepager-thema-T1")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-thema-T2")).toBeInTheDocument();
    // AI-block (withAi default true in OnepagerBuilder; A4Preview filtert
    // in_rapport=true; 2 insights doorgegeven aan v2; AiBlock rendert):
    expect(screen.getByTestId("strategie-onepager-ai-block")).toBeInTheDocument();
    // Footer zichtbaar
    expect(screen.getByTestId("strategie-onepager-footer")).toBeInTheDocument();
  });

  test("2. AI-toggle flow end-to-end: aan → AiBlock zichtbaar, uit → AiBlock weg", async () => {
    await renderRapportageStack();
    // Navigeer: knop → menu → tile → Builder
    await act(async () => { fireEvent.click(screen.getByTestId("trigger-rapportage")); });
    await act(async () => { fireEvent.click(screen.getByTestId("rapportage-tile-onepager")); });

    // Default: AI aan, AiBlock zichtbaar
    expect(screen.getByTestId("onepager-ai-toggle-block")).toHaveAttribute("data-ai-active", "true");
    expect(screen.getByTestId("strategie-onepager-ai-block")).toBeInTheDocument();

    // Toggle uit
    await act(async () => {
      fireEvent.click(screen.getByTestId("onepager-ai-toggle-switch"));
    });
    expect(screen.getByTestId("onepager-ai-toggle-block")).toHaveAttribute("data-ai-active", "false");

    // AiBlock + ai-empty allebei weg (withAi=false → BodyZone laat AI-kolom weg)
    await waitFor(() => {
      expect(screen.queryByTestId("strategie-onepager-ai-block")).not.toBeInTheDocument();
      expect(screen.queryByTestId("strategie-onepager-ai-empty")).not.toBeInTheDocument();
    });

    // Toggle weer aan
    await act(async () => {
      fireEvent.click(screen.getByTestId("onepager-ai-toggle-switch"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("strategie-onepager-ai-block")).toBeInTheDocument();
    });
  });

  test("3. Inzichten status-counter klik → sluit Inzichten + opent RapportageMenu (Block 1+2 wire-up)", async () => {
    await renderInzichtenStack();

    // InzichtenOverlay open
    expect(screen.getByTestId("inzichten-status-indicator")).toBeInTheDocument();
    // Counter toont 2/3 (2 in_rapport=true van 3 insights)
    expect(screen.getByTestId("inzichten-status-counter")).toHaveTextContent("2/3");

    // RapportageMenu nog NIET open
    expect(screen.queryByTestId("rapportage-menu")).not.toBeInTheDocument();

    // Klik status-indicator
    await act(async () => {
      fireEvent.click(screen.getByTestId("inzichten-status-indicator"));
    });

    // InzichtenOverlay gesloten; RapportageMenu open (Block 2 wire-up Block 1 TODO)
    await waitFor(() => {
      expect(screen.queryByTestId("inzichten-status-indicator")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("rapportage-menu")).toBeInTheDocument();
    expect(within(screen.getByTestId("rapportage-menu")).getByText(/Wat wil je delen/i)).toBeInTheDocument();
  });
});
