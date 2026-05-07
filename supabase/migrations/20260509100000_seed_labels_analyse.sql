-- ============================================================
-- Stap 11.G — Fase 3 Analyse: labels-seed.
--
-- Naming-convention conform stap 11.D/E/F: label.klanten.analyse.<sectie>.<element>.
-- Idempotent via ON CONFLICT (tenant_id, key) DO NOTHING.
-- ============================================================

INSERT INTO app_config (key, category, description, value) VALUES
  -- Fase-tab + intro
  ('label.klanten.fase.3.titel',                       'label', 'Fase-tab fase 3',                                'Analyse'),
  ('label.klanten.analyse.intro',                       'label', 'Intro-tekst boven analyse-werkruimte',          'AI doet een eerste pas met patroon-suggesties. Consultant blijft eigenaar — accept, verfijn, of wuif weg.'),

  -- AI-affordance-knoppen (4 stuks)
  ('label.klanten.analyse.knop.cluster',                'label', 'AI-knop cluster-detectie',                      'Cluster zoeken'),
  ('label.klanten.analyse.knop.cluster.helper',         'label', 'Tooltip cluster',                                'Groepen pijnpunten met gemeenschappelijke oorzaak'),
  ('label.klanten.analyse.knop.paradox',                'label', 'AI-knop paradox-detectie',                      'Paradox zoeken'),
  ('label.klanten.analyse.knop.paradox.helper',         'label', 'Tooltip paradox',                                'Pijnpunten die elkaar tegenspreken'),
  ('label.klanten.analyse.knop.positionering',          'label', 'AI-knop positionering-detectie',                'Positionering toetsen'),
  ('label.klanten.analyse.knop.positionering.helper',   'label', 'Tooltip positionering',                          'Wie zijn we voor wie — zwakke plekken'),
  ('label.klanten.analyse.knop.overstijgend',           'label', 'AI-knop overstijgend-detectie',                 'Overstijgend zoeken'),
  ('label.klanten.analyse.knop.overstijgend.helper',    'label', 'Tooltip overstijgend',                           'Capabilities die het hele werkblad raken'),

  -- Loading + error
  ('label.klanten.analyse.loading',                     'label', 'Loading-tekst tijdens AI-call',                  'AI denkt na…'),
  ('label.klanten.analyse.error.generic',               'label', 'Generieke fout-melding',                         'Genereren mislukt'),
  ('label.klanten.analyse.error.parse',                 'label', 'Parse-fout AI-output',                            'AI-output kon niet gelezen worden — probeer opnieuw'),
  ('label.klanten.analyse.error.retry',                 'label', 'Retry-knop bij fout',                            'Opnieuw'),
  ('label.klanten.analyse.empty.geen_data',             'label', 'Empty-state als canvas geen pijnpunten heeft',  'Voeg eerst pijnpunten toe in fase 2 voordat je analyse draait.'),

  -- Counter
  ('label.klanten.analyse.counter.geaccepteerd',        'label', 'Counter "X geaccepteerd"',                       'geaccepteerd'),
  ('label.klanten.analyse.counter.weggewuifd',          'label', 'Counter "Y weggewuifd"',                          'weggewuifd'),
  ('label.klanten.analyse.counter.separator',           'label', 'Separator tussen counters',                      '·'),

  -- Suggestion-list
  ('label.klanten.analyse.lijst.titel',                 'label', 'Lijst-kop suggesties',                            'Suggesties'),
  ('label.klanten.analyse.lijst.leeg',                  'label', 'Empty-state lijst (geen suggesties)',            'Nog geen suggesties — klik een AI-knop hierboven of voeg een eigen patroon toe.'),

  -- Pattern-type-badges (5 stuks)
  ('label.klanten.analyse.type.cluster',                'label', 'Badge cluster',                                  'Cluster'),
  ('label.klanten.analyse.type.paradox',                'label', 'Badge paradox',                                  'Paradox'),
  ('label.klanten.analyse.type.positionering',          'label', 'Badge positionering',                            'Positionering'),
  ('label.klanten.analyse.type.overstijgend',           'label', 'Badge overstijgend',                             'Overstijgend'),
  ('label.klanten.analyse.type.eigen',                  'label', 'Badge eigen patroon',                            'Eigen'),
  ('label.klanten.analyse.badge.verfijnd',              'label', 'Badge verfijnd (is_user_edited=true)',           'verfijnd'),

  -- Suggestion-card-acties (4 stuks)
  ('label.klanten.analyse.actie.accept',                'label', 'Knop accept',                                    'Accept'),
  ('label.klanten.analyse.actie.refine.edit',           'label', 'Knop refine — edit',                             'Verfijn — bewerken'),
  ('label.klanten.analyse.actie.refine.deeper',         'label', 'Knop refine — graaf dieper',                     'Verfijn — graaf dieper'),
  ('label.klanten.analyse.actie.reject',                'label', 'Knop reject',                                    'Wuif weg'),
  ('label.klanten.analyse.accept.tooltip.fase4',        'label', 'Tooltip Accept (placeholder fase 4)',            'nog te promoten in fase 4 — komt later'),

  -- Vanuit-chips
  ('label.klanten.analyse.vanuit.label',                'label', 'Label boven "vanuit"-chips',                     'Vanuit:'),

  -- Suggestion-edit-modal
  ('label.klanten.analyse.modal.edit.titel',            'label', 'Modal-titel suggestie bewerken',                 'Suggestie bewerken'),
  ('label.klanten.analyse.modal.edit.tekst.label',      'label', 'Veld-label tekst-veld',                          'Tekst'),
  ('label.klanten.analyse.modal.edit.origineel.toggle', 'label', 'Toggle-tekst originele AI-tekst',                 'originele AI-tekst'),
  ('label.klanten.analyse.modal.edit.opslaan',          'label', 'Opslaan-knop',                                   'Opslaan'),
  ('label.klanten.analyse.modal.edit.annuleer',         'label', 'Annuleer-knop',                                   'Annuleren'),

  -- Refine-deeper mini-modal
  ('label.klanten.analyse.modal.deeper.titel',          'label', 'Modal-titel refine-deeper',                       'Wat wil je dieper laten graven?'),
  ('label.klanten.analyse.modal.deeper.placeholder',    'label', 'Placeholder refinement_focus',                   'bijv. specifiek voor SME-segment'),
  ('label.klanten.analyse.modal.deeper.helper',         'label', 'Helper-tekst onder veld',                         'AI gebruikt deze focus om een verfijnde suggestie te genereren'),
  ('label.klanten.analyse.modal.deeper.submit',         'label', 'Submit-knop',                                    'Genereer verfijning'),

  -- Eigen-patroon-modal
  ('label.klanten.analyse.knop.eigen_patroon',          'label', 'CTA "+ eigen patroon" onderaan lijst',           '+ eigen patroon'),
  ('label.klanten.analyse.modal.eigen.titel',           'label', 'Modal-titel eigen patroon',                       'Eigen patroon toevoegen'),
  ('label.klanten.analyse.modal.eigen.type.label',      'label', 'Veld-label pattern-type-dropdown',                'Type'),
  ('label.klanten.analyse.modal.eigen.tekst.label',     'label', 'Veld-label tekst',                                'Beschrijving'),
  ('label.klanten.analyse.modal.eigen.tekst.placeholder','label', 'Placeholder tekst-veld',                          'Beschrijf het patroon dat je ziet (markdown ondersteund)'),
  ('label.klanten.analyse.modal.eigen.vanuit.label',    'label', 'Veld-label vanuit',                               'Vanuit (optioneel)'),
  ('label.klanten.analyse.modal.eigen.vanuit.helper',   'label', 'Helper-tekst vanuit',                             'Welke pijnpunten of items onderbouwen dit patroon?'),
  ('label.klanten.analyse.modal.eigen.opslaan',         'label', 'Opslaan-knop eigen patroon',                      'Toevoegen'),

  -- Rapport-laag (sectie + helper)
  ('label.klanten.rapport.section.patronen',            'label', 'Rapport-sectie patronen',                         'Geaccepteerde patronen'),
  ('label.klanten.rapport.patronen.leeg',               'label', 'Rapport: geen geaccepteerde patronen',           'Nog geen geaccepteerde patronen.')

ON CONFLICT (tenant_id, key) DO NOTHING;
