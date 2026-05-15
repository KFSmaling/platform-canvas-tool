/**
 * processen.service.js — frontend-service voor Processen & Organisatie-werkblad.
 *
 * Belt /api/processen?_subpath=... via apiFetch (JWT meegestuurd voor RLS).
 * Contract per CLAUDE.md sectie 3: { data, error } objecten — geen throw.
 *
 * Anker: src/features/klanten/services/klanten.service.js
 */

import { apiFetch } from "../../../shared/services/apiClient";

async function call(method, subpath, body, queryExtras = {}) {
  const qs = new URLSearchParams({ _subpath: subpath, ...queryExtras }).toString();
  const url = `/api/processen?${qs}`;
  try {
    const res = await apiFetch(url, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) return { data: null, error: null };
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    if (!res.ok) return { data: null, error: new Error(json?.error || `HTTP ${res.status}`) };
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ── Generic CRUD-helpers ───────────────────────────────────────────────────
function makeList(subpath) {
  return async (canvasId, extras = {}) => {
    if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
    const { data, error } = await call("GET", subpath, undefined, { canvas_id: canvasId, ...extras });
    return { data: data?.rows ?? null, error };
  };
}
function makeCreate(subpath) {
  return async (payload) => {
    const { data, error } = await call("POST", subpath, payload);
    return { data: data?.row ?? null, error };
  };
}
function makeUpdate(subpath) {
  return async (id, patch) => {
    if (!id) return { data: null, error: new Error("id is verplicht") };
    const { data, error } = await call("PUT", subpath, patch, { id });
    return { data: data?.row ?? null, error };
  };
}
function makeDelete(subpath) {
  return async (id) => {
    if (!id) return { data: null, error: new Error("id is verplicht") };
    const { error } = await call("DELETE", subpath, undefined, { id });
    return { data: null, error };
  };
}

// ── Bedrijfsprocessen (pr_processes + pr_process_steps) ────────────────────
export const listProcesses    = makeList("processes");
export const createProcess    = makeCreate("processes");
export const updateProcess    = makeUpdate("processes");
export const deleteProcess    = makeDelete("processes");

export const listProcessSteps  = (canvasId, processId) => makeList("process_steps")(canvasId, processId ? { process_id: processId } : {});
export const createProcessStep = makeCreate("process_steps");
export const updateProcessStep = makeUpdate("process_steps");
export const deleteProcessStep = makeDelete("process_steps");

// ── Lijnorganisatie (org_*) ────────────────────────────────────────────────
export async function getStructuringDoorsnede(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
  const { data, error } = await call("GET", "structuring_doorsnede", undefined, { canvas_id: canvasId });
  return { data: data?.row ?? null, error };
}
export async function setStructuringDoorsnede(canvasId, doorsnede) {
  const { data, error } = await call("PUT", "structuring_doorsnede", { canvas_id: canvasId, doorsnede });
  return { data: data?.row ?? null, error };
}

export const listDepartments  = makeList("departments");
export const createDepartment = makeCreate("departments");
export const updateDepartment = makeUpdate("departments");
export const deleteDepartment = makeDelete("departments");

export const listProcessDepartmentIntensity   = makeList("process_department_intensity");
export const createProcessDepartmentIntensity = makeCreate("process_department_intensity");
export const deleteProcessDepartmentIntensity = makeDelete("process_department_intensity");

// ── Veranderorganisatie (vo_*) ─────────────────────────────────────────────
export async function getChangeApproach(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
  const { data, error } = await call("GET", "change_approach", undefined, { canvas_id: canvasId });
  return { data: data?.row ?? null, error };
}
export async function setChangeApproach(canvasId, textMd) {
  const { data, error } = await call("PUT", "change_approach", { canvas_id: canvasId, text_md: textMd });
  return { data: data?.row ?? null, error };
}

export const listBusinessUnits  = makeList("business_units");
export const createBusinessUnit = makeCreate("business_units");
export const updateBusinessUnit = makeUpdate("business_units");
export const deleteBusinessUnit = makeDelete("business_units");

export const listValueTeams  = makeList("value_teams");
export const createValueTeam = makeCreate("value_teams");
export const updateValueTeam = makeUpdate("value_teams");
export const deleteValueTeam = makeDelete("value_teams");

export const createSchetsUploadMetadata = makeCreate("schets_upload_metadata");

// 11.M.1 block-4 D4 — Schets-uploads-list voor preview-render
// (Read via Supabase direct met RLS; geen server-endpoint nodig.)
import { supabase as _supabaseForSchets } from "../../../shared/services/supabase.client";

export async function listSchetsUploads(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
  if (!_supabaseForSchets) return { data: null, error: new Error("Supabase niet geconfigureerd") };
  const { data, error } = await _supabaseForSchets
    .from("vo_schets_uploads")
    .select("*")
    .eq("canvas_id", canvasId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// ── Besturing (gov_*) ──────────────────────────────────────────────────────
export async function getSteeringModel(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
  const { data, error } = await call("GET", "steering_model", undefined, { canvas_id: canvasId });
  return { data: data?.row ?? null, error };
}
export async function setSteeringModel(canvasId, { model, text_md, coordination_aspects }) {
  const { data, error } = await call("PUT", "steering_model",
    { canvas_id: canvasId, model, text_md, coordination_aspects });
  return { data: data?.row ?? null, error };
}

export const listControlProcesses  = makeList("control_processes");
export const createControlProcess  = makeCreate("control_processes");
export const updateControlProcess  = makeUpdate("control_processes");
export const deleteControlProcess  = makeDelete("control_processes");

// ── Fase 2 — Pijnpunten cross-cutting (po_*) ───────────────────────────────
export const listPainPoints  = makeList("pain_points");
export const createPainPoint = makeCreate("pain_points");
export const updatePainPoint = makeUpdate("pain_points");
export const deletePainPoint = makeDelete("pain_points");

export const listPainPointCouplings  = makeList("pain_point_couplings");
export const createPainPointCoupling = makeCreate("pain_point_couplings");
export const deletePainPointCoupling = makeDelete("pain_point_couplings");

export async function toggleCoverageStatus(id, coverageStatus, noActionMotivation) {
  if (!id) return { data: null, error: new Error("id is verplicht") };
  const { data, error } = await call("POST", "pain_point_coverage_toggle", {
    id, coverage_status: coverageStatus, no_action_motivation: noActionMotivation,
  });
  return { data: data?.row ?? null, error };
}

// ── Fase 3 — Verbeteracties (po_improvement_intents) ───────────────────────
export const listImprovementIntents  = makeList("improvement_intents");
export const createImprovementIntent = makeCreate("improvement_intents");
export const updateImprovementIntent = makeUpdate("improvement_intents");

/**
 * State-transition via append-only audit-event. Trigger po_iie_sync_status
 * werkt automatically current_status bij op po_improvement_intents.
 * Event-types: created / edited / refined / made_concept / made_definitief /
 *              back_to_concept / dismissed / restored
 */
export async function transitionIntentState(intentId, eventType, { text_before_md, text_after_md, metadata } = {}) {
  const { data, error } = await call("POST", "intent_state_transition", {
    intent_id: intentId, event_type: eventType, text_before_md, text_after_md, metadata,
  });
  return { data: data?.event ?? null, error };
}

export async function linkIntentToPainPoint(intentId, painPointId, canvasId) {
  const { data, error } = await call("POST", "intent_pain_point_links", {
    intent_id: intentId, pain_point_id: painPointId, canvas_id: canvasId,
  });
  return { data: data?.row ?? null, error };
}
export const unlinkIntentFromPainPoint = makeDelete("intent_pain_point_links");

// ── Coverage-aggregate voor banner ─────────────────────────────────────────
export async function fetchCoverageAggregate(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId is verplicht") };
  const { data, error } = await call("GET", "coverage_aggregate", undefined, { canvas_id: canvasId });
  return { data: data?.counts ?? null, error };
}

// ── 11.M.1 Block-1 — Dossier-AI affordances ────────────────────────────────

/**
 * Bulk-extract entities uit dossier voor opgegeven entity_type.
 * entityType: 'processes' | 'departments' | 'business_units' | 'value_teams' |
 *             'control_processes' | 'pain_points'
 */
export async function extractFromDossier(canvasId, entityType) {
  if (!canvasId || !entityType) return { data: null, error: new Error("canvasId + entityType required") };
  const { data, error } = await call("POST", "dossier_extract", { canvas_id: canvasId, entity_type: entityType });
  return {
    data: data?.items ?? null,
    error,
    meta: data && {
      ai_model: data.ai_model,
      prompt_version: data.prompt_version,
      chunk_count: data.chunk_count,
      note: data.note,
    },
  };
}

/**
 * Vul 5 jsonb-archetype-velden voor een pr_processes-row uit dossier.
 */
export async function fillProcessFieldsFromDossier(processId) {
  if (!processId) return { data: null, error: new Error("processId required") };
  const { data, error } = await call("POST", "dossier_fields_fill", undefined, { id: processId });
  return {
    data: data?.item ?? null,
    error,
    meta: data && { proposed_fields: data.proposed_fields, note: data.note, ai_model: data.ai_model },
  };
}

/**
 * Rich-text verbeter voor vo_change_approach.text_md.
 */
export async function improveChangeApproach(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId required") };
  const { data, error } = await call("POST", "improve_change_approach", { canvas_id: canvasId });
  return {
    data: data?.row ?? null,
    error,
    meta: data && { before: data.before, after: data.after, ai_model: data.ai_model },
  };
}

/**
 * Rich-text verbeter voor gov_steering_model.text_md.
 */
export async function improveSteering(canvasId) {
  if (!canvasId) return { data: null, error: new Error("canvasId required") };
  const { data, error } = await call("POST", "improve_steering_text", { canvas_id: canvasId });
  return {
    data: data?.row ?? null,
    error,
    meta: data && { before: data.before, after: data.after, ai_model: data.ai_model },
  };
}

// ── 11.M.1 Block-2 — Verbeteracties-AI ─────────────────────────────────────

/**
 * Genereer verbeteracties via AI voor opgegeven source-type.
 * sourceType: 'ai_algemeen' | 'ai_cluster' | 'ai_paradox' | 'ai_positionering' | 'ai_overstijgend'
 */
export async function generateImprovementsAi(canvasId, sourceType) {
  if (!canvasId || !sourceType) return { data: null, error: new Error("canvasId + sourceType required") };
  const { data, error } = await call("POST", "ai_improvements_generate", {
    canvas_id: canvasId,
    source_type: sourceType,
  });
  return {
    data: data?.intents ?? null,
    error,
    meta: data && {
      ai_model: data.ai_model,
      prompt_version: data.prompt_version,
      source_type: data.source_type,
      bron_pain_point_links: data.bron_pain_point_links,
      chunk_count: data.chunk_count,
      note: data.note,
    },
  };
}
