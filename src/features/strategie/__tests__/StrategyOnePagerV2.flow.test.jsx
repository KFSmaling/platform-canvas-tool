/**
 * RFC-008 §F + 11.S Block 4 §10 — RTL voor StrategyOnePager v2.
 *
 * Block 4 minimaal-6 cases (zie instructie §10):
 *  1. Render volledig gevulde canvas — alle blokken
 *  2. Fallback bij ontbrekende velden
 *  3. AI-toggle off — geen aandachtspunten-blok
 *  4. AI-toggle on + 0 in_rapport-insights — fallback "AI-inzichten uit"
 *  5. SWOT-model render — 4 quadranten
 *  6. Kernwaarden-bord-model render
 *
 * Optioneel:
 *  7. 5-7 thema's compact-layout (max 1 KSF / 2 KPI per kaart)
 *  8. Print-CSS class-namen aanwezig (.strategie-onepager-source-tag /
 *     .strategie-onepager-model-block + data-testids reverse-coverage)
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc (consistent met
 * Block 1+2+3-tests).
 */

import React from "react";
import { render, screen, act, waitFor, within } from "@testing-library/react";
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

// Bouw data-shape zoals OnepagerBuilder dat doet: resolve alle blok-ids + samenvatting.
function buildData(config, ids) {
  const data = {};
  ids.forEach(id => { data[id] = config.dataResolver(id); });
  return data;
}

const appLabel = (k, fb) => fb;

const fullStrategyCore = {
  missie: "Wij bouwen vertrouwen door scherpe analyses",
  visie: "In 2030 zijn we marktleider in transformatie",
  ambitie: "10x groei in 5 jaar",
  kernwaarden: ["Eerlijk", "Helder", "Mee-denkend"],
  samenvatting: "Onze strategie verschuift focus van product naar dienst",
};

const fullThemas = [
  { id: "t1", title: "Klantfocus", sort_order: 1, ksf_kpi: [
    { id: "k1", type: "ksf", description: "Klantcontact-frequentie", sort_order: 1 },
    { id: "k2", type: "kpi", description: "NPS", target_value: "+18", current_value: "+4", sort_order: 1 },
  ]},
  { id: "t2", title: "Operatie", sort_order: 2, ksf_kpi: [
    { id: "k3", type: "ksf", description: "Processtandaardisatie", sort_order: 1 },
    { id: "k4", type: "kpi", description: "Doorlooptijd", target_value: "3 dgn", current_value: "7 dgn", sort_order: 1 },
  ]},
];

const fullAnalysisItems = [
  { id: "a1", type: "intern", tag: "sterkte",    content: "Sterke merk-reputatie" },
  { id: "a2", type: "intern", tag: "zwakte",     content: "Verouderd IT-landschap" },
  { id: "a3", type: "extern", tag: "kans",       content: "Markt-consolidatie" },
  { id: "a4", type: "extern", tag: "bedreiging", content: "Nieuwe regulering" },
];

const fullInsights = [
  { id: "i1", in_rapport: true,  category: "onderdeel", type: "zwak", observation: "Missie wollig", recommendation: "Concretiseer" },
  { id: "i2", in_rapport: true,  category: "dwarsverband", type: "kans", observation: "Visie + klant verbinden", recommendation: null },
  { id: "i3", in_rapport: false, category: "onderdeel", type: "sterk", observation: "Niet meegenomen", recommendation: "" },
];

