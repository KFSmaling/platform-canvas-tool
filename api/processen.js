/**
 * api/processen.js — 11.M Processen & Organisatie-werkblad dispatcher
 *
 * Eén endpoint met sub-route-dispatching via ?_subpath=... om binnen
 * Vercel Hobby 12-functions-limit te blijven (RFC-005 §13.4 +
 * bouwer-diagnose §5).
 *
 * Sub-routes:
 *   Fase 1 — Inventarisatie
 *     processes                        (pr_processes CRUD)
 *     process_steps                    (pr_process_steps CRUD; max-7-trigger)
 *     structuring_doorsnede            (org_structuring_doorsnede GET/PUT canvas-config)
 *     departments                      (org_departments CRUD)
 *     process_department_intensity     (org_process_department_intensity M:N)
 *     change_approach                  (vo_change_approach GET/PUT canvas-config)
 *     business_units                   (vo_business_units CRUD)
 *     value_teams                      (vo_value_teams CRUD met BU-koppeling)
 *     steering_model                   (gov_steering_model GET/PUT canvas-config)
 *     control_processes                (gov_control_processes CRUD)
 *   Fase 2 — Pijnpunten
 *     pain_points                      (po_pain_points CRUD)
 *     pain_point_couplings             (po_pain_point_couplings polymorphic)
 *     pain_point_coverage_toggle       (motivated_no_action met motivatie-CHECK)
 *   Fase 3 — Verbeteracties
 *     improvement_intents              (po_improvement_intents CRUD)
 *     intent_state_transition          (INSERT po_improvement_intent_events → status-sync)
 *     intent_pain_point_links          (po_intent_pain_point_links + coverage-sync)
 *     coverage_aggregate               (GET counts per coverage_status voor banner)
 *
 * Path-2 RLS via userScopedClient — alle write-operaties.
 *
 * AI-sub-routes (C5 follow-up) staan als placeholder met 501:
 *   dossier_extract / dossier_fields_fill / ai_improvements_generate
 *
 * Schets-upload (vo_schets_uploads) gebeurt frontend direct → Supabase Storage
 * (RFC-005-diagnose §5 stop-en-vraag #3 akkoord); deze dispatcher behandelt
 * metadata-INSERT via subpath `schets_upload_metadata`.
 */

const { requireAuth } = require("./_auth");
const { userScopedClient } = require("./_template");
const {
  extractFromDossier, fillProcessFieldsFromDossier,
  improveChangeApproachText, improveSteeringText,
  generateImprovementsAi,
} = require("./_processen_dossier_extract");

// ── Tabel-specs voor generic CRUD ───────────────────────────────────────────
// Per tabel: PK-veld, allowed-fields voor create/update, canvas-config-flag,
// optionele server-side defaults.
const TABLE_SPECS = {
  processes: {
    table: "pr_processes",
    fields: ["dimension_id", "archetype", "name", "description", "archetype_data", "sub_items", "value_stream_ids", "sort_order", "is_draft"],
    requiredCreate: ["archetype", "name"],
  },
  process_steps: {
    table: "pr_process_steps",
    fields: ["process_id", "name", "description", "sort_order"],
    requiredCreate: ["process_id", "name"],
    needsProcessLookup: true, // canvas_id + tenant_id afleiden uit pr_processes.process_id
  },
  departments: {
    table: "org_departments",
    fields: ["name", "description", "sort_order", "is_draft"],
    requiredCreate: ["name"],
  },
  business_units: {
    table: "vo_business_units",
    fields: ["name", "description", "sort_order", "is_draft"],
    requiredCreate: ["name"],
  },
  value_teams: {
    table: "vo_value_teams",
    fields: ["business_unit_id", "name", "description", "relation_tags", "sort_order", "is_draft"],
    requiredCreate: ["name"],
  },
  control_processes: {
    table: "gov_control_processes",
    fields: ["name", "description", "control_type", "sort_order", "is_draft"],
    requiredCreate: ["name", "control_type"],
  },
  pain_points: {
    table: "po_pain_points",
    fields: ["text_md", "is_strategic_anchor", "sort_order", "is_draft"],
    requiredCreate: ["text_md"],
  },
  improvement_intents: {
    table: "po_improvement_intents",
    fields: ["title", "intent_md", "source_type", "ai_generated_at", "is_user_edited", "sort_order"],
    requiredCreate: ["title", "intent_md", "source_type"],
  },
};

