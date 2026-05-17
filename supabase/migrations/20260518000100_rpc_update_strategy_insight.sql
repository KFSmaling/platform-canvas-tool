-- RFC-008 §B — partial-update op één insight in strategy_core.insights[].
-- Atomair via jsonb_set; concurrency-veilig zonder version-column.
-- SECURITY INVOKER: RLS van strategy_core blijft van toepassing.

CREATE OR REPLACE FUNCTION update_strategy_insight(
  p_canvas_id uuid,
  p_insight_id text,
  p_fields jsonb,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_insights jsonb;
  v_idx int;
  v_updated jsonb;
  v_now timestamptz := now();
BEGIN
  -- 1. Read huidige insights[] (RLS-gefilterd via SECURITY INVOKER)
  SELECT insights INTO v_insights
  FROM strategy_core
  WHERE canvas_id = p_canvas_id;

  IF v_insights IS NULL THEN
    RAISE EXCEPTION 'strategy_core row of insights array niet gevonden voor canvas %', p_canvas_id;
  END IF;

  -- 2. Vind index van insight met matching id
  SELECT idx - 1 INTO v_idx  -- jsonb_array_elements is 1-based, jsonb_set 0-based
  FROM jsonb_array_elements(v_insights) WITH ORDINALITY AS arr(elem, idx)
  WHERE arr.elem ->> 'id' = p_insight_id;

  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'insight met id % niet gevonden in canvas %', p_insight_id, p_canvas_id;
  END IF;

  -- 3. Merge fields + last_edited audit
  v_updated := (v_insights -> v_idx)
    || p_fields
    || jsonb_build_object(
         'last_edited_at', to_jsonb(v_now),
         'last_edited_by', to_jsonb(p_actor_user_id)
       );

  -- 4. jsonb_set op specifieke index — atomair, geen race-condition
  UPDATE strategy_core
  SET insights = jsonb_set(insights, ARRAY[v_idx::text], v_updated, false),
      updated_at = v_now
  WHERE canvas_id = p_canvas_id;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION update_strategy_insight IS
  'RFC-008 §B — partial-update op één insight in strategy_core.insights[]. '
  'Atomair via jsonb_set; concurrency-veilig zonder version-column. '
  'SECURITY INVOKER: RLS van strategy_core blijft van toepassing.';
