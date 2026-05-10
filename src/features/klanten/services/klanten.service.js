/**
 * klanten.service.js — frontend-service voor cd_dimensions + cd_items.
 *
 * Belt /api/klanten/* endpoints via apiFetch (JWT meegestuurd voor RLS).
 * Contract per CLAUDE.md sectie 3: { data, error } objecten — geen throw.
 *
 * Centrale validatie zit in api/klanten/_archetypes.js; deze service
 * vertaalt alleen API-responses naar het service-contract.
 */

import { apiFetch } from "../../../shared/services/apiClient";

async function call(method, url, body) {
  try {
    const res = await apiFetch(url, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) {
      return { data: null, error: null };
    }
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    if (!res.ok) {
      return { data: null, error: new Error(json?.error || `HTTP ${res.status}`) };
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ── cd_dimensions ───────────────────────────────────────────────────────────

export async function listDimensions(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data, error } = await call("GET", `/api/klanten/dimensions?canvas_id=${encodeURIComponent(canvasId)}`);
  return { data: data?.dimensions ?? [], error };
}

export async function createDimension({ canvasId, archetype, name, description, isOrdered, sortOrder }) {
  const { data, error } = await call("POST", "/api/klanten/dimensions", {
    canvas_id: canvasId,
    archetype,
    name,
    description: description ?? null,
    is_ordered: isOrdered ?? false,
    sort_order: sortOrder ?? 0,
  });
  return { data: data?.dimension ?? null, error };
}

export async function updateDimension(id, patch) {
  const { data, error } = await call("PUT", `/api/klanten/dimensions?id=${encodeURIComponent(id)}`, patch);
  return { data: data?.dimension ?? null, error };
}

export async function deleteDimension(id) {
  const { error } = await call("DELETE", `/api/klanten/dimensions?id=${encodeURIComponent(id)}`);
  return { data: null, error };
}

// ── cd_items ────────────────────────────────────────────────────────────────

export async function listItemsForCanvas(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data, error } = await call("GET", `/api/klanten/items?canvas_id=${encodeURIComponent(canvasId)}`);
  return { data: data?.items ?? [], error };
}

export async function listItemsForDimension(dimensionId) {
  if (!dimensionId) return { data: null, error: new Error("dimensionId is required") };
  const { data, error } = await call("GET", `/api/klanten/items?dimension_id=${encodeURIComponent(dimensionId)}`);
  return { data: data?.items ?? [], error };
}

export async function createItem({ dimensionId, name, description, archetypeData, subItems, sortOrder, isDraft }) {
  const { data, error } = await call("POST", "/api/klanten/items", {
    dimension_id: dimensionId,
    name,
    description: description ?? null,
    archetype_data: archetypeData ?? {},
    sub_items: subItems ?? [],
    sort_order: sortOrder ?? 0,
    is_draft: isDraft ?? false,
  });
  return { data: data?.item ?? null, error };
}

export async function updateItem(id, patch) {
  // patch keys: name, description, archetype_data (snake_case verwacht door API)
  const { data, error } = await call("PUT", `/api/klanten/items?id=${encodeURIComponent(id)}`, patch);
  return { data: data?.item ?? null, error };
}

export async function deleteItem(id) {
  const { error } = await call("DELETE", `/api/klanten/items?id=${encodeURIComponent(id)}`);
  return { data: null, error };
}

// ── cd_pain_points (RFC-001 §2.3) ──────────────────────────────────────────

export async function listPainPoints(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data, error } = await call("GET", `/api/klanten/pain_points?canvas_id=${encodeURIComponent(canvasId)}`);
  return { data: data?.pain_points ?? [], error };
}

export async function createPainPoint({ canvasId, textMd, sortOrder }) {
  const { data, error } = await call("POST", "/api/klanten/pain_points", {
    canvas_id: canvasId,
    text_md: textMd,
    sort_order: sortOrder ?? 0,
  });
  return { data: data?.pain_point ?? null, error };
}

export async function updatePainPoint(id, { textMd, sortOrder }) {
  const patch = {};
  if (textMd !== undefined)    patch.text_md    = textMd;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  const { data, error } = await call("PUT", `/api/klanten/pain_points?id=${encodeURIComponent(id)}`, patch);
  return { data: data?.pain_point ?? null, error };
}

export async function deletePainPoint(id) {
  const { error } = await call("DELETE", `/api/klanten/pain_points?id=${encodeURIComponent(id)}`);
  return { data: null, error };
}

// ── cd_pain_point_couplings (RFC-001 §2.4) ─────────────────────────────────

