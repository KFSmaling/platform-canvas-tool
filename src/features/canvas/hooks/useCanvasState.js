/**
 * useCanvasState — canvas business logic hook
 *
 * Verantwoordelijk voor:
 *  - canvas-laden bij login (meest recente canvas)
 *  - autosave (500ms debounce)
 *  - multi-tab detectie
 *  - alle canvas CRUD handlers
 *  - per-blok state (docs, insights, bullets)
 *
 * App.js houdt alleen UI-state bij (welk panel open, modals, etc.)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  loadUserCanvases,
  createCanvas,
  upsertCanvas,
  loadCanvasById,
  deleteCanvas,
} from "../../../services/canvasStorage";
import { BLOCKS, EXAMPLE_BULLETS } from "../components/BlockCard";
import { log, err } from "../../../shared/utils/logger";
import { loadGuidelineCounts } from "../../richtlijnen/services/guidelines.service";
import { loadStrategyCore, loadStrategicThemes, loadAnalysisItems } from "../../strategie/services/strategy.service";
import { loadCanvasSummary } from "../../../shared/services/canvas.service";

/**
 * @param {object} options
 * @param {object}   options.user           — Supabase user object (null als niet ingelogd)
 * @param {string}   options.tenantId       — UUID van de tenant (uit user_profiles, via AuthProvider)
 * @param {string}   options.lang           — huidige taalcode ("nl" | "en")
 * @param {function} options.onCanvasSwitch — wordt aangeroepen wanneer canvas wisselt (reset UI-state)
 */
