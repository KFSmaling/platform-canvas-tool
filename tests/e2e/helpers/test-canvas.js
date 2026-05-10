/**
 * test-canvas helper — per-test fresh canvas via Supabase JS-client met
 * test-user-credentials (RLS toelaat, user is canvas-eigenaar).
 *
 * Gebruikt user-context (Path-2), geen service-role. Teardown via
 * canvases.delete → CASCADE haalt cd_dimensions/cd_items/cd_pain_points/etc.
 *
 * Stap 11.G.1: prefix `e2e-{journey}-{timestamp}` voor canvas-titel zodat
 * eventueel achtergebleven canvases makkelijk te identificeren zijn.
 */

const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env.test") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

function getSupabaseClient() {
  const supabaseUrl = process.env.PLAYWRIGHT_TEST_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loginTestUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.PLAYWRIGHT_TEST_EMAIL,
    password: process.env.PLAYWRIGHT_TEST_PASSWORD,
  });
  if (error) throw new Error(`loginTestUser: ${error.message}`);
  return { supabase, session: data.session };
}

/** Maak een nieuw test-canvas voor een journey. Returnt { id, name }. */
async function createTestCanvas(journey = "J0") {
  const { supabase, session } = await loginTestUser();
  const name = `e2e-${journey}-${Date.now()}`;
  const { data, error } = await supabase
    .from("canvases")
    .insert({
      name,
      user_id: session.user.id,
      tenant_id: process.env.PLAYWRIGHT_TEST_KF_TENANT_ID,
    })
    .select("id, name")
    .single();
  if (error) throw new Error(`createTestCanvas: ${error.message}`);
  // Behoud .title-alias voor backwards-compat met spec-files
  return { id: data.id, name: data.name, title: data.name };
}

/** Verwijder test-canvas (CASCADE haalt child-data). */
async function deleteTestCanvas(canvasId) {
  if (!canvasId) return;
  const { supabase } = await loginTestUser();
  const { error } = await supabase.from("canvases").delete().eq("id", canvasId);
  if (error) {
    // log maar gooi niet — teardown moet niet-fatal zijn
    console.error(`deleteTestCanvas (id=${canvasId}): ${error.message}`);
  }
}

module.exports = { createTestCanvas, deleteTestCanvas, loginTestUser, getSupabaseClient };
