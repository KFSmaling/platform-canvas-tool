/**
 * J1 — Leeg canvas zelf vullen.
 *
 * Implementeert platform/reviewer/test-journeys/klanten-werkblad.md §J1
 * letterlijk (13 stappen). Bewijst dat een nieuwe consultant in een leeg
 * Klanten-werkblad zelf de eerste dimensie kan aanmaken, items toevoegen,
 * dimensie-edit kan uitvoeren, en het resultaat in de rapport-laag terugziet.
 *
 * Pre-conditie: globalSetup heeft test-user ingelogd (storageState in
 * playwright/.auth/test-user.json). beforeAll maakt fresh canvas via
 * Supabase JS (Path-2 user-credentials, RLS toelaat want eigenaar). afterAll
 * verwijdert canvas — CASCADE haalt cd_dimensions/cd_items mee.
 */

const { test, expect } = require("@playwright/test");
const { createTestCanvas, deleteTestCanvas } = require("../helpers/test-canvas");

test.describe("J1 — Leeg canvas zelf vullen", () => {
  let canvasId;
  let canvasTitle;

  test.beforeAll(async () => {
    const canvas = await createTestCanvas("J1-leeg-vullen");
    canvasId = canvas.id;
    canvasTitle = canvas.title;
    console.log(`[J1] test-canvas created: ${canvasTitle} (${canvasId})`);
  });

  test.afterAll(async () => {
    await deleteTestCanvas(canvasId);
    console.log(`[J1] test-canvas deleted: ${canvasId}`);
  });

  test("13-step journey: login → fase 1 → dimensie + item + edit + rapport", async ({ page }) => {
    // ── Stap 1: Login (al gedaan via globalSetup); navigeer naar canvas-overzicht ──
    await page.goto("/");
    // Wacht op canvas-menu trigger zichtbaar (header met canvas-naam)
    await expect(page.locator("body")).toBeVisible();

    // ── Stap 2: Open ons test-canvas via CanvasMenu dropdown ──
    // CanvasMenu zit in de header-balk; klik op de menu-trigger om de lijst te openen,
    // klik daarna op onze canvas-naam.
    // Trigger-button is de eerste button in de header die de huidige canvas-naam
    // toont; we zoeken op aanwezigheid van de canvas-titel-tekst in de pagina.
    // Eerst: open dropdown door op de canvas-menu-trigger te klikken.
    // Pragmatic: klik totdat de canvas-titel in een button-element verschijnt.
    const canvasMenuTrigger = page.locator("header button").first();
    await canvasMenuTrigger.click();
    // Klik op canvas met onze test-titel — `.last()` om header-trigger
    // ("Actief canvas ...") te skippen en alleen het dropdown-item te raken.
    await page.getByRole("button", { name: new RegExp(canvasTitle.replace(/[+]/g, "\\+")) }).last().click();
    // Wacht kort op state-update
    await page.waitForTimeout(500);

    // ── Stap 3: Klik op customers-blok ("Klanten & Dienstverlening"-tile) ──
    // BlockCard heeft een h3 met de blok-titel; click bubbles up naar parent-div onClick.
    const customersBlock = page.locator("h3", { hasText: "Klanten & Dienstverlening" }).first();
    await expect(customersBlock).toBeVisible();
    await customersBlock.click();

    // Verifieer DeepDiveOverlay opent door op de fase-1 dimensie-CTA-test-id te wachten
    // (dat is uniek voor de overlay in lege-state). Lange timeout voor lazy-import.
    const dimensieCta = page.getByTestId("dimensie-cta-eerste");
    await expect(dimensieCta).toBeVisible({ timeout: 15_000 });

    // ── Stap 4: Verifieer lege-state CTA "+ Eerste dimensie aanmaken" ──
    await expect(dimensieCta).toContainText(/Eerste dimensie aanmaken/i);

    // ── Stap 5: Klik CTA → DimensieModal opent met titel "Nieuwe dimensie" ──
    await dimensieCta.click();
    await expect(page.getByText("Nieuwe dimensie", { exact: true })).toBeVisible();

    // ── Stap 6: Selecteer archetype klantsegment + verifieer 6 disabled options ──
    const archetypeSelect = page.getByLabel(/^Archetype/);
    const options = archetypeSelect.locator("option");
    // 1 placeholder + 9 archetypes = 10 totaal
    await expect(options).toHaveCount(10);
    // 6 disabled (regio/behoefte/merk/gedragspatroon/klantreis/anders)
    const disabledOptions = options.filter({ hasNot: page.locator(":not([disabled])") });
    // Robuuster: tel via JS-evaluate
    const disabledCount = await archetypeSelect.evaluate(
      (el) => Array.from(el.querySelectorAll("option")).filter(o => o.disabled && o.value !== "").length
    );
    expect(disabledCount).toBe(6);
    await archetypeSelect.selectOption("klantsegment");

    // ── Stap 7: Type naam "Mijn doelgroepen"; submit-knop wordt enabled ──
    // Specifieker dan getByLabel — DimensieModal gebruikt id="dim-create-naam".
    const dimNaamInput = page.locator("#dim-create-naam");
    await dimNaamInput.fill("Mijn doelgroepen");
    const opslaanBtn = page.getByRole("button", { name: /^Opslaan$/i });
    await expect(opslaanBtn).toBeEnabled();

    // ── Stap 8: Klik Opslaan → modal sluit + kolom verschijnt in grid ──
    await opslaanBtn.click();
    await expect(page.getByText("Nieuwe dimensie", { exact: true })).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Mijn doelgroepen/i })).toBeVisible();

    // ── Stap 9: Klik "+ item"-knop binnen kolom → ItemModal opent ──
    const itemAddBtn = page.getByRole("button", { name: /^\+\s*item$/i }).first();
    await itemAddBtn.click();
    await expect(page.getByText(/Nieuw item|Item bewerken/i)).toBeVisible();

    // ── Stap 10: Vul item in → opslaan → item zichtbaar in kolom ──
    // ItemModal heeft autofocus op naam-input maar geen htmlFor/id; selecteer
    // via positie binnen modal (eerste text-input in form). Ook geen unique
    // labels, dus we tellen op volgorde.
    const itemModalNaam = page.locator('input[type="text"]:visible').first();
    await itemModalNaam.fill("Consumer");
    // Skip archetype-velden voor MVP-test (optioneel; J1 vraagt minimaal één
    // veld maar laat een leeg-archetype-data toe). Direct opslaan met alleen naam.
    await page.getByRole("button", { name: /^Opslaan$/i }).click();
    // Wacht tot modal sluit
    await expect(page.getByText(/^Nieuw item$/)).not.toBeVisible({ timeout: 10_000 });
    // Item zichtbaar in dimensie-kolom
    await expect(page.getByText("Consumer", { exact: true })).toBeVisible();

    // ── Stap 11: Klik dimensie-naam-header → DimensieModal edit-mode ──
    // Naam-header is een button met data-testid="dimensie-edit-{id}"; we
    // selecteren via de tekst (eenvoudiger dan id-lookup).
    const naamHeader = page.locator('[data-testid^="dimensie-edit-"]').filter({ hasText: "Mijn doelgroepen" });
    await naamHeader.click();
    await expect(page.getByText("Dimensie bewerken", { exact: true })).toBeVisible();

    // Verifieer archetype-select disabled met value=klantsegment
    const editSelect = page.getByLabel(/^Archetype/);
    await expect(editSelect).toBeDisabled();
    await expect(editSelect).toHaveValue("klantsegment");

    // Verifieer naam prefilled
    const editNaamInput = page.locator("#dim-create-naam");
    await expect(editNaamInput).toHaveValue("Mijn doelgroepen");

    // ── Stap 12: Wijzig naam → Doelgroepen segmenten → Opslaan + verifieer ──
    await editNaamInput.fill("Doelgroepen segmenten");
    await page.getByRole("button", { name: /^Opslaan$/i }).click();
    await expect(page.getByText("Dimensie bewerken", { exact: true })).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Doelgroepen segmenten/i })).toBeVisible();

    // ── Stap 13: Toggle Werkruimte → Rapport → A4-pagina rendert ──
    const rapportToggle = page.getByRole("button", { name: /^Rapport$/i }).first();
    await rapportToggle.click();
    // Rapport rendert sectie + item; check dat zowel kolom-titel als item zichtbaar zijn
    await expect(page.getByText("Doelgroepen segmenten", { exact: false })).toBeVisible();
    await expect(page.getByText("Consumer", { exact: true }).first()).toBeVisible();
  });
});
