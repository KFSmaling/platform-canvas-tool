/**
 * api/klanten/pattern_suggestion_events.js — read-only audit-trail
 * (RFC-001 §2.6).
 *
 * GET ?suggestion_id=...   → events van één suggestion (chronologisch)
 * GET ?canvas_id=...       → alle events in canvas (voor admin/debug, beperkt 200)
 *
 * Mutaties (INSERT) gebeuren elders:
 *   - pattern_suggestions_generate.js (ai_generated bij bulk-AI-call)
 *   - pattern_suggestions.js (consultant-acties: edited/accepted/rejected/
 *     refined_dig_deeper/promoted_to_intent)
 *
 * RLS: cd_pse SELECT-policy doet tenant + canvas-eigenaar-check; geen
 * UPDATE/DELETE-policies → append-only via RLS afgedwongen.
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");

const MAX_LIMIT = 200;

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(500).json({ error: "Supabase niet geconfigureerd" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  }

  const { suggestion_id, canvas_id } = req.query;
  if (!suggestion_id && !canvas_id) {
    return res.status(400).json({ error: "suggestion_id of canvas_id is verplicht" });
  }

  try {
    let q = supabase
      .from("cd_pattern_suggestion_events")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(MAX_LIMIT);

    if (suggestion_id) q = q.eq("suggestion_id", suggestion_id);
    if (canvas_id)     q = q.eq("canvas_id", canvas_id);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ events: data });
  } catch (err) {
    console.error("[api/klanten/pattern_suggestion_events] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};
