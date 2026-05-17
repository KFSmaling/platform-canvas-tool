-- RFC-008 §4 — labels voor InzichtenOverlay edit-mode + in_rapport-toggle + status-indicator
-- 11.S Block 1. tenant_overridable=false: dit zijn UI-labels die generiek zijn,
-- alleen door platform-team bewerkt.

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES
  ('label.analysis.inrapport.aan',              'label', 'InzichtenOverlay — in_rapport pill aan-state', 'in rapport: aan', NULL, false),
  ('label.analysis.inrapport.uit',              'label', 'InzichtenOverlay — in_rapport pill uit-state', 'in rapport: uit', NULL, false),
  ('label.analysis.status.opgenomen',           'label', 'InzichtenOverlay — status-indicator suffix na "{X}/{N}"', 'opgenomen in Rapportage', NULL, false),
  ('label.analysis.action.bewerk',              'label', 'InzichtenOverlay — pencil-icon aria-label / tooltip', 'Bewerk bevinding', NULL, false),
  ('label.analysis.action.save',                'label', 'InzichtenOverlay — edit-mode Save knop', 'Opslaan', NULL, false),
  ('label.analysis.action.saving',              'label', 'InzichtenOverlay — edit-mode Save knop tijdens save', 'Opslaan…', NULL, false),
  ('label.analysis.action.cancel',              'label', 'InzichtenOverlay — edit-mode Cancel knop / regen-warning cancel', 'Annuleer', NULL, false),
  ('label.analysis.label.bewerkt',              'label', 'InzichtenOverlay — "bewerkt"-label onder edited insight', 'bewerkt', NULL, false),
  ('label.analysis.regen.title',                'label', 'InzichtenOverlay — regenerate-warning dialog titel', 'Bevindingen handmatig bewerkt', NULL, false),
  ('label.analysis.regen.body',                 'label', 'InzichtenOverlay — regenerate-warning dialog body', 'Je hebt bevindingen handmatig bewerkt. Bij her-genereren gaan deze edits verloren. Doorgaan?', NULL, false),
  ('label.analysis.regen.confirm',              'label', 'InzichtenOverlay — regenerate-warning dialog Doorgaan', 'Doorgaan', NULL, false),
  ('label.werkblad.strategie.inzichten.header', 'label', 'StrategieWerkblad — header-label voor Inzichten-overlay', 'Inzichten — Strategie', NULL, false)
ON CONFLICT (tenant_id, key) DO NOTHING;
