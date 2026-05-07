/**
 * api/klanten/pain_point_couplings.js — polymorphic koppeling pain ↔ dim/item
 * (RFC-001 §2.4).
 *
 * Method-dispatch:
 *   GET    ?pain_point_id=...                     → list couplings voor één pijn
 *   GET    ?target_table=...&target_id=...        → reverse lookup ("welke pijnpunten hangen aan dit item")
 *   GET    ?canvas_id=...                         → list alle couplings in een canvas (voor PijnpuntenView-render)
 *   POST   { pain_point_id, target_table, target_id }
 *                                                 → create (canvas_id + tenant_id afgeleid uit pain_point)
 *   DELETE ?id=...                                → delete (geen update — wijzig = delete + create)
 *
 * Trigger validate_pain_point_coupling (RFC-001 §3.4) vangt cross-canvas / cross-
 * tenant af; dynamische SELECT op target_table met %I-quoting (whitelist beperkt
 * tot cd_dimensions / cd_items via CHECK-constraint). is_floating-trigger op
 * cd_pain_points herberekent na INSERT/DELETE.
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");

const ALLOWED_TARGET_TABLES = ["cd_dimensions", "cd_items"];

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(500).json({ error: "Supabase niet geconfigureerd" });
  }

  try {
    if (req.method === "GET") {
      const { pain_point_id, target_table, target_id, canvas_id } = req.query;
      let q = supabase.from("cd_pain_point_couplings").select("*");
      if (pain_point_id) {
        q = q.eq("pain_point_id", pain_point_id);
      } else if (target_table && target_id) {
        if (!ALLOWED_TARGET_TABLES.includes(target_table)) {
          return res.status(400).json({ error: `target_table moet één van: ${ALLOWED_TARGET_TABLES.join(', ')}` });
        }
        q = q.eq("target_table", target_table).eq("target_id", target_id);
      } else if (canvas_id) {
        q = q.eq("canvas_id", canvas_id);
      } else {
        return res.status(400).json({ error: "pain_point_id, (target_table + target_id), of canvas_id verplicht" });
      }
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ couplings: data });
    }

    if (req.method === "POST") {
      const { pain_point_id, target_table, target_id } = req.body || {};
      if (!pain_point_id) return res.status(400).json({ error: "pain_point_id is verplicht" });
      if (!target_table || !ALLOWED_TARGET_TABLES.includes(target_table)) {
        return res.status(400).json({ error: `target_table moet één van: ${ALLOWED_TARGET_TABLES.join(', ')}` });
      }
      if (!target_id) return res.status(400).json({ error: "target_id is verplicht" });

      // canvas_id + tenant_id afleiden uit pain-point (validate_pain_point_coupling
      // controleert daarna dat target in zelfde canvas/tenant zit).
      const { data: pp, error: ppErr } = await supabase
        .from("cd_pain_points")
        .select("id, canvas_id, tenant_id")
        .eq("id", pain_point_id)
        .maybeSingle();
      if (ppErr) return res.status(500).json({ error: ppErr.message });
      if (!pp)   return res.status(404).json({ error: "pain_point niet gevonden of geen toegang" });

      const { data, error } = await supabase
        .from("cd_pain_point_couplings")
        .insert({
          pain_point_id,
          target_table,
          target_id,
          tenant_id: pp.tenant_id,
          canvas_id: pp.canvas_id,
        })
        .select()
        .single();
      if (error) {
        // Trigger-error bij cross-canvas / cross-tenant of onbekende target
        if (error.code === "P0001") return res.status(400).json({ error: error.message });
        if (error.code === "23505") return res.status(409).json({ error: "deze koppeling bestaat al" });
        if (error.code === "42501") return res.status(403).json({ error: error.message });
        return res.status(500).json({ error: error.message });
      }
      return res.status(201).json({ coupling: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_pain_point_couplings").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/pain_point_couplings] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};
