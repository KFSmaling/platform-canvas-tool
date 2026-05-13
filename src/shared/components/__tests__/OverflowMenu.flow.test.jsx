/**
 * Fase 3 design-systeem — RTL voor `OverflowMenu` + `OverDialog`.
 *
 * Optie A-pattern: echte AppConfigProvider + mock-`supabase.rpc`. Anti
 * mock-blind-spot per Type 10 review-discipline.
 *
 * OverflowMenu (6 cases):
 *  1. Trigger-button rendert met aria-haspopup="menu" + aria-expanded="false"
 *  2. Klik trigger → panel verschijnt; klik nogmaals → panel verdwijnt
 *  3. Item-click → onClick callback + menu sluit
 *  4. `hidden: true`-item rendert niet
 *  5. `danger: true`-item krijgt danger-styling
 *  6. Esc-toets sluit panel
 *
 * OverDialog (2 cases):
 *  7. Rendert versie + auteur + sluit-knop
 *  8. Klik sluit-knop → onClose callback
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LogOut, Settings } from "lucide-react";

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
import OverflowMenu from "../OverflowMenu";
import OverDialog from "../OverDialog";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderWithProvider(ui) {
  let result;
  await act(async () => {
    result = render(<AppConfigProvider>{ui}</AppConfigProvider>);
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("OverflowMenu — Fase 3 design-systeem", () => {
  test("1. trigger-button rendert met juiste ARIA-attributes", async () => {
    await renderWithProvider(<OverflowMenu items={[]} />);
    const trigger = screen.getByTestId("overflow-menu-trigger");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("2. klik trigger → panel verschijnt + tweede klik sluit", async () => {
    await renderWithProvider(
      <OverflowMenu items={[{ id: "test", label: "Test item", onClick: () => {} }]} />
    );
    const trigger = screen.getByTestId("overflow-menu-trigger");
    expect(screen.queryByTestId("overflow-menu-panel")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId("overflow-menu-panel")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(screen.queryByTestId("overflow-menu-panel")).not.toBeInTheDocument();
  });

  test("3. item-click → onClick callback + menu sluit", async () => {
    const onClick = jest.fn();
    await renderWithProvider(
      <OverflowMenu items={[
        { id: "logout", label: "Uitloggen", icon: LogOut, onClick },
      ]} />
    );
    fireEvent.click(screen.getByTestId("overflow-menu-trigger"));
    fireEvent.click(screen.getByTestId("overflow-menu-item-logout"));
    expect(onClick).toHaveBeenCalledTimes(1);
    // Menu moet gesloten zijn
    expect(screen.queryByTestId("overflow-menu-panel")).not.toBeInTheDocument();
  });

  test("4. hidden=true item rendert niet", async () => {
    await renderWithProvider(
      <OverflowMenu items={[
        { id: "visible", label: "Zichtbaar", onClick: () => {} },
        { id: "hidden",  label: "Verborgen", onClick: () => {}, hidden: true },
      ]} />
    );
    fireEvent.click(screen.getByTestId("overflow-menu-trigger"));
    expect(screen.getByTestId("overflow-menu-item-visible")).toBeInTheDocument();
    expect(screen.queryByTestId("overflow-menu-item-hidden")).not.toBeInTheDocument();
  });

  test("5. danger=true item krijgt danger-styling (inline style color)", async () => {
    await renderWithProvider(
      <OverflowMenu items={[
        { id: "uitloggen", label: "Uitloggen", icon: LogOut, onClick: () => {}, danger: true },
      ]} />
    );
    fireEvent.click(screen.getByTestId("overflow-menu-trigger"));
    const item = screen.getByTestId("overflow-menu-item-uitloggen");
    expect(item).toHaveAttribute("data-danger", "true");
  });

  test("6. Esc-toets sluit panel", async () => {
    await renderWithProvider(
      <OverflowMenu items={[{ id: "test", label: "Test", onClick: () => {} }]} />
    );
    fireEvent.click(screen.getByTestId("overflow-menu-trigger"));
    expect(screen.getByTestId("overflow-menu-panel")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("overflow-menu-panel")).not.toBeInTheDocument();
  });

  test("7. admin-link conditioneel via hidden-prop (use-case App.js header)", async () => {
    const isAdmin = false;  // simuleer non-admin
    await renderWithProvider(
      <OverflowMenu items={[
        { id: "admin", label: "App config", icon: Settings, onClick: () => {}, hidden: !isAdmin },
        { id: "uitloggen", label: "Uitloggen", icon: LogOut, onClick: () => {}, danger: true },
      ]} />
    );
    fireEvent.click(screen.getByTestId("overflow-menu-trigger"));
    expect(screen.queryByTestId("overflow-menu-item-admin")).not.toBeInTheDocument();
    expect(screen.getByTestId("overflow-menu-item-uitloggen")).toBeInTheDocument();
  });
});

describe("OverDialog — Fase 3 design-systeem", () => {
  test("8. rendert versie + sluit-knop + Esc-toets sluit", async () => {
    const onClose = jest.fn();
    await renderWithProvider(<OverDialog onClose={onClose} />);
    expect(screen.getByTestId("over-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("over-dialog-close")).toBeInTheDocument();
    expect(screen.getByTestId("over-dialog-ok")).toBeInTheDocument();
    // Versie-pill zichtbaar (fallback 0.1.0)
    expect(screen.getByText(/v0\.1\.0/i)).toBeInTheDocument();

    // Esc → onClose
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("9. klik sluit-knop → onClose", async () => {
    const onClose = jest.fn();
    await renderWithProvider(<OverDialog onClose={onClose} />);
    fireEvent.click(screen.getByTestId("over-dialog-ok"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
