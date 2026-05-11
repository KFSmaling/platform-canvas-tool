-- ============================================================
-- Stap 11.K — Dossier-driven AI-input schema (RFC-002 §5.1-§5.5).
--
-- 1.a is_draft-kolom op cd_pain_points  (cd_items.is_draft bestaat al sinds 11.D)
-- 1.b nieuwe tabel cd_input_suggestion_events (polymorphic target_table + target_id)
-- 1.c trigger validate_cd_ise_target — cross-canvas/cross-tenant blokkering
--     + uitzondering voor rejected-event op verwijderde target (audit-preservatie)
-- 1.d RLS append-only: SELECT + INSERT policies, geen UPDATE/DELETE
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS, DROP POLICY IF EXISTS.
-- ============================================================

-- 1.a Schema-uitbreiding cd_pain_points
ALTER TABLE cd_pain_points
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- 1.b Nieuwe tabel cd_input_suggestion_events (RFC-002 §5.2)
CREATE TABLE IF NOT EXISTS cd_input_suggestion_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table    text        NOT NULL CHECK (target_table IN ('cd_items', 'cd_pain_points')),
  target_id       uuid        NOT NULL,
  affordance      text        NOT NULL CHECK (affordance IN (
                    'items_from_dossier', 'fields_from_dossier', 'pain_points_from_dossier'
                  )),
  event_type      text        NOT NULL CHECK (event_type IN (
                    'ai_generated', 'edited', 'accepted', 'rejected'
                  )),
  actor_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      text,
  text_before_md  text,
  text_after_md   text,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  tenant_id       uuid        NOT NULL REFERENCES tenants(id)  ON DELETE RESTRICT,
  canvas_id       uuid        NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cd_ise_target_idx
  ON cd_input_suggestion_events (target_table, target_id, created_at);
CREATE INDEX IF NOT EXISTS cd_ise_canvas_idx
  ON cd_input_suggestion_events (canvas_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cd_ise_affordance_idx
  ON cd_input_suggestion_events (affordance, created_at);

-- 1.c Polymorphic-validatie-trigger
-- Pattern-anker: RFC-001 §3.4 (cd_pain_point_couplings) — zelfde dynamic-EXECUTE
-- + canvas/tenant-match-check. Uitzondering: rejected-event op verwijderde
-- target is toegestaan (audit-trail-preservatie, RFC-002 §5.4).
CREATE OR REPLACE FUNCTION validate_cd_ise_target()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_canvas uuid;
  target_tenant uuid;
  q text;
BEGIN
  IF NEW.target_table NOT IN ('cd_items', 'cd_pain_points') THEN
    RAISE EXCEPTION 'Onbekende target_table: %', NEW.target_table;
  END IF;

  q := format('SELECT canvas_id, tenant_id FROM %I WHERE id = $1', NEW.target_table);
  EXECUTE q INTO target_canvas, target_tenant USING NEW.target_id;

  IF target_canvas IS NULL THEN
    IF NEW.event_type = 'rejected' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'target_id % bestaat niet in % voor event_type %',
                    NEW.target_id, NEW.target_table, NEW.event_type;
  END IF;

  IF NEW.canvas_id IS DISTINCT FROM target_canvas THEN
    RAISE EXCEPTION 'cross-canvas-event niet toegestaan: ise.canvas_id=%, target.canvas_id=%',
                    NEW.canvas_id, target_canvas;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM target_tenant THEN
    RAISE EXCEPTION 'cross-tenant-event niet toegestaan';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cd_ise_validate ON cd_input_suggestion_events;
CREATE TRIGGER cd_ise_validate
  BEFORE INSERT ON cd_input_suggestion_events
  FOR EACH ROW EXECUTE FUNCTION validate_cd_ise_target();

-- 1.d RLS append-only — SELECT + INSERT; afwezigheid UPDATE/DELETE-policies
-- maakt de tabel feitelijk append-only voor authenticated users.
ALTER TABLE cd_input_suggestion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cd_ise SELECT" ON cd_input_suggestion_events;
CREATE POLICY "cd_ise SELECT" ON cd_input_suggestion_events FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid())
      OR current_user_role() = 'tenant_admin'
    )
  );

DROP POLICY IF EXISTS "cd_ise INSERT" ON cd_input_suggestion_events;
CREATE POLICY "cd_ise INSERT" ON cd_input_suggestion_events FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      canvas_id IN (SELECT id FROM canvases WHERE user_id = auth.uid())
      OR current_user_role() = 'tenant_admin'
    )
  );
-- GEEN UPDATE/DELETE-policies = append-only afgedwongen via RLS
