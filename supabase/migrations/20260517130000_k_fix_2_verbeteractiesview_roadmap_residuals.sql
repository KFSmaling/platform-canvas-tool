-- K-fix-2: Klanten VerbeteractiesView Roadmap-residuals cleanup
-- Applied via Supabase-MCP apply_migration genaamd `k_fix_2_verbeteractiesview_roadmap_residuals`.
-- Bestand in repo voor git-history; SQL identiek aan applied versie.
-- Vervolg op K-fix (master 7435e0b). Reviewer-correctie type-9-omission:
-- VerbeteractiesView is de ACTIEVE view sinds RFC-007 C1, niet VerbeterrichtingenView.

-- Bevinding 1: confirm-dialog Roadmap-tekst weggehaald (CRITICAL: zichtbaar in productie)
DELETE FROM app_config
  WHERE key = 'label.klanten.verbeteractie.handover.confirm'
    AND tenant_id IS NULL;

-- Bevinding 2: intro-tekst Roadmap-mention weghalen
UPDATE app_config
  SET value = 'Verbeteracties starten als concept — vanuit AI-patroonherkenning of als eigen actie. Bewerk wat moet, verwijder wat niet klopt, maak definitief wat blijft.',
      description = COALESCE(description, '') || ' [K-fix-2: "...maak definitief wat de roadmap in moet" → "...maak definitief wat blijft"]'
  WHERE key = 'label.klanten.verbeteractie.intro'
    AND tenant_id IS NULL;
