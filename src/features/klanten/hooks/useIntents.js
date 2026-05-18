/**
 * useIntents — load cd_improvement_intents voor één canvas, met
 * race-guards en reset-vooraf per CLAUDE.md sectie 4.3 + 4.4.
 *
 * Anker-pattern: usePatternSuggestions (zelfde structuur, één resource).
 *
 * Returns:
 *   { loading, error, intents, reload }
 *
 * Bevat alle intents ongeacht status (concept/verstuurd) — UI-laag filtert.
 * Single source of truth zodat RapportView en VerbeteractiesView vanuit
 * KlantenWerkblad dezelfde data renderen (anker 11.G.4 F11-fix).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as klantenService from "../services/klanten.service";

export function useIntents(canvasId) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [intents, setIntents] = useState(null);
  // 11.U Block 2b: links komen mee in dezelfde GET-call (cd_intent_pain_point_links)
  const [links, setLinks]     = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!canvasId) {
      setLoading(false);
      setIntents([]);
      return;
    }

    const activeCanvasId = canvasId;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Behoud laatste state tijdens reload (anker usePatternSuggestions F4-fix):
    // initial-load: intents is null vanuit useState; reload: bestaande array
    // blijft staan tot nieuwe data binnen is.

    (async () => {
      // 11.U Block 2b: listIntents geeft nu ook `links` mee (cd_intent_pain_point_links).
      const { data, links: loadedLinks, error: loadErr } = await klantenService.listIntents(activeCanvasId);

      if (cancelled) return;
      if (activeCanvasId !== canvasIdRef.current) return;

      if (loadErr) {
        setError(loadErr);
        setLoading(false);
        return;
      }

      setIntents(data || []);
      // Block 2b: links komen mee als veld; oudere tests die alleen { data, error }
      // mocken krijgen undefined → fallback op [].
      setLinks(Array.isArray(loadedLinks) ? loadedLinks : []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [canvasId, reloadKey]);

  return { loading, error, intents, links, reload };
}
