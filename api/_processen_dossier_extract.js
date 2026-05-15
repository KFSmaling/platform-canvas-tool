/**
 * api/_processen_dossier_extract.js — Helper voor 11.M.1 dossier-driven AI-affordances.
 *
 * Pattern-anker: api/klanten/_dossier_extract.js (RFC-002 §6, stap 11.K).
 *
 * Eén generic-extract-dispatcher voor 6 entity-affordances:
 *   processes         → pr_processes
 *   departments       → org_departments
 *   business_units    → vo_business_units
 *   value_teams       → vo_value_teams
 *   control_processes → gov_control_processes
 *   pain_points       → po_pain_points (cross-cutting met proposed_couplings)
 *
 * Plus fields-fill voor pr_processes (5 jsonb-archetype-velden):
 *   strategisch_label / volwassenheid / pijnpunten / kritieke_afhankelijkheden / bewuste_inrichting
 *
 * Plus rich-text-verbeter (2 prompts):
 *   improveChangeApproach  → vo_change_approach.text_md
 *   improveSteeringText    → gov_steering_model.text_md
 *
 * Audit-trail: alle events landen in po_input_suggestion_events met
 * polymorphic target_table + target_id (7 target-types ondersteund).
 *
 * RAG-pattern: OpenAI text-embedding-3-small + Supabase match_document_chunks RPC.
 * Parse-pattern: tryParseJsonArray/Object met markdown-fence-strip.
 */

const { renderPrompt, getTenantVars, userScopedClient } = require("./_template");

const AI_MODEL          = "claude-haiku-4-5-20251001";
const PROMPT_VERSION    = "11M1-v1";
const RAG_MATCH_COUNT   = 8;
const AI_MAX_TOKENS     = 2400;

// Affordance-spec per entity-type
const ENTITY_SPEC = {
  processes: {
    table: "pr_processes",
    promptKey: "prompt.processen.dossier.processes_extract",
    affordance: "processes_from_dossier",
    maxItems: 5,
    requiredField: "name",
    pickFields: ["name", "description", "archetype"],
    extraInsertFields: { is_draft: true, archetype_data: {}, sort_order: 0 },
  },
  departments: {
    table: "org_departments",
    promptKey: "prompt.processen.dossier.departments_extract",
    affordance: "departments_from_dossier",
    maxItems: 8,
    requiredField: "name",
    pickFields: ["name", "description"],
    extraInsertFields: { is_draft: true, sort_order: 0 },
  },
  business_units: {
    table: "vo_business_units",
    promptKey: "prompt.processen.dossier.business_units_extract",
    affordance: "business_units_from_dossier",
    maxItems: 6,
    requiredField: "name",
    pickFields: ["name", "description"],
    extraInsertFields: { is_draft: true, sort_order: 0 },
  },
  value_teams: {
    table: "vo_value_teams",
    promptKey: "prompt.processen.dossier.value_teams_extract",
    affordance: "value_teams_from_dossier",
    maxItems: 8,
    requiredField: "name",
    pickFields: ["name", "description", "relation_tags"],
    extraInsertFields: { is_draft: true, sort_order: 0 },
  },
  control_processes: {
    table: "gov_control_processes",
    promptKey: "prompt.processen.dossier.control_processes_extract",
    affordance: "control_processes_from_dossier",
    maxItems: 6,
    requiredField: "name",
    pickFields: ["name", "description", "control_type"],
    extraInsertFields: { is_draft: true, sort_order: 0 },
  },
  pain_points: {
    table: "po_pain_points",
    promptKey: "prompt.processen.dossier.pain_points_extract",
    affordance: "pain_points_from_dossier",
    maxItems: 7,
    requiredField: "text_md",
    pickFields: ["text_md"],
    extraInsertFields: { is_draft: true, sort_order: 0, is_floating: true, coverage_status: "open" },
  },
};

// Pr_processes archetype-velden (RFC-005 §4 jsonb 5-velden)
const PR_ARCHETYPE_FIELDS = ["strategisch_label", "volwassenheid", "pijnpunten", "kritieke_afhankelijkheden", "bewuste_inrichting"];

// ── Public entrypoints ────────────────────────────────────────────────────

/**
 * Generic dossier-extract dispatcher voor 6 entity-types.
 * Body: { canvas_id, entity_type }
 */
