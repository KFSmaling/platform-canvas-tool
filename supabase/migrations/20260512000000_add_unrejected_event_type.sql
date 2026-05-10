-- ============================================================
-- Stap 11.G.3 F8 — voeg `unrejected` event-type toe aan
-- cd_pattern_suggestion_events.
--
-- Doel: restore-actie ("Herstellen" in collapse-sectie Verwijderd) moet
-- audit-trail-event krijgen analoog aan unpromoted, en current_status van
-- de suggestion moet via dezelfde trigger terug naar 'open' worden gezet.
--
-- Geen wijziging aan andere kolommen, RLS-policies, of data. Idempotent
-- (DROP CONSTRAINT IF EXISTS + CREATE OR REPLACE FUNCTION).
-- ============================================================

ALTER TABLE cd_pattern_suggestion_events
  DROP CONSTRAINT IF EXISTS cd_pattern_suggestion_events_event_type_check;

ALTER TABLE cd_pattern_suggestion_events
  ADD CONSTRAINT cd_pattern_suggestion_events_event_type_check
    CHECK (event_type = ANY (ARRAY[
      'ai_generated',
      'edited',
      'accepted',
      'rejected',
      'refined_dig_deeper',
      'promoted_to_intent',
      'unpromoted',
      'unrejected'
    ]));

-- Update trigger-mapping: unrejected → 'open' (zelfde behandeling als unpromoted)
CREATE OR REPLACE FUNCTION cd_ps_sync_current_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_status text;
BEGIN
  new_status := CASE NEW.event_type
    WHEN 'accepted'           THEN 'accepted'
    WHEN 'rejected'           THEN 'rejected'
    WHEN 'refined_dig_deeper' THEN 'refined'
    WHEN 'promoted_to_intent' THEN 'promoted'
    WHEN 'unpromoted'         THEN 'open'
    WHEN 'unrejected'         THEN 'open'
    ELSE NULL
  END;
  IF new_status IS NOT NULL THEN
    UPDATE cd_pattern_suggestions
       SET current_status = new_status
     WHERE id = NEW.suggestion_id;
  END IF;
  RETURN NULL;
END;
$$;
