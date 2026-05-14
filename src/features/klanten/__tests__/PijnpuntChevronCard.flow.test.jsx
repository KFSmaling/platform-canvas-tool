/**
 * F26-iteratie — RTL voor PijnpuntChevronCard + volle-breedte-strip-flow.
 *
 * Optie A-pattern: echte AppConfigProvider + mock-`supabase.rpc` zodat
 * label-resolver-pad volledig wordt geraakt (anti-mock-blind-spot per
 * Type 10 review-discipline).
 *
 * Cases:
 *  1. PijnpuntChevronCard rendert tekst + nummer-badge + stage-pill
 *  2. Multi-relationele chip "+ N dimensies" zichtbaar bij extraDimensieCount>0
 *  3. Click → onClick(pijnpunt) aangeroepen
 *  4. KlantreisTopStrip in WerkruimteView: 9 stages + 4 pijnpunten op klantreis
 *     → flow zichtbaar met 4 chevron-cards in stage-volgorde
 *  5. <3 klantreis-items → geen top-strip (fallback naar reguliere grid)
 *  6. Geen klantreis-dim → geen top-strip
 *  7. Multi-relationele pijnpunt (klantreis + andere dim) → chip zichtbaar +
 *     pijnpunt in klantreis-flow, NIET in andere-dims-grid
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

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

jest.mock("../../../shared/hooks/useTheme", () => ({
  useTheme: () => ({ brandName: "Platform" }),
}));

jest.mock("../../../shared/components/AiIcon", () => ({
  __esModule: true,
  default: () => null,
}));

import { supabase } from "../../../shared/services/supabase.client";
import { AppConfigProvider } from "../../../shared/context/AppConfigContext";
import PijnpuntChevronCard from "../PijnpuntChevronCard";
import WerkruimteView from "../WerkruimteView";

const rpcMock = supabase.rpc;

const CONFIG_ROWS = [
  { key: "label.klanten.pijnpunt.stage_koppeling.prefix",      value: "stap", category: "label", tenant_id: null },
  { key: "label.klanten.pijnpunt.multi_relationeel.prefix",    value: "+ {N} dimensies", category: "label", tenant_id: null },
  { key: "label.klanten.pijnpunten.klantreis.flow.titel",      value: "Pijnpunten op klantreis · {N} stuks", category: "label", tenant_id: null },
  { key: "label.klanten.klantreis.stap_type.orientatie.short", value: "Awareness", category: "label", tenant_id: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  rpcMock.mockResolvedValue({ data: CONFIG_ROWS, error: null });
});

const samplePain = {
  id: "pp-1",
  text_md: "Klant is onzeker over offerte. Veel afhakers in deze stap.",
  is_floating: false,
  is_draft: false,
  sort_order: 10,
};

async function renderCard(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <PijnpuntChevronCard
          pijnpunt={samplePain}
          nummer={1}
          stageNummer={3}
          stageShortName="Aanvraag"
          extraDimensieCount={0}
          clipIdx={0}
          clipTotal={1}
          onClick={() => {}}
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("PijnpuntChevronCard — F26-iteratie", () => {
  test("1. rendert titel + cross-ref-nummer + stage-pill", async () => {
    await renderCard();
    expect(screen.getByTestId("pijnpunt-chevron-card-pp-1")).toBeInTheDocument();
    expect(screen.getByTestId("pijnpunt-chevron-num-pp-1")).toHaveTextContent("1");
    const pill = screen.getByTestId("pijnpunt-chevron-stage-pill-pp-1");
    expect(pill).toHaveTextContent(/stap 3/);
    expect(pill).toHaveTextContent("Aanvraag");
  });

  test("2. extraDimensieCount > 0 → multi-relationele chip zichtbaar", async () => {
    await renderCard({ extraDimensieCount: 2 });
    const chip = screen.getByTestId("pijnpunt-chevron-multi-pp-1");
    expect(chip).toHaveTextContent(/\+ 2 dimensies/);
  });

  test("3. extraDimensieCount = 0 → geen multi-chip", async () => {
    await renderCard({ extraDimensieCount: 0 });
    expect(screen.queryByTestId("pijnpunt-chevron-multi-pp-1")).not.toBeInTheDocument();
  });

  test("4. click op chevron-card → onClick(pijnpunt)", async () => {
    const onClick = jest.fn();
    await renderCard({ onClick });
    fireEvent.click(screen.getByTestId("pijnpunt-chevron-card-pp-1").querySelector("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(samplePain);
  });
});

// ── Integratie-test in WerkruimteView ──────────────────────────────────────

const sampleKlantreisDim = { id: "dim-kr", archetype: "klantreis", name: "Klantreis", sort_order: 10 };
const sampleOtherDim     = { id: "dim-seg", archetype: "klantsegment", name: "Klantsegmenten", sort_order: 20 };

function makeKlantreisItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `it-kr-${i + 1}`,
    dimension_id: "dim-kr",
    canvas_id: "cv-1",
    name: `Stage ${i + 1}`,
    sort_order: (i + 1) * 10,
    is_draft: false,
    archetype_data: { stap_type: i === 1 ? "orientatie" : `stap_${i}` },
  }));
}

async function renderWerkruimte(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <AppConfigProvider>
        <WerkruimteView
          canvasId="cv-1"
          dimensions={[]}
          items={[]}
          painPoints={[]}
          couplings={[]}
          suggestions={[]}
          suggestionsLoading={false}
          suggestionsError={null}
          reloadSuggestions={() => {}}
          intents={[]}
          onAcceptDraftItem={() => {}}
          onRejectDraftItem={() => {}}
          onExtractItemsFromDossier={() => {}}
          onExtractPainsFromDossier={() => {}}
          onAcceptDraftPain={() => {}}
          onRejectDraftPain={() => {}}
          onItemClick={() => {}}
          onAddItem={() => {}}
          onAddDimensie={() => {}}
          onEditDimensie={() => {}}
          onAddPijnpunt={() => {}}
          onEditPijnpunt={() => {}}
          onPromoteSuggestion={() => {}}
          hasUploads={false}
          hasIndexedChunks={false}
          uploadsProcessing={false}
          dossierBusy={null}
          {...props}
        />
      </AppConfigProvider>
    );
  });
  await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  return result;
}

describe("WerkruimteView — F26-iteratie volle-breedte-strip integratie", () => {
  test("5. fase 1 + klantreis-dim + 9 items → top-strip volle breedte zichtbaar", async () => {
    const items = makeKlantreisItems(9);
    await renderWerkruimte({
      dimensions: [sampleKlantreisDim, sampleOtherDim],
      items,
    });
    expect(screen.getByTestId("klantreis-top-strip-container")).toBeInTheDocument();
    // Chevron-strip rendert binnen container
    expect(screen.getByTestId("klantreis-chevron-overview")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-it-kr-1")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-it-kr-9")).toBeInTheDocument();
  });

  test("6. T4 A4: fase 1 + klantreis-dim + 2 items → strip ZICHTBAAR (was: ≥3-restrictie gedropt)", async () => {
    const items = makeKlantreisItems(2);
    await renderWerkruimte({
      dimensions: [sampleKlantreisDim, sampleOtherDim],
      items,
    });
    // T4 A4: strip is nu zichtbaar bij ALLE klantreis-dim-aanwezigheid, ongeacht aantal stages.
    // Eerder vereiste de oude ≥3-restrictie 3 stages; nu render bij ≥1.
    expect(screen.queryByTestId("klantreis-top-strip-container")).toBeInTheDocument();
  });

  test("7. fase 1 + geen klantreis-dim → geen top-strip", async () => {
    await renderWerkruimte({
      dimensions: [sampleOtherDim],
      items: [{ id: "it-seg-1", dimension_id: "dim-seg", canvas_id: "cv-1", name: "MKB", sort_order: 10, is_draft: false }],
    });
    expect(screen.queryByTestId("klantreis-top-strip-container")).not.toBeInTheDocument();
  });
});
