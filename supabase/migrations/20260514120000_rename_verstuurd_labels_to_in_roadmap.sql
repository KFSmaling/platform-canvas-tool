-- ============================================================
-- Stap 11.K.2 F18 — UI-rebrand 'verstuurd' → 'in roadmap'.
--
-- Optie A uit findings-tracker F18: alleen label-waarden veranderen.
-- DB-enum `cd_improvement_intents.status` blijft `'verstuurd'`. API-action-
-- namen (`handover_to_roadmap`, `unsend`) blijven ongewijzigd. Filter-queries
-- en code-checks `intent.status === 'verstuurd'` blijven ongewijzigd.
--
-- Invasieve DB-rename bundelt in latere cleanup-sprint of in RFC-003 /
-- 11.L Roadmap-werkblad. Reviewer-update 11 mei 22:45: ADR-004 §G hanteert
-- *"Markeer als in roadmap"* (consistent met andere "Markeer als ..."-labels).
--
-- Key-namen blijven ongewijzigd — alleen waarden updaten.
-- Idempotent via UPDATE … WHERE key = … (lege match = no-op).
-- ============================================================

UPDATE app_config SET value = 'Markeer als in roadmap'
  WHERE key = 'label.klanten.verbeterrichting.actie.markeer' AND tenant_id IS NULL;

UPDATE app_config SET value = 'Haal uit roadmap'
  WHERE key = 'label.klanten.verbeterrichting.actie.terugtrekken' AND tenant_id IS NULL;

UPDATE app_config SET value = 'in roadmap'
  WHERE key = 'label.klanten.verbeterrichting.status.verstuurd' AND tenant_id IS NULL;

UPDATE app_config SET value = 'in roadmap'
  WHERE key = 'label.klanten.verbeterrichting.counter.verstuurd' AND tenant_id IS NULL;

UPDATE app_config SET value = 'in roadmap sinds'
  WHERE key = 'label.klanten.verbeterrichting.handover.datum' AND tenant_id IS NULL;

UPDATE app_config SET value = 'Markeer deze richting als in roadmap (stub — Roadmap-werkblad volgt)'
  WHERE key = 'label.klanten.verbeterrichting.handover.tooltip' AND tenant_id IS NULL;
