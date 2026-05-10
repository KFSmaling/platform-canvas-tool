// @ts-check
/**
 * Playwright config — E2E-tests voor Klanten & Dienstverlening werkblad
 * (en toekomstige werkbladen).
 *
 * Stap 11.G.1: globalSetup logt eenmalig in via Supabase JS-client
 * (test-credentials uit .env.test) en exporteert storageState naar
 * playwright/.auth/test-user.json (gitignored). Iedere spec hergebruikt
 * die state via use.storageState → start ingelogd.
 *
 * testDir = tests/e2e/journeys → spec-driven journey-tests per
 * platform/reviewer/test-journeys/klanten-werkblad.md.
 */

const path = require("path");
const { defineConfig, devices } = require("@playwright/test");
require("dotenv").config({ path: path.resolve(__dirname, ".env.test") });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "https://kingfisher-btcprod.vercel.app";
const STORAGE_PATH = path.resolve(__dirname, "playwright/.auth/test-user.json");

module.exports = defineConfig({
  testDir: "./tests/e2e/journeys",
  fullyParallel: false,                  // journeys delen niet hetzelfde canvas — parallel kan, maar serialisering helpt bij debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                            // serieel; e2e tegen productie is sequentieel beter
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  globalSetup: require.resolve("./tests/e2e/global-setup.js"),
  timeout: 60_000,                       // ruim voor login + canvas-create + UI-flow
  expect: { timeout: 10_000 },           // jsdom-style auto-retry voor zichtbaarheid

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry",             // screenshots/video bij failure
    storageState: STORAGE_PATH,          // gevuld door globalSetup
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Firefox + WebKit projecten weggelaten voor MVP-fase — komen later
    // wanneer cross-browser-coverage nodig is. Chromium dekt 11.G.1-blueprint.
  ],
});
