import { supabase } from "./supabase.client";

/**
 * Sla een geüpload document op in canvas_uploads.
 * Inclusief canvas_id en user_id koppeling (Sprint 3).
 */
export async function saveCanvasUpload({ fileName, rawText, insights, blockKey, language, canvasId, userId }) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };

  const { data, error } = await supabase
    .from("canvas_uploads")
    .upsert({
      file_name:  fileName,
      raw_text:   rawText.slice(0, 10000),
      content:    JSON.stringify({ blockKey, insights }),
      language:   language,
      block_key:  blockKey,
      canvas_id:  canvasId  || null,
      user_id:    userId    || null,
    }, { onConflict: "canvas_id,file_name" })
    .select("id")
    .maybeSingle();

  if (error) console.error("[upload] Supabase opslag mislukt:", error.code, error.message);
  return { data, error, uploadId: data?.id || null };
}

/**
 * Laad alle canvassen van een gebruiker, gesorteerd op meest recent.
 * Gebruik alleen kolommen die zeker bestaan: id, name, created_at.
 */
export async function loadUserCanvases(userId) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from("canvases")
    .select("id, name, created_at, updated_at, canvas_uploads(id)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false });
}

/**
 * Maak een nieuw canvas aan voor een gebruiker.
 * Geeft het aangemaakte record terug (inclusief id).
 */
export async function createCanvas({ userId, tenantId, name, language = "nl" }) {
  if (!supabase) return { data: null, error: "Supabase niet geconfigureerd" };

  console.log("[createCanvas] inserting:", { userId, tenantId, name, language });

  const { data, error } = await supabase
    .from("canvases")
    .insert({
      user_id:   userId,
      tenant_id: tenantId,
      name:      name,
      blocks:    {},
    })
    .select()
    .single();

  if (error) {
    console.error("[createCanvas] mislukt:", error.code, error.message, error.details);
  } else {
    console.log("[createCanvas] success:", data);
  }
  return { data, error };
}

/**
 * Sla de huidige canvas staat op (autosave).
 * Last-write-wins. updated_at wordt weggelaten voor schema-compatibiliteit.
 */
export async function upsertCanvas(id, { scope, docs, insights, bullets, language, meta = {} }) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };

  const payload = {
    name:                scope || null,
    blocks:              { docs, insights, bullets },
    client_name:         meta.client_name         || null,
    author_name:         meta.author_name          || null,
    industry:            meta.industry             || null,
    transformation_type: meta.transformation_type  || null,
    org_size:            meta.org_size             || null,
    project_status:      meta.project_status       || null,
    project_description: meta.project_description  || null,
  };

  const { data, error } = await supabase
    .from("canvases")
    .update(payload)
    .eq("id", id)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[autosave] mislukt:", error.code, error.message, error.details);
  } else {
    console.log("[autosave] success:", data);
  }
  return { error };
}

/**
 * Laad één canvas op basis van ID (inclusief blocks voor herstel staat).
 */
export async function loadCanvasById(id) {
  if (!supabase) return { data: null, error: "Supabase niet geconfigureerd" };
  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("id", id)
    .single();
  if (error) console.error("Canvas laden mislukt:", error.message);
  return { data, error };
}

/**
 * Laad alle actieve blokdefinities gesorteerd op volgorde.
 * Vervangt hardcoded labels in de UI — IP protection.
 */
/**
 * S1 design-systeem — F12 canvas-tegel-feedback.
 * Roept Postgres-RPC `get_canvas_summary(canvas_id)` aan voor counts +
 * last-quote per werkblad-pijler. Eén round-trip per canvas-switch.
 * Migration: 20260513200000_S1_get_canvas_summary_rpc.sql.
 *
 * Returns: { data: {klanten,strategie,richtlijnen} | null, error }
 */
export async function loadCanvasSummary(canvasId) {
  if (!supabase) return { data: null, error: null };
  if (!canvasId) return { data: null, error: new Error("canvasId is required") };
  const { data, error } = await supabase.rpc("get_canvas_summary", { p_canvas_id: canvasId });
  return { data: data || null, error };
}

