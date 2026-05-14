/**
 * api/klanten/items.js — CRUD voor cd_items
 *
 * Method-dispatch:
 *   GET    ?dimension_id=...                → list items per dimension
 *   GET    ?canvas_id=...                   → list all items for canvas (across dimensions)
 *   POST   { dimension_id, name, description?, archetype_data?, sub_items?, sort_order?, is_draft? }
 *                                           → create
 *   PUT    ?id=...   { name?, description?, archetype_data?, sub_items?, sort_order?, is_draft? }
 *                                           → update
 *   DELETE ?id=...                          → delete
 *
 * Validatie: archetype_data jsonb-keys getoetst aan archetype-schema
 * (RFC-001 §2.2.1 via _archetypes.js). Onbekende keys → 400.
 *
 * canvas_id + tenant_id worden server-side afgeleid uit de dimension-rij
 * (validate_cd_items_dimension_link-trigger zou dat anders ook afdwingen,
 * maar duidelijker foutmelding geven we hier).
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");
const { validateArchetypeData } = require("./_archetypes");
const {
  extractItemsFromDossier, fillFieldsFromDossier,
  createItemWithFieldsFromDossier,
  acceptDraftItem, rejectDraftItem, editDraftItem,
} = require("./_dossier_extract");

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(500).json({ error: "Supabase niet geconfigureerd" });
  }

  // Stap 11.K: subpath-dispatch voor dossier-affordances + draft-acties.
  // Endpoint-budget=12 — geen nieuwe top-level files.
  const subpath = req.query?._subpath;
  if (subpath === "dossier_extract" || subpath === "dossier_fill_fields" ||
      subpath === "dossier_create_with_fields" ||
      subpath === "accept_draft"    || subpath === "reject_draft" ||
      subpath === "edit_draft") {
    return handleDossierSubpath(req, res, { subpath, supabase, user });
  }

  try {
    if (req.method === "GET") {
      const { dimension_id, canvas_id } = req.query;
      if (!dimension_id && !canvas_id) {
        return res.status(400).json({ error: "dimension_id of canvas_id is verplicht" });
      }
      let q = supabase.from("cd_items").select("*").order("sort_order", { ascending: true });
      if (dimension_id) q = q.eq("dimension_id", dimension_id);
      else if (canvas_id) q = q.eq("canvas_id", canvas_id);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ items: data });
    }

    if (req.method === "POST") {
      const { dimension_id, name, description, archetype_data, sub_items, sort_order, is_draft } = req.body || {};
      if (!dimension_id) return res.status(400).json({ error: "dimension_id is verplicht" });
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is verplicht" });
      }

      // Lookup dimension om archetype + canvas_id + tenant_id te krijgen
      const { data: dim, error: dimErr } = await supabase
        .from("cd_dimensions")
        .select("id, canvas_id, tenant_id, archetype")
        .eq("id", dimension_id)
        .maybeSingle();
      if (dimErr) return res.status(500).json({ error: dimErr.message });
      if (!dim)   return res.status(404).json({ error: "dimension niet gevonden of geen toegang" });

      // Valideer archetype_data tegen schema
      const v = validateArchetypeData(dim.archetype, archetype_data);
      if (!v.ok) return res.status(400).json({ error: v.error });

      const { data, error } = await supabase
        .from("cd_items")
        .insert({
          dimension_id,
          canvas_id: dim.canvas_id,
          tenant_id: dim.tenant_id,
          name: name.trim(),
          description: description ?? null,
          archetype_data: archetype_data ?? {},
          sub_items: sub_items ?? [],
          sort_order: sort_order ?? 0,
          is_draft: is_draft ?? false,
        })
        .select()
        .single();
      if (error) return res.status(error.code === "42501" ? 403 : 500).json({ error: error.message });
      return res.status(201).json({ item: data });
    }

    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });

      // Lookup huidige item om archetype te weten voor validatie
      const { data: existing, error: existErr } = await supabase
        .from("cd_items")
        .select("id, archetype_data, dimension_id, cd_dimensions:dimension_id(archetype)")
        .eq("id", id)
        .maybeSingle();
      if (existErr) return res.status(500).json({ error: existErr.message });
      if (!existing) return res.status(404).json({ error: "item niet gevonden of geen toegang" });

      const { name, description, archetype_data, sub_items, sort_order, is_draft } = req.body || {};
      const patch = {};
      if (name !== undefined)         patch.name = String(name).trim();
      if (description !== undefined)  patch.description = description;
      if (sub_items !== undefined)    patch.sub_items = sub_items;
      if (sort_order !== undefined)   patch.sort_order = parseInt(sort_order, 10);
      if (is_draft !== undefined)     patch.is_draft = !!is_draft;

      if (archetype_data !== undefined) {
        const archetype = existing.cd_dimensions?.archetype;
        const v = validateArchetypeData(archetype, archetype_data);
        if (!v.ok) return res.status(400).json({ error: v.error });
        patch.archetype_data = archetype_data;
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "geen velden om te updaten" });
      }

      const { data, error } = await supabase
        .from("cd_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message });
      return res.status(200).json({ item: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_items").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/items] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};

// ── Stap 11.K — Dossier-driven AI-affordances + draft-acties ───────────────

async function handleDossierSubpath(req, res, { subpath, supabase, user }) {
  try {
    // Common context: tenant + role
    const { data: tenantRow } = await supabase.from("tenants").select("id").maybeSingle();
    if (!tenantRow) return res.status(403).json({ error: "Tenant niet gevonden voor deze user" });
    const { data: profileRow } = await supabase.from("user_profiles").select("role").maybeSingle();
    const ctx = {
      supabase, req,
      userId: user.id,
      userRole: profileRow?.role || null,
      tenantId: tenantRow.id,
    };

    if (subpath === "dossier_extract") {
      // A1: bulk-create draft items per dimensie. Body: { canvas_id, dimension_id }
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const { canvas_id, dimension_id } = req.body || {};
      const result = await extractItemsFromDossier({ ...ctx, canvasId: canvas_id, dimensionId: dimension_id });
      return res.status(result.status).json(result.body || {});
    }

    if (subpath === "dossier_create_with_fields") {
      // A6 (U-cleanup): combineer A1+A2 voor 0-items-flow. Body: { canvas_id, dimension_id }
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const { canvas_id, dimension_id } = req.body || {};
      const result = await createItemWithFieldsFromDossier({
        ...ctx, canvasId: canvas_id, dimensionId: dimension_id,
      });
      return res.status(result.status).json(result.body || {});
    }

    if (subpath === "dossier_fill_fields") {
      // A2: vul archetype-velden voor één item. Query: ?id=...
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const result = await fillFieldsFromDossier({ ...ctx, itemId: id });
      return res.status(result.status).json(result.body || {});
    }

    if (subpath === "accept_draft") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const result = await acceptDraftItem({ ...ctx, itemId: id });
      return res.status(result.status).json(result.body || {});
    }

    if (subpath === "reject_draft") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const result = await rejectDraftItem({ ...ctx, itemId: id });
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status).json(result.body || {});
    }

    if (subpath === "edit_draft") {
      if (req.method !== "PUT") {
        res.setHeader("Allow", "PUT");
        return res.status(405).json({ error: "Method not allowed" });
      }
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const result = await editDraftItem({ ...ctx, itemId: id, fields: req.body || {} });
      return res.status(result.status).json(result.body || {});
    }

    return res.status(400).json({ error: `Onbekende subpath: ${subpath}` });
  } catch (err) {
    console.error("[api/klanten/items dossier-subpath] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
}
