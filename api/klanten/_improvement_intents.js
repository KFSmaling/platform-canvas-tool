/**
 * api/klanten/_improvement_intents.js — CRUD + acties voor cd_improvement_intents
 * (RFC-001 §2.7, ADR-003 §B fase 4).
 *
 * Geconsolideerd in pattern_suggestions.js via Vercel rewrite
 * (?_subpath=intents) om binnen Hobby 12-functions-limit te blijven.
 * Frontend belt /api/klanten/improvement_intents (rewrite-doel).
 *
 * Method-dispatch:
 *   GET    ?canvas_id=...                            → list intents (sort_order asc, daarna created_at asc)
 *   POST   { canvas_id, title, intent_md, vanuit?, source_suggestion_id?, sort_order? }
 *                                                    → create intent (consultant-eigen of via promote)
 *   PUT    ?id=...  { title?, intent_md?, sort_order? }
 *                                                    → update
 *   DELETE ?id=...                                   → delete
 *   POST   ?id=...&action=handover_to_roadmap        → stub: status='verstuurd' + handover_to_roadmap_at=now()
 *   POST   ?id=...&action=unsend                     → reverse: status='concept' + handover_to_roadmap_at=null
 *
 * Auth: JWT via Authorization: Bearer. RLS-policy
 * "cd_improvement_intents tenant + eigenaar" doet tenant + canvas-eigenaar-check.
 * tenant_id wordt server-side ingevuld vanuit current_tenant_id() (via SELECT
 * op tenants), niet door client meegegeven.
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");

const TITLE_MAX        = 100;
const TITLE_MIN        = 1;
const INTENT_MD_MAX    = 2000;
const INTENT_MD_MIN    = 50;
// 11.U Block 1 (RFC-007-rev2 §B): nieuwe state-machine acties + legacy aliassen
//   make_definitief   = nieuw (concept → definitief, vervangt handover_to_roadmap)
//   back_to_concept   = nieuw (definitief → concept, vervangt unsend)
//   dismiss           = nieuw (concept/definitief → dismissed)
//   restore           = nieuw (dismissed → concept)
//   handover_to_roadmap, unsend = legacy aliassen (blijven werken tot UI-refactor Block 2)
//   create_pain_link  = nieuw (cd_intent_pain_point_links INSERT)
//   delete_pain_link  = nieuw (cd_intent_pain_point_links DELETE)
//   coverage_gauge    = nieuw (GROUP-BY pain_points.coverage_status)
const ALLOWED_ACTIONS  = [
  "handover_to_roadmap", "unsend",
  "make_definitief", "back_to_concept", "dismiss", "restore",
  "create_pain_link", "delete_pain_link", "coverage_gauge",
];
const STATUS_MIN_MOTIVATION = 20; // RFC-007-rev2 §C dismissal_motivation min-length

async function handleIntents(req, res) {
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
        .from("cd_improvement_intents")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      // 11.U Block 2b: include intent_pain_point_links voor Doorloop-view
      // (anders zou frontend een aparte endpoint-call moeten doen).
      const intentIds = (data || []).map(i => i.id);
      let links = [];
      if (intentIds.length > 0) {
        const { data: linkRows, error: linkErr } = await supabase
          .from("cd_intent_pain_point_links")
          .select("*")
          .in("intent_id", intentIds);
        if (linkErr) {
          // Niet-fataal — leeg array fallback, log voor diagnostiek
          console.error("[improvement_intents GET] links-fetch faalde:", linkErr.message);
        } else {
          links = linkRows || [];
        }
      }
      return res.status(200).json({ intents: data, links });
    }

    if (req.method === "POST") {
      const id     = req.query.id;
      const action = req.query.action;

      // ── Action-routes ─────────────────────────────────────────────────
      // 11.U Block 1: coverage_gauge gebruikt canvas_id i.p.v. intent-id;
      // pain_link-acties gebruiken body.pain_point_id.
      if (action === "coverage_gauge") {
        return await handleCoverageGauge({ supabase, res, canvasId: req.query.canvas_id });
      }
      if (id && action) {
        return await handleAction({ supabase, res, id, action, body: req.body || {}, tenantId, user });
      }

      // ── Create intent ────────────────────────────────────────────────────
      const {
        canvas_id, title, intent_md,
        vanuit = null, source_suggestion_id = null,
        sort_order = 0,
      } = req.body || {};

      const validation = validateIntentInput({ canvas_id, title, intent_md });
      if (validation) return res.status(400).json({ error: validation });

      const { data: created, error: insErr } = await supabase
        .from("cd_improvement_intents")
        .insert({
          canvas_id,
          tenant_id: tenantId,
          title:     title.trim(),
          intent_md: intent_md.trim(),
          vanuit:    normalizeVanuit(vanuit),
          source_suggestion_id: source_suggestion_id || null,
          sort_order: typeof sort_order === "number" ? sort_order : 0,
          // status default 'concept', handover_to_roadmap_at NULL, roadmap_action_ids []
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "23505") {
          // Partial unique violation op source_suggestion_id (1:1 promote-relatie)
          return res.status(409).json({ error: "Deze suggestion is al gepromoot naar een intent" });
        }
        if (insErr.code === "42501") return res.status(403).json({ error: insErr.message });
        if (insErr.code === "23514") return res.status(400).json({ error: insErr.message });
        return res.status(500).json({ error: insErr.message });
      }

      return res.status(201).json({ intent: created });
    }

    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht (PUT)" });

      const { title, intent_md, sort_order } = req.body || {};
      const patch = {};

      if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length < TITLE_MIN || title.trim().length > TITLE_MAX) {
          return res.status(400).json({ error: `title moet ${TITLE_MIN}-${TITLE_MAX} tekens zijn` });
        }
        patch.title = title.trim();
      }
      if (intent_md !== undefined) {
        if (typeof intent_md !== "string" || intent_md.trim().length < INTENT_MD_MIN) {
          return res.status(400).json({ error: `intent_md moet minimaal ${INTENT_MD_MIN} tekens zijn` });
        }
        if (intent_md.length > INTENT_MD_MAX) {
          return res.status(400).json({ error: `intent_md overschrijdt ${INTENT_MD_MAX}-char-limiet` });
        }
        patch.intent_md = intent_md.trim();
      }
      if (sort_order !== undefined) {
        if (typeof sort_order !== "number") {
          return res.status(400).json({ error: "sort_order moet een number zijn" });
        }
        patch.sort_order = sort_order;
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "geen velden om te wijzigen" });
      }

      const { data, error } = await supabase
        .from("cd_improvement_intents")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") return res.status(404).json({ error: "intent niet gevonden of geen toegang" });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ intent: data });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_improvement_intents").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/improvement_intents] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function handleAction({ supabase, res, id, action, body, tenantId, user }) {
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action moet één van: ${ALLOWED_ACTIONS.join(', ')}` });
  }

  // 11.U Block 1: nieuwe link-acties (intent-pain-point links)
  if (action === "create_pain_link") {
    return await handleCreatePainLink({ supabase, res, intentId: id, body, tenantId });
  }
  if (action === "delete_pain_link") {
    return await handleDeletePainLink({ supabase, res, intentId: id, body });
  }

  // Lees huidige intent voor state-machine-validatie + canvas-id voor events
  const { data: existing, error: selErr } = await supabase
    .from("cd_improvement_intents")
    .select("id, status, handover_to_roadmap_at, canvas_id, tenant_id, intent_md")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (!existing) return res.status(404).json({ error: "intent niet gevonden of geen toegang" });

  let patch;
  let eventType = null;
  let motivation = null;

  if (action === "handover_to_roadmap" || action === "make_definitief") {
    // 11.U Block 1: legacy + nieuwe naam allebei → status='definitief'
    if (existing.status !== "concept") {
      return res.status(409).json({ error: "alleen concept-intents kunnen definitief gemaakt worden" });
    }
    patch = { status: "definitief", handover_to_roadmap_at: new Date().toISOString() };
    eventType = "made_definitief";
  } else if (action === "unsend" || action === "back_to_concept") {
    if (existing.status !== "definitief") {
      return res.status(409).json({ error: "alleen definitieve intents kunnen terug naar concept" });
    }
    patch = { status: "concept", handover_to_roadmap_at: null };
    eventType = "back_to_concept";
  } else if (action === "dismiss") {
    if (!["concept", "definitief"].includes(existing.status)) {
      return res.status(409).json({ error: "alleen concept/definitief kunnen dismissed worden" });
    }
    motivation = (body && typeof body.motivation === "string") ? body.motivation.trim() : "";
    if (motivation.length < STATUS_MIN_MOTIVATION) {
      return res.status(400).json({ error: `motivation moet minimaal ${STATUS_MIN_MOTIVATION} tekens zijn` });
    }
    patch = { status: "dismissed" };
    eventType = "dismissed";
  } else if (action === "restore") {
    if (existing.status !== "dismissed") {
      return res.status(409).json({ error: "alleen dismissed-intents kunnen restored worden" });
    }
    patch = { status: "concept" };
    eventType = "restored";
  } else {
    return res.status(400).json({ error: `action niet ondersteund: ${action}` });
  }

  const { data, error: upErr } = await supabase
    .from("cd_improvement_intents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (upErr) {
    if (upErr.code === "23514") return res.status(400).json({ error: upErr.message });
    return res.status(500).json({ error: upErr.message });
  }

  // 11.U Block 1: schrijf audit-event (RFC-007-rev2 §D)
  if (eventType) {
    const eventRow = {
      intent_id: id,
      event_type: eventType,
      actor_user_id: user?.id || null,
      tenant_id: existing.tenant_id || tenantId,
      canvas_id: existing.canvas_id,
      metadata: motivation ? { motivation } : {},
    };
    const { error: evErr } = await supabase.from("cd_improvement_intent_events").insert(eventRow);
    if (evErr) {
      // event-write-fout is non-fatal voor UI maar log voor debug
      console.error("[improvement_intent_events] insert mislukt:", evErr.message);
    }
  }

  return res.status(200).json({ intent: data });
}

// 11.U Block 1: link-handlers voor cd_intent_pain_point_links
async function handleCreatePainLink({ supabase, res, intentId, body, tenantId }) {
  const painPointId = body?.pain_point_id;
  if (!intentId || !painPointId) {
    return res.status(400).json({ error: "intent_id en pain_point_id zijn verplicht" });
  }

  // Haal canvas_id uit intent (voor cross-canvas-validatie zal trigger validateren)
  const { data: intent, error: intErr } = await supabase
    .from("cd_improvement_intents")
    .select("canvas_id, tenant_id")
    .eq("id", intentId)
    .maybeSingle();
  if (intErr) return res.status(500).json({ error: intErr.message });
  if (!intent) return res.status(404).json({ error: "intent niet gevonden" });

  const { data: link, error: insErr } = await supabase
    .from("cd_intent_pain_point_links")
    .insert({
      intent_id: intentId,
      pain_point_id: painPointId,
      canvas_id: intent.canvas_id,
      tenant_id: intent.tenant_id || tenantId,
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.code === "23505") return res.status(409).json({ error: "intent + pijnpunt zijn al gekoppeld" });
    if (insErr.message && insErr.message.includes("cross-canvas")) return res.status(400).json({ error: "cross-canvas-koppeling niet toegestaan" });
    if (insErr.message && insErr.message.includes("cross-tenant")) return res.status(400).json({ error: "cross-tenant-koppeling niet toegestaan" });
    return res.status(500).json({ error: insErr.message });
  }
  return res.status(201).json({ link });
}

async function handleDeletePainLink({ supabase, res, intentId, body }) {
  const painPointId = body?.pain_point_id;
  if (!intentId || !painPointId) {
    return res.status(400).json({ error: "intent_id en pain_point_id zijn verplicht" });
  }
  const { error: delErr } = await supabase
    .from("cd_intent_pain_point_links")
    .delete()
    .eq("intent_id", intentId)
    .eq("pain_point_id", painPointId);
  if (delErr) return res.status(500).json({ error: delErr.message });
  return res.status(204).end();
}

// 11.U Block 1: coverage-gauge endpoint — GROUP-BY pain-point coverage_status per canvas.
async function handleCoverageGauge({ supabase, res, canvasId }) {
  if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
  const { data, error } = await supabase
    .from("cd_pain_points")
    .select("coverage_status")
    .eq("canvas_id", canvasId);
  if (error) return res.status(500).json({ error: error.message });

  const gauge = { open: 0, addressed: 0, dismissed: 0, total: 0 };
  (data || []).forEach(row => {
    const s = row.coverage_status || "open";
    if (gauge[s] !== undefined) gauge[s] += 1;
    gauge.total += 1;
  });
  return res.status(200).json({ gauge });
}

function validateIntentInput({ canvas_id, title, intent_md }) {
  if (!canvas_id) return "canvas_id is verplicht";
  if (!title || typeof title !== "string") return "title is verplicht";
  const t = title.trim();
  if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
    return `title moet ${TITLE_MIN}-${TITLE_MAX} tekens zijn`;
  }
  if (!intent_md || typeof intent_md !== "string") return "intent_md is verplicht";
  const m = intent_md.trim();
  if (m.length < INTENT_MD_MIN) return `intent_md moet minimaal ${INTENT_MD_MIN} tekens zijn`;
  if (intent_md.length > INTENT_MD_MAX) return `intent_md overschrijdt ${INTENT_MD_MAX}-char-limiet`;
  return null;
}

function normalizeVanuit(input) {
  if (input == null) return null;
  if (Array.isArray(input)) {
    const cleaned = input.filter(s => typeof s === "string" && s.trim().length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }
  return null;
}

module.exports = { handleIntents };