export async function fetchBlockDefinitions() {
  if (!supabase) return { data: [], error: null };
  // Stap-7 fase-6: tenant-scoped lookup via RPC. Server-side DISTINCT ON
  // kiest tenant-override boven globale baseline; is_active-filter zit
  // in de RPC zelf.
  const { data, error } = await supabase.rpc("get_block_definitions_for_tenant");
  if (error) return { data: [], error };
  // RPC sorteert op key (DISTINCT ON-vereiste). Frontend verwacht sort_order — re-sort.
  const sorted = (data || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return { data: sorted, error: null };
}

/**
 * Sla handmatige consultant-invoer op in canvases.data[blockKey].details.manual.
 *
 * MERGE-REGEL: schrijft NOOIT naar details.ai_insights.
 * De scheiding wordt gehandhaafd op API-laag, niet als frontend-conventie.
 */
export async function saveBlockManualData(canvasId, blockKey, manualData) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };

  const { data: row, error: loadErr } = await supabase
    .from("canvases")
    .select("data")
    .eq("id", canvasId)
    .single();

  if (loadErr) {
    console.error("[deepdive] laden mislukt:", loadErr.message);
    return { error: loadErr };
  }

  const currentData    = row?.data    || {};
  const currentBlock   = currentData[blockKey]     || {};
  const currentDetails = currentBlock.details      || {};

  const merged = {
    ...currentData,
    [blockKey]: {
      ...currentBlock,
      details: {
        ...currentDetails,
        manual:      manualData,
        ai_insights: currentDetails.ai_insights || {},
      },
    },
  };

  const { error } = await supabase
    .from("canvases")
    .update({ data: merged })
    .eq("id", canvasId);

  if (error) console.error("[deepdive] opslaan mislukt:", error.message);
  return { error };
}

/**
 * Verwijder een canvas op basis van ID.
 *
 * De RLS-policies op child-tabellen controleren of canvas_id nog in de
 * canvases-tabel staat. Supabase CASCADE-deletes lopen als de huidige
 * authenticated-gebruiker, waardoor RLS-checks falen zodra het canvas
 * al gemarkeerd is voor verwijdering.
 *
 * Oplossing: verwijder child-records expliciet in de juiste volgorde,
 * terwijl het canvas nog bestaat. Daarna pas het canvas zelf verwijderen.
 */
export async function deleteCanvas(id) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };

  // 1. document_chunks — RLS gebruikt canvas_id subquery, moet vóór canvas-delete
  const { error: chunksErr } = await supabase
    .from("document_chunks").delete().eq("canvas_id", id);
  if (chunksErr) console.error("[deleteCanvas] chunks:", chunksErr.message);

  // 2. canvas_uploads
  const { error: uploadsErr } = await supabase
    .from("canvas_uploads").delete().eq("canvas_id", id);
  if (uploadsErr) console.error("[deleteCanvas] uploads:", uploadsErr.message);

  // 3. strategic_themes (cascade → ksf_kpi)
  const { error: themesErr } = await supabase
    .from("strategic_themes").delete().eq("canvas_id", id);
  if (themesErr) console.error("[deleteCanvas] themes:", themesErr.message);

  // 4. analysis_items
  const { error: itemsErr } = await supabase
    .from("analysis_items").delete().eq("canvas_id", id);
  if (itemsErr) console.error("[deleteCanvas] items:", itemsErr.message);

  // 5. guidelines + guideline_analysis (Sprint 8)
  const { error: glErr } = await supabase
    .from("guidelines").delete().eq("canvas_id", id);
  if (glErr) console.error("[deleteCanvas] guidelines:", glErr.message);

  const { error: gaErr } = await supabase
    .from("guideline_analysis").delete().eq("canvas_id", id);
  if (gaErr) console.error("[deleteCanvas] guideline_analysis:", gaErr.message);

  // 6. strategy_core
  const { error: coreErr } = await supabase
    .from("strategy_core").delete().eq("canvas_id", id);
  if (coreErr) console.error("[deleteCanvas] core:", coreErr.message);

  // 6. Verwijder het canvas zelf (cascades vinden nu niets meer)
  const { error } = await supabase.from("canvases").delete().eq("id", id);
  if (error) console.error("[deleteCanvas] canvas:", error.message);
  return { error };
}
