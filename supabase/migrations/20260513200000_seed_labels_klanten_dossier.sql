-- ============================================================
-- Stap 11.K — Dossier-driven AI-input: label-seed + F13 key-rename.
--
-- A. F13 key-rename — 11.H plaatste `klanten.actie.markeer` met fallback
--    "Markeer als verstuurd" (intent→Roadmap-context). 11.K introduceert
--    "Markeer als richting" voor draft→canonical-acceptance. Werkblad-
--    onderdeel-prefix lost beide-context-collision op (Optie 3 uit
--    RFC-002 §10 open vraag #11).
--    Rename:
--      klanten.actie.markeer       → klanten.verbeterrichting.actie.markeer
--      klanten.actie.terugtrekken  → klanten.verbeterrichting.actie.terugtrekken
--
-- B. Nieuwe dossier-context-keys (klanten.dossier.actie.*)
--
-- C. Generieke keys behouden (klanten.actie.bewerk / .verwijder / .promote
--    blijven ongewijzigd — context-onafhankelijk).
--
-- D. Affordance-knop-teksten + draft-state-UX-keys.
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE.
-- ============================================================

-- A. F13 rename (alleen globale rijen — tenant-overrides die niet bestaan
-- worden niet aangeraakt; mocht een tenant in de toekomst een override
-- hebben gehad, dan komt die via apart pad).
UPDATE app_config
  SET key = 'label.klanten.verbeterrichting.actie.markeer',
      description = 'Verbeterrichting-context: status concept→verstuurd'
  WHERE key = 'label.klanten.actie.markeer' AND tenant_id IS NULL;

UPDATE app_config
  SET key = 'label.klanten.verbeterrichting.actie.terugtrekken',
      description = 'Verbeterrichting-context: status verstuurd→concept'
  WHERE key = 'label.klanten.actie.terugtrekken' AND tenant_id IS NULL;

-- B + C + D. Nieuwe + bestaande keys
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
-- D. Affordance-knop-teksten (3)
('label.klanten.dossier.items_extract',       'label', 'AI-knop dimensie-niveau (A1)',         'Items vanuit dossier',                NULL, true),
('label.klanten.dossier.fields_fill',         'label', 'AI-knop item-modal (A2)',              'Velden invullen vanuit dossier',      NULL, true),
('label.klanten.dossier.pain_points_extract', 'label', 'AI-knop fase-2 header (A3)',           'Pijnpunten extraheren vanuit dossier',NULL, true),

-- D. Draft-state-UX (4)
('label.klanten.dossier.draft_badge',         'label', 'Visuele markering draft-rij',          'dossier-suggestie',                   NULL, true),
('label.klanten.dossier.disabled_no_uploads', 'label', 'Tooltip bij geen uploads',             'Upload eerst documenten',             NULL, true),
('label.klanten.dossier.disabled_no_items',   'label', 'Tooltip A3 zonder items',              'Voeg eerst items toe',                NULL, true),
('label.klanten.dossier.disabled_processing', 'label', 'Tooltip uploads processing',           'Documenten worden nog verwerkt',      NULL, true),

-- B. Dossier-specifieke actie-keys (3)
('label.klanten.dossier.actie.markeer',       'label', 'Dossier-suggestie accepteren (draft→canonical)', 'Markeer als richting',          NULL, true),
('label.klanten.dossier.actie.bewerk',        'label', 'Dossier-suggestie bewerken',           'Bewerk',                              NULL, true),
('label.klanten.dossier.actie.verwijder',     'label', 'Dossier-suggestie verwijderen',        'Verwijder',                           NULL, true)

ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
