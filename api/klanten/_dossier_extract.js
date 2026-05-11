/**
 * api/klanten/_dossier_extract.js — Helper voor 3 dossier-driven AI-affordances
 * (RFC-002 §6, stap 11.K).
 *
 * Drie affordances delen één RAG+Claude+audit-flow:
 *   A1 items_from_dossier      — bulk-extract items per dimensie
 *   A2 fields_from_dossier     — vul archetype-velden voor één item
 *   A3 pain_points_from_dossier — bulk-extract pijnpunten + voorgestelde couplings
 *
 * Architect-keuze: 3 shared prompts met archetype-token i.p.v. 19 per-archetype.
 *
 * Geconsolideerd in items.js + pain_points.js via subpath-dispatch om binnen
 * Hobby 12-functions-limit te blijven. Helper-functies geëxporteerd:
 *   - extractItemsFromDossier({ supabase, req, canvasId, dimensionId, userId, userRole, tenantId })
 *   - fillFieldsFromDossier({ supabase, req, itemId, userId, userRole, tenantId })
 *   - extractPainPointsFromDossier({ supabase, req, canvasId, userId, userRole, tenantId })
 *   - acceptDraftItem / rejectDraftItem / editDraftItem
 *   - acceptDraftPainPoint / rejectDraftPainPoint / editDraftPainPoint
 *
 * Audit-trail: elk ai_generated/edited/accepted/rejected-event landt in
 * cd_input_suggestion_events met polymorphic target_table + target_id.
 *
 * RAG-pattern-anker: api/magic.js + src/shared/services/embedding.service.js
 * (match_document_chunks RPC). Parse-pattern-anker: _pattern_generate.js
 * (tryParseJson + markdown-fence-strip).
 */

const { renderPrompt, getTenantVars, userScopedClient } = require("../_template");
const { ARCHETYPE_FIELDS } = require("./_archetypes");

const AI_MODEL          = "claude-haiku-4-5-20251001";
const PROMPT_VERSION    = "11K-v1";
const RAG_MATCH_COUNT   = 8;
const AI_MAX_TOKENS     = 2400;
const TEXT_MAX_ITEMS    = 5;
const TEXT_MAX_PAINS    = 7;

const PROMPT_KEYS = {
  items_extract:      "prompt.klanten.dossier.items_extract",
  fields_fill:        "prompt.klanten.dossier.fields_fill",
  pain_points_extract:"prompt.klanten.dossier.pain_points_extract",
};

// ── Public helpers — affordance entrypoints ───────────────────────────────

/**
 * A1: bulk-extract items per dimensie. Filter draft+canonical items uit
 * BESTAANDE ITEMS-context. Bulk-INSERT met is_draft=true. Per item INSERT
 * ai_generated-event.
 */