async function renderOnePager({ data, selectedModels = [], withAi = true, insights = [], tenantBrand = "Kingfisher", canvasName = "Test Canvas" }) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <StrategyOnePager
          data={data}
          selectedModels={selectedModels}
          withAi={withAi}
          insights={insights}
          appLabel={appLabel}
          tenantBrand={tenantBrand}
          canvasName={canvasName}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("StrategyOnePager v2 — RFC-008 §F + 11.S Block 4", () => {
  test("1. Render volledig gevulde canvas — alle blokken aanwezig", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "swot", "kernwaarden", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [{ id: "swot", label: "SWOT" }], withAi: true, insights: fullInsights });

    expect(screen.getByTestId("strategie-onepager-v2")).toBeInTheDocument();
    // 11.S-retro multi-page: brand-strip + footer renderen op elke pagina (2 pagina's hier).
    expect(screen.getAllByTestId("strategie-onepager-brand-strip").length).toBe(2);
    expect(screen.getAllByTestId("strategie-onepager-footer").length).toBe(2);
    // Page-1 specifieke testids (single match)
    expect(screen.getByTestId("strategie-onepager-titel-block")).toBeInTheDocument();
    // 11.S-retro-3: H1 is vaste-titel "Samenvatting Strategie", niet de
    // samenvatting-tekst zelf (Kees-keuze 18 mei).
    expect(screen.getByTestId("strategie-onepager-h1")).toHaveTextContent(/Samenvatting Strategie/i);
    expect(screen.getByTestId("strategie-onepager-h1")).not.toHaveTextContent(/Onze strategie verschuift/i);
    expect(screen.getByTestId("strategie-onepager-identiteit-band")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-kpi-strip")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-themas-grid")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-thema-T1")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-thema-T2")).toBeInTheDocument();
    // Page-2 specifieke testid: AI-blok
    expect(screen.getByTestId("strategie-onepager-ai-block")).toBeInTheDocument();
    // Kernwaarden inline in identiteits-band
    // 11.S-retro-3 Fix 3: kernwaarden-render uit identiteits-band verwijderd
    // (duplicatie-fix; kernwaarden blijven in body-zone Kernwaarden-bord-model).
    expect(screen.queryByTestId("strategie-onepager-kernwaarden-inline")).not.toBeInTheDocument();
    // 11.S-retro: data-total-pages-attribuut weerspiegelt page-count
    expect(screen.getByTestId("strategie-onepager-v2")).toHaveAttribute("data-total-pages", "2");
  });

  test("2. Fallback bij ontbrekende velden — placeholder + waarschuwing + BHAG/Horizon-fallback", async () => {
    const emptyCore = { missie: "", visie: "", ambitie: "Verdubbel 100M omzet", kernwaarden: [], samenvatting: "" };
    const config = buildStrategieRapportageConfig({
      strategyCore: emptyCore,
      themas: [],
      analysisItems: [],
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [], withAi: false, insights: [] });

    // 11.S-retro-3: H1 is vaste-titel ongeacht samenvatting-staat
    // (geen fallback-rendering meer in TitelBlock).
    expect(screen.getByTestId("strategie-onepager-h1")).toHaveTextContent(/Samenvatting Strategie/i);
    // Themas-empty fallback
    expect(screen.getByTestId("strategie-onepager-themas-empty")).toBeInTheDocument();
    // KPI-strip met fallback-cellen (BHAG uit ambitie "100M omzet" + Horizon)
    const kpiCells = screen.getAllByTestId(/^strategie-onepager-kpi-cell-/);
    expect(kpiCells.length).toBe(4);
    // Eerste BHAG-fallback cel data-fallback=true
    const fallbackCells = kpiCells.filter(c => c.getAttribute("data-fallback") === "true");
    expect(fallbackCells.length).toBeGreaterThanOrEqual(3); // ≥3 horizon fallbacks (kunnen 4 zijn als geen BHAG)
  });

  test("3. AI-toggle off + geen modellen → 1-page-distributie, geen page 2 / geen body / geen AI", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "swot", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [], withAi: false, insights: fullInsights });

    // 11.S-retro page-distributie: withAi=false + 0 modellen → 1 pagina (geen body/AI).
    expect(screen.getByTestId("strategie-onepager-v2")).toHaveAttribute("data-total-pages", "1");
    expect(screen.queryByTestId("strategie-onepager-ai-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strategie-onepager-ai-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strategie-onepager-body")).not.toBeInTheDocument();
    // Brand-strip + footer komen 1x voor (page 1 only)
    expect(screen.getAllByTestId("strategie-onepager-brand-strip").length).toBe(1);
    expect(screen.getAllByTestId("strategie-onepager-footer").length).toBe(1);
  });

  test("4. AI-toggle on + 0 in_rapport-insights → fallback 'AI-inzichten uit voor dit rapport'", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "samenvatting"]);
    await renderOnePager({
      data,
      selectedModels: [],
      withAi: true,
      insights: [{ id: "ix", in_rapport: false, category: "onderdeel", type: "zwak" }],
    });

    expect(screen.getByTestId("strategie-onepager-ai-empty")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-ai-empty")).toHaveTextContent(/AI-inzichten uit voor dit rapport/i);
    expect(screen.queryByTestId("strategie-onepager-ai-block")).not.toBeInTheDocument();
  });

  test("5. SWOT-model render — 4 quadranten met juiste analysis_items per tag", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "swot", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [{ id: "swot", label: "SWOT" }], withAi: false, insights: [] });

    expect(screen.getByTestId("strategie-onepager-model-swot")).toBeInTheDocument();
    expect(within(screen.getByTestId("strategie-onepager-swot-sterkten")).getByText(/Sterke merk-reputatie/)).toBeInTheDocument();
    expect(within(screen.getByTestId("strategie-onepager-swot-zwakten")).getByText(/Verouderd IT/)).toBeInTheDocument();
    expect(within(screen.getByTestId("strategie-onepager-swot-kansen")).getByText(/Markt-consolidatie/)).toBeInTheDocument();
    expect(within(screen.getByTestId("strategie-onepager-swot-bedreigingen")).getByText(/Nieuwe regulering/)).toBeInTheDocument();
  });

  test("6. Kernwaarden-bord-model render — grid met kaarten per kernwaarde", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "kernwaarden", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [{ id: "kernwaarden", label: "Kernwaarden" }], withAi: false, insights: [] });

    expect(screen.getByTestId("strategie-onepager-model-kernwaarden")).toBeInTheDocument();
    expect(screen.getByTestId("strategie-onepager-kernwaarde-0")).toHaveTextContent(/Eerlijk/);
    expect(screen.getByTestId("strategie-onepager-kernwaarde-1")).toHaveTextContent(/Helder/);
    expect(screen.getByTestId("strategie-onepager-kernwaarde-2")).toHaveTextContent(/Mee-denkend/);
  });

  test("7. 5+ thema's → alle 5 zichtbaar + ALLE KSFs/KPIs per kaart (11.S-retro-2 slice-removal)", async () => {
    // 11.S-retro-2 nieuw platform-principe: alle structurele input zichtbaar.
    // Oude test verwachtte `slice(0, 1)`/`slice(0, 2)` compact-truncation — die
    // is verwijderd. Nu moeten alle 5 thema's + ALLE KSFs/KPIs renderen.
    const manyThemas = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i + 1}`, title: `Thema ${i + 1}`, sort_order: i + 1,
      ksf_kpi: [
        { id: `ks${i}a`, type: "ksf", description: `KSF A van thema ${i + 1}`, sort_order: 1 },
        { id: `ks${i}b`, type: "ksf", description: `KSF B van thema ${i + 1}`, sort_order: 2 },
        { id: `kp${i}a`, type: "kpi", description: `KPI A van thema ${i + 1}`, target_value: "10", current_value: "5", sort_order: 1 },
        { id: `kp${i}b`, type: "kpi", description: `KPI B van thema ${i + 1}`, target_value: "20", current_value: "8", sort_order: 2 },
        { id: `kp${i}c`, type: "kpi", description: `KPI C van thema ${i + 1}`, sort_order: 3 },
      ],
    }));
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: manyThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "samenvatting"]);
    await renderOnePager({ data, selectedModels: [], withAi: false, insights: [] });

    // Alle 5 thema-kaarten aanwezig (Fix 1 — geen meer 5e thema verbergen)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`strategie-onepager-thema-T${i}`)).toBeInTheDocument();
    }
    // ALLE 2 KSFs en 3 KPIs zichtbaar in elk kaart (Fix 2 — slice removed)
    const t1 = screen.getByTestId("strategie-onepager-thema-T1");
    expect(within(t1).getByText(/KSF A van thema 1/)).toBeInTheDocument();
    expect(within(t1).getByText(/KSF B van thema 1/)).toBeInTheDocument();
    expect(within(t1).getByText(/KPI A van thema 1/)).toBeInTheDocument();
    expect(within(t1).getByText(/KPI B van thema 1/)).toBeInTheDocument();
    expect(within(t1).getByText(/KPI C van thema 1/)).toBeInTheDocument();
  });

  test("8. Print-CSS hooks — source-tags + model-block class-namen aanwezig", async () => {
    const config = buildStrategieRapportageConfig({
      strategyCore: fullStrategyCore,
      themas: fullThemas,
      analysisItems: fullAnalysisItems,
      appLabel,
    });
    const data = buildData(config, ["identiteit", "kpi-strip", "themas", "swot", "kernwaarden", "samenvatting"]);
    const { container } = await renderOnePager({
      data,
      selectedModels: [{ id: "swot", label: "SWOT" }, { id: "kernwaarden", label: "Kernwaarden" }],
      withAi: true,
      insights: fullInsights,
    });

    // Source-tags renderen (print-CSS verbergt ze, maar ze zijn in DOM)
    expect(container.querySelectorAll(".strategie-onepager-source-tag").length).toBeGreaterThan(0);
    // Model-blocks krijgen page-break-avoid hook
    expect(container.querySelectorAll(".strategie-onepager-model-block").length).toBeGreaterThanOrEqual(2);
  });
});
