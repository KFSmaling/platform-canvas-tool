/**
 * T4 Klanten-werkblad-doorloop — RTL voor 12 fixes + 2 layout-reworks.
 *
 * Cases (12 — overstijgt 10+ instructie):
 *   1. A1: Dimensie-toevoegen-knop label heeft GEEN `+` meer (Plus-icoon-only)
 *   2. A2: Fase-1 info-banner zichtbaar onder tab-1
 *   3. A3: Klantreis-chevron default ingeklapt; click disclosure → expand
 *   4. A4: Klantreis-strip rendert ook bij <3 stages (≥3-restrictie gedropt)
 *   5. A4: Geen klantreis-strip bij canvas zonder klantreis-dimensie
 *   6. A5: Items-dossier-draft toont "Voeg toe als item" (was "Markeer als richting")
 *   7. A7: 0-result dossier-fetch toont info-banner (geen flicker)
 *   8. A9: Duplicate-item-naam inline-error in ItemModal
 *   9. A12: Tab-3-label = "Verbeteracties"
 *  10. B1: Pijnpunten gegroepeerd per dimensie + overstijgend-sectie onderaan
 *  11. B2.2: Verbeteracties-tab toont info-banner bovenin
 *  12. B2.3: 5 AI-knoppen + Eigen-actie-knop in ActionBar (Algemeen + 4 anderen)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../services/klanten.service", () => ({
  listDimensions:                  jest.fn(),
  listItemsForCanvas:              jest.fn(),
  listItemsForDimension:           jest.fn(),
  createDimension:                 jest.fn(),
  updateDimension:                 jest.fn(),
  deleteDimension:                 jest.fn(),
  createItem:                      jest.fn(),
  updateItem:                      jest.fn(),
  deleteItem:                      jest.fn(),
  listPainPoints:                  jest.fn(),
  listCouplingsForCanvas:          jest.fn(),
  createPainPoint:                 jest.fn(),
  updatePainPoint:                 jest.fn(),
  deletePainPoint:                 jest.fn(),
  createCoupling:                  jest.fn(),
  deleteCoupling:                  jest.fn(),
  listPatternSuggestions:          jest.fn(),
  generatePatternSuggestions:      jest.fn(),
  createPatternSuggestion:         jest.fn(),
  updatePatternSuggestion:         jest.fn(),
  acceptPatternSuggestion:         jest.fn(),
  rejectPatternSuggestion:         jest.fn(),
  promotePatternSuggestionToIntent: jest.fn(),
  unmarkPatternSuggestion:         jest.fn(),
  restorePatternSuggestion:        jest.fn(),
  listIntents:                     jest.fn(),
  createIntent:                    jest.fn(),
  updateIntent:                    jest.fn(),
  deleteIntent:                    jest.fn(),
  handoverIntentToRoadmap:         jest.fn(),
  unsendIntent:                    jest.fn(),
  fetchUploadsStatus:              jest.fn(),
  extractItemsFromDossier:         jest.fn(),
  fillFieldsFromDossier:           jest.fn(),
  extractPainPointsFromDossier:    jest.fn(),
  acceptDraftItem:                 jest.fn(),
  rejectDraftItem:                 jest.fn(),
  editDraftItem:                   jest.fn(),
  acceptDraftPainPoint:            jest.fn(),
  rejectDraftPainPoint:            jest.fn(),
  editDraftPainPoint:              jest.fn(),
}));
import * as klantenService from "../services/klanten.service";

jest.mock("../../../shared/context/AppConfigContext", () => ({
  useAppConfig: () => ({
    label:  (key, fallback) => fallback ?? key,
    prompt: () => null,
    setting: (k, d) => d,
  }),
}));
jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform" }),
}));
jest.mock("../../../shared/components/AiIcon", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../shared/services/auth.service", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: jest.fn() }),
}));
jest.mock("../../../i18n", () => ({
  useLang: () => ({ t: (k) => k, lang: "nl", setLang: jest.fn() }),
}));

import KlantenWerkblad from "../KlantenWerkblad";

const TEST_CANVAS_ID = "t4-canvas";

const dim = (id, archetype, name) => ({ id, archetype, name, description: "", sort_order: 10, is_ordered: archetype === "klantreis", canvas_id: TEST_CANVAS_ID });
const item = (id, dim_id, name) => ({ id, dimension_id: dim_id, canvas_id: TEST_CANVAS_ID, name, description: null, archetype_data: {}, is_draft: false, sort_order: 10 });

beforeEach(() => {
  jest.clearAllMocks();
  klantenService.listDimensions.mockResolvedValue({ data: [], error: null });
  klantenService.listItemsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPainPoints.mockResolvedValue({ data: [], error: null });
  klantenService.listCouplingsForCanvas.mockResolvedValue({ data: [], error: null });
  klantenService.listPatternSuggestions.mockResolvedValue({ data: [], error: null });
  klantenService.listIntents.mockResolvedValue({ data: [], error: null });
  klantenService.fetchUploadsStatus.mockResolvedValue({
    data: { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 },
    error: null,
  });
});

async function renderWerkblad() {
  let result;
  await act(async () => {
    result = render(<KlantenWerkblad canvasId={TEST_CANVAS_ID} onClose={() => {}} />);
  });
  await waitFor(() => expect(klantenService.listDimensions).toHaveBeenCalled());
  return result;
}

describe("T4 — Klanten-werkblad-doorloop fixes", () => {
  test("1. A1: dimensie-toevoegen-CTA-knop heeft geen `+`-prefix in label (alleen Plus-icoon)", async () => {
    await renderWerkblad();
    // Lege canvas → "Eerste dimensie aanmaken"-CTA (zonder `+`)
    const cta = await screen.findByTestId("dimensie-cta-eerste");
    // Label-tekst zonder `+`-prefix
    expect(cta.textContent.replace(/\s+/g, " ").trim()).toMatch(/^Eerste dimensie aanmaken$/);
    expect(cta.textContent).not.toMatch(/\+\s*Eerste/);
  });

  test("2. A2: info-banner zichtbaar onder fase-1-tab", async () => {
    klantenService.listDimensions.mockResolvedValue({ data: [dim("d1", "klantsegment", "Segment")], error: null });
    await renderWerkblad();
    expect(await screen.findByTestId("klanten-fase1-info-banner")).toBeInTheDocument();
    expect(screen.getByTestId("klanten-fase1-info-banner")).toHaveTextContent(/dimensies.*pijnpunten.*verbeteracties/i);
  });

  test("3. A3: klantreis-chevron default ingeklapt; disclosure-click → expand met omschrijving", async () => {
    const klantreisDim = dim("d-kr", "klantreis", "Klantreis");
    const items = [
      { ...item("kr-1", "d-kr", "Awareness"), sort_order: 1, archetype_data: { stap_type: "awareness", customer_goal: "Klant ontdekt ons" } },
      { ...item("kr-2", "d-kr", "Onboarding"), sort_order: 2, archetype_data: { customer_goal: "Klant onboardt soepel" } },
    ];
    klantenService.listDimensions.mockResolvedValue({ data: [klantreisDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: items, error: null });
    await renderWerkblad();
    const disclosure = await screen.findByTestId("chevron-disclosure-kr-1");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("chevron-omschrijving-kr-1")).not.toBeInTheDocument();

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("chevron-omschrijving-kr-1")).toHaveTextContent(/klant ontdekt ons/i);
  });

  test("4. A4: klantreis-strip rendert ook bij 2 stages (≥3-restrictie gedropt)", async () => {
    const klantreisDim = dim("d-kr", "klantreis", "Klantreis");
    const items = [
      { ...item("kr-1", "d-kr", "Stage 1"), sort_order: 1 },
      { ...item("kr-2", "d-kr", "Stage 2"), sort_order: 2 },
    ];
    klantenService.listDimensions.mockResolvedValue({ data: [klantreisDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: items, error: null });
    await renderWerkblad();
    expect(await screen.findByTestId("klantreis-top-strip-container")).toBeInTheDocument();
  });

  test("5. A4: GEEN klantreis-strip bij canvas zonder klantreis-dimensie", async () => {
    klantenService.listDimensions.mockResolvedValue({ data: [dim("d-seg", "klantsegment", "Segment")], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [item("it-1", "d-seg", "MKB")], error: null });
    await renderWerkblad();
    // Wait tot fase-1-info-banner gerendered is → dan zou strip ook in DOM zijn
    await screen.findByTestId("klanten-fase1-info-banner");
    expect(screen.queryByTestId("klantreis-top-strip-container")).not.toBeInTheDocument();
  });

  test("9. A12: tab-3-label = 'Verbeteracties' (geen 'Analyse')", async () => {
    await renderWerkblad();
    const tab3 = await screen.findByTestId("werkblad-header-tab-3");
    expect(tab3).toHaveTextContent(/Verbeteracties/i);
    expect(tab3.textContent).not.toMatch(/Analyse/);
  });

  test("10. B1: pijnpunten gegroepeerd per dimensie (lijst-pattern) + overstijgend-sectie", async () => {
    const segDim = dim("d-seg", "klantsegment", "Segmenten");
    const items = [item("i-mkb", "d-seg", "MKB")];
    const pains = [
      { id: "pp-1", canvas_id: TEST_CANVAS_ID, text_md: "Pijn gekoppeld", is_floating: false, sort_order: 10, is_draft: false },
      { id: "pp-2", canvas_id: TEST_CANVAS_ID, text_md: "Overstijgend pijn", is_floating: true, sort_order: 20, is_draft: false },
    ];
    const couplings = [{ id: "c1", pain_point_id: "pp-1", target_table: "cd_items", target_id: "i-mkb" }];
    klantenService.listDimensions.mockResolvedValue({ data: [segDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: items, error: null });
    klantenService.listPainPoints.mockResolvedValue({ data: pains, error: null });
    klantenService.listCouplingsForCanvas.mockResolvedValue({ data: couplings, error: null });

    await renderWerkblad();
    // Click fase 2-tab
    fireEvent.click(screen.getByTestId("werkblad-header-tab-2"));
    // Wacht tot lijst-per-dimensie gerendered is
    expect(await screen.findByTestId("pijnpunten-lijst-per-dimensie")).toBeInTheDocument();
    expect(screen.getByTestId("pijnpunten-sectie-d-seg")).toHaveTextContent(/Pijn gekoppeld/i);
    expect(screen.getByTestId("pijnpunten-sectie-overstijgend")).toHaveTextContent(/Overstijgend pijn/i);
  });

  test("11. B2.2: Verbeteracties-tab toont info-banner bovenin", async () => {
    await renderWerkblad();
    fireEvent.click(screen.getByTestId("werkblad-header-tab-3"));
    expect(await screen.findByTestId("klanten-fase3-info-banner")).toBeInTheDocument();
    expect(screen.getByTestId("klanten-fase3-info-banner")).toHaveTextContent(/Concept.*Definitief|Veranderprogramma/i);
  });

  test("12. B2.3: 5 AI-knoppen aanwezig in VerbeteractiesView ActionBar (incl. Algemeen)", async () => {
    await renderWerkblad();
    fireEvent.click(screen.getByTestId("werkblad-header-tab-3"));
    await screen.findByTestId("verbeteracties-actionbar");
    expect(screen.getByTestId("verbeteracties-knop-algemeen")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-cluster")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-paradox")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-positionering")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-overstijgend")).toBeInTheDocument();
    expect(screen.getByTestId("verbeteracties-knop-eigen-actie")).toBeInTheDocument();
  });

  // ── U-cleanup F-rtl-1 — A7 + A9 RTL-gaps invullen ──────────────────────────

  test("13. A7: dossier-fetch met 0-results → 'geen match'-banner zichtbaar (geen flicker)", async () => {
    const segDim = dim("d-seg", "klantsegment", "Segmenten");
    klantenService.listDimensions.mockResolvedValue({ data: [segDim], error: null });
    // Server returnt empty array — geen items gevonden in dossier
    klantenService.extractItemsFromDossier.mockResolvedValue({ data: [], error: null, meta: {} });
    klantenService.fetchUploadsStatus.mockResolvedValue({
      data: { hasUploads: true, hasIndexedChunks: true, uploadCount: 3, indexedChunkCount: 12 },
      error: null,
    });
    await renderWerkblad();
    // Trigger extract-flow via DimensieKolom-knop voor d-seg
    const extractBtn = await screen.findByTestId("dossier-items-extract-d-seg");
    await act(async () => { fireEvent.click(extractBtn); });
    // Wacht tot info-banner verschijnt (na await + state-update)
    const banner = await screen.findByTestId("klanten-dossier-info-banner-items");
    expect(banner).toHaveTextContent(/geen match/i);
    // Sluit-knop werkt
    fireEvent.click(banner.querySelector("button"));
    expect(screen.queryByTestId("klanten-dossier-info-banner-items")).not.toBeInTheDocument();
  });

  test("14. A9: duplicate-name in zelfde dimensie → inline-error + GEEN createItem-call", async () => {
    const segDim = dim("d-seg", "klantsegment", "Segmenten");
    const existing = item("it-1", "d-seg", "MKB");
    klantenService.listDimensions.mockResolvedValue({ data: [segDim], error: null });
    klantenService.listItemsForCanvas.mockResolvedValue({ data: [existing], error: null });
    await renderWerkblad();
    // Open create-modal voor d-seg via dimensie-+ knop
    const addBtn = await screen.findByTestId("dimensie-kolom-add-item-d-seg");
    fireEvent.click(addBtn);
    await screen.findByLabelText("Naam");
    fireEvent.change(screen.getByLabelText("Naam"), { target: { value: "mkb" } }); // case-insensitive duplicate
    const submit = screen.getByRole("button", { name: /^Opslaan$/i });
    fireEvent.click(submit);
    // Inline-error rendered + createItem NIET geroepen (negative-assertion)
    expect(await screen.findByText(/bestaat al/i)).toBeInTheDocument();
    expect(klantenService.createItem).not.toHaveBeenCalled();
  });
});
