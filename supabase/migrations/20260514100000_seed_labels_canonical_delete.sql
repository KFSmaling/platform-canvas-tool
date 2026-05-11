-- ============================================================
-- Stap 11.K.2 F16 — Canonical delete-knoppen voor items + pijnpunten.
--
-- 6 nieuwe label-keys: 2 voor de Verwijder-knop in modal-footers + 4 voor
-- de inline-bevestigingsdialog (titel + tekst + ja/nee-knoppen).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE.
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.klanten.knop.item.verwijderen',         'label', 'Verwijder-knop in item-modal (canonical-delete)',         'Verwijderen',                            NULL, true),
  ('label.klanten.knop.pijnpunt.verwijderen',     'label', 'Verwijder-knop in pijnpunt-modal (canonical-delete)',     'Verwijderen',                            NULL, true),
  ('label.klanten.modal.delete.confirm.titel',    'label', 'Inline-bevestigingsdialog titel',                         'Permanent verwijderen?',                 NULL, true),
  ('label.klanten.modal.delete.confirm.tekst',    'label', 'Inline-bevestigingsdialog tekst',                         'Dit kan niet ongedaan gemaakt worden.',  NULL, true),
  ('label.klanten.modal.delete.confirm.ja',       'label', 'Inline-bevestigingsdialog Ja-knop',                       'Verwijder definitief',                   NULL, true),
  ('label.klanten.modal.delete.confirm.nee',      'label', 'Inline-bevestigingsdialog Annuleren-knop',                'Annuleer',                               NULL, true)
ON CONFLICT (tenant_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