// Canvas-config-tabellen (PK = canvas_id, 1 rij per canvas)
const CANVAS_CONFIG_SPECS = {
  structuring_doorsnede: { table: "org_structuring_doorsnede", fields: ["doorsnede"] },
  change_approach:       { table: "vo_change_approach",         fields: ["text_md"] },
  steering_model:        { table: "gov_steering_model",         fields: ["model", "text_md", "coordination_aspects"] },
};

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(500).json({ error: "Supabase niet geconfigureerd" });
  }

  // tenant_id afleiden (RLS-zichtbare tenants-rij)
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants").select("id").maybeSingle();
  if (tenantErr || !tenantRow) {
    return res.status(403).json({ error: "Tenant niet gevonden voor deze user" });
  }
  const tenantId = tenantRow.id;

  const subpath = req.query?._subpath;
  if (!subpath) {
    return res.status(400).json({ error: "Missing _subpath query parameter" });
  }

  const ctx = { supabase, req, res, tenantId, user };

  try {
    // ── Generic CRUD-tabellen ────────────────────────────────────────────
    if (TABLE_SPECS[subpath]) {
      return await handleGenericCrud(ctx, TABLE_SPECS[subpath]);
    }

    // ── Canvas-config-tabellen ──────────────────────────────────────────
    if (CANVAS_CONFIG_SPECS[subpath]) {
      return await handleCanvasConfig(ctx, CANVAS_CONFIG_SPECS[subpath]);
    }

    // ── Special-case sub-routes ─────────────────────────────────────────
    if (subpath === "process_department_intensity") return await handlePdiMatrix(ctx);
    if (subpath === "schets_upload_metadata")        return await handleSchetsUploadMetadata(ctx);
    if (subpath === "pain_point_couplings")          return await handlePainPointCouplings(ctx);
    if (subpath === "pain_point_coverage_toggle")    return await handleCoverageToggle(ctx);
    if (subpath === "intent_state_transition")       return await handleIntentStateTransition(ctx);
    if (subpath === "intent_pain_point_links")       return await handleIntentPainLinks(ctx);
    if (subpath === "coverage_aggregate")            return await handleCoverageAggregate(ctx);

    // ── AI-sub-routes (11.M.1 block-1: dossier-AI volledig) ─────────────
    if (subpath === "dossier_extract")      return await handleDossierExtract(ctx);
    if (subpath === "dossier_fields_fill")  return await handleDossierFieldsFill(ctx);
    if (subpath === "improve_change_approach") return await handleImproveChangeApproach(ctx);
    if (subpath === "improve_steering_text")   return await handleImproveSteeringText(ctx);

    // Verbeteracties-AI (11.M.1 block-2 — 5 source-types)
    if (subpath === "ai_improvements_generate") return await handleAiImprovementsGenerate(ctx);

    return res.status(400).json({ error: `Onbekende subpath: ${subpath}` });
  } catch (err) {
    console.error("[api/processen] onverwachte fout:", err.message, err.stack);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// Generic CRUD voor 8 tabellen
// ══════════════════════════════════════════════════════════════════════════
async function handleGenericCrud(ctx, spec) {
  const { supabase, req, res, tenantId } = ctx;
  const { table, fields, requiredCreate, needsProcessLookup } = spec;

  if (req.method === "GET") {
    const canvasId = req.query.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
    // process_steps wordt gefilterd op process_id (binnen canvas), niet canvas_id direct
    let query = supabase.from(table).select("*").eq("canvas_id", canvasId);
    if (table === "pr_process_steps" && req.query.process_id) {
      query = query.eq("process_id", req.query.process_id);
    }
    const { data, error } = await query.order("sort_order", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const canvasId = body.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });

    // Required-field-validatie
    for (const f of requiredCreate) {
      if (body[f] === undefined || body[f] === null || (typeof body[f] === "string" && !body[f].trim())) {
        return res.status(400).json({ error: `${f} is verplicht` });
      }
    }

    // Process_steps: canvas_id + tenant_id afleiden uit pr_processes
    let insertCanvasId = canvasId;
    let insertTenantId = tenantId;
    if (needsProcessLookup) {
      const { data: proc, error: procErr } = await supabase
        .from("pr_processes")
        .select("id, canvas_id, tenant_id")
        .eq("id", body.process_id)
        .maybeSingle();
      if (procErr) return res.status(500).json({ error: procErr.message });
      if (!proc)   return res.status(404).json({ error: "process_id niet gevonden of geen toegang" });
      if (proc.canvas_id !== canvasId) {
        return res.status(400).json({ error: "process_id zit in ander canvas" });
      }
      insertCanvasId = proc.canvas_id;
      insertTenantId = proc.tenant_id;
    }

    const row = { canvas_id: insertCanvasId, tenant_id: insertTenantId };
    for (const f of fields) if (body[f] !== undefined) row[f] = body[f];

    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) {
      // Trigger-exceptions (bv. max-7-stappen) komen als 500; map naar 400/422
      if (error.message?.includes("maximaal 7 processtappen")) {
        return res.status(422).json({ error: error.message });
      }
      if (error.code === "23505") return res.status(409).json({ error: error.message });
      if (error.code === "42501") return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ row: data });
  }

  if (req.method === "PUT") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id is verplicht" });
    const body = req.body || {};
    const patch = {};
    for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "geen velden om te updaten" });

    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ error: error.message });
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ row: data });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id is verplicht" });
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
}

