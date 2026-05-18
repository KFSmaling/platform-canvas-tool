-- ============================================================
-- 11.U Klanten-rev2 Block 1 — RFC-007-rev2 datamodel-rework
-- Idempotent migratie: alle stappen safe-to-rerun
--
-- v3 production-applied: pattern_type='eigen' → source_type='eigen' special-case
-- + 2-pass parent_intent_id-INSERT om FK-volgorde-issue te vermijden
-- + ps.sort_order vervangen door hardcoded 0 (bron heeft geen sort_order kolom)
-- ============================================================

-- Stap 1: cd_improvement_intents schema-uitbreiding
ALTER TABLE cd_improvement_intents DROP CONSTRAINT IF EXISTS cd_improvement_intents_status_check;
ALTER TABLE cd_improvement_intents
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS parent_intent_id uuid REFERENCES cd_improvement_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_user_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_ai_text_md text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz;

-- Stap 2: status verstuurd → definitief (RFC-007-rev2 §A label-rename)
UPDATE cd_improvement_intents SET status = 'definitief' WHERE status = 'verstuurd';

-- Stap 3: Backfill source_type — pattern_type='eigen' → 'eigen' (geen ai_-prefix)
UPDATE cd_improvement_intents intent
SET source_type = COALESCE(
  (SELECT CASE WHEN ps.pattern_type = 'eigen' THEN 'eigen' ELSE 'ai_' || ps.pattern_type END
   FROM cd_pattern_suggestions ps WHERE ps.id = intent.source_suggestion_id),
  'eigen'
)
WHERE source_type IS NULL;

-- Stap 4a: Migreer cd_pattern_suggestions → cd_improvement_intents (parent_intent_id=NULL eerst)
INSERT INTO cd_improvement_intents (
  id, canvas_id, tenant_id, title, intent_md, status,
  source_type, parent_intent_id, is_user_edited, original_ai_text_md, ai_generated_at,
  vanuit, sort_order, created_at, updated_at
)
SELECT
  ps.id, ps.canvas_id, ps.tenant_id,
  COALESCE(LEFT(ps.text_md, 100), 'Concept-actie'),
  ps.text_md,
  CASE ps.current_status
    WHEN 'rejected' THEN 'dismissed'
    WHEN 'refined'  THEN 'concept'
    WHEN 'accepted' THEN 'concept'
    WHEN 'open'     THEN 'concept'
    ELSE 'concept'
  END,
  CASE WHEN ps.pattern_type = 'eigen' THEN 'eigen' ELSE 'ai_' || ps.pattern_type END,
  NULL::uuid,  -- parent_intent_id ingevuld in stap 4b
  ps.is_user_edited, ps.original_ai_text_md, ps.created_at,
  ps.vanuit, 0, ps.created_at, ps.updated_at
FROM cd_pattern_suggestions ps
WHERE ps.current_status != 'promoted'
  AND NOT EXISTS (SELECT 1 FROM cd_improvement_intents WHERE id = ps.id)
ON CONFLICT (id) DO NOTHING;

-- Stap 4b: UPDATE parent_intent_id alleen waar parent ook in cd_improvement_intents zit
UPDATE cd_improvement_intents intent
SET parent_intent_id = ps.parent_id
FROM cd_pattern_suggestions ps
WHERE intent.id = ps.id
  AND ps.parent_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM cd_improvement_intents WHERE id = ps.parent_id);

-- Stap 5: source_type CHECK + NOT NULL
ALTER TABLE cd_improvement_intents ALTER COLUMN source_type SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cd_improvement_intents_source_type_check') THEN
    ALTER TABLE cd_improvement_intents
      ADD CONSTRAINT cd_improvement_intents_source_type_check
      CHECK (source_type IN ('eigen', 'ai_algemeen', 'ai_cluster', 'ai_paradox', 'ai_positionering', 'ai_overstijgend'));
  END IF;
END $$;

-- Stap 6: nieuwe status CHECK met 'dismissed'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cd_improvement_intents_status_check') THEN
    ALTER TABLE cd_improvement_intents
      ADD CONSTRAINT cd_improvement_intents_status_check
      CHECK (status IN ('concept', 'definitief', 'dismissed'));
  END IF;
END $$;

-- Stap 7: indexes (drop oude + nieuwe parent-unique)
DROP INDEX IF EXISTS cd_intents_source_unique;
CREATE UNIQUE INDEX IF NOT EXISTS cd_intents_parent_unique
  ON cd_improvement_intents (parent_intent_id) WHERE parent_intent_id IS NOT NULL;

-- Stap 8: cd_pain_points uitbreiding
ALTER TABLE cd_pain_points
  ADD COLUMN IF NOT EXISTS dismissal_motivation text,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS coverage_status text NOT NULL DEFAULT 'open';
ALTER TABLE cd_pain_points DROP CONSTRAINT IF EXISTS cd_pain_points_coverage_status_check;
ALTER TABLE cd_pain_points ADD CONSTRAINT cd_pain_points_coverage_status_check
  CHECK (coverage_status IN ('open', 'addressed', 'dismissed'));
