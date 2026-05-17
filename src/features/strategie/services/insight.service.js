/**
 * insight.service.js — RFC-008 §B service-laag voor per-insight-updates.
 *
 * Single entry-point voor edit-mode + in_rapport-toggle in InzichtenOverlay.
 * Roept de RPC `update_strategy_insight` aan (zie migratie
 * `20260518000100_rpc_update_strategy_insight.sql`) — atomair via `jsonb_set`,
 * concurrency-veilig zonder version-column.
 *
 * Contract: `{ data, error }` (CLAUDE.md §3 + §4.2).
 *
 * Service-laag-discipline: geen direct UPDATE op `strategy_core.insights` jsonb-array
 * vanuit andere services (T2-retro-fix-pattern: alles via gedefinieerde RPC of service-functie).
 */

import { supabase } from "../../../shared/services/supabase.client";

/**
 * Partial-update van één insight in strategy_core.insights[].
 *
 * @param {string} canvasId  — canvas-id (uuid)
 * @param {string} insightId — insight-id binnen jsonb-array (text)
 * @param {object} fields    — bv. `{ in_rapport: true }` of
 *                              `{ edited_observation, edited_recommendation }`
 *                              of beide tegelijk. `last_edited_at` + `last_edited_by`
 *                              worden door RPC automatisch gezet.
 * @returns {Promise<{ data: object|null, error: Error|null }>}
 *          `data` = updated insight-object (jsonb).
 */
export async function updateInsight(canvasId, insightId, fields) {
  if (!supabase) return { data: null, error: new Error("Supabase niet geconfigureerd") };
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  if (!insightId) return { data: null, error: new Error("insightId is required") };
  if (!fields || typeof fields !== "object") {
    return { data: null, error: new Error("fields is required (object)") };
  }

  const userResult = await supabase.auth.getUser();
  const actorUserId = userResult.data?.user?.id ?? null;

  const { data, error } = await supabase.rpc("update_strategy_insight", {
    p_canvas_id: canvasId,
    p_insight_id: insightId,
    p_fields: fields,
    p_actor_user_id: actorUserId,
  });

  if (error) console.error("[insight.service] updateInsight mislukt:", error.message);
  return { data, error };
}
