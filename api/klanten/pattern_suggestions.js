/**
 * api/klanten/pattern_suggestions.js — CRUD + acties voor patronen.
 *
 * 11.U Block 2 refactor (RFC-007-rev2 §B):
 * cd_pattern_suggestions is opgegaan in cd_improvement_intents. Dit endpoint
 * behoudt zijn signature (frontend-backwards-compat tot Block 2b UI-refactor),
 * maar leest/schrijft onder de motorkap nu cd_improvement_intents. Vocabulary-
 * mapping:
 *
 *   OUDE FIELD                  NIEUWE FIELD
 *   text_md                  → intent_md
 *   current_status           → status
 *   parent_id                → parent_intent_id
 *   pattern_type             → source_type ('ai_<type>' of 'eigen')
 *   scope/scope_target_id    → bestaat niet meer (canvas-scoped by default)
 *
 *   OUDE STATUS              NIEUWE STATUS
 *   open / edited / refined  → concept
 *   accepted                 → concept (geen aparte accepted-state meer)
 *   rejected                 → dismissed
 *   promoted                 → definitief
 *
 *   OUDE EVENT-TABLE         NIEUWE EVENT-TABLE
 *   cd_pattern_suggestion_events → cd_improvement_intent_events
 *
 * Action-mapping (signatures behouden voor frontend backwards-compat):
 *   accept              → emit 'edited'-event metadata.legacy_action='accept',
 *                         geen status-change (concept blijft concept)
 *   reject              → status='dismissed' + dismissed_at + dismissal_motivation
 *                         (stub-motivatie ≥20 chars); emit 'dismissed'-event
 *   unmark (legacy)     → vanaf 'definitief' → back_to_concept; vanaf 'concept' → no-op
 *   restore             → status='concept' (vanuit 'dismissed'); emit 'restored'-event
 *   promote_to_intent   → status='definitief' + handover_to_roadmap_at; body
 *                         { title, intent_md } update title+intent_md tegelijk
 *                         (in nieuwe model is suggestion al de intent — 1:1)
 *
 * Auth: JWT via Authorization: Bearer. RLS-policy
 * "cd_improvement_intents tenant + eigenaar" doet tenant + canvas-eigenaar-check.
 * tenant_id wordt server-side ingevuld vanuit current_tenant_id() (via tenants).
 */

const { requireAuth } = require("../_auth");
const { userScopedClient } = require("../_template");
const { handleGenerate } = require("./_pattern_generate");
const { handleEvents }   = require("./_pattern_events");
const { handleIntents }  = require("./_improvement_intents");

const TEXT_MAX = 8000;
const ALLOWED_PATTERN_TYPES = ["cluster", "paradox", "positionering", "overstijgend", "eigen"];
const ALLOWED_SCOPES = ["canvas", "dimension", "item"];

// 11.U Block 2: legacy stub voor dismissal_motivation als reject-action geen
// motivation meekrijgt (DB-CHECK eist ≥20 chars wanneer status='dismissed').
const LEGACY_REJECT_MOTIVATION = "Verwijderd via legacy reject-action (pre-RFC-007-rev2)";