async function extractItemsFromDossier({ supabase, req, canvasId, dimensionId, userId, userRole, tenantId }) {
  if (!canvasId || !dimensionId) {
    return { status: 400, body: { error: "canvas_id en dimension_id zijn verplicht" } };
  }

  // Lookup dimension voor archetype + tenant + canvas-context (RLS-zichtbaar)
  const { data: dim, error: dimErr } = await supabase
    .from("cd_dimensions")
    .select("id, canvas_id, tenant_id, archetype, name, description")
    .eq("id", dimensionId)
    .maybeSingle();
  if (dimErr)  return { status: 500, body: { error: dimErr.message } };
  if (!dim)    return { status: 404, body: { error: "dimension niet gevonden of geen toegang" } };
  if (dim.canvas_id !== canvasId) {
    return { status: 400, body: { error: "dimension zit in ander canvas" } };
  }

  // Bestaande items in dezelfde dimensie (canonical + draft)
  const { data: existingItems } = await supabase
    .from("cd_items")
    .select("id, name, description, is_draft")
    .eq("dimension_id", dimensionId);

  // RAG-call: query embedding op archetype + dimensie-naam
  const query = `${dim.archetype} ${dim.name}${dim.description ? " " + dim.description : ""}`;
  const ragResult = await runRagQuery({ req, query, canvasId });
  if (ragResult.error) return { status: 502, body: { error: ragResult.error } };
  if (ragResult.chunks.length === 0) {
    return { status: 200, body: { items: [], note: "Geen relevante chunks in dossier voor dit archetype" } };
  }

  // Prompt resolve
  const rawPrompt = await loadPromptViaRPC(supabase, PROMPT_KEYS.items_extract);
  if (!rawPrompt) return { status: 500, body: { error: `Prompt ${PROMPT_KEYS.items_extract} niet gevonden` } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);

  const userMessage = buildItemsUserMessage({ dim, existingItems: existingItems || [], chunks: ragResult.chunks });

  // Claude-call
  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const parsed = tryParseJsonArray(aiResult.raw);
  if (!parsed.ok) {
    console.error("[_dossier_extract:items] parse-error:", parsed.error, "\nraw:", aiResult.raw.slice(0, 500));
    return { status: 500, body: { error: "AI-output kon niet geparsed worden", detail: parsed.error, raw_excerpt: aiResult.raw.slice(0, 500) } };
  }

  const proposedItems = parsed.value.slice(0, TEXT_MAX_ITEMS).filter(it => typeof it?.name === "string" && it.name.trim().length > 0);
  if (proposedItems.length === 0) {
    return { status: 200, body: { items: [], note: "AI vond geen items in dossier" } };
  }

  // Bulk-INSERT draft items
  const baseSort = (existingItems?.length || 0) * 10;
  const rows = proposedItems.map((it, idx) => ({
    dimension_id: dimensionId,
    canvas_id: dim.canvas_id,
    tenant_id: dim.tenant_id,
    name: String(it.name).trim().slice(0, 200),
    description: typeof it.description === "string" ? it.description.trim().slice(0, 2000) : null,
    archetype_data: {},
    is_draft: true,
    sort_order: baseSort + (idx + 1) * 10,
  }));

  const { data: inserted, error: insErr } = await supabase.from("cd_items").insert(rows).select();
  if (insErr) return { status: insErr.code === "42501" ? 403 : 500, body: { error: insErr.message } };

  // Audit-events per item
  const events = inserted.map((row, idx) => ({
    target_table: "cd_items",
    target_id: row.id,
    affordance: "items_from_dossier",
    event_type: "ai_generated",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: null,
    text_after_md: row.name + (row.description ? "\n\n" + row.description : ""),
    metadata: {
      ai_model: AI_MODEL,
      prompt_key: PROMPT_KEYS.items_extract,
      prompt_version: PROMPT_VERSION,
      sources: Array.isArray(proposedItems[idx]?.sources) ? proposedItems[idx].sources : [],
      chunk_count: ragResult.chunks.length,
    },
    tenant_id: dim.tenant_id,
    canvas_id: dim.canvas_id,
  }));
  await insertEventsBestEffort(supabase, events);

  return { status: 201, body: { items: inserted, ai_model: AI_MODEL, prompt_version: PROMPT_VERSION, chunk_count: ragResult.chunks.length } };
}

/**
 * A2: vul archetype-velden voor één item. UPDATE row + INSERT
 * ai_generated-event met metadata.proposed_fields. Item krijgt is_draft=true
 * indien het canonical was — anders blijft is_draft staan.
 * Reviewer-keuze open vraag #5: één event per affordance-call met
 * metadata.accepted_fields/rejected_fields-arrays bij accept-fase (later).
 */