async function extractFromDossier({ supabase, req, canvasId, entityType, userId, userRole, tenantId }) {
  if (!canvasId || !entityType) {
    return { status: 400, body: { error: "canvas_id en entity_type zijn verplicht" } };
  }
  const spec = ENTITY_SPEC[entityType];
  if (!spec) {
    return { status: 400, body: { error: `Onbekend entity_type: ${entityType}. Geldig: ${Object.keys(ENTITY_SPEC).join(',')}` } };
  }

  // Canvas + tenant + existing-items context
  const { data: canvas } = await supabase.from("canvases").select("id, tenant_id").eq("id", canvasId).maybeSingle();
  if (!canvas) return { status: 404, body: { error: "canvas niet gevonden of geen toegang" } };
  const canvasTenant = canvas.tenant_id;

  // Bestaande items in tabel binnen canvas (voor dedupe-hint in prompt-message)
  const { data: existing } = await supabase
    .from(spec.table).select("id, " + spec.pickFields.join(", ") + ", is_draft")
    .eq("canvas_id", canvasId);

  // Voor pain_points + control_processes: blokkeer als geen canonical context (RFC-002 §8.3 anker)
  if (entityType === "pain_points") {
    const { data: anyItems } = await supabase
      .from("pr_processes").select("id").eq("canvas_id", canvasId).eq("is_draft", false).limit(1);
    if (!anyItems || anyItems.length === 0) {
      return { status: 409, body: { error: "Voeg eerst (canonical) bedrijfsprocessen of afdelingen toe voordat je pijnpunten extraheert" } };
    }
  }

  // RAG-call
  const query = buildRagQuery(entityType);
  const ragResult = await runRagQuery({ req, query, canvasId });
  if (ragResult.error) return { status: 502, body: { error: ragResult.error } };
  if (ragResult.chunks.length === 0) {
    return { status: 200, body: { items: [], note: "Geen relevante chunks in dossier voor dit entity-type" } };
  }

  // Prompt + Claude-call
  const rawPrompt = await loadPromptViaRPC(supabase, spec.promptKey);
  if (!rawPrompt) return { status: 500, body: { error: `Prompt ${spec.promptKey} niet gevonden` } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);
  const userMessage = buildEntityUserMessage({ entityType, existing: existing || [], chunks: ragResult.chunks });

  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const parsed = tryParseJsonArray(aiResult.raw);
  if (!parsed.ok) {
    console.error(`[_processen_dossier:${entityType}] parse-error:`, parsed.error, "\nraw:", aiResult.raw.slice(0, 500));
    return { status: 500, body: { error: "AI-output kon niet geparsed worden", detail: parsed.error } };
  }

  // Filter + bulk-INSERT
  const proposed = parsed.value
    .slice(0, spec.maxItems)
    .filter(it => typeof it?.[spec.requiredField] === "string" && it[spec.requiredField].trim().length > 0);
  if (proposed.length === 0) {
    return { status: 200, body: { items: [], note: `AI vond geen ${entityType} in dossier` } };
  }

  const baseSort = (existing?.length || 0) * 10;
  const rows = proposed.map((it, idx) => {
    const row = { canvas_id: canvasId, tenant_id: canvasTenant, ...spec.extraInsertFields };
    for (const f of spec.pickFields) {
      const v = it[f];
      if (v !== undefined && v !== null) {
        if (typeof v === "string") row[f] = v.trim().slice(0, 5000);
        else row[f] = v;
      }
    }
    row.sort_order = baseSort + (idx + 1) * 10;
    return row;
  });

  const { data: inserted, error: insErr } = await supabase.from(spec.table).insert(rows).select();
  if (insErr) return { status: insErr.code === "42501" ? 403 : 500, body: { error: insErr.message } };

  // Audit-events met polymorphic target_table
  const events = inserted.map((row, idx) => {
    const proposedCouplings = entityType === "pain_points" && Array.isArray(proposed[idx]?.proposed_couplings)
      ? proposed[idx].proposed_couplings
          .filter(c => c?.target_table && typeof c?.target_id === "string")
          .map(c => ({ target_table: c.target_table, target_id: c.target_id, reden: typeof c?.reden === "string" ? c.reden.slice(0, 300) : null }))
      : [];
    return {
      target_table: spec.table,
      target_id: row.id,
      affordance: spec.affordance,
      event_type: "ai_generated",
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: null,
      text_after_md: row[spec.requiredField] + (row.description ? "\n\n" + row.description : ""),
      metadata: {
        ai_model: AI_MODEL,
        prompt_key: spec.promptKey,
        prompt_version: PROMPT_VERSION,
        sources: Array.isArray(proposed[idx]?.sources) ? proposed[idx].sources : [],
        chunk_count: ragResult.chunks.length,
        ...(proposedCouplings.length > 0 && { proposed_couplings: proposedCouplings }),
      },
      tenant_id: canvasTenant,
      canvas_id: canvasId,
    };
  });
  await insertEventsBestEffort(supabase, events);

  return { status: 201, body: { items: inserted, ai_model: AI_MODEL, prompt_version: PROMPT_VERSION, chunk_count: ragResult.chunks.length } };
}

