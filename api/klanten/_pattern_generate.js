/**
 * api/klanten/pattern_suggestions_generate.js — Magic-staff-uitbreiding voor
 * scope='canvas' (RFC-001 §9.1, instructie 11.G).
 *
 * POST { canvas_id, action, parent_id?, refinement_focus? }
 *   action ∈ { 'cluster' | 'paradox' | 'positionering' | 'overstijgend' }
 *
 * Flow:
 *   1. Verzamel canvas-context: dimensies + items + pijnpunten + couplings (één
 *      set queries via user-scoped client → RLS).
 *   2. Laad globale prompt-rij via get_app_config_for_tenant (tenant-override
 *      wint, anders globale rij). Render met `renderPrompt` + tenant-tokens.
 *   3. Bouw context-string. Bij grote canvas (>8K chars context-payload):
 *      log-warning + per-dimensie-summarisation-pad nog niet
 *      geïmplementeerd → fallback naar één-traps-call (instructie 11.G:
 *      "kan in productie aangepast worden").
 *   4. Stuur naar Claude (haiku-4-5 default; sonnet bij heavy=true).
 *      max_tokens=2400 (ruim genoeg voor 1-3 suggestions × ~500 tokens).
 *   5. Parseer JSON-array. Strip ```json-fences indien aanwezig.
 *   6. Bulk-INSERT in cd_pattern_suggestions (scope='canvas', current_status='open').
 *   7. INSERT 1 ai_generated-event per suggestion in cd_pattern_suggestion_events
 *      met metadata.ai_model + metadata.prompt_version.
 *   8. Bij parse-error: 500 + raw output in audit-event metadata van een
 *      "synthetic" failed-attempt-suggestion (TODO post-MVP — voor nu: log
 *      raw output server-side, retourneer error naar client).
 *
 * refinement_focus + parent_id flow (refine-deeper):
 *   - parent_id wordt meegegeven → kind-suggestions krijgen die parent_id.
 *   - refinement_focus wordt aan user-message toegevoegd als focus-instructie.
 *   - Op de PARENT wordt een refined_dig_deeper-event geïnsereerd.
 */

const { requireAuth } = require("../_auth");
const { renderPrompt, getTenantVars, userScopedClient } = require("../_template");

// T4 B2.3: 'algemeen' toegevoegd als 5e AI-generatie (zonder pre-bepaalde lens)
const ALLOWED_ACTIONS = ["cluster", "paradox", "positionering", "overstijgend", "algemeen"];
const PROMPT_KEY_PREFIX = "prompt.klanten.";
const PROMPT_VERSION = "11G-v1"; // bumpen bij grote prompt-wijzigingen
const MAX_SUGGESTIONS_PER_CALL = 5;
const CONTEXT_TOKEN_WARN_THRESHOLD = 8000; // ruwe char-count, geen echte tokens