async function fillFieldsFromDossier({ supabase, req, itemId, userId, userRole, tenantId }) {
  if (!itemId) return { status: 400, body: { error: "id is verplicht" } };

  const { data: item, error: selErr } = await supabase
    .from("cd_items")
    .select("id, dimension_id, canvas_id, tenant_id, name, description, archetype_data, is_draft, cd_dimensions:dimension_id(archetype, name)")
    .eq("id", itemId)
    .maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!item)  return { status: 404, body: { error: "item niet gevonden of geen toegang" } };

  const archetype = item.cd_dimensions?.archetype;
  const allowedFields = ARCHETYPE_FIELDS[archetype] || [];
  if (allowedFields.length === 0) {
    return { status: 400, body: { error: `archetype "${archetype}" heeft geen veld-spec` } };
  }

  // RAG-query op item-naam + archetype-context
  const query = `${item.name} ${archetype} ${(item.description || "").slice(0, 200)}`;
  const ragResult = await runRagQuery({ req, query, canvasId: item.canvas_id });
  if (ragResult.error) return { status: 502, body: { error: ragResult.error } };
  if (ragResult.chunks.length === 0) {
    return { status: 200, body: { item, proposed_fields: {}, note: "Geen relevante chunks in dossier" } };
  }

  const rawPrompt = await loadPromptViaRPC(supabase, PROMPT_KEYS.fields_fill);
  if (!rawPrompt) return { status: 500, body: { error: `Prompt ${PROMPT_KEYS.fields_fill} niet gevonden` } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);

  const userMessage = buildFieldsUserMessage({ item, archetype, allowedFields, chunks: ragResult.chunks });

  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const parsed = tryParseJsonObject(aiResult.raw);
  if (!parsed.ok) {
    console.error("[_dossier_extract:fields] parse-error:", parsed.error, "\nraw:", aiResult.raw.slice(0, 500));
    return { status: 500, body: { error: "AI-output kon niet geparsed worden", detail: parsed.error } };
  }

  const proposedRaw = parsed.value.proposed_fields || {};
  // Filter alleen allowed fields, skip leeg + skip al-gevuld
  const proposedFields = {};
  for (const key of allowedFields) {
    const v = proposedRaw[key];
    if (typeof v === "string" && v.trim().length > 0) {
      const existing = item.archetype_data?.[key];
      if (!existing || String(existing).trim().length === 0) {
        proposedFields[key] = v.trim();
      }
    }
  }

  // Geen velden om voor te stellen → audit-event toch loggen met lege metadata, geen UPDATE
  if (Object.keys(proposedFields).length === 0) {
    await insertEventsBestEffort(supabase, [{
      target_table: "cd_items",
      target_id: item.id,
      affordance: "fields_from_dossier",
      event_type: "ai_generated",
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: null,
      text_after_md: null,
      metadata: {
        ai_model: AI_MODEL,
        prompt_key: PROMPT_KEYS.fields_fill,
        prompt_version: PROMPT_VERSION,
        proposed_fields: {},
        sources: Array.isArray(parsed.value.sources) ? parsed.value.sources : [],
        chunk_count: ragResult.chunks.length,
        empty: true,
      },
      tenant_id: item.tenant_id,
      canvas_id: item.canvas_id,
    }]);
    return { status: 200, body: { item, proposed_fields: {}, note: "AI vond geen onderbouwing voor lege velden" } };
  }

  // Merge proposed fields naar archetype_data + zet is_draft=true wanneer item canonical was
  const mergedFields = { ...(item.archetype_data || {}), ...proposedFields };
  const patch = { archetype_data: mergedFields };
  if (!item.is_draft) patch.is_draft = true;

  const { data: updated, error: upErr } = await supabase
    .from("cd_items").update(patch).eq("id", item.id).select().single();
  if (upErr) return { status: upErr.code === "42501" ? 403 : 500, body: { error: upErr.message } };

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_items",
    target_id: item.id,
    affordance: "fields_from_dossier",
    event_type: "ai_generated",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: JSON.stringify(item.archetype_data || {}),
    text_after_md: JSON.stringify(mergedFields),
    metadata: {
      ai_model: AI_MODEL,
      prompt_key: PROMPT_KEYS.fields_fill,
      prompt_version: PROMPT_VERSION,
      proposed_fields: proposedFields,
      sources: Array.isArray(parsed.value.sources) ? parsed.value.sources : [],
      chunk_count: ragResult.chunks.length,
      previous_is_draft: item.is_draft,
    },
    tenant_id: item.tenant_id,
    canvas_id: item.canvas_id,
  }]);

  return { status: 200, body: { item: updated, proposed_fields: proposedFields, ai_model: AI_MODEL, prompt_version: PROMPT_VERSION } };
}

