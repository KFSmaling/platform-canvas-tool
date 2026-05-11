-- ============================================================
-- Stap 11.I.1 — Label-seed voor 5 lichte archetypes
-- (regio + behoefte + merk + gedragspatroon + anders).
--
-- 18 nieuwe label-keys: 3 + 4 + 4 + 4 + 2 (anders veld-label + helper-tekst).
-- Klantreis blijft minimal-stub (komt 11.I.2).
--
-- Server-side ARCHETYPE_FIELDS in api/klanten/_archetypes.js was al
-- compleet — alleen UI-zichtbaarheid via labels was minimal-stub.
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE.
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  -- regio (3)
  ('label.klanten.veld.regio.geografie',         'label', 'Veld-label regio archetype', 'Geografie',          NULL, true),
  ('label.klanten.veld.regio.marktgrootte',      'label', 'Veld-label regio archetype', 'Marktgrootte',       NULL, true),
  ('label.klanten.veld.regio.lokale_kenmerken',  'label', 'Veld-label regio archetype', 'Lokale kenmerken',   NULL, true),

  -- behoefte (4) — JTBD-frame conform ADR-003 §C
  ('label.klanten.veld.behoefte.job_to_be_done',        'label', 'Veld-label behoefte archetype', 'Job to be done',        NULL, true),
  ('label.klanten.veld.behoefte.context',               'label', 'Veld-label behoefte archetype', 'Context',               NULL, true),
  ('label.klanten.veld.behoefte.bestaande_oplossingen', 'label', 'Veld-label behoefte archetype', 'Bestaande oplossingen', NULL, true),
  ('label.klanten.veld.behoefte.frustraties',           'label', 'Veld-label behoefte archetype', 'Frustraties',           NULL, true),

  -- merk (4)
  ('label.klanten.veld.merk.positionering',             'label', 'Veld-label merk archetype', 'Positionering',             NULL, true),
  ('label.klanten.veld.merk.belofte',                   'label', 'Veld-label merk archetype', 'Belofte',                   NULL, true),
  ('label.klanten.veld.merk.doelgroep',                 'label', 'Veld-label merk archetype', 'Doelgroep',                 NULL, true),
  ('label.klanten.veld.merk.relatie_tot_andere_merken', 'label', 'Veld-label merk archetype', 'Relatie tot andere merken', NULL, true),

  -- gedragspatroon (4)
  ('label.klanten.veld.gedragspatroon.intensiteit',            'label', 'Veld-label gedragspatroon archetype', 'Intensiteit',            NULL, true),
  ('label.klanten.veld.gedragspatroon.loyaliteit',             'label', 'Veld-label gedragspatroon archetype', 'Loyaliteit',             NULL, true),
  ('label.klanten.veld.gedragspatroon.koopgedrag',             'label', 'Veld-label gedragspatroon archetype', 'Koopgedrag',             NULL, true),
  ('label.klanten.veld.gedragspatroon.digitale_volwassenheid', 'label', 'Veld-label gedragspatroon archetype', 'Digitale volwassenheid', NULL, true),

  -- anders (2) — veld-label (custom_pairs UX) + helper-tekst onder titel
  ('label.klanten.veld.anders.vrije_velden', 'label', 'Veld-label anders archetype (max 4 keys)', 'Eigen velden (max 4)', NULL, true),
  ('label.klanten.veld.anders.helper',       'label', 'Helper-tekst voor anders-archetype',       'Definieer maximaal 4 eigen sleutels en waarden voor deze dimensie.', NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
