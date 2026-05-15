import { supabase } from "./supabase.client";
import { apiFetch } from "./apiClient";

/**
 * Upload een bronbestand naar Supabase Storage (bucket: 'documents').
 * Pad: {canvasId}/{timestamp}_{fileName}
 */
export async function uploadDocumentToStorage(file, canvasId) {
  if (!supabase) return { path: null, error: "Supabase niet geconfigureerd" };
  const path = `${canvasId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });
  if (error) console.error("[storage] upload mislukt:", error.message);
  return { path: data?.path || null, error };
}

/**
 * Maak een import job record aan in import_jobs.
 */
export async function createImportJob({ canvasId, userId, fileName, fileType }) {
  if (!supabase) return { data: null, error: "Supabase niet geconfigureerd" };
  const { data, error } = await supabase
    .from("import_jobs")
    .insert({ canvas_id: canvasId, user_id: userId, file_name: fileName, file_type: fileType, status: "queued" })
    .select()
    .single();
  if (error) console.error("[import_job] aanmaken mislukt:", error.message);
  return { data, error };
}

/**
 * Werk de status van een import job bij.
 */
export async function updateImportJob(id, updates) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };
  const { error } = await supabase
    .from("import_jobs")
    .update(updates)
    .eq("id", id);
  if (error) console.error("[import_job] update mislukt:", error.message);
  return { error };
}

/**
 * Sprint 3B — Parent-Child chunking + OpenAI embedding pipeline.
 *
 * Parent chunks (~1000 chars) bieden retrieval-context.
 * Child chunks (~200 chars) krijgen embeddings en zijn de zoekeenheden.
 * Kinderen zijn via parent_id gelinkt aan hun ouder.
 *
 * onProgress(pct: 0-100) wordt aangeroepen na elke embedbatch.
 */
export async function indexDocumentChunks(uploadId, canvasId, rawText, onProgress) {
  if (!supabase) return { error: "Supabase niet geconfigureerd" };

  const PARENT_SIZE = 1000;
  const PARENT_STEP = 800;  // 200-char overlap tussen parents
  const CHILD_SIZE  = 200;
  const CHILD_STEP  = 150;  // 50-char overlap tussen children
  const EMBED_BATCH = 50;   // max chunks per /api/documents?_subpath=embed call

  // ── Hulpfunctie: extraheer slide- of paginanummer uit tekst ─────────────────
  // Herkent: [Slide 7], [Pagina 3], [Notes 12], [Page 5]
  const extractPageNumber = (text) => {
    const match = text.match(/\[(Slide|Pagina|Page|Notes)\s+(\d+)\]/i);
    return match ? parseInt(match[2], 10) : null;
  };

  // ── Stap 1: parent chunks bouwen ──────────────────────────────────────────
  const parents = [];
  for (let i = 0; i < rawText.length; i += PARENT_STEP) {
    const text = rawText.slice(i, i + PARENT_SIZE);
    parents.push({ text, startChar: i, pageNumber: extractPageNumber(text) });
    if (i + PARENT_SIZE >= rawText.length) break;
  }
  if (parents.length === 0) return { error: "Geen tekst om te indexeren" };

  // ── Stap 2: parents opslaan (zonder embedding) ────────────────────────────
  const { data: parentRows, error: parentErr } = await supabase
    .from("document_chunks")
    .insert(parents.map(p => ({
      upload_id:   uploadId,
      canvas_id:   canvasId,
      chunk_type:  "parent",
      content:     p.text,
      page_number: p.pageNumber,
      metadata:    { startChar: p.startChar },
    })))
    .select("id");

  if (parentErr) {
    console.error("[index] parent insert mislukt:", parentErr.message);
    return { error: parentErr.message };
  }

  // ── Stap 3: child chunks per parent bouwen ────────────────────────────────
  const children = [];
  for (let pi = 0; pi < parents.length; pi++) {
    const parentId     = parentRows[pi].id;
    const parentText   = parents[pi].text;
    const parentPage   = parents[pi].pageNumber;
    for (let ci = 0; ci < parentText.length; ci += CHILD_STEP) {
      const childText = parentText.slice(ci, ci + CHILD_SIZE);
      // Gebruik slide/paginanummer van de child zelf als aanwezig, anders van de parent
      const childPage = extractPageNumber(childText) ?? parentPage;
      children.push({
        upload_id:   uploadId,
        canvas_id:   canvasId,
        chunk_type:  "child",
        parent_id:   parentId,
        content:     childText,
        page_number: childPage,
      });
      if (ci + CHILD_SIZE >= parentText.length) break;
    }
  }

  // ── Stap 4: embed + opslaan in batches ───────────────────────────────────
  for (let b = 0; b < children.length; b += EMBED_BATCH) {
    const batch = children.slice(b, b + EMBED_BATCH);
    const texts = batch.map(c => c.content);

    let embeddings;
    try {
      const embRes = await apiFetch("/api/documents?_subpath=embed", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ texts }),
      });
      if (!embRes.ok) {
        const err = await embRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${embRes.status}`);
      }
      ({ embeddings } = await embRes.json());
    } catch (e) {
      console.error("[index] embedding mislukt:", e.message);
      return { error: `Embedding mislukt: ${e.message}` };
    }

    const rows = batch.map((c, i) => ({ ...c, embedding: embeddings[i] }));
    const { error: insertErr } = await supabase
      .from("document_chunks")
      .insert(rows);

    if (insertErr) {
      console.error("[index] child insert mislukt:", insertErr.message);
      return { error: insertErr.message };
    }

    if (onProgress) {
      onProgress(Math.round(((b + batch.length) / children.length) * 100));
    }
  }

  console.log(`[index] klaar: ${parents.length} parents, ${children.length} children`);
  return { totalParents: parents.length, totalChildren: children.length, error: null };
}

/**
 * Sprint 3C — Vector similarity search via Supabase RPC.
 * Vereist de `match_document_chunks` functie in Supabase (zie SQL hieronder).
 *
 * SQL om in Supabase SQL Editor uit te voeren:
 *   CREATE OR REPLACE FUNCTION match_document_chunks(
 *     query_embedding vector(1536),
 *     match_canvas_id uuid,
 *     match_count int DEFAULT 5
 *   ) RETURNS TABLE (id uuid, content text, file_name text, page_number int, distance float)
 *   LANGUAGE sql STABLE AS $$
 *     SELECT dc.id, dc.content, cu.file_name, dc.page_number,
 *            (dc.embedding <=> query_embedding)::float AS distance
 *     FROM document_chunks dc
 *     LEFT JOIN canvas_uploads cu ON dc.upload_id = cu.id
 *     WHERE dc.chunk_type = 'child'
 *       AND dc.canvas_id = match_canvas_id
 *       AND dc.embedding IS NOT NULL
 *     ORDER BY dc.embedding <=> query_embedding
 *     LIMIT match_count;
 *   $$;
 */
export async function searchDocumentChunks(embedding, canvasId, count = 5) {
  if (!supabase) return { data: [], error: null };
  return supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_canvas_id: canvasId,
    match_count: count,
  });
}

/**
 * Diagnostisch: tel hoeveel geïndexeerde child-chunks met embedding een canvas heeft.
 * Gebruikt in callMagic om canvas_id mismatch te detecteren.
 */
export async function countIndexedChunks(canvasId) {
  if (!supabase || !canvasId) return { count: 0, error: null };
  const { count, error } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("canvas_id", canvasId)
    .eq("chunk_type", "child")
    .not("embedding", "is", null);
  return { count: count ?? 0, error };
}
