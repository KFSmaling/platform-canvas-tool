/**
 * api/klanten/pain_points.js — CRUD voor cd_pain_points (RFC-001 §2.3).
 *
 * Method-dispatch:
 *   GET    ?canvas_id=...              → list pijnpunten in canvas
 *   POST   { canvas_id, text_md, sort_order? }
 *                                      → create
 *   PUT    ?id=...   { text_md?, sort_order? }
 *                                      → update
 *   DELETE ?id=...                     → delete (CASCADE op couplings)
 *
 * Auth: JWT via Authorization: Bearer header. RLS-policy
 * "cd_pain_points tenant + eigenaar" doet tenant + canvas-eigenaar-check.
 * tenant_id wordt server-side ingevuld vanuit current_tenant_id() (via
 * SELECT op tenants), niet door client meegegeven.
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");

const TEXT_MAX = 5000; // ruim genoeg voor markdown-pijnpunt-tekst

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(500).json({ error: "Supabase niet geconfigureerd" });
  }

  // tenant_id afleiden via RLS-zichtbare tenants-rij
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants").select("id").maybeSingle();
  if (tenantErr || !tenantRow) {
    return res.status(403).json({ error: "Tenant niet gevonden voor deze user" });
  }
  const tenantId = tenantRow.id;

  try {
    if (req.method === "GET") {
      const canvasId = req.query.canvas_id;
      if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
      const { data, error } = await supabase
        .from("cd_pain_points")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("sort_order", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ pain_points: data });
    }

    if (req.method === "POST") {
      const { canvas_id, text_md, sort_order } = req.body || {};
      if (!canvas_id) return res.status(400).json({ error: "canvas_id is verplicht" });
      if (!text_md || typeof text_md !== "string" || !text_md.trim()) {
        return res.status(400).json({ error: "text_md is verplicht" });
      }
      if (text_md.length > TEXT_MAX) {
        return res.status(400).json({ error: `text_md overschrijdt ${TEXT_MAX}-char-limiet` });
      }
      const { data, error } = await supabase
        .from("cd_pain_points")
        .insert({
          canvas_id,
          tenant_id: tenantId,
          text_md: text_md.trim(),
          sort_order: sort_order ?? 0,
          // is_floating start true via DEFAULT; trigger update bij eerste coupling
        })
        .select()
        .single();
      if (error) return res.status(error.code === "42501" ? 403 : 500).json({ error: error.message });
      return res.status(201).json({ pain_point: data });
    }

    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { text_md, sort_order } = req.body || {};
      const patch = {};
      if (text_md !== undefined) {
        if (!text_md || typeof text_md !== "string" || !text_md.trim()) {
          return res.status(400).json({ error: "text_md mag niet leeg zijn" });
        }
        if (text_md.length > TEXT_MAX) {
          return res.status(400).json({ error: `text_md overschrijdt ${TEXT_MAX}-char-limiet` });
        }
        patch.text_md = text_md.trim();
      }
      if (sort_order !== undefined) patch.sort_order = parseInt(sort_order, 10);
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "geen velden om te updaten" });
      }
      const { data, error } = await supabase
        .from("cd_pain_points")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message });
      return res.status(200).json({ pain_point: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_pain_points").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/pain_points] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};
