/**
 * useCanvasUploads — load canvas-upload-status voor één canvas, met
 * race-guards en reset-vooraf per CLAUDE.md §4.3 + §4.4.
 *
 * Stap 11.K: bepaalt of dossier-driven AI-affordances geactiveerd kunnen worden:
 *   - hasUploads: er staat minstens één canvas_uploads-rij
 *   - hasIndexedChunks: er zijn child-chunks met embedding voor dit canvas
 *   - uploadsProcessing: er zijn uploads maar geen geïndexeerde chunks
 *     (proxy voor "import_jobs nog niet klaar" — geen aparte tabel-fetch)
 *
 * Single source of truth in KlantenWerkblad (anker 11.G.4 lift-state-up):
 * één fetch, alle drie de affordance-locaties (DimensieKolom / ItemModal /
 * PijnpuntenView-header) krijgen status via props.
 *
 * Returns:
 *   { loading, error, hasUploads, hasIndexedChunks, uploadsProcessing,
 *     uploadCount, indexedChunkCount, reload }
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as klantenService from "../services/klanten.service";

export function useCanvasUploads(canvasId) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [status, setStatus]   = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!canvasId) {
      setLoading(false);
      setStatus({ hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 });
      return;
    }

    const activeCanvasId = canvasId;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Behoud laatste-bekende state tijdens reload (anker usePatternSuggestions)

    (async () => {
      const { data, error: loadErr } = await klantenService.fetchUploadsStatus(activeCanvasId);
      if (cancelled) return;
      if (activeCanvasId !== canvasIdRef.current) return;
      if (loadErr) {
        setError(loadErr);
        setLoading(false);
        return;
      }
      setStatus(data || { hasUploads: false, hasIndexedChunks: false, uploadCount: 0, indexedChunkCount: 0 });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [canvasId, reloadKey]);

  return {
    loading,
    error,
    hasUploads:        !!status?.hasUploads,
    hasIndexedChunks:  !!status?.hasIndexedChunks,
    uploadsProcessing: !!(status?.hasUploads && !status?.hasIndexedChunks),
    uploadCount:       status?.uploadCount ?? 0,
    indexedChunkCount: status?.indexedChunkCount ?? 0,
    reload,
  };
}
