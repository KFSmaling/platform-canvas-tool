/**
 * 11.S-retro-3 — RTL voor identiteits-band content-aware split + H1 vaste-titel.
 *
 * 6 cases (instructie §4):
 *  1. H1 vaste-tekst — toont "Samenvatting Strategie" ongeacht samenvatting-data
 *  2. Samenvatting niet gerendered in TitelBlock
 *  3. Identiteits-band LANGE tekst → vaste-blokken-split naar 2 pages (Fix 2)
 *  4. Identiteits-band KORTE tekst → geen split (retro-2-pattern)
 *  5. Empty identiteit → geen split (char-count = 0)
 *  6. Kernwaarden NIET in identiteits-band (Fix 3 duplicatie)
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc.
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
import StrategyOnePager, { computePages } from "../StrategyOnePager";
import { buildStrategieRapportageConfig } from "../strategieRapportageConfig";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

function buildData(config, ids) {
  const data = {};
  ids.forEach(id => { data[id] = config.dataResolver(id); });
  return data;
}

const appLabel = (k, fb) => fb;

async function renderV2(coreOverrides = {}, opts = {}) {
  const core = {
    missie: "M",
    visie: "V",
    ambitie: "A",
    kernwaarden: ["K1", "K2"],
    samenvatting: "Een specifieke samenvatting met details",
    ...coreOverrides,
  };
  const config = buildStrategieRapportageConfig({
    strategyCore: core,
    themas: [],
    analysisItems: [],
    appLabel,
  });
  const data = buildData(config, ["identiteit", "kpi-strip", "themas", "samenvatting"]);
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <StrategyOnePager
          data={data}
          selectedModels={opts.selectedModels || []}
          withAi={opts.withAi ?? false}
          insights={opts.insights || []}
          appLabel={appLabel}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("11.S-retro-3 — Identiteits-band overflow + H1 vaste-titel", () => {
  test("1. H1 vaste-tekst 'Samenvatting Strategie' ongeacht samenvatting-data", async () => {
    await renderV2({ samenvatting: "Hele lange specifieke samenvatting met BHAG-getallen 10x in 5 jaar dat aanslaat" });
    expect(screen.getByTestId("strategie-onepager-h1")).toHaveTextContent("Samenvatting Strategie");
    // Samenvatting-tekst zelf NIET in H1
    expect(screen.getByTestId("strategie-onepager-h1")).not.toHaveTextContent(/specifieke samenvatting/i);
  });

  test("2. Samenvatting-tekst niet gerendered in TitelBlock (alleen H1-label + eyebrow)", async () => {
    await renderV2({ samenvatting: "Marker-tekst-die-niet-mag-renderen-XYZ123" });
    const titelBlock = screen.getByTestId("strategie-onepager-titel-block");
    expect(within(titelBlock).queryByText(/Marker-tekst-die-niet-mag-renderen-XYZ123/)).not.toBeInTheDocument();
  });

  test("3. Identiteits-band LANGE tekst > 500 chars → vaste-blokken-split (2 pages)", async () => {
    // 250 chars missie + 250 chars visie + 100 chars ambitie = 600 chars > 500 threshold
    const longText250 = "X".repeat(250);
    const longText100 = "Y".repeat(100);
    await renderV2({
      missie: longText250,
      visie: longText250,
      ambitie: longText100,
    });
    // computePages → main-identity + main-kpi-themas (2 pages voor vaste blokken)
    const v2 = screen.getByTestId("strategie-onepager-v2");
    expect(parseInt(v2.getAttribute("data-total-pages"))).toBeGreaterThanOrEqual(2);
    // IdentiteitsBand op page 1
    expect(screen.getByTestId("strategie-onepager-identiteit-band")).toBeInTheDocument();
    // KPI + Themas op page 2 (separate render, niet samen met identiteit)
    expect(screen.getByTestId("strategie-onepager-kpi-strip")).toBeInTheDocument();
    // 2 BrandStrips (één per pagina)
    expect(screen.getAllByTestId("strategie-onepager-brand-strip").length).toBe(2);
    expect(screen.getAllByTestId("strategie-onepager-footer").length).toBe(2);
  });

  test("4. Identiteits-band KORTE tekst < 500 chars → geen split (retro-2-pattern)", async () => {
    await renderV2({ missie: "Korte missie", visie: "Korte visie", ambitie: "Korte ambitie" });
    const v2 = screen.getByTestId("strategie-onepager-v2");
    expect(parseInt(v2.getAttribute("data-total-pages"))).toBe(1);
    expect(screen.getAllByTestId("strategie-onepager-brand-strip").length).toBe(1);
  });

  test("5. Empty identiteit → char-count=0 → geen split (1 page)", async () => {
    await renderV2({ missie: "", visie: "", ambitie: "" });
    const v2 = screen.getByTestId("strategie-onepager-v2");
    expect(parseInt(v2.getAttribute("data-total-pages"))).toBe(1);
    // Placeholders zichtbaar
    expect(screen.getByText(/Missie nog niet ingevuld/i)).toBeInTheDocument();
    expect(screen.getByText(/Visie nog niet ingevuld/i)).toBeInTheDocument();
    expect(screen.getByText(/Ambitie nog niet ingevuld/i)).toBeInTheDocument();
  });

  test("6. Kernwaarden NIET in identiteits-band (Fix 3 duplicatie-fix)", async () => {
    await renderV2({ kernwaarden: ["Klantgericht", "Innoverend", "Eerlijk"] });
    const identityBand = screen.getByTestId("strategie-onepager-identiteit-band");
    expect(within(identityBand).queryByText(/Klantgericht/)).not.toBeInTheDocument();
    expect(within(identityBand).queryByText(/Innoverend/)).not.toBeInTheDocument();
    expect(within(identityBand).queryByText(/Eerlijk/)).not.toBeInTheDocument();
    // KERNWAARDEN-label ook niet in identiteits-band
    expect(within(identityBand).queryByText(/KERNWAARDEN/i)).not.toBeInTheDocument();
    // kernwaarden-inline-testid weg
    expect(screen.queryByTestId("strategie-onepager-kernwaarden-inline")).not.toBeInTheDocument();
  });

  test("7. computePages pure-function: identityContentLength > 500 → split-recipe", () => {
    const dataLong = {
      identiteit: { data: { missie: "x".repeat(300), visie: "y".repeat(300), ambitie: "" } },
    };
    const pages = computePages({
      selectedModels: [],
      withAi: false,
      insights: [],
      data: dataLong,
    });
    // 2 pages: main-identity + main-kpi-themas (no body)
    expect(pages.length).toBe(2);
    expect(pages[0].type).toBe("main-identity");
    expect(pages[1].type).toBe("main-kpi-themas");
  });

  test("8. computePages pure-function: kernwaarden tellen NIET mee (post-Fix-3)", () => {
    // 400 chars identiteit (onder 500) + 200 chars kernwaarden — totaal zou 600 zijn,
    // maar kernwaarden tellen niet → moet 1 page main blijven.
    const dataMix = {
      identiteit: {
        data: {
          missie: "x".repeat(200),
          visie: "y".repeat(200),
          ambitie: "",
          kernwaarden: ["a".repeat(100), "b".repeat(100)],
        },
      },
    };
    const pages = computePages({ selectedModels: [], withAi: false, insights: [], data: dataMix });
    expect(pages.length).toBe(1);
    expect(pages[0].type).toBe("main");
  });
});