// ══════════════════════════════════════════════════════════════════════════
// Canvas-config (PK = canvas_id, GET / PUT only — UPSERT-pattern)
// ══════════════════════════════════════════════════════════════════════════
async function handleCanvasConfig(ctx, spec) {
  const { supabase, req, res, tenantId } = ctx;
  const { table, fields } = spec;

  if (req.method === "GET") {
    const canvasId = req.query.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
    const { data, error } = await supabase.from(table).select("*").eq("canvas_id", canvasId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    const canvasId = body.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
    const row = { canvas_id: canvasId, tenant_id: tenantId };
    for (const f of fields) if (body[f] !== undefined) row[f] = body[f];

    const { data, error } = await supabase.from(table).upsert(row, { onConflict: "canvas_id" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ row: data });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
}

// ══════════════════════════════════════════════════════════════════════════
// Process × Department M:N matrix
// ══════════════════════════════════════════════════════════════════════════
async function handlePdiMatrix(ctx) {
  const { supabase, req, res, tenantId } = ctx;
  if (req.method === "GET") {
    const canvasId = req.query.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
    const { data, error } = await supabase.from("org_process_department_intensity")
      .select("*").eq("canvas_id", canvasId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }
  if (req.method === "POST") {
    const { canvas_id, process_id, department_id, intensity, process_owner_text } = req.body || {};
    if (!canvas_id || !process_id || !department_id) {
      return res.status(400).json({ error: "canvas_id, process_id en department_id zijn verplicht" });
    }
    const row = {
      canvas_id, tenant_id: tenantId, process_id, department_id,
      intensity: intensity || "involved",
      process_owner_text: process_owner_text ?? null,
    };
    const { data, error } = await supabase.from("org_process_department_intensity").insert(row).select().single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "matrix-rij bestaat al" });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ row: data });
  }
  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id is verplicht" });
    const { error } = await supabase.from("org_process_department_intensity").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
}

// ══════════════════════════════════════════════════════════════════════════
// Schets-upload metadata-INSERT (file zelf → Supabase Storage frontend-direct)
// ══════════════════════════════════════════════════════════════════════════
async function handleSchetsUploadMetadata(ctx) {
  const { supabase, req, res, tenantId } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { canvas_id, file_name, storage_path, mime_type, file_size_bytes } = req.body || {};
  if (!canvas_id || !file_name || !storage_path || !mime_type || !file_size_bytes) {
    return res.status(400).json({ error: "canvas_id, file_name, storage_path, mime_type, file_size_bytes zijn verplicht" });
  }
  const { data, error } = await supabase.from("vo_schets_uploads")
    .insert({ canvas_id, tenant_id: tenantId, file_name, storage_path, mime_type, file_size_bytes })
    .select().single();
  if (error) {
    if (error.message?.includes("file_size_bytes")) return res.status(413).json({ error: "Bestand groter dan 5MB" });
    if (error.message?.includes("mime_type"))       return res.status(400).json({ error: "Alleen PNG/JPG ondersteund" });
    return res.status(500).json({ error: error.message });
  }
  return res.status(201).json({ row: data });
}

