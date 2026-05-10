-- ============================================================
-- Stap 11.G.3 F9 — rebrand knop-teksten naar consultant-vriendelijke
-- terminologie + nieuwe collapse-sectie label-keys (F8).
--
-- Audit-laag intact: datamodel + event-types + trigger ongewijzigd. Alleen
-- UI-tekst verandert ("Accept" → "Markeer als richting", "Wuif weg" →
-- "Verwijder", etc.).
--
-- Idempotent. UPDATE-statements werken op bestaande keys; INSERT met
-- ON CONFLICT DO UPDATE voor nieuwe collapse-keys.
-- ============================================================

-- F9: rebrand bestaande actie-labels
UPDATE app_config SET value = 'Bewerk'              WHERE key = 'label.klanten.analyse.actie.refine.edit'   AND tenant_id IS NULL;
UPDATE app_config SET value = 'Verwijder'           WHERE key = 'label.klanten.analyse.actie.reject'        AND tenant_id IS NULL;
UPDATE app_config SET value = 'Markeer als richting' WHERE key = 'label.klanten.analyse.actie.accept'       AND tenant_id IS NULL;
-- klanten.analyse.actie.refine.deeper blijft "Verfijn — graaf dieper"
-- (echte AI-actie, geen rebrand mogelijk)

-- Update Accept-tooltip + intro-tekst om te aligneren met nieuwe terminologie
UPDATE app_config SET value = 'nog te promoten in fase 4 (verbeterrichtingen) — komt later'
  WHERE key = 'label.klanten.analyse.accept.tooltip.fase4' AND tenant_id IS NULL;
UPDATE app_config SET value = 'AI doet een eerste pas op je pijnpunten. Per suggestie kies je: markeer als richting, bewerk (eigen tekst), graaf dieper (AI verfijnt), of verwijder.'
  WHERE key = 'label.klanten.analyse.helper.intro' AND tenant_id IS NULL;

-- F8: nieuwe collapse-sectie label-keys
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.klanten.analyse.gemarkeerd.titel',  'label', 'Collapse-sectie titel voor gemarkeerde patronen',  'Gemarkeerd voor verbeterrichtingen', NULL, true),
  ('label.klanten.analyse.gemarkeerd.leeg',   'label', 'Empty-state in collapse — gemarkeerd',             'Nog niets gemarkeerd',                NULL, true),
  ('label.klanten.analyse.gemarkeerd.terug',  'label', 'Un-mark knop in collapse — terug naar open-lijst', 'Terug naar voorraad',                 NULL, true),
  ('label.klanten.analyse.verwijderd.titel',  'label', 'Collapse-sectie titel voor verwijderde patronen',  'Verwijderd',                          NULL, true),
  ('label.klanten.analyse.verwijderd.leeg',   'label', 'Empty-state in collapse — verwijderd',             'Niets verwijderd',                    NULL, true),
  ('label.klanten.analyse.verwijderd.herstel','label', 'Restore knop in collapse',                         'Herstellen',                          NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
