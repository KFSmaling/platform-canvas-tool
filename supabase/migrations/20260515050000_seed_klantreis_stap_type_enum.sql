-- ============================================================
-- Stap 11.I.2 — Tenant-overridable stap_type-enum + 9 stap_type-labels.
--
-- Nieuwe app_config-categorie `enum` voor tenant-overridable dropdown-opties.
-- KF-default = verzekerings-9-stage-lijst (Kees-input §8.2 mapping).
-- Andere consultancy-tenants kunnen via Admin-UI overschrijven met eigen lijst.
--
-- AppConfigContext exposes `enumValue(key)` die jsonb-array uit value parset.
-- Frontend ItemModal-dropdown (field.type="dropdown") populeert opties via
-- `appEnum(field.enumKey)`-call; labels per stap_type-waarde via
-- `appLabel("klanten.klantreis.stap_type." + option)`.
--
-- Idempotent.
-- ============================================================

-- 0. CHECK constraint uitbreiden om 'enum'-categorie toe te staan.
-- Was: (prompt | label | setting). Wordt: + 'enum'.
ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_category_check;
ALTER TABLE app_config ADD CONSTRAINT app_config_category_check
  CHECK (category = ANY (ARRAY['prompt'::text, 'label'::text, 'setting'::text, 'enum'::text]));

-- 1. Enum-categorie: jsonb-array van 9 verzekerings-stap-types (KF-default)
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('enum.klanten.klantreis.stap_type',
    'enum',
    'Beschikbare stap-types voor klantreis-archetype. KF-default = verzekerings-9-stage. Tenant-overridable voor andere sectoren via Admin-UI.',
    '["trigger_life_event","orientatie","quote_aanvraag","underwriting","closing_polis","onboarding","servicing_in_life","claim_schade","renewal_churn_advocacy"]',
    NULL,
    true)
ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- 2. Leesbare labels per stap_type-waarde (dropdown-opties)
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.klanten.klantreis.stap_type.trigger_life_event',     'label', 'Stap-type 1', '1. Life Event Trigger',          NULL, true),
  ('label.klanten.klantreis.stap_type.orientatie',             'label', 'Stap-type 2', '2. Awareness & Oriëntatie',      NULL, true),
  ('label.klanten.klantreis.stap_type.quote_aanvraag',         'label', 'Stap-type 3', '3. Quote & Aanvraag',            NULL, true),
  ('label.klanten.klantreis.stap_type.underwriting',           'label', 'Stap-type 4', '4. Underwriting & Acceptatie',   NULL, true),
  ('label.klanten.klantreis.stap_type.closing_polis',          'label', 'Stap-type 5', '5. Closing & Polis',             NULL, true),
  ('label.klanten.klantreis.stap_type.onboarding',             'label', 'Stap-type 6', '6. Onboarding',                  NULL, true),
  ('label.klanten.klantreis.stap_type.servicing_in_life',      'label', 'Stap-type 7', '7. Servicing & In-life',         NULL, true),
  ('label.klanten.klantreis.stap_type.claim_schade',           'label', 'Stap-type 8', '8. Claim / Schade',              NULL, true),
  ('label.klanten.klantreis.stap_type.renewal_churn_advocacy', 'label', 'Stap-type 9', '9. Renewal / Churn / Advocacy',  NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
