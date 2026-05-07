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
