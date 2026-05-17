/**
 * 11.S Block 5 (FINAL) — E2E voor Strategie OnePager v2-flow.
 *
 * Strategie-equivalent van klanten-werkblad J1-blueprint. Bewijst dat de
 * Rapportage-flow + OnepagerBuilder + StrategyOnePager v2 end-to-end werkt
 * op productie (`kingfisher-btcprod.vercel.app`).
 *
 * Pre-conditie: globalSetup heeft test-user ingelogd. createTestCanvas
 * maakt een fresh empty canvas — Strategie-werkblad-state is daarop leeg
 * (geen strategy_core-data). Geschikt voor fallback-test (case 3).
 *
 * Case 2d (5-7 thema's compact-layout) uit Block 5-instructie is **vervallen**
 * sinds 11.S-simplify (compact-mode verwijderd; alle KSF/KPIs zichtbaar
 * ongeacht thema-count). Vervangen door case 4: "5 thema's allen zichtbaar
 * + 2-row-wrap" — SKIPPED tot DB-seeding-helper voor strategic_themes
 * beschikbaar is (geen blocker; visueel-handmatige Kees-test dekt dit).
 *
 * Case 2e (Print-flow) GESCHRAPT per Kees-besluit 18 mei avond — browser-
 * print-output naar tevredenheid; logisch vervolg = PPT-export fase 2.
 */

const { test, expect } = require("@playwright/test");
const { createTestCanvas, deleteTestCanvas } = require("../helpers/test-canvas");