/**
 * A3: bulk-extract pijnpunten met voorgestelde couplings. Bulk-INSERT
 * cd_pain_points met is_draft=true. proposed_couplings bewaard in
 * metadata.proposed_couplings — pas bij accept worden de couplings
 * daadwerkelijk gecreëerd in cd_pain_point_couplings.
 */
async function extractPainPointsFromDossier({ supabase, req, canvasId, userId, userRole, tenantId }) {
  if (!canvasId) return { status: 400, body: { error: "canvas_id is verplicht" } };

  // Canvas-context: dimensies, items (canonical), bestaande pijnpunten
  const [dimsRes, itemsRes, painsRes, canvasRes] = await Promise.all([
    supabase.from("cd_dimensions").select("id, archetype, name").eq("canvas_id", canvasId).order("sort_order"),
    supabase.from("cd_items").select("id, dimension_id, name, description, is_draft").eq("canvas_id", canvasId),
    supabase.from("cd_pain_points").select("id, text_md, is_draft").eq("canvas_id", canvasId).order("sort_order"),
    supabase.from("canvases").select("id, tenant_id").eq("id", canvasId).maybeSingle(),
  ]);
  if (dimsRes.error)   return { status: 500, body: { error: dimsRes.error.message } };
  if (itemsRes.error)  return { status: 500, body: { error: itemsRes.error.message } };
  if (painsRes.error)  return { status: 500, body: { error: painsRes.error.message } };
  if (canvasRes.error) return { status: 500, body: { error: canvasRes.error.message } };
  if (!canvasRes.data) return { status: 404, body: { error: "canvas niet gevonden of geen toegang" } };
  const canvasTenant = canvasRes.data.tenant_id;

  const canonicalItems = (itemsRes.data || []).filter(it => !it.is_draft);
  if (canonicalItems.length === 0) {
    return { status: 409, body: { error: "Voeg eerst (canonical) items toe voordat je pijnpunten extraheert" } };
  }

  // RAG: query op canvas-niveau "klantpijnpunten dossier"
  const query = "klantpijnpunten knelpunten frustraties bottleneck conversie omzet kwaliteit";
  const ragResult = await runRagQuery({ req, query, canvasId });
  if (ragResult.error) return { status: 502, body: { error: ragResult.error } };
  if (ragResult.chunks.length === 0) {
    return { status: 200, body: { pain_points: [], note: "Geen relevante chunks in dossier" } };
  }

  const rawPrompt = await loadPromptViaRPC(supabase, PROMPT_KEYS.pain_points_extract);
  if (!rawPrompt) return { status: 500, body: { error: `Prompt ${PROMPT_KEYS.pain_points_extract} niet gevonden` } };
  const tenantVars = await getTenantVars(supabase);
  const systemPrompt = renderPrompt(rawPrompt, tenantVars);

  const userMessage = buildPainPointsUserMessage({
    dimensions: dimsRes.data || [],
    items: canonicalItems,
    existingPains: painsRes.data || [],
    chunks: ragResult.chunks,
  });

  const aiResult = await callClaude({ systemPrompt, userMessage });
  if (aiResult.error) return { status: aiResult.status || 502, body: { error: aiResult.error } };

  const parsed = tryParseJsonArray(aiResult.raw);
  if (!parsed.ok) {
    console.error("[_dossier_extract:pains] parse-error:", parsed.error, "\nraw:", aiResult.raw.slice(0, 500));
    return { status: 500, body: { error: "AI-output kon niet geparsed worden", detail: parsed.error } };
  }

  const validItemIds = new Set(canonicalItems.map(it => it.id));
  const proposed = parsed.value.slice(0, TEXT_MAX_PAINS).filter(p => typeof p?.text_md === "string" && p.text_md.trim().length > 0);
  if (proposed.length === 0) {
    return { status: 200, body: { pain_points: [], note: "AI vond geen pijnpunten in dossier" } };
  }

  const baseSort = (painsRes.data?.length || 0) * 10;
  const rows = proposed.map((p, idx) => ({
    canvas_id: canvasId,
    tenant_id: canvasTenant,
    text_md: String(p.text_md).trim().slice(0, 5000),
    sort_order: baseSort + (idx + 1) * 10,
    is_draft: true,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("cd_pain_points").insert(rows).select();
  if (insErr) return { status: insErr.code === "42501" ? 403 : 500, body: { error: insErr.message } };

  // Audit-events met proposed_couplings in metadata (skip stale targets)
  const events = inserted.map((row, idx) => {
    const rawCouplings = Array.isArray(proposed[idx]?.proposed_couplings) ? proposed[idx].proposed_couplings : [];
    const proposedCouplings = rawCouplings
      .filter(c => c?.target_table === "cd_items" && typeof c?.target_id === "string" && validItemIds.has(c.target_id))
      .map(c => ({
        target_table: "cd_items",
        target_id: c.target_id,
        reden: typeof c?.reden === "string" ? c.reden.slice(0, 300) : null,
      }));
    const skipped = rawCouplings.length - proposedCouplings.length;
    return {
      target_table: "cd_pain_points",
      target_id: row.id,
      affordance: "pain_points_from_dossier",
      event_type: "ai_generated",
      actor_user_id: userId,
      actor_role: userRole,
      text_before_md: null,
      text_after_md: row.text_md,
      metadata: {
        ai_model: AI_MODEL,
        prompt_key: PROMPT_KEYS.pain_points_extract,
        prompt_version: PROMPT_VERSION,
        proposed_couplings: proposedCouplings,
        skipped_couplings: skipped,
        sources: Array.isArray(proposed[idx]?.sources) ? proposed[idx].sources : [],
        chunk_count: ragResult.chunks.length,
      },
      tenant_id: canvasTenant,
      canvas_id: canvasId,
    };
  });
  await insertEventsBestEffort(supabase, events);

  return { status: 201, body: { pain_points: inserted, ai_model: AI_MODEL, prompt_version: PROMPT_VERSION, chunk_count: ragResult.chunks.length } };
}

// ── Draft-acties: accept / reject / edit ───────────────────────────────────

async function acceptDraftItem({ supabase, itemId, userId, userRole }) {
  const { data: item, error: selErr } = await supabase
    .from("cd_items")
    .select("id, name, description, canvas_id, tenant_id, is_draft, archetype_data")
    .eq("id", itemId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!item)  return { status: 404, body: { error: "item niet gevonden of geen toegang" } };
  if (!item.is_draft) return { status: 409, body: { error: "item is niet meer een draft" } };

  const { data: updated, error: upErr } = await supabase
    .from("cd_items").update({ is_draft: false }).eq("id", itemId).select().single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_items",
    target_id: itemId,
    affordance: deriveItemsAffordance(item),
    event_type: "accepted",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: null,
    text_after_md: null,
    metadata: {},
    tenant_id: item.tenant_id,
    canvas_id: item.canvas_id,
  }]);
  return { status: 200, body: { item: updated } };
}

