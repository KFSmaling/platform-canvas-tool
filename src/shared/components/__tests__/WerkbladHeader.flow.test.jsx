/**
 * Fase 2 design-systeem — RTL voor `WerkbladHeader` shared component.
 *
 * Optie A-pattern: echte AppConfigProvider + mock-`supabase.rpc` (anti
 * mock-blind-spot per Type 10 review-discipline).
 *
 * Cases:
 *  1. Drie lagen rendert wanneer tabs gegeven (categorie-icoon + titel + tabs)
 *  2. Laag 3 weglaten bij ontbrekende tabs (richtlijnen-pattern)
 *  3. Categorie-kleur-class koppelt aan correct categorie-token
 *  4. Tab-click → onTabClick met juiste tab-id
 *  5. Active tab markeert via data-active="true" + onderlijn-class
 *  6. saveStatus + rightExtra rendert in laag 1
 *  7. Aria-label op tab voor backwards-compat met "N · Label"-pattern
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Crosshair } from "lucide-react";

jest.mock("../../services/supabase.client", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

import { supabase } from "../../services/supabase.client";
import { AppConfigProvider } from "../../context/AppConfigContext";
import WerkbladHeader from "../WerkbladHeader";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderHeader(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <WerkbladHeader
          categorie="strategie"
          icon={Crosshair}
          titel="Test Werkblad"
          capsLabel="Werkblad"
          onClose={() => {}}
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("WerkbladHeader — Fase 2 design-systeem", () => {
  test("1. drie lagen rendert wanneer tabs gegeven", async () => {
    await renderHeader({
      tabs: [
        { id: 1, label: "Identiteit" },
        { id: 2, label: "Analyse" },
      ],
      activeTabId: 1,
    });
    expect(screen.getByTestId("werkblad-header")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-laag-1")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-laag-2")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-laag-3")).toBeInTheDocument();
    expect(screen.getByText("Test Werkblad")).toBeInTheDocument();
  });

  test("2. laag 3 weggelaten bij ontbrekende tabs (richtlijnen-pattern)", async () => {
    await renderHeader({ titel: "Richtlijnen" });
    expect(screen.getByTestId("werkblad-header-laag-1")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-header-laag-2")).toBeInTheDocument();
    expect(screen.queryByTestId("werkblad-header-laag-3")).not.toBeInTheDocument();
  });

  test("3. categorie-prop koppelt aan correct border-token in laag 2", async () => {
    await renderHeader({ categorie: "klanten" });
    const laag2 = screen.getByTestId("werkblad-header-laag-2");
    expect(laag2.className).toMatch(/border-b-category-klanten/);
  });

  test("4. tab-click → onTabClick met juiste tab-id", async () => {
    const onTabClick = jest.fn();
    await renderHeader({
      tabs: [
        { id: "identiteit", label: "Identiteit" },
        { id: "analyse",    label: "Analyse" },
      ],
      activeTabId: "identiteit",
      onTabClick,
    });
    fireEvent.click(screen.getByTestId("werkblad-header-tab-analyse"));
    expect(onTabClick).toHaveBeenCalledTimes(1);
    expect(onTabClick).toHaveBeenCalledWith("analyse");
  });

  test("5. active tab markeert via data-active='true'", async () => {
    await renderHeader({
      tabs: [
        { id: 1, label: "Tab 1" },
        { id: 2, label: "Tab 2" },
      ],
      activeTabId: 2,
    });
    expect(screen.getByTestId("werkblad-header-tab-1")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("werkblad-header-tab-2")).toHaveAttribute("data-active", "true");
  });

  test("6. saveStatus + rightExtra rendert in laag 1", async () => {
    await renderHeader({
      saveStatus: "Opgeslagen ✓",
      rightExtra: <button data-testid="full-draft-btn">Full Draft</button>,
    });
    const laag1 = screen.getByTestId("werkblad-header-laag-1");
    expect(laag1).toHaveTextContent("Opgeslagen ✓");
    expect(screen.getByTestId("full-draft-btn")).toBeInTheDocument();
  });

  test("7. aria-label op tab voor backwards-compat 'N · Label'-pattern", async () => {
    await renderHeader({
      tabs: [
        { id: 1, label: "Inventarisatie", pillNum: 1 },
        { id: 3, label: "Analyse",        pillNum: 3 },
      ],
      activeTabId: 1,
    });
    // Bestaande RTL gebruikt `findByRole("button", { name: /^3 · Analyse$/i })`
    // → aria-label moet "3 · Analyse" zijn (pill+label visueel gescheiden).
    const tab = screen.getByRole("button", { name: /^3 · Analyse$/i });
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute("data-testid", "werkblad-header-tab-3");
  });
});