/**
 * A2-equivalent voor pr_processes: vul 5 jsonb-archetype-velden uit dossier.
 * Body: { id } (process_id)
 */
async function fillProcessFieldsFromDossier({ supabase, req, itemId, userId, userRole }) {
  if (!itemId) return { status: 400, body: { error: "id is verplicht" } };

  const { data: item, error: selErr } = await supabase
    .from("pr_processes")
    .select("id, canvas_id, tenant_id, name, description, archetype, archetype_data, is_draft")
    .eq("id", itemId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!item)  return { status: 404, body: { error: "proces niet gevonden of geen toegang" } };

  // RAG query op process-name + archetype
  const query = `${item.name} ${item.archetype}${item.description ? " " + item.description.slice(0, 200) : ""}`;
  const ragResult = await runRagQuery({ req, query, canvasId: item.canvas_id });
  if (ragResult.error) return { status: 502, body: { error: ragResult.error } };
  if (ragResult.chunks.length === 0) {
    return { status: 200, body: { item, proposed_fields: {}, note: "Geen relevante chunks in dossier" } };
  }

  // Use processes_extract-prompt with custom user-message for field-filling
  const rawPrompt = await loadPromptViaRPC(supabase, "prompt.processen.dossier.processes_extract");
  if (!rawPrompt) return { status: 500, body: { error: "Prompt processes_extract niet gevonden" } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);

  const userMessage = buildProcessFieldsUserMessage({ item, chunks: ragResult.chunks });

  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const parsed = tryParseJsonObject(aiResult.raw);
  if (!parsed.ok) {
    return { status: 500, body: { error: "AI-output kon niet geparsed worden", detail: parsed.error } };
  }

  // Filter proposed_fields op allowed-keys + niet-leeg + skip-already-filled
  const proposedRaw = parsed.value.proposed_fields || parsed.value || {};
  const proposedFields = {};
  for (const key of PR_ARCHETYPE_FIELDS) {
    const v = proposedRaw[key];
    if (typeof v === "string" && v.trim().length > 0) {
      const existing = item.archetype_data?.[key];
      if (!existing || String(existing).trim().length === 0) {
        proposedFields[key] = v.trim();
      }
    }
  }

  if (Object.keys(proposedFields).length === 0) {
    await insertEventsBestEffort(supabase, [{
      target_table: "pr_processes",
      target_id: item.id,
      affordance: "fields_from_dossier",
      event_type: "ai_generated",
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: null,
      text_after_md: null,
      metadata: { ai_model: AI_MODEL, prompt_version: PROMPT_VERSION, proposed_fields: {}, chunk_count: ragResult.chunks.length, empty: true },
      tenant_id: item.tenant_id,
      canvas_id: item.canvas_id,
    }]);
    return { status: 200, body: { item, proposed_fields: {}, note: "AI vond geen onderbouwing voor lege velden" } };
  }

  // Merge fields + zet is_draft=true wanneer canonical was
  const mergedFields = { ...(item.archetype_data || {}), ...proposedFields };
  const patch = { archetype_data: mergedFields };
  if (!item.is_draft) patch.is_draft = true;

  const { data: updated, error: upErr } = await supabase
    .from("pr_processes").update(patch).eq("id", item.id).select().single();
  if (upErr) return { status: upErr.code === "42501" ? 403 : 500, body: { error: upErr.message } };

  await insertEventsBestEffort(supabase, [{
    target_table: "pr_processes",
    target_id: item.id,
    affordance: "fields_from_dossier",
    event_type: "ai_generated",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: JSON.stringify(item.archetype_data || {}),
    text_after_md: JSON.stringify(mergedFields),
    metadata: {
      ai_model: AI_MODEL,
      prompt_version: PROMPT_VERSION,
      proposed_fields: proposedFields,
      chunk_count: ragResult.chunks.length,
      previous_is_draft: item.is_draft,
    },
    tenant_id: item.tenant_id,
    canvas_id: item.canvas_id,
  }]);

  return { status: 200, body: { item: updated, proposed_fields: proposedFields, ai_model: AI_MODEL, prompt_version: PROMPT_VERSION } };
}