async function rejectDraftItem({ supabase, itemId, userId, userRole }) {
  const { data: item, error: selErr } = await supabase
    .from("cd_items")
    .select("id, name, description, canvas_id, tenant_id, is_draft")
    .eq("id", itemId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!item)  return { status: 404, body: { error: "item niet gevonden of geen toegang" } };
  if (!item.is_draft) return { status: 409, body: { error: "item is niet meer een draft" } };

  // Insert rejected-event BEFORE delete zodat trigger nog kan valideren tegen
  // bestaande row. Audit-trail bewaard ook na DELETE.
  await insertEventsBestEffort(supabase, [{
    target_table: "cd_items",
    target_id: itemId,
    affordance: deriveItemsAffordance(item),
    event_type: "rejected",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: item.name,
    text_after_md: null,
    metadata: {},
    tenant_id: item.tenant_id,
    canvas_id: item.canvas_id,
  }]);

  const { error: delErr } = await supabase.from("cd_items").delete().eq("id", itemId);
  if (delErr) return { status: 500, body: { error: delErr.message } };
  return { status: 204 };
}

async function editDraftItem({ supabase, itemId, fields, userId, userRole }) {
  if (!fields || typeof fields !== "object") {
    return { status: 400, body: { error: "fields object verplicht" } };
  }
  const { data: item, error: selErr } = await supabase
    .from("cd_items")
    .select("id, name, description, archetype_data, canvas_id, tenant_id, is_draft")
    .eq("id", itemId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!item)  return { status: 404, body: { error: "item niet gevonden of geen toegang" } };
  if (!item.is_draft) return { status: 409, body: { error: "item is niet meer een draft" } };

  const patch = {};
  if (typeof fields.name === "string")        patch.name = fields.name.trim();
  if (fields.description !== undefined)       patch.description = fields.description;
  if (fields.archetype_data !== undefined)    patch.archetype_data = fields.archetype_data;
  if (Object.keys(patch).length === 0) {
    return { status: 400, body: { error: "geen velden om te updaten" } };
  }

  const { data: updated, error: upErr } = await supabase
    .from("cd_items").update(patch).eq("id", itemId).select().single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_items",
    target_id: itemId,
    affordance: deriveItemsAffordance(item),
    event_type: "edited",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: JSON.stringify({ name: item.name, description: item.description, archetype_data: item.archetype_data }),
    text_after_md:  JSON.stringify({ name: updated.name, description: updated.description, archetype_data: updated.archetype_data }),
    metadata: { fields_changed: Object.keys(patch) },
    tenant_id: item.tenant_id,
    canvas_id: item.canvas_id,
  }]);

  return { status: 200, body: { item: updated } };
}