export function useCanvasState({ user, tenantId, lang, onCanvasSwitch }) {
  // ── Canvas identiteit ───────────────────────────────────────────────────────
  const [activeCanvasId, setActiveCanvasId] = useState(null);
  const [canvases, setCanvases]             = useState([]);
  const [scope, setScope]                   = useState("");

  // ── Project metadata ────────────────────────────────────────────────────────
  const [meta, setMeta] = useState({});

  // ── Per-blok state ──────────────────────────────────────────────────────────
  const [docs, setDocs]         = useState({});
  const [insights, setInsights] = useState({});
  const [bullets, setBullets]   = useState({});

  // ── Deep Dive manual data (strategie executive summary) ─────────────────────
  const [strategyManual, setStrategyManual] = useState(null);

  // ── Guideline counts per segment (voor Principles canvas block) ──────────────
  const [guidelineCounts, setGuidelineCounts] = useState({});

  // S1 design-systeem — F12 canvas-tegel-feedback. summary uit RPC
  // `get_canvas_summary`. Ververst bij canvas-switch + bij refresh-trigger.
  const [canvasSummary, setCanvasSummary] = useState(null);

  // ── Autosave indicator ──────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  // ── Multi-tab waarschuwing ──────────────────────────────────────────────────
  const [multiTabWarning, setMultiTabWarning] = useState(false);

  // ── Interne refs ────────────────────────────────────────────────────────────
  const suppressSaveRef  = useRef(false); // onderdruk autosave tijdens canvas-laden
  const autosaveTimerRef = useRef(null);
  const latestSelectRef  = useRef(null);  // race-guard handleSelectCanvas (CLAUDE.md 4.3)

  // ── Helper: herlaad guideline counts voor actief canvas ─────────────────────
  const refreshGuidelineCounts = useCallback(async (canvasId) => {
    if (!canvasId) return;
    const { data } = await loadGuidelineCounts(canvasId);
    setGuidelineCounts(data || {});
  }, []);

  // S1 design-systeem — F12 canvas-tegel-feedback. Trigger-refresh na
  // werkblad-mutaties (DeepDiveOverlay-onManualSaved-callback in App.js).
  const refreshCanvasSummary = useCallback(async (canvasId) => {
    if (!canvasId) return;
    const { data } = await loadCanvasSummary(canvasId);
    setCanvasSummary(data || null);
  }, []);

  // ── Helper: laad een canvas-record in state ─────────────────────────────────
  const applyCanvasData = useCallback((full) => {
    suppressSaveRef.current = true;
    setActiveCanvasId(full.id);
    localStorage.setItem("btc.lastCanvasId", full.id);
    setScope(full.name || "");
    setDocs(full.blocks?.docs || {});
    setInsights(full.blocks?.insights || {});
    setBullets(full.blocks?.bullets || {});
    setMeta({
      client_name:         full.client_name         || "",
      author_name:         full.author_name          || "",
      industry:            full.industry             || "",
      transformation_type: full.transformation_type  || "",
      org_size:            full.org_size             || "",
      project_status:      full.project_status       || "",
      project_description: full.project_description  || "",
    });
    const sm = full.data?.strategy?.details?.manual;
    setStrategyManual(sm || null);
    // Laad guideline counts + strategy_core asynchroon (niet-blokkerend)
    Promise.all([
      loadGuidelineCounts(full.id),
      loadStrategyCore(full.id),
      loadStrategicThemes(full.id),
      loadAnalysisItems(full.id),
      loadCanvasSummary(full.id),   // S1 — F12 canvas-tegel-feedback
    ]).then(([{ data: counts }, { data: co }, { data: themes }, { data: analysisItems }, { data: summary }]) => {
      setGuidelineCounts(counts || {});
      setCanvasSummary(summary || null);
      if (co || themes) {
        const swotCount = (analysisItems || []).filter(i => i.tag && i.tag !== "niet_relevant").length;
        setStrategyManual({
          missie:       co?.missie       || null,
          visie:        co?.visie        || null,
          ambitie:      co?.ambitie      || null,
          kernwaarden:  co?.kernwaarden  || [],
          samenvatting: co?.samenvatting || null,
          themaCount:   (themes || []).length,
          swotCount,
        });
      }
    });
    setTimeout(() => { suppressSaveRef.current = false; }, 100);
  }, []);

  // ── Laad canvassen bij inloggen ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const today = new Date().toLocaleDateString("nl-NL", {
      day: "2-digit", month: "short", year: "numeric",
    });

    loadUserCanvases(user.id).then(async ({ data, error }) => {
      if (error) {
        err("[init] Canvassen laden mislukt:", error.code, error.message);
        return;
      }
      log("[init] canvassen geladen:", data?.length, data);

      if (data && data.length > 0) {
        setCanvases(data);
        // Herstel het laatste actieve canvas uit localStorage; val terug op data[0]
        const lastId = localStorage.getItem("btc.lastCanvasId");
        const target = lastId ? data.find(c => c.id === lastId) : null;
        const { data: full, error: loadErr } = await loadCanvasById(target ? target.id : data[0].id);
        log("[init] canvas laden:", full, loadErr);
        if (full) applyCanvasData(full);
      } else {
        // Geen canvassen — maak direct een nieuw aan
        const name = `Canvas ${today}`;
        const { data: created, error: createErr } = await createCanvas({
          userId: user.id, tenantId, name, language: lang,
        });
        log("[init] nieuw canvas:", created, createErr);
        if (created) {
          suppressSaveRef.current = true;
          setCanvases([created]);
          setActiveCanvasId(created.id);
          setScope(created.name || name);
          setTimeout(() => { suppressSaveRef.current = false; }, 100);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Autosave (500ms debounce, last-write-wins) ──────────────────────────────
  useEffect(() => {
    if (!activeCanvasId) { log("[autosave] skip: geen activeCanvasId"); return; }
    if (!user)           { log("[autosave] skip: geen user"); return; }
    if (suppressSaveRef.current) { log("[autosave] skip: suppress actief"); return; }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      const { error } = await upsertCanvas(activeCanvasId, {
        scope, docs, insights, bullets, language: lang, meta,
      });
      if (!error) {
        setSaveStatus("saved");
        setCanvases(prev =>
          prev.map(c => c.id === activeCanvasId ? { ...c, name: scope } : c)
        );
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    }, 500);

    return () => clearTimeout(autosaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, docs, insights, bullets, meta, activeCanvasId]);

  // ── Multi-tab detectie ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    let warned = false;
    const bc = new BroadcastChannel("kingfisher_btc");
    bc.postMessage("ping");
    bc.onmessage = (e) => {
      if (e.data === "ping") bc.postMessage("pong");
      if (e.data === "pong" && !warned) { warned = true; setMultiTabWarning(true); }
    };
    return () => bc.close();
  }, []);

  // ── Canvas handlers ─────────────────────────────────────────────────────────

  const handleNewCanvas = useCallback(async () => {
    const today = new Date().toLocaleDateString("nl-NL", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const name = `Canvas ${today}`;
    const { data, error } = await createCanvas({ userId: user.id, tenantId, name, language: lang });
    if (!error && data) {
      setCanvases(prev => [data, ...prev]);
      suppressSaveRef.current = true;
      setActiveCanvasId(data.id);
      setScope(data.name);
      setDocs({}); setInsights({}); setBullets({});
      setStrategyManual(null);
      setGuidelineCounts({});
      onCanvasSwitch?.();
      setTimeout(() => { suppressSaveRef.current = false; }, 100);
    }
  }, [user, tenantId, lang, onCanvasSwitch]);

  const handleSelectCanvas = useCallback(async (canvasRecord) => {
    // Reset state METEEN zodat de gebruiker geen verouderd canvas ziet tijdens de DB-fetch
    suppressSaveRef.current = true;
    setDocs({}); setInsights({}); setBullets({});
    setStrategyManual(null);
    setGuidelineCounts({});
    setCanvasSummary(null);   // S1 — vermijd ghost summary van vorige canvas

    // Race-guard (CLAUDE.md 4.3): bij snel achter elkaar twee canvases klikken kan de
    // tweede fetch eerder terugkomen dan de eerste. Capture de request-id en negeer
    // resultaten van een verouderde request.
    const requestId = canvasRecord.id;
    latestSelectRef.current = requestId;

    const { data: full } = await loadCanvasById(canvasRecord.id);

    if (latestSelectRef.current !== requestId) return; // verouderde request

    if (full) {
      applyCanvasData(full);
      onCanvasSwitch?.();
    }
  }, [applyCanvasData, onCanvasSwitch]);

  const handleRenameCanvas = useCallback((newName) => {
    setScope(newName);
    // Autosave pikt de gewijzigde scope op via het debounce-effect
  }, []);

  const handleDeleteCanvas = useCallback(async (canvasId) => {
    const { error } = await deleteCanvas(canvasId);
    if (error) {
      err("[delete] canvas verwijderen mislukt:", error.message);
      return { error };
    }

    // Verwijder uit lijst
    setCanvases(prev => prev.filter(c => c.id !== canvasId));

    // Als het actieve canvas verwijderd wordt: reset state en laat gebruiker ander canvas kiezen
    if (activeCanvasId === canvasId) {
      setActiveCanvasId(null);
      setScope("");
      setDocs({}); setInsights({}); setBullets({});
      setStrategyManual(null);
      setCanvasSummary(null);
      onCanvasSwitch?.();
    }
    return { error: null };
  }, [activeCanvasId, onCanvasSwitch]);

  const handleLoadExample = useCallback(() => {
    suppressSaveRef.current = true;
    setBullets(EXAMPLE_BULLETS);
    setScope("Company Example — BTP 2024");
    setDocs({});
    setInsights({});
    onCanvasSwitch?.();
    setTimeout(() => { suppressSaveRef.current = false; }, 100);
  }, [onCanvasSwitch]);

  // ── Per-blok handlers ───────────────────────────────────────────────────────

  const handleDocsChange = useCallback((blockId, filename, newInsights) => {
    setDocs(p => ({ ...p, [blockId]: [...(p[blockId] || []), filename] }));
    setInsights(p => ({ ...p, [blockId]: [...(p[blockId] || []), ...newInsights] }));
  }, []);

  const handleInsightAccept = useCallback((blockId, insightId) => {
    setInsights(p => ({
      ...p,
      [blockId]: p[blockId].map(i => i.id === insightId ? { ...i, status: "accepted" } : i),
    }));
  }, []);

  const handleInsightReject = useCallback((blockId, insightId) => {
    setInsights(p => ({
      ...p,
      [blockId]: p[blockId].filter(i => i.id !== insightId),
    }));
  }, []);

  const handleMoveToBullets = useCallback((blockId, insight, editIdx = null, isEdit = false) => {
    const block = BLOCKS.find(b => b.id === blockId);
    const bulletObj = {
      text:   insight.text,
      source: insight.source || null,
      subtab: insight.subtab || (block?.hasSubs ? (block.subTabs?.[0]?.id || "current") : null),
    };
    if (isEdit && editIdx !== null) {
      setBullets(p => {
        const arr = [...(p[blockId] || [])];
        arr[editIdx] = bulletObj;
        return { ...p, [blockId]: arr };
      });
    } else {
      setBullets(p => ({
        ...p,
        [blockId]: [
          ...(p[blockId] || []).filter(b =>
            (typeof b === "string" ? b : b.text) !== insight.text
          ),
          bulletObj,
        ],
      }));
      if (!isEdit) {
        setInsights(p => ({
          ...p,
          [blockId]: (p[blockId] || []).filter(i => i.id !== insight.id),
        }));
      }
    }
  }, []);

  const handleDeleteBullet = useCallback((blockId, idx) => {
    setBullets(p => ({ ...p, [blockId]: p[blockId].filter((_, i) => i !== idx) }));
  }, []);

  const handleAddBullet = useCallback((blockId, text, subtab = null) => {
    setBullets(p => ({
      ...p,
      [blockId]: [...(p[blockId] || []), { text, source: null, subtab }],
    }));
  }, []);

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    // state (readonly vanuit App.js perspectief)
    activeCanvasId,
    canvases,
    scope,
    meta,
    docs,
    insights,
    bullets,
    strategyManual,
    guidelineCounts,
    canvasSummary,           // S1 — F12 canvas-tegel-feedback
    saveStatus,
    multiTabWarning,

    // directe setters (voor projectinfo sidebar, multi-tab dismiss, strategy preview)
    setMeta,
    setMultiTabWarning,
    setStrategyManual,
    refreshGuidelineCounts,
    refreshCanvasSummary,    // S1 — trigger na werkblad-mutatie

    // canvas handlers
    handleNewCanvas,
    handleSelectCanvas,
    handleRenameCanvas,
    handleDeleteCanvas,
    handleLoadExample,

    // blok handlers
    handleDocsChange,
    handleInsightAccept,
    handleInsightReject,
    handleMoveToBullets,
    handleDeleteBullet,
    handleAddBullet,
  };
}