/**
 * Rich-text verbeter voor vo_change_approach.text_md.
 * Body: { canvas_id }
 */
async function improveChangeApproachText({ supabase, req, canvasId, userId, userRole }) {
  return improveRichTextField({
    supabase, req, canvasId, userId, userRole,
    table: "vo_change_approach", field: "text_md", pkField: "canvas_id",
    promptKey: "prompt.processen.improve.change_approach",
    ragQuery: "veranderaanpak organisatie change management transformatie",
  });
}

/**
 * Rich-text verbeter voor gov_steering_model.text_md.
 * Body: { canvas_id }
 */
async function improveSteeringText({ supabase, req, canvasId, userId, userRole }) {
  return improveRichTextField({
    supabase, req, canvasId, userId, userRole,
    table: "gov_steering_model", field: "text_md", pkField: "canvas_id",
    promptKey: "prompt.processen.improve.steering_text",
    ragQuery: "sturingsmodel governance besluitvorming coördinatie",
  });
}

async function improveRichTextField({ supabase, req, canvasId, userId, userRole, table, field, pkField, promptKey, ragQuery }) {
  if (!canvasId) return { status: 400, body: { error: "canvas_id is verplicht" } };

  const { data: row, error: selErr } = await supabase
    .from(table).select(`${pkField}, tenant_id, ${field}`).eq(pkField, canvasId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!row)   return { status: 404, body: { error: `${table}-rij niet gevonden voor canvas — vul eerst de tekst handmatig in` } };
  const currentText = row[field] || "";
  if (currentText.trim().length === 0) {
    return { status: 400, body: { error: "Vul eerst een initiële tekst in vóór AI-verbeter" } };
  }

  // RAG-context
  const ragResult = await runRagQuery({ req, query: ragQuery, canvasId });
  // RAG-fail is niet fataal voor improve — fall back op general-knowledge
  const chunks = ragResult.chunks || [];

  const rawPrompt = await loadPromptViaRPC(supabase, promptKey);
  if (!rawPrompt) return { status: 500, body: { error: `Prompt ${promptKey} niet gevonden` } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);

  const userMessage = buildImproveUserMessage({ currentText, chunks });

  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const improved = aiResult.raw.trim();
  if (!improved) return { status: 500, body: { error: "AI gaf lege output" } };

  // Update DB
  const { data: updated, error: upErr } = await supabase
    .from(table).update({ [field]: improved }).eq(pkField, canvasId).select().single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  return { status: 200, body: { row: updated, before: currentText, after: improved, ai_model: AI_MODEL } };
}

// ── Private helpers ───────────────────────────────────────────────────────

function buildRagQuery(entityType) {
  const queries = {
    processes: "bedrijfsprocessen primair ondersteunend besturend procesketen klant",
    departments: "afdeling organisatie team lijnorganisatie functioneel",
    business_units: "business unit bedrijfsdivisie strategische eenheid",
    value_teams: "value team waardeteam crossfunctioneel samenwerking",
    control_processes: "control governance jaarplan rapportage bijsturing",
    pain_points: "knelpunten frustraties bottleneck inefficiëntie risico",
  };
  return queries[entityType] || entityType;
}

function buildEntityUserMessage({ entityType, existing, chunks }) {
  const lines = [];
  lines.push(`ENTITY_TYPE: ${entityType}`);
  if (existing.length === 0) {
    lines.push("\nBESTAANDE ITEMS: (nog geen)");
  } else {
    lines.push(`\nBESTAANDE ITEMS (${existing.length}, niet dupliceren):`);
    for (const it of existing.slice(0, 20)) {
      const name = it.name || it.text_md?.slice(0, 60) || "(naamloos)";
      lines.push(`- ${name}${it.is_draft ? " [DRAFT]" : ""}`);
    }
  }
  lines.push(`\nBRONDOCUMENTEN (${chunks.length} fragmenten):`);
  lines.push(buildContextString(chunks));
  return lines.join("\n");
}

