/**
 * T3 Richtlijnen-werkblad-doorloop — RTL voor categorie-tabs + uitklap-pattern.
 *
 * Cases (8 — overstijgt 6+ instructie):
 *   1. 5 categorie-tabs render (Generiek/Klanten/Processen/Mensen/IT)
 *   2. Counter-pill per tab toont juiste guideline-aantal
 *   3. Active tab default = generiek; klik op niet-active wisselt activeSegment
 *   4. Genereer-principes-knop zichtbaar in tab-balk voor active segment
 *   5. Info-banner per tab render met juiste tekst voor active segment
 *   6. GuidelineKaart default collapsed (chevron-right, expanded content niet)
 *   7. Click toggle → expand (chevron-down, expanded content zichtbaar)
 *   8. "Strategische samenvatting"-label zichtbaar; "Stip op de Horizon" NIET
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock apiClient + supabase + heavy modals ──
jest.mock("../../../shared/services/apiClient", () => ({
  apiFetch: jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
}));
jest.mock("../../../shared/services/supabase.client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    }),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// AppConfig-fixture: realistic fallback voor T3-keys
const LABELS = {
  "label.richtl.segment.generiek":  "Generiek",
  "label.richtl.segment.klanten":   "Klanten & dienstverlening",
  "label.richtl.segment.processen": "Processen & organisatie",
  "label.richtl.segment.mensen":    "Mensen & competenties",
  "label.richtl.segment.it":        "Informatie & Technologie",
  "label.tips.richtlijnen.generiek.info":  "Principes voor de hele organisatie.",
  "label.tips.richtlijnen.klanten.info":   "Principes voor klanten & dienstverlening.",
  "label.tips.richtlijnen.processen.info": "Principes voor processen & organisatie.",
  "label.tips.richtlijnen.mensen.info":    "Principes voor mensen & competenties.",
  "label.tips.richtlijnen.it.info":        "Principes voor informatie & technologie.",
  "label.richtl.samenvatting.titel":       "Strategische samenvatting",
};

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label: (key, fallback) => {
      // Simuleert AppConfigContext.label() — prepended "label." en zoekt in fixture
      const fullKey = `label.${key}`;
      if (fullKey in LABELS) return LABELS[fullKey];
      return fallback ?? key;
    },
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));

jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform", logoUrl: null, logoWhiteUrl: null }),
}));

// Mock services voor data-load — gebruik Promise.resolve ipv jest.fn(async) want
// die laatste levert soms undefined-resolve in deze test-context (T1 + T3 obs).
jest.mock("../services/guidelines.service", () => ({
  __esModule: true,
  loadGuidelines: () => Promise.resolve({ data: [
    { id: "g1", canvas_id: "c1", segment: "generiek",  title: "Principe G1", description: "Beschrijving G1", linked_themes: [], implications: { stop: "", start: "", continue: "" } },
    { id: "g2", canvas_id: "c1", segment: "generiek",  title: "Principe G2", description: "",                linked_themes: [], implications: { stop: "", start: "", continue: "" } },
    { id: "g3", canvas_id: "c1", segment: "klanten",   title: "Principe K1", description: "",                linked_themes: [], implications: { stop: "", start: "", continue: "" } },
    { id: "g4", canvas_id: "c1", segment: "processen", title: "Principe P1", description: "",                linked_themes: [], implications: { stop: "", start: "", continue: "" } },
  ], error: null }),
  createGuideline: () => Promise.resolve({ data: {}, error: null }),
  updateGuideline: () => Promise.resolve({ data: {}, error: null }),
  deleteGuideline: () => Promise.resolve({ data: null, error: null }),
  loadGuidelineAnalysis:   () => Promise.resolve({ data: null, error: null }),
  upsertGuidelineAnalysis: () => Promise.resolve({ data: null, error: null }),
}));
jest.mock("../../strategie/services/strategy.service", () => ({
  __esModule: true,
  loadStrategyCore:    () => Promise.resolve({ data: { missie: "", visie: "", ambitie: "Onze ambitie", kernwaarden: [], samenvatting: "Samenvatting-tekst" }, error: null }),
  loadStrategicThemes: () => Promise.resolve({ data: [{ id: "t1", title: "Thema 1" }], error: null }),
}));
jest.mock("../../../shared/services/canvas.service", () => ({
  __esModule: true,
  loadCanvasById: () => Promise.resolve({ data: { id: "c1", name: "Test Canvas" }, error: null }),
}));

import RichtlijnenWerkblad from "../RichtlijnenWerkblad";

const TEST_CANVAS_ID = "c1";

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<RichtlijnenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
  });
  // Wacht tot tab-balk gerendered is (na isLoaded)
  await waitFor(() => expect(screen.queryByTestId("richtl-tab-balk")).toBeInTheDocument(), { timeout: 3000 });
  return result;
}

describe("T3 — Richtlijnen-werkblad categorie-tabs + uitklap-pattern", () => {
  test("1. 5 categorie-tabs render (Generiek/Klanten/Processen/Mensen/IT)", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("richtl-tab-generiek")).toBeInTheDocument();
    expect(screen.getByTestId("richtl-tab-klanten")).toBeInTheDocument();
    expect(screen.getByTestId("richtl-tab-processen")).toBeInTheDocument();
    expect(screen.getByTestId("richtl-tab-mensen")).toBeInTheDocument();
    expect(screen.getByTestId("richtl-tab-it")).toBeInTheDocument();
    // Geen 6e tab
    expect(screen.queryByTestId("richtl-tab-organisatie")).not.toBeInTheDocument();
  });

  test("2. Counter-pill per tab toont juiste aantal guidelines", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("richtl-tab-count-generiek")).toHaveTextContent("2");
    expect(screen.getByTestId("richtl-tab-count-klanten")).toHaveTextContent("1");
    expect(screen.getByTestId("richtl-tab-count-processen")).toHaveTextContent("1");
    expect(screen.getByTestId("richtl-tab-count-mensen")).toHaveTextContent("0");
    expect(screen.getByTestId("richtl-tab-count-it")).toHaveTextContent("0");
  });

  test("3. Active tab default = generiek; klik wisselt activeSegment", async () => {
    await renderWerkblad();
    const generiekTab = screen.getByTestId("richtl-tab-generiek");
    expect(generiekTab).toHaveAttribute("data-active", "true");

    fireEvent.click(screen.getByTestId("richtl-tab-klanten"));
    expect(screen.getByTestId("richtl-tab-klanten")).toHaveAttribute("data-active", "true");
    expect(generiekTab).toHaveAttribute("data-active", "false");
  });

  test("4. Genereer-principes-knop in tab-balk wisselt mee met active segment", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("richtl-tab-generate-generiek")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("richtl-tab-processen"));
    expect(screen.getByTestId("richtl-tab-generate-processen")).toBeInTheDocument();
    expect(screen.queryByTestId("richtl-tab-generate-generiek")).not.toBeInTheDocument();
  });

  test("5. Info-banner render voor active segment", async () => {
    await renderWerkblad();
    const banner = screen.getByTestId("richtl-info-banner-generiek");
    expect(banner).toHaveTextContent(/hele organisatie/i);
    fireEvent.click(screen.getByTestId("richtl-tab-mensen"));
    expect(screen.getByTestId("richtl-info-banner-mensen")).toHaveTextContent(/mensen & competenties/i);
    expect(screen.queryByTestId("richtl-info-banner-generiek")).not.toBeInTheDocument();
  });

  test("6. GuidelineKaart default collapsed (aria-expanded=false, geen toelichting zichtbaar)", async () => {
    await renderWerkblad();
    const toggle = screen.getByTestId("richtl-card-toggle-g1");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Expanded content (Toelichting-label) niet aanwezig in collapsed-state
    expect(screen.queryByText(/Toelichting & Motivatie/i)).not.toBeInTheDocument();
  });

  test("7. Click toggle → expand → Toelichting + Stop·Start·Continue zichtbaar", async () => {
    await renderWerkblad();
    fireEvent.click(screen.getByTestId("richtl-card-toggle-g1"));
    expect(screen.getByTestId("richtl-card-toggle-g1")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Toelichting & Motivatie/i)).toBeInTheDocument();
    // Stop · Start · Continue label kan op meer dan één plek staan (header +
    // expanded card). getAllByText accepteert beide.
    expect(screen.getAllByText(/Stop · Start · Continue/i).length).toBeGreaterThan(0);
  });

  test("8. 'Strategische samenvatting'-label aanwezig; 'Stip op de Horizon' NIET", async () => {
    await renderWerkblad();
    expect(screen.getByTestId("richtl-samenvatting-titel")).toHaveTextContent("Strategische samenvatting");
    expect(screen.queryByText(/Stip op de Horizon/i)).not.toBeInTheDocument();
  });
});
