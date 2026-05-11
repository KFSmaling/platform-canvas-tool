/**
 * Stap 11.K.2 F17 — RTL voor ItemModal A2-banner-upgrade.
 *
 * Geïsoleerde tests: ItemModal direct gerenderd met mock-props zonder
 * KlantenWerkblad/DimensieKolom-roundtrip. Snel + betrouwbaar.
 *
 * Test-cases:
 *  1. A2 success → groene banner met "X velden ingevuld"
 *  2. A2 empty → amber banner met server-note + sluitbaar via X
 *  3. Banner met type=success heeft CheckCircle2-icoon kleur-context
 *  4. Banner met type=empty heeft AlertCircle-icoon kleur-context
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

const dimension = { id: "dim-1", archetype: "klantsegment", name: "Klantsegmenten" };
const item = {
  id: "item-1",
  dimension_id: "dim-1",
  canvas_id: "cv-1",
  name: "SME-zaken",
  description: null,
  archetype_data: {},
  is_draft: false,
  sort_order: 10,
};

describe("ItemModal — F17 A2 banner-upgrade", () => {
  test("1. A2 success → groene banner met 'X velden ingevuld'", async () => {
    const onFill = jest.fn().mockResolvedValue({
      data: { ...item, is_draft: true, archetype_data: { omvang: "2.4M klanten", strategisch_belang: "Kerncategorie" } },
      meta: { proposed_fields: { omvang: "2.4M klanten", strategisch_belang: "Kerncategorie" }, ai_model: "claude-haiku-4-5-20251001" },
      error: null,
    });

    render(
      <ItemModal
        item={item}
        dimension={dimension}
        onClose={() => {}}
        onSave={async () => ({ error: null })}
        onFillFieldsFromDossier={onFill}
        hasUploads={true}
        hasIndexedChunks={true}
        uploadsProcessing={false}
      />
    );

    const a2Btn = screen.getByTestId("dossier-fields-fill");
    expect(a2Btn).not.toBeDisabled();
    await act(async () => { fireEvent.click(a2Btn); });

    const banner = await screen.findByTestId("dossier-fields-fill-note");
    expect(banner).toHaveAttribute("data-fill-type", "success");
    expect(banner).toHaveTextContent(/2 velden ingevuld/i);
    expect(banner.className).toMatch(/bg-green-50/);
    expect(banner.className).toMatch(/border-green-200/);
  });

  test("2. A2 empty → amber banner met server-note + sluitbaar via X", async () => {
    const onFill = jest.fn().mockResolvedValue({
      data: item,
      meta: { proposed_fields: {}, note: "AI vond geen onderbouwing voor lege velden" },
      error: null,
    });

    render(
      <ItemModal
        item={item}
        dimension={dimension}
        onClose={() => {}}
        onSave={async () => ({ error: null })}
        onFillFieldsFromDossier={onFill}
        hasUploads={true}
        hasIndexedChunks={true}
        uploadsProcessing={false}
      />
    );

    await act(async () => { fireEvent.click(screen.getByTestId("dossier-fields-fill")); });

    const banner = await screen.findByTestId("dossier-fields-fill-note");
    expect(banner).toHaveAttribute("data-fill-type", "empty");
    expect(banner).toHaveTextContent(/geen onderbouwing/i);
    expect(banner.className).toMatch(/bg-amber-50/);

    // Sluitbaar via X
    await act(async () => { fireEvent.click(screen.getByTestId("dossier-fields-fill-note-sluit")); });
    expect(screen.queryByTestId("dossier-fields-fill-note")).not.toBeInTheDocument();
  });

  test("3. A2 single field → 'veld' (enkelvoud) in banner-tekst", async () => {
    const onFill = jest.fn().mockResolvedValue({
      data: { ...item, is_draft: true, archetype_data: { omvang: "2.4M klanten" } },
      meta: { proposed_fields: { omvang: "2.4M klanten" } },
      error: null,
    });

    render(
      <ItemModal
        item={item}
        dimension={dimension}
        onClose={() => {}}
        onSave={async () => ({ error: null })}
        onFillFieldsFromDossier={onFill}
        hasUploads={true}
        hasIndexedChunks={true}
        uploadsProcessing={false}
      />
    );

    await act(async () => { fireEvent.click(screen.getByTestId("dossier-fields-fill")); });

    const banner = await screen.findByTestId("dossier-fields-fill-note");
    expect(banner).toHaveTextContent(/1 veld ingevuld/i);
    expect(banner).not.toHaveTextContent(/velden ingevuld/i);
  });
});