module.exports = async function handler(req, res) {
  // Subpath-dispatch (Vercel rewrites consolideren _generate + _events naar deze
  // file om binnen Hobby 12-functions-limit te blijven, zie vercel.json):
  //   - /api/klanten/pattern_suggestions_generate → ?_subpath=generate
  //   - /api/klanten/pattern_suggestion_events    → ?_subpath=events
  const subpath = req.query?._subpath;
  if (subpath === "generate") return handleGenerate(req, res);
  if (subpath === "events")   return handleEvents(req, res);
  if (subpath === "intents")  return handleIntents(req, res);

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

      // 11.U Block 2: lees cd_improvement_intents. source_type IS NOT NULL is
      // altijd waar (alle rijen hebben source_type), maar we filteren op status
      // om de oude OPEN_STATUSES-semantiek te behouden: default = concept,
      // include_done = ook dismissed + definitief.
      let q = supabase
        .from("cd_improvement_intents")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("created_at", { ascending: false });
      if (!includeDone) q = q.eq("status", "concept");

      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });

      // Backwards-compat-mapping naar oud schema voor frontend dat nog
      // cd_pattern_suggestions-velden verwacht (text_md, current_status,
      // pattern_type, parent_id, scope, scope_target_id).
      const mapped = (data || []).map(mapIntentToLegacySuggestion);
      return res.status(200).json({ pattern_suggestions: mapped, intents: data });
    }

    if (req.method === "POST") {
      const id = req.query.id;
      const action = req.query.action;

      // ── Action-routes (accept / reject / promote_to_intent / unmark / restore) ──
      if (id && action) {
        return await handleAction({ supabase, req, res, id, action, tenantId, userRole, userId: user.id });
      }

      // ── Create consultant-eigen patroon (source_type='eigen') ─────────────
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
      // scope/scope_target_id worden in nieuwe model genegeerd (canvas-scoped only).
      // We accepteren ze nog wel als parameter voor backwards-compat met UI; we
      // valideren wel de combi om geen stille semantiek-shift te creëren.
      if (scope === "canvas" && scope_target_id) {
        return res.status(400).json({ error: "scope=canvas mag geen scope_target_id hebben" });
      }
      if (scope !== "canvas" && !scope_target_id) {
        return res.status(400).json({ error: `scope=${scope} vereist scope_target_id` });
      }

      const trimmed = text_md.trim();
      // 11.U Block 2: pattern_type='eigen' → source_type='eigen'; anders 'ai_<type>'
      // (al kan een consultant via POST nooit een ai_*-rij maken — alleen via generate)
      const sourceType = pattern_type === "eigen" ? "eigen" : `ai_${pattern_type}`;

      // INSERT intent
      const { data: created, error: insErr } = await supabase
        .from("cd_improvement_intents")
        .insert({
          canvas_id,
          tenant_id: tenantId,
          title: trimmed.slice(0, 100) || "Eigen patroon",
          intent_md: trimmed,
          source_type: sourceType,
          original_ai_text_md: null,        // consultant-eigen: geen AI-bron
          ai_generated_at: null,
          parent_intent_id: null,
          status: "concept",
          is_user_edited: false,
          vanuit: normalizeVanuit(vanuit),
          sort_order: 0,
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "P0001") return res.status(400).json({ error: insErr.message });
        if (insErr.code === "42501") return res.status(403).json({ error: insErr.message });
        if (insErr.code === "23505") return res.status(409).json({ error: insErr.message });
        return res.status(500).json({ error: insErr.message });
      }

      // INSERT 'created'-event met source='consultant_eigen'
      const { error: evErr } = await supabase
        .from("cd_improvement_intent_events")
        .insert({
          intent_id: created.id,
          event_type: "created",
          actor_user_id: user.id,
          actor_role: userRole,
          text_before_md: null,
          text_after_md: created.intent_md,
          metadata: { source: "consultant_eigen", legacy_pattern_type: pattern_type },
          tenant_id: tenantId,
          canvas_id,
        });
      if (evErr) {
        console.error("[pattern_suggestions POST] event-insert faalde:", evErr.message);
      }

      return res.status(201).json({
        pattern_suggestion: mapIntentToLegacySuggestion(created),
        intent: created,
      });
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

      // Lees huidige intent voor diff + canvas_id
      const { data: existing, error: selErr } = await supabase
        .from("cd_improvement_intents")
        .select("id, intent_md, original_ai_text_md, canvas_id, tenant_id, source_type")
        .eq("id", id)
        .maybeSingle();
      if (selErr) return res.status(500).json({ error: selErr.message });
      if (!existing) return res.status(404).json({ error: "suggestion niet gevonden of geen toegang" });

      const trimmed = text_md.trim();
      const isEditedVsOriginal = existing.original_ai_text_md != null && trimmed !== existing.original_ai_text_md;

      const { data: updated, error: upErr } = await supabase
        .from("cd_improvement_intents")
        .update({
          intent_md: trimmed,
          title: trimmed.slice(0, 100) || existing.intent_md.slice(0, 100),
          is_user_edited: isEditedVsOriginal,
        })
        .eq("id", id)
        .select()
        .single();
      if (upErr) {
        if (upErr.code === "PGRST116") return res.status(404).json({ error: upErr.message });
        return res.status(500).json({ error: upErr.message });
      }

      // INSERT 'edited'-event (alleen als tekst daadwerkelijk wijzigde)
      if (existing.intent_md !== trimmed) {
        const { error: evErr } = await supabase
          .from("cd_improvement_intent_events")
          .insert({
            intent_id: id,
            event_type: "edited",
            actor_user_id: user.id,
            actor_role: userRole,
            text_before_md: existing.intent_md,
            text_after_md: trimmed,
            metadata: { is_user_edited: isEditedVsOriginal, source: "pattern_edit" },
            tenant_id: existing.tenant_id,
            canvas_id: existing.canvas_id,
          });
        if (evErr) console.error("[pattern_suggestions PUT] event-insert faalde:", evErr.message);
      }

      return res.status(200).json({
        pattern_suggestion: mapIntentToLegacySuggestion(updated),
        intent: updated,
      });
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

/**
 * Backwards-compat-mapping: rendert cd_improvement_intents-rij als oud
 * cd_pattern_suggestions-vorm (frontend die nog text_md/current_status verwacht).
 * Block 2b verwijdert deze mapping wanneer UI direct cd_improvement_intents-keys leest.
 */
function mapIntentToLegacySuggestion(intent) {
  if (!intent) return null;
  // status → current_status mapping
  let currentStatus;
  if (intent.status === "dismissed")        currentStatus = "rejected";
  else if (intent.status === "definitief")  currentStatus = "promoted";
  else                                       currentStatus = intent.is_user_edited ? "edited" : "open";

  // source_type → pattern_type mapping
  let patternType;
  if (intent.source_type === "eigen")             patternType = "eigen";
  else if (intent.source_type?.startsWith("ai_")) patternType = intent.source_type.slice(3); // 'ai_cluster' → 'cluster'
  else                                             patternType = "cluster";                  // fallback

  return {
    ...intent,
    text_md: intent.intent_md,
    current_status: currentStatus,
    pattern_type: patternType,
    parent_id: intent.parent_intent_id,
    scope: "canvas",
    scope_target_id: null,
    promoted_to_intent_at: intent.handover_to_roadmap_at,
  };
}

async function handleAction({ supabase, req, res, id, action, tenantId, userRole, userId }) {
  const ALLOWED_ACTIONS = ["accept", "reject", "promote_to_intent", "unmark", "restore"];
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action moet één van: ${ALLOWED_ACTIONS.join(', ')}` });
  }

  // Lees intent voor canvas_id + status-validatie
  const { data: existing, error: selErr } = await supabase
    .from("cd_improvement_intents")
    .select("id, canvas_id, tenant_id, status, intent_md, title, vanuit, source_type, handover_to_roadmap_at")
    .eq("id", id)
    .maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });
  if (!existing) return res.status(404).json({ error: "suggestion niet gevonden of geen toegang" });

  let eventType;
  let updateFields = null;
  let metadataExtra = { legacy_action: action };

  if (action === "accept") {
    // No-op op status (concept blijft concept in nieuwe model). Emit 'edited'
    // voor audit-spoor.
    eventType = "edited";
    metadataExtra.note = "accepted_legacy";
  } else if (action === "reject") {
    if (existing.status === "dismissed") {
      return res.status(409).json({ error: "intent is al dismissed" });
    }
    eventType = "dismissed";
    // 11.U Block 3b: motivation kan nu via body meekomen (MotivatieInput-flow);
    // bij ontbreken vallen we terug op legacy-stub (≥20 chars) zodat
    // bestaande UI-callers blijven werken. Full-retirement van de stub vereist
    // dat alle reject-callers expliciet motivation meegeven — vervolg-cleanup.
    const rejectBody = req?.body || {};
    const providedMotivation = typeof rejectBody.motivation === "string" ? rejectBody.motivation.trim() : "";
    const finalMotivation = providedMotivation.length >= 20
      ? providedMotivation
      : LEGACY_REJECT_MOTIVATION;
    updateFields = {
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissal_motivation: finalMotivation,
    };
    metadataExtra.motivation_source = providedMotivation.length >= 20 ? "user" : "legacy_stub";
  } else if (action === "unmark") {
    // Legacy unmark: was 'accepted'→'open' of 'promoted'→'open'.
    // Nieuwe model: vanaf 'definitief' → back_to_concept; vanaf 'concept' = no-op.
    if (existing.status === "definitief") {
      eventType = "back_to_concept";
      updateFields = {
        status: "concept",
        handover_to_roadmap_at: null,
      };
    } else if (existing.status === "concept") {
      eventType = "edited";
      metadataExtra.note = "unmark_noop_legacy";
    } else {
      return res.status(409).json({ error: "alleen 'concept' of 'definitief' kan ge-unmarkt worden" });
    }
  } else if (action === "restore") {
    if (existing.status !== "dismissed") {
      return res.status(409).json({ error: "alleen dismissed intents kunnen hersteld worden" });
    }
    eventType = "restored";
    updateFields = {
      status: "concept",
      dismissed_at: null,
      dismissal_motivation: null,
    };
  } else if (action === "promote_to_intent") {
    if (existing.status === "definitief") {
      return res.status(409).json({ error: "intent is al definitief" });
    }
    if (existing.status === "dismissed") {
      return res.status(409).json({ error: "dismissed intents kunnen niet gepromoot worden" });
    }
    eventType = "made_definitief";
    const body = req?.body || {};
    const newTitle  = body.title  != null ? String(body.title).trim()      : existing.title;
    const newIntent = body.intent_md != null ? String(body.intent_md).trim() : existing.intent_md;
    if (newTitle.length < 1 || newTitle.length > 100) {
      return res.status(400).json({ error: "title moet 1-100 tekens zijn" });
    }
    if (newIntent.length < 50 || newIntent.length > 2000) {
      return res.status(400).json({ error: "intent_md moet 50-2000 tekens zijn" });
    }
    updateFields = {
      title: newTitle,
      intent_md: newIntent,
      status: "definitief",
      handover_to_roadmap_at: new Date().toISOString(),
    };
    if (body.title != null || body.intent_md != null) {
      metadataExtra.body_updated = true;
    }
  }

  // Apply update first
  if (updateFields) {
    const { error: upErr } = await supabase
      .from("cd_improvement_intents")
      .update(updateFields)
      .eq("id", id);
    if (upErr) {
      if (upErr.code === "P0001") return res.status(400).json({ error: upErr.message });
      if (upErr.code === "23514") return res.status(400).json({ error: upErr.message });
      return res.status(500).json({ error: upErr.message });
    }
  }

  // INSERT event in cd_improvement_intent_events
  const { error: evErr } = await supabase
    .from("cd_improvement_intent_events")
    .insert({
      intent_id: id,
      event_type: eventType,
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: existing.intent_md,
      text_after_md: updateFields?.intent_md || existing.intent_md,
      metadata: metadataExtra,
      tenant_id: existing.tenant_id,
      canvas_id: existing.canvas_id,
    });
  if (evErr) return res.status(500).json({ error: evErr.message });

  // Lees actuele state
  const { data: refreshed, error: rfErr } = await supabase
    .from("cd_improvement_intents")
    .select("*")
    .eq("id", id)
    .single();
  if (rfErr) return res.status(500).json({ error: rfErr.message });

  const legacy = mapIntentToLegacySuggestion(refreshed);
  return res.status(200).json({
    pattern_suggestion: legacy,
    intent: refreshed,
    // Backwards-compat: legacy emission van event_type met oude vocabulary
    event_type:
      eventType === "dismissed"        ? "rejected" :
      eventType === "made_definitief"  ? "promoted_to_intent" :
      eventType === "back_to_concept"  ? "unpromoted" :
      eventType === "restored"         ? "unrejected" :
      "edited",
    new_event_type: eventType,
  });
}