// ══════════════════════════════════════════════════════════════════════════
// Pijnpunt-koppelingen (polymorphic 5 target-types, trigger-validatie)
// ══════════════════════════════════════════════════════════════════════════
async function handlePainPointCouplings(ctx) {
  const { supabase, req, res, tenantId } = ctx;
  if (req.method === "GET") {
    const canvasId = req.query.canvas_id;
    if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
    const { data, error } = await supabase.from("po_pain_point_couplings")
      .select("*").eq("canvas_id", canvasId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rows: data });
  }
  if (req.method === "POST") {
    const { pain_point_id, target_table, target_id, canvas_id } = req.body || {};
    if (!pain_point_id || !target_table || !target_id || !canvas_id) {
      return res.status(400).json({ error: "pain_point_id, target_table, target_id, canvas_id zijn verplicht" });
    }
    const { data, error } = await supabase.from("po_pain_point_couplings")
      .insert({ pain_point_id, target_table, target_id, canvas_id, tenant_id: tenantId })
      .select().single();
    if (error) {
      // Trigger-validatie kan croos-canvas-violation geven
      if (error.message?.includes("cross-canvas")) return res.status(400).json({ error: error.message });
      if (error.code === "23505") return res.status(409).json({ error: "koppeling bestaat al" });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ row: data });
  }
  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id is verplicht" });
    const { error } = await supabase.from("po_pain_point_couplings").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
}

// ══════════════════════════════════════════════════════════════════════════
// Coverage-toggle: motivated_no_action met CHECK ≥20 chars
// ══════════════════════════════════════════════════════════════════════════
async function handleCoverageToggle(ctx) {
  const { supabase, req, res } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id, coverage_status, no_action_motivation } = req.body || {};
  if (!id) return res.status(400).json({ error: "id is verplicht" });
  if (!["open", "covered", "motivated_no_action"].includes(coverage_status)) {
    return res.status(400).json({ error: "coverage_status moet één van: open, covered, motivated_no_action" });
  }
  if (coverage_status === "motivated_no_action") {
    if (!no_action_motivation || typeof no_action_motivation !== "string" || no_action_motivation.trim().length < 20) {
      return res.status(400).json({ error: "no_action_motivation min 20 tekens verplicht bij motivated_no_action" });
    }
  }
  const patch = { coverage_status };
  patch.no_action_motivation = coverage_status === "motivated_no_action" ? no_action_motivation.trim() : null;

  const { data, error } = await supabase.from("po_pain_points").update(patch).eq("id", id).select().single();
  if (error) {
    if (error.code === "23514") return res.status(400).json({ error: "motivatie-CHECK geschonden (server-side)" });
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ row: data });
}

// ══════════════════════════════════════════════════════════════════════════
// Intent state-transition: INSERT po_improvement_intent_events → status-sync
// ══════════════════════════════════════════════════════════════════════════
async function handleIntentStateTransition(ctx) {
  const { supabase, req, res, tenantId, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { intent_id, event_type, text_before_md, text_after_md, metadata } = req.body || {};
  const VALID_EVENTS = ["created", "edited", "refined", "made_concept", "made_definitief", "back_to_concept", "dismissed", "restored"];
  if (!intent_id || !VALID_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: `intent_id + event_type (${VALID_EVENTS.join('|')}) verplicht` });
  }

  // Lookup intent voor canvas_id + tenant_id
  const { data: intent, error: lookupErr } = await supabase.from("po_improvement_intents")
    .select("id, canvas_id, tenant_id, current_status").eq("id", intent_id).maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!intent)   return res.status(404).json({ error: "intent niet gevonden of geen toegang" });

  // Profiel-role voor actor_role audit
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();

  const eventRow = {
    intent_id, event_type,
    actor_user_id: user.id,
    actor_role: profile?.role || null,
    text_before_md: text_before_md ?? null,
    text_after_md:  text_after_md  ?? null,
    metadata: metadata || {},
    tenant_id: intent.tenant_id,
    canvas_id: intent.canvas_id,
  };
  const { data, error } = await supabase.from("po_improvement_intent_events").insert(eventRow).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Trigger po_iie_sync_status heeft status al ge-update.
  // Voor edited-events op intent_md: ook intents-row updaten met is_user_edited=true
  if (event_type === "edited" && text_after_md) {
    await supabase.from("po_improvement_intents")
      .update({ is_user_edited: true, intent_md: text_after_md }).eq("id", intent_id);
  }

  return res.status(201).json({ event: data });
}