/**
 * Accept draft-pijnpunt + materialiseer proposed_couplings uit het
 * meest recente ai_generated-event van die pijnpunt.
 */
async function acceptDraftPainPoint({ supabase, painId, userId, userRole }) {
  const { data: pp, error: selErr } = await supabase
    .from("cd_pain_points")
    .select("id, text_md, canvas_id, tenant_id, is_draft")
    .eq("id", painId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!pp)    return { status: 404, body: { error: "pijnpunt niet gevonden of geen toegang" } };
  if (!pp.is_draft) return { status: 409, body: { error: "pijnpunt is niet meer een draft" } };

  // Haal proposed_couplings op uit meest recente ai_generated-event
  const { data: events } = await supabase
    .from("cd_input_suggestion_events")
    .select("metadata")
    .eq("target_table", "cd_pain_points")
    .eq("target_id", painId)
    .eq("event_type", "ai_generated")
    .order("created_at", { ascending: false })
    .limit(1);
  const proposedCouplings = (events?.[0]?.metadata?.proposed_couplings) || [];

  // Promote pijnpunt
  const { data: updated, error: upErr } = await supabase
    .from("cd_pain_points").update({ is_draft: false }).eq("id", painId).select().single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  // Materialiseer couplings (skip stale: alleen items die nog bestaan in canvas)
  let createdCouplings = 0;
  let skippedCouplings = 0;
  if (proposedCouplings.length > 0) {
    // Validate item-existence in canvas
    const itemIds = proposedCouplings.filter(c => c.target_table === "cd_items").map(c => c.target_id);
    const { data: validItems } = itemIds.length > 0
      ? await supabase.from("cd_items").select("id").in("id", itemIds).eq("canvas_id", pp.canvas_id)
      : { data: [] };
    const validSet = new Set((validItems || []).map(r => r.id));
    const couplingRows = proposedCouplings
      .filter(c => c.target_table === "cd_items" && validSet.has(c.target_id))
      .map(c => ({
        pain_point_id: painId,
        target_table: "cd_items",
        target_id: c.target_id,
        canvas_id: pp.canvas_id,
        tenant_id: pp.tenant_id,
      }));
    skippedCouplings = proposedCouplings.length - couplingRows.length;
    if (couplingRows.length > 0) {
      const { error: cpErr } = await supabase.from("cd_pain_point_couplings").insert(couplingRows);
      if (!cpErr) createdCouplings = couplingRows.length;
      else        console.warn("[_dossier_extract:accept_pain] coupling-insert faalde:", cpErr.message);
    }
  }

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_pain_points",
    target_id: painId,
    affordance: "pain_points_from_dossier",
    event_type: "accepted",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: null,
    text_after_md: null,
    metadata: { created_couplings: createdCouplings, skipped_couplings: skippedCouplings },
    tenant_id: pp.tenant_id,
    canvas_id: pp.canvas_id,
  }]);

  return { status: 200, body: { pain_point: updated, created_couplings: createdCouplings, skipped_couplings: skippedCouplings } };
}

