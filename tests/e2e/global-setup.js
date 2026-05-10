/**
 * Playwright global-setup — eenmalige login per test-run.
 *
 * Stap 11.G.1: gebruikt Supabase JS-client met test-user-credentials uit
 * .env.test om een sessie te krijgen. Schrijft de sessie naar localStorage
 * via een tijdelijke browser-page; persisteert via storageState naar
 * `playwright/.auth/test-user.json` (gitignored).
 *
 * Iedere test-spec krijgt deze storageState mee via `use.storageState` in
 * playwright.config.js → start ingelogd.
 *
 * Per CLAUDE.md sectie 4 + PLATFORM_REQUIREMENTS #5 (Path-2): geen service-
 * role-key gebruikt. Echte user-flow wordt geëmuleerd, RLS doet z'n werk.
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
// Laad eerst .env.test (test-credentials) en daarna .env (REACT_APP_SUPABASE_ANON_KEY etc).
// dotenv overschrijft niet wat al gezet is, dus volgorde is .env.test > .env.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const STORAGE_PATH = path.resolve(__dirname, "../../playwright/.auth/test-user.json");

module.exports = async function globalSetup() {
  const email    = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  const baseURL  = process.env.PLAYWRIGHT_TEST_BASE_URL;
  const supabaseUrl = process.env.PLAYWRIGHT_TEST_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const anonKey  = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!email || !password || !baseURL || !supabaseUrl || !anonKey) {
    throw new Error(
      "globalSetup: ontbrekende env vars (.env.test + .env). Check PLAYWRIGHT_TEST_EMAIL, PLAYWRIGHT_TEST_PASSWORD, PLAYWRIGHT_TEST_BASE_URL, PLAYWRIGHT_TEST_SUPABASE_URL/REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY"
    );
  }

  // 1. Server-side login via Supabase
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new Error(`globalSetup: login mislukt — ${error?.message || "geen sessie"}`);
  }
  const session = data.session;

  // Project-ref afgeleid uit URL voor de localStorage-key (Supabase-conventie)
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const storageValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user,
  });

  // 2. Browser-context starten + localStorage poppulleren vóór page-load
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(({ storageKey, storageValue }) => {
    window.localStorage.setItem(storageKey, storageValue);
  }, { storageKey, storageValue });

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  // Wacht kort op auth-bootstrap zodat storage gegarandeerd persisted is
  await page.waitForTimeout(500);

  // 3. StorageState exporteren naar bestand voor hergebruik in spec-files
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  await context.storageState({ path: STORAGE_PATH });
  await browser.close();

  // 4. Sanity-log (in CI-output zichtbaar)
  console.log(`[globalSetup] login OK — user=${session.user.email}, storageState=${STORAGE_PATH}`);
};

module.exports.STORAGE_PATH = STORAGE_PATH;
