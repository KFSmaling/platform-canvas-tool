-- ============================================================
-- Stap 11.I.2 — Klantreis Scope A label-seed.
--
-- 16 nieuwe labels voor 12-veld-klantreis-archetype + 80/20-denkdwang-blok
-- (MoT/Silent/weight als asymmetrie-erkenning per design-principle-doc).
--
-- Klantreis-velden volgen RFC-001 §2.2.1 + Kees-input §8.4 (strategie-
-- adviseur-input van 11 mei 2026). RFC-001 preliminary-velden
-- (klant_actie/aanbieder_actie/friction_indicators) zijn vervangen door
-- de rijkere 12-veld-lijst.
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE.
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  -- Wat — kern-identiteit
  ('label.klanten.veld.klantreis.stap_type',           'label', 'Klantreis dropdown stap-type',           'Stap-type',                NULL, true),
  ('label.klanten.veld.klantreis.customer_goal',       'label', 'Klantreis textarea klantdoel',           'Doel van de klant',        NULL, true),
  -- Hoe — touchpoints + DMU + emoties + KPIs
  ('label.klanten.veld.klantreis.touchpoints',         'label', 'Klantreis tag_list touchpoints',          'Touchpoints',              NULL, true),
  ('label.klanten.veld.klantreis.dmu',                 'label', 'Klantreis tag_list DMU',                 'DMU (rol-tags)',           NULL, true),
  ('label.klanten.veld.klantreis.dmu.helper',          'label', 'DMU-helper-uitleg',                      'Wie heeft invloed op de beslissing? Comma-separated rollen (bv. klant, adviseur, verzekeraar).', NULL, true),
  ('label.klanten.veld.klantreis.emotions',            'label', 'Klantreis tag_list klant-emoties',       'Klant-emoties',            NULL, true),
  ('label.klanten.veld.klantreis.kpis',                'label', 'Klantreis tag_list KPIs',                'KPI''s',                   NULL, true),
  -- Strategisch — 80/20-denkdwang asymmetrie
  ('label.klanten.veld.klantreis.strategische_weging_titel',  'label', 'Visueel-blok titel (denkdwang)',  'Strategische weging',      NULL, true),
  ('label.klanten.veld.klantreis.strategische_weging.helper', 'label', 'Visueel-blok subtekst',           '80/20-denkdwang — asymmetrie-erkenning', NULL, true),
  ('label.klanten.veld.klantreis.is_moment_of_truth',  'label', 'MoT-toggle (denkdwang asymmetrie)',      'Moment of Truth?',         NULL, true),
  ('label.klanten.veld.klantreis.is_silent_period',    'label', 'Silent Period-toggle (denkdwang)',       'Silent period?',           NULL, true),
  ('label.klanten.veld.klantreis.weight_multiplier',   'label', 'Weight numeric (1.0=normaal, 3.0=claim)','Weging (1.0-3.0)',         NULL, true),
  ('label.klanten.veld.klantreis.weight_multiplier.helper', 'label', 'Weight-helper', 'Normaal = 1.0. Moment of Truth = 2.0. Critical (bv. claim) = 3.0. Hoger = zwaarder meegewogen in analyse.', NULL, true),
  ('label.klanten.veld.klantreis.silent_period_risk',  'label', 'Risico bij silent period (conditional)', 'Risico in silent period',  NULL, true),
  ('label.klanten.veld.klantreis.regulatoire_context', 'label', 'Wft/IDD/zorgplicht-context',             'Regulatoire context',      NULL, true),
  ('label.klanten.veld.klantreis.insight',             'label', 'Strategisch inzicht per stage',          'Strategisch inzicht',      NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