async function rejectDraftPainPoint({ supabase, painId, userId, userRole }) {
  const { data: pp, error: selErr } = await supabase
    .from("cd_pain_points")
    .select("id, text_md, canvas_id, tenant_id, is_draft")
    .eq("id", painId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!pp)    return { status: 404, body: { error: "pijnpunt niet gevonden of geen toegang" } };
  if (!pp.is_draft) return { status: 409, body: { error: "pijnpunt is niet meer een draft" } };

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_pain_points",
    target_id: painId,
    affordance: "pain_points_from_dossier",
    event_type: "rejected",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: pp.text_md,
    text_after_md: null,
    metadata: {},
    tenant_id: pp.tenant_id,
    canvas_id: pp.canvas_id,
  }]);

  const { error: delErr } = await supabase.from("cd_pain_points").delete().eq("id", painId);
  if (delErr) return { status: 500, body: { error: delErr.message } };
  return { status: 204 };
}

async function editDraftPainPoint({ supabase, painId, fields, userId, userRole }) {
  if (!fields || typeof fields.text_md !== "string" || !fields.text_md.trim()) {
    return { status: 400, body: { error: "text_md is verplicht" } };
  }
  const { data: pp, error: selErr } = await supabase
    .from("cd_pain_points")
    .select("id, text_md, canvas_id, tenant_id, is_draft")
    .eq("id", painId).maybeSingle();
  if (selErr) return { status: 500, body: { error: selErr.message } };
  if (!pp)    return { status: 404, body: { error: "pijnpunt niet gevonden of geen toegang" } };
  if (!pp.is_draft) return { status: 409, body: { error: "pijnpunt is niet meer een draft" } };

  const newText = fields.text_md.trim().slice(0, 5000);
  const { data: updated, error: upErr } = await supabase
    .from("cd_pain_points").update({ text_md: newText }).eq("id", painId).select().single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  await insertEventsBestEffort(supabase, [{
    target_table: "cd_pain_points",
    target_id: painId,
    affordance: "pain_points_from_dossier",
    event_type: "edited",
    actor_user_id: userId,
    actor_role: userRole,
    text_before_md: pp.text_md,
    text_after_md: newText,
    metadata: { fields_changed: ["text_md"] },
    tenant_id: pp.tenant_id,
    canvas_id: pp.canvas_id,
  }]);

  return { status: 200, body: { pain_point: updated } };
}

// ── Private helpers ──────────────────────────────────────────────────────