test.describe("11.S Block 5 — Strategie OnePager v2 E2E", () => {
  let canvasId;
  let canvasTitle;

  test.beforeAll(async () => {
    const canvas = await createTestCanvas("11S-block5-strategie");
    canvasId = canvas.id;
    canvasTitle = canvas.title;
    console.log(`[11S-block5] test-canvas: ${canvasTitle} (${canvasId})`);
  });

  test.afterAll(async () => {
    await deleteTestCanvas(canvasId);
    console.log(`[11S-block5] deleted: ${canvasId}`);
  });

  // Helper: open Strategie-werkblad op het zojuist gemaakte test-canvas.
  // Analoog aan J1-pattern, maar klikt op Strategie-tile i.p.v. Klanten.
  async function openStrategieWerkblad(page) {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Open CanvasMenu en klik op onze test-canvas
    const canvasMenuTrigger = page.locator("header button").first();
    await canvasMenuTrigger.click();
    await page
      .getByRole("button", { name: new RegExp(canvasTitle.replace(/[+]/g, "\\+")) })
      .last()
      .click();
    await page.waitForTimeout(500);
    // Klik Strategie-tile
    const strategieTile = page.locator("h3", { hasText: /^Strategie$/ }).first();
    await expect(strategieTile).toBeVisible();
    await strategieTile.click();
    // Wacht op werkblad-tabs (Identiteit-tab is unique aan Strategie)
    await expect(page.getByRole("button", { name: /^Identiteit$/i })).toBeVisible({ timeout: 15_000 });
  }

  // Helper: open OnepagerBuilder via Rapportage-knop → menu → tile.
  async function openOnepagerBuilder(page) {
    const rapportageBtn = page.getByTestId("werkblad-actie-rapportage");
    await expect(rapportageBtn).toBeVisible();
    await rapportageBtn.click();
    // RapportageMenu open
    await expect(page.getByTestId("rapportage-menu")).toBeVisible();
    // Klik One-pager-tile
    await page.getByTestId("rapportage-tile-onepager").click();
    // OnepagerBuilder open
    await expect(page.getByTestId("onepager-builder-overlay")).toBeVisible({ timeout: 10_000 });
  }

  // ── Case 1 — Happy-path Rapportage-flow ──────────────────────────────────
  test("1. Happy-path: Strategie → Rapportage → OnepagerBuilder → v2 layout zichtbaar", async ({ page }) => {
    await openStrategieWerkblad(page);
    await openOnepagerBuilder(page);

    // ModelLibrary panel zichtbaar
    await expect(page.getByTestId("onepager-builder-leftpanel")).toBeVisible();
    await expect(page.getByTestId("modellib-vaste-blokken")).toBeVisible();
    await expect(page.getByTestId("modellib-groups")).toBeVisible();

    // A4Preview viewport + flow-wrapper aanwezig (11.S-simplify)
    await expect(page.getByTestId("a4-preview-viewport")).toBeVisible();
    await expect(page.getByTestId("a4-preview-page-flow")).toBeVisible();

    // StrategyOnePager v2 layout aanwezig
    await expect(page.getByTestId("strategie-onepager-v2")).toBeVisible();
    await expect(page.getByTestId("strategie-onepager-brand-strip")).toBeVisible();
    // H1 = vaste-titel (retro-3)
    await expect(page.getByTestId("strategie-onepager-h1")).toHaveText(/Samenvatting Strategie/i);
    await expect(page.getByTestId("strategie-onepager-identiteit-band")).toBeVisible();
    await expect(page.getByTestId("strategie-onepager-kpi-strip")).toBeVisible();
    await expect(page.getByTestId("strategie-onepager-footer")).toBeVisible();

    // Sluit Builder
    await page.getByTestId("onepager-builder-back").click();
    // OnepagerBuilder gesloten — terug naar RapportageMenu (onBackToMenu-bridge)
    await expect(page.getByTestId("rapportage-menu")).toBeVisible();
    // Sluit menu
    await page.getByTestId("rapportage-menu-close").click();
    await expect(page.getByTestId("rapportage-menu")).not.toBeVisible();
  });

  // ── Case 2 — AI-toggle off ───────────────────────────────────────────────
  test("2. AI-toggle off-flow: toggle uit → geen AiBlock; toggle aan → AiBlock terug", async ({ page }) => {
    await openStrategieWerkblad(page);
    await openOnepagerBuilder(page);

    const toggleBlock = page.getByTestId("onepager-ai-toggle-block");
    await expect(toggleBlock).toHaveAttribute("data-ai-active", "true");

    // Toggle uit
    await page.getByTestId("onepager-ai-toggle-switch").click();
    await expect(toggleBlock).toHaveAttribute("data-ai-active", "false");

    // AiBlock + ai-empty allebei NIET in DOM (leeg canvas, geen insights →
    // BodyZone heeft hasBodyContent=false → niet gerendered).
    // Bij leeg-canvas + withAi=false: hele BodyZone niet zichtbaar.
    await expect(page.getByTestId("strategie-onepager-ai-block")).not.toBeVisible();
    await expect(page.getByTestId("strategie-onepager-ai-empty")).not.toBeVisible();

    // Toggle weer aan
    await page.getByTestId("onepager-ai-toggle-switch").click();
    await expect(toggleBlock).toHaveAttribute("data-ai-active", "true");
    // Bij leeg canvas + withAi=true → BodyZone heeft hasBodyContent=true →
    // AiBlock rendert ai-empty (geen in_rapport-insights op leeg canvas).
    await expect(page.getByTestId("strategie-onepager-ai-empty")).toBeVisible();
  });

  // ── Case 3 — Leeg canvas fallbacks ───────────────────────────────────────
  test("3. Leeg canvas → identiteits-placeholders + H1-vaste-titel + KPI-BHAG/Horizon + themas-empty", async ({ page }) => {
    await openStrategieWerkblad(page);
    await openOnepagerBuilder(page);

    // Identiteits-band met placeholders (geen missie/visie/ambitie ingevuld)
    const identiteit = page.getByTestId("strategie-onepager-identiteit-band");
    await expect(identiteit).toContainText(/Missie nog niet ingevuld/i);
    await expect(identiteit).toContainText(/Visie nog niet ingevuld/i);
    await expect(identiteit).toContainText(/Ambitie nog niet ingevuld/i);

    // H1 is vaste-titel (geen samenvatting-fallback meer sinds retro-3)
    await expect(page.getByTestId("strategie-onepager-h1")).toHaveText(/Samenvatting Strategie/i);

    // KPI-strip: 4 cellen, allemaal fallback (BHAG geen-match → 4× Horizon)
    const kpiCells = page.locator('[data-testid^="strategie-onepager-kpi-cell-"]');
    await expect(kpiCells).toHaveCount(4);
    const fallbackCells = await page
      .locator('[data-testid^="strategie-onepager-kpi-cell-"][data-fallback="true"]')
      .count();
    expect(fallbackCells).toBeGreaterThanOrEqual(3);

    // Themas-grid empty fallback
    await expect(page.getByTestId("strategie-onepager-themas-empty")).toBeVisible();
    await expect(page.getByTestId("strategie-onepager-themas-empty"))
      .toContainText(/Geen strategische thema's/i);
  });

  // ── Case 4 — 5 thema's allen zichtbaar (post-simplify: geen compact-mode) ──
  test.skip("4. 5 thema's: alle 5 zichtbaar in 2-row-wrap (vereist DB-seeding helper)", async () => {
    // SKIP: vereist seedStrategicThemes-helper die nog niet bestaat.
    // Kees-handmatige-test dekt deze case visueel via Kees-test-checklist
    // punt 11 ("Bij ≤4 thema's: ruime layout; bij 5-7: alle KSFs/KPIs zichtbaar").
    //
    // Implementatie-pad (future): extend helpers/test-canvas.js met
    //   async function seedStrategicThemes(canvasId, count) { /* insert in
    //   strategic_themes met sort_order 1..N */ }
    // Daarna: vóór openStrategieWerkblad → seedStrategicThemes(canvasId, 5);
    // verifieer 5 strategie-onepager-thema-T1..T5 testids zichtbaar.
  });
});
