/**
 * usePainPoints — load pijnpunten + couplings voor één canvas, met
 * race-guards en reset-vooraf per CLAUDE.md sectie 4.3 + 4.4.
 *
 * Returns:
 *   { loading, error, painPoints, couplings, reload }
 *
 * couplings is een array van { id, pain_point_id, target_table, target_id, ... }.
 * Voor één pijn alle koppelingen opvragen: filter zelf op `pain_point_id`.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as klantenService from "../services/klanten.service";

export function usePainPoints(canvasId) {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [painPoints, setPainPoints] = useState(null);
  const [couplings, setCouplings]   = useState(null);
  const [reloadKey, setReloadKey]   = useState(0);

  const canvasIdRef = useRef(canvasId);
  useEffect(() => { canvasIdRef.current = canvasId; }, [canvasId]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!canvasId) {
      setLoading(false);
      setPainPoints([]);
      setCouplings([]);
      return;
    }

    const activeCanvasId = canvasId;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPainPoints(null);
    setCouplings(null);

    (async () => {
      const [ppRes, coRes] = await Promise.all([
        klantenService.listPainPoints(activeCanvasId),
        klantenService.listCouplingsForCanvas(activeCanvasId),
      ]);

      if (cancelled) return;
      if (activeCanvasId !== canvasIdRef.current) return;

      if (ppRes.error) {
        setError(ppRes.error);
        setLoading(false);
        return;
      }
      if (coRes.error) {
        setError(coRes.error);
        setLoading(false);
        return;
      }

      setPainPoints(ppRes.data);
      setCouplings(coRes.data);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [canvasId, reloadKey]);

  return { loading, error, painPoints, couplings, reload };
}
