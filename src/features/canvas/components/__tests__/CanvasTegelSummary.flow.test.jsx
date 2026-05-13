/**
 * S1 design-systeem — RTL voor CanvasTegelSummary F12-feedback.
 *
 * Optie A-pattern: echte AppConfigProvider + mock-supabase.rpc. Geen
 * directe getter-mock — Type 10 mock-blind-spot voorkomen.
 *
 * Cases:
 *  1. Klanten met counts → "N dimensies · M items · K pijnpunten" + roadmap-pill
 *  2. Klanten leeg (alle 0) → empty-state-tekst
 *  3. Strategie met identiteit-velden + thema's → "X/4 identiteit · Y thema's"
 *  4. Strategie leeg → empty-state-tekst
 *  5. Richtlijnen met count + title → counts + quote
 *  6. Niet-gebouwde werkbladen (processes/people/technology/portfolio) → stub-tekst
 *  7. Last-pattern-text quote truncate bij > 100 chars
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
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
import CanvasTegelSummary from "../CanvasTegelSummary";

const rpcMock = supabase.rpc;

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: [], error: null });
});

async function renderTegel(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <CanvasTegelSummary {...props} />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("CanvasTegelSummary — S1 F12-feedback", () => {
  test("1. klanten met counts toont dimensies/items/pijnpunten + roadmap-pill", async () => {
    const summary = {
      klanten: {
        dimensies: 9, items: 12, pijnpunten: 7,
        verbeteracties_roadmap: 3, verbeteracties_concept: 1,
        last_pattern_text: "Cluster: SME-conversie blijft achter",
      },
    };
    await renderTegel({ blockId: "customers", summary });
    const el = screen.getByTestId("tegel-summary-customers");
    expect(el).toHaveTextContent("9 dimensies");
    expect(el).toHaveTextContent("12 items");
    expect(el).toHaveTextContent("7 pijnpunten");
    expect(el).toHaveTextContent("3 in roadmap");
    expect(el).toHaveTextContent(/Cluster: SME-conversie blijft achter/);
  });

  test("2. klanten leeg (alle 0) toont empty-state-tekst", async () => {
    const summary = { klanten: { dimensies: 0, items: 0, pijnpunten: 0, verbeteracties_roadmap: 0 } };
    await renderTegel({ blockId: "customers", summary });
    expect(screen.getByTestId("tegel-summary-customers")).toHaveTextContent(/Nog leeg/);
  });

  test("3. strategie met identiteit-velden + thema's toont counts", async () => {
    const summary = {
      strategie: {
        themas: 3,
        missie_filled: true, visie_filled: true, ambitie_filled: false,
        samenvatting_filled: true,
        last_thema_title: "Klantgerichtheid versterken",
      },
    };
    await renderTegel({ blockId: "strategy", summary });
    const el = screen.getByTestId("tegel-summary-strategy");
    expect(el).toHaveTextContent("3/4 identiteit");
    expect(el).toHaveTextContent("3 thema's");
    expect(el).toHaveTextContent(/Klantgerichtheid versterken/);
  });

  test("4. strategie leeg toont empty-state-tekst", async () => {
    const summary = { strategie: { themas: 0, missie_filled: false, visie_filled: false, ambitie_filled: false, samenvatting_filled: false } };
    await renderTegel({ blockId: "strategy", summary });
    expect(screen.getByTestId("tegel-summary-strategy")).toHaveTextContent(/Nog leeg/);
  });

  test("5. richtlijnen met count + title toont counts + quote", async () => {
    const summary = { richtlijnen: { count: 5, last_title: "Klant centraal bij elk besluit" } };
    await renderTegel({ blockId: "principles", summary });
    const el = screen.getByTestId("tegel-summary-principles");
    expect(el).toHaveTextContent("5 richtlijnen");
    expect(el).toHaveTextContent(/Klant centraal bij elk besluit/);
  });

  test("6. niet-gebouwde werkbladen tonen stub-tekst", async () => {
    for (const id of ["processes", "people", "technology", "portfolio"]) {
      const result = await renderTegel({ blockId: id, summary: null });
      expect(screen.getByTestId(`tegel-summary-${id}`)).toHaveTextContent(/Werkblad komt later/);
      result.unmount();
    }
  });

  test("7. last_pattern_text > 100 chars wordt getrunceerd met ellipsis", async () => {
    const longText = "Dit is een hele lange pattern-tekst die ver boven de 100 character grens uit gaat zodat we kunnen verifiëren dat de truncation correct werkt met een ellipsis aan het einde.";
    const summary = {
      klanten: { dimensies: 1, items: 0, pijnpunten: 0, verbeteracties_roadmap: 0, last_pattern_text: longText },
    };
    await renderTegel({ blockId: "customers", summary });
    const el = screen.getByTestId("tegel-summary-customers");
    expect(el.textContent).toMatch(/…/);
    // Quote-substring na truncate < 102 chars (100 + " character" margin)
    const quoteMatch = el.textContent.match(/"[^"]*"/);
    expect(quoteMatch).not.toBeNull();
    expect(quoteMatch[0].length).toBeLessThanOrEqual(102);
  });
});
