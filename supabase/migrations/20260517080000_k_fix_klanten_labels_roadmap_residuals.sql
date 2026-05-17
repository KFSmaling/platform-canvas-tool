-- K-fix: Klanten-werkblad label-correcties + Roadmap-residuals-cleanup
-- Applied via Supabase-MCP apply_migration genaamd `k_fix_klanten_labels_roadmap_residuals`.
-- Bestand in repo voor git-history; SQL identiek aan applied versie.
-- Volledige diagnose: platform/reviewer/findings/2026-05-17-klanten-statussen-diagnose.md

-- Bevinding 1: draft-pijnpunt-accept-label was semantisch onjuist
-- ("Maak verbeteractie" terwijl knop alleen is_draft=false zet, geen verbeteractie aanmaakt)
DELETE FROM app_config
  WHERE key = 'label.klanten.dossier.fields.actie.maakverbeteractie'
    AND tenant_id IS NULL;

INSERT INTO app_config (key, category, description, value, tenant_overridable)
VALUES (
  'label.klanten.pijnpunt.draft.actie.accept',
  'label',
  'K-fix: knop op draft-pijnpunt-rij om canonical te maken (vervangt foutieve label.klanten.dossier.fields.actie.maakverbeteractie). Maakt geen verbeteractie aan.',
  'Maak pijnpunt definitief',
  false
)
ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Bevinding 3a: confirm-dialoog weggehaald
-- (Roadmap-werkblad is uit MVP-scope; definitief-maken is reversible via "Terug naar concept")
DELETE FROM app_config
  WHERE key = 'label.klanten.verbeterrichting.handover.confirm'
    AND tenant_id IS NULL;

-- Bevinding 3b: intro-tekst tweede zin weghalen (Roadmap-verwijzing)
UPDATE app_config
  SET value = 'Verscherp geaccepteerde patronen tot intent.',
      description = COALESCE(description, '') || ' [K-fix: tweede zin "Verstuur naar Roadmap..." weggehaald]'
  WHERE key = 'label.klanten.verbeterrichting.intro'
    AND tenant_id IS NULL;

-- Bevinding 3c: drie termen voor één state → consistent 'definitief'
UPDATE app_config
  SET value = 'definitief',
      description = COALESCE(description, '') || ' [K-fix: was "in roadmap" / "verstuurd"]'
  WHERE key = 'label.klanten.verbeterrichting.counter.verstuurd'
    AND tenant_id IS NULL;

UPDATE app_config
  SET value = 'definitief sinds',
      description = COALESCE(description, '') || ' [K-fix: was "in roadmap sinds"]'
  WHERE key = 'label.klanten.verbeterrichting.handover.datum'
    AND tenant_id IS NULL;

UPDATE app_config
  SET value = 'Verbeteractie is definitief',
      description = COALESCE(description, '') || ' [K-fix: was "Doorgezet naar Roadmap-werkblad"]'
  WHERE key = 'label.klanten.verbeterrichting.status.in_roadmap.tooltip'
    AND tenant_id IS NULL;

UPDATE app_config
  SET value = 'Concept — verbeteractie staat in fase 4 maar is nog niet definitief gemaakt',
      description = COALESCE(description, '') || ' [K-fix: was Roadmap-verwijzing]'
  WHERE key = 'label.klanten.verbeterrichting.status.concept.tooltip'
    AND tenant_id IS NULL;

UPDATE app_config
  SET value = 'Maak deze verbeteractie definitief',
      description = COALESCE(description, '') || ' [K-fix: was Roadmap-doorzet-tekst]'
  WHERE key = 'label.klanten.verbeterrichting.actie.markeer.tooltip'
    AND tenant_id IS NULL;
