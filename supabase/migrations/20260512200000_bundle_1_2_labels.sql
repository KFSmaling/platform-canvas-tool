-- ============================================================
-- Bundle 1+2 — Copy & UX-toelichtingen label-bundle.
--
-- Scope:
--  Stap 2.2  F29 deel-1: "Markeer als in roadmap" → "Naar roadmap"
--  Stap 2.1  F20: 2 nieuwe rapport-labels (counter + samenvatting)
--  Stap 3.2  F25: strategische-weging uitleg-tekst
--  Stap 3.3  F28: analyse-intro + 4 actie-tooltips
--  Stap 3.4  F29 deel-2: 3 status-tooltips (concept / in-roadmap / Naar-roadmap)
--
-- Idempotent via ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value.
-- Alle keys `tenant_id=NULL` (Platform-default) + `tenant_overridable=true` zodat
-- consultancy-tenants UI-terminologie kunnen aanpassen.
--
-- LABEL_FALLBACKS in `src/shared/context/AppConfigContext.jsx` synchroon
-- met deze waarden (handmatig in dezelfde commit-bundle).
-- ============================================================

-- ── 2.2 F29 deel-1 ──────────────────────────────────────────
-- Rebrand "Markeer als in roadmap" naar kort/punchy "Naar roadmap".
UPDATE app_config
   SET value = 'Naar roadmap'
 WHERE category = 'label'
   AND key = 'label.klanten.verbeterrichting.actie.markeer'
   AND tenant_id IS NULL;

-- ── Nieuwe label-keys ───────────────────────────────────────
INSERT INTO app_config (key, category, description, value, tenant_id, tenant_overridable) VALUES

  -- 2.1 F20 — RapportView counter + samenvatting (hardcoded → appLabel)
  ('label.klanten.rapport.counter.verbeteracties',
   'label',
   'Counter-label in rapport-samenvatting (enkelvoud/meervoud handled door pluralisation in code)',
   'verbeteracties',
   NULL, true),
  ('label.klanten.rapport.samenvatting.volledig',
   'label',
   'Samenvatting-tekst wanneer werkblad volledig is doorlopen (intents aanwezig)',
   'Werkblad in volledige fase-keten — verbeteracties vastgelegd.',
   NULL, true),

  -- 3.2 F25 — Strategische-weging uitleg-tekst
  ('label.klanten.veld.klantreis.strategische_weging.uitleg',
   'label',
   'Uitleg-tekst bovenaan StrategischeWegingBlok — vervangt internal jargon "80/20-denkdwang" in UI',
   'Niet elke stap weegt even zwaar. Markeer Moments of Truth (kritische ervaringsmomenten waar de klant "wakker wordt") en Silent periods (stille fases waar de klant uit zicht is — risico op churn). Pas de weging aan om strategisch belang in de rapport- en analyse-laag zichtbaar te maken.',
   NULL, true),

  -- 3.3 F28 — Analyse-intro + 4 actie-tooltips
  ('label.klanten.analyse.intro',
   'label',
   'Intro-tekst boven AI-knoppen-rij in AnalyseView (vervangt "ai doet eerste pas")',
   'Patronen herkennen in de pijnpunten — selecteer een analyse-type hieronder. AI doet de eerste pas; jij blijft eigenaar van het resultaat. Bewerk wat moet, verwijder wat niet klopt, markeer wat doorbouwt naar verbeteracties.',
   NULL, true),
  ('label.klanten.analyse.actie.accept.tooltip',
   'label',
   'Tooltip op SuggestionCard "Markeer als richting"-knop',
   'Dit patroon doorbouwen naar fase 4 als verbeteractie',
   NULL, true),
  ('label.klanten.analyse.actie.refine.edit.tooltip',
   'label',
   'Tooltip op SuggestionCard "Bewerk"-knop',
   'Tekst aanpassen — audit-spoor onthoudt dat consultant gewijzigd heeft',
   NULL, true),
  ('label.klanten.analyse.actie.reject.tooltip',
   'label',
   'Tooltip op SuggestionCard "Verwijder"-knop',
   'Wegnemen uit zicht. Zichtbaar in "Verwijderd"-collapse om terug te halen',
   NULL, true),
  ('label.klanten.analyse.actie.refine.deeper.tooltip',
   'label',
   'Tooltip op SuggestionCard "Verfijn — graaf dieper"-knop',
   'Nieuwe AI-variant op basis van dit patroon',
   NULL, true),

  -- 3.4 F29 deel-2 — 3 status-tooltips IntentCard
  ('label.klanten.verbeterrichting.status.concept.tooltip',
   'label',
   'Tooltip op concept-status-badge in IntentCard',
   'Concept — verbeteractie staat in fase 4 maar is nog niet in Roadmap-werkblad doorgezet',
   NULL, true),
  ('label.klanten.verbeterrichting.status.in_roadmap.tooltip',
   'label',
   'Tooltip op in-roadmap-status-badge in IntentCard',
   'Doorgezet naar Roadmap-werkblad',
   NULL, true),
  ('label.klanten.verbeterrichting.actie.markeer.tooltip',
   'label',
   'Tooltip op "Naar roadmap"-knop in IntentCard',
   'Zet deze verbeteractie in het Roadmap-werkblad voor concrete acties, eigenaars en planning',
   NULL, true)

ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
