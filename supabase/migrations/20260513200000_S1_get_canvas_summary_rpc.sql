-- ============================================================
-- S1 Hoofdcanvas — RPC voor F12 canvas-tegel-feedback (counts + last-quote
-- per werkblad-pijler op canvas-overzicht).
--
-- Eén round-trip per canvas (BlockCard-tegels) ipv 12+ losse SELECT's.
-- SECURITY INVOKER (default) — RLS-policies op cd_*/strategy_*/guidelines
-- filteren per tenant via current_tenant_id()/canvas-ownership. RPC doet
-- aggregate-counts + last-edit-quote per pijler.
--
-- authenticated + anon mogen execute (frontend roept aan vanuit App.js
-- via useCanvasState — anon pre-login krijgt 0 counts via RLS-block).
-- ============================================================

CREATE OR REPLACE FUNCTION get_canvas_summary(p_canvas_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'klanten', jsonb_build_object(
      'dimensies',  (SELECT count(*) FROM cd_dimensions WHERE canvas_id = p_canvas_id),
      'items',      (SELECT count(*) FROM cd_items WHERE canvas_id = p_canvas_id AND is_draft = false),
      'pijnpunten', (SELECT count(*) FROM cd_pain_points WHERE canvas_id = p_canvas_id AND is_draft = false),
      'verbeteracties_roadmap', (SELECT count(*) FROM cd_improvement_intents
                                  WHERE canvas_id = p_canvas_id AND status = 'verstuurd'),
      'verbeteracties_concept', (SELECT count(*) FROM cd_improvement_intents
                                  WHERE canvas_id = p_canvas_id AND status = 'concept'),
      'last_pattern_text', (
        SELECT text_md FROM cd_pattern_suggestions
        WHERE canvas_id = p_canvas_id AND current_status IN ('accepted','promoted')
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      )
    ),
    'strategie', jsonb_build_object(
      'themas', (SELECT count(*) FROM strategic_themes WHERE canvas_id = p_canvas_id),
      'missie_filled',  (SELECT (coalesce(length(trim(missie)),  0) > 0) FROM strategy_core WHERE canvas_id = p_canvas_id LIMIT 1),
      'visie_filled',   (SELECT (coalesce(length(trim(visie)),   0) > 0) FROM strategy_core WHERE canvas_id = p_canvas_id LIMIT 1),
      'ambitie_filled', (SELECT (coalesce(length(trim(ambitie)), 0) > 0) FROM strategy_core WHERE canvas_id = p_canvas_id LIMIT 1),
      'samenvatting_filled', (SELECT (coalesce(length(trim(samenvatting)), 0) > 0) FROM strategy_core WHERE canvas_id = p_canvas_id LIMIT 1),
      'last_thema_title', (SELECT title FROM strategic_themes WHERE canvas_id = p_canvas_id ORDER BY created_at DESC NULLS LAST LIMIT 1),
      'last_updated_at', (SELECT updated_at FROM strategy_core WHERE canvas_id = p_canvas_id LIMIT 1)
    ),
    'richtlijnen', jsonb_build_object(
      'count',      (SELECT count(*) FROM guidelines WHERE canvas_id = p_canvas_id),
      'last_title', (SELECT title FROM guidelines WHERE canvas_id = p_canvas_id ORDER BY created_at DESC NULLS LAST LIMIT 1)
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_canvas_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_canvas_summary(uuid) TO anon;
