-- ============================================================
-- Stap 11.F — Labels-seed Klanten-werkblad fase 2 (Pijnpunten)
--
-- Aanvulling op stap-11.D + 11.E label-seeds. Naming: label.klanten.pijnpunt.*
-- + label.klanten.dimensie.edit.* (boy-scout uit 11.E).
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO NOTHING.
-- ============================================================

INSERT INTO app_config (key, category, description, value) VALUES
  -- Boy-scout: dimensie-edit (DimensieModal mode="edit")
  ('label.klanten.dimensie.edit.titel',             'label', 'Modal-titel dimensie bewerken',                  'Dimensie bewerken'),
  ('label.klanten.dimensie.edit.tooltip',           'label', 'Tooltip op dimensie-naam-header',                'Klik om te bewerken'),
  ('label.klanten.dimensie.edit.archetype.locked',  'label', 'Inline-noot dat archetype niet wijzigbaar is',   '(niet wijzigbaar — datamodel-impact)'),

  -- PijnpuntenView intro + lijst
  ('label.klanten.pijnpunt.intro',           'label', 'Intro-tekst boven pijnpunten-lijst',           'verzamel waarnemingen en koppel aan items. multi-relationeel — een pijnpunt mag aan meerdere dimensies hangen, of nergens (overstijgend).'),
  ('label.klanten.pijnpunt.lijst.titel',     'label', 'Lijst-kop in werkruimte',                       'Pijnpunten'),
  ('label.klanten.pijnpunt.lijst.helper',    'label', 'Helper achter count',                           'card laat koppelingen zien als chips'),
  ('label.klanten.pijnpunt.lijst.leeg',      'label', 'Empty-state-tekst werkruimte',                  'Nog geen pijnpunten — voeg er één toe.'),

  -- CTA's
  ('label.klanten.pijnpunt.knop.toevoegen',         'label', 'Compacte knop boven gevulde lijst',     '+ pijnpunt'),
  ('label.klanten.pijnpunt.knop.toevoegen.eerste',  'label', 'Prominente CTA in lege state',           '+ Eerste pijnpunt aanmaken'),

  -- PijnpuntModal — header + velden
  ('label.klanten.pijnpunt.create.titel',                   'label', 'Modal-titel nieuw pijnpunt',               'Nieuw pijnpunt'),
  ('label.klanten.pijnpunt.edit.titel',                     'label', 'Modal-titel pijnpunt bewerken',            'Pijnpunt bewerken'),
  ('label.klanten.pijnpunt.create.tekst.label',             'label', 'Veld-label tekst',                          'Pijnpunt-tekst'),
  ('label.klanten.pijnpunt.create.tekst.placeholder',       'label', 'Placeholder tekst-veld',                    'Beschrijf de waarneming of het pijnpunt — bron mag in de tekst (markdown)'),
  ('label.klanten.pijnpunt.create.koppelingen.label',       'label', 'Veld-label koppelingen-multi-select',       'Koppelingen aan items (optioneel)'),
  ('label.klanten.pijnpunt.create.koppelingen.helper',      'label', 'Helper bij koppelingen-multi-select',       'Géén selectie = overstijgend pijnpunt (geen specifieke item-koppeling)'),
  ('label.klanten.pijnpunt.create.error.tekst_leeg',        'label', 'Inline error bij lege tekst',               'Tekst is verplicht'),
  ('label.klanten.pijnpunt.create.overstijgend.warning',    'label', 'Inline warning bij geen koppeling',         'Wordt opgeslagen als overstijgend pijnpunt (geen koppeling)'),

  -- PijnpuntCard — overstijgend-label
  ('label.klanten.pijnpunt.overstijgend.label',     'label', 'Tekst op card zonder koppeling',          'geen koppeling — overstijgend'),

  -- Rapport-laag uitbreiding
  ('label.klanten.rapport.section.pijnpunten',      'label', 'Rapport-sectie pijnpunten',                 'Pijnpunten'),
  ('label.klanten.rapport.pijnpunten.leeg',         'label', 'Rapport: geen pijnpunten vastgelegd',       'Nog geen pijnpunten vastgelegd.'),
  ('label.klanten.pijnpunt.overstijgend.section',   'label', 'Rapport-sub-sectie overstijgend',           'Overstijgend (geen koppeling)')
ON CONFLICT (tenant_id, key) DO NOTHING;
