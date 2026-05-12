-- ============================================================
-- Bundle 5 F32 — Rapport-onepager eindresultaat label-bundle.
--
-- 5 nieuwe section/counter/toelichting-keys + 4 UPDATEs op bestaande
-- toggle-keys (semantiek-shift "Advies in print" → "Toon proces-info").
--
-- Toggle-naam-keuze: "Toon proces-info" (Kees-keuze uit instructie tabel).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value.
-- tenant_id=NULL + tenant_overridable=true.
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.klanten.rapport.section.naar_roadmap',
   'label', 'Sectie-titel voor verstuurd-intents in rapport (eindresultaat)', 'Verbeteracties → Roadmap', NULL, true),
  ('label.klanten.rapport.naar_roadmap.leeg',
   'label', 'Empty-state als geen intent naar Roadmap is doorgezet', 'Nog geen verbeteracties naar Roadmap doorgezet.', NULL, true),
  ('label.klanten.rapport.counter.naar_roadmap',
   'label', 'Counter-meervoud in samenvatting-tekst (enkelvoud via code-fallback)', 'verbeteracties naar Roadmap', NULL, true),
  ('label.klanten.rapport.section.concept_intents',
   'label', 'Sectie-titel voor concept-intents (achter Toon proces-info-toggle)', 'Concept-verbeteracties', NULL, true),
  ('label.klanten.rapport.concept_intents.toelichting',
   'label', 'Italic toelichting onder concept-intents-sectie-header', 'Verbeteracties in concept-status — nog niet doorgezet naar Roadmap.', NULL, true),

  -- UPDATEs op bestaande toggle-keys via INSERT-ON-CONFLICT
  ('label.klanten.rapport.toggle.label.uit',
   'label', 'Toggle-button-tekst wanneer proces-info uit staat', 'Toon proces-info', NULL, true),
  ('label.klanten.rapport.toggle.label.aan',
   'label', 'Toggle-button-tekst wanneer proces-info aan staat', 'Proces-info zichtbaar ✓', NULL, true),
  ('label.klanten.rapport.toggle.uit',
   'label', 'Tooltip op toggle-knop in aan-staat',  'Klik om proces-info te verbergen — toon alleen eindresultaat', NULL, true),
  ('label.klanten.rapport.toggle.aan',
   'label', 'Tooltip op toggle-knop in uit-staat',  'Klik om AI-patronen + concept-verbeteracties zichtbaar te maken', NULL, true)

ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
