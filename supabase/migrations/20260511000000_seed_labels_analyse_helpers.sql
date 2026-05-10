-- ============================================================
-- Stap 11.G.2 — F5 helper-tekst voor pattern-types in AnalyseView.
--
-- 5 nieuwe label-keys:
--   - 4 type-uitleg (cluster/paradox/positionering/overstijgend) gebruikt
--     in AnalyseView onder AI-knoppen-rij + tooltip op SuggestionCard-badge
--   - 1 intro-tekst die het bestaande klanten.analyse.intro vervangt met
--     uitgebreidere onboarding-uitleg (accept / verfijn-edit / graaf dieper / wuif weg)
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO NOTHING.
-- ============================================================

INSERT INTO app_config (key, category, description, value) VALUES
  ('label.klanten.analyse.helper.cluster',       'label', 'Helper-tekst onder AI-knoppen voor cluster-type',       'Groep pijnpunten die samen wijzen op een capability- of positionering-vraagstuk'),
  ('label.klanten.analyse.helper.paradox',       'label', 'Helper-tekst onder AI-knoppen voor paradox-type',       'Pijnpunten die elkaar conceptueel tegenspreken of waar oplossing van A juist B verergert'),
  ('label.klanten.analyse.helper.positionering', 'label', 'Helper-tekst onder AI-knoppen voor positionering-type', 'Propositie of segment waar pijnpunten wijzen op onduidelijke plek t.o.v. concurrenten'),
  ('label.klanten.analyse.helper.overstijgend',  'label', 'Helper-tekst onder AI-knoppen voor overstijgend-type',  'Pijnpunten zonder specifieke koppeling die het hele werkblad raken'),
  ('label.klanten.analyse.helper.intro',         'label', 'Vervangt klanten.analyse.intro met uitgebreidere onboarding-uitleg', 'AI doet een eerste pas op je pijnpunten. Per suggestie kies je: accepteer, verfijn (eigen tekst), graaf dieper (AI verfijnt), of wuif weg.')
ON CONFLICT (tenant_id, key) DO NOTHING;