export async function listCouplingsForPain(painPointId) {
  if (!painPointId) return { data: null, error: new Error("painPointId is required") };
  const { data, error } = await call("GET", `/api/klanten/pain_point_couplings?pain_point_id=${encodeURIComponent(painPointId)}`);
  return { data: data?.couplings ?? [], error };
}

export async function listCouplingsForCanvas(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data, error } = await call("GET", `/api/klanten/pain_point_couplings?canvas_id=${encodeURIComponent(canvasId)}`);
  return { data: data?.couplings ?? [], error };
}

export async function createCoupling({ painPointId, targetTable, targetId }) {
  const { data, error } = await call("POST", "/api/klanten/pain_point_couplings", {
    pain_point_id: painPointId,
    target_table: targetTable,
    target_id: targetId,
  });
  return { data: data?.coupling ?? null, error };
}

export async function deleteCoupling(id) {
  const { error } = await call("DELETE", `/api/klanten/pain_point_couplings?id=${encodeURIComponent(id)}`);
  return { data: null, error };
}

// ── cd_pattern_suggestions (RFC-001 §2.5, stap 11.G fase 3) ────────────────

export async function listPatternSuggestions(canvasId, { includeDone = false } = {}) {
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const qs = `canvas_id=${encodeURIComponent(canvasId)}${includeDone ? "&include_done=1" : ""}`;
  const { data, error } = await call("GET", `/api/klanten/pattern_suggestions?${qs}`);
  return { data: data?.pattern_suggestions ?? [], error };
}

/** AI-affordance: cluster / paradox / positionering / overstijgend */
export async function generatePatternSuggestions({ canvasId, action, parentId, refinementFocus }) {
  const { data, error } = await call("POST", "/api/klanten/pattern_suggestions_generate", {
    canvas_id: canvasId,
    action,
    parent_id: parentId ?? null,
    refinement_focus: refinementFocus ?? null,
  });
  return { data: data?.pattern_suggestions ?? null, error, meta: data && { ai_model: data.ai_model, prompt_version: data.prompt_version, context_chars: data.context_chars } };
}

/** Consultant-eigen patroon (geen AI) */
export async function createPatternSuggestion({ canvasId, patternType, textMd, scope, scopeTargetId, vanuit }) {
  const { data, error } = await call("POST", "/api/klanten/pattern_suggestions", {
    canvas_id: canvasId,
    pattern_type: patternType,
    text_md: textMd,
    scope: scope ?? "canvas",
    scope_target_id: scopeTargetId ?? null,
    vanuit: vanuit ?? null,
  });
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function updatePatternSuggestion(id, { textMd }) {
  const { data, error } = await call("PUT", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}`, { text_md: textMd });
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function acceptPatternSuggestion(id) {
  const { data, error } = await call("POST", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}&action=accept`);
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function rejectPatternSuggestion(id) {
  const { data, error } = await call("POST", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}&action=reject`);
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function promotePatternSuggestionToIntent(id) {
  // MVP-fase-3: zet alleen promoted_to_intent_at + INSERT event.
  // Feitelijke cd_improvement_intents-aanmaak komt 11.H (fase 4).
  const { data, error } = await call("POST", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}&action=promote_to_intent`);
  return { data: data?.pattern_suggestion ?? null, error };
}

// Stap 11.G.3 F8: un-mark/restore voor collapse-sectie "Terug naar voorraad"
// + "Herstellen". API zet `current_status='open'` via append-only event
// (unpromoted resp. unrejected) — datamodel + audit-laag intact.
export async function unmarkPatternSuggestion(id) {
  const { data, error } = await call("POST", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}&action=unmark`);
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function restorePatternSuggestion(id) {
  const { data, error } = await call("POST", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}&action=restore`);
  return { data: data?.pattern_suggestion ?? null, error };
}

export async function deletePatternSuggestion(id) {
  const { error } = await call("DELETE", `/api/klanten/pattern_suggestions?id=${encodeURIComponent(id)}`);
  return { data: null, error };
}

// ── cd_pattern_suggestion_events (read-only audit-trail) ───────────────────

export async function listPatternSuggestionEvents({ suggestionId, canvasId } = {}) {
  if (!suggestionId && !canvasId) {
    return { data: null, error: new Error("suggestionId of canvasId is required") };
  }
  const qs = suggestionId
    ? `suggestion_id=${encodeURIComponent(suggestionId)}`
    : `canvas_id=${encodeURIComponent(canvasId)}`;
  const { data, error } = await call("GET", `/api/klanten/pattern_suggestion_events?${qs}`);
  return { data: data?.events ?? [], error };
}