// Geconsolideerd in pattern_suggestions.js via Vercel rewrite (?_subpath=generate)
// om binnen Hobby 12-functions-limit te blijven. Frontend-URLs onveranderd
// (Vercel rewrite zorgt dat /api/klanten/pattern_suggestions_generate naar
// dezelfde lambda gaat). Deze module wordt geïmporteerd door pattern_suggestions.js.
async function handleGenerate(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" });

  const supabase = userScopedClient(req);
  if (!supabase) return res.status(500).json({ error: "Supabase niet geconfigureerd" });

  const { canvas_id, action, parent_id = null, refinement_focus = null } = req.body || {};
  if (!canvas_id) return res.status(400).json({ error: "canvas_id is verplicht" });
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action moet één van: ${ALLOWED_ACTIONS.join(', ')}` });
  }

  try {
    // ── 1. tenant + role afleiden ────────────────────────────────────────────
    const { data: tenantRow } = await supabase.from("tenants").select("id").maybeSingle();
    if (!tenantRow) return res.status(403).json({ error: "Tenant niet gevonden voor deze user" });
    const tenantId = tenantRow.id;
    const { data: profileRow } = await supabase.from("user_profiles").select("role").maybeSingle();
    const userRole = profileRow?.role || null;

    // ── 2. parent-suggestion-validatie (refine-deeper) ───────────────────────
    let parentRow = null;
    if (parent_id) {
      const { data: parent, error: pErr } = await supabase
        .from("cd_pattern_suggestions")
        .select("id, canvas_id, pattern_type, text_md, current_status, scope")
        .eq("id", parent_id)
        .maybeSingle();
      if (pErr)        return res.status(500).json({ error: pErr.message });
      if (!parent)     return res.status(404).json({ error: "parent suggestion niet gevonden" });
      if (parent.canvas_id !== canvas_id) {
        return res.status(400).json({ error: "parent_id zit in ander canvas" });
      }
      parentRow = parent;
      // Refine-deeper: kind erft type van parent. Cluster-parent met paradox-prompt-
      // call zou onbruikbare output geven; AI heeft de parent-context nodig om
      // zinvol "dieper te graven". Uitzondering: parent.pattern_type='eigen' (consultant-
      // eigen patroon zonder AI-prompt) — daar mag elke action-keuze, want de AI-call
      // is een nieuwe analyse onafhankelijk van consultant-eigen-tekst. Validatie
      // bevestigd door reviewer 2026-05-07T21:00 (akkoord op open punt 4).
      if (parent.pattern_type !== action && parent.pattern_type !== "eigen") {
        return res.status(400).json({
          error: `action=${action} klopt niet bij parent.pattern_type=${parent.pattern_type}`,
        });
      }
    }

    // ── 3. canvas-context ophalen ────────────────────────────────────────────
    const ctx = await fetchCanvasContext(supabase, canvas_id);
    if (ctx.error) return res.status(500).json({ error: ctx.error });
    if (ctx.painPoints.length === 0) {
      return res.status(409).json({ error: "Canvas heeft geen pijnpunten — voeg eerst pijnpunten toe in fase 2" });
    }

    // ── 4. prompt laden via tenant-aware RPC ──────────────────────────────────
    const promptKey = `${PROMPT_KEY_PREFIX}${action}`;
    const rawPrompt = await loadPromptViaRPC(supabase, promptKey);
    if (!rawPrompt) {
      return res.status(500).json({ error: `Prompt ${promptKey} niet gevonden in app_config` });
    }

    // ── 5. tokens + render ──────────────────────────────────────────────────
    const tenantVars = await getTenantVars(supabase);
    const systemPrompt = renderPrompt(rawPrompt, tenantVars);

    // ── 6. context-string bouwen ─────────────────────────────────────────────
    const contextString = buildCanvasContextString(ctx);
    if (contextString.length > CONTEXT_TOKEN_WARN_THRESHOLD) {
      console.warn(
        `[pattern_suggestions/generate] context-payload ${contextString.length} chars > ${CONTEXT_TOKEN_WARN_THRESHOLD} ` +
        `— twee-traps-summarisation niet geïmplementeerd in MVP-fase-3, één-traps-fallback`
      );
    }

    const userParts = [`CANVAS-CONTEXT:\n\n${contextString}`];
    if (parent_id && refinement_focus) {
      userParts.push(
        `VERFIJNINGS-FOCUS (graaf dieper t.o.v. parent-suggestie):\n` +
        `Parent-tekst: "${parentRow.text_md}"\n` +
        `Focus: ${String(refinement_focus).slice(0, 500)}\n\n` +
        `Lever 1 verfijnde suggestie die specifieker is dan de parent. Zelfde JSON-formaat.`
      );
    }

    // ── 7. Claude-call ───────────────────────────────────────────────────────
    const model = "claude-haiku-4-5-20251001";
    let response, data;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2400,
          system: systemPrompt,
          messages: [{ role: "user", content: userParts.join("\n\n") }],
        }),
      });
      data = await response.json();
    } catch (fetchErr) {
      console.error("[pattern_suggestions/generate] Anthropic fetch fout:", fetchErr.message);
      return res.status(502).json({ error: "AI-service niet bereikbaar", detail: fetchErr.message });
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "AI fout" });
    }
    const rawOutput = (data.content || []).map(c => c.text || "").join("").trim();

    // ── 8. Parse JSON-array (strip code-fence indien aanwezig) ──────────────
    const parsed = tryParseSuggestionsJson(rawOutput);
    if (!parsed.ok) {
      console.error("[pattern_suggestions/generate] parse-error:", parsed.error, "\nraw:", rawOutput.slice(0, 500));
      return res.status(500).json({
        error: "AI-output kon niet geparsed worden als JSON-array",
        detail: parsed.error,
        raw_output_excerpt: rawOutput.slice(0, 500),
      });
    }

    const items = parsed.value.slice(0, MAX_SUGGESTIONS_PER_CALL);
    if (items.length === 0) {
      return res.status(200).json({ pattern_suggestions: [], note: "AI vond geen patronen" });
    }

    // ── 9. bulk-INSERT in cd_pattern_suggestions ─────────────────────────────
    const rows = items.map(item => ({
      canvas_id,
      tenant_id: tenantId,
      pattern_type: parent_id ? parentRow.pattern_type : action, // bij refine-deeper: kind erft type
      text_md: String(item.text || "").trim().slice(0, 8000),
      original_ai_text_md: String(item.text || "").trim().slice(0, 8000),
      parent_id: parent_id || null,
      scope: "canvas",
      scope_target_id: null,
      current_status: "open",
      is_user_edited: false,
      vanuit: Array.isArray(item.vanuit) ? item.vanuit : null,
    })).filter(r => r.text_md.length > 0);

    if (rows.length === 0) {
      return res.status(500).json({ error: "Geen geldige suggestions in AI-output (lege text-velden)" });
    }

    const { data: insertedSuggestions, error: insErr } = await supabase
      .from("cd_pattern_suggestions")
      .insert(rows)
      .select();
    if (insErr) {
      if (insErr.code === "P0001") return res.status(400).json({ error: insErr.message });
      if (insErr.code === "42501") return res.status(403).json({ error: insErr.message });
      return res.status(500).json({ error: insErr.message });
    }

    // ── 10. INSERT ai_generated-event per nieuwe suggestion ──────────────────
    const eventRows = insertedSuggestions.map(s => ({
      suggestion_id: s.id,
      event_type: "ai_generated",
      actor_user_id: user.id,
      actor_role: userRole,
      text_before_md: null,
      text_after_md: s.text_md,
      metadata: {
        ai_model: model,
        prompt_key: promptKey,
        prompt_version: PROMPT_VERSION,
        action,
        parent_id: parent_id || null,
        refinement_focus: refinement_focus || null,
      },
      tenant_id: tenantId,
      canvas_id,
    }));
    const { error: evErr } = await supabase
      .from("cd_pattern_suggestion_events")
      .insert(eventRows);
    if (evErr) {
      console.error("[pattern_suggestions/generate] event-bulk-insert faalde:", evErr.message);
      // niet-fataal voor de response — suggesties zijn opgeslagen
    }

    // ── 11. bij refine-deeper: refined_dig_deeper-event op PARENT ────────────
    if (parent_id) {
      const { error: parentEvErr } = await supabase
        .from("cd_pattern_suggestion_events")
        .insert({
          suggestion_id: parent_id,
          event_type: "refined_dig_deeper",
          actor_user_id: user.id,
          actor_role: userRole,
          text_before_md: parentRow.text_md,
          text_after_md: parentRow.text_md,
          metadata: {
            ai_model: model,
            prompt_key: promptKey,
            prompt_version: PROMPT_VERSION,
            refinement_focus: refinement_focus || null,
            child_suggestion_ids: insertedSuggestions.map(s => s.id),
          },
          tenant_id: tenantId,
          canvas_id,
        });
      if (parentEvErr) {
        console.error("[pattern_suggestions/generate] parent-event faalde:", parentEvErr.message);
      }
    }

    return res.status(201).json({
      pattern_suggestions: insertedSuggestions,
      ai_model: model,
      prompt_version: PROMPT_VERSION,
      context_chars: contextString.length,
    });
  } catch (err) {
    console.error("[api/klanten/pattern_suggestions_generate] onverwachte fout:", err);
    return res.status(500).json({ error: err.message || "interne fout" });
  }
}

module.exports = { handleGenerate };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCanvasContext(supabase, canvasId) {
  try {
    const [dimsRes, itemsRes, painRes, coRes] = await Promise.all([
      supabase.from("cd_dimensions").select("id, archetype, name, description, sort_order").eq("canvas_id", canvasId).order("sort_order"),
      supabase.from("cd_items").select("id, dimension_id, name, description, archetype_data, sort_order").eq("canvas_id", canvasId).order("sort_order"),
      supabase.from("cd_pain_points").select("id, text_md, is_floating, sort_order").eq("canvas_id", canvasId).order("sort_order"),
      supabase.from("cd_pain_point_couplings").select("id, pain_point_id, target_table, target_id").eq("canvas_id", canvasId),
    ]);
    if (dimsRes.error)  return { error: dimsRes.error.message };
    if (itemsRes.error) return { error: itemsRes.error.message };
    if (painRes.error)  return { error: painRes.error.message };
    if (coRes.error)    return { error: coRes.error.message };
    return {
      dimensions: dimsRes.data || [],
      items:      itemsRes.data || [],
      painPoints: painRes.data || [],
      couplings:  coRes.data || [],
    };
  } catch (err) {
    return { error: err.message };
  }
}

function buildCanvasContextString({ dimensions, items, painPoints, couplings }) {
  const lines = [];

  // Dimensies + items (geneste view per dim)
  lines.push("## DIMENSIES + ITEMS");
  for (const dim of dimensions) {
    lines.push(`\n### ${dim.archetype}: ${dim.name}` + (dim.description ? ` — ${dim.description}` : ""));
    const dimItems = items.filter(it => it.dimension_id === dim.id);
    if (dimItems.length === 0) {
      lines.push("(geen items)");
      continue;
    }
    for (const it of dimItems) {
      const ad = it.archetype_data || {};
      const adKeys = Object.keys(ad).filter(k => ad[k] != null && String(ad[k]).trim().length > 0);
      const adStr = adKeys.length > 0
        ? ` [${adKeys.map(k => `${k}=${truncate(String(ad[k]), 80)}`).join(", ")}]`
        : "";
      lines.push(`- ${it.name}${it.description ? `: ${truncate(it.description, 120)}` : ""}${adStr}`);
    }
  }

  // Pijnpunten + koppelingen
  lines.push("\n## PIJNPUNTEN + KOPPELINGEN");
  if (painPoints.length === 0) {
    lines.push("(geen pijnpunten)");
  } else {
    const dimById = new Map(dimensions.map(d => [d.id, d]));
    const itById  = new Map(items.map(i => [i.id, i]));
    for (const pp of painPoints) {
      const ppCouplings = couplings.filter(c => c.pain_point_id === pp.id);
      const coupStr = ppCouplings.length === 0
        ? " [overstijgend — geen koppeling]"
        : " [koppelingen: " + ppCouplings.map(c => {
            if (c.target_table === "cd_dimensions") {
              const d = dimById.get(c.target_id);
              return d ? `dim:${d.name}` : "dim:?";
            }
            const i = itById.get(c.target_id);
            return i ? `item:${i.name}` : "item:?";
          }).join(", ") + "]";
      lines.push(`- "${truncate(pp.text_md, 300)}"${coupStr}`);
    }
  }

  return lines.join("\n");
}

