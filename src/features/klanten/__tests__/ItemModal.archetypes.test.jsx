/**
 * Stap 11.I.1 — RTL voor 5 lichte archetypes (regio + behoefte + merk +
 * gedragspatroon + anders).
 *
 * Geïsoleerde tests: ItemModal direct gerenderd met mock-props zonder
 * KlantenWerkblad-flow. Anker-pattern: ItemModal.flow.test.jsx (11.K.2 F17).
 *
 * Test-cases (7):
 *  1. regio-archetype → 3 velden gerenderd met juiste labels
 *  2. behoefte-archetype → 4 velden (JTBD-frame)
 *  3. merk-archetype → 4 velden
 *  4. gedragspatroon-archetype → 4 velden
 *  5. anders-archetype → 4 key+value-paren-formulier (custom_pairs)
 *  6. anders-save → vrije_velden bevat alleen non-lege paren (lege gefilterd)
 *  7. anders-save met max 4 paren → 5e veld niet zichtbaar in UI
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import ItemModal from "../ItemModal";

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label: (key, fallback) => fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

function makeDim(archetype) {
  return { id: `dim-${archetype}`, archetype, name: `${archetype}-test` };
}

function makeProps({ dimension, item = null, onSave = jest.fn(async () => ({ error: null })) }) {
  return {
    item,
    dimension,
    onClose: jest.fn(),
    onSave,
  };
}

describe("ItemModal — 5 lichte archetypes (stap 11.I.1)", () => {
  test("1. regio-archetype → 3 velden gerenderd (geografie, marktgrootte, lokale_kenmerken)", () => {
    render(<ItemModal {...makeProps({ dimension: makeDim("regio") })} />);
    expect(screen.getByText("Geografie")).toBeInTheDocument();
    expect(screen.getByText("Marktgrootte")).toBeInTheDocument();
    expect(screen.getByText("Lokale kenmerken")).toBeInTheDocument();
  });

  test("2. behoefte-archetype → 4 velden gerenderd (JTBD-frame)", () => {
    render(<ItemModal {...makeProps({ dimension: makeDim("behoefte") })} />);
    expect(screen.getByText("Job to be done")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Bestaande oplossingen")).toBeInTheDocument();
    expect(screen.getByText("Frustraties")).toBeInTheDocument();
  });

  test("3. merk-archetype → 4 velden gerenderd", () => {
    render(<ItemModal {...makeProps({ dimension: makeDim("merk") })} />);
    expect(screen.getByText("Positionering")).toBeInTheDocument();
    expect(screen.getByText("Belofte")).toBeInTheDocument();
    expect(screen.getByText("Doelgroep")).toBeInTheDocument();
    expect(screen.getByText("Relatie tot andere merken")).toBeInTheDocument();
  });

  test("4. gedragspatroon-archetype → 4 velden gerenderd", () => {
    render(<ItemModal {...makeProps({ dimension: makeDim("gedragspatroon") })} />);
    expect(screen.getByText("Intensiteit")).toBeInTheDocument();
    expect(screen.getByText("Loyaliteit")).toBeInTheDocument();
    expect(screen.getByText("Koopgedrag")).toBeInTheDocument();
    expect(screen.getByText("Digitale volwassenheid")).toBeInTheDocument();
  });

  test("5. anders-archetype → 4 key+value-paren gerenderd via CustomPairsField", () => {
    render(<ItemModal {...makeProps({ dimension: makeDim("anders") })} />);
    expect(screen.getByTestId("custom-pairs-vrije_velden")).toBeInTheDocument();
    // 4 key-inputs + 4 value-inputs
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`custom-pairs-key-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`custom-pairs-value-${i}`)).toBeInTheDocument();
    }
    // GEEN 5e paar
    expect(screen.queryByTestId("custom-pairs-key-4")).not.toBeInTheDocument();
    expect(screen.queryByTestId("custom-pairs-value-4")).not.toBeInTheDocument();
  });

  test("6. anders-save → vrije_velden bevat alleen non-lege paren (lege gefilterd)", async () => {
    const onSave = jest.fn(async () => ({ error: null }));
    render(<ItemModal {...makeProps({ dimension: makeDim("anders"), onSave })} />);

    // Vul naam (verplicht)
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Custom item" } });

    // Pair 0: ingevuld
    fireEvent.change(screen.getByTestId("custom-pairs-key-0"),   { target: { value: "regio" } });
    fireEvent.change(screen.getByTestId("custom-pairs-value-0"), { target: { value: "Randstad" } });
    // Pair 1: leeg → moet gefilterd worden
    // Pair 2: alleen waarde → key leeg → moet gefilterd worden (geen key, geen save)
    fireEvent.change(screen.getByTestId("custom-pairs-value-2"), { target: { value: "verweesd" } });
    // Pair 3: ingevuld
    fireEvent.change(screen.getByTestId("custom-pairs-key-3"),   { target: { value: "leeftijdsgroep" } });
    fireEvent.change(screen.getByTestId("custom-pairs-value-3"), { target: { value: "55+" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i })); });

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedPayload = onSave.mock.calls[0][0];
    expect(savedPayload.archetype_data.vrije_velden).toEqual({
      regio: "Randstad",
      leeftijdsgroep: "55+",
    });
    // Pair-2 (verweesd value zonder key) is NIET aanwezig
    expect(Object.keys(savedPayload.archetype_data.vrije_velden)).toHaveLength(2);
  });

  test("7. anders-edit → bestaande vrije_velden vooringevuld in juiste paren", () => {
    const item = {
      id: "it-1",
      dimension_id: "dim-anders",
      canvas_id: "cv-1",
      name: "Bestaand",
      description: null,
      archetype_data: { vrije_velden: { team: "Sales NL", tier: "A-klant" } },
      is_draft: false,
      sort_order: 10,
    };
    render(<ItemModal {...makeProps({ dimension: makeDim("anders"), item })} />);

    // Eerste twee paren gevuld, paren 2-3 leeg
    expect(screen.getByTestId("custom-pairs-key-0")).toHaveValue("team");
    expect(screen.getByTestId("custom-pairs-value-0")).toHaveValue("Sales NL");
    expect(screen.getByTestId("custom-pairs-key-1")).toHaveValue("tier");
    expect(screen.getByTestId("custom-pairs-value-1")).toHaveValue("A-klant");
    expect(screen.getByTestId("custom-pairs-key-2")).toHaveValue("");
    expect(screen.getByTestId("custom-pairs-value-2")).toHaveValue("");
    expect(screen.getByTestId("custom-pairs-key-3")).toHaveValue("");
    expect(screen.getByTestId("custom-pairs-value-3")).toHaveValue("");
  });
});
