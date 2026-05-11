/**
 * Stap 11.I.2 — RTL voor klantreis-archetype Scope A.
 *
 * Geïsoleerde tests: ItemModal direct gerenderd met mock-props + mock voor
 * useAppConfig (inclusief enumValue-resolver). Anker-pattern:
 * ItemModal.archetypes.test.jsx (11.I.1) + ItemModal.flow.test.jsx (11.K.2 F17).
 *
 * Test-cases (8):
 *  1. klantreis-archetype rendert alle 12 velden in betekenisvolle volgorde
 *  2. stap_type-dropdown toont 9 opties uit mocked enum.klanten.klantreis.stap_type
 *  3. Strategische-weging-blok zichtbaar met data-denkdwang="asymmetrie"
 *  4. MoT-toggle togglet `is_moment_of_truth` true/false
 *  5. weight_multiplier numeric-input met sensible default 1.0
 *  6. silent_period_risk conditional — verborgen wanneer is_silent_period=false,
 *     zichtbaar na toggle
 *  7. dmu tag_list save: input "klant, adviseur, verzekeraar" →
 *     archetype_data.dmu = ["klant", "adviseur", "verzekeraar"]
 *  8. emotions tag_list edit: bestaande array rendert als comma-joined text
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import ItemModal from "../ItemModal";

const MOCK_STAP_TYPES = [
  "trigger_life_event", "orientatie", "quote_aanvraag",
  "underwriting", "closing_polis", "onboarding",
  "servicing_in_life", "claim_schade", "renewal_churn_advocacy",
];

const STAP_TYPE_LABELS = {
  "klanten.klantreis.stap_type.trigger_life_event":     "1. Life Event Trigger",
  "klanten.klantreis.stap_type.orientatie":             "2. Awareness & Oriëntatie",
  "klanten.klantreis.stap_type.quote_aanvraag":         "3. Quote & Aanvraag",
  "klanten.klantreis.stap_type.underwriting":           "4. Underwriting & Acceptatie",
  "klanten.klantreis.stap_type.closing_polis":          "5. Closing & Polis",
  "klanten.klantreis.stap_type.onboarding":             "6. Onboarding",
  "klanten.klantreis.stap_type.servicing_in_life":      "7. Servicing & In-life",
  "klanten.klantreis.stap_type.claim_schade":           "8. Claim / Schade",
  "klanten.klantreis.stap_type.renewal_churn_advocacy": "9. Renewal / Churn / Advocacy",
};

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label: (key, fallback) => STAP_TYPE_LABELS[key] ?? fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
    enum: (key, defaultVal = []) => {
      if (key === "enum.klanten.klantreis.stap_type") return MOCK_STAP_TYPES;
      return defaultVal;
    },
  }),
}));

const klantreisDim = { id: "dim-kr", archetype: "klantreis", name: "Verzekerings-klantreis" };

function makeProps({ item = null, onSave = jest.fn(async () => ({ error: null })) } = {}) {
  return {
    item,
    dimension: klantreisDim,
    onClose: jest.fn(),
    onSave,
  };
}

describe("ItemModal — klantreis-archetype Scope A (stap 11.I.2)", () => {
  test("1. klantreis rendert alle 12 velden in betekenisvolle volgorde", () => {
    render(<ItemModal {...makeProps()} />);
    // Wat — kern
    expect(screen.getByTestId("field-stap_type")).toBeInTheDocument();
    expect(screen.getByTestId("field-customer_goal")).toBeInTheDocument();
    // Hoe — touchpoints/dmu/emotions/kpis
    expect(screen.getByTestId("field-touchpoints")).toBeInTheDocument();
    expect(screen.getByTestId("field-dmu")).toBeInTheDocument();
    expect(screen.getByTestId("field-emotions")).toBeInTheDocument();
    expect(screen.getByTestId("field-kpis")).toBeInTheDocument();
    // Strategisch — eigen blok
    expect(screen.getByTestId("strategische-weging-blok")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-is_moment_of_truth")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-is_silent_period")).toBeInTheDocument();
    expect(screen.getByTestId("field-weight_multiplier")).toBeInTheDocument();
    // silent_period_risk verborgen omdat is_silent_period=false (default)
    expect(screen.queryByTestId("field-silent_period_risk")).not.toBeInTheDocument();
    expect(screen.getByTestId("field-regulatoire_context")).toBeInTheDocument();
    expect(screen.getByTestId("field-insight")).toBeInTheDocument();
  });

  test("2. stap_type-dropdown toont 9 opties uit mocked enum", () => {
    render(<ItemModal {...makeProps()} />);
    const dropdown = screen.getByTestId("field-stap_type").querySelector("select");
    expect(dropdown).toBeInTheDocument();
    // 9 opties + 1 placeholder "— kies —"
    expect(dropdown.options).toHaveLength(10);
    expect(dropdown.options[1].value).toBe("trigger_life_event");
    expect(dropdown.options[1].textContent).toBe("1. Life Event Trigger");
    expect(dropdown.options[9].value).toBe("renewal_churn_advocacy");
    expect(dropdown.options[9].textContent).toBe("9. Renewal / Churn / Advocacy");
  });

  test("3. Strategische-weging-blok heeft data-denkdwang='asymmetrie' (80/20-principe)", () => {
    render(<ItemModal {...makeProps()} />);
    const blok = screen.getByTestId("strategische-weging-blok");
    expect(blok).toHaveAttribute("data-denkdwang", "asymmetrie");
  });

  test("4. MoT-toggle togglet is_moment_of_truth state via setField", async () => {
    const onSave = jest.fn(async () => ({ error: null }));
    render(<ItemModal {...makeProps({ onSave })} />);
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Stage X" } });

    const motToggle = screen.getByTestId("toggle-is_moment_of_truth");
    expect(motToggle).toHaveAttribute("data-active", "false");
    await act(async () => { fireEvent.click(motToggle); });
    expect(motToggle).toHaveAttribute("data-active", "true");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i })); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].archetype_data.is_moment_of_truth).toBe(true);
  });

  test("5. weight_multiplier numeric-input met default 1.0 + user kan tunen naar 3.0", async () => {
    const onSave = jest.fn(async () => ({ error: null }));
    render(<ItemModal {...makeProps({ onSave })} />);
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Claim stage" } });

    const weightInput = screen.getByTestId("field-weight_multiplier").querySelector("input[type='number']");
    expect(weightInput).toBeInTheDocument();
    expect(weightInput).toHaveValue(1);  // default

    await act(async () => { fireEvent.change(weightInput, { target: { value: "3" } }); });
    expect(weightInput).toHaveValue(3);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i })); });
    expect(onSave.mock.calls[0][0].archetype_data.weight_multiplier).toBe(3);
  });

  test("6. silent_period_risk conditional — toggle is_silent_period maakt veld zichtbaar", async () => {
    render(<ItemModal {...makeProps()} />);
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Servicing stage" } });

    // Initial: verborgen
    expect(screen.queryByTestId("field-silent_period_risk")).not.toBeInTheDocument();

    // Toggle Silent Period aan
    await act(async () => { fireEvent.click(screen.getByTestId("toggle-is_silent_period")); });

    // Nu zichtbaar
    expect(screen.getByTestId("field-silent_period_risk")).toBeInTheDocument();
  });

  test("7. dmu tag_list save → archetype_data.dmu = array van rollen", async () => {
    const onSave = jest.fn(async () => ({ error: null }));
    render(<ItemModal {...makeProps({ onSave })} />);
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "Claim" } });

    const dmuInput = screen.getByTestId("field-dmu").querySelector("input[type='text']");
    await act(async () => {
      fireEvent.change(dmuInput, { target: { value: "klant, adviseur, verzekeraar" } });
    });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/i })); });
    expect(onSave.mock.calls[0][0].archetype_data.dmu).toEqual(["klant", "adviseur", "verzekeraar"]);
  });

  test("8. emotions tag_list edit-mode → bestaande array rendert als comma-joined text", () => {
    const item = {
      id: "kr-1",
      dimension_id: "dim-kr",
      canvas_id: "cv-1",
      name: "Stage 1",
      description: null,
      archetype_data: { emotions: ["onzeker", "soms gestrest"] },
      is_draft: false,
      sort_order: 10,
    };
    render(<ItemModal {...makeProps({ item })} />);
    const emotionsInput = screen.getByTestId("field-emotions").querySelector("input[type='text']");
    expect(emotionsInput).toHaveValue("onzeker, soms gestrest");
  });
});