function truncate(s, n) {
  if (typeof s !== "string") return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/**
 * Probeer raw output als JSON-array te parsen. Strip optioneel een markdown-
 * code-fence (```json ... ``` of ``` ... ```). Bij parse-error → { ok:false, error }.
 */
function tryParseSuggestionsJson(raw) {
  if (typeof raw !== "string") return { ok: false, error: "raw is geen string" };
  let s = raw.trim();
  // Strip ```json...``` of ```...```
  const fenceMatch = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  // Soms staat er nog een leading "Hier zijn de suggesties:" — neem alleen vanaf eerste [
  const firstBracket = s.indexOf("[");
  if (firstBracket > 0) s = s.slice(firstBracket);
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return { ok: false, error: "parsed is geen array" };
    // valideer items
    for (const item of parsed) {
      if (typeof item !== "object" || item == null) return { ok: false, error: "item is geen object" };
      if (typeof item.text !== "string") return { ok: false, error: "item.text ontbreekt of is geen string" };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function loadPromptViaRPC(supabase, key) {
  // Probeer eerst de tenant-aware RPC. Bij ontbreken (oude schema): fallback
  // naar directe SELECT op app_config met tenant_id IS NULL.
  try {
    const { data, error } = await supabase.rpc("get_app_config_for_tenant");
    if (!error && Array.isArray(data)) {
      const row = data.find(r => r.key === key);
      if (row?.value) return row.value;
    }
  } catch (_) { /* fall through */ }
  const { data: row } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .is("tenant_id", null)
    .maybeSingle();
  return row?.value || null;
}
