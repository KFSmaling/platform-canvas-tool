-- ============================================================
-- Bundle 4 F26 — KlantreisChevronOverview short-name + pill labels.
--
-- 9 `.short`-rijen voor compacte chevron-naam onder de pijl-shape
-- (volle naam past niet onder 60-88px chevron-breedte).
-- 2 pill-label-rijen voor card-asymmetrie-cues (fase 2+ MoT/Silent).
--
-- Volle stap-namen blijven in bestaande `label.klanten.klantreis.stap_type.*`
-- (geseed in 11.I.2 migratie 20260515000000).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value.
-- tenant_id=NULL + tenant_overridable=true (consultancy-tenants kunnen
-- branche-specifieke korte namen overschrijven, bv. proces-stage-namen).
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  -- ── 9 short-namen onder chevron ──────────────────────────────────────────
  ('label.klanten.klantreis.stap_type.trigger_life_event.short',
   'label', 'Korte chevron-naam — Life Event Trigger', 'Life Event', NULL, true),
  ('label.klanten.klantreis.stap_type.orientatie.short',
   'label', 'Korte chevron-naam — Awareness & Oriëntatie', 'Awareness', NULL, true),
  ('label.klanten.klantreis.stap_type.quote_aanvraag.short',
   'label', 'Korte chevron-naam — Quote & Aanvraag', 'Quote', NULL, true),
  ('label.klanten.klantreis.stap_type.underwriting.short',
   'label', 'Korte chevron-naam — Underwriting & Acceptatie', 'Underwriting', NULL, true),
  ('label.klanten.klantreis.stap_type.closing_polis.short',
   'label', 'Korte chevron-naam — Closing & Polis', 'Closing', NULL, true),
  ('label.klanten.klantreis.stap_type.onboarding.short',
   'label', 'Korte chevron-naam — Onboarding', 'Onboarding', NULL, true),
  ('label.klanten.klantreis.stap_type.servicing_in_life.short',
   'label', 'Korte chevron-naam — Servicing & In-life', 'Servicing', NULL, true),
  ('label.klanten.klantreis.stap_type.claim_schade.short',
   'label', 'Korte chevron-naam — Claim / Schade', 'Claim', NULL, true),
  ('label.klanten.klantreis.stap_type.renewal_churn_advocacy.short',
   'label', 'Korte chevron-naam — Renewal / Churn / Advocacy', 'Renewal', NULL, true),

  -- ── 2 pill-labels voor card-asymmetrie-cues ──────────────────────────────
  ('label.klanten.klantreis.card.pill.mot',
   'label', 'Card-pill: Moment of Truth (MoT)', 'bepalend moment', NULL, true),
  ('label.klanten.klantreis.card.pill.silent',
   'label', 'Card-pill: Silent Period', 'silent period', NULL, true)

ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
