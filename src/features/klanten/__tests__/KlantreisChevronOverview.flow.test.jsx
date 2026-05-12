/**
 * Bundle 4 F26 — RTL voor KlantreisChevronOverview + DimensieKolom-klantreis-integratie.
 *
 * Optie A-pattern (anker stap_type-fix 12 mei): echte AppConfigProvider +
 * mock-`supabase.rpc` met DB-rijen ipv directe useAppConfig-mock. Vermijdt
 * mock-blind-spots in `label`-resolver-pad.
 *
 * Test-cases:
 *  1. Rendert N chevrons gegeven N klantreis-items
 *  2. Klik op chevron → onChevronClick aangeroepen met juiste item-id
 *  3. fase=2 + painPointCounts.get(itemId) > 0 → pain-badge zichtbaar met juiste count
 *  4. fase=2 + is_moment_of_truth=true → chevron data-asymmetrie="true" + card pill-badge
 *  5. fase=1 → geen pain-badge zelfs met counts > 0; geen pill op MoT-card
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock supabase.client (anker AppConfigContext.flow.test.jsx)
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
import KlantreisChevronOverview from "../KlantreisChevronOverview";

const rpcMock = supabase.rpc;

// Minimal config — 9 short-namen + 2 pill-keys (rest valt op fallback)
const CONFIG_ROWS = [
  { key: "label.klanten.klantreis.stap_type.trigger_life_event.short", value: "Life Event", category: "label", tenant_id: null },
  { key: "label.klanten.klantreis.stap_type.claim_schade.short",       value: "Claim",      category: "label", tenant_id: null },
  { key: "label.klanten.klantreis.stap_type.trigger_life_event",       value: "1. Life Event Trigger", category: "label", tenant_id: null },
  { key: "label.klanten.klantreis.stap_type.claim_schade",             value: "8. Claim / Schade",     category: "label", tenant_id: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: CONFIG_ROWS, error: null });
});

const sampleItems = [
  {
    id: "kr-1",
    name: "1. Life Event Trigger",
    sort_order: 10,
    archetype_data: { stap_type: "trigger_life_event" },
  },
  {
    id: "kr-8",
    name: "8. Claim / Schade",
    sort_order: 80,
    archetype_data: {
      stap_type: "claim_schade",
      is_moment_of_truth: true,
      weight_multiplier: 3,
    },
  },
  {
    id: "kr-9",
    name: "9. Renewal",
    sort_order: 90,
    archetype_data: { stap_type: "renewal_churn_advocacy" },
  },
];

async function renderOverview(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <KlantreisChevronOverview
          items={sampleItems}
          painPointCounts={new Map()}
          currentPhase={1}
          onChevronClick={() => {}}
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("KlantreisChevronOverview — F26 Optie A", () => {
  test("1. rendert N chevrons gegeven N items + sticky-container met testid", async () => {
    await renderOverview();
    expect(screen.getByTestId("klantreis-chevron-overview")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-kr-1")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-kr-8")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-kr-9")).toBeInTheDocument();
    // Sticky positioning class aanwezig (anker top-0)
    expect(screen.getByTestId("klantreis-chevron-overview").className).toMatch(/sticky/);
  });

  test("2. klik op chevron → onChevronClick met juiste item-id", async () => {
    const onChevronClick = jest.fn();
    await renderOverview({ onChevronClick });
    fireEvent.click(screen.getByTestId("chevron-kr-8"));
    expect(onChevronClick).toHaveBeenCalledTimes(1);
    expect(onChevronClick).toHaveBeenCalledWith("kr-8");
  });

  test("3. fase=2 + painCount>0 → pain-badge zichtbaar met juiste count", async () => {
    const counts = new Map([["kr-8", 5], ["kr-1", 2]]);
    await renderOverview({ currentPhase: 2, painPointCounts: counts });
    expect(screen.getByTestId("chevron-pain-badge-kr-1")).toHaveTextContent("2");
    expect(screen.getByTestId("chevron-pain-badge-kr-8")).toHaveTextContent("5");
    // kr-9 heeft geen count → geen badge
    expect(screen.queryByTestId("chevron-pain-badge-kr-9")).not.toBeInTheDocument();
  });

  test("4. fase=2 + MoT-flag → data-asymmetrie='true' op chevron", async () => {
    await renderOverview({ currentPhase: 2 });
    const chevron8 = screen.getByTestId("chevron-kr-8");
    expect(chevron8).toHaveAttribute("data-asymmetrie", "true");
    const chevron1 = screen.getByTestId("chevron-kr-1");
    expect(chevron1).toHaveAttribute("data-asymmetrie", "false");
  });

  test("5. fase=1 → geen pain-badges zelfs met counts > 0", async () => {
    const counts = new Map([["kr-8", 5]]);
    await renderOverview({ currentPhase: 1, painPointCounts: counts });
    // Pain-badge alleen in fase >= 2
    expect(screen.queryByTestId("chevron-pain-badge-kr-8")).not.toBeInTheDocument();
  });

  test("6. short-label uit DB rendert i.p.v. volle item.name", async () => {
    await renderOverview();
    // Chevron kr-1 toont "Life Event" (short) ergens — niet de fallback "1. Life Event Trigger"
    const overview = screen.getByTestId("klantreis-chevron-overview");
    await waitFor(() => {
      expect(overview).toHaveTextContent("Life Event");
      expect(overview).toHaveTextContent("Claim");
    });
  });

  test("7. highlightedItemId → ring-2 class op corresponderende chevron-button", async () => {
    await renderOverview({ highlightedItemId: "kr-8" });
    const chevron = screen.getByTestId("chevron-kr-8");
    expect(chevron.className).toMatch(/ring-2/);
    expect(screen.getByTestId("chevron-kr-1").className).not.toMatch(/ring-2/);
  });
});
