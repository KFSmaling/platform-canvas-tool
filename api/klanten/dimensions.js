/**
 * api/klanten/dimensions.js — CRUD voor cd_dimensions
 *
 * Method-dispatch:
 *   GET    ?canvas_id=...                  → list all dimensions for canvas
 *   POST   { canvas_id, archetype, name, description?, is_ordered?, sort_order? }
 *                                          → create
 *   PUT    ?id=...   { name?, description?, is_ordered?, sort_order? }
 *                                          → update
 *   DELETE ?id=...                         → delete (cascadeert items)
 *
 * Auth: JWT via Authorization: Bearer <token> header. RLS-policy
 * "cd_dimensions tenant + eigenaar" doet tenant-isolatie + canvas-eigenaar-
 * check. tenant_id wordt server-side ingevuld vanuit current_tenant_id()
 * (via SELECT op tenants), niet door client meegegeven — voorkomt
 * cross-tenant-INSERT-pogingen die door RLS WITH CHECK zouden worden
 * geweigerd, en geeft duidelijker foutmelding.
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");
const { ARCHETYPES } = require("./_archetypes");

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
        .from("cd_dimensions")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("sort_order", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ dimensions: data });
    }

    if (req.method === "POST") {
      const { canvas_id, archetype, name, description, is_ordered, sort_order } = req.body || {};
      if (!canvas_id) return res.status(400).json({ error: "canvas_id is verplicht" });
      if (!archetype || !ARCHETYPES.includes(archetype)) {
        return res.status(400).json({ error: `archetype is verplicht en moet één van: ${ARCHETYPES.join(', ')}` });
      }
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is verplicht" });
      }
      const { data, error } = await supabase
        .from("cd_dimensions")
        .insert({
          canvas_id,
          tenant_id: tenantId,
          archetype,
          name: name.trim(),
          description: description ?? null,
          is_ordered: is_ordered ?? (archetype === "klantreis"),
          sort_order: sort_order ?? 0,
        })
        .select()
        .single();
      if (error) return res.status(error.code === "42501" ? 403 : 500).json({ error: error.message });
      return res.status(201).json({ dimension: data });
    }

    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { name, description, is_ordered, sort_order } = req.body || {};
      const patch = {};
      if (name !== undefined)        patch.name = String(name).trim();
      if (description !== undefined) patch.description = description;
      if (is_ordered !== undefined)  patch.is_ordered = !!is_ordered;
      if (sort_order !== undefined)  patch.sort_order = parseInt(sort_order, 10);
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "geen velden om te updaten" });
      }
      const { data, error } = await supabase
        .from("cd_dimensions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message });
      return res.status(200).json({ dimension: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_dimensions").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/dimensions] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};
