-- ============================================================
-- Stap 11.G Vervolg-sessie B — Labels-seed RapportView AI-sectie + toggle.
--
-- 7 nieuwe label-keys + 1 update op bestaande `klanten.rapport.patronen.leeg`
-- (uitgebreid met "accepteer suggesties in fase 3"-helper).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO NOTHING voor inserts;
-- expliciete UPDATE op `patronen.leeg` zodat de oude tekst wordt overschreven
-- (was vóór 11.G frontend "Nog geen geaccepteerde patronen.").
-- ============================================================

INSERT INTO app_config (key, category, description, value) VALUES
  -- AI-print-toggle in rapport-toolbar
  ('label.klanten.rapport.toggle.disabled',     'label', 'Tooltip toggle bij 0 accepted patterns',        'Geen geaccepteerde patronen — accepteer er minstens één'),
  ('label.klanten.rapport.toggle.uit',          'label', 'Tooltip toggle wanneer AI-advies aan staat',    'Klik om AI-advies uit print te verwijderen'),
  ('label.klanten.rapport.toggle.aan',          'label', 'Tooltip toggle wanneer AI-advies uit staat',    'Klik om AI-advies toe te voegen aan print'),
  ('label.klanten.rapport.toggle.label.aan',    'label', 'Knop-label wanneer toggle aan',                 'Advies in print ✓'),
  ('label.klanten.rapport.toggle.label.uit',    'label', 'Knop-label wanneer toggle uit',                 'Advies in print'),

  -- Patronen-sectie helpers
  ('label.klanten.rapport.patronen.uit',        'label', 'Helper-tekst wanneer AI-advies uit staat in print', 'AI-advies staat uit voor deze print — klik ''Advies in print'' bovenin om te tonen.'),
  ('label.klanten.rapport.patronen.meer',       'label', 'Footer wanneer >6 accepted patterns getoond worden', '+ N meer geaccepteerd, niet getoond in deze print-samenvatting.')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Update bestaande key zodat de tekst aligned is met de fallback-string in
-- AppConfigContext.jsx (uitgebreid met 'accepteer suggesties in fase 3').
UPDATE app_config
   SET value = 'Nog geen geaccepteerde patronen — accepteer suggesties in fase 3 (Analyse).'
 WHERE tenant_id IS NULL
   AND key = 'label.klanten.rapport.patronen.leeg';