ALTER TABLE cd_pain_points DROP CONSTRAINT IF EXISTS cd_pain_points_dismissal_motivation_check;
ALTER TABLE cd_pain_points ADD CONSTRAINT cd_pain_points_dismissal_motivation_check
  CHECK (dismissed_at IS NULL OR (dismissal_motivation IS NOT NULL AND length(dismissal_motivation) >= 20));
CREATE INDEX IF NOT EXISTS cd_pain_points_coverage_idx ON cd_pain_points (canvas_id, coverage_status);

-- Stap 9: cd_intent_pain_point_links + cross-canvas/tenant validate-trigger
CREATE TABLE IF NOT EXISTS cd_intent_pain_point_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id       uuid NOT NULL REFERENCES cd_improvement_intents(id) ON DELETE CASCADE,
  pain_point_id   uuid NOT NULL REFERENCES cd_pain_points(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  canvas_id       uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intent_id, pain_point_id)
);
CREATE INDEX IF NOT EXISTS cd_ippl_intent_idx ON cd_intent_pain_point_links (intent_id);
CREATE INDEX IF NOT EXISTS cd_ippl_pain_idx   ON cd_intent_pain_point_links (pain_point_id);

CREATE OR REPLACE FUNCTION validate_cd_intent_pain_link()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE intent_canvas uuid; intent_tenant uuid; pain_canvas uuid; pain_tenant uuid;
BEGIN
  SELECT canvas_id, tenant_id INTO intent_canvas, intent_tenant FROM cd_improvement_intents WHERE id = NEW.intent_id;
  SELECT canvas_id, tenant_id INTO pain_canvas, pain_tenant   FROM cd_pain_points WHERE id = NEW.pain_point_id;
  IF NEW.canvas_id IS DISTINCT FROM intent_canvas OR NEW.canvas_id IS DISTINCT FROM pain_canvas THEN
    RAISE EXCEPTION 'cross-canvas-koppeling niet toegestaan';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM intent_tenant OR NEW.tenant_id IS DISTINCT FROM pain_tenant THEN
    RAISE EXCEPTION 'cross-tenant-koppeling niet toegestaan';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS cd_ippl_validate ON cd_intent_pain_point_links;
CREATE TRIGGER cd_ippl_validate BEFORE INSERT OR UPDATE ON cd_intent_pain_point_links
  FOR EACH ROW EXECUTE FUNCTION validate_cd_intent_pain_link();

-- Stap 11: coverage-sync triggers (3 functies)
CREATE OR REPLACE FUNCTION cd_pp_recompute_coverage_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_pain_id uuid; has_active_intent boolean; current_coverage text;
BEGIN
  affected_pain_id := COALESCE(NEW.pain_point_id, OLD.pain_point_id);
  SELECT coverage_status INTO current_coverage FROM cd_pain_points WHERE id = affected_pain_id;
  IF current_coverage = 'dismissed' THEN RETURN NULL; END IF;
  SELECT EXISTS (
    SELECT 1 FROM cd_intent_pain_point_links link
    JOIN cd_improvement_intents intent ON intent.id = link.intent_id
    WHERE link.pain_point_id = affected_pain_id AND intent.status IN ('concept', 'definitief')
  ) INTO has_active_intent;
  UPDATE cd_pain_points
  SET coverage_status = CASE WHEN has_active_intent THEN 'addressed' ELSE 'open' END
  WHERE id = affected_pain_id;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS cd_ippl_recompute_coverage ON cd_intent_pain_point_links;
CREATE TRIGGER cd_ippl_recompute_coverage AFTER INSERT OR UPDATE OR DELETE ON cd_intent_pain_point_links
  FOR EACH ROW EXECUTE FUNCTION cd_pp_recompute_coverage_status();

CREATE OR REPLACE FUNCTION cd_intent_status_change_coverage_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE cd_pain_points pp
    SET coverage_status = CASE
      WHEN pp.coverage_status = 'dismissed' THEN 'dismissed'
      WHEN EXISTS (
        SELECT 1 FROM cd_intent_pain_point_links link
        JOIN cd_improvement_intents intent ON intent.id = link.intent_id
        WHERE link.pain_point_id = pp.id AND intent.status IN ('concept', 'definitief')
      ) THEN 'addressed'
      ELSE 'open'
    END
    WHERE pp.id IN (SELECT pain_point_id FROM cd_intent_pain_point_links WHERE intent_id = NEW.id);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS cd_intent_status_change_coverage ON cd_improvement_intents;
CREATE TRIGGER cd_intent_status_change_coverage AFTER UPDATE OF status ON cd_improvement_intents
  FOR EACH ROW EXECUTE FUNCTION cd_intent_status_change_coverage_sync();