// ══════════════════════════════════════════════════════════════════════════
// Intent ↔ Pain-point links (coverage-sync-trigger fires)
// ══════════════════════════════════════════════════════════════════════════
async function handleIntentPainLinks(ctx) {
  const { supabase, req, res, tenantId } = ctx;
  if (req.method === "POST") {
    const { intent_id, pain_point_id, canvas_id } = req.body || {};
    if (!intent_id || !pain_point_id || !canvas_id) {
      return res.status(400).json({ error: "intent_id, pain_point_id, canvas_id zijn verplicht" });
    }
    const { data, error } = await supabase.from("po_intent_pain_point_links")
      .insert({ intent_id, pain_point_id, canvas_id, tenant_id: tenantId })
      .select().single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "link bestaat al" });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ row: data });
  }
  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id is verplicht" });
    const { error } = await supabase.from("po_intent_pain_point_links").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }
  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
}

// ══════════════════════════════════════════════════════════════════════════
// Coverage-aggregate (counts per coverage_status — voor banner)
// ══════════════════════════════════════════════════════════════════════════
async function handleCoverageAggregate(ctx) {
  const { supabase, req, res } = ctx;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const canvasId = req.query.canvas_id;
  if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });

  const { data, error } = await supabase.from("po_pain_points")
    .select("coverage_status").eq("canvas_id", canvasId);
  if (error) return res.status(500).json({ error: error.message });

  const counts = { open: 0, covered: 0, motivated_no_action: 0, total: data.length };
  for (const row of data) {
    if (counts[row.coverage_status] !== undefined) counts[row.coverage_status]++;
  }
  return res.status(200).json({ counts });
}

// ══════════════════════════════════════════════════════════════════════════
// 11.M.1 Block-1 — Dossier-AI handlers
// ══════════════════════════════════════════════════════════════════════════

async function handleDossierExtract(ctx) {
  const { supabase, req, res, tenantId, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { canvas_id, entity_type } = req.body || {};
  // Profiel-role voor audit-actor_role
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();
  const result = await extractFromDossier({
    supabase, req,
    canvasId: canvas_id, entityType: entity_type,
    userId: user.id, userRole: profile?.role || null, tenantId,
  });
  return res.status(result.status).json(result.body || {});
}

async function handleDossierFieldsFill(ctx) {
  const { supabase, req, res, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "id is verplicht" });
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();
  const result = await fillProcessFieldsFromDossier({
    supabase, req, itemId: id, userId: user.id, userRole: profile?.role || null,
  });
  return res.status(result.status).json(result.body || {});
}

async function handleImproveChangeApproach(ctx) {
  const { supabase, req, res, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { canvas_id } = req.body || {};
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();
  const result = await improveChangeApproachText({
    supabase, req, canvasId: canvas_id,
    userId: user.id, userRole: profile?.role || null,
  });
  return res.status(result.status).json(result.body || {});
}

async function handleImproveSteeringText(ctx) {
  const { supabase, req, res, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { canvas_id } = req.body || {};
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();
  const result = await improveSteeringText({
    supabase, req, canvasId: canvas_id,
    userId: user.id, userRole: profile?.role || null,
  });
  return res.status(result.status).json(result.body || {});
}

// ══════════════════════════════════════════════════════════════════════════
// 11.M.1 Block-2 — Verbeteracties-AI handler
// ══════════════════════════════════════════════════════════════════════════

async function handleAiImprovementsGenerate(ctx) {
  const { supabase, req, res, user } = ctx;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { canvas_id, source_type } = req.body || {};
  const { data: profile } = await supabase.from("user_profiles").select("role").maybeSingle();
  const result = await generateImprovementsAi({
    supabase, req, canvasId: canvas_id, sourceType: source_type,
    userId: user.id, userRole: profile?.role || null,
  });
  return res.status(result.status).json(result.body || {});
}
