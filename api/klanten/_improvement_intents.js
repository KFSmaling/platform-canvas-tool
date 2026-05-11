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
const ALLOWED_ACTIONS  = ["handover_to_roadmap", "unsend"];

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
      return res.status(200).json({ intents: data });
    }

    if (req.method === "POST") {
      const id     = req.query.id;
      const action = req.query.action;

      // ── Action-routes (handover_to_roadmap / unsend) ─────────────────────
      if (id && action) {
        return await handleAction({ supabase, res, id, action });
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

async function handleAction({ supabase, res, id, action }) {
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action moet één van: ${ALLOWED_ACTIONS.join(', ')}` });
  }

  // Lees huidige status voor state-machine-validatie
  const { data: existing, error: selErr } = await supabase
    .from("cd_improvement_intents")
    .select("id, status, handover_to_roadmap_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (!existing) return res.status(404).json({ error: "intent niet gevonden of geen toegang" });

  let patch;
  if (action === "handover_to_roadmap") {
    if (existing.status !== "concept") {
      return res.status(409).json({ error: "alleen concept-intents kunnen verstuurd worden" });
    }
    patch = {
      status: "verstuurd",
      handover_to_roadmap_at: new Date().toISOString(),
    };
  } else { // unsend
    if (existing.status !== "verstuurd") {
      return res.status(409).json({ error: "alleen verstuurde intents kunnen teruggetrokken worden" });
    }
    patch = {
      status: "concept",
      handover_to_roadmap_at: null,
    };
  }

  const { data, error: upErr } = await supabase
    .from("cd_improvement_intents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (upErr) return res.status(500).json({ error: upErr.message });
  return res.status(200).json({ intent: data });
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