CREATE OR REPLACE FUNCTION cd_pp_dismissed_sync_coverage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dismissed_at IS DISTINCT FROM OLD.dismissed_at THEN
    NEW.coverage_status := CASE
      WHEN NEW.dismissed_at IS NOT NULL THEN 'dismissed'
      WHEN EXISTS (
        SELECT 1 FROM cd_intent_pain_point_links link
        JOIN cd_improvement_intents intent ON intent.id = link.intent_id
        WHERE link.pain_point_id = NEW.id AND intent.status IN ('concept', 'definitief')
      ) THEN 'addressed'
      ELSE 'open'
    END;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS cd_pp_sync_coverage_on_dismiss ON cd_pain_points;
CREATE TRIGGER cd_pp_sync_coverage_on_dismiss BEFORE UPDATE OF dismissed_at ON cd_pain_points
  FOR EACH ROW EXECUTE FUNCTION cd_pp_dismissed_sync_coverage();

-- Stap 12: cd_improvement_intent_events + sync-trigger (event-driven status-update)
CREATE TABLE IF NOT EXISTS cd_improvement_intent_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id       uuid NOT NULL REFERENCES cd_improvement_intents(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN ('created', 'edited', 'made_definitief', 'back_to_concept', 'dismissed', 'restored')),
  actor_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      text,
  text_before_md  text,
  text_after_md   text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  canvas_id       uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cd_iie_intent_idx ON cd_improvement_intent_events (intent_id, created_at);
CREATE INDEX IF NOT EXISTS cd_iie_canvas_idx ON cd_improvement_intent_events (canvas_id, created_at DESC);

CREATE OR REPLACE FUNCTION cd_intent_sync_current_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE new_status text;
BEGIN
  new_status := CASE NEW.event_type
    WHEN 'made_definitief' THEN 'definitief'
    WHEN 'back_to_concept' THEN 'concept'
    WHEN 'dismissed'       THEN 'dismissed'
    WHEN 'restored'        THEN 'concept'
    ELSE NULL
  END;
  IF new_status IS NOT NULL THEN
    UPDATE cd_improvement_intents SET status = new_status WHERE id = NEW.intent_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS cd_iie_sync_status ON cd_improvement_intent_events;
CREATE TRIGGER cd_iie_sync_status AFTER INSERT ON cd_improvement_intent_events
  FOR EACH ROW EXECUTE FUNCTION cd_intent_sync_current_status();

-- Stap 13: cd_pain_point_events
CREATE TABLE IF NOT EXISTS cd_pain_point_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pain_point_id   uuid NOT NULL REFERENCES cd_pain_points(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN ('dismissed', 'restored')),
  motivation      text,
  actor_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  canvas_id       uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cd_ppe_pain_idx ON cd_pain_point_events (pain_point_id, created_at);

-- Stap 14: RLS policies (append-only events + tenant+eigenaar links)
ALTER TABLE cd_intent_pain_point_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_ippl tenant + eigenaar" ON cd_intent_pain_point_links;
CREATE POLICY "cd_ippl tenant + eigenaar" ON cd_intent_pain_point_links FOR ALL
  USING (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'))
  WITH CHECK (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'));

ALTER TABLE cd_improvement_intent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_iie SELECT" ON cd_improvement_intent_events;
CREATE POLICY "cd_iie SELECT" ON cd_improvement_intent_events FOR SELECT
  USING (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'));
DROP POLICY IF EXISTS "cd_iie INSERT" ON cd_improvement_intent_events;
CREATE POLICY "cd_iie INSERT" ON cd_improvement_intent_events FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'));

ALTER TABLE cd_pain_point_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_ppe SELECT" ON cd_pain_point_events;
CREATE POLICY "cd_ppe SELECT" ON cd_pain_point_events FOR SELECT
  USING (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'));
DROP POLICY IF EXISTS "cd_ppe INSERT" ON cd_pain_point_events;
CREATE POLICY "cd_ppe INSERT" ON cd_pain_point_events FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() AND (canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid()) OR current_user_role() = 'tenant_admin'));

-- Stap 15: initial coverage backfill (alle 'open' want geen links bestaan na migratie)
UPDATE cd_pain_points pp
SET coverage_status = CASE
  WHEN EXISTS (
    SELECT 1 FROM cd_intent_pain_point_links link
    JOIN cd_improvement_intents intent ON intent.id = link.intent_id
    WHERE link.pain_point_id = pp.id AND intent.status IN ('concept', 'definitief')
  ) THEN 'addressed'
  ELSE 'open'
END
WHERE pp.dismissed_at IS NULL;

-- ============================================================
-- POST-MIGRATION:
-- - cd_pattern_suggestions + cd_pattern_suggestion_events blijven bestaan
--   als legacy-data. DROP pas na 11.U Kees-test-PASS.
-- - 11.U Block 1 spot-check post-apply:
--     intents=40 (29 concept + 8 definitief + 3 dismissed)
--     source_type: 4 eigen + 13 ai_cluster + 8 ai_paradox + 9 ai_positionering + 6 ai_overstijgend
--     pain_points coverage_status: 43 open (geen links nog)
-- ============================================================
