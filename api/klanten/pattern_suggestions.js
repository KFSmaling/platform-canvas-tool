/**
 * api/klanten/pattern_suggestions.js — CRUD + acties voor cd_pattern_suggestions
 * (RFC-001 §2.5).
 *
 * Method-dispatch:
 *   GET    ?canvas_id=...                      → list suggestions in canvas
 *                                                 (default: status IN open/edited/refined)
 *          ?canvas_id=...&include_done=1       → ook accepted/rejected/promoted
 *   POST   { canvas_id, pattern_type, text_md, scope?, scope_target_id?, vanuit? }
 *                                              → create consultant-eigen patroon
 *                                                 (geen original_ai_text_md; INSERT
 *                                                  ai_generated-event met
 *                                                  metadata.source='consultant_eigen')
 *   PUT    ?id=...   { text_md? }
 *                                              → edit; bij wijziging vs. original
 *                                                 INSERT edited-event +
 *                                                 zet is_user_edited=true
 *   POST   ?id=...&action=accept               → INSERT accepted-event
 *   POST   ?id=...&action=reject               → INSERT rejected-event
 *   POST   ?id=...&action=promote_to_intent    → set promoted_to_intent_at +
 *                                                 INSERT promoted_to_intent-event
 *                                                 (placeholder voor fase 4 —
 *                                                  feitelijke intent-aanmaak komt 11.H)
 *   DELETE ?id=...                              → delete (CASCADE op events)
 *
 * Auth: JWT via Authorization: Bearer header. RLS-policy
 * "cd_pattern_suggestions tenant + eigenaar" doet tenant + canvas-eigenaar-check.
 * tenant_id wordt server-side ingevuld vanuit current_tenant_id() (via
 * SELECT op tenants).
 *
 * Audit-events worden expliciet geïnsereerd door deze handler — de DB-trigger
 * `cd_ps_sync_current_status` synct daarna `current_status` op de suggestion.
 * `metadata.ai_model` + `metadata.prompt_version` opgeslagen voor reproduceerbaarheid
 * (RFC-001 §6.1, ADR-003 principe 4).
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");

const TEXT_MAX = 8000;
const ALLOWED_PATTERN_TYPES = ["cluster", "paradox", "positionering", "overstijgend", "eigen"];
const ALLOWED_SCOPES = ["canvas", "dimension", "item"];
const OPEN_STATUSES = ["open", "edited", "refined"];

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
  const userRole = (await getUserRole(supabase)) || null;

  try {
    if (req.method === "GET") {
      const canvasId = req.query.canvas_id;
      if (!canvasId) return res.status(400).json({ error: "canvas_id is verplicht" });
      const includeDone = req.query.include_done === "1";

      let q = supabase
        .from("cd_pattern_suggestions")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("created_at", { ascending: false });
      if (!includeDone) q = q.in("current_status", OPEN_STATUSES);

      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ pattern_suggestions: data });
    }

    if (req.method === "POST") {
      const id = req.query.id;
      const action = req.query.action;

      // ── Action-routes (accept / reject / promote_to_intent) ──────────────
      if (id && action) {
        return await handleAction({ supabase, res, id, action, tenantId, userRole, userId: user.id });
      }

      // ── Create consultant-eigen patroon ───────────────────────────────────
      const {
        canvas_id, pattern_type, text_md,
        scope = "canvas", scope_target_id = null,
        vanuit = null,
      } = req.body || {};

      if (!canvas_id) return res.status(400).json({ error: "canvas_id is verplicht" });
      if (!pattern_type || !ALLOWED_PATTERN_TYPES.includes(pattern_type)) {
        return res.status(400).json({ error: `pattern_type moet één van: ${ALLOWED_PATTERN_TYPES.join(', ')}` });
      }
      if (!text_md || typeof text_md !== "string" || !text_md.trim()) {
        return res.status(400).json({ error: "text_md is verplicht" });
      }
      if (text_md.length > TEXT_MAX) {
        return res.status(400).json({ error: `text_md overschrijdt ${TEXT_MAX}-char-limiet` });
      }
      if (!ALLOWED_SCOPES.includes(scope)) {
        return res.status(400).json({ error: `scope moet één van: ${ALLOWED_SCOPES.join(', ')}` });
      }
      if (scope === "canvas" && scope_target_id) {
        return res.status(400).json({ error: "scope=canvas mag geen scope_target_id hebben" });
      }
      if (scope !== "canvas" && !scope_target_id) {
        return res.status(400).json({ error: `scope=${scope} vereist scope_target_id` });
      }

      // INSERT suggestion
      const { data: created, error: insErr } = await supabase
        .from("cd_pattern_suggestions")
        .insert({
          canvas_id,
          tenant_id: tenantId,
          pattern_type,
          text_md: text_md.trim(),
          original_ai_text_md: null,        // consultant-eigen: geen AI-bron
          parent_id: null,
          scope,
          scope_target_id,
          current_status: "open",
          is_user_edited: false,
          vanuit: normalizeVanuit(vanuit),
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "P0001") return res.status(400).json({ error: insErr.message });
        if (insErr.code === "42501") return res.status(403).json({ error: insErr.message });
        return res.status(500).json({ error: insErr.message });
      }

      // INSERT ai_generated-event met source='consultant_eigen' (RFC §6.1)
      const { error: evErr } = await supabase
        .from("cd_pattern_suggestion_events")
        .insert({
          suggestion_id: created.id,
          event_type: "ai_generated",
          actor_user_id: user.id,
          actor_role: userRole,
          text_before_md: null,
          text_after_md: created.text_md,
          metadata: { source: "consultant_eigen" },
          tenant_id: tenantId,
          canvas_id,
        });
      if (evErr) {
        // Suggestion staat — event-fail loggen maar 201 retourneren is verkeerd;
        // beter: rollback. Maar geen transactie-API in supabase-js → log + 207.
        console.error("[pattern_suggestions POST] event-insert faalde:", evErr.message);
      }

      return res.status(201).json({ pattern_suggestion: created });
    }

    if (req.method === "PUT") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht (PUT)" });

      const { text_md } = req.body || {};
      if (text_md === undefined) return res.status(400).json({ error: "text_md is verplicht voor edit" });
      if (typeof text_md !== "string" || !text_md.trim()) {
        return res.status(400).json({ error: "text_md mag niet leeg zijn" });
      }
      if (text_md.length > TEXT_MAX) {
        return res.status(400).json({ error: `text_md overschrijdt ${TEXT_MAX}-char-limiet` });
      }

      // Lees huidige suggestion voor diff + canvas_id
      const { data: existing, error: selErr } = await supabase
        .from("cd_pattern_suggestions")
        .select("id, text_md, original_ai_text_md, canvas_id, tenant_id")
        .eq("id", id)
        .maybeSingle();
      if (selErr) return res.status(500).json({ error: selErr.message });
      if (!existing) return res.status(404).json({ error: "suggestion niet gevonden of geen toegang" });

      const trimmed = text_md.trim();
      const isEditedVsOriginal = existing.original_ai_text_md != null && trimmed !== existing.original_ai_text_md;

      const { data: updated, error: upErr } = await supabase
        .from("cd_pattern_suggestions")
        .update({
          text_md: trimmed,
          is_user_edited: isEditedVsOriginal,
        })
        .eq("id", id)
        .select()
        .single();
      if (upErr) {
        if (upErr.code === "PGRST116") return res.status(404).json({ error: upErr.message });
        return res.status(500).json({ error: upErr.message });
      }

      // INSERT edited-event (alleen als tekst daadwerkelijk wijzigde)
      if (existing.text_md !== trimmed) {
        const { error: evErr } = await supabase
          .from("cd_pattern_suggestion_events")
          .insert({
            suggestion_id: id,
            event_type: "edited",
            actor_user_id: user.id,
            actor_role: userRole,
            text_before_md: existing.text_md,
            text_after_md: trimmed,
            metadata: { is_user_edited: isEditedVsOriginal },
            tenant_id: existing.tenant_id,
            canvas_id: existing.canvas_id,
          });
        if (evErr) console.error("[pattern_suggestions PUT] event-insert faalde:", evErr.message);
      }

      return res.status(200).json({ pattern_suggestion: updated });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is verplicht" });
      const { error } = await supabase.from("cd_pattern_suggestions").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: `Method ${req.method} niet toegestaan` });
  } catch (err) {
    console.error("[api/klanten/pattern_suggestions] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserRole(supabase) {
  const { data } = await supabase.from("user_profiles").select("role").maybeSingle();
  return data?.role || null;
}

function normalizeVanuit(input) {
  if (input == null) return null;
  if (Array.isArray(input)) return input.filter(s => typeof s === "string" && s.trim().length > 0);
  return null;
}

async function handleAction({ supabase, res, id, action, tenantId, userRole, userId }) {
  const ALLOWED_ACTIONS = ["accept", "reject", "promote_to_intent"];
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action moet één van: ${ALLOWED_ACTIONS.join(', ')}` });
  }

  // Lees suggestion voor canvas_id + status-validatie
  const { data: existing, error: selErr } = await supabase
    .from("cd_pattern_suggestions")
    .select("id, canvas_id, tenant_id, current_status, text_md, promoted_to_intent_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (!existing) return res.status(404).json({ error: "suggestion niet gevonden of geen toegang" });

  let eventType;
  let extraUpdate = null;
  if (action === "accept") {
    eventType = "accepted";
  } else if (action === "reject") {
    eventType = "rejected";
  } else if (action === "promote_to_intent") {
    if (existing.current_status !== "accepted") {
      return res.status(409).json({ error: "alleen geaccepteerde suggestions kunnen gepromoot worden" });
    }
    eventType = "promoted_to_intent";
    extraUpdate = { promoted_to_intent_at: new Date().toISOString() };
  }

  // Apply extra update first (alleen voor promote)
  if (extraUpdate) {
    const { error: upErr } = await supabase
      .from("cd_pattern_suggestions")
      .update(extraUpdate)
      .eq("id", id);
    if (upErr) return res.status(500).json({ error: upErr.message });
  }

  // INSERT event — trigger sync't current_status automatisch
  const { error: evErr } = await supabase
    .from("cd_pattern_suggestion_events")
    .insert({
      suggestion_id: id,
      event_type: eventType,
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: existing.text_md,
      text_after_md: existing.text_md,
      metadata: action === "promote_to_intent" ? { placeholder_for_fase_4: true } : {},
      tenant_id: existing.tenant_id,
      canvas_id: existing.canvas_id,
    });
  if (evErr) return res.status(500).json({ error: evErr.message });

  // Lees actuele state na trigger
  const { data: refreshed, error: rfErr } = await supabase
    .from("cd_pattern_suggestions")
    .select("*")
    .eq("id", id)
    .single();
  if (rfErr) return res.status(500).json({ error: rfErr.message });

  return res.status(200).json({ pattern_suggestion: refreshed, event_type: eventType });
}
