/**
 * S3 design-systeem — RTL voor `WerkbladActieknoppen` shared component.
 *
 * Dekt het S2/S3-precedent: Analyse-knop is **optioneel** — bij `onAnalyse`
 * `null`/`undefined` rendert de knop niet. Inzichten + Rapportage rendere
 * altijd. Designer §7 punt 2: "Analyse draaien weg uit werkblad-header,
 * verhuist naar Inzichten-scherm".
 *
 * Optie A-pattern: geen externe Provider nodig, component is pure UI.
 * appLabel-prop optioneel — fallbacks inline.
 *
 * Cases:
 *  1. Zonder onAnalyse-prop → Analyse-knop niet aanwezig (S2/S3-pattern)
 *  2. Met onAnalyse-prop → Analyse-knop wel aanwezig (Strategie tot S2-fix)
 *  3. Inzichten + Rapportage altijd aanwezig
 *  4. Klik Inzichten → onBekijken callback
 *  5. Klik Rapportage → onRapportage callback
 *  6. bekijkenDisabled=true → Inzichten disabled
 *  7. analysing=true + onAnalyse → Analyse-knop disabled
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import WerkbladActieknoppen from "../WerkbladActieknoppen";

describe("WerkbladActieknoppen — S3 Analyse-knop optioneel", () => {
  test("1. zonder onAnalyse → Analyse-knop niet aanwezig (S3 Richtlijnen-pattern)", () => {
    render(
      <WerkbladActieknoppen
        onBekijken={() => {}}
        onRapportage={() => {}}
        bekijkenDisabled={false}
      />
    );
    expect(screen.queryByTestId("werkblad-actie-analyse")).not.toBeInTheDocument();
    expect(screen.getByTestId("werkblad-actie-inzichten")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-actie-rapportage")).toBeInTheDocument();
  });

  test("2. met onAnalyse → Analyse-knop wel aanwezig (backwards-compat)", () => {
    render(
      <WerkbladActieknoppen
        onAnalyse={() => {}}
        onBekijken={() => {}}
        onRapportage={() => {}}
        analyseLabel="Analyse draaien"
        bekijkenDisabled={false}
      />
    );
    expect(screen.getByTestId("werkblad-actie-analyse")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-actie-analyse")).toHaveTextContent(/Analyse draaien/);
  });

  test("3. Inzichten + Rapportage altijd aanwezig (Richtlijnen+Strategie consistent)", () => {
    render(
      <WerkbladActieknoppen
        onBekijken={() => {}}
        onRapportage={() => {}}
      />
    );
    expect(screen.getByTestId("werkblad-actie-inzichten")).toBeInTheDocument();
    expect(screen.getByTestId("werkblad-actie-rapportage")).toBeInTheDocument();
  });

  test("4. klik Inzichten → onBekijken callback", () => {
    const onBekijken = jest.fn();
    render(
      <WerkbladActieknoppen
        onBekijken={onBekijken}
        onRapportage={() => {}}
        bekijkenDisabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("werkblad-actie-inzichten"));
    expect(onBekijken).toHaveBeenCalledTimes(1);
  });

  test("5. klik Rapportage → onRapportage callback", () => {
    const onRapportage = jest.fn();
    render(
      <WerkbladActieknoppen
        onBekijken={() => {}}
        onRapportage={onRapportage}
      />
    );
    fireEvent.click(screen.getByTestId("werkblad-actie-rapportage"));
    expect(onRapportage).toHaveBeenCalledTimes(1);
  });

  test("6. bekijkenDisabled=true → Inzichten disabled, callback geblokkeerd", () => {
    const onBekijken = jest.fn();
    render(
      <WerkbladActieknoppen
        onBekijken={onBekijken}
        onRapportage={() => {}}
        bekijkenDisabled={true}
      />
    );
    const knop = screen.getByTestId("werkblad-actie-inzichten");
    expect(knop).toBeDisabled();
    fireEvent.click(knop);
    expect(onBekijken).not.toHaveBeenCalled();
  });

  test("7. analysing=true → Analyse-knop disabled, callback geblokkeerd", () => {
    const onAnalyse = jest.fn();
    render(
      <WerkbladActieknoppen
        onAnalyse={onAnalyse}
        onBekijken={() => {}}
        onRapportage={() => {}}
        analyseLabel="Analyseren…"
        analysing={true}
      />
    );
    const knop = screen.getByTestId("werkblad-actie-analyse");
    expect(knop).toBeDisabled();
    fireEvent.click(knop);
    expect(onAnalyse).not.toHaveBeenCalled();
  });
});