function buildProcessFieldsUserMessage({ item, chunks }) {
  const lines = [];
  lines.push(`PROCES: ${item.name} (archetype: ${item.archetype})`);
  if (item.description) lines.push(`OMSCHRIJVING: ${item.description}`);
  lines.push(`\nHUIDIGE archetype_data:`);
  const ad = item.archetype_data || {};
  if (Object.keys(ad).length === 0) {
    lines.push("(leeg)");
  } else {
    for (const k of PR_ARCHETYPE_FIELDS) {
      const v = ad[k];
      lines.push(`- ${k}: ${v != null && String(v).trim() !== "" ? truncate(String(v), 200) : "(leeg)"}`);
    }
  }
  lines.push("\nVELDEN-SPEC (alleen deze keys mag je vullen):");
  for (const k of PR_ARCHETYPE_FIELDS) lines.push(`- ${k}`);
  lines.push("\nLever output als JSON-object: { \"proposed_fields\": { ...key:value... }, \"sources\": [string] }. Sla velden over zonder dossier-onderbouwing.");
  lines.push(`\nBRONDOCUMENTEN (${chunks.length} fragmenten):`);
  lines.push(buildContextString(chunks));
  return lines.join("\n");
}

function buildImproveUserMessage({ currentText, chunks }) {
  const lines = [];
  lines.push("HUIDIGE TEKST:");
  lines.push(currentText);
  if (chunks.length > 0) {
    lines.push(`\nDOSSIER-CONTEXT (${chunks.length} fragmenten):`);
    lines.push(buildContextString(chunks));
  }
  lines.push("\nINSTRUCTIE: lever alleen de verbeterde tekst terug — geen meta-commentaar, geen JSON.");
  return lines.join("\n");
}

async function runRagQuery({ req, query, canvasId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "OPENAI_API_KEY niet geconfigureerd", chunks: [] };
  try {
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: [query] }),
    });
    const embData = await embRes.json();
    if (!embRes.ok) return { error: embData?.error?.message || "OpenAI embedding fout", chunks: [] };
    const embedding = embData.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) return { error: "Geen embedding in OpenAI-response", chunks: [] };

    const supabase = userScopedClient(req);
    if (!supabase) return { error: "Supabase niet geconfigureerd", chunks: [] };
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: embedding, match_canvas_id: canvasId, match_count: RAG_MATCH_COUNT,
    });
    if (error) return { error: error.message, chunks: [] };
    return { chunks: data || [] };
  } catch (err) {
    return { error: err.message, chunks: [] };
  }
}

async function callClaude({ systemPrompt, userMessage }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY niet geconfigureerd", status: 500 };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await response.json();
    if (!response.ok) return { error: data?.error?.message || "AI fout", status: response.status };
    const raw = (data.content || []).map(c => c.text || "").join("").trim();
    return { raw };
  } catch (err) {
    return { error: err.message, status: 502 };
  }
}

async function loadPromptViaRPC(supabase, key) {
  try {
    const { data } = await supabase.rpc("get_app_config_for_tenant");
    if (Array.isArray(data)) {
      const row = data.find(r => r.key === key);
      if (row?.value) return row.value;
    }
  } catch (_) { /* fall through */ }
  const { data: row } = await supabase
    .from("app_config").select("value").eq("key", key).is("tenant_id", null).maybeSingle();
  return row?.value || null;
}

async function insertEventsBestEffort(supabase, events) {
  if (!Array.isArray(events) || events.length === 0) return;
  const { error } = await supabase.from("po_input_suggestion_events").insert(events);
  if (error) console.error("[_processen_dossier_extract] event-insert faalde:", error.message);
}

function buildContextString(chunks) {
  if (!chunks || chunks.length === 0) return "(geen context)";
  return chunks
    .filter(c => c.content && String(c.content).trim().length > 0)
    .map(c => {
      const bron = c.file_name
        ? `[Bron: ${c.file_name}${c.page_number ? ` | p.${c.page_number}` : ""}]`
        : "[Bron: onbekend]";
      return `${bron}\n${String(c.content)}`;
    })
    .join("\n\n---\n\n");
}

function truncate(s, n) {
  if (typeof s !== "string") return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function tryParseJsonArray(raw) {
  if (typeof raw !== "string") return { ok: false, error: "raw is geen string" };
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const firstBracket = s.indexOf("[");
  if (firstBracket > 0) s = s.slice(firstBracket);
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return { ok: false, error: "parsed is geen array" };
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function tryParseJsonObject(raw) {
  if (typeof raw !== "string") return { ok: false, error: "raw is geen string" };
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
      return { ok: false, error: "parsed is geen object" };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  extractFromDossier,
  fillProcessFieldsFromDossier,
  improveChangeApproachText,
  improveSteeringText,
  ENTITY_SPEC,
};
