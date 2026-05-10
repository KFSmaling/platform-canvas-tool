/**
 * usePatternSuggestions — load suggestions voor één canvas, met race-guards
 * en reset-vooraf per CLAUDE.md sectie 4.3 + 4.4.
 *
 * Anker-pattern: usePainPoints (zelfde structuur, één resource).
 *
 * Returns:
 *   { loading, error, suggestions, reload }
 *
 * Bevat alle suggestions ongeacht status (open/edited/refined/accepted/rejected/
 * promoted) — UI-laag filtert. Counter en accepted-rapport-lijst lezen uit
 * dezelfde state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as klantenService from "../services/klanten.service";

export function usePatternSuggestions(canvasId) {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [reloadKey, setReloadKey]     = useState(0);

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!canvasId) {
      setLoading(false);
      setSuggestions([]);
      return;
    }

    const activeCanvasId = canvasId;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Stap 11.G.2 F4-fix: NIET setSuggestions(null) — laatste-bekende-state
    // behouden tijdens reload zodat AnalyseView geen flash-of-empty toont.
    // Initial-load: suggestions is al null vanuit useState-default; reload:
    // bestaande array blijft staan tot nieuwe data binnen is.

    (async () => {
      const { data, error: loadErr } = await klantenService.listPatternSuggestions(activeCanvasId, { includeDone: true });

      if (cancelled) return;
      if (activeCanvasId !== canvasIdRef.current) return;

      if (loadErr) {
        setError(loadErr);
        setLoading(false);
        return;
      }

      setSuggestions(data || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [canvasId, reloadKey]);

  return { loading, error, suggestions, reload };
}