async function runRagQuery({ req, query, canvasId }) {
  // Stap 1: embed de query via OpenAI (zelfde proxy als client-side embedding.service)
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

    // Stap 2: vector-search via Supabase RPC (user-scoped voor RLS)
    const supabase = userScopedClient(req);
    if (!supabase) return { error: "Supabase niet geconfigureerd", chunks: [] };

    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: embedding,
      match_canvas_id: canvasId,
      match_count: RAG_MATCH_COUNT,
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
  const { error } = await supabase.from("cd_input_suggestion_events").insert(events);
  if (error) console.error("[_dossier_extract] event-insert faalde:", error.message);
}

function deriveItemsAffordance(item) {
  // Conservatief: weten we niet welke affordance dit was → fallback op A1.
  // (audit-trail van originele ai_generated-event heeft de echte affordance;
  // accept/reject/edit-event gebruiken de meest recente as best-effort.)
  return "items_from_dossier";
}

function buildItemsUserMessage({ dim, existingItems, chunks }) {
  const lines = [];
  lines.push(`ARCHETYPE: ${dim.archetype}`);
  lines.push(`DIMENSIE: ${dim.name}${dim.description ? " — " + dim.description : ""}`);

  if (existingItems.length === 0) {
    lines.push("\nBESTAANDE ITEMS: (nog geen)");
  } else {
    lines.push("\nBESTAANDE ITEMS:");
    for (const it of existingItems) {
      lines.push(`- ${it.name}${it.description ? `: ${truncate(it.description, 200)}` : ""}${it.is_draft ? " [DRAFT]" : ""}`);
    }
  }

  lines.push(`\nBRONDOCUMENTEN (${chunks.length} fragmenten):`);
  lines.push(buildContextString(chunks));

  return lines.join("\n");
}

function buildFieldsUserMessage({ item, archetype, allowedFields, chunks }) {
  const lines = [];
  lines.push(`ARCHETYPE: ${archetype}`);
  lines.push(`ITEM: ${item.name}${item.description ? " — " + item.description : ""}`);

  lines.push("\nHUIDIGE archetype_data:");
  const ad = item.archetype_data || {};
  if (Object.keys(ad).length === 0) {
    lines.push("(leeg)");
  } else {
    for (const k of allowedFields) {
      const v = ad[k];
      lines.push(`- ${k}: ${v != null && String(v).trim() !== "" ? truncate(String(v), 200) : "(leeg)"}`);
    }
  }

  lines.push("\nVELDEN-SPEC (alleen deze keys mag je vullen):");
  for (const k of allowedFields) {
    lines.push(`- ${k}`);
  }

  lines.push(`\nBRONDOCUMENTEN (${chunks.length} fragmenten):`);
  lines.push(buildContextString(chunks));

  return lines.join("\n");
}

function buildPainPointsUserMessage({ dimensions, items, existingPains, chunks }) {
  const lines = [];
  lines.push("DIMENSIES + ITEMS:");
  for (const dim of dimensions) {
    lines.push(`\n## ${dim.archetype}: ${dim.name}`);
    const dimItems = items.filter(it => it.dimension_id === dim.id);
    if (dimItems.length === 0) {
      lines.push("(geen items)");
    } else {
      for (const it of dimItems) {
        lines.push(`- ${it.name} [id=${it.id}]${it.description ? `: ${truncate(it.description, 120)}` : ""}`);
      }
    }
  }

  lines.push("\n\nBESTAANDE PIJNPUNTEN:");
  if (existingPains.length === 0) {
    lines.push("(nog geen)");
  } else {
    for (const pp of existingPains) {
      lines.push(`- ${truncate(pp.text_md, 200)}${pp.is_draft ? " [DRAFT]" : ""}`);
    }
  }

  lines.push(`\n\nBRONDOCUMENTEN (${chunks.length} fragmenten):`);
  lines.push(buildContextString(chunks));

  return lines.join("\n");
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
  extractItemsFromDossier,
  fillFieldsFromDossier,
  extractPainPointsFromDossier,
  acceptDraftItem,
  rejectDraftItem,
  editDraftItem,
  acceptDraftPainPoint,
  rejectDraftPainPoint,
  editDraftPainPoint,
};
