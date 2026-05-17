/**
 * RFC-008 §6 — RTL voor RapportageMenu + PPT-info-dialog.
 *
 * Block 2 minimaal-5 cases (zie instructie 11.S Block 2 §7):
 *  1. Render — open=true toont header + 2 tiles + tip-strip + footer-strip
 *  2. Klik buiten / Escape sluit — onClose aangeroepen
 *  3. Tile 1 (One-pager) klik → onSelectOnepager aangeroepen
 *  4. Tile 2 (PPT) klik → info-dialog rendert, niet onSelectOnepager
 *  5. PPT info-dialog "Open one-pager"-CTA → sluit info-dialog + roept onSelectOnepager
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc (consistent met
 * Block 1 InzichtenOverlay-tests).
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

import { supabase } from "../../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../../shared/context/AppConfigContext";
import RapportageMenu from "../RapportageMenu";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderMenu(overrides = {}) {
  const props = {
    open: true,
    onClose: jest.fn(),
    onSelectOnepager: jest.fn(),
    appLabel: (k, fb) => fb,
    headerLabel: "Strategie",
    ...overrides,
  };
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <RapportageMenu {...props} />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return { ...result, props };
}

describe("RapportageMenu — RFC-008 §6 export-keuze-dialog", () => {
  test("1. Render — open=true toont header + 2 tiles + tip-strip + footer-strip", async () => {
    await renderMenu();

    expect(screen.getByTestId("rapportage-menu")).toBeInTheDocument();
    // Header
    expect(screen.getByText(/Wat wil je delen met de klant\?/i)).toBeInTheDocument();
    // Tile 1 + 2
    expect(screen.getByTestId("rapportage-tile-onepager")).toBeInTheDocument();
    expect(screen.getByTestId("rapportage-tile-onepager-badge")).toHaveTextContent(/Populair/i);
    expect(screen.getByTestId("rapportage-tile-ppt")).toBeInTheDocument();
    expect(screen.getByTestId("rapportage-tile-ppt-badge")).toHaveTextContent(/Beschikbaar fase 2/i);
    // Tip-strip + footer-strip
    expect(screen.getByTestId("rapportage-tip")).toBeInTheDocument();
    expect(screen.getByTestId("rapportage-footer-binnenkort")).toBeInTheDocument();
    // Footer chips (4 verwacht)
    const footer = screen.getByTestId("rapportage-footer-binnenkort");
    expect(footer).toHaveTextContent(/Gamma/);
    expect(footer).toHaveTextContent(/Word-rapport/);
    expect(footer).toHaveTextContent(/PDF compleet/);
    expect(footer).toHaveTextContent(/E-mail-samenvatting/);
  });

  test("2a. Escape sluit menu → onClose aangeroepen", async () => {
    const { props } = await renderMenu();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("2b. Klik op overlay (buiten panel) sluit → onClose aangeroepen", async () => {
    const { props } = await renderMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-menu"));
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("3. Tile 1 (One-pager) klik → onSelectOnepager aangeroepen", async () => {
    const { props } = await renderMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-tile-onepager"));
    });
    expect(props.onSelectOnepager).toHaveBeenCalledTimes(1);
    // onClose NIET aangeroepen (parent beslist of het menu sluit na select)
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test("4. Tile 2 (PPT) klik → info-dialog rendert, onSelectOnepager NIET aangeroepen", async () => {
    const { props } = await renderMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-tile-ppt"));
    });
    expect(screen.getByTestId("rapportage-ppt-info-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("rapportage-ppt-info-dialog")).toHaveTextContent(/PowerPoint-export/i);
    expect(screen.getByTestId("rapportage-ppt-info-dialog")).toHaveTextContent(/Beschikbaar in fase 2/i);
    expect(props.onSelectOnepager).not.toHaveBeenCalled();
  });

  test("5. PPT info-dialog CTA \"Open one-pager\" → sluit info-dialog + roept onSelectOnepager", async () => {
    const { props } = await renderMenu();
    // Open PPT info-dialog
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-tile-ppt"));
    });
    expect(screen.getByTestId("rapportage-ppt-info-dialog")).toBeInTheDocument();

    // Klik CTA
    await act(async () => {
      fireEvent.click(screen.getByTestId("rapportage-ppt-info-cta-onepager"));
    });
    expect(props.onSelectOnepager).toHaveBeenCalledTimes(1);
    // Info-dialog gesloten
    await waitFor(() => {
      expect(screen.queryByTestId("rapportage-ppt-info-dialog")).not.toBeInTheDocument();
    });
  });

  test("6. open=false → niets gerendered (backwards-compat default)", async () => {
    // Skip de waitFor in renderMenu helper omdat AppConfigProvider niet hoeft te laden
    // voor open=false; gebruik directe render.
    await act(async () => {
      render(
        <AppConfigProvider>
          <RapportageMenu open={false} onClose={() => {}} onSelectOnepager={() => {}} appLabel={(k, fb) => fb} />
        </AppConfigProvider>
      );
    });
    expect(screen.queryByTestId("rapportage-menu")).not.toBeInTheDocument();
  });
});
