-- ============================================================
-- Stap 11.H — Fase 4 Verbeterrichtingen label-seed.
--
-- Doelen:
--  1. Nieuwe algemene `klanten.actie.*`-key-set (Optie 2 uit RFC-002 RP1
--     open vraag #11). Herbruikbaar voor 11.K dossier-driven, F10 cross-
--     werkblad-pattern. Deprecatie van bestaande `klanten.analyse.actie.*`-
--     keys blijft achter — niet aanraken, latere cleanup-sprint.
--  2. Fase-4-tab content: counter, intent-modal, intent-card, promote-modal,
--     handover-stub, rapport-sectie.
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value.
-- `tenant_overridable=true` op alle keys — UI-terminologie kan per tenant.
-- ============================================================

INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES

  -- ── Algemene actie-keys (Optie 2: herbruikbaar over werkbladen heen) ──
  ('label.klanten.actie.bewerk',          'label', 'Algemene Bewerk-knop (werkblad-overstijgend)',          'Bewerk',                NULL, true),
  ('label.klanten.actie.verwijder',       'label', 'Algemene Verwijder-knop (werkblad-overstijgend)',       'Verwijder',             NULL, true),
  ('label.klanten.actie.markeer',         'label', 'Algemene Markeer-knop (status-transitie)',              'Markeer als verstuurd', NULL, true),
  ('label.klanten.actie.terugtrekken',    'label', 'Algemene Terugtrekken-knop (status-transitie omgekeerd)', 'Terugtrekken',         NULL, true),
  ('label.klanten.actie.promote',         'label', 'Promote-knop vanuit gemarkeerde suggestion naar intent', 'Promote naar verbeterrichting', NULL, true),

  -- ── VerbeterrichtingenView root ──
  ('label.klanten.verbeterrichting.titel',         'label', 'Sectie-titel verbeterrichtingen-view',  'Verbeterrichtingen',           NULL, true),
  ('label.klanten.verbeterrichting.intro',         'label', 'Intro-tekst boven intent-lijst',        'Verscherp geaccepteerde patronen tot intent. Verstuur naar Roadmap voor concrete acties, eigenaars en planning.', NULL, true),
  ('label.klanten.verbeterrichting.counter.concept',   'label', 'Counter-label voor concept-intents',   'concept',   NULL, true),
  ('label.klanten.verbeterrichting.counter.verstuurd', 'label', 'Counter-label voor verstuurde intents', 'verstuurd', NULL, true),
  ('label.klanten.verbeterrichting.counter.separator', 'label', 'Counter-separator',                     '·',         NULL, true),
  ('label.klanten.verbeterrichting.lijst.leeg',    'label', 'Empty-state in intent-lijst',           'Nog geen verbeterrichtingen — promoot een gemarkeerd patroon vanuit fase 3 of voeg een eigen richting toe.', NULL, true),
  ('label.klanten.verbeterrichting.knop.toevoegen','label', 'CTA-knop nieuwe verbeterrichting',      '+ verbeterrichting toevoegen', NULL, true),
  ('label.klanten.verbeterrichting.knop.opslaan',  'label', 'Modal-opslaan-knop',                    'Opslaan',                      NULL, true),
  ('label.klanten.verbeterrichting.knop.annuleren','label', 'Modal-annuleren-knop',                  'Annuleren',                    NULL, true),

  -- ── Status-badges ──
  ('label.klanten.verbeterrichting.status.concept',   'label', 'Status-badge concept',   'concept',   NULL, true),
  ('label.klanten.verbeterrichting.status.verstuurd', 'label', 'Status-badge verstuurd', 'verstuurd', NULL, true),

  -- ── IntentModal ──
  ('label.klanten.verbeterrichting.modal.create.titel', 'label', 'Modal-titel create-mode',        'Nieuwe verbeterrichting',       NULL, true),
  ('label.klanten.verbeterrichting.modal.edit.titel',   'label', 'Modal-titel edit-mode',          'Verbeterrichting bewerken',     NULL, true),
  ('label.klanten.verbeterrichting.veld.titel.label',   'label', 'Veld-label titel',               'Titel',                         NULL, true),
  ('label.klanten.verbeterrichting.veld.titel.placeholder', 'label', 'Veld-placeholder titel',     'Korte titel ("SME-bediening structureel versterken")', NULL, true),
  ('label.klanten.verbeterrichting.veld.intent.label',  'label', 'Veld-label intent-tekst',        'Beschrijving',                  NULL, true),
  ('label.klanten.verbeterrichting.veld.intent.placeholder', 'label', 'Veld-placeholder intent',   'Verscherp het patroon tot een concrete verbeterrichting. Wat moet er gebeuren en waarom?', NULL, true),
  ('label.klanten.verbeterrichting.veld.vanuit.label',  'label', 'Veld-label vanuit-chips',        'Vanuit',                        NULL, true),
  ('label.klanten.verbeterrichting.veld.vanuit.helper', 'label', 'Helper-tekst vanuit',            'Verwijst naar bron-patronen of context — automatisch gevuld bij promote.', NULL, true),
  ('label.klanten.verbeterrichting.error.titel_leeg',   'label', 'Validatie titel verplicht',      'Titel is verplicht (1-100 tekens)', NULL, true),
  ('label.klanten.verbeterrichting.error.intent_leeg',  'label', 'Validatie intent-tekst verplicht', 'Beschrijving is verplicht (minimaal 50 tekens)', NULL, true),
  ('label.klanten.verbeterrichting.error.intent_te_lang','label', 'Validatie intent-tekst te lang', 'Beschrijving overschrijdt 2000 tekens', NULL, true),

  -- ── PromoteToIntentModal ──
  ('label.klanten.verbeterrichting.promote.titel',      'label', 'Promote-modal titel',            'Promote naar verbeterrichting', NULL, true),
  ('label.klanten.verbeterrichting.promote.intro',      'label', 'Intro promote-modal',            'Verscherp dit gemarkeerde patroon tot een concrete verbeterrichting. Title en beschrijving zijn vooringevuld — bewerk waar nodig.', NULL, true),

  -- ── Handover-stub ──
  ('label.klanten.verbeterrichting.handover.confirm',   'label', 'Confirm-dialoog Roadmap-stub',   'Roadmap-werkblad is nog niet beschikbaar — actie wordt vastgelegd zodat hij later kan worden opgepakt. Doorgaan?', NULL, true),
  ('label.klanten.verbeterrichting.handover.datum',     'label', 'Status-badge prefix met datum',  'verstuurd op', NULL, true),
  ('label.klanten.verbeterrichting.handover.tooltip',   'label', 'Tooltip op Markeer-knop',        'Markeer deze richting als verstuurd naar Roadmap (stub — Roadmap-werkblad volgt)', NULL, true),

  -- ── Rapport-sectie ──
  ('label.klanten.rapport.section.verbeterrichtingen',  'label', 'Rapport-sectie titel verbeterrichtingen', 'Verbeterrichtingen', NULL, true),
  ('label.klanten.rapport.verbeterrichtingen.leeg',     'label', 'Empty-state rapport verbeterrichtingen', 'Nog geen verbeterrichtingen vastgelegd — werkblad zit nog in inventarisatie/analyse-fase.', NULL, true)

ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
